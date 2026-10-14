const deps = {
  "banner": {
    "title": "必要なコンポーネントが検出されません",
    "description": "このモジュールには接続中のサーバー上のシステムパッケージが必要です。サーバーのパッケージマネージャーが管理者権限で実行されます。",
    "btnInstall": "今すぐインストール",
    "btnInstallAll": "すべてインストール",
    "installing": "インストール中… 数分かかる場合があります。",
    "success": "コンポーネントが正常にインストールされました。",
    "optionalTitle": "オプションのコンポーネント",
    "optionalDescription": "これらのコンポーネントはこのモジュールの追加機能を有効にします。",
    "statusInstalled": "インストール済み",
    "statusMissing": "未インストール",
    "statusOptional": "オプション",
    "modalTitle": "コンポーネントのインストール",
    "modalDescription": "パッケージマネージャーの出力が以下に表示されます。",
    "checkError": "モジュールのコンポーネントを確認できませんでした。",
    "oneOfTitle": "これらのコンポーネントのうち少なくとも1つが必要です",
    "oneOfDescription": "このモジュールを有効にするには、以下のいずれかのコンポーネントをインストールしてください。"
  }
} as const;

export default deps;
