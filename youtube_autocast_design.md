# YouTube自動Cast配信システム 開発設計書

## 1. 要件定義

### 1.1 機能要件

- 曜日別配信スケジュール管理（手動登録）
- YouTube Live配信の自動検知
- ChromeCastデバイスへの自動キャスト
- Webダッシュボードでの状態監視・設定
- 手動キャスト開始/停止機能

### 1.2 非機能要件

- 24時間稼働対応
- レスポンス時間: 3秒以内
- 同時監視配信数: 1
- 同時利用ユーザー数: 1
- YouTube API制限遵守

### 1.3 制約事項

- YouTube配信のみ対応
- ローカルネットワーク内のChromeCastデバイス対象
- 単一配信の監視・キャスト

## 2. システム構成

### 2.1 全体アーキテクチャ

```
[Webブラウザ] ←WebSocket→ [Node.jsサーバー] ←→ [SQLiteDB]
                              ↓
                        [スケジューラー]
                              ↓
                    [ChromeCast制御部] ←→ [ローカルネットワーク]
                              ↓
                        [YouTube API]
```

### 2.2 技術スタック

**Backend**

- Node.js 18+
- Express.js (Webサーバー)
- castv2-client (ChromeCast制御)
- ws (WebSocket通信)
- node-cron (スケジューリング)
- googleapis (YouTube API)
- sqlite3 (データベース)

**Frontend**

- Svelte/SvelteKit
- Tailwind CSS
- WebSocket Client

**外部API**

- YouTube Data API v3

## 3. データベース設計

### 3.1 テーブル定義

```sql
-- 配信スケジュール
CREATE TABLE schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    day_of_week INTEGER NOT NULL, -- 0:日曜 〜 6:土曜
    start_time TEXT NOT NULL,     -- "09:00" 形式
    duration_minutes INTEGER DEFAULT 120,
    device_id INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES chromecast_devices(id)
);

-- ChromeCastデバイス
CREATE TABLE chromecast_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    ip_address TEXT NOT NULL,
    port INTEGER DEFAULT 8009,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    last_seen DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- キャストログ
CREATE TABLE cast_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER,
    video_id TEXT,
    video_title TEXT,
    device_id INTEGER,
    status TEXT, -- 'started', 'stopped', 'error'
    error_message TEXT,
    started_at DATETIME,
    ended_at DATETIME,
    FOREIGN KEY (schedule_id) REFERENCES schedules(id),
    FOREIGN KEY (device_id) REFERENCES chromecast_devices(id)
);
```

## 4. API設計

### 4.1 REST API仕様

```
# スケジュール管理
GET    /api/schedules              # スケジュール一覧取得
POST   /api/schedules              # スケジュール作成
GET    /api/schedules/:id          # スケジュール詳細取得
PUT    /api/schedules/:id          # スケジュール更新
DELETE /api/schedules/:id          # スケジュール削除

# デバイス管理
GET    /api/devices                # デバイス一覧取得
POST   /api/devices/scan           # デバイス検索実行
PUT    /api/devices/:id            # デバイス設定更新

# キャスト制御
POST   /api/cast/start             # 手動キャスト開始
POST   /api/cast/stop              # キャスト停止
GET    /api/cast/status            # キャスト状態取得

# YouTube API
GET    /api/youtube/search         # チャンネル検索
GET    /api/youtube/channel/:id    # チャンネル情報取得
```

### 4.2 WebSocket イベント

```javascript
// サーバー → クライアント
{
  type: 'schedule_triggered',
  data: { scheduleId, channelName, startTime }
}

{
  type: 'live_detected',
  data: { videoId, title, thumbnail }
}

{
  type: 'cast_started',
  data: { videoId, deviceName, timestamp }
}

{
  type: 'cast_stopped',
  data: { reason, timestamp }
}

{
  type: 'error',
  data: { message, details }
}

// クライアント → サーバー
{
  type: 'manual_cast',
  data: { videoId }
}

{
  type: 'stop_cast'
}
```

## 5. 主要コンポーネント設計

### 5.1 スケジューラー

```javascript
class ScheduleManager {
    constructor(db, youtubeAPI, castController) {
        this.db = db;
        this.youtubeAPI = youtubeAPI;
        this.castController = castController;
        this.cronJobs = new Map();
    }

    async initializeSchedules() {
        const schedules = await this.db.getActiveSchedules();
        schedules.forEach(schedule => {
            this.registerCronJob(schedule);
        });
    }

    registerCronJob(schedule) {
        const cronTime = this.convertToCronTime(schedule.day_of_week, schedule.start_time);
        const job = cron.schedule(cronTime, () => {
            this.checkAndStartCast(schedule);
        });
        this.cronJobs.set(schedule.id, job);
    }

    async checkAndStartCast(schedule) {
        try {
            const liveStream = await this.youtubeAPI.checkChannelLive(schedule.channel_id);
            if (liveStream) {
                await this.castController.startCast(liveStream.videoId, schedule.device_id);
            }
        } catch (error) {
            console.error('Cast error:', error);
        }
    }
}
```

### 5.2 ChromeCast制御

```javascript
class ChromeCastController {
    constructor() {
        this.devices = new Map();
        this.currentCast = null;
    }

    async discoverDevices() {
        // mDNS検索でデバイス発見
        const devices = await this.scanNetwork();
        devices.forEach(device => {
            this.devices.set(device.name, device);
        });
        return Array.from(this.devices.values());
    }

    async startCast(videoId, deviceId) {
        const device = await this.getDevice(deviceId);
        const client = new Client();
        
        try {
            await client.connect(device.ip_address);
            
            const media = {
                contentId: `https://www.youtube.com/watch?v=${videoId}`,
                contentType: 'video/mp4',
                streamType: 'LIVE',
                metadata: {
                    type: 0,
                    metadataType: 0,
                    title: 'YouTube Live',
                }
            };

            client.launch(DefaultMediaReceiver, (err, player) => {
                if (err) throw err;
                
                player.load(media, { autoplay: true }, (err, status) => {
                    if (err) throw err;
                    this.currentCast = { videoId, device: device.name, player };
                    this.notifyClients('cast_started', { videoId, deviceName: device.name });
                });
            });
        } catch (error) {
            console.error('Cast failed:', error);
            throw error;
        }
    }

    async stopCast() {
        if (this.currentCast && this.currentCast.player) {
            this.currentCast.player.stop();
            this.currentCast = null;
            this.notifyClients('cast_stopped', { timestamp: new Date() });
        }
    }
}
```

### 5.3 YouTube API監視

```javascript
class YouTubeMonitor {
    constructor(apiKey) {
        this.youtube = google.youtube({ version: 'v3', auth: apiKey });
    }

    async checkChannelLive(channelId) {
        try {
            const response = await this.youtube.search.list({
                channelId: channelId,
                eventType: 'live',
                type: 'video',
                part: 'snippet',
                maxResults: 1
            });

            if (response.data.items.length > 0) {
                const video = response.data.items[0];
                return {
                    videoId: video.id.videoId,
                    title: video.snippet.title,
                    thumbnail: video.snippet.thumbnails.medium.url
                };
            }
            return null;
        } catch (error) {
            console.error('YouTube API error:', error);
            throw error;
        }
    }

    async searchChannels(query) {
        const response = await this.youtube.search.list({
            q: query,
            type: 'channel',
            part: 'snippet',
            maxResults: 10
        });

        return response.data.items.map(item => ({
            channelId: item.id.channelId,
            name: item.snippet.title,
            thumbnail: item.snippet.thumbnails.default.url,
            description: item.snippet.description
        }));
    }
}
```

## 6. フロントエンド設計

### 6.1 画面構成

```
1. ダッシュボード画面
   - 現在の配信状況
   - 次回配信予定
   - 手動操作ボタン

2. スケジュール設定画面
   - 曜日別スケジュール一覧
   - 新規登録/編集フォーム

3. デバイス管理画面
   - ChromeCastデバイス一覧
   - デバイス検索/設定

4. ログ画面
   - キャスト履歴
   - エラーログ
```

### 6.2 Svelte コンポーネント構成

```javascript
// App.svelte
<script>
  import { Router, link, push } from 'svelte-spa-router';
  import Dashboard from './routes/Dashboard.svelte';
  import ScheduleManager from './routes/ScheduleManager.svelte';
  import DeviceManager from './routes/DeviceManager.svelte';
  import LogViewer from './routes/LogViewer.svelte';
  import Layout from './components/Layout.svelte';

  const routes = {
    '/': Dashboard,
    '/schedules': ScheduleManager,
    '/devices': DeviceManager,
    '/logs': LogViewer,
  };
</script>

<Layout>
  <Router {routes} />
</Layout>

// Dashboard.svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';
  import StatusCard from '../components/StatusCard.svelte';
  import NextScheduleCard from '../components/NextScheduleCard.svelte';
  import ManualControls from '../components/ManualControls.svelte';

  let status = writable('idle');
  let nextSchedule = writable(null);
  let ws;

  onMount(() => {
    ws = new WebSocket('ws://localhost:3001');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };
    
    ws.onopen = () => {
      console.log('WebSocket connected');
    };
  });

  onDestroy(() => {
    if (ws) {
      ws.close();
    }
  });

  function handleWebSocketMessage(data) {
    switch (data.type) {
      case 'cast_started':
        status.set('casting');
        break;
      case 'cast_stopped':
        status.set('idle');
        break;
      case 'schedule_triggered':
        // Handle schedule trigger
        break;
    }
  }

  function sendMessage(type, payload = {}) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, data: payload }));
    }
  }
</script>

<div class="p-6 space-y-6">
  <h1 class="text-2xl font-bold">配信ダッシュボード</h1>
  
  <StatusCard {status} />
  <NextScheduleCard schedule={nextSchedule} />
  <ManualControls {sendMessage} />
</div>

// StatusCard.svelte
<script>
  export let status;
  
  $: statusText = {
    'idle': '待機中',
    'checking': '配信確認中',
    'casting': 'キャスト中',
    'error': 'エラー'
  }[$status] || '不明';
  
  $: statusColor = {
    'idle': 'bg-gray-100 text-gray-800',
    'checking': 'bg-yellow-100 text-yellow-800',
    'casting': 'bg-green-100 text-green-800',
    'error': 'bg-red-100 text-red-800'
  }[$status] || 'bg-gray-100 text-gray-800';
</script>

<div class="bg-white p-6 rounded-lg shadow">
  <h2 class="text-lg font-semibold mb-4">配信状況</h2>
  <div class="flex items-center space-x-4">
    <span class="px-3 py-1 rounded-full text-sm font-medium {statusColor}">
      {statusText}
    </span>
    {#if $status === 'casting'}
      <div class="flex items-center space-x-2">
        <div class="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
        <span class="text-sm text-gray-600">配信中</span>
      </div>
    {/if}
  </div>
</div>

// ScheduleManager.svelte
<script>
  import { onMount } from 'svelte';
  import ScheduleList from '../components/ScheduleList.svelte';
  import ScheduleForm from '../components/ScheduleForm.svelte';
  
  let schedules = [];
  let isEditing = false;
  let editingSchedule = null;

  onMount(async () => {
    await loadSchedules();
  });

  async function loadSchedules() {
    const response = await fetch('/api/schedules');
    schedules = await response.json();
  }

  async function saveSchedule(scheduleData) {
    const method = scheduleData.id ? 'PUT' : 'POST';
    const url = scheduleData.id ? `/api/schedules/${scheduleData.id}` : '/api/schedules';
    
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scheduleData)
    });
    
    await loadSchedules();
    isEditing = false;
    editingSchedule = null;
  }

  function editSchedule(schedule) {
    editingSchedule = schedule;
    isEditing = true;
  }

  function addSchedule() {
    editingSchedule = null;
    isEditing = true;
  }
</script>

<div class="p-6">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold">配信スケジュール</h1>
    <button 
      class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      on:click={addSchedule}
    >
      新規作成
    </button>
  </div>
  
  {#if isEditing}
    <ScheduleForm 
      schedule={editingSchedule} 
      on:save={(e) => saveSchedule(e.detail)}
      on:cancel={() => { isEditing = false; editingSchedule = null; }}
    />
  {:else}
    <ScheduleList 
      {schedules} 
      on:edit={(e) => editSchedule(e.detail)}
      on:delete={loadSchedules}
    />
  {/if}
</div>
```

## 7. 開発・運用設計

### 7.1 ディレクトリ構成

```
youtube-autocast/
├── server/
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── services/
│   │   ├── utils/
│   │   └── app.js
│   ├── database/
│   │   └── schema.sql
│   └── package.json
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── routes/
│   │   ├── stores/
│   │   ├── utils/
│   │   └── App.svelte
│   ├── public/
│   ├── package.json
│   └── svelte.config.js
└── README.md
```

### 7.2 環境変数

```env
# YouTube API
YOUTUBE_API_KEY=your_api_key

# サーバー設定
PORT=3000
WS_PORT=3001

# データベース
DB_PATH=./database/autocast.db

# ログレベル
LOG_LEVEL=info
```

### 7.3 エラーハンドリング

```javascript
// グローバルエラーハンドラー
class ErrorHandler {
    static handle(error, context) {
        console.error(`[${context}] ${error.message}`, error);
        
        // WebSocketでクライアントに通知
        if (this.wsServer) {
            this.wsServer.broadcast({
                type: 'error',
                data: {
                    message: error.message,
                    context: context,
                    timestamp: new Date()
                }
            });
        }
    }
}
```

### 7.4 ログ仕様

```
レベル: ERROR, WARN, INFO, DEBUG
フォーマット: [TIMESTAMP] [LEVEL] [COMPONENT] MESSAGE

例:
[2025-06-09 09:00:01] [INFO] [Scheduler] Schedule triggered: 月曜朝配信
[2025-06-09 09:00:15] [INFO] [YouTube] Live detected: 朝の雑談配信
[2025-06-09 09:00:30] [INFO] [Cast] Started casting to リビングTV
[2025-06-09 09:00:35] [ERROR] [Cast] Device connection failed: timeout
```

## 8. セキュリティ・パフォーマンス

### 8.1 セキュリティ対策

- API Keyの環境変数管理
- SQLインジェクション対策（prepared statement）
- XSS対策（入力値サニタイズ）
- CORS設定
- レート制限実装

### 8.2 パフォーマンス最適化

- YouTube API呼び出し制限（配信時間±30分のみ）
- WebSocketコネクション管理
- データベースインデックス設定
- キャッシュ機能（チャンネル情報等）

## 9. 開発スケジュール

### Phase 1: 基本機能（1週間）

- データベース設計・実装
- YouTube API連携
- 基本的なスケジューラー

### Phase 2: ChromeCast連携（1週間）

- デバイス検索・管理
- キャスト機能実装
- エラーハンドリング

### Phase 3: フロントエンド（4-5日）

- Svelte UI実装
- WebSocket通信
- リアルタイム更新機能

### Phase 4: 統合・テスト（3日）

- 結合テスト
- 本格運用準備
- ドキュメント整備

## 10. テスト計画

### 10.1 単体テスト

- YouTube API呼び出し
- ChromeCast制御
- スケジューラー動作
- データベース操作

### 10.2 結合テスト

- 自動配信フロー
- 手動操作フロー
- エラー復旧フロー
- WebSocket通信

### 10.3 運用テスト

- 24時間稼働テスト
- API制限テスト
- ネットワーク断絶テスト
