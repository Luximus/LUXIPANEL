const errors = {
  "networkError": {
    "serverError": "サーバーがエラー {status} を返しました（操作がタイムアウトした可能性があります）。",
    "invalidResponse": "サーバーからの無効な応答です。",
    "connectionFailed": "サーバーに接続できませんでした。接続を確認して再試行してください。",
    "targetScopeChanged": "選択したサーバーが変更されました。ページを再読み込みしてください。",
    "bridgeSessionRequired": "続行するにはサーバーを選択するか、再接続してください。"
  },
  "error400": {
    "code": "400",
    "title": "無効なリクエスト",
    "description": "送信されたリクエストに無効なパラメータが含まれています。データを確認して再試行してください。"
  },
  "error401": {
    "code": "401",
    "title": "未認証",
    "description": "このリソースにアクセスするにはログインが必要です。ログインしてください。"
  },
  "error403": {
    "code": "403",
    "title": "アクセス禁止",
    "description": "このリソースへのアクセス権限がありません。"
  },
  "error404": {
    "code": "404",
    "title": "ページが見つかりません",
    "description": "お探しのパスは存在しないか、移動されました。URLを確認するか、ホームに戻ってください。"
  },
  "error500": {
    "code": "500",
    "title": "サーバー内部エラー",
    "description": "サーバーで問題が発生しました。解決に取り組んでいます。後でもう一度お試しください。"
  },
  "error503": {
    "code": "503",
    "title": "サービス利用不可",
    "description": "サーバーはメンテナンス中または過負荷状態です。後でもう一度お試しください。"
  },
  "home": "ホームへ",
  "back": "戻る",
  "backToServers": "サーバー一覧へ戻る"
} as const;

export default errors;
