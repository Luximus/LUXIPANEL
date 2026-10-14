const login = {
  "pageTitle": "로그인",
  "panelSubtitle": "관리자 패널",
  "authError": "인증 오류",
  "forgotPassword": "비밀번호를 잊으셨나요",
  "forgotHint": "이메일을 입력하시면 비밀번호 변경 링크를 보내드립니다.",
  "backToLogin": "로그인으로 돌아가기",
  "recoverLinkSent": "해당 이메일이 존재하면 복구 링크를 보냈습니다.",
  "recoverLinkError": "복구 링크를 보낼 수 없습니다.",
  "languageLabel": "언어",
  "hostLabelFallback": "이 패널",
  "tabs": {
    "password": "비밀번호",
    "passkey": "Passkey",
    "recovery": "복구"
  },
  "labels": {
    "user": "사용자",
    "password": "비밀번호",
    "sshPassphrase": "SSH 키 Passphrase",
    "remember": "로그인 상태 유지",
    "email": "이메일",
    "recoveryCode": "복구 코드",
    "code6Digits": "6자리 코드"
  },
  "placeholders": {
    "user": "admin",
    "email": "user@example.com",
    "password": "********",
    "sshPassphrase": "SSH 키의 Passphrase",
    "recoveryCode": "XXXX-XXXX-XXXX",
    "totp": "000000"
  },
  "text": {
    "biometricAuth": "생체 인증",
    "biometricHelp": "Face ID, 지문 또는 보안 키를 사용하세요",
    "usePasskey": "Passkey 사용",
    "signIn": "로그인",
    "sendRecoveryLink": "복구 링크 보내기",
    "recoveryWarning": "기기에 접근할 수 없는 경우 일회용 복구 코드를 사용하세요.",
    "verifyCode": "코드 확인",
    "twoFactorTitle": "2단계 인증",
    "twoFactorHelp": "인증 앱의 코드를 입력하세요",
    "verify": "확인",
    "footer": "LuxiPanel v2.0 - 안전한 메일 관리"
  },
  "errors": {
    "captchaRequired": "hCaptcha 검증을 완료하세요.",
    "enterEmail": "이메일을 입력하세요",
    "browserNoPasskey": "사용 중인 브라우저가 Passkey를 지원하지 않습니다. 최신 Chrome, Firefox, Safari 또는 Edge를 사용하세요.",
    "passkeyOptionsFailed": "인증 옵션을 가져올 수 없습니다",
    "passkeyCanceled": "인증이 취소되었습니다",
    "passkeyCanceledByUser": "사용자가 인증을 취소했습니다",
    "passkeyError": "passkey 오류",
    "enterUserRecoveryCode": "사용자와 복구 코드를 입력하세요",
    "enterTotp6Digits": "코드의 6자리를 입력하세요",
    "invalidTotpCode": "잘못된 2FA 코드"
  },
  "status": {
    "passkeyInit": "인증을 시작하는 중...",
    "passkeyWaiting": "passkey를 기다리는 중...",
    "passkeyVerifying": "확인하는 중..."
  },
  "authErrors": {
    "AUTH_ERROR": "인증 오류입니다.",
    "NO_SSH_KEY": "이 패널의 이 사용자에 연결된 SSH 키가 없습니다.",
    "PANEL_UNRESOLVED": "접근 패널을 확인할 수 없습니다.",
    "PANEL_NO_IP": "패널에 IP가 설정되어 있지 않습니다.",
    "USER_PROVISION_FAILED": "패널에서 사용자를 프로비저닝할 수 없습니다.",
    "ACCOUNT_DISABLED": "계정이 비활성화되었습니다.",
    "ACCOUNT_NOT_FOUND": "계정을 찾을 수 없거나 비활성화되었습니다.",
    "USER_NOT_FOUND": "사용자를 찾을 수 없습니다.",
    "TWO_FA_REQUIRED": "이 계정은 2FA가 필요합니다. 로그인하기 전에 설정 › 보안에서 구성하세요.",
    "INVALID_PASSPHRASE": "Passphrase가 올바르지 않습니다.",
    "PASSPHRASE_REQUIRED": "사용자의 passphrase를 입력해야 합니다.",
    "PASSPHRASE_VERIFY_FAILED": "서버에 대해 비밀번호를 확인할 수 없습니다.",
    "SERVER_SSH_KEY_MISSING": "서버의 SSH 키가 설정되어 있지 않습니다.",
    "PANEL_SSH_KEY_REJECTED": "패널의 SSH 키가 서버에서 허용되지 않습니다.",
    "SSH_CONNECT_FAILED": "SSH 서버에 연결할 수 없습니다.",
    "SSH_CONNECTION_CLOSED": "SSH 연결이 예기치 않게 종료되었습니다.",
    "PASSWORD_LOGIN_DISABLED": "비밀번호 로그인이 비활성화되어 있습니다.",
    "PASSKEY_LOGIN_DISABLED": "passkey 로그인이 비활성화되어 있습니다.",
    "RECOVERY_LOGIN_DISABLED": "복구 코드 로그인이 비활성화되어 있습니다.",
    "PASSKEY_INVALID": "잘못된 passkey입니다.",
    "INVALID_AUTH_RESPONSE": "잘못된 인증 응답입니다.",
    "INVALID_TOTP": "잘못된 TOTP 코드입니다.",
    "CAPTCHA_REQUIRED": "captcha 확인이 필요합니다.",
    "CAPTCHA_FAILED": "captcha 확인에 실패했습니다."
  }
} as const;

export default login;
