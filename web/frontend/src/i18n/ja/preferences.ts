const preferences = {
  "pageTitle": "個人設定",
  "header": {
    "title": "個人設定",
    "subtitle": "プロフィールとアカウントのセキュリティを管理します"
  },
  "placeholders": {
    "phone": "090-0000-0000"
  },
  "profile": {
    "sectionTitle": "プロフィール",
    "labelDisplayName": "表示名",
    "labelPhone": "電話番号",
    "labelUsername": "ユーザー名",
    "labelRole": "ロール",
    "btnSave": "プロフィールを保存"
  },
  "password": {
    "sectionTitle": "パスワードを変更",
    "disabledNotice": "LUXIPANELではパスワードの変更が無効になっています。サーバー管理者に連絡してください。"
  },
  "passkeys": {
    "sectionTitle": "Passkeys",
    "sectionSubtitle": "生体認証 / FIDO2",
    "btnAdd": "Passkey を追加",
    "emptyState": "まだパスキーが登録されていません"
  },
  "recoveryCodes": {
    "sectionTitle": "リカバリーコード",
    "sectionSubtitle": "デバイスへのアクセスを失った場合に使用してください",
    "btnRegenerate": "再生成",
    "loading": "読み込み中...",
    "warning": "これらのコードを安全な場所に保管してください。一度しか表示されません。",
    "btnCopy": "すべてコピー",
    "btnPrint": "印刷"
  },
  "twoFactor": {
    "sectionTitle": "二段階認証（2FA）",
    "sectionSubtitle": "追加コードでアカウントを保護する",
    "badgeDisabled": "無効",
    "enabledDescription": "アカウントは二段階認証で保護されています。ログインのたびに認証アプリのコードが必要になります。",
    "btnEnable": "2FA を有効化",
    "btnDisable": "2FA を無効化"
  },
  "auditLog": {
    "sectionTitle": "最近のアクティビティ",
    "emptyState": "記録されたアクティビティなし"
  },
  "dialogRegenCodes": {
    "title": "コードを再生成しますか？",
    "body": "以前のコードは無効になります。この操作は元に戻せません。",
    "btnCancel": "キャンセル",
    "btnConfirm": "再生成"
  },
  "dialogSetup2fa": {
    "title": "二段階認証を有効にする",
    "subtitle": "認証アプリ（Google Authenticator、Authyなど）でこのQRコードをスキャンしてください",
    "manualEntryLabel": "スキャンできない場合は手動で入力してください：",
    "titleCopySecret": "コピー",
    "verifyCodeLabel": "確認のため6桁のコードを入力してください：",
    "btnCancel": "キャンセル",
    "btnConfirm": "2FA を有効化"
  },
  "dialogDisable2fa": {
    "title": "2FAを無効にしますか？",
    "body": "アカウントのセキュリティが低下します。いつでも再度有効にできます。",
    "btnCancel": "キャンセル",
    "btnConfirm": "2FA を無効化"
  },
  "toasts": {
    "profileUpdated": "プロフィールを更新しました",
    "errorUpdate": "更新エラー",
    "passwordUpdated": "パスワードを更新しました",
    "passkeyDeleted": "Passkeyを削除しました",
    "error": "エラー",
    "registrationCancelled": "登録をキャンセルしました",
    "passkeyRegistered": "Passkeyを登録しました",
    "registrationCancelledByUser": "ユーザーが登録をキャンセルしました",
    "codesCopied": "コードをクリップボードにコピーしました",
    "secretCopied": "シークレットをクリップボードにコピーしました",
    "twoFaActivated": "2FAを有効化しました",
    "twoFaDeactivated": "2FAを無効化しました"
  },
  "errors": {
    "passwordMismatch": "パスワードが一致しません",
    "passwordTooShort": "パスワードは8文字以上必要です",
    "passwordChangeError": "パスワード変更エラー",
    "passkeyNotSupported": "お使いのブラウザはPasskeyに対応していません。最新のChrome、Firefox、Safari、Edgeをご利用ください。",
    "passkeyInitFailed": "登録を開始できませんでした",
    "passkeyFinishError": "登録の完了に失敗しました",
    "generateCodesError": "コードの生成に失敗しました",
    "twoFaSetupError": "2FA設定の開始に失敗しました",
    "enterSixDigits": "6桁のコードを入力してください",
    "invalidCode": "無効なコード",
    "twoFaDeactivateError": "2FAの無効化に失敗しました",
    "genericWithMessage": "エラー: {message}"
  },
  "labels": {
    "passkeyRegistered": "{date} に登録済み",
    "hasActiveCodes": "有効な回復コードがあります。",
    "noActiveCodes": "有効な回復コードがありません。",
    "notAvailable": "利用不可",
    "codesGenerated": "{count}件のコードを生成しました。安全な場所に保管してください。",
    "printTitle": "回復コード — LUXIPANEL",
    "printWarning": "これらのコードを安全な場所に保管してください。各コードは1回のみ使用できます。",
    "twoFaBadgeEnabled": "有効",
    "twoFaBadgeDisabled": "無効"
  },
  "confirm": {
    "deletePasskey": "このPasskeyを削除しますか？",
    "deletePasskeyTitle": "Passkeyを削除"
  },
  "actions": {
    "login": "ログイン",
    "logout": "ログアウト",
    "passwordChange": "パスワード変更",
    "passkeyRegister": "Passkey登録",
    "passkeyDelete": "Passkey削除",
    "recoveryCodeUsed": "回復コードを使用",
    "profileUpdate": "プロフィール更新",
    "twoFaEnabled": "2FA有効化",
    "twoFaDisabled": "2FA無効化",
    "activateTwoFa": "2FAを有効化"
  }
} as const;

export default preferences;
