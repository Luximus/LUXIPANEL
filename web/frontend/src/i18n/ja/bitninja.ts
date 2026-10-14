const bitninja = {
  "header": {
    "description": "接続されたサーバー上の総合セキュリティエージェント（WAF、アンチDoS、マルウェア検出、IP評価）。",
    "statusChecking": "確認中…"
  },
  "sudo": {
    "label": "sudoパスワード（セッションのパスフレーズ）",
    "placeholder": "サーバーがsudoを要求する場合のみ",
    "hint": "このアクションのみに使用され、ブラウザには保存されません。"
  },
  "installCard": {
    "title": "BitNinjaはインストールされていません",
    "description": "BitNinjaアカウントのライセンスキーを入力して、このサーバーにエージェントをインストールします。公式インストーラー（get.bitninja.io）がダウンロードされ、sudoで実行されます。",
    "licensePlaceholder": "ライセンスキー（例: ab12cd34-…）",
    "installButton": "BitNinjaをインストール"
  },
  "stats": {
    "service": "サービス",
    "license": "ライセンス",
    "version": "バージョン"
  },
  "serviceControl": {
    "title": "サービスコントロール",
    "start": "開始",
    "restart": "再起動",
    "stop": "停止"
  },
  "components": {
    "title": "保護コンポーネント",
    "checking": "確認中…",
    "noReported": "エージェントがコンポーネントを報告しませんでした。",
    "active": "有効",
    "inactive": "無効"
  },
  "updateLicense": {
    "title": "ライセンスキーを更新",
    "placeholder": "新しいライセンスキー",
    "applyButton": "適用"
  },
  "toasts": {
    "sudoRequired": "sudoパスワードを入力して再試行してください。",
    "sudoInvalid": "sudoパスワードが無効です。",
    "actionFailed": "操作に失敗しました。出力を確認してください。",
    "installing": "BitNinjaをインストール中… 数分かかる場合があります。",
    "installed": "BitNinjaをインストールしました。",
    "serviceAction": "サービス: {action} 完了。",
    "componentToggleEnabled": "{component}: 有効化しました。",
    "componentToggleDisabled": "{component}: 無効化しました。",
    "licenseApplied": "ライセンスキーを適用しました。"
  },
  "errors": {
    "unknown": "不明なエラー"
  },
  "status": {
    "notInstalled": "未インストール",
    "running": "実行中",
    "installedStopped": "インストール済み（停止中）",
    "serviceRunning": "実行中",
    "serviceStopped": "停止中",
    "licenseValid": "有効",
    "licenseReview": "要確認"
  },
  "validation": {
    "licenseKeyRequired": "ライセンスキーを入力してください。",
    "newLicenseKeyRequired": "新しいライセンスキーを入力してください。"
  },
  "settingsUi": {
    "settingsTitle": "BitNinja 設定",
    "settingsButton": "設定",
    "settingsDescription": "現在のサーバーの診断設定です。",
    "settingsSections": "BitNinja 設定セクション",
    "diagnostics": "診断",
    "related": "関連",
    "logSource": "ログは選択したサーバーの BitNinja サービスから読み取ります。",
    "autoRefresh": "30 秒ごとに状態を更新",
    "logLines": "ログの行数",
    "relatedModules": "関連モジュール",
    "firewallAudit": "ファイアウォールと監査",
    "credentials": "BitNinja の認証情報"
  },
  "logsUi": {
    "loading": "ログを読み込み中…",
    "empty": "最近のイベントはありません。",
    "loadError": "ログを読み込めませんでした。",
    "logsTitle": "最近のログ",
    "logsDescription": "現在のサーバーのサービスイベントです。",
    "refreshLogs": "ログを更新",
    "logsHint": "イベントを読み込むには「ログを更新」を選択してください。"
  }
} as const;

export default bitninja;
