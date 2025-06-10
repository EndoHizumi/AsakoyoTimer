# YouTube AutoCast Raspberry Pi 運用ガイド

**作成日:** 2025年6月10日  
**対象システム:** YouTube自動Cast配信システム  
**目的:** Raspberry Pi での本番運用環境構築

## 1. 推奨ハードウェア構成

### 基本構成
- **Raspberry Pi 4B (4GB以上推奨)**
  - Node.jsアプリケーションとSQLiteデータベースの同時実行に十分なメモリ
  - ChromeCast検出とWebSocket通信の安定性確保
- **microSDカード 32GB以上 (Class 10推奨)**
  - アプリケーション、ログ、データベース用ストレージ
- **有線LAN接続**
  - ChromeCastデバイス検出の信頼性向上
  - WiFi経由も対応可能だが有線接続を強く推奨

### ネットワーク要件
- ChromeCastデバイスと同一ネットワークセグメント
- インターネット接続（YouTube Data API通信用）
- ポート3000（Webダッシュボード）、3001（WebSocket）の開放

## 2. オペレーティングシステム

### 推奨OS
- **Raspberry Pi OS Lite (64bit)**
  - GUI不要でリソース消費を最小化
  - ARM64対応でNode.js性能向上

### 基本セットアップ
```bash
# システムアップデート
sudo apt update && sudo apt upgrade -y

# 必要パッケージインストール
sudo apt install -y git curl

# Node.js 18+ インストール
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

## 3. アプリケーションデプロイ

### 3.1 アプリケーション配置
```bash
# アプリケーションクローン
cd /home/pi
git clone <repository-url> AsakoyoTimer
cd AsakoyoTimer

# 依存関係インストール
npm run install:all

# 環境変数設定
cp .env.example .env
# .envファイルを編集してYouTube API キーなどを設定
```

### 3.2 クライアントビルド
```bash
# 本番用クライアントビルド（必須）
npm run build
```

**重要:** サーバーは`client/dist`フォルダの静的ファイルを配信するため、事前ビルドが必須です。

### 3.3 動作確認
```bash
# テスト起動
npm start

# ブラウザで http://localhost:3000 にアクセスして動作確認
```

## 4. systemdサービス設定

### 4.1 サービスファイル作成
`/etc/systemd/system/asakoyo-timer.service`を作成：

```ini
[Unit]
Description=AsakoyoTimer Service
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/AsakoyoTimer
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

# ログ設定
StandardOutput=journal
StandardError=journal
SyslogIdentifier=asakoyo-timer

[Install]
WantedBy=multi-user.target
```

### 4.2 設定項目解説

**[Unit]セクション**
- `Description`: サービスの説明文
- `After=network.target`: ネットワーク起動後に開始（ChromeCast検出に必要）

**[Service]セクション**
- `Type=simple`: フォアグラウンド実行プロセス
- `User=pi`: 実行ユーザー
- `WorkingDirectory`: アプリケーションディレクトリ
- `ExecStart`: 起動コマンド
- `Restart=always`: 異常終了時の自動再起動
- `RestartSec=10`: 再起動までの待機時間
- `Environment=NODE_ENV=production`: 本番環境設定

**ログ設定**
- `StandardOutput/StandardError=journal`: journaldログ管理
- `SyslogIdentifier`: ログ識別子

**[Install]セクション**
- `WantedBy=multi-user.target`: システム起動時の自動開始

### 4.3 サービス有効化
```bash
# サービス登録
sudo systemctl daemon-reload

# 自動起動有効化
sudo systemctl enable asakoyo-timer

# サービス開始
sudo systemctl start asakoyo-timer

# 状態確認
sudo systemctl status asakoyo-timer
```

## 5. 運用管理

### 5.1 ログ管理
```bash
# リアルタイムログ監視
sudo journalctl -u asakoyo-timer -f

# 過去ログ確認
sudo journalctl -u asakoyo-timer --since today

# ログ期間指定
sudo journalctl -u asakoyo-timer --since "2025-06-10 09:00:00"
```

### 5.2 サービス操作
```bash
# サービス停止
sudo systemctl stop asakoyo-timer

# サービス再起動
sudo systemctl restart asakoyo-timer

# 設定リロード
sudo systemctl reload asakoyo-timer

# 自動起動無効化
sudo systemctl disable asakoyo-timer
```

### 5.3 アプリケーション更新
```bash
cd /home/pi/AsakoyoTimer

# アプリケーション停止
sudo systemctl stop asakoyo-timer

# コード更新
git pull origin master

# 依存関係更新（必要に応じて）
npm install

# クライアントリビルド
npm run build

# サービス再開
sudo systemctl start asakoyo-timer
```

## 6. アーキテクチャの特徴

### 6.1 Single Server構成
- **Express.jsサーバーが全機能を統合**
  - REST API提供
  - 静的ファイル配信（client/dist）
  - WebSocket通信
  - ChromeCast制御
  - スケジュール管理

### 6.2 ポート構成
- **Port 3000**: HTTP/WebAPI + 静的ファイル配信
- **Port 3001**: WebSocket通信
- nginx/Apacheなどのリバースプロキシは不使用

### 6.3 メリット・デメリット

**メリット**
- シンプルな構成で管理が容易
- 小規模環境に最適
- Raspberry Piのリソースに適している

**デメリット**
- 静的ファイル配信パフォーマンスがnginxより劣る
- SSL終端処理が別途必要
- 単一障害点となる可能性

## 7. セキュリティ考慮事項

### 7.1 ファイアウォール設定
```bash
# UFW有効化
sudo ufw enable

# 必要ポート開放
sudo ufw allow 22    # SSH
sudo ufw allow 3000  # アプリケーション
sudo ufw allow 3001  # WebSocket

# ChromeCast検出用（mDNS）
sudo ufw allow 5353/udp
```

### 7.2 環境変数管理
- `.env`ファイルの権限制限
- YouTube API keyの適切な管理
- 本番環境での機密情報の分離

## 8. トラブルシューティング

### 8.1 よくある問題

**ChromeCastデバイスが検出されない**
- ネットワークセグメントの確認
- mDNS通信の疎通確認
- ファイアウォール設定の見直し

**サービスが起動しない**
- 依存関係（Node.js、npm）の確認
- 作業ディレクトリの権限確認
- ログファイルでエラー詳細確認

**メモリ不足**
- Raspberry Piのメモリ使用量監視
- スワップファイル設定の検討
- ログローテーション設定

### 8.2 監視設定
```bash
# システムリソース監視
htop

# メモリ使用量確認
free -h

# ディスク使用量確認
df -h
```

## 9. 運用推奨事項

### 9.1 定期メンテナンス
- 月1回のシステム更新
- ログファイルのローテーション
- データベースの最適化
- SDカードの健康状態チェック

### 9.2 バックアップ戦略
- 設定ファイル（.env）のバックアップ
- データベース（autocast.db）の定期バックアップ
- システム全体のイメージバックアップ

### 9.3 性能最適化
- Node.jsプロセスのメモリ制限設定
- SQLiteのWALモード有効化
- ChromeCast検出間隔の調整

## 10. まとめ

AsakoyoTimer システムは、Raspberry Pi 4Bでの運用に適した軽量なアーキテクチャを採用しています。systemdサービスとして稼働することで、安定した24時間運用が可能です。

**運用開始前のチェックリスト**
- [ ] ハードウェア構成の確認
- [ ] ネットワーク設定の確認
- [ ] アプリケーションのビルドと動作確認
- [ ] systemdサービスの登録と自動起動設定
- [ ] ログ監視体制の確立
- [ ] バックアップ戦略の実装

本ガイドに従って構築することで、安定したYouTube自動配信システムの運用が可能になります。