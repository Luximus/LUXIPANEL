const webhooks = {
  "pageTitle": "WebhooksとAPI Keys",
  "tabs": {
    "webhooks": "Webhooks",
    "apiKeys": "API キー",
    "discovered": "検出済み"
  },
  "webhooksPanel": {
    "description": "HMAC署名付きのHTTP送信通知",
    "btnNew": "新規webhook"
  },
  "apiKeysPanel": {
    "description": "永続トークンによるプログラムアクセス",
    "btnNew": "新規API key"
  },
  "newKeyReveal": {
    "message": "API Keyが作成されました — 今すぐコピーしてください。再表示されません",
    "btnCopy": "コピー"
  },
  "webhookDialog": {
    "placeholderUrl": "https://example.com/webhook",
    "title": "新規webhook",
    "labelUrl": "エンドポイントURL",
    "labelEvents": "監視するイベント",
    "labelEnabled": "webhookを有効にする",
    "btnCancel": "キャンセル",
    "btnSave": "保存"
  },
  "apiKeyDialog": {
    "placeholderName": "マイ連携",
    "title": "新規API Key",
    "labelName": "説明的な名前",
    "labelExpires": "有効期限（任意）",
    "btnCancel": "キャンセル",
    "btnCreate": "keyを作成"
  },
  "discovered": {
    "description": "サーバー上で検出されたwebhook（Git、nginx、cron、systemd、設定ファイル、プロジェクト）",
    "btnRescan": "再スキャン",
    "scanning": "サーバーをスキャン中…",
    "empty": "サーバーでwebhookは検出されませんでした",
    "cols": {
      "source": "ソース",
      "name": "名前",
      "target": "宛先",
      "location": "場所",
      "estado": "状態"
    },
    "filters": {
      "searchTarget": "宛先を検索…",
      "source": "ソース"
    },
    "sources": {
      "sidecar": "パネル",
      "git-hook": "Git フック",
      "nginx": "Nginx",
      "cron": "Cron",
      "systemd": "systemd",
      "config": "設定",
      "project": "プロジェクト"
    },
    "status": {
      "enabled": "有効",
      "disabled": "無効",
      "unknown": "—"
    },
    "actions": {
      "detail": "詳細を表示",
      "delete": "削除"
    },
    "detail": {
      "title": "検出されたwebhookの詳細",
      "source": "ソース",
      "target": "宛先",
      "location": "場所",
      "info": "情報",
      "raw": "設定",
      "managedNote": "このwebhookはパネルによって管理されています",
      "readonlyNote": "読み取り専用：対応するモジュールから管理してください",
      "btnClose": "閉じる"
    },
    "confirm": {
      "deleteTitle": "検出されたwebhookを削除",
      "deleteBody": "「{name}」を削除しますか？これによりサーバー上のファイルが変更されます。",
      "deleteBtn": "はい、削除します"
    },
    "toasts": {
      "deleted": "削除しました",
      "errorDeleting": "削除できませんでした",
      "scanComplete": "スキャン完了：{count}",
      "notManageable": "対応するモジュールから管理してください"
    }
  },
  "labels": {
    "statusFailing": "失敗中",
    "statusActive": "有効",
    "statusPaused": "一時停止",
    "newWebhookTitle": "新規webhook",
    "noExpiry": "有効期限なし"
  },
  "confirm": {
    "rotateSecretBody": "このwebhookのシークレットをローテーションしますか？受信側の更新が必要になります。",
    "rotateSecretTitle": "シークレットをローテーション",
    "rotateSecretBtn": "ローテーションする",
    "deleteWebhookBody": "このwebhookを削除しますか？",
    "deleteWebhookTitle": "webhookを削除",
    "revokeKeyBody": "API key「{name}」を無効化しますか？",
    "revokeKeyTitle": "API keyを無効化",
    "revokeKeyBtn": "無効化する"
  },
  "toasts": {
    "secretRotated": "シークレットをローテーションしました",
    "errorRotating": "ローテーションエラー",
    "webhookDeleted": "webhookを削除しました",
    "errorDeleting": "削除エラー",
    "webhookUpdated": "webhookを更新しました",
    "webhookCreated": "webhookを作成しました",
    "errorSaving": "保存エラー",
    "keyRevoked": "keyを無効化しました",
    "errorRevoking": "無効化エラー",
    "copiedToClipboard": "クリップボードにコピーしました",
    "errorCreatingKey": "keyの作成に失敗しました"
  },
  "categories": {
    "receiveData": "データ受信",
    "mailhook": "Mailhook",
    "response": "Webhook レスポンス",
    "soon": "近日公開",
    "soonDesc": "このカテゴリの設定とスキャンは後のフェーズで定義されます。"
  },
  "gateway": {
    "description": "パネルがホストする受信データ用エンドポイント（Make.com スタイル）。API キー認証（x-make-apikey）、IP 制限、データ構造検証に対応。",
    "btnNew": "新規 Webhook",
    "detectedTitle": "サーバー上で検出されたレシーバー",
    "urlReveal": "Webhook URL — リクエストの送信先",
    "cols": {
      "name": "名前",
      "auth": "認証",
      "recibidos": "受信数",
      "ultima": "最終受信",
      "estado": "ステータス",
      "estadoActive": "有効",
      "estadoPaused": "一時停止"
    },
    "dialog": {
      "titleNew": "Webhook を作成",
      "titleEdit": "Webhook を編集",
      "name": "Webhook 名",
      "namePlaceholder": "マイ Webhook ゲートウェイ",
      "nameHint": "1〜128 文字で入力してください。",
      "apiAuth": "API キー認証",
      "apiAuthHint": "API キーを x-make-apikey ヘッダーで送信します。1 つ以上追加し、いずれかが一致するとアクセスが許可されます。",
      "apiKeyName": "名前",
      "apiKeyValue": "API キーの値",
      "apiKeyKeep": "（保存済み — 変更しない場合は空欄のまま）",
      "addApiKey": "API キーを追加",
      "ipTitle": "IP 制限",
      "ipHint": "カンマ区切りの IP アドレスリスト。CIDR 表記も使用可能。空欄 = チェックなし。",
      "dataStructure": "データ構造",
      "dataStructureHint": "受信データのバリデーション。空欄 = バリデーションなしで受け入れ。",
      "dsValidate": "データ構造を検証",
      "dsStrict": "厳格モード（未定義フィールドを拒否）",
      "dsFieldName": "名前",
      "dsFieldDesc": "説明",
      "dsFieldType": "型",
      "dsFieldDefault": "デフォルト値",
      "dsFieldRequired": "必須",
      "dsFieldMultiline": "複数行",
      "addItem": "フィールドを追加",
      "getHeaders": "リクエストヘッダーを取得",
      "getHeadersHint": "ヘッダーはボディに追加されます。",
      "getMethod": "HTTP メソッドを取得",
      "getMethodHint": "メソッド（動詞）はボディに追加されます。",
      "jsonPassthrough": "JSON をテキストとして保存",
      "jsonPassthroughHint": "有効にすると、JSON ペイロードは文字列として保存されます。",
      "enabled": "Webhook 有効",
      "advanced": "詳細設定",
      "btnCancel": "キャンセル",
      "btnSave": "保存"
    },
    "payloads": {
      "title": "受信したペイロード",
      "empty": "まだペイロードは受信されていません。",
      "btnClose": "閉じる"
    },
    "confirm": {
      "deleteTitle": "Webhook の削除",
      "deleteBody": "Webhook「{name}」を削除しますか？保存されたペイロードは失われます。",
      "deleteBtn": "はい、削除する"
    },
    "toasts": {
      "created": "Webhook を作成しました",
      "updated": "Webhook を更新しました",
      "deleted": "Webhook を削除しました",
      "copied": "URL をコピーしました",
      "error": "保存中にエラーが発生しました"
    }
  },
  "table": {
    "gateway": {
      "columns": {
        "name": "名前",
        "auth": "認証",
        "recibidos": "受信数",
        "ultima": "最終受信",
        "estado": "状態"
      },
      "filters": {
        "searchName": "名前を検索…",
        "estado": "状態"
      },
      "rowActions": {
        "copy": "URL をコピー",
        "payloads": "ペイロードを表示",
        "edit": "編集",
        "delete": "削除"
      },
      "options": {
        "statusActive": "有効",
        "statusPaused": "一時停止"
      }
    },
    "webhooks": {
      "columns": {
        "url": "URL",
        "eventos": "イベント",
        "estado": "状態"
      },
      "filters": {
        "searchUrl": "URLを検索…",
        "estado": "状態"
      },
      "rowActions": {
        "regenerate": "シークレットをローテーション",
        "delete": "削除"
      },
      "options": {
        "statusActive": "有効",
        "statusPaused": "一時停止",
        "statusFailing": "失敗中"
      }
    },
    "apiKeys": {
      "columns": {
        "name": "名前",
        "prefix": "プレフィックス",
        "creada": "作成日",
        "expira": "有効期限"
      },
      "filters": {
        "searchName": "名前を検索…"
      },
      "rowActions": {
        "revoke": "取り消す"
      }
    },
    "discovered": {
      "columns": {
        "origen": "ソース",
        "name": "名前",
        "target": "宛先",
        "location": "場所",
        "estado": "状態"
      },
      "filters": {
        "searchTarget": "宛先を検索…",
        "origen": "ソース"
      },
      "rowActions": {
        "detail": "詳細を表示",
        "delete": "削除"
      },
      "options": {
        "panel": "パネル",
        "gitHook": "Git フック",
        "nginx": "Nginx",
        "cron": "Cron",
        "systemd": "systemd",
        "config": "設定",
        "proyecto": "プロジェクト"
      }
    }
  },
  "runtime": {
    "testDelivered": "テストを正常に配信しました。",
    "testFailed": "テスト配信に失敗しました。",
    "loadingDeliveries": "配信履歴を読み込み中…",
    "loadDeliveriesError": "配信履歴を読み込めませんでした。",
    "noDeliveries": "配信履歴はまだありません。",
    "delivered": "配信済み",
    "failed": "失敗",
    "attempts": "試行回数: {count}",
    "selectEvent": "イベントを1つ以上選択してください。"
  },
  "settingsUi": {
    "title": "Webhooksの設定",
    "description": "Webhooksのテーブルのページ分割と表示する操作。",
    "gateway": "ゲートウェイ",
    "webhooks": "Webhooks",
    "signingSecret": "署名シークレット · 今すぐコピー",
    "signingSecretHint": "表示されるのは一度だけです。受信側で設定してX-Luxipanel-Signatureを検証してください。",
    "recentDeliveries": "最近の配信"
  }
} as const;

export default webhooks;
