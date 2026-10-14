const modules = {
  "pageTitle": "モジュール",
  "header": {
    "heading": "モジュールと連携",
    "subheading": "サイドメニューに表示されるプリインストール済みモジュールを有効化または非表示にする"
  },
  "search": {
    "placeholder": "モジュールを検索..."
  },
  "tabs": {
    "all": "すべて",
    "modules": "モジュール",
    "integrations": "インテグレーション",
    "visible": "表示中"
  },
  "stats": {
    "visible": "表示中：",
    "hidden": "非表示：",
    "systemNote": "システムモジュールはプリインストール済みの状態で維持されます"
  },
  "categories": {
    "label": "カテゴリ",
    "all": "すべて",
    "communication": "コミュニケーション",
    "infrastructure": "インフラ",
    "security": "セキュリティ",
    "developer": "開発者"
  },
  "statusFilter": {
    "label": "状態",
    "all": "すべて",
    "visible": "表示中",
    "hidden": "非表示"
  },
  "empty": {
    "title": "モジュールが見つかりませんでした",
    "subtitle": "別の検索キーワードまたはカテゴリで試してください"
  },
  "errors": {
    "loadTitle": "モジュールの読み込みエラー",
    "loadSubtitle": "モジュール一覧を取得できませんでした"
  },
  "labels": {
    "metaVersion": "バージョン",
    "metaInstalls": "インストール数",
    "metaRating": "評価",
    "metaAuthor": "作者",
    "metaCreatedAt": "作成日",
    "metaUpdatedAt": "最終更新",
    "kindIntegration": "インテグレーション",
    "kindModule": "モジュール",
    "tagFree": "無料",
    "tagLicense": "ライセンス必要",
    "statusVisible": "メニューに表示",
    "statusHidden": "非表示",
    "dragHandle": "ドラッグして並び替え",
    "menuToggle": "サイドメニューに表示",
    "moduleToggle": "モジュールを有効化",
    "fabToggle": "フローティングボタンを表示"
  },
  "toasts": {
    "moduleVisible": "{name} を表示しました",
    "moduleHidden": "{name} を非表示にしました",
    "moduleVisibleWithDeps": "{name} を表示しました（同時に有効化: {deps}）",
    "moduleHiddenWithDeps": "{name} を非表示にしました（同時に有効化: {deps}）",
    "moduleUpdateError": "{name} を更新できませんでした",
    "sidebarShown": "{name} をメニューに表示しました",
    "sidebarHidden": "{name} をメニューから非表示にしました",
    "fabShown": "{name}: フローティングボタンを有効化",
    "fabHidden": "{name}: フローティングボタンを無効化",
    "orderSaved": "順序を保存しました",
    "orderError": "順序を保存できませんでした",
    "orderHttpError": "順序を保存できませんでした（{status}）"
  }
} as const;

export default modules;
