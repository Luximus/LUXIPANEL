const login = {
  "pageTitle": "ログイン",
  "panelSubtitle": "管理パネル",
  "authError": "認証エラー",
  "forgotPassword": "パスワードを忘れた場合",
  "forgotHint": "メールアドレスを入力すると、パスワードを変更するためのリンクをお送りします。",
  "backToLogin": "ログインに戻る",
  "recoverLinkSent": "メールアドレスが存在する場合は、リカバリーリンクを送信しました。",
  "recoverLinkError": "リカバリーリンクを送信できませんでした。",
  "languageLabel": "言語",
  "hostLabelFallback": "このパネル",
  "tabs": {
    "password": "パスワード",
    "passkey": "Passkey",
    "recovery": "リカバリー"
  },
  "labels": {
    "user": "ユーザー",
    "password": "パスワード",
    "sshPassphrase": "SSH 鍵のパスフレーズ",
    "remember": "ログイン状態を保持する",
    "email": "メールアドレス",
    "recoveryCode": "リカバリーコード",
    "code6Digits": "6桁のコード"
  },
  "placeholders": {
    "user": "admin",
    "email": "user@example.com",
    "password": "********",
    "sshPassphrase": "SSH 鍵のパスフレーズ",
    "recoveryCode": "XXXX-XXXX-XXXX",
    "totp": "000000"
  },
  "text": {
    "biometricAuth": "生体認証",
    "biometricHelp": "Face ID、指紋、またはセキュリティキーを使用します",
    "usePasskey": "Passkey を使用",
    "signIn": "ログイン",
    "sendRecoveryLink": "リカバリーリンクを送信",
    "recoveryWarning": "デバイスへのアクセスを失った場合は、使い捨てのリカバリーコードを使用してください。",
    "verifyCode": "コードを確認",
    "twoFactorTitle": "2段階認証",
    "twoFactorHelp": "認証アプリのコードを入力してください",
    "verify": "確認",
    "footer": "LuxiPanel v2.0 - セキュアメール管理"
  },
  "errors": {
    "captchaRequired": "hCaptcha チャレンジを完了してください。",
    "enterEmail": "メールアドレスを入力してください",
    "browserNoPasskey": "お使いのブラウザは Passkey に対応していません。最新の Chrome、Firefox、Safari、または Edge をご利用ください。",
    "passkeyOptionsFailed": "認証オプションを取得できませんでした",
    "passkeyCanceled": "認証がキャンセルされました",
    "passkeyCanceledByUser": "ユーザーによって認証がキャンセルされました",
    "passkeyError": "passkey エラー",
    "enterUserRecoveryCode": "ユーザー名とリカバリーコードを入力してください",
    "enterTotp6Digits": "6桁のコードを入力してください",
    "invalidTotpCode": "2FA コードが無効です"
  },
  "status": {
    "passkeyInit": "認証を開始しています...",
    "passkeyWaiting": "passkey を待機しています...",
    "passkeyVerifying": "確認しています..."
  },
  "authErrors": {
    "AUTH_ERROR": "認証エラーです。",
    "NO_SSH_KEY": "このパネルには、このユーザーに関連付けられた SSH 鍵がありません。",
    "PANEL_UNRESOLVED": "アクセス先のパネルを特定できませんでした。",
    "PANEL_NO_IP": "パネルに IP が設定されていません。",
    "USER_PROVISION_FAILED": "パネルでユーザーをプロビジョニングできませんでした。",
    "ACCOUNT_DISABLED": "アカウントは無効化されています。",
    "ACCOUNT_NOT_FOUND": "アカウントが見つからないか、無効化されています。",
    "USER_NOT_FOUND": "ユーザーが見つかりません。",
    "TWO_FA_REQUIRED": "このアカウントには 2FA が必要です。ログインする前に、設定 › セキュリティ から設定してください。",
    "INVALID_PASSPHRASE": "パスフレーズが正しくありません。",
    "PASSPHRASE_REQUIRED": "ユーザーのパスフレーズを入力してください。",
    "PASSPHRASE_VERIFY_FAILED": "サーバーに対してパスワードを検証できませんでした。",
    "SERVER_SSH_KEY_MISSING": "サーバーの SSH 鍵が設定されていません。",
    "PANEL_SSH_KEY_REJECTED": "パネルの SSH 鍵がサーバーに受け入れられませんでした。",
    "SSH_CONNECT_FAILED": "SSH サーバーに接続できませんでした。",
    "SSH_CONNECTION_CLOSED": "SSH 接続が予期せず終了しました。",
    "PASSWORD_LOGIN_DISABLED": "パスワードによるログインは無効化されています。",
    "PASSKEY_LOGIN_DISABLED": "passkey によるログインは無効化されています。",
    "RECOVERY_LOGIN_DISABLED": "リカバリーコードによるログインは無効化されています。",
    "PASSKEY_INVALID": "passkey が無効です。",
    "INVALID_AUTH_RESPONSE": "認証レスポンスが無効です。",
    "INVALID_TOTP": "TOTP コードが無効です。",
    "CAPTCHA_REQUIRED": "captcha 認証が必要です。",
    "CAPTCHA_FAILED": "captcha 認証に失敗しました。"
  }
} as const;

export default login;
