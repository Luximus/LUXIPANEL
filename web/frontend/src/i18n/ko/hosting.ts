const hosting = {
  "pageTitle": "공유 호스팅",
  "pageSubtitle": "고객 호스팅 계정 관리 · WHM 스타일 멀티테넌트",
  "btnNewAccount": "새 계정",
  "options": {
    "planBasic": "기본",
    "planPro": "프로",
    "planBusiness": "비즈니스",
    "planCustom": "사용자 지정"
  },
  "stats": {
    "total": "전체 계정",
    "active": "활성",
    "suspended": "정지됨",
    "terminated": "종료됨",
    "title": "{username} 사용량",
    "disk": "디스크 (MB)",
    "domains": "도메인",
    "emails": "이메일 계정",
    "databases": "데이터베이스",
    "subusers": "하위 사용자",
    "bandwidth": "대역폭 (MB)",
    "percentUsed": "% 사용",
    "method": "측정 방법",
    "methodDu": "du 추정(best-effort)",
    "methodQuotaTools": "시스템 할당량 (quota-tools)"
  },
  "tableTitle": "계정",
  "modal": {
    "titleNew": "새 호스팅 계정",
    "tabs": {
      "account": "계정",
      "resources": "리소스",
      "security": "모듈 및 보안"
    },
    "labelUsername": "사용자 *",
    "labelPassword": "비밀번호 *",
    "labelName": "이름",
    "labelEmail": "이메일",
    "labelPlan": "요금제",
    "resourcesTitle": "리소스 한도",
    "labelDisk": "디스크 (MB)",
    "labelBandwidth": "대역폭 (MB)",
    "labelDomains": "도메인",
    "labelEmails": "이메일 계정",
    "labelNotes": "내부 메모",
    "btnCancel": "취소",
    "btnCreate": "계정 생성",
    "hintUsername": "소문자, 숫자, - 및 _만 사용",
    "phUsername": "예시클라이언트",
    "phPassword": "최소 8자",
    "phName": "기업 주식회사",
    "phEmail": "admin@empresa.com",
    "phNotes": "선택적 메모…",
    "labelStatus": "상태",
    "labelTenantGroup": "테넌트 그룹",
    "labelHomeRoot": "루트 폴더 (home)",
    "hintTenantGroup": "계정 전용 Linux 그룹(읽기 전용).",
    "hintHomeRoot": "VPS의 테넌트 루트(읽기 전용).",
    "labelDiskQuotaMb": "디스크 할당량 (MB)",
    "labelBandwidthQuotaMb": "대역폭 할당량 (MB)",
    "labelMaxDomains": "최대 도메인",
    "labelMaxEmailAccounts": "최대 이메일 계정",
    "labelMaxDatabases": "최대 데이터베이스",
    "labelMaxSubUsers": "최대 하위 사용자",
    "labelAllowedModules": "허용 모듈",
    "labelJailEnabled": "셸 격리 (chroot)",
    "hintJailEnabled": "이 계정의 터미널/SSH를 해당 폴더로 제한합니다(chroot 감옥).",
    "modulesLoading": "모듈 로드 중…",
    "labelExpiresAt": "만료 날짜",
    "hintExpiresAt": "만료 없음으로 설정하려면 비워 두세요",
    "labelModules": "허용된 모듈",
    "hintModules": "이 고객이 접근할 수 있는 패널 모듈을 정의합니다.",
    "labelDatabases": "데이터베이스",
    "labelSubUsers": "하위 사용자",
    "labelJail": "셸 격리 (chroot)",
    "hintJail": "이 계정의 터미널/SSH를 해당 폴더(chroot 감옥)로 제한합니다.",
    "titleEdit": "편집: {username}"
  },
  "pwdModal": {
    "title": "비밀번호 변경",
    "labelNew": "새 비밀번호",
    "phPassword": "최소 8자",
    "btnCancel": "취소",
    "btnChange": "변경"
  },
  "apiPageTitle": "호스팅 API 문서",
  "apiSubtitle": "공유 호스팅 계정의 자동화 관리",
  "apiIntro": "Reseller API를 사용하면 외부 시스템(자체 청구 플랫폼, WHMCS, Bash 스크립트, Zapier 연동 등)에서 호스팅 계정의 생성, 업데이트, 정지 및 삭제를 자동화할 수 있습니다. HTTP 요청이 가능한 모든 언어나 도구와 호환됩니다.",
  "toc": {
    "label": "목차",
    "items": [
      "1. 인증",
      "2. 격리 및 보안",
      "3. 사용 가능한 엔드포인트",
      "4. 계정 만들기",
      "5. 계정 목록",
      "6. 계정 조회",
      "7. 계정 업데이트",
      "8. 계정 정지 및 재활성화",
      "9. 비밀번호 변경",
      "10. 계정 통계",
      "11. 계정 삭제",
      "12. 호스팅 계정 로그인",
      "13. 오류 코드",
      "14. 전체 예제"
    ]
  },
  "auth": {
    "title": "인증",
    "intro": "Reseller API의 모든 엔드포인트는 두 가지 인증 방법을 지원합니다:",
    "apiKeyTitle": "API Key (자동화에 권장)",
    "apiKeyDesc": "패널 → Webhooks → API Keys에서 API key를 생성하세요. Authorization 헤더에 포함하여 전송하세요:",
    "sessionTitle": "관리자 세션 (패널에서)",
    "sessionDesc": "LUXIPANEL 패널 내에서 직접 요청을 보내는 경우(예: 브라우저의 JavaScript), 관리자 세션 쿠키가 자동으로 허용됩니다.",
    "warningTitle": "중요:",
    "warningText": "클라이언트 측 코드(브라우저 JavaScript, 모바일 앱 등)에 API key를 노출하지 마세요. 서버나 비공개 환경에서만 사용하세요."
  },
  "isolation": {
    "title": "격리 및 보안",
    "intro": "각 호스팅 계정은 완전히 격리된 환경입니다. 이를 통해 웹 패널, API, SSH 콘솔 또는 다른 어떤 경로를 통해서도 다른 고객의 리소스를 보거나 수정할 수 없습니다.",
    "features": [
      {
        "title": "격리된 데이터",
        "desc": "메일박스, 도메인, DNS, SSL 및 백업은 각 계정의 tenant_id에 연결됩니다. SQL 쿼리는 절대 테넌트 간 경계를 넘지 않습니다."
      },
      {
        "title": "파일 시스템",
        "desc": "각 계정은 자체 홈 디렉터리(/home/username)를 가집니다. 파일 탐색기와 콘솔은 해당 디렉터리로 제한됩니다."
      },
      {
        "title": "독립된 세션",
        "desc": "호스팅 계정의 JWT에는 해당 tenantId가 포함됩니다. 백엔드는 해당 범위 밖의 리소스에 접근하려는 모든 요청을 거부합니다."
      }
    ]
  },
  "endpoints": {
    "title": "사용 가능한 엔드포인트",
    "colMethod": "방법",
    "colPath": "경로",
    "colDesc": "설명",
    "colAuth": "인증",
    "rows": [
      [
        "POST",
        "/api/hosting/accounts",
        "호스팅 계정 생성",
        "관리자 / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts",
        "계정 목록 조회 (페이지네이션)",
        "관리자 / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts/:id",
        "단일 계정 조회",
        "관리자 / API Key"
      ],
      [
        "PUT",
        "/api/hosting/accounts/:id",
        "계정 업데이트",
        "관리자 / API Key"
      ],
      [
        "DELETE",
        "/api/hosting/accounts/:id",
        "계정 및 모든 데이터 삭제",
        "관리자 / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/suspend",
        "계정 정지",
        "관리자 / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/unsuspend",
        "정지된 계정 재활성화",
        "관리자 / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/change-password",
        "비밀번호 변경",
        "관리자 / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts/:id/stats",
        "사용량 통계",
        "관리자 / API Key"
      ],
      [
        "POST",
        "/api/hosting/auth/login",
        "호스팅 계정 로그인",
        "공개"
      ],
      [
        "POST",
        "/api/hosting/auth/logout",
        "호스팅 로그아웃",
        "호스팅 세션"
      ]
    ]
  },
  "create": {
    "title": "계정 생성",
    "labelBody": "본문 (JSON)",
    "labelResp": "응답 201"
  },
  "list": {
    "title": "계정 목록",
    "labelParams": "쿼리 파라미터",
    "colParam": "파라미터",
    "colType": "유형",
    "colDefault": "기본값",
    "colDesc": "설명",
    "labelResp": "응답 200",
    "params": [
      [
        "page",
        "integer",
        "1",
        "현재 페이지"
      ],
      [
        "limit",
        "integer",
        "20",
        "페이지당 결과 수 (최대 100)"
      ],
      [
        "search",
        "string",
        "—",
        "username, displayName, email에서 검색"
      ],
      [
        "status",
        "string",
        "—",
        "active | suspended | terminated"
      ]
    ]
  },
  "compactEndpoints": [
    {
      "id": "get",
      "num": "6",
      "title": "계정 조회",
      "method": "GET",
      "path": "/api/hosting/accounts/:id",
      "note": "passwordHash 필드를 제외한 계정 객체를 반환합니다."
    },
    {
      "id": "update",
      "num": "7",
      "title": "계정 업데이트",
      "method": "PUT",
      "path": "/api/hosting/accounts/:id",
      "note": "생성 시와 동일한 필드를 받습니다(username과 password 제외). 전송된 필드만 업데이트됩니다."
    },
    {
      "id": "suspend",
      "num": "8",
      "title": "정지 / 재활성화",
      "method": "POST",
      "path": "/api/hosting/accounts/:id/suspend  |  /unsuspend",
      "note": "정지하면 클라이언트의 접근이 즉시 차단됩니다. 정지 해제는 상태를 'active'로 복원합니다. 본문은 필요하지 않습니다."
    },
    {
      "id": "password",
      "num": "9",
      "title": "비밀번호 변경",
      "method": "POST",
      "path": "/api/hosting/accounts/:id/change-password",
      "note": "Body: {\"password\": \"NewPass123!\"} — 최소 8자."
    },
    {
      "id": "stats",
      "num": "10",
      "title": "사용량 통계",
      "method": "GET",
      "path": "/api/hosting/accounts/:id/stats",
      "note": "구성된 할당량과 디스크, 대역폭, 활성 도메인 및 이메일 계정의 현재 사용량을 반환합니다."
    },
    {
      "id": "delete",
      "num": "11",
      "title": "계정 삭제",
      "method": "DELETE",
      "path": "/api/hosting/accounts/:id",
      "note": "⚠️ 되돌릴 수 없습니다. 계정을 삭제하고, ON DELETE CASCADE를 통해 메일박스, 도메인, DNS, SSL 및 백업 등 모든 리소스를 삭제합니다."
    }
  ],
  "login": {
    "title": "호스팅 계정 로그인",
    "badgePublic": "· 공개",
    "desc": "고객이 로그인 패널에 자격 증명을 입력합니다. 유효한 경우 kind: \"hosting\" 유형의 세션이 생성되어 해당 계정의 리소스에만 접근이 제한됩니다.",
    "labelBody": "본문",
    "labelResp": "응답 200"
  },
  "errors": {
    "title": "오류 코드",
    "intro": "모든 오류는 동일한 봉투 형식을 따릅니다:",
    "colHttp": "HTTP",
    "colCode": "코드",
    "colDesc": "설명",
    "rows": [
      [
        "400",
        "VALIDATION_ERROR",
        "잘못되었거나 누락된 필드"
      ],
      [
        "401",
        "AUTH_ERROR",
        "잘못되었거나 만료되었거나 누락된 API key"
      ],
      [
        "403",
        "FORBIDDEN",
        "이 작업에 대한 권한이 없습니다"
      ],
      [
        "404",
        "NOT_FOUND",
        "요청한 계정이 존재하지 않습니다"
      ],
      [
        "409",
        "CONFLICT",
        "username이 이미 사용 중입니다"
      ],
      [
        "429",
        "RATE_LIMIT",
        "요청이 너무 많습니다 — 재시도 전에 기다리세요"
      ],
      [
        "500",
        "INTERNAL_ERROR",
        "내부 서버 오류"
      ]
    ],
    "generic": "오류",
    "unknown": "알 수 없는 오류"
  },
  "examples": {
    "title": "전체 예제",
    "labelCurl": "계정 생성",
    "labelSuspend": "계정 정지",
    "labelList": "필터로 목록 조회",
    "labelNodeClient": "재사용 가능한 클라이언트",
    "labelPhpHelper": "PHP 헬퍼 클래스"
  },
  "table": {
    "columnStatus": "상태",
    "columnPlan": "요금제",
    "columnModules": "모듈",
    "columnCreated": "생성됨",
    "columnUpdated": "업데이트됨",
    "columnTenantGroup": "그룹",
    "columnHomeRoot": "홈",
    "modulesCount": "{count}개 모듈"
  },
  "audit": {
    "title": "{username} 감사",
    "eventType": "이벤트",
    "actor": "행위자",
    "date": "날짜",
    "empty": "기록된 이벤트가 없습니다."
  },
  "actions": {
    "editModules": "모듈 편집",
    "viewStats": "사용량 보기",
    "viewAudit": "감사 보기",
    "enableJail": "감옥 활성화",
    "disableJail": "감옥 비활성화",
    "save": "저장",
    "saveChanges": "변경사항 저장",
    "saving": "저장 중…"
  },
  "confirm": {
    "enableJailBody": "이 계정의 chroot 감옥을 활성화하시겠습니까? 터미널/SSH가 해당 폴더로 제한됩니다.",
    "disableJailBody": "chroot 감옥을 비활성화하시겠습니까? 계정이 일반 셸(/bin/bash)로 되돌아갑니다.",
    "suspendBody": "이 계정을 정지하시겠습니까? 고객이 접근 권한을 잃게 됩니다.",
    "suspendTitle": "계정 정지",
    "suspendOk": "예, 정지",
    "deleteBody": "\"{username}\" 계정과 모든 데이터(이메일, 도메인, 파일)를 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.",
    "deleteTitle": "계정 삭제"
  },
  "jail": {
    "degraded": "서버에 jailkit이 설치되어 있지 않아 감옥이 활성화되지 않았습니다. jailkit을 설치한 후 다시 시도하세요.",
    "degradedTitle": "감옥 미적용",
    "enabledOk": "감옥이 성공적으로 활성화되었습니다."
  },
  "toasts": {
    "jailAlready": "감옥이 이미 활성 상태입니다",
    "jailNotActive": "감옥이 활성 상태가 아닙니다",
    "notActive": "계정이 활성화되어 있지 않습니다",
    "notSuspended": "계정이 정지되어 있지 않습니다"
  },
  "labels": {
    "statusActive": "활성",
    "statusSuspended": "정지됨",
    "statusTerminated": "해지됨"
  },
  "dataTable": {
    "columns": {
      "username": "사용자",
      "plan": "요금제",
      "estado": "상태",
      "modulos": "모듈",
      "tenantGroup": "그룹",
      "homeRoot": "홈",
      "creado": "생성됨",
      "actualizado": "업데이트됨"
    },
    "filters": {
      "searchUser": "사용자로 검색…",
      "estado": "상태",
      "plan": "요금제",
      "statusActive": "활성",
      "statusSuspended": "정지됨",
      "statusTerminated": "종료됨"
    },
    "rowActions": {
      "edit": "편집",
      "viewStats": "사용량 보기",
      "viewAudit": "감사 보기",
      "password": "비밀번호 변경",
      "suspend": "일시 중지",
      "unsuspend": "다시 게시",
      "enableJail": "감옥 활성화",
      "disableJail": "감옥 비활성화",
      "delete": "삭제"
    }
  },
  "runtime": {
    "defaultsLoadError": "기본값을 불러오지 못했습니다.",
    "defaultsSaveError": "값을 저장하지 못했습니다.",
    "defaultsSaved": "활성 서버에 값을 저장했습니다."
  },
  "settingsUi": {
    "title": "호스팅 설정",
    "description": "호스팅 계정 표 환경설정",
    "table": "표",
    "apiProviders": "API 제공자",
    "rowsPerPage": "계정 표에서 페이지당 표시할 행 수입니다.",
    "newAccountDefaults": "새 계정의 기본값",
    "defaultsHint": "활성 서버에 저장됩니다. 기존 계정은 변경되지 않습니다.",
    "emailAccounts": "이메일",
    "subusers": "하위 사용자",
    "defaultJail": "기본적으로 격리 사용",
    "defaultModules": "기본 모듈(쉼표로 구분한 ID)",
    "saveDefaults": "기본값 저장",
    "relatedModules": "관련 모듈",
    "users": "사용자",
    "domainsSsl": "도메인 및 SSL",
    "showAll": "모두 표시",
    "hideAll": "모두 숨기기",
    "providerConnections": "호스팅 관리자 연결",
    "providerConnectionsHint": "LUXIPANEL이 API를 제공합니다. 각 관리자는 키와 하나의 서버, 모듈 및 작업에 한정된 접근 권한을 받습니다.",
    "newProvider": "새 제공자",
    "managedServer": "관리 대상 서버",
    "localServer": "로컬 서버",
    "panelHttpsOrigin": "LUXIPANEL HTTPS 출처",
    "siteEngine": "서버의 사이트 엔진",
    "accountModules": "계정의 모듈",
    "modulesHint": "쉼표로 구분한 ID이며 HOSTING이 목록을 검증합니다.",
    "apiOperations": "API 작업",
    "readAccounts": "계정 읽기",
    "createAccounts": "계정 만들기",
    "accountStatus": "계정 상태 및 정보",
    "viewUsage": "사용량 보기",
    "linkSites": "사이트 연결",
    "panelAccess": "패널 접근",
    "deleteAccounts": "계정 삭제",
    "createProviderKey": "제공자와 키 만들기",
    "copyKeyNow": "키를 지금 복사하세요. 한 번만 표시됩니다.",
    "groupPolicy": {
      "editProvider": "공급자 편집",
      "saveProvider": "공급자 저장",
      "templateTitle": "초기 그룹 권한",
      "templateHint": "새 계정은 자체 그룹에서 이 권한을 받습니다. 기존 그룹은 사용자 화면에서 편집하세요.",
      "permissions": "세부 권한",
      "sidebar": "메뉴",
      "views": "화면",
      "actions": "작업",
      "filesScope": "파일 접근",
      "relativeHint": "계정 폴더 기준 상대 경로를 한 줄에 하나씩 입력하세요. . 은 전체 폴더입니다.",
      "allowPaths": "허용 폴더",
      "denyPaths": "차단 폴더",
      "readOnlyPaths": "읽기 전용 폴더",
      "defaultPath": "시작 폴더",
      "commands": "터미널 명령",
      "allowAllCommands": "사용자의 모든 명령 허용",
      "commandGroups": "명령 그룹",
      "allowedCommands": "허용 명령, 한 줄에 하나",
      "deniedCommands": "차단 명령, 한 줄에 하나",
      "saving": "저장 중…",
      "saved": "공급자가 저장되었습니다. 새 계정에 적용됩니다.",
      "created": "공급자가 생성되었습니다.",
      "loading": "공급자 및 권한 로드 중…",
      "loadError": "설정을 로드하지 못했습니다.",
      "active": "활성",
      "revoked": "취소됨",
      "rotateKey": "키 갱신",
      "rotateSuccess": "키가 갱신되었습니다. 새 키를 복사하세요.",
      "revoke": "접근 취소",
      "reactivate": "재활성화",
      "accessUpdated": "접근이 업데이트되었습니다.",
      "emptyProviders": "설정된 공급자가 없습니다."
},
    "apiGuide": "API 안내서",
    "retry": "다시 시도"
  },
  "apiDocs": {
    "pageTitle": "호스팅 제공업체 API",
    "backToHosting": "HOSTING으로 돌아가기",
    "contractVersion": "HTTP 계약 · 버전 1",
    "heading": "호스팅 관리자를 연결하세요",
    "intro": "LUXIPANEL은 HOSTING에서 설정한 권한에 따라 계정 생성, 사이트 연결, 접근 권한 부여를 수행하는 API를 제공합니다.",
    "guideContents": "안내서 목차",
    "preparation": "준비",
    "authentication": "인증",
    "operations": "작업",
    "example": "예시",
    "panelAccess": "패널 접근",
    "limitsErrors": "제한 및 오류",
    "preparationHeading": "HOSTING에서 준비",
    "administrator": "관리자",
    "scope": "범위",
    "key": "키",
    "adminStep": "HOSTING → 설정 → API 제공업체에서 제공업체를 만드세요.",
    "scopeStep": "서버, 사이트 엔진, 모듈, 할당량 및 허용 작업을 설정하세요.",
    "keyStep": "lhp_… 키를 한 번만 복사하고 관리자의 백엔드에만 저장하세요.",
    "providerScopeNote": "각 제공업체는 하나의 서버에 연결됩니다. 계정마다 Linux 사용자와 폴더가 지정되며 관리자는 비밀번호를 선택하거나 받지 않습니다.",
    "anyProvider": "모든 제공업체",
    "endpointCapabilities": "버전, 작업, 모듈 및 할당된 서버를 조회합니다.",
    "endpointPutAccount": "선택 사항인 displayName과 email로 계정을 생성하거나 조회합니다.",
    "endpointGetAccount": "비밀번호를 노출하지 않고 계정을 조회합니다.",
    "endpointPatchAccount": "이름, 이메일 또는 active/suspended 상태를 변경합니다.",
    "endpointDeleteAccount": "연결된 사이트가 없는 계정을 삭제합니다. 기본적으로 비활성화됩니다.",
    "endpointUsage": "할당량, 사용 가능한 사용량 및 측정 경고를 조회합니다.",
    "endpointPutSite": "도메인을 HOSTING에 설정된 사이트 엔진에 연결합니다.",
    "endpointDeleteSite": "이 제공업체에 속한 사이트만 제거합니다.",
    "endpointTicket": "60초 동안 유효한 일회용 패널 접근 티켓을 발급합니다.",
    "method": "메서드",
    "pathFromBase": "기본 URL 기준 경로",
    "permission": "권한",
    "result": "결과",
    "operationsHeading": "관리자 작업",
    "authNote": "HTTPS로 패널에 요청을 보내세요. 관리자 쿠키와 lxp_… 키로는 이 API를 인증할 수 없습니다. lhp_… 키를 브라우저에 노출하지 마세요.",
    "baseNote": "기본 URL: https://<panel>/api/hosting/v1. 외부 ID는 1~128자의 영문자, 숫자 및 _ . : -를 사용할 수 있습니다.",
    "idempotencyNote": "동일한 참조와 내용의 계정 및 사이트 PUT 요청은 멱등입니다. 한 제공업체는 다른 제공업체의 계정에 접근할 수 없습니다.",
    "createAccount": "계정 생성 또는 조회",
    "accountResponseNote": "응답의 { \"ok\": true, \"data\": … }에 사용자, 홈 디렉터리, 상태 및 할당량이 포함됩니다. 비밀번호 해시는 포함되지 않습니다.",
    "siteExampleNote": "사이트에는 { \"domain\": \"example.com\" }와 함께 PUT /accounts/account-42/sites/site-1을 보냅니다. LUXIPANEL은 설정된 엔진으로 NGINX 프록시를 만들고 관리자는 콘텐츠를 게시하고 TLS 트래픽을 서버로 보냅니다.",
    "clientAccessHeading": "고객의 LUXIPANEL 접근",
    "clientAccessNote": "관리자 백엔드가 계정 소유권을 확인하고 POST /accounts/{accountId}/access-ticket을 요청합니다. URL과 티켓을 브라우저로 전달하고, 브라우저는 /api/auth/sso/handoff에 POST합니다. 티켓은 일회용이며 60초 후 만료됩니다. 2단계 인증이 필요한 경우 호환 흐름이 마련될 때까지 403을 반환합니다.",
    "limitsHeading": "제한 및 오류 응답",
    "limitsNote": "API는 참조, 기본 계정 정보 및 도메인만 받습니다. 관리자는 명령, 파일 경로, 대상 서버 또는 NGINX 설정을 보낼 수 없습니다. 사이트는 관리자가 지정한 엔진과 포트만 가리킬 수 있습니다.",
    "errorCodes": "400: 잘못된 입력 · 401: 키 없음 또는 잘못된 키 · 403: 허용되지 않은 작업 · 404: 참조 없음 · 409: 충돌 또는 동시 작업 · 5xx: 서버 오류.",
    "bandwidthNote": "대역폭 측정은 아직 신뢰할 수 없습니다. usage 응답의 warnings를 확인하세요."
  }
} as const;

export default hosting;
