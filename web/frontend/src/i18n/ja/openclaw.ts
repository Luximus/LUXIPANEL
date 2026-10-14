const openclaw = {
  "pageTitle": "OpenClaw",
  "header": {
    "subtitle": "パネルを接続する",
    "subtitleSuffix": "モデルとツールを使用するために。"
  },
  "statusCard": {
    "title": "接続状態",
    "descKeySet": "API keyが設定されています。「接続テスト」を押して確認してください。",
    "descNoKey": "API keyはまだ設定されていません。",
    "btnTest": "接続テスト"
  },
  "form": {
    "sectionTitle": "認証情報とエンドポイント",
    "sectionDesc": "APIキーはパネルのデータベースに暗号化されて保存されます。",
    "labelEndpoint": "エンドポイント",
    "placeholderEndpoint": "https://openclaw.ai",
    "hintEndpoint": "APIのベースURL。デフォルト",
    "labelApiKey": "APIキー",
    "placeholderApiKeySet": "設定済み · {preview}",
    "placeholderApiKeyUnset": "sk-...",
    "ariaToggleKey": "表示／非表示",
    "btnClearKey": "削除",
    "hintApiKey": "現在のAPIキーを維持する場合は空欄のままにしてください。",
    "labelDefaultModel": "デフォルトモデル",
    "placeholderDefaultModel": "claw-default",
    "hintDefaultModel": "モデルを指定しない内部呼び出しで使用されるモデルの識別子。",
    "btnSave": "変更を保存"
  },
  "help": {
    "title": "API keyを取得するには？",
    "step1": "にログインする",
    "step2": "アカウント設定を開き、新しいAPIキーを作成してください。",
    "step3": "上に貼り付けて保存してください — パネルには再度クリアテキストで表示されません。"
  }
} as const;

export default openclaw;
