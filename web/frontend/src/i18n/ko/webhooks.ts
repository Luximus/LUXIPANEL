const webhooks = {
  "pageTitle": "Webhooks 및 API Keys",
  "tabs": {
    "webhooks": "Webhooks",
    "apiKeys": "API 키",
    "discovered": "감지됨"
  },
  "webhooksPanel": {
    "description": "HMAC 서명이 포함된 발신 HTTP 알림",
    "btnNew": "새 webhook"
  },
  "apiKeysPanel": {
    "description": "영구 토큰을 사용한 프로그래밍 방식 접근",
    "btnNew": "새 API key"
  },
  "newKeyReveal": {
    "message": "API Key가 생성되었습니다 — 지금 복사하세요. 다시 표시되지 않습니다",
    "btnCopy": "복사"
  },
  "webhookDialog": {
    "placeholderUrl": "https://example.com/webhook",
    "title": "새 webhook",
    "labelUrl": "엔드포인트 URL",
    "labelEvents": "수신할 이벤트",
    "labelEnabled": "Webhook 활성화",
    "btnCancel": "취소",
    "btnSave": "저장"
  },
  "apiKeyDialog": {
    "placeholderName": "내 연동",
    "title": "새 API Key",
    "labelName": "설명 이름",
    "labelExpires": "만료 (선택사항)",
    "btnCancel": "취소",
    "btnCreate": "키 생성"
  },
  "discovered": {
    "description": "서버에서 감지된 webhook (Git, nginx, cron, systemd, 설정 파일 및 프로젝트)",
    "btnRescan": "다시 스캔",
    "scanning": "서버 스캔 중…",
    "empty": "서버에서 감지된 webhook이 없습니다",
    "cols": {
      "source": "출처",
      "name": "이름",
      "target": "대상",
      "location": "위치",
      "estado": "상태"
    },
    "filters": {
      "searchTarget": "대상 검색…",
      "source": "출처"
    },
    "sources": {
      "sidecar": "패널",
      "git-hook": "Git hook",
      "nginx": "Nginx",
      "cron": "Cron",
      "systemd": "systemd",
      "config": "설정",
      "project": "프로젝트"
    },
    "status": {
      "enabled": "활성",
      "disabled": "비활성",
      "unknown": "—"
    },
    "actions": {
      "detail": "상세 보기",
      "delete": "삭제"
    },
    "detail": {
      "title": "감지된 webhook 상세",
      "source": "출처",
      "target": "대상",
      "location": "위치",
      "info": "정보",
      "raw": "구성",
      "managedNote": "이 webhook은 패널에서 관리합니다",
      "readonlyNote": "읽기 전용: 해당 모듈에서 관리하세요",
      "btnClose": "닫기"
    },
    "confirm": {
      "deleteTitle": "감지된 webhook 삭제",
      "deleteBody": "\"{name}\"을(를) 삭제하시겠습니까? 서버의 파일이 수정됩니다.",
      "deleteBtn": "예, 삭제합니다"
    },
    "toasts": {
      "deleted": "삭제됨",
      "errorDeleting": "삭제할 수 없습니다",
      "scanComplete": "스캔 완료: {count}",
      "notManageable": "해당 모듈에서 관리하세요"
    }
  },
  "labels": {
    "statusFailing": "실패 중",
    "statusActive": "활성",
    "statusPaused": "일시 중지",
    "newWebhookTitle": "새 웹훅",
    "noExpiry": "만료 없음"
  },
  "confirm": {
    "rotateSecretBody": "이 웹훅의 시크릿을 교체하시겠습니까? 수신자를 업데이트해야 합니다.",
    "rotateSecretTitle": "시크릿 교체",
    "rotateSecretBtn": "예, 교체",
    "deleteWebhookBody": "이 웹훅을 삭제하시겠습니까?",
    "deleteWebhookTitle": "웹훅 삭제",
    "revokeKeyBody": "API Key \"{name}\"을(를) 취소하시겠습니까?",
    "revokeKeyTitle": "API Key 취소",
    "revokeKeyBtn": "예, 취소"
  },
  "toasts": {
    "secretRotated": "시크릿 교체됨",
    "errorRotating": "교체 오류",
    "webhookDeleted": "웹훅 삭제됨",
    "errorDeleting": "삭제 오류",
    "webhookUpdated": "웹훅 업데이트됨",
    "webhookCreated": "웹훅 생성됨",
    "errorSaving": "저장 오류",
    "keyRevoked": "키 취소됨",
    "errorRevoking": "취소 오류",
    "copiedToClipboard": "클립보드에 복사됨",
    "errorCreatingKey": "키 생성 오류"
  },
  "categories": {
    "receiveData": "데이터 수신",
    "mailhook": "메일훅",
    "response": "웹훅 응답",
    "soon": "출시 예정",
    "soonDesc": "이 카테고리의 설정 및 스캔은 이후 단계에서 정의됩니다."
  },
  "gateway": {
    "description": "패널이 수신 데이터를 받기 위해 호스팅하는 엔드포인트(Make.com 방식). API key 인증(x-make-apikey), IP 제한 및 데이터 구조 유효성 검사를 지원합니다.",
    "btnNew": "새 웹훅",
    "detectedTitle": "서버에서 감지된 수신기",
    "urlReveal": "웹훅 URL — 요청을 이 주소로 전송하세요",
    "cols": {
      "name": "이름",
      "auth": "인증",
      "recibidos": "수신 건수",
      "ultima": "마지막 수신",
      "estado": "상태",
      "estadoActive": "활성",
      "estadoPaused": "일시 중지"
    },
    "dialog": {
      "titleNew": "웹훅 생성",
      "titleEdit": "웹훅 편집",
      "name": "웹훅 이름",
      "namePlaceholder": "내 게이트웨이 웹훅",
      "nameHint": "1~128자 사이여야 합니다.",
      "apiAuth": "API key 인증",
      "apiAuthHint": "x-make-apikey 헤더로 API key를 전송합니다. 하나 이상 추가하세요. 하나라도 일치하면 접근이 허용됩니다.",
      "apiKeyName": "이름",
      "apiKeyValue": "API key 값",
      "apiKeyKeep": "(저장됨 — 유지하려면 비워두세요)",
      "addApiKey": "API key 추가",
      "ipTitle": "IP 제한",
      "ipHint": "쉼표로 구분된 IP 목록입니다. CIDR 표기법을 사용할 수 있습니다. 비워두면 검사하지 않습니다.",
      "dataStructure": "데이터 구조",
      "dataStructureHint": "수신 데이터의 유효성 검사. 비워두면 검사 없이 허용됩니다.",
      "dsValidate": "데이터 구조 검증",
      "dsStrict": "엄격 모드 (지정되지 않은 필드 거부)",
      "dsFieldName": "이름",
      "dsFieldDesc": "설명",
      "dsFieldType": "유형",
      "dsFieldDefault": "기본값",
      "dsFieldRequired": "필수",
      "dsFieldMultiline": "여러 줄",
      "addItem": "필드 추가",
      "getHeaders": "요청 헤더 가져오기",
      "getHeadersHint": "헤더가 본문에 추가됩니다.",
      "getMethod": "HTTP 메서드 가져오기",
      "getMethodHint": "메서드(동사)가 본문에 추가됩니다.",
      "jsonPassthrough": "JSON을 텍스트로 저장",
      "jsonPassthroughHint": "활성화하면 JSON 페이로드가 문자열로 저장됩니다.",
      "enabled": "웹훅 활성화",
      "advanced": "고급 설정",
      "btnCancel": "취소",
      "btnSave": "저장"
    },
    "payloads": {
      "title": "수신된 페이로드",
      "empty": "아직 수신된 페이로드가 없습니다.",
      "btnClose": "닫기"
    },
    "confirm": {
      "deleteTitle": "웹훅 삭제",
      "deleteBody": "웹훅 \"{name}\"을(를) 삭제하시겠습니까? 저장된 페이로드가 모두 삭제됩니다.",
      "deleteBtn": "예, 삭제"
    },
    "toasts": {
      "created": "웹훅이 생성되었습니다",
      "updated": "웹훅이 업데이트되었습니다",
      "deleted": "웹훅이 삭제되었습니다",
      "copied": "URL이 복사되었습니다",
      "error": "저장 중 오류가 발생했습니다"
    }
  },
  "table": {
    "gateway": {
      "columns": {
        "name": "이름",
        "auth": "인증",
        "recibidos": "수신 수",
        "ultima": "마지막 수신",
        "estado": "상태"
      },
      "filters": {
        "searchName": "이름 검색…",
        "estado": "상태"
      },
      "rowActions": {
        "copy": "URL 복사",
        "payloads": "페이로드 보기",
        "edit": "편집",
        "delete": "삭제"
      },
      "options": {
        "statusActive": "활성",
        "statusPaused": "일시 중지"
      }
    },
    "webhooks": {
      "columns": {
        "url": "URL",
        "eventos": "이벤트",
        "estado": "상태"
      },
      "filters": {
        "searchUrl": "URL 검색…",
        "estado": "상태"
      },
      "rowActions": {
        "regenerate": "시크릿 교체",
        "delete": "삭제"
      },
      "options": {
        "statusActive": "활성",
        "statusPaused": "일시 중지",
        "statusFailing": "실패 중"
      }
    },
    "apiKeys": {
      "columns": {
        "name": "이름",
        "prefix": "접두사",
        "creada": "생성됨",
        "expira": "만료"
      },
      "filters": {
        "searchName": "이름 검색…"
      },
      "rowActions": {
        "revoke": "취소"
      }
    },
    "discovered": {
      "columns": {
        "origen": "출처",
        "name": "이름",
        "target": "대상",
        "location": "위치",
        "estado": "상태"
      },
      "filters": {
        "searchTarget": "대상 검색…",
        "origen": "출처"
      },
      "rowActions": {
        "detail": "상세 보기",
        "delete": "삭제"
      },
      "options": {
        "panel": "패널",
        "gitHook": "Git hook",
        "nginx": "Nginx",
        "cron": "Cron",
        "systemd": "systemd",
        "config": "설정",
        "proyecto": "프로젝트"
      }
    }
  },
  "runtime": {
    "testDelivered": "테스트가 성공적으로 전달되었습니다.",
    "testFailed": "테스트 전달에 실패했습니다.",
    "loadingDeliveries": "전달 내역을 불러오는 중…",
    "loadDeliveriesError": "전달 내역을 불러오지 못했습니다.",
    "noDeliveries": "아직 기록된 전달 내역이 없습니다.",
    "delivered": "전달됨",
    "failed": "실패",
    "attempts": "시도 횟수: {count}",
    "selectEvent": "이벤트를 하나 이상 선택하세요."
  },
  "settingsUi": {
    "title": "Webhooks 설정",
    "description": "Webhooks 표의 페이지 나누기와 표시할 작업입니다.",
    "gateway": "게이트웨이",
    "webhooks": "Webhooks",
    "signingSecret": "서명 비밀키 · 지금 복사하세요",
    "signingSecretHint": "한 번만 표시됩니다. 수신자에게 설정하여 X-Luxipanel-Signature를 확인하세요.",
    "recentDeliveries": "최근 전송"
  }
} as const;

export default webhooks;
