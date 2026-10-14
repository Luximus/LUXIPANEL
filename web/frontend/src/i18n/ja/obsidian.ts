const obsidian = {
  "workspace": {
    "settingsTitle": "Obsidian 設定",
    "settingsDescription": "個人表示とVaultの管理",
    "appearance": "表示",
    "shortcuts": "ショートカット",
    "vaults": "保管庫",
    "aiIntegration": "AI 連携",
    "personalHint": "このサーバーのアカウントに保存されます。",
    "defaultView": "Markdown の既定表示",
    "edit": "編集",
    "preview": "プレビュー",
    "split": "分割",
    "fontSize": "文字サイズ",
    "saved": "保存しました",
    "shortcutsHint": "この作業画面で使えるキーボードショートカット。",
    "saveShortcut": "ノートを保存",
    "searchShortcut": "検索に移動",
    "vaultsHint": "このサーバーのVaultを登録・管理します。",
    "aiHint": "コンテキストファイルを準備し、コンテナーを同期します。",
    "today": "今日のノート",
    "quickEntry": "クイック入力",
    "quickEntryHint": "今日のノートの末尾に文章を追加します。",
    "append": "追記",
    "editorPane": "エディター",
    "mobileView": "作業画面の表示",
    "clearSearch": "クリア",
    "askAdmin": "管理者にこのサーバーへのVault登録を依頼してください。",
    "available": "利用可能",
    "missing": "利用不可",
    "notesCount": "ノート",
    "noVault": "Vaultなし",
    "readOnly": "読み取り専用",
    "entryRequired": "追加する内容を入力してください。",
    "entryError": "内容を追加できませんでした。",
    "previewError": "プレビューを読み込めませんでした。",
    "entryAdded": "内容を追加しました。"
  },
  "pageTitle": "Obsidian",
  "header": {
    "heading": "Obsidian ボールト",
    "subheading": "接続中のサーバーでボールト、Markdown ノート、[[wikilink]] リンクを管理します。"
  },
  "toolbar": {
    "newVault": "新規ボールト",
    "unregister": "登録解除",
    "prepareAi": "AI エージェント用に準備",
    "searchPlaceholder": "ノートを検索...",
    "syncContainers": "コンテナを同期"
  },
  "tree": {
    "title": "ノート",
    "newNote": "新規ノート",
    "newFolder": "新規フォルダ"
  },
  "editor": {
    "emptyTitle": "ノートを選択",
    "emptyDescription": "ノートの内容がここに表示され、編集できます。",
    "save": "保存",
    "links": "リンク",
    "analyzeAi": "AI で分析",
    "unsavedChanges": "未保存の変更"
  },
  "vaultDialog": {
    "title": "新規ボールト",
    "labelName": "名前",
    "placeholderName": "マイボールト",
    "labelPath": "サーバー上の絶対パス",
    "placeholderPath": "/home/usuario/vaults/mi-vault",
    "btnBrowse": "参照",
    "modeCreate": "新しいフォルダを作成",
    "modeCreateHint": "サーバー上にボールトのフォルダ（と .obsidian マーカー）を作成します。",
    "modeRegister": "既存のフォルダを登録",
    "modeRegisterHint": "サーバー上に既に存在するボールトのフォルダを使用します。",
    "btnCancel": "キャンセル",
    "btnSave": "保存"
  },
  "pathBrowserDialog": {
    "title": "フォルダを選択",
    "btnUp": "上へ",
    "btnCancel": "キャンセル",
    "btnSelect": "このフォルダを使用"
  },
  "inputDialog": {
    "btnCancel": "キャンセル",
    "btnOk": "OK"
  },
  "search": {
    "title": "検索結果"
  },
  "empty": {
    "noVaultsTitle": "登録されたボールトがありません",
    "noVaultsDescription": "Obsidian ボールトを作成または登録して、サーバー上のノートの作業を始めましょう。",
    "noVaultsCta": "新規ボールト",
    "treeNoNotes": "このボールトにはまだノートがありません。",
    "searchNoResults": "「{q}」の検索結果はありません。"
  },
  "confirm": {
    "discardDirtyBody": "現在のノートに未保存の変更があります。破棄しますか？",
    "discardDirtyTitle": "未保存の変更",
    "discardDirtyConfirm": "破棄する",
    "discardDirtyCancel": "編集を続ける",
    "unregisterBody": "ボールト「{name}」の登録を解除しますか？サーバー上のファイルは削除されません。",
    "unregisterTitle": "ボールトの登録解除",
    "unregisterConfirm": "登録解除",
    "overwriteContextBody": "コンテキストファイルはすでに存在します（{skipped}）。上書きしますか？",
    "overwriteContextTitle": "コンテキストの上書き",
    "overwriteContextConfirm": "上書き",
    "deleteNoteBody": "ノート「{path}」を削除しますか？この操作は元に戻せません。",
    "deleteNoteTitle": "ノートの削除",
    "deleteNoteConfirm": "削除"
  },
  "actions": {
    "retry": "再試行",
    "rename": "名前変更",
    "delete": "削除",
    "newNoteInputTitle": "新しいノート",
    "newFolderInputTitle": "新しいフォルダ",
    "renameInputTitle": "ノートの名前変更",
    "analyzeAiPrompt": "LUXIPANEL の Obsidian モジュールから、ボールト「{vaultName}」（サーバー上のボールトパス: {vaultPath}）でノート「{notePath}」を操作しています。\n\nobsidian.* ツール（ボールトのノートの読み取り／検索／作成／リンク）を使って以下を行ってください：\n1. ノートを読み取り、重要なポイントを要約する。\n2. 発リンク [[wikilink]] とバックリンクを確認する。\n3. コンテンツ、構造、およびボールト内の関連ノートへの新しいリンクの改善案を提案する。\n\n変更を適用する前に必ず確認してください。"
  },
  "errors": {
    "loadVaults": "ボールトを読み込めませんでした",
    "vaultMissing": "ボールトフォルダがサーバーに存在しません（{path}）。登録を解除するか、フォルダを復元してください。",
    "nameAndPathRequired": "名前とパスは必須です",
    "pathMustBeAbsolute": "パスは絶対パスである必要があります（/ で始まる）",
    "createVault": "ボールトを作成できませんでした",
    "unregisterVault": "ボールトの登録を解除できませんでした",
    "prepareContext": "AI コンテキストを準備できませんでした",
    "syncContainers": "コンテナを同期できませんでした",
    "loadTree": "ツリーの読み込みエラー",
    "openNote": "ノートを開けませんでした",
    "saveNote": "ノートを保存できませんでした",
    "noVaultSelected": "先にボールトを選択してください",
    "createNote": "ノートを作成できませんでした",
    "createFolder": "フォルダを作成できませんでした",
    "renameNote": "ノートの名前を変更できませんでした",
    "deleteNote": "ノートを削除できませんでした",
    "loadLinks": "リンクの読み込みエラー",
    "wikilinkNotFound": "ノート「{name}」がボールトに見つかりません",
    "search": "検索エラー",
    "listPath": "このパスを一覧表示できません（権限の問題？）。"
  },
  "labels": {
    "noteCount": " · {count} 件のノート",
    "loading": "読み込み中…",
    "noSubfolders": "（サブフォルダなし）",
    "loadingLinks": "リンクを読み込み中…",
    "noOutgoingLinks": "発リンクなし。",
    "outgoing": "発リンク",
    "backlinks": "バックリンク",
    "noBacklinks": "バックリンクなし。",
    "searching": "検索中…",
    "newNoteInputLabel": "ボールト内の相対パス（例：Ideas/メモ.md）",
    "newFolderInputLabel": "ボールト内の相対パス（例：Projects/2026）",
    "renameInputLabel": "新しい相対パス"
  },
  "toasts": {
    "vaultCreated": "ボールトを作成しました",
    "vaultRegistered": "ボールトを登録しました",
    "vaultUnregistered": "ボールトの登録を解除しました",
    "contextWritten": "AIコンテキストを書き込みました：{written}",
    "contextNoChanges": "変更なし（既存：{skipped}）",
    "containersSynced": "作成 {created} · 既存 {existing} · リポジトリ {repos} · プロジェクト {projects} · チャット {chats}",
    "containersBasic": "コンテナを同期しました",
    "noteSaved": "ノートを保存しました",
    "noteCreated": "ノートを作成しました",
    "folderCreated": "フォルダを作成しました",
    "noteRenamed": "ノートの名前を変更しました",
    "noteDeleted": "ノートを削除しました"
  }
} as const;

export default obsidian;
