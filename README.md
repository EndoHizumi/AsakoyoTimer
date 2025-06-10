# AsakoyoTimer

YouTube Live配信を自動検知してChromeCastデバイスにキャストする自動化システム AsakoyoTimer です。

## 特徴

- 📅 曜日別配信スケジュール管理
- 🔴 YouTube Live配信の自動検知
- 📺 ChromeCastデバイスへの自動キャスト
- 🌐 Webダッシュボードでのリアルタイム監視
- 🔧 手動キャスト開始/停止機能
- 📊 キャストログとエラー追跡

## システム要件

- Node.js 18以上
- ChromeCastデバイス（同一ネットワーク内）
- YouTube Data API v3 キー

## インストール

### 1. リポジトリのクローン

```bash
git clone <repository-url> AsakoyoTimer
cd AsakoyoTimer
```

### 2. サーバー依存関係のインストール

```bash
cd server
npm install
```

### 3. クライアント依存関係のインストール

```bash
cd ../client
npm install
```

### 4. 環境変数の設定

`.env.example`を`.env`にコピーして設定:

```bash
cp .env.example .env
```

`.env`ファイルを編集:

```env
# YouTube API Key (必須)
YOUTUBE_API_KEY=your_youtube_api_key_here

# サーバー設定
PORT=3000
WS_PORT=3001

# データベース
DB_PATH=./database/autocast.db

# ログレベル
LOG_LEVEL=info
```

### 5. YouTube API キーの取得

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成または既存のプロジェクトを選択
3. YouTube Data API v3を有効化
4. 認証情報からAPIキーを作成
5. `.env`ファイルに設定

## 使用方法

### 開発環境での起動

#### サーバーの起動

```bash
cd server
npm run dev
```

#### クライアントの起動

```bash
cd client
npm run dev
```

### 本番環境での起動

#### クライアントのビルド

```bash
cd client
npm run build
```

#### サーバーの起動

```bash
cd server
npm start
```

Webブラウザで `http://localhost:3000` にアクセスしてダッシュボードを開きます。

## 機能説明

### 1. ダッシュボード

- 現在の配信状況とキャスト状態を表示
- 次回配信予定の確認
- 手動キャスト停止
- システム状態の監視

### 2. スケジュール管理

- YouTubeチャンネルの検索と選択
- 曜日・時刻の設定
- 配信時間の設定
- スケジュールの有効/無効切り替え

### 3. デバイス管理

- ChromeCastデバイスの自動検索
- デバイスの接続テスト
- デフォルトデバイスの設定

### 4. ログ表示

- キャスト履歴の確認
- エラーログの監視
- 統計情報の表示

## API仕様

### REST API

```
GET    /api/schedules              # スケジュール一覧
POST   /api/schedules              # スケジュール作成
PUT    /api/schedules/:id          # スケジュール更新
DELETE /api/schedules/:id          # スケジュール削除

GET    /api/devices                # デバイス一覧
POST   /api/devices/scan           # デバイス検索
PUT    /api/devices/:id            # デバイス設定更新

POST   /api/cast/start             # 手動キャスト開始
POST   /api/cast/stop              # キャスト停止
GET    /api/cast/status            # キャスト状態取得

GET    /api/youtube/search         # チャンネル検索
GET    /api/youtube/channel/:id    # チャンネル情報取得

GET    /api/logs                   # ログ一覧
GET    /api/status                 # システム状態
```

### WebSocket イベント

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

// クライアント → サーバー
{
  type: 'manual_cast',
  data: { video_id, device_id }
}

{
  type: 'stop_cast'
}
```

## 設定ファイル

### スケジュール設定例

```javascript
{
  "channel_id": "UCxxxxxxxxxxxxxxxxxxxxx",
  "channel_name": "サンプルチャンネル",
  "day_of_week": 1,           // 0:日曜 〜 6:土曜
  "start_time": "09:00",      // HH:MM形式
  "duration_minutes": 120,    // 配信時間（分）
  "device_id": 1,             // ChromeCastデバイスID
  "is_active": true           // 有効/無効
}
```

## トラブルシューティング

### よくある問題

#### ChromeCastデバイスが見つからない

1. デバイスとサーバーが同一ネットワークにあることを確認
2. ChromeCastデバイスの電源を確認
3. ファイアウォール設定を確認
4. 「デバイススキャン」を再実行

#### YouTube API エラー

1. APIキーが正しく設定されているか確認
2. YouTube Data API v3が有効化されているか確認
3. API使用量制限に達していないか確認

#### スケジュールが実行されない

1. スケジュールが有効になっているか確認
2. 時刻設定が正しいか確認
3. 対象チャンネルでライブ配信が行われているか確認

### ログファイル

ログファイルは `server/logs/` ディレクトリに日付別で保存されます：

```
server/logs/autocast-2025-06-09.log
```

### システム状態の確認

```bash
# ヘルスチェック
curl http://localhost:3000/health

# システム状態
curl http://localhost:3000/api/status
```

## ライセンス

ISC

## 開発者向け情報

### プロジェクト構造

```
youtube-autocast/
├── server/
│   ├── src/
│   │   ├── controllers/    # API コントローラー
│   │   ├── models/         # データベースモデル
│   │   ├── services/       # ビジネスロジック
│   │   ├── utils/          # ユーティリティ
│   │   └── app.js          # メインアプリケーション
│   ├── database/           # SQLite スキーマ
│   └── logs/               # ログファイル
├── client/
│   ├── src/
│   │   ├── components/     # Svelte コンポーネント
│   │   ├── routes/         # ページコンポーネント
│   │   ├── stores/         # 状態管理
│   │   └── utils/          # ユーティリティ
│   └── dist/               # ビルド成果物
└── README.md
```

### テクノロジースタック

**Backend:**
- Node.js + Express.js
- SQLite3
- WebSocket (ws)
- node-cron (スケジューリング)
- castv2-client (ChromeCast制御)
- googleapis (YouTube API)

**Frontend:**
- Svelte
- Tailwind CSS
- Vite (ビルドツール)

### 貢献方法

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## サポート

問題や質問がある場合は、GitHubのIssuesページでお気軽にお尋ねください。