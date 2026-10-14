const cloudflare = {
  "options": {
    "essentiallyOff": "実質的にオフ",
    "low": "低",
    "medium": "中",
    "high": "高"
  },
  "pageTitle": "Cloudflare",
  "header": {
    "heading": "Cloudflare",
    "subheading": "このサーバーの Cloudflare ゾーンの DNS、キャッシュ、SSL/TLS、セキュリティを管理します。"
  },
  "config": {
    "title": "Cloudflare 接続",
    "tokenLabel": "API トークン",
    "tokenPlaceholder": "Cloudflare API Token",
    "tokenHint": "dash.cloudflare.com → My Profile → API Tokens で、ゾーン権限（DNS、Cache Purge、Zone Settings、Firewall Services）を持つトークンを作成してください。",
    "save": "保存",
    "test": "接続をテスト",
    "clear": "トークンを削除",
    "tokenSet": "トークン設定済み",
    "tokenMissing": "開始するには API Token を設定してください",
    "saved": "トークンを保存しました",
    "cleared": "トークンを削除しました",
    "confirmClear": "Cloudflareトークンを削除しますか？",
    "confirmClearBtn": "削除"
  },
  "zones": {
    "title": "ゾーン",
    "select": "ゾーンを選択",
    "empty": "このトークンで表示できるゾーンがありません。",
    "status": "ステータス",
    "plan": "プラン",
    "nameServers": "ネームサーバー",
    "domainNotFound": "ドメイン {domain} はこのトークンのどのゾーンにも属していません"
  },
  "runtime": {
    "active": "有効",
    "pending": "保留中",
    "initializing": "初期化中",
    "moved": "移動済み",
    "paused": "一時停止中",
    "pausedHint": "ゾーンが一時停止中です。DNS を変更する前に設定を確認してください。",
    "inactiveHint": "ゾーン {status}: レジストラのネームサーバーを確認してください。",
    "activeHint": "有効なゾーン · ネームサーバー {count} 件を設定済み。"
  },
  "tabs": {
    "dns": "DNS",
    "cache": "キャッシュ",
    "security": "SSL / セキュリティ",
    "access": "アクセスルール",
    "config": "設定"
  },
  "dns": {
    "title": "DNS レコード",
    "add": "レコードを追加",
    "type": "タイプ",
    "name": "名前",
    "content": "コンテンツ",
    "ttl": "TTL",
    "proxied": "プロキシ",
    "pointsToServer": "このサーバーを指しています",
    "edit": "編集",
    "delete": "削除",
    "confirmDelete": "レコード {name} を削除しますか？",
    "saved": "レコードを保存しました",
    "deleted": "レコードを削除しました",
    "useServerIp": "サーバーの IP を使用",
    "priority": "優先度",
    "confirmDeleteTitle": "レコードを削除",
    "typeA": "A",
    "typeAAAA": "AAAA",
    "typeCNAME": "CNAME",
    "typeTXT": "TXT",
    "typeMX": "MX",
    "typeNS": "NS",
    "ttlAuto": "自動",
    "ttl60": "60",
    "ttl300": "300",
    "ttl1800": "1800",
    "ttl3600": "3600",
    "ttl86400": "86400"
  },
  "cache": {
    "title": "キャッシュ",
    "purgeAll": "すべてパージ",
    "purgeAllHint": "Cloudflare 上のこのゾーンのキャッシュ済みコンテンツをすべて削除します。",
    "confirmPurgeAll": "このゾーンのキャッシュをすべてパージしますか？",
    "purgeUrls": "URL をパージ",
    "purgeUrlsPlaceholder": "https://example.com/styles.css（1 行に 1 つの URL）",
    "purged": "キャッシュをパージしました",
    "devMode": "開発モード",
    "devModeHint": "Cloudflare のキャッシュを一時的にバイパスします（3 時間後に自動的に無効になります）。",
    "confirmPurgeTitle": "キャッシュをパージ",
    "confirmPurgeBtn": "パージ"
  },
  "security": {
    "title": "SSL / セキュリティ",
    "sslMode": "SSL/TLS モード",
    "alwaysHttps": "常に HTTPS を使用",
    "securityLevel": "セキュリティレベル",
    "underAttack": "Under Attack モード",
    "updated": "設定を更新しました",
    "sslOff": "オフ",
    "sslFlexible": "フレキシブル",
    "sslFull": "フル",
    "sslFullStrict": "フル（厳格）"
  },
  "access": {
    "title": "IP アクセスルール",
    "add": "ルールを追加",
    "mode": "アクション",
    "block": "ブロック",
    "allow": "許可",
    "challenge": "チャレンジ",
    "ip": "IP / 範囲",
    "notes": "メモ",
    "empty": "このゾーンにはアクセスルールがありません。",
    "confirmDelete": "{ip} のルールを削除しますか？",
    "created": "ルールを作成しました",
    "deleted": "ルールを削除しました",
    "ipHeader": "IP",
    "confirmDeleteTitle": "ルールを削除"
  },
  "common": {
    "loading": "読み込み中...",
    "error": "エラー",
    "save": "保存",
    "cancel": "キャンセル",
    "delete": "削除",
    "refresh": "更新",
    "serverIp": "サーバーの IP",
    "noToken": "設定タブで Cloudflare の API Token を設定してください。"
  },
  "settingsUi": {
    "title": "Cloudflareの設定",
    "description": "Cloudflareモジュールのテーブル設定。",
    "access": "アクセス",
    "credentialsConnections": "認証情報と接続",
    "cloudflareToken": "Cloudflareトークン",
    "serverFirewall": "サーバーファイアウォール",
    "dnsWebhooks": "WebhooksのDNSイベント"
  }
} as const;

export default cloudflare;
