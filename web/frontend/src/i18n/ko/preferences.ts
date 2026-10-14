const preferences = {
  "pageTitle": "환경설정",
  "header": {
    "title": "환경설정",
    "subtitle": "프로필 및 계정 보안을 관리합니다"
  },
  "placeholders": {
    "phone": "010-0000-0000"
  },
  "profile": {
    "sectionTitle": "프로필",
    "labelDisplayName": "표시 이름",
    "labelPhone": "전화번호",
    "labelUsername": "사용자 이름",
    "labelRole": "역할",
    "btnSave": "프로필 저장"
  },
  "password": {
    "sectionTitle": "비밀번호 변경",
    "disabledNotice": "LUXIPANEL에서는 비밀번호 변경이 비활성화되어 있습니다. 서버 관리자에게 문의하세요."
  },
  "passkeys": {
    "sectionTitle": "Passkeys",
    "sectionSubtitle": "생체 인증 / FIDO2",
    "btnAdd": "Passkey 추가",
    "emptyState": "아직 등록된 패스키가 없습니다"
  },
  "recoveryCodes": {
    "sectionTitle": "복구 코드",
    "sectionSubtitle": "기기 접근을 잃었을 때 사용하세요",
    "btnRegenerate": "재생성",
    "loading": "로딩 중...",
    "warning": "이 코드를 안전한 곳에 보관하세요. 한 번만 표시됩니다.",
    "btnCopy": "전체 복사",
    "btnPrint": "인쇄"
  },
  "twoFactor": {
    "sectionTitle": "2단계 인증 (2FA)",
    "sectionSubtitle": "추가 코드로 계정을 보호하세요",
    "badgeDisabled": "비활성화됨",
    "enabledDescription": "귀하의 계정은 2단계 인증으로 보호되고 있습니다. 로그인할 때마다 인증 앱의 코드가 필요합니다.",
    "btnEnable": "2FA 활성화",
    "btnDisable": "2FA 비활성화"
  },
  "auditLog": {
    "sectionTitle": "최근 활동",
    "emptyState": "기록된 활동 없음"
  },
  "dialogRegenCodes": {
    "title": "코드를 재생성하시겠습니까?",
    "body": "이전 코드는 무효화됩니다. 이 작업은 취소할 수 없습니다.",
    "btnCancel": "취소",
    "btnConfirm": "재생성"
  },
  "dialogSetup2fa": {
    "title": "2단계 인증 활성화",
    "subtitle": "인증 앱(Google Authenticator, Authy 등)으로 이 QR 코드를 스캔하세요",
    "manualEntryLabel": "스캔할 수 없는 경우 수동으로 입력하세요:",
    "titleCopySecret": "복사",
    "verifyCodeLabel": "확인을 위해 6자리 코드를 입력하세요:",
    "btnCancel": "취소",
    "btnConfirm": "2FA 활성화"
  },
  "dialogDisable2fa": {
    "title": "2FA를 비활성화하시겠습니까?",
    "body": "계정 보안이 약화됩니다. 언제든지 다시 활성화할 수 있습니다.",
    "btnCancel": "취소",
    "btnConfirm": "2FA 비활성화"
  },
  "toasts": {
    "profileUpdated": "프로필 업데이트됨",
    "errorUpdate": "업데이트 오류",
    "passwordUpdated": "비밀번호 변경됨",
    "passkeyDeleted": "Passkey 삭제됨",
    "error": "오류",
    "registrationCancelled": "등록 취소됨",
    "passkeyRegistered": "Passkey가 성공적으로 등록되었습니다",
    "registrationCancelledByUser": "사용자가 등록을 취소했습니다",
    "codesCopied": "코드가 클립보드에 복사됨",
    "secretCopied": "시크릿이 클립보드에 복사됨",
    "twoFaActivated": "2FA가 성공적으로 활성화됨",
    "twoFaDeactivated": "2FA 비활성화됨"
  },
  "errors": {
    "passwordMismatch": "비밀번호가 일치하지 않습니다",
    "passwordTooShort": "비밀번호는 최소 8자 이상이어야 합니다",
    "passwordChangeError": "비밀번호 변경 오류",
    "passkeyNotSupported": "브라우저가 Passkey를 지원하지 않습니다. 최신 Chrome, Firefox, Safari 또는 Edge를 사용하세요.",
    "passkeyInitFailed": "등록을 시작할 수 없습니다",
    "passkeyFinishError": "등록 완료 오류",
    "generateCodesError": "코드 생성 오류",
    "twoFaSetupError": "2FA 설정 시작 오류",
    "enterSixDigits": "코드 6자리를 입력하세요",
    "invalidCode": "잘못된 코드",
    "twoFaDeactivateError": "2FA 비활성화 오류",
    "genericWithMessage": "오류: {message}"
  },
  "labels": {
    "passkeyRegistered": "{date}에 등록됨",
    "hasActiveCodes": "활성 복구 코드가 있습니다.",
    "noActiveCodes": "활성 복구 코드가 없습니다.",
    "notAvailable": "사용 불가",
    "codesGenerated": "{count}개의 코드가 생성되었습니다. 안전한 곳에 보관하세요.",
    "printTitle": "복구 코드 — LUXIPANEL",
    "printWarning": "이 코드를 안전한 곳에 보관하세요. 각 코드는 한 번만 사용할 수 있습니다.",
    "twoFaBadgeEnabled": "활성화됨",
    "twoFaBadgeDisabled": "비활성화됨"
  },
  "confirm": {
    "deletePasskey": "이 Passkey를 삭제하시겠습니까?",
    "deletePasskeyTitle": "Passkey 삭제"
  },
  "actions": {
    "login": "로그인",
    "logout": "로그아웃",
    "passwordChange": "비밀번호 변경",
    "passkeyRegister": "Passkey 등록됨",
    "passkeyDelete": "Passkey 삭제됨",
    "recoveryCodeUsed": "복구 코드 사용됨",
    "profileUpdate": "프로필 업데이트됨",
    "twoFaEnabled": "2FA 활성화됨",
    "twoFaDisabled": "2FA 비활성화됨",
    "activateTwoFa": "2FA 활성화"
  }
} as const;

export default preferences;
