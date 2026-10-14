const components = {
  "setupWizardFooter": {
    "rights": "全著作権所有。",
    "madeBy": "LUXISOFT 制作",
    "termsAndConditions": "利用規約",
    "privacyPolicy": "プライバシーポリシー",
    "documentation": "ドキュメント",
    "refundPolicy": "返金ポリシー"
  },
  "dataTable": {
    "boolTrue": "はい",
    "boolFalse": "いいえ",
    "selectPage": "ページを選択",
    "selectRow": "行を選択",
    "actions": "操作",
    "configure": "テーブルを設定",
    "empty": "{title} の結果がありません。",
    "total": "合計",
    "selectedSummary": "{selected} 件選択 • {pageSize} 件中 {shown} 件を表示、結果の総数: {total}",
    "summary": "{pageSize} 件中 {shown} 件を表示、結果の総数: {total}",
    "prev": "前へ",
    "next": "次へ",
    "pageOf": "{totalPages} ページ中 {currentPage} ページ",
    "configureTitle": "テーブルを設定",
    "columnsAndOrder": "表示する列と順序",
    "resultsPerPage": "1ページあたりの結果",
    "moveUp": "{col} を上に移動",
    "moveDown": "{col} を下に移動",
    "defaultTitle": "テーブル",
    "dragHandle": "ドラッグして並べ替え",
    "moveUpAria": "{col} を上に移動",
    "moveDownAria": "{col} を下に移動",
    "emptyCell": "-"
  },
  "confirmModal": {
    "title": "確認",
    "cancel": "キャンセル",
    "confirm": "確認",
    "alertTitle": "通知",
    "alertOk": "了解",
    "promptTitle": "値を入力してください",
    "promptCancel": "キャンセル",
    "promptOk": "OK"
  },
  "modalNavbar": {
    "back": "戻る",
    "close": "閉じる"
  },
  "viewSettingsModal": {
    "buttonLabel": "設定",
    "description": "このモジュール固有の設定",
    "close": "閉じる"
  },
  "floatingTerminal": {
    "newSnippet": "新しいスニペット",
    "close": "閉じる",
    "name": "名前",
    "namePlaceholder": "例: Postfix を再起動",
    "category": "カテゴリ",
    "tags": "タグ",
    "tagsHelp": "タグは選択したカテゴリによって異なります",
    "command": "コマンド",
    "monacoHelp": "シェル構文用の Monaco。エディタから保存するには Ctrl+Enter を使用します。",
    "cancel": "キャンセル",
    "save": "保存"
  },
  "installModal": {
    "running": "インストール中… 数分かかる場合があります。",
    "success": "インストールが完了しました。",
    "failed": "インストールに失敗しました。ログを確認してください。"
  },
  "enterPage": {
    "pageTitle": "コードでログイン",
    "heading": "アクセスコードでログイン",
    "subtitle": "受け取ったコードを入力してパネルにアクセスしてください。",
    "codeLabel": "アクセスコード",
    "codePlaceholder": "例: a1b2c3d4e5f6g7",
    "continue": "続行",
    "useAnotherCode": "別のコードを使用",
    "codeShort": "コード",
    "terminalAi": "ターミナル / AI",
    "enter": "ログイン",
    "willBeRedirected": "パネルのログイン画面に移動します。",
    "featuresAvailable": "利用可能",
    "featuresUnavailable": "利用不可",
    "invalidCode": "アクセスコードが無効です。",
    "verifyError": "コードを確認できませんでした。もう一度お試しください。",
    "networkError": "ネットワークエラーが発生しました。もう一度お試しください。",
    "guestSessionError": "ゲストセッションを開始できませんでした。"
  },
  "dragHandle": "ドラッグして並べ替え",
  "logoAlt": "LUXIPANEL",
  "default": " (デフォルト)",
  "emptyCell": "-",
  "loginEffects": {
    "defaultSuffix": " (既定)",
    "webGpuHint": "WebGPU が必要です。非対応のブラウザーでは既定の背景が表示されます。"
  },
  "tableSettings": {
    "pagination": "ページ分割",
    "rowsPerPage": "このテーブルの1ページあたりの行数。",
    "visibleActions": "表示する操作",
    "actionsHint": "各行の「···」メニューに表示する操作を選択します。"
  }
} as const;

export default components;
