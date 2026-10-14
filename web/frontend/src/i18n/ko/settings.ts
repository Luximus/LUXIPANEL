const settings = {
  "passkeyName": {
    "title": "패스키 이름",
    "hint": "기기를 쉽게 알아볼 수 있는 이름을 사용하세요.",
    "placeholder": "예: 개인 노트북",
    "save": "이름 저장",
    "edit": "이름 수정",
    "invalid": "1~128자의 이름을 입력하세요.",
    "saved": "이름이 수정되었습니다",
    "error": "이름을 저장하지 못했습니다.",
    "cancel": "취소"
},
  "placeholders": {
    "logoUrl": "https://example.com/logo.png",
    "imageUrl": "https://…/image.jpg"
  },
  "pageTitle": "설정",
  "loadFailure": {
    "title": "설정을 불러오지 못했습니다",
    "sessionMessage": "설정을 불러오지 못했습니다: 서버와의 세션을 사용할 수 없습니다. 선택기에서 서버를 다시 선택하거나 로그아웃한 뒤 다시 로그인하세요.",
    "genericMessage": "설정을 불러오지 못했습니다. 연결을 확인하고 다시 시도하세요.",
    "retry": "다시 시도"
  },
  "header": {
    "title": "패널 설정",
    "subtitle": "LUXIPANEL 전역 설정",
    "autosave": "자동 저장"
  },
  "tabs": {
    "general": "일반",
    "layoutUi": "레이아웃/UI",
    "security": "보안",
    "modules": "모듈",
    "system": "시스템",
    "credentials": "자격 증명"
  },
  "credentials": {
    "hcaptcha": {
      "title": "hCaptcha",
      "desc": "hCaptcha 검증으로 패널 로그인을 보호하세요. hCaptcha 대시보드의 키를 입력하세요.",
      "sitekeyLabel": "사이트 키",
      "sitekeyPlaceholder": "hCaptcha 사이트 키",
      "secretLabel": "시크릿 키",
      "secretPlaceholder": "새 시크릿 키 입력",
      "secretConfigured": "시크릿 키가 이미 설정되어 있습니다. 유지하려면 이 칸을 비워 두세요.",
      "statusConfigured": "구성됨",
      "statusMissing": "미구성",
      "saved": "hCaptcha 설정이 저장되었습니다"
    },
    "tolqia": {
      "label": "Tolqia",
      "help": "Tolqia 계정(Plus 또는 Premium 요금제)의 API 토큰 — 이 서버 사용자에게 번역 통화를 활성화합니다",
      "guide": {
        "steps": [
          "tolqia.com에 접속해 계정(Plus 또는 Premium 요금제)으로 로그인하세요.",
          "「설정」›「API」를 열고 새 토큰을 만드세요.",
          "토큰(tq_live_ 로 시작)을 복사해 「구성」에 붙여넣으세요."
        ],
        "docUrl": "https://tolqia.com/settings/api",
        "docLabel": "tolqia.com에서 토큰 만들기 → 설정 › API",
        "docUrl2": "https://tolqia.com/docs",
        "docLabel2": "문서"
      }
    },
    "elevenlabs": {
      "label": "ElevenLabs",
      "help": "음성 통화의 실시간 번역에 사용됩니다",
      "voiceIdLabel": "기본 Voice ID",
      "voiceIdPlaceholder": "예: 21m00Tcm4TlvDq8ikWAM",
      "guide": {
        "steps": [
          "elevenlabs.io에 접속해 로그인하세요.",
          "「My Account」 → 「API Keys」를 열고 새 키를 생성하세요.",
          "키(sk_로 시작)를 복사해 「구성」 탭에 붙여넣으세요."
        ],
        "docUrl": "https://elevenlabs.io/app/settings/api-keys",
        "docLabel": "ElevenLabs API 키"
      }
    },
    "title": "모듈 자격 증명",
    "subtitle": "모듈이 작동하는 데 필요한 액세스 토큰 및 API 키를 관리합니다.",
    "empty": "이 서버에서 자격 증명이 필요한 모듈이 활성화되어 있지 않습니다.",
    "statusSet": "구성됨",
    "statusMissing": "구성되지 않음",
    "tokenLabel": "액세스 토큰 / API 키",
    "tokenPlaceholder": "토큰을 붙여넣기…",
    "save": "저장",
    "test": "테스트",
    "clear": "제거",
    "manage": "관리",
    "show": "표시",
    "hide": "숨기기",
    "saved": "자격 증명이 저장되었습니다",
    "cleared": "자격 증명이 제거되었습니다",
    "testOk": "연결 유효",
    "testFail": "자격 증명을 검증할 수 없습니다",
    "confirmClear": "이 자격 증명을 제거하시겠습니까?",
    "confirmClearTitle": "자격 증명 제거",
    "error": "오류가 발생했습니다",
    "getDoc": "토큰 가져오기",
    "managedLabel": {
      "assistant": "AI 에이전트"
    },
    "managedHint": {
      "assistant": "어시스턴트 공급자 API 키는 해당 패널에서 관리됩니다.",
      "backups": "스토리지 키(S3 / R2)는 백업 모듈에서 관리됩니다."
    },
    "managedSummary": {
      "assistant": "AI 공급자(Claude, OpenAI, Gemini, …)",
      "backups": "S3 / R2 스토리지 자격 증명"
    },
    "storage": {
      "accountId": "계정 ID(Cloudflare)",
      "accessKeyId": "액세스 키 ID",
      "secret": "비밀 액세스 키",
      "endpoint": "엔드포인트(선택 사항)",
      "region": "리전(선택 사항)",
      "r2Hint": "계정 수준 R2 자격 증명은 백업에서 재사용할 수 있습니다. 여기에서 키를 한 번 설정하고 백업에서 버킷만 선택하세요.",
      "s3Hint": "S3 자격 증명은 백업에서 재사용할 수 있습니다. 여기에서 키를 한 번 설정하고 백업에서 버킷만 선택하세요."
    },
    "connector": {
      "connect": "저장 및 연결",
      "disconnect": "연결 끊기",
      "connected": "연결됨",
      "configured": "구성됨",
      "notConnected": "연결되지 않음",
      "unavailable": "AI 에이전트 모듈이 활성화되어야 합니다",
      "setupGuide": "설정 가이드"
    },
    "help": {
      "tabConfig": "구성",
      "tabHelp": "도움말",
      "openLink": "링크 열기",
      "guides": {
        "cloudflare": {
          "steps": [
            "dash.cloudflare.com → «내 프로필» → «API 토큰»으로 이동합니다.",
            "«토큰 만들기»를 클릭합니다. «DNS 영역 편집» 템플릿을 사용하거나 필요한 권한(영역:읽기, DNS:편집 등)으로 맞춤형 토큰을 만드세요.",
            "접근을 허용할 영역을 선택하고 토큰을 만드세요.",
            "토큰을 복사하여(한 번만 표시됨) «구성» 탭에 붙여넣으세요."
          ],
          "docUrl": "https://dash.cloudflare.com/profile/api-tokens",
          "docLabel": "Cloudflare API 토큰"
        },
        "expo": {
          "steps": [
            "expo.dev에 로그인 → «Account settings» → «Access tokens»으로 이동합니다.",
            "«Create token»을 클릭하고 이름을 지정한 후 생성된 값을 복사합니다.",
            "«구성» 탭에 붙여넣으세요."
          ],
          "docUrl": "https://expo.dev/settings/access-tokens",
          "docLabel": "Expo 액세스 토큰"
        },
        "openclaw": {
          "steps": [
            "openclaw.ai에 로그인합니다.",
            "OpenClaw 패널에서 API 키를 생성하거나 복사합니다.",
            "«구성»에 붙여넣으세요 (엔드포인트와 기본 모델이 다른 경우 조정하세요)."
          ],
          "docUrl": "https://openclaw.ai",
          "docLabel": "OpenClaw"
        },
        "repository-store": {
          "steps": [
            "github.com → «Settings» → «Developer settings» → «Personal access tokens»으로 이동합니다.",
            "저장소 읽기 권한(public_repo 또는 Contents: Read)이 있는 토큰(classic 또는 fine-grained)을 생성합니다.",
            "토큰(ghp_ 또는 github_pat_으로 시작)을 복사하여 «구성»에 붙여넣으세요."
          ],
          "docUrl": "https://github.com/settings/tokens",
          "docLabel": "GitHub 토큰"
        },
        "bitninja": {
          "steps": [
            "BitNinja 패널(admin.bitninja.io)에 로그인합니다.",
            "라이선스/서버 섹션에서 라이선스 키를 복사합니다.",
            "«구성»에 붙여넣으세요."
          ],
          "docUrl": "https://bitninja.io",
          "docLabel": "BitNinja"
        },
        "r2": {
          "steps": [
            "dash.cloudflare.com → «R2» → «Manage R2 API Tokens»으로 이동합니다.",
            "객체 읽기/쓰기 권한이 있는 «R2 API Token»(S3 호환)을 만드세요.",
            "표시된 Access Key ID와 Secret Access Key를 복사합니다.",
            "Account ID는 R2 페이지/계정 요약에서 확인할 수 있습니다.",
            "Account ID + Access Key ID + Secret을 «구성»에 붙여넣으세요 (엔드포인트는 Account ID에서 자동으로 도출됩니다)."
          ],
          "docUrl": "https://dash.cloudflare.com/?to=/:account/r2/api-tokens",
          "docLabel": "R2 API 토큰"
        },
        "s3": {
          "steps": [
            "AWS 콘솔에서: «IAM» → «Users» → 내 사용자 → «Security credentials» → «Create access key».",
            "Access Key ID와 Secret Access Key를 복사합니다.",
            "S3 호환 서비스(Wasabi, MinIO 등)를 사용하는 경우 엔드포인트와 리전을 기록해 두세요.",
            "키(그리고 해당되는 경우 엔드포인트/리전)를 «구성»에 붙여넣으세요."
          ],
          "docUrl": "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html",
          "docLabel": "AWS 액세스 키"
        }
      }
    }
  },
  "general": {
    "hcaptchaEnabled": "로그인 시 hCaptcha 요구",
    "hcaptchaEnabledHint": "패널 로그인 양식에 hCaptcha 검증을 표시합니다.",
    "sectionTitle": "일반",
    "labelPanelName": "패널 이름",
    "labelTimezone": "시간대",
    "labelLanguage": "언어",
    "languageOptions": {
      "en": "English",
      "es": "Español"
    },
    "labelSessionTtl": "세션 유지 시간 (시간)",
    "labelMaxLoginAttempts": "로그인 실패 시도 횟수 (잠금)",
    "labelRequire2fa": "모든 사용자에게 2FA 요구",
    "btnViewLog": "로그 보기",
    "labelAuditLog": "감사 로그 활성화",
    "labelSwitchNewTab": "서버 전환 시 새 탭에서 열기"
  },
  "imageList": {
    "labelJson": "(JSON)",
    "labelUrls": "(이미지 URL)",
    "addButton": "이미지 추가"
  },
  "layout": {
    "sectionTitle": "레이아웃, 브랜딩 및 UI",
    "sectionSubtitle": "프론트엔드의 로고, 반경, 그림자 및 기본 색상을 사용자 지정합니다.",
    "branding": {
      "groupTitle": "브랜딩 및 로고",
      "groupDesc": "사이드바, 로그인, 헤더, 푸터, 파비콘에 적용되는 단일 로고.",
      "labelLogoUrl": "로고 URL",
      "logoUrlHelp": "사이드바, 로그인, 패널 헤더, 푸터, 공개 화면 등 모든 곳에서 사용되는 단일 로고입니다.",
      "btnUpload": "업로드",
      "btnPick": "선택",
      "btnDefault": "기본값",
      "restoreLogos": "로고 초기화",
      "loginLogoOpacity": "로그인 로고 컨테이너 불투명도",
      "loginLogoOpacityHelp": "/login 로고 원형 배경의 투명도 (0=투명, 100=불투명)."
    },
    "loginBg": {
      "groupTitle": "로그인 배경",
      "groupDesc": "/login 페이지의 애니메이션 배경과 대체 색상.",
      "enableLabel": "/login에 애니메이션 배경 표시",
      "labelFallbackColor": "비활성화 시 배경색",
      "labelActiveEffect": "/login의 활성 효과",
      "previewTitle": "로그인 미리보기"
    },
    "shape": {
      "groupTitle": "형태 및 그림자",
      "groupDesc": "전역 반경, 카드 및 모달 그림자.",
      "labelRadius": "전역 반경",
      "radiusHelp": "예: 0.5rem, 12px.",
      "labelShadow": "기본 그림자",
      "labelModalShadow": "모달 그림자",
      "labelModalBackdrop": "모달 오버레이",
      "backdropHelp": "다이얼로그 배경.",
      "layer1": "레이어 1",
      "layer2": "레이어 2",
      "labelColor": "색상",
      "labelShadowSingle": "그림자"
    },
    "palettes": {
      "title": "색상 테마",
      "subtitle": "미리 정의된 팔레트를 선택하면 패널 전체(라이트/다크)에 적용됩니다.",
      "light": "라이트 테마",
      "dark": "다크 테마",
      "intensity": "강도"
    },
    "resetButton": "스타일을 기본값으로 재설정",
    "panelBg": {
      "groupTitle": "패널 배경",
      "groupDesc": "패널 내부의 애니메이션 배경과 대체 색상.",
      "enableLabel": "패널에 애니메이션 배경 표시",
      "labelFallbackColor": "비활성화 시 배경 색상",
      "labelActiveEffect": "패널 활성 효과"
    }
  },
  "security": {
    "sectionTitle": "보안",
    "loginMethodsTitle": "허용된 로그인 방법",
    "loginMethodsDesc": "최소 하나의 방법은 활성 상태로 유지해야 합니다. 비활성화된 방법은 로그인 화면에 표시되지 않습니다.",
    "loginMethodsWarning": "최소 하나의 방법은 활성 상태로 유지해야 합니다.",
    "passkey": {
      "name": "Passkey",
      "desc": "생체 인증 / FIDO2. 사용자가 기기를 등록해야 합니다.",
      "verifying": "확인 중...",
      "btnManage": "관리"
    },
    "password": {
      "name": "비밀번호",
      "desc": "사용자 이름과 비밀번호로 로그인합니다. 사전 설정 없이 항상 사용 가능합니다.",
      "configured": "설정됨"
    },
    "recovery": {
      "name": "복구",
      "desc": "비상 백업용 일회성 코드.",
      "verifying": "확인 중...",
      "btnManage": "관리"
    },
    "twoFaStatus": {
      "groupTitle": "이 계정의 2FA 상태",
      "badgeDisabled": "비활성화됨",
      "promptText": "이 관리자 계정을 보호하려면 2FA를 활성화하세요.",
      "btnSetup": "설정",
      "btnDelete": "삭제",
      "btnDisable": "비활성화"
    }
  },
  "modules": {
    "sectionTitle": "모듈별 캐시 엔진",
    "sectionDesc1": "고객 서버에서 예약된 수집의 상태 및 조정.",
    "sectionDescBold": "활성/비활성은 상위 모듈에서 파생됩니다",
    "modulesLink": "모듈",
    "sectionDesc2": ": 모듈을 비활성화하면 수집이 중단되고, 재활성화하면 다시 예약됩니다. 여기서는 빈도만 조정합니다. DataTable은 해당 서버의 전용 Redis에서 사전 형성된 데이터를 읽습니다. 꺼져 있거나 너무 오래된 경우 일반 JSON으로 대체됩니다.",
    "loading": "불러오는 중…",
    "tableHeaders": {
      "module": "모듈 / 컬렉션",
      "source": "출처",
      "active": "활성",
      "interval": "간격 (초)",
      "lastRefresh": "마지막 갱신",
      "duration": "소요 시간",
      "size": "크기",
      "hitRatio": "적중률"
    },
    "managedInPre": " (관리 위치: ",
    "managedInPost": ")"
  },
  "system": {
    "factoryReset": {
      "sectionTitle": "설정 초기화",
      "sectionSubtitle": "패널 설정을 공장 기본값으로 복원합니다.",
      "warningTitle": "경고",
      "warningBefore": "이 작업은 ",
      "warningAllSettings": "모든 구성 설정",
      "warningMiddle": " (일반, 레이아웃/UI, SMTP, 보안 및 모듈이 저장한 환경설정)을 기본값으로 재설정합니다. 설치된 사용자 및 모듈 ",
      "warningNotDeleted": "삭제되지 않습니다",
      "warningAfter": ".",
      "btnReset": "공장 설정 초기화"
    },
    "backupRestore": {
      "sectionTitle": "백업에서 복원",
      "sectionSubtitle": "이전 백업에서 패널을 복원합니다 (Backups 모듈 필요).",
      "loading": "백업 불러오는 중...",
      "btnRestore": "선택한 백업 복원"
    },
    "noBackup": {
      "title": "백업에서 복원을 사용할 수 없습니다",
      "descBefore": "이 기능을 활성화하려면 모듈 패널에서 ",
      "backupsModule": "백업",
      "descAfter": " 모듈을 설치하세요."
    }
  },
  "imagePicker": {
    "title": "이미지 선택",
    "subtitle": "프론트엔드 공개 폴더에 있는 사용 가능한 이미지.",
    "empty": "공개 폴더에 이미지가 없습니다.",
    "btnUpload": "새 이미지 업로드",
    "btnCancel": "취소"
  },
  "smtpTest": {
    "dialogTitle": "테스트 이메일 전송",
    "labelRecipient": "수신자",
    "placeholderRecipient": "you@example.com",
    "btnCancel": "취소",
    "btnSend": "전송"
  },
  "passkeysDialog": {
    "title": "Passkey 관리",
    "btnAdd": "Passkey 추가",
    "empty": "등록된 passkey가 없습니다"
  },
  "recoveryDialog": {
    "title": "복구 코드",
    "btnGenerate": "생성 / 재생성",
    "loading": "불러오는 중...",
    "warningText": "이 코드를 안전한 곳에 보관하세요. 한 번만 표시됩니다.",
    "btnCopy": "전체 복사",
    "btnPrint": "인쇄"
  },
  "setup2faDialog": {
    "title": "2FA 설정",
    "subtitle": "인증 앱으로 이 QR 코드를 스캔하세요.",
    "secretLabel": "수동 시크릿:",
    "copyTitle": "복사",
    "verifyLabel": "6자리 코드를 입력하세요:",
    "btnCancel": "취소",
    "btnActivate": "2FA 활성화"
  },
  "disable2faDialog": {
    "title": "2FA를 비활성화하시겠습니까?",
    "body": "2FA가 비활성화되지만 비밀 키는 나중에 다시 활성화할 수 있도록 보존됩니다.",
    "btnCancel": "취소",
    "btnConfirm": "2FA 비활성화"
  },
  "delete2faDialog": {
    "title": "2FA를 삭제하시겠습니까?",
    "body": "저장된 비밀 키가 삭제되며 2FA를 다시 사용하려면 다시 설정해야 합니다.",
    "btnCancel": "취소",
    "btnConfirm": "2FA 삭제"
  },
  "auditLogDialog": {
    "title": "감사 로그",
    "empty": "기록된 활동 없음"
  },
  "modulesCache": {
    "agoSeconds": "{n}초 전",
    "agoMinutes": "{n}분 전",
    "agoHours": "{n}시간 전",
    "agoDays": "{n}일 전",
    "collectionSingular": "컬렉션",
    "collectionPlural": "컬렉션",
    "activeSingular": "활성",
    "activePlural": "활성",
    "enabledTitle": "클라이언트 서버 디스패처를 통한 예약 수집",
    "badgeEnabled": "활성",
    "disabledTitle": "상위 모듈이 /panel/modules에서 비활성화됨 — 수집이 일시 중지됩니다",
    "badgeDisabled": "비활성",
    "buttonSave": "저장",
    "saving": "저장 중…",
    "savedStatus": "{module}/{collection} 업데이트됨",
    "saveError": "{module}/{collection} 저장 오류: {message}",
    "loadedSummary": "{modules}개 모듈의 캐시 가능한 컬렉션 {count}개. 변경 사항은 다음 수집 주기(≤60초)에 적용됩니다.",
    "loadError": "오류: {message}"
  },
  "labels": {
    "auditLogin": "로그인",
    "auditLoginFailed": "로그인 실패 시도",
    "auditLogout": "로그아웃",
    "auditPasswordChange": "비밀번호 변경",
    "auditPasskeyRegister": "Passkey 등록",
    "auditPasskeyDelete": "Passkey 삭제",
    "auditRecoveryCodeUsed": "복구 코드 사용",
    "auditProfileUpdate": "프로필 업데이트",
    "auditSettingsUpdate": "설정 업데이트",
    "audit2faEnabled": "2FA 활성화",
    "audit2faDisabled": "2FA 비활성화",
    "auditEventDefault": "이벤트",
    "aiHintAnthropic": "권장 모델: claude-fable-5 (최신), claude-sonnet-4-6 (균형), claude-opus-4-6 (가장 강력)",
    "aiKeyHintAnthropic": "console.anthropic.com에서 API 키를 발급받으세요",
    "aiHintOpenai": "gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna",
    "aiKeyHintOpenai": "platform.openai.com에서 API 키를 발급받으세요",
    "aiHintOllama": "로컬 Ollama에 설치된 모델 이름. 도구를 지원하지 않습니다.",
    "aiKeyHintOllama": "로컬 Ollama는 API 키가 필요하지 않습니다",
    "managedByLp": "LP-LICENSE-SERVER에서 관리됨",
    "notAvailable": "사용 불가",
    "managedExternally": "외부에서 관리됨",
    "twoFaManagedByLp": "이 모드에서는 인증이 LP-LICENSE-SERVER에서 관리됩니다.",
    "licenseNoStatus": "상태 없음",
    "licenseActive": "활성",
    "licenseExpires": "{date}에 만료",
    "licenseActiveDesc": "라이선스 활성",
    "licenseDegraded": "저하됨",
    "licensePending": "대기 중",
    "licenseDegradedDesc": "라이선스를 검증할 수 없어 패널이 저하 모드로 실행 중입니다.",
    "licenseNotActivated": "라이선스가 아직 활성화되지 않았습니다.",
    "passkeyCount": "{count}개의 Passkey 등록됨",
    "noPasskeys": "등록된 Passkey 없음",
    "recoveryCodesGenerated": "복구 코드 생성됨",
    "noRecoveryCodes": "생성된 코드 없음",
    "passkeyRegistered": "{date}에 등록됨",
    "recoveryCodesActive": "활성화된 복구 코드가 있습니다.",
    "recoveryCodesNone": "활성화된 복구 코드가 없습니다.",
    "recoveryCodesDisplayed": "{count}개의 코드가 생성되었습니다. 안전한 장소에 보관하세요.",
    "twoFaEnabled": "활성화됨",
    "twoFaEnabledDesc": "다음 로그인 시 이 2FA가 요청됩니다. 비밀 키를 삭제하지 않고 비활성화할 수 있습니다.",
    "twoFaDisabled": "비활성화됨",
    "twoFaDisabledDesc": "비밀 키는 저장되어 있지만 다시 활성화할 때까지 로그인 시 요청되지 않습니다.",
    "twoFaSetupPrompt": "관리자 계정을 보호하려면 2FA를 활성화하세요.",
    "printRecoveryCodesTitle": "복구 코드 - LUXIPANEL",
    "printRecoveryCodesDesc": "이 코드들을 안전한 장소에 보관하세요. 각 코드는 한 번만 사용할 수 있습니다."
  },
  "toasts": {
    "errorSaving": "설정 저장 오류",
    "errorSavingAppearance": "라이선스 서버에 외관 설정을 저장할 수 없습니다. 잠시 후 다시 시도하세요.",
    "licenseKeyAndRefRequired": "라이선스 키와 결제 참조를 입력하세요",
    "licenseActivated": "라이선스가 성공적으로 활성화되었습니다",
    "licenseActivateError": "라이선스를 활성화할 수 없습니다",
    "timezoneApplyError": "시스템에 시간대를 적용할 수 없습니다",
    "timezoneSavedNotApplied": "시간대가 패널에 저장되었지만 시스템에 적용할 수 없습니다 (sudo 권한을 확인하세요).",
    "passkeysInLp": "Passkeys는 LP-LICENSE-SERVER에서 관리됩니다",
    "passkeyDeleted": "Passkey 삭제됨",
    "passkeyDeleteError": "Passkey 삭제 오류",
    "passkeyBrowserUnsupported": "브라우저가 Passkey를 지원하지 않습니다",
    "passkeyRegisterInitError": "등록을 시작할 수 없습니다",
    "passkeyRegisterCancelled": "등록이 취소되었습니다",
    "passkeyRegisterFinishError": "등록 완료 오류",
    "passkeyRegistered": "Passkey가 성공적으로 등록되었습니다",
    "passkeyRegisterUserCancelled": "사용자가 등록을 취소했습니다",
    "passkeyRegisterError": "Passkey 등록 오류",
    "recoveryCodesInLp": "복구 코드는 LP-LICENSE-SERVER에서 관리됩니다",
    "recoveryCodesGenerateError": "코드 생성 오류",
    "twoFaInLp": "2FA는 LP-LICENSE-SERVER에서 관리됩니다",
    "twoFaSetupInitError": "2FA 설정 시작 오류",
    "twoFaQrError": "QR을 생성할 수 없습니다",
    "twoFaActivated": "2FA가 성공적으로 활성화되었습니다",
    "twoFaDisabled": "로그인 시 2FA가 비활성화되었습니다",
    "twoFaDisableError": "2FA 비활성화 오류",
    "twoFaReactivated": "로그인 시 2FA가 활성화되었습니다",
    "twoFaActivateError": "2FA 활성화 오류",
    "twoFaDeleted": "2FA 삭제됨",
    "twoFaDeleteError": "2FA 삭제 오류",
    "backupRestoreUnavailable": "이 패널에서는 아직 Backups 복원을 사용할 수 없습니다.",
    "imageExceeds5mb": "이미지가 5MB를 초과합니다",
    "uploadingImage": "이미지 업로드 중...",
    "imageUploadError": "이미지 업로드 오류",
    "imageUploadInvalidResponse": "서버에서 유효하지 않은 응답",
    "imageUploaded": "이미지가 성공적으로 업로드되었습니다",
    "logosRestored": "로고가 기본값으로 복원되었습니다",
    "codesCopied": "코드 복사됨",
    "secretCopied": "비밀 키 복사됨",
    "smtpTestSent": "{to}에게 테스트 메일 발송됨",
    "smtpTestError": "전송 오류",
    "layoutReset": "인터페이스 스타일이 기본값으로 초기화되었습니다",
    "settingsReset": "설정 초기화됨",
    "settingsResetError": "초기화 오류",
    "licenseRevalidated": "라이선스 재검증됨",
    "licenseRevalidateError": "라이선스를 재검증할 수 없습니다"
  },
  "actions": {
    "activating": "활성화 중...",
    "activateOrUpdate": "활성화 / 업데이트",
    "manage": "관리",
    "configure": "구성",
    "viewOrRegenerate": "보기 / 재생성",
    "generate": "생성",
    "generating": "생성 중...",
    "generateOrRegenerate": "생성 / 재생성",
    "disable": "비활성화",
    "activate": "활성화",
    "activate2fa": "2FA 활성화",
    "continue": "계속",
    "sending": "전송 중...",
    "send": "전송",
    "resetting": "초기화 중...",
    "factoryReset": "공장 초기화"
  },
  "errors": {
    "twoFaEnter6Digits": "코드 6자리를 입력하세요",
    "twoFaInvalidCode": "잘못된 코드"
  },
  "confirm": {
    "deletePasskeyTitle": "Passkey 삭제",
    "deletePasskeyBody": "이 Passkey를 삭제하시겠습니까?",
    "restoreBackupBody": "Backup \"{id}\"을(를) 복원하시겠습니까?",
    "restoreBackupTitle": "Backup 복원",
    "restoreLogosBody": "로고를 LUXIPANEL 기본값으로 복원하시겠습니까?",
    "restoreLogosTitle": "로고 복원",
    "restoreLogosConfirm": "예, 복원",
    "resetLayoutBody": "인터페이스 스타일을 LUXIPANEL 기본값으로 초기화하시겠습니까? 사용자 지정 로고, 색상, 그림자 및 배경이 삭제됩니다.",
    "resetLayoutTitle": "스타일 초기화",
    "resetLayoutConfirm": "예, 초기화",
    "factoryResetBody": "확실합니까? 패널의 모든 설정이 초기화됩니다.",
    "factoryResetTitle": "설정 초기화",
    "factoryResetConfirm": "예, 초기화"
  },
  "empty": {
    "noBackups": "사용 가능한 Backups가 없습니다."
  },
  "palettes": {
    "violet": {
      "name": "보라",
      "description": "LUXIPANEL 기본 팔레트."
    },
    "ocean": {
      "name": "오션",
      "description": "전문적이고 차분한 블루."
    },
    "emerald": {
      "name": "에메랄드",
      "description": "싱그럽고 자연스러운 그린."
    },
    "sunset": {
      "name": "석양",
      "description": "따뜻한 오렌지와 앰버."
    },
    "rose": {
      "name": "로즈",
      "description": "생동감 넘치는 핑크와 마젠타."
    },
    "indigo": {
      "name": "인디고",
      "description": "세련되고 현대적인 인디고."
    },
    "aqua": {
      "name": "아쿠아",
      "description": "밝고 선명한 청록과 시안."
    },
    "graphite": {
      "name": "그래파이트",
      "description": "차분한 모노크롬 뉴트럴."
    },
    "amber": {
      "name": "앰버",
      "description": "따뜻한 골드와 허니."
    },
    "fuchsia": {
      "name": "퓨샤",
      "description": "강렬한 마젠타와 퍼플."
    },
    "lime": {
      "name": "라임",
      "description": "활기찬 라임 그린."
    },
    "slate": {
      "name": "슬레이트",
      "description": "전문적인 청회색."
    },
    "prisma": {
      "name": "프리즘",
      "description": "모든 팔레트의 색을 끊임없이 순환하는 전환 효과로 결합합니다.",
      "colors": "색상",
      "addColorButton": "색상 추가",
      "addColorAria": "프리즘 효과에 사용할 색을 선택하고 추가",
      "addColorInputAria": "프리즘 효과에 추가할 색상",
      "editColorAria": "색상 편집",
      "editColorInputAria": "색상 값 편집",
      "editColorHexAria": "색상의 16진수 값",
      "removeColorAria": "색상 제거",
      "moveUpAria": "색상 위로 이동",
      "moveDownAria": "색상 아래로 이동",
      "helpText": "화살표로 목록 순서를 바꾸세요. 각 색상이 효과의 순서를 정의합니다."
    },
    "custom": {
      "name": "사용자 지정",
      "description": "기본 색상을 선택하고 강도를 조절하세요.",
      "baseColor": "기본 색상",
      "baseColorAria": "사용자 지정 기본 색상",
      "hexAria": "사용자 지정 기본 색상의 16진수 값"
    },
    "luxisoft": {
      "description": "라이트 모드에서는 네이비와 민트, 다크 모드에서는 그래파이트와 민트를 사용합니다.",
      "name": "Luxisoft"
    }
  },
  "managers": {
    "default": "관리자 1"
  },
  "git": {
    "errorFallback": "오류"
  }
} as const;

export default settings;
