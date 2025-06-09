# YouTube自動Cast配信システム 開発ログ

## プロジェクト概要

YouTube自動Cast配信システムは、スケジュールに基づいてYouTube Live配信を自動的に検出し、ChromeCastデバイスにキャストするシステムです。

## システム構成

### バックエンド

- **Node.js + Express.js**: RESTful API サーバー
- **SQLite**: データベース（スケジュール、デバイス、ログ管理）
- **WebSocket**: リアルタイム通信
- **YouTube Data API v3**: YouTube配信検出
- **ChromeCast制御**: castv2-client + bonjour (mDNS代替)
- **Cron**: スケジュール実行管理

### フロントエンド

- **Svelte + Vite**: SPA フレームワーク
- **Tailwind CSS**: スタイリング
- **Material Design**: UI デザインシステム
- **Material Icons**: アイコンセット
- **Roboto Font**: タイポグラフィ

## 開発履歴

### 1. プロジェクト基盤構築 ✅

- プロジェクト構造の作成
- package.json設定（サーバー・クライアント）
- 環境設定ファイル (.env) の準備

### 2. データベース設計・実装 ✅

- SQLiteスキーマ設計
- テーブル作成:
  - `schedules`: 配信スケジュール
  - `chromecast_devices`: ChromeCastデバイス情報
  - `cast_logs`: キャスト実行ログ
  - `favorite_channels`: お気に入りチャンネル
- インデックス最適化

### 3. YouTube API連携 ✅

- YouTube Data API v3 統合
- チャンネル検索機能
- ライブ配信検出機能
- API認証・エラーハンドリング

### 4. ChromeCast制御サービス ✅

- ~~mdns~~ → **bonjour** への変更（依存関係問題解決）
- デバイス自動検出機能
- ネットワークスキャンフォールバック機能
- キャスト開始・停止制御

### 5. スケジューラー実装 ✅

- node-cron による自動実行
- 曜日・時刻指定スケジューリング
- 動的スケジュール更新機能

### 6. REST API・WebSocket実装 ✅

- Express.js RESTful API
- WebSocketリアルタイム通信
- クライアント状態管理

### 7. Svelteフロントエンド実装 ✅

- ~~SvelteKit~~ → **Svelte + Vite** への変更（ルーティング問題解決）
- SPA カスタムルーティング
- コンポーネント化されたUI

### 8. WebSocketリアルタイム通信 ✅

- サーバー-クライアント双方向通信
- キャスト状態リアルタイム更新
- デバイススキャン結果即座反映

### 9. エラーハンドリング・ログ機能 ✅

- 包括的エラーハンドリング
- キャスト実行履歴記録
- システム状態監視

### 10. 環境設定・README作成 ✅

- 環境変数設定
- 起動スクリプト
- 開発・本番環境対応

### 11. SQLite初期化エラー修正 ✅

- データベース再起動時のテーブル重複エラー解決
- `IF NOT EXISTS`句追加で安全な初期化実現

### 12. Material Design UI実装 ✅

- Google Material Iconsの導入
- Robotoフォント適用
- Material Design準拠のコンポーネント設計
- カード、シャドウ、配色の統一

### 13. ブラウザ互換性改善 ✅

- Chrome/Firefox間のレイアウト一貫性確保
- Flexboxレイアウト最適化
- グローバルCSS統一
- レスポンシブ対応強化

### 14. ダークモード対応実装 ✅

- テーマストア作成とローカルストレージ永続化
- Tailwind CSS ダークモード設定
- 全コンポーネントのダークモード対応
- ヘッダーにテーマ切り替えボタン追加
- スムーズなカラートランジション実装

## 問題解決履歴

### 問題1: mdns依存関係エラー

**問題**: mdnsライブラリのコンパイルエラー
**解決**: bonjournライブラリに変更 + ネットワークスキャンフォールバック実装

### 問題2: SvelteKitナビゲーション404エラー

**問題**: サイドメニューナビゲーションが機能しない
**解決**: SvelteKitからSvelte + Viteに変更、カスタムルーター実装

### 問題3: npm install依存関係競合

**問題**: SvelteとViteのバージョン互換性問題
**解決**: package.jsonのバージョン調整

### 問題4: YouTube API キー検出エラー

**問題**: .envファイルのパス解決問題
**解決**: 複数パスからの.env読み込み実装

### 問題5: ユーザビリティ - 繰り返しチャンネル検索

**問題**: "毎回、配信者を検索するのが、手間だよ。"
**解決**: お気に入りチャンネル機能実装（タブ式UI、最近使用履歴）

### 問題6: SQLite再起動エラー ✅

**問題**: "Failed to start server: Error: SQLITE_ERROR: table schedules already exists"
**解決**: schema.sqlに`IF NOT EXISTS`句追加

### 問題7: ブラウザ間ヘッダー幅不一致 ✅

**問題**: ChromeとFirefoxでヘッダーの幅が異なって表示される
**解決**: Flexboxレイアウト改善、グローバルCSS追加でブラウザ間一貫性確保

## 最新機能追加

### お気に入りチャンネル機能 ✅

- **favorite_channels テーブル追加**
- **タブ式UI**: お気に入り・最近使用・検索
- **チャンネル管理**: 追加・削除・最終使用時刻更新
- **API エンドポイント**: `/api/favorites`, `/api/recent-channels`

### Material Design UI改善 ✅

- **Material Icons** 導入
- **Roboto Font** 適用
- **Material Design風** カード・シャドウ・配色
- **App Bar** + **Navigation Drawer** スタイル
- **改善されたボタン・フォーム** デザイン

### ブラウザ互換性改善 ✅

- **Chrome/Firefox間の一貫性確保**
- **Flexboxレイアウト最適化**
- **グローバルCSS統一**
- **レスポンシブ対応強化**

### ダークモード対応 ✅

- **テーマストア実装** - ローカルストレージでの永続化
- **Tailwind CSS設定** - クラスベースダークモード
- **全画面対応** - Layout, Dashboard, Schedules, Devices, Logs
- **テーマ切り替えUI** - ヘッダーにトグルボタン
- **スムーズトランジション** - 200ms カラーアニメーション

## ファイル構造

```
/home/deck/AsakoyoTimer/
├── server/
│   ├── src/
│   │   ├── app.js                 # メインアプリケーション
│   │   ├── models/Database.js     # データベース接続・操作
│   │   ├── services/              # ビジネスロジック
│   │   │   ├── YouTubeService.js  # YouTube API連携
│   │   │   ├── ChromeCastService.js # ChromeCast制御
│   │   │   └── ScheduleService.js # スケジュール管理
│   │   ├── controllers/api.js     # REST API ルーター
│   │   └── websocket/WebSocketManager.js # WebSocket管理
│   ├── database/
│   │   └── schema.sql             # データベーススキーマ（IF NOT EXISTS対応）
│   └── package.json
├── client/
│   ├── src/
│   │   ├── App.svelte            # ルートコンポーネント
│   │   ├── components/Layout.svelte # レイアウト（Material Design + ダークモード）
│   │   ├── routes/               # ページコンポーネント
│   │   │   ├── Dashboard.svelte  # ダッシュボード（Material Design + ダークモード）
│   │   │   ├── Schedules.svelte  # スケジュール管理（お気に入り機能 + ダークモード）
│   │   │   ├── Devices.svelte    # デバイス管理（ダークモード対応）
│   │   │   └── Logs.svelte       # ログ表示（ダークモード対応）
│   │   └── stores/              # 状態管理
│   │       ├── api.js           # API通信
│   │       ├── router.js        # カスタムルーター
│   │       ├── websocket.js     # WebSocket状態
│   │       └── theme.js         # テーマ管理（新規追加）
│   ├── tailwind.config.js        # Tailwind設定（ダークモード有効化）
│   └── package.json
├── .env                          # 環境変数（YouTube API キー）
├── youtube_autocast_design.md    # 設計書
└── DEVELOPMENT_LOG.md            # 開発ログ（このファイル）
```

## API エンドポイント

### スケジュール管理

- `GET /api/schedules` - スケジュール一覧取得
- `POST /api/schedules` - スケジュール作成
- `PUT /api/schedules/:id` - スケジュール更新
- `DELETE /api/schedules/:id` - スケジュール削除

### デバイス管理

- `GET /api/devices` - デバイス一覧取得
- `POST /api/devices/scan` - デバイススキャン実行
- `PUT /api/devices/:id` - デバイス設定更新
- `POST /api/devices/:id/test` - デバイス接続テスト

### キャスト制御

- `POST /api/cast/start` - 手動キャスト開始
- `POST /api/cast/stop` - キャスト停止
- `GET /api/cast/status` - キャスト状態取得

### YouTube検索

- `GET /api/youtube/search` - チャンネル検索
- `GET /api/youtube/channel/:id` - チャンネル情報取得
- `GET /api/youtube/channel/:id/live` - ライブ配信確認

### お気に入り管理

- `GET /api/favorites` - お気に入りチャンネル一覧
- `POST /api/favorites` - お気に入り追加
- `DELETE /api/favorites/:channelId` - お気に入り削除
- `GET /api/recent-channels` - 最近使用チャンネル

### システム情報

- `GET /api/status` - システム状態取得
- `GET /api/logs` - ログ取得

## 現在の状態

✅ **完全動作状態**

- サーバーが正常に起動・再起動
- 全機能が実装済み
- Material Design UI完成
- ダークモード完全対応
- ブラウザ間互換性確保
- エラーハンドリング完備

## 今後の拡張可能性

1. **通知機能**: Discord/Slack連携
2. **配信品質設定**: 解像度・ビットレート指定
3. **複数デバイス同時キャスト**
4. **配信開始/終了の自動検出精度向上**
5. **モバイル対応**: レスポンシブデザイン強化
6. **アニメーション強化**: Framer Motion導入
7. **PWA対応**: オフライン機能とプッシュ通知

## 技術的な特徴

- **モジュラー設計**: 各サービスが独立
- **リアルタイム更新**: WebSocketによる即座反映
- **堅牢なエラーハンドリング**: 各層でのエラー処理
- **Material Design準拠**: モダンなUI/UX
- **ダークモード対応**: 完全なテーマ切り替え機能
- **ブラウザ互換性**: Chrome/Firefox間一貫表示
- **レスポンシブ対応**: 様々な画面サイズに対応
- **スケーラブル**: 追加機能の実装が容易

## 最新の技術的改善点

### Layout.svelte の改善

- **ヘッダー一貫性**: `max-w-7xl mx-auto` → `w-full` でブラウザ間統一
- **Flexbox最適化**: `flex-1`、`flex-shrink-0`、`min-w-0` の適切な配置
- **グローバルCSS**: `box-sizing: border-box` 全要素適用
- **レスポンシブ**: `truncate`、`whitespace-nowrap` でテキスト処理改善

### ブラウザ互換性対策

```css
:global(*) {
  box-sizing: border-box;
}

:global(body) {
  margin: 0;
  padding: 0;
  width: 100%;
  overflow-x: hidden;
}

header {
  width: 100% !important;
  box-sizing: border-box;
}
```

## ダークモード実装詳細

### テーマストア (`theme.js`)

```javascript
import { writable } from 'svelte/store';

function createThemeStore() {
  const stored = localStorage.getItem('theme') || 'light';
  const { subscribe, set, update } = writable(stored);

  return {
    subscribe,
    setTheme: (theme) => {
      set(theme);
      localStorage.setItem('theme', theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
    },
    toggleTheme: () => update(current => {
      const newTheme = current === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', newTheme);
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
      return newTheme;
    })
  };
}
```

### Tailwind CSS設定

```javascript
// tailwind.config.js
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class', // クラスベースダークモード
  theme: { extend: {} },
  plugins: []
}
```

### コンポーネント対応パターン

```svelte
<!-- 背景色 -->
<div class="bg-white dark:bg-gray-800 transition-colors duration-200">

<!-- テキスト色 -->
<h1 class="text-gray-900 dark:text-gray-100">

<!-- ボーダー -->
<input class="border-gray-300 dark:border-gray-600">

<!-- ホバー効果 -->
<button class="hover:bg-gray-50 dark:hover:bg-gray-700">

<!-- ステータスバッジ -->
<span class="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
```

### テーマ切り替えボタン

```svelte
<button on:click={theme.toggleTheme} class="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
  <span class="material-icons">
    {$theme === 'dark' ? 'light_mode' : 'dark_mode'}
  </span>
</button>
```

---

**開発完了日**: 2025年1月9日  
**開発者**: Claude (Anthropic)  
**総開発時間**: 継続的セッション複数回  
**最終更新**: ダークモード対応完了
