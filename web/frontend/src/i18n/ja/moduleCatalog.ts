const moduleCatalog = {
  "users": {
    "name": "ユーザー",
    "description": "パネルのユーザー、ロール、権限の管理。"
  },
  "mail": {
    "name": "メール",
    "description": "SMTP / IMAP、ドメイン、ユーザーのメールボックス。"
  },
  "monitor": {
    "name": "モニター",
    "description": "CPU、RAM、ディスク、プロセスのリアルタイムメトリクス。"
  },
  "files": {
    "name": "ファイル",
    "description": "エディタを内蔵したリモートファイルエクスプローラー。"
  },
  "firewall": {
    "name": "ファイアウォール",
    "description": "UFW ルールの管理と IP のブロック。"
  },
  "bitninja": {
    "name": "BitNinja",
    "description": "総合セキュリティエージェント：WAF、anti-DoS、マルウェア検出、IP レピュテーション。"
  },
  "assistant": {
    "name": "AIエージェント",
    "description": "診断と自動化のための AI アシスタント。"
  },
  "repository-store": {
    "name": "GitHub",
    "description": "リポジトリのカタログとガイド付きインストール。"
  },
  "dns": {
    "name": "Nginx",
    "description": "Nginx の管理：サイト、リバースプロキシ、SSL、ログ、ステータス。"
  },
  "backups": {
    "name": "バックアップ",
    "description": "暗号化と複数の保存先に対応したスケジュールバックアップ。"
  },
  "cron": {
    "name": "Cron",
    "description": "ビジュアルエディタで管理するスケジュールタスク。"
  },
  "databases": {
    "name": "データベース",
    "description": "データベース管理ツール（MySQL/MariaDB および PostgreSQL）：スキーマの閲覧と SQL コンソール。"
  },
  "obsidian": {
    "name": "Obsidian",
    "description": "サーバー上の Obsidian ノート Vault：markdown エディタ、wikilink、アシスタントの AI エージェントが操作するノート。"
  },
  "cloudflare": {
    "name": "Cloudflare",
    "description": "サーバー向け Cloudflare の管理：DNS、キャッシュ、SSL/TLS、開発モード、IP アクセスルール。"
  },
  "server-alerts": {
    "name": "通知",
    "description": "パネル所有者向けのサーバー通知：アラート設定、即時通知、スケジュール／定期通知、メトリクス（CPU/RAM/ディスク/負荷/サービス停止）に基づくルールを、LP 経由でデバイスに配信。"
  },
  "expo": {
    "name": "Expo",
    "description": "Expo/React Native アプリを管理：EAS ビルド、ストアへの提出、OTA アップデート、dev-client の QR、クォータを、クライアントのアクセストークンで操作。"
  },
  "webhooks": {
    "name": "Webhook",
    "description": "パネルのイベントを HTTP で通知。"
  },
  "openclaw": {
    "name": "OpenClaw",
    "description": "モデルセレクタ付きの OpenClaw AI への接続。"
  },
  "hosting": {
    "name": "ホスティング",
    "description": "サイト、vhost、アシスト付きデプロイ。"
  },
  "terminal": {
    "name": "ターミナル",
    "description": "パネルのどの画面からもアクセスできるフローティングターミナル。フローティングボタンの有効／無効を切り替えます。"
  },
  "module-dev": {
    "name": "マイモジュール",
    "description": "マーケットプレイス向けモジュールのライフサイクル：レビュー状況、提出、テスト、プライベートプレビュー。"
  },
  "filesystem-mcp": {
    "name": "Filesystem MCP",
    "description": "ファイルシステム操作のための MCP。"
  },
  "github-mcp": {
    "name": "GitHub MCP",
    "description": "GitHub API に対する操作のための MCP。"
  },
  "google-drive": {
    "name": "Google Drive",
    "description": "アシスタントのチャットから Google Drive のドキュメントを検索して添付。"
  },
  "onedrive": {
    "name": "OneDrive",
    "description": "チャットから Microsoft OneDrive / SharePoint のファイルにアクセス。"
  },
  "dropbox": {
    "name": "Dropbox",
    "description": "チャットから Dropbox のファイルを検索して添付。"
  },
  "notion": {
    "name": "Notion",
    "description": "チャットから Notion のページやデータベースを参照。"
  }
} as const;

export default moduleCatalog;
