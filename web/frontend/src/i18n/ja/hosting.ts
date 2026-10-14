const hosting = {
  "pageTitle": "共有ホスティング",
  "pageSubtitle": "クライアントのホスティングアカウントを管理 · WHMスタイルのマルチテナント",
  "btnNewAccount": "新規アカウント",
  "options": {
    "planBasic": "ベーシック",
    "planPro": "プロ",
    "planBusiness": "ビジネス",
    "planCustom": "カスタム"
  },
  "stats": {
    "total": "アカウント合計",
    "active": "有効",
    "suspended": "停止中",
    "terminated": "終了済み",
    "title": "{username} の使用状況",
    "disk": "ディスク (MB)",
    "domains": "ドメイン",
    "emails": "メールアカウント",
    "databases": "データベース",
    "subusers": "サブユーザー",
    "bandwidth": "帯域 (MB)",
    "percentUsed": "% 使用",
    "method": "測定方法",
    "methodDu": "du 推定（ベストエフォート）",
    "methodQuotaTools": "システムクォータ (quota-tools)"
  },
  "tableTitle": "アカウント",
  "modal": {
    "titleNew": "新規ホスティングアカウント",
    "tabs": {
      "account": "アカウント",
      "resources": "リソース",
      "security": "モジュールとセキュリティ"
    },
    "labelUsername": "ユーザー名 *",
    "labelPassword": "パスワード *",
    "labelName": "名前",
    "labelEmail": "メール",
    "labelPlan": "プラン",
    "resourcesTitle": "リソース制限",
    "labelDisk": "ディスク（MB）",
    "labelBandwidth": "帯域幅（MB）",
    "labelDomains": "ドメイン",
    "labelEmails": "メールアカウント",
    "labelNotes": "内部メモ",
    "btnCancel": "キャンセル",
    "btnCreate": "アカウントを作成",
    "hintUsername": "小文字、数字、-、_のみ使用可",
    "phUsername": "exampleclient",
    "phPassword": "最低8文字",
    "phName": "企業名 株式会社",
    "phEmail": "admin@example.com",
    "phNotes": "任意のコメント…",
    "labelStatus": "ステータス",
    "labelTenantGroup": "テナントグループ",
    "labelHomeRoot": "ルートフォルダ (home)",
    "hintTenantGroup": "アカウント専用の Linux グループ（読み取り専用）。",
    "hintHomeRoot": "VPS 上のテナントのルート（読み取り専用）。",
    "labelDiskQuotaMb": "ディスククォータ (MB)",
    "labelBandwidthQuotaMb": "帯域クォータ (MB)",
    "labelMaxDomains": "最大ドメイン数",
    "labelMaxEmailAccounts": "最大メールアカウント数",
    "labelMaxDatabases": "最大データベース数",
    "labelMaxSubUsers": "最大サブユーザー数",
    "labelAllowedModules": "許可モジュール",
    "labelJailEnabled": "シェルを隔離 (chroot)",
    "hintJailEnabled": "このアカウントのターミナル/SSH を自分のフォルダに制限します（chroot ジェイル）。",
    "modulesLoading": "モジュールを読み込み中…",
    "labelExpiresAt": "有効期限",
    "hintExpiresAt": "無期限の場合は空欄のままにしてください",
    "labelModules": "許可するモジュール",
    "hintModules": "このクライアントがアクセスできるパネルモジュールを定義します。",
    "labelDatabases": "データベース",
    "labelSubUsers": "サブユーザー",
    "labelJail": "シェルの隔離（chroot）",
    "hintJail": "このアカウントのターミナル/SSH をホームフォルダ（chroot ジェイル）に制限します。",
    "titleEdit": "編集：{username}"
  },
  "pwdModal": {
    "title": "パスワードを変更",
    "labelNew": "新しいパスワード",
    "phPassword": "最低8文字",
    "btnCancel": "キャンセル",
    "btnChange": "変更"
  },
  "apiPageTitle": "ホスティングAPIドキュメント",
  "apiSubtitle": "共有ホスティングアカウントの自動管理",
  "apiIntro": "Reseller APIを使用すると、外部システム（独自の課金プラットフォーム、WHMCS、Bashスクリプト、Zapier連携など）からホスティングアカウントの作成・更新・停止・削除を自動化できます。HTTPリクエストが可能な任意の言語やツールと互換性があります。",
  "toc": {
    "label": "目次",
    "items": [
      "1. 認証",
      "2. 隔離とセキュリティ",
      "3. 利用可能なエンドポイント",
      "4. アカウント作成",
      "5. アカウント一覧",
      "6. アカウント取得",
      "7. アカウント更新",
      "8. 停止 / 再有効化",
      "9. パスワード変更",
      "10. アカウント統計",
      "11. アカウント削除",
      "12. ホスティングアカウントのログイン",
      "13. エラーコード",
      "14. 完全な例"
    ]
  },
  "auth": {
    "title": "認証",
    "intro": "Reseller APIのすべてのエンドポイントは2つの認証方法を受け入れます：",
    "apiKeyTitle": "API Key（自動化に推奨）",
    "apiKeyDesc": "パネル → Webhooks → API Keysからパネル → Webhooks → API Keysを生成します。AuthorizationヘッダーとともにAPIキーを送信します：",
    "sessionTitle": "管理セッション（パネルから）",
    "sessionDesc": "LUXIPANELパネル自体からリクエストを行う場合（例：ブラウザのJavaScriptから）、管理者セッションのCookieが自動的に受け入れられます。",
    "warningTitle": "重要：",
    "warningText": "クライアント側のコード（ブラウザのJavaScript、モバイルアプリなど）にAPI keyを公開しないでください。サーバーまたはプライベートな環境からのみ使用してください。"
  },
  "isolation": {
    "title": "分離とセキュリティ",
    "intro": "各ホスティングアカウントは完全に隔離された環境です。これにより、どのクライアントも、Webパネル、API、SSH コンソール、その他のベクターを通じて試みた場合でも、他のクライアントのリソースを見たり変更したりすることができないことが保証されます。",
    "features": [
      {
        "title": "分離されたデータ",
        "desc": "メールボックス、ドメイン、DNS、SSL、バックアップは各アカウントの tenant_id に紐付けられます。SQL クエリがテナントをまたぐことはありません。"
      },
      {
        "title": "ファイルシステム",
        "desc": "各アカウントは専用のホームディレクトリ (/home/username) を持ちます。ファイルエクスプローラーとコンソールはそのディレクトリに制限されます。"
      },
      {
        "title": "独立したセッション",
        "desc": "ホスティングアカウントの JWT にはその tenantId が含まれます。バックエンドは、そのスコープ外のリソースにアクセスしようとするリクエストをすべて拒否します。"
      }
    ]
  },
  "endpoints": {
    "title": "利用可能なエンドポイント",
    "colMethod": "メソッド",
    "colPath": "パス",
    "colDesc": "説明",
    "colAuth": "認証",
    "rows": [
      [
        "POST",
        "/api/hosting/accounts",
        "ホスティングアカウントを作成",
        "管理者 / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts",
        "アカウント一覧（ページネーション）",
        "管理者 / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts/:id",
        "単一アカウントを取得",
        "管理者 / API Key"
      ],
      [
        "PUT",
        "/api/hosting/accounts/:id",
        "アカウントを更新",
        "管理者 / API Key"
      ],
      [
        "DELETE",
        "/api/hosting/accounts/:id",
        "アカウントとすべてのデータを削除",
        "管理者 / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/suspend",
        "アカウントを一時停止",
        "管理者 / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/unsuspend",
        "一時停止中のアカウントを再有効化",
        "管理者 / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/change-password",
        "パスワードを変更",
        "管理者 / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts/:id/stats",
        "使用状況の統計",
        "管理者 / API Key"
      ],
      [
        "POST",
        "/api/hosting/auth/login",
        "ホスティングアカウントのログイン",
        "公開"
      ],
      [
        "POST",
        "/api/hosting/auth/logout",
        "ホスティングのログアウト",
        "ホスティングセッション"
      ]
    ]
  },
  "create": {
    "title": "アカウントを作成",
    "labelBody": "ボディ（JSON）",
    "labelResp": "レスポンス 201"
  },
  "list": {
    "title": "アカウントを一覧表示",
    "labelParams": "クエリパラメータ",
    "colParam": "パラメータ",
    "colType": "タイプ",
    "colDefault": "デフォルト",
    "colDesc": "説明",
    "labelResp": "レスポンス 200",
    "params": [
      [
        "page",
        "integer",
        "1",
        "現在のページ"
      ],
      [
        "limit",
        "integer",
        "20",
        "1ページあたりの結果数（最大100）"
      ],
      [
        "search",
        "string",
        "—",
        "username、displayName、email を検索"
      ],
      [
        "status",
        "string",
        "—",
        "active | suspended | terminated"
      ]
    ]
  },
  "compactEndpoints": [
    {
      "id": "get",
      "num": "6",
      "title": "アカウントを取得",
      "method": "GET",
      "path": "/api/hosting/accounts/:id",
      "note": "passwordHash フィールドを除いたアカウントオブジェクトを返します。"
    },
    {
      "id": "update",
      "num": "7",
      "title": "アカウントを更新",
      "method": "PUT",
      "path": "/api/hosting/accounts/:id",
      "note": "作成時と同じフィールドを受け付けます（username と password を除く）。送信されたフィールドのみが更新されます。"
    },
    {
      "id": "suspend",
      "num": "8",
      "title": "一時停止 / 再有効化",
      "method": "POST",
      "path": "/api/hosting/accounts/:id/suspend  |  /unsuspend",
      "note": "一時停止するとクライアントのアクセスが即座にブロックされます。再有効化はステータスを 'active' に戻します。ボディは不要です。"
    },
    {
      "id": "password",
      "num": "9",
      "title": "パスワードを変更",
      "method": "POST",
      "path": "/api/hosting/accounts/:id/change-password",
      "note": "Body: {\"password\": \"NewPass123!\"} — 最低8文字。"
    },
    {
      "id": "stats",
      "num": "10",
      "title": "使用状況の統計",
      "method": "GET",
      "path": "/api/hosting/accounts/:id/stats",
      "note": "設定されたクォータと、ディスク、帯域幅、アクティブなドメイン、メールアカウントの現在の使用状況を返します。"
    },
    {
      "id": "delete",
      "num": "11",
      "title": "アカウントを削除",
      "method": "DELETE",
      "path": "/api/hosting/accounts/:id",
      "note": "⚠️ 取り消せません。アカウントと、ON DELETE CASCADE を通じてそのすべてのリソース（メールボックス、ドメイン、DNS、SSL、バックアップ）を削除します。"
    }
  ],
  "login": {
    "title": "ホスティングアカウントのログイン",
    "badgePublic": "· 公開",
    "desc": "クライアントはログインパネルで認証情報を入力します。有効な場合、kind: \"hosting\"タイプのセッションが作成され、アクセスをそのアカウントのリソースのみに制限します。",
    "labelBody": "ボディ",
    "labelResp": "200 レスポンス"
  },
  "errors": {
    "title": "エラーコード",
    "intro": "すべてのエラーは同じエンベロープに従います：",
    "colHttp": "HTTP",
    "colCode": "コード",
    "colDesc": "説明",
    "rows": [
      [
        "400",
        "VALIDATION_ERROR",
        "無効または不足しているフィールド"
      ],
      [
        "401",
        "AUTH_ERROR",
        "無効、期限切れ、または不足している API key"
      ],
      [
        "403",
        "FORBIDDEN",
        "この操作の権限がありません"
      ],
      [
        "404",
        "NOT_FOUND",
        "要求されたアカウントは存在しません"
      ],
      [
        "409",
        "CONFLICT",
        "そのユーザー名は既に使用されています"
      ],
      [
        "429",
        "RATE_LIMIT",
        "リクエストが多すぎます — 再試行する前にお待ちください"
      ],
      [
        "500",
        "INTERNAL_ERROR",
        "内部サーバーエラー"
      ]
    ],
    "generic": "エラー",
    "unknown": "不明なエラー"
  },
  "examples": {
    "title": "完全な例",
    "labelCurl": "アカウント作成",
    "labelSuspend": "アカウント停止",
    "labelList": "フィルター付き一覧",
    "labelNodeClient": "再利用可能なクライアント",
    "labelPhpHelper": "PHP ヘルパークラス"
  },
  "table": {
    "columnStatus": "ステータス",
    "columnPlan": "プラン",
    "columnModules": "モジュール",
    "columnCreated": "作成日",
    "columnUpdated": "更新日",
    "columnTenantGroup": "グループ",
    "columnHomeRoot": "ホーム",
    "modulesCount": "{count} モジュール"
  },
  "audit": {
    "title": "{username} の監査",
    "eventType": "イベント",
    "actor": "アクター",
    "date": "日付",
    "empty": "記録されたイベントはありません。"
  },
  "actions": {
    "editModules": "モジュールを編集",
    "viewStats": "使用状況を表示",
    "viewAudit": "監査を表示",
    "enableJail": "ジェイルを有効化",
    "disableJail": "ジェイルを無効化",
    "save": "保存",
    "saveChanges": "変更を保存",
    "saving": "保存中…"
  },
  "confirm": {
    "enableJailBody": "このアカウントの chroot ジェイルを有効にしますか？ ターミナル/SSH が自分のフォルダに制限されます。",
    "disableJailBody": "chroot ジェイルを無効にしますか？ アカウントは通常のシェル (/bin/bash) に戻ります。",
    "suspendBody": "このアカウントを停止しますか？クライアントはアクセスを失います。",
    "suspendTitle": "アカウントを停止",
    "suspendOk": "はい、停止する",
    "deleteBody": "アカウント「{username}」とすべてのデータ（メール、ドメイン、ファイル）を削除しますか？この操作は元に戻せません。",
    "deleteTitle": "アカウントを削除"
  },
  "jail": {
    "degraded": "サーバーに jailkit がインストールされていません。ジェイルは有効化されませんでした。jailkit をインストールして再試行してください。",
    "degradedTitle": "ジェイル未適用",
    "enabledOk": "ジェイルを有効化しました。"
  },
  "toasts": {
    "jailAlready": "ジェイルは既に有効です",
    "jailNotActive": "ジェイルは有効ではありません",
    "notActive": "アカウントはアクティブではありません",
    "notSuspended": "アカウントは停止されていません"
  },
  "labels": {
    "statusActive": "アクティブ",
    "statusSuspended": "停止中",
    "statusTerminated": "終了済み"
  },
  "dataTable": {
    "columns": {
      "username": "ユーザー",
      "plan": "プラン",
      "estado": "状態",
      "modulos": "モジュール",
      "tenantGroup": "グループ",
      "homeRoot": "ホーム",
      "creado": "作成日",
      "actualizado": "更新日"
    },
    "filters": {
      "searchUser": "ユーザーで検索…",
      "estado": "状態",
      "plan": "プラン",
      "statusActive": "有効",
      "statusSuspended": "停止中",
      "statusTerminated": "終了"
    },
    "rowActions": {
      "edit": "編集",
      "viewStats": "使用状況を表示",
      "viewAudit": "監査を表示",
      "password": "パスワードを変更",
      "suspend": "一時停止",
      "unsuspend": "再公開",
      "enableJail": "ジェイルを有効化",
      "disableJail": "ジェイルを無効化",
      "delete": "削除"
    }
  },
  "runtime": {
    "defaultsLoadError": "既定値を読み込めませんでした。",
    "defaultsSaveError": "値を保存できませんでした。",
    "defaultsSaved": "値を稼働中のサーバーに保存しました。"
  },
  "settingsUi": {
    "title": "ホスティング設定",
    "description": "ホスティングアカウント表の設定",
    "table": "テーブル",
    "apiProviders": "APIプロバイダー",
    "rowsPerPage": "アカウント表の1ページあたりの行数。",
    "newAccountDefaults": "新規アカウントの既定値",
    "defaultsHint": "アクティブなサーバーに保存されます。既存のアカウントは変更されません。",
    "emailAccounts": "メール",
    "subusers": "サブユーザー",
    "defaultJail": "既定で隔離を有効にする",
    "defaultModules": "既定のモジュール（カンマ区切りのID）",
    "saveDefaults": "既定値を保存",
    "relatedModules": "関連モジュール",
    "users": "ユーザー",
    "domainsSsl": "ドメインとSSL",
    "showAll": "すべて表示",
    "hideAll": "すべて非表示",
    "providerConnections": "ホスティング管理者の接続",
    "providerConnectionsHint": "LUXIPANELがAPIを提供します。各管理者にはキーと、1台のサーバー、モジュール、操作に限定された権限が付与されます。",
    "newProvider": "新しいプロバイダー",
    "managedServer": "管理対象サーバー",
    "localServer": "ローカルサーバー",
    "panelHttpsOrigin": "LUXIPANELのHTTPSオリジン",
    "siteEngine": "サーバー上のサイトエンジン",
    "accountModules": "アカウントのモジュール",
    "modulesHint": "カンマ区切りのID。HOSTINGが一覧を検証します。",
    "apiOperations": "API操作",
    "readAccounts": "アカウントを読み取る",
    "createAccounts": "アカウントを作成",
    "accountStatus": "アカウントの状態と詳細",
    "viewUsage": "使用量を表示",
    "linkSites": "サイトを関連付ける",
    "panelAccess": "パネルへのアクセス",
    "deleteAccounts": "アカウントを削除",
    "createProviderKey": "プロバイダーとキーを作成",
    "copyKeyNow": "キーを今すぐコピーしてください。表示されるのは一度だけです。",
    "groupPolicy": {
      "editProvider": "プロバイダーを編集",
      "saveProvider": "プロバイダーを保存",
      "templateTitle": "初期グループの権限",
      "templateHint": "新しいアカウントには専用グループでこれらの権限が付与されます。既存のグループはユーザー画面で編集してください。",
      "permissions": "詳細な権限",
      "sidebar": "メニュー",
      "views": "画面",
      "actions": "操作",
      "filesScope": "ファイルアクセス",
      "relativeHint": "アカウントのフォルダーからの相対パスを1行に1つ指定します。. はフォルダー全体を表します。",
      "allowPaths": "許可するフォルダー",
      "denyPaths": "ブロックするフォルダー",
      "readOnlyPaths": "読み取り専用フォルダー",
      "defaultPath": "開始フォルダー",
      "commands": "ターミナルコマンド",
      "allowAllCommands": "ユーザーのすべてのコマンドを許可",
      "commandGroups": "コマンドグループ",
      "allowedCommands": "許可するコマンド（1行に1つ）",
      "deniedCommands": "ブロックするコマンド（1行に1つ）",
      "saving": "保存中…",
      "saved": "プロバイダーを保存しました。新しいアカウントに適用されます。",
      "created": "プロバイダーを作成しました。",
      "loading": "プロバイダーと権限を読み込み中…",
      "loadError": "設定を読み込めませんでした。",
      "active": "有効",
      "revoked": "失効",
      "rotateKey": "キーを更新",
      "rotateSuccess": "キーを更新しました。新しいキーをコピーしてください。",
      "revoke": "アクセスを失効",
      "reactivate": "再有効化",
      "accessUpdated": "アクセスを更新しました。",
      "emptyProviders": "プロバイダーはまだ設定されていません。"
},
    "apiGuide": "APIガイド",
    "retry": "再試行"
  },
  "apiDocs": {
    "pageTitle": "ホスティングプロバイダーAPI",
    "backToHosting": "HOSTINGに戻る",
    "contractVersion": "HTTP仕様 · バージョン1",
    "heading": "ホスティング管理システムを接続",
    "intro": "LUXIPANELは、HOSTINGで設定した権限に従ってアカウント作成、サイトの紐付け、アクセス付与を行うAPIを提供します。",
    "guideContents": "ガイドの目次",
    "preparation": "準備",
    "authentication": "認証",
    "operations": "操作",
    "example": "例",
    "panelAccess": "パネルへのアクセス",
    "limitsErrors": "制限とエラー",
    "preparationHeading": "HOSTINGでの準備",
    "administrator": "管理者",
    "scope": "適用範囲",
    "key": "キー",
    "adminStep": "HOSTING → 設定 → APIプロバイダーを開き、プロバイダーを作成します。",
    "scopeStep": "サーバー、サイトエンジン、モジュール、割当量、許可する操作を設定します。",
    "keyStep": "lhp_…キーを一度だけコピーし、管理システムのバックエンドのみに保存します。",
    "providerScopeNote": "各プロバイダーは1台のサーバーに紐付きます。アカウントには専用のLinuxユーザーとフォルダーが割り当てられ、管理システムはパスワードを指定も取得もしません。",
    "anyProvider": "すべてのプロバイダー",
    "endpointCapabilities": "バージョン、操作、モジュール、割当先サーバーを取得します。",
    "endpointPutAccount": "任意のdisplayNameとemailを指定してアカウントを作成または取得します。",
    "endpointGetAccount": "パスワードを公開せずにアカウントを取得します。",
    "endpointPatchAccount": "名前、メール、active/suspended状態を更新します。",
    "endpointDeleteAccount": "サイトが紐付いていないアカウントを削除します。初期状態では無効です。",
    "endpointUsage": "割当量、利用可能な使用量、測定上の警告を取得します。",
    "endpointPutSite": "ドメインをHOSTINGで設定したサイトエンジンに紐付けます。",
    "endpointDeleteSite": "このプロバイダーに属するサイトのみを削除します。",
    "endpointTicket": "60秒間有効な使い捨てパネルアクセストークンを発行します。",
    "method": "メソッド",
    "pathFromBase": "ベースURLからのパス",
    "permission": "権限",
    "result": "結果",
    "operationsHeading": "管理システムの操作",
    "authNote": "HTTPSでパネルへリクエストを送ります。管理者Cookieやlxp_…キーではこのAPIを認証できません。lhp_…キーをブラウザーに渡さないでください。",
    "baseNote": "ベースURL: https://<panel>/api/hosting/v1。外部IDは1～128文字で、英数字と _ . : - を使用できます。",
    "idempotencyNote": "同じ参照IDと内容のアカウント・サイトPUTリクエストは冪等です。プロバイダーは他のプロバイダーのアカウントにアクセスできません。",
    "createAccount": "アカウントの作成または取得",
    "accountResponseNote": "レスポンスの { \"ok\": true, \"data\": … } にユーザー、ホームディレクトリ、状態、割当量が含まれます。パスワードハッシュは含まれません。",
    "siteExampleNote": "サイトには { \"domain\": \"example.com\" } を指定して PUT /accounts/account-42/sites/site-1 を送ります。LUXIPANELが設定済みエンジンへのNGINXプロキシを作り、管理システムがコンテンツを公開してTLS通信をサーバーへ転送します。",
    "clientAccessHeading": "クライアントのLUXIPANELへのアクセス",
    "clientAccessNote": "管理システムのバックエンドがアカウントの所有を確認し、POST /accounts/{accountId}/access-ticket を呼びます。URLとチケットをブラウザーへ渡し、ブラウザーが /api/auth/sso/handoff にPOSTします。チケットは一度限りで60秒後に失効します。二要素認証が必要な場合、対応する手順ができるまで403を返します。",
    "limitsHeading": "制限とエラーレスポンス",
    "limitsNote": "APIが受け付けるのは参照ID、基本的なアカウント情報、ドメインのみです。管理システムはコマンド、ファイルパス、宛先サーバー、NGINX設定を送れません。サイトは管理者が指定したエンジンとポートにのみ接続します。",
    "errorCodes": "400: 入力エラー · 401: キーがないか無効 · 403: 操作権限なし · 404: 参照IDなし · 409: 競合または同時処理 · 5xx: サーバーエラー。",
    "bandwidthNote": "帯域幅の計測はまだ正確ではありません。usageレスポンスのwarningsを確認してください。"
  }
} as const;

export default hosting;
