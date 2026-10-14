const bitninja = {
  "header": {
    "description": "연결된 서버의 통합 보안 에이전트 (WAF, 안티-DoS, 악성코드 탐지 및 IP 평판).",
    "statusChecking": "확인 중…"
  },
  "sudo": {
    "label": "sudo 비밀번호 (세션 passphrase)",
    "placeholder": "서버에서 sudo 비밀번호를 요구하는 경우에만",
    "hint": "이 작업에만 사용되며 브라우저에 저장되지 않습니다."
  },
  "installCard": {
    "title": "BitNinja가 설치되어 있지 않습니다",
    "description": "BitNinja 계정의 라이선스 키를 입력하여 이 서버에 에이전트를 설치하세요. 공식 설치 프로그램(get.bitninja.io)을 다운로드하여 sudo로 실행합니다.",
    "licensePlaceholder": "라이선스 키 (예: ab12cd34-…)",
    "installButton": "BitNinja 설치"
  },
  "stats": {
    "service": "서비스",
    "license": "라이선스",
    "version": "버전"
  },
  "serviceControl": {
    "title": "서비스 제어",
    "start": "시작",
    "restart": "재시작",
    "stop": "중지"
  },
  "components": {
    "title": "보호 구성 요소",
    "checking": "확인 중…",
    "noReported": "에이전트가 보고한 구성 요소가 없습니다.",
    "active": "활성",
    "inactive": "비활성"
  },
  "updateLicense": {
    "title": "라이선스 키 업데이트",
    "placeholder": "새 라이선스 키",
    "applyButton": "적용"
  },
  "toasts": {
    "sudoRequired": "sudo 비밀번호를 입력하고 다시 시도하세요.",
    "sudoInvalid": "sudo 비밀번호가 올바르지 않습니다.",
    "actionFailed": "작업에 실패했습니다. 출력을 확인하세요.",
    "installing": "BitNinja 설치 중… 몇 분 정도 걸릴 수 있습니다.",
    "installed": "BitNinja 설치됨.",
    "serviceAction": "서비스: {action} 완료.",
    "componentToggleEnabled": "{component}: 활성화됨.",
    "componentToggleDisabled": "{component}: 비활성화됨.",
    "licenseApplied": "라이선스 키가 적용되었습니다."
  },
  "errors": {
    "unknown": "알 수 없는 오류"
  },
  "status": {
    "notInstalled": "설치 안 됨",
    "running": "실행 중",
    "installedStopped": "설치됨 (중지됨)",
    "serviceRunning": "실행 중",
    "serviceStopped": "중지됨",
    "licenseValid": "유효",
    "licenseReview": "검토 필요"
  },
  "validation": {
    "licenseKeyRequired": "라이선스 키를 입력하세요.",
    "newLicenseKeyRequired": "새 라이선스 키를 입력하세요."
  },
  "settingsUi": {
    "settingsTitle": "BitNinja 설정",
    "settingsButton": "설정",
    "settingsDescription": "활성 서버의 진단 환경 설정입니다.",
    "settingsSections": "BitNinja 설정 섹션",
    "diagnostics": "진단",
    "related": "관련 항목",
    "logSource": "선택한 서버의 BitNinja 서비스에서 로그를 읽습니다.",
    "autoRefresh": "30초마다 상태 새로고침",
    "logLines": "로그 줄 수",
    "relatedModules": "관련 모듈",
    "firewallAudit": "방화벽 및 감사",
    "credentials": "BitNinja 자격 증명"
  },
  "logsUi": {
    "loading": "로그를 불러오는 중…",
    "empty": "최근 이벤트가 없습니다.",
    "loadError": "로그를 불러오지 못했습니다.",
    "logsTitle": "최근 로그",
    "logsDescription": "활성 서버의 서비스 이벤트입니다.",
    "refreshLogs": "로그 새로고침",
    "logsHint": "이벤트를 불러오려면 “로그 새로고침”을 선택하세요."
  }
} as const;

export default bitninja;
