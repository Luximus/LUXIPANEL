const errors = {
  "networkError": {
    "serverError": "서버가 오류 {status}를 반환했습니다(작업 시간이 초과되었을 수 있습니다).",
    "invalidResponse": "서버의 잘못된 응답입니다.",
    "connectionFailed": "서버에 연결할 수 없습니다. 연결 상태를 확인하고 다시 시도하세요.",
    "targetScopeChanged": "선택한 서버가 변경되었습니다. 페이지를 새로고침하세요.",
    "bridgeSessionRequired": "계속하려면 서버를 선택하거나 다시 연결하세요."
  },
  "error400": {
    "code": "400",
    "title": "잘못된 요청",
    "description": "전송된 요청에 잘못된 매개변수가 포함되어 있습니다. 데이터를 확인하고 다시 시도하세요."
  },
  "error401": {
    "code": "401",
    "title": "권한 없음",
    "description": "이 리소스에 접근하려면 로그인이 필요합니다. 로그인해 주세요."
  },
  "error403": {
    "code": "403",
    "title": "접근 금지",
    "description": "이 리소스에 접근할 권한이 없습니다."
  },
  "error404": {
    "code": "404",
    "title": "페이지를 찾을 수 없음",
    "description": "찾으시는 경로가 존재하지 않거나 이동되었습니다. URL을 확인하거나 홈으로 돌아가세요."
  },
  "error500": {
    "code": "500",
    "title": "서버 내부 오류",
    "description": "서버에서 문제가 발생했습니다. 해결을 위해 작업 중입니다. 나중에 다시 시도해 주세요."
  },
  "error503": {
    "code": "503",
    "title": "서비스를 사용할 수 없음",
    "description": "서버가 유지 관리 중이거나 과부하 상태입니다. 나중에 다시 시도해 주세요."
  },
  "home": "홈으로 이동",
  "back": "뒤로 이동",
  "backToServers": "서버 목록으로"
} as const;

export default errors;
