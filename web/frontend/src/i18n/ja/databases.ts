const databases = {
  "pageTitle": "データベース",
  "header": {
    "heading": "データベースマネージャー",
    "subheading": "サーバーのデータベース（MySQL/MariaDB、PostgreSQL）を参照・クエリします。"
  },
  "databases": {
    "title": "データベース"
  },
  "tables": {
    "title": "テーブル"
  },
  "tabs": {
    "rows": "行",
    "structure": "構造",
    "console": "SQLコンソール"
  },
  "rows": {
    "prev": "前へ",
    "next": "次へ"
  },
  "console": {
    "placeholder": "SELECT * FROM ...",
    "run": "実行",
    "allowWrite": "書き込みを許可",
    "hint": "Ctrl/⌘ + Enter で実行。書き込み/DDL文には「書き込みを許可」のチェックが必要です。"
  },
  "common": {
    "selectEngine": "エンジンを選択してください。",
    "selectDb": "データベースを選択してください。",
    "selectTable": "テーブルを選択してください。"
  },
  "actions": {
    "export": "エクスポート",
    "addRecord": "レコードを挿入",
    "cancel": "キャンセル",
    "save": "保存",
    "edit": "編集",
    "downloadSql": "SQLをダウンロード",
    "install": "{label} をインストール"
  },
  "titles": {
    "record": "レコード",
    "exportDb": "データベースをエクスポート",
    "editRecord": "レコードを編集 · {table}",
    "newRecord": "新しいレコード · {table}"
  },
  "labels": {
    "tablesLabel": "テーブル",
    "allTables": "すべて",
    "includeData": "データを含める",
    "active": "アクティブ",
    "actions": "アクション",
    "colName": "カラム",
    "colType": "型",
    "colNullable": "NULL許可",
    "colKey": "キー",
    "colDefault": "デフォルト",
    "yes": "はい",
    "no": "いいえ",
    "primaryKey": "主キー",
    "tbl": "テーブル"
  },
  "install": {
    "title": "データベースエンジンをインストール",
    "description": "接続中のサーバーにMariaDBまたはPostgreSQLをインストールして、データベース管理を開始してください。",
    "mariadb": "MariaDB",
    "postgresql": "PostgreSQL"
  },
  "empty": {
    "noResults": "結果がありません。",
    "noEngines": "サーバーにアクティブなデータベースエンジンがありません。インストールして開始してください。",
    "noDatabases": "データベースがありません。",
    "noTables": "テーブルがありません。"
  },
  "errors": {
    "detectEngines": "エンジンの検出に失敗しました",
    "loadRows": "行の読み込みに失敗しました",
    "saveRecord": "レコードを保存できませんでした",
    "deleteRecord": "レコードを削除できませんでした",
    "networkError": "ネットワークエラー",
    "runQuery": "クエリの実行中にエラーが発生しました"
  },
  "loading": {
    "generic": "読み込み中…",
    "rows": "行を読み込み中…",
    "structure": "構造を読み込み中…",
    "tablesExport": "テーブルを読み込み中…",
    "running": "実行中…"
  },
  "toasts": {
    "engineInstalled": "{label} をインストールしました",
    "noColumnsMetadata": "このテーブルの列メタデータがありません",
    "recordUpdated": "レコードを更新しました",
    "recordCreated": "レコードを作成しました",
    "recordDeleted": "レコードを削除しました",
    "noTableSelect": "テーブルを1つ以上選択してください",
    "exportDownloaded": "エクスポートをダウンロードしました",
    "selectEngineFirst": "最初にエンジンを選択してください",
    "statementExecuted": "ステートメントを実行しました"
  },
  "confirm": {
    "deleteRecord": "このレコードを削除しますか？この操作は元に戻せません。",
    "deleteTitle": "レコードの削除",
    "deleteConfirmText": "削除"
  },
  "info": {
    "installing": "{label} をインストール中… しばらくお待ちください。",
    "installed": "{label} をインストールしました。エンジンを検出中…",
    "pager": "{from}〜{to} 行目（{limit} 件/ページ）",
    "statementExecuted": "ステートメントを実行しました",
    "rowCount": "{count} 行",
    "truncated": "· 結果を {count} 行に切り詰めました"
  },
  "runtime": {
    "createPromptWithPrefix": "名前は {prefix} で始まり、割り当て制限内である必要があります。",
    "createPrompt": "稼働中のサーバーに作成するデータベースの名前。",
    "invalidPrefix": "名前は {prefix} で始めてください",
    "createError": "データベースを作成できませんでした。",
    "created": "データベースを作成しました。"
  },
  "settings": {
    "title": "データベース設定",
    "description": "データベースモジュールの設定。",
    "table": "テーブル",
    "pagination": "ページ分割",
    "rowsPerPage": "構造とコンソールの結果で表示する1ページあたりの行数。",
    "serverPagination": "レコード テーブルはサーバー側のページ分割を使用するため、ここでは変更できません。",
    "relatedModules": "関連モジュール",
    "hostingQuotas": "ホスティングと割り当て量",
    "databaseBackups": "データベースのバックアップ",
    "sqlFiles": "SQLファイル",
    "allowWriteDefault": "コンソールを開くときに書き込みを既定で許可",
    "allowWriteHelp": "モジュールの読み込み時に適用されます。コンソールでいつでも変更できます。",
    "createDatabase": "データベースを作成",
    "create": "作成"
  }
} as const;

export default databases;
