const servers = {
  "pageTitle": "サーバー",
  "description": "このパネルが接続できる SSH 接続先のローカル一覧です。秘密情報（鍵とパスワード）は暗号化して保存され、ここには表示されません。",
  "btnNew": "サーバーを追加",
  "table": {
    "name": "名前",
    "host": "ホスト",
    "username": "ユーザー",
    "authType": "認証",
    "status": "状態"
  },
  "authTypes": {
    "key": "SSH 鍵",
    "password": "パスワード"
  },
  "status": {
    "approved": "承認済み",
    "pending": "承認待ち",
    "untested": "未テスト"
  },
  "common": {
    "test": "テスト",
    "edit": "編集",
    "delete": "削除",
    "cancel": "キャンセル",
    "save": "保存",
    "close": "閉じる",
    "error": "エラー",
    "yes": "はい",
    "no": "いいえ"
  },
  "dialog": {
    "titleNew": "サーバーを追加",
    "titleEdit": "サーバーを編集",
    "name": "名前",
    "namePlaceholder": "本番サーバー",
    "host": "ホストまたは IP",
    "hostPlaceholder": "203.0.113.10 または server.example.com",
    "port": "ポート",
    "username": "ユーザー",
    "usernamePlaceholder": "root",
    "authType": "認証方式",
    "secretKey": "SSH 秘密鍵",
    "secretKeyPlaceholder": "-----BEGIN OPENSSH PRIVATE KEY-----",
    "passphrase": "鍵のパスフレーズ（任意）",
    "passphrasePlaceholder": "鍵を解除するパスフレーズ",
    "secretPassword": "パスワード",
    "secretPasswordPlaceholder": "SSH ユーザーのパスワード",
    "secretKeepHint": "現在の秘密情報を保持するには空欄にしてください。",
    "btnCancel": "キャンセル",
    "btnSave": "保存"
  },
  "fingerprint": {
    "title": "ホストのフィンガープリントを承認",
    "intro": "このサーバーへの初回接続です。承認する前に、ホスト鍵のフィンガープリントが想定したものと一致するか確認してください。",
    "approve": "フィンガープリントを承認",
    "approving": "承認中…",
    "approved": "フィンガープリントを承認しました",
    "approveError": "フィンガープリントを承認できませんでした"
  },
  "toasts": {
    "created": "サーバーを追加しました",
    "updated": "サーバーを更新しました",
    "deleted": "サーバーを削除しました",
    "testOk": "接続に成功しました",
    "testFailed": "接続に失敗しました"
  },
  "validation": {
    "nameRequired": "名前を入力してください",
    "hostRequired": "ホストを入力してください",
    "usernameRequired": "ユーザーを入力してください",
    "secretRequired": "認証用の秘密情報を入力してください"
  },
  "confirmDelete": "サーバー {name} を削除しますか？この操作は取り消せません。",
  "confirmDeleteTitle": "サーバーを削除",
  "testing": "接続をテスト中…"
} as const;

export default servers;
