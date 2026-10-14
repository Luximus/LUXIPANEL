const databases = {
  "pageTitle": "데이터베이스",
  "header": {
    "heading": "데이터베이스 관리자",
    "subheading": "서버 데이터베이스 탐색 및 쿼리 (MySQL/MariaDB, PostgreSQL)."
  },
  "databases": {
    "title": "데이터베이스"
  },
  "tables": {
    "title": "테이블"
  },
  "tabs": {
    "rows": "행",
    "structure": "구조",
    "console": "SQL 콘솔"
  },
  "rows": {
    "prev": "이전",
    "next": "다음"
  },
  "console": {
    "placeholder": "SELECT * FROM ...",
    "run": "실행",
    "allowWrite": "쓰기 허용",
    "hint": "Ctrl/⌘ + Enter로 실행. 쓰기/DDL 구문은 \"쓰기 허용\"을 체크해야 합니다."
  },
  "common": {
    "selectEngine": "엔진을 선택하세요.",
    "selectDb": "데이터베이스를 선택하세요.",
    "selectTable": "테이블을 선택하세요."
  },
  "actions": {
    "export": "내보내기",
    "addRecord": "레코드 삽입",
    "cancel": "취소",
    "save": "저장",
    "edit": "편집",
    "downloadSql": "SQL 다운로드",
    "install": "{label} 설치"
  },
  "titles": {
    "record": "레코드",
    "exportDb": "데이터베이스 내보내기",
    "editRecord": "레코드 편집 · {table}",
    "newRecord": "새 레코드 · {table}"
  },
  "labels": {
    "tablesLabel": "테이블",
    "allTables": "전체",
    "includeData": "데이터 포함",
    "active": "활성",
    "actions": "작업",
    "colName": "열",
    "colType": "유형",
    "colNullable": "널 허용",
    "colKey": "키",
    "colDefault": "기본값",
    "yes": "예",
    "no": "아니요",
    "primaryKey": "기본 키",
    "tbl": "테이블"
  },
  "install": {
    "title": "데이터베이스 엔진 설치",
    "description": "MariaDB 또는 PostgreSQL을 연결된 서버에 설치하여 데이터베이스 관리를 시작하세요.",
    "mariadb": "MariaDB",
    "postgresql": "PostgreSQL"
  },
  "empty": {
    "noResults": "결과 없음.",
    "noEngines": "서버에 활성화된 데이터베이스 엔진이 없습니다. 엔진을 설치하여 시작하세요.",
    "noDatabases": "데이터베이스 없음.",
    "noTables": "테이블 없음."
  },
  "errors": {
    "detectEngines": "엔진 감지 오류",
    "loadRows": "행 로드 오류",
    "saveRecord": "레코드를 저장할 수 없습니다",
    "deleteRecord": "레코드를 삭제할 수 없습니다",
    "networkError": "네트워크 오류",
    "runQuery": "쿼리 실행 오류"
  },
  "loading": {
    "generic": "로드 중…",
    "rows": "행 로드 중…",
    "structure": "구조 로드 중…",
    "tablesExport": "테이블 로드 중…",
    "running": "실행 중…"
  },
  "toasts": {
    "engineInstalled": "{label} 설치됨",
    "noColumnsMetadata": "이 테이블에 대한 열 메타데이터가 없습니다",
    "recordUpdated": "레코드 업데이트됨",
    "recordCreated": "레코드 생성됨",
    "recordDeleted": "레코드 삭제됨",
    "noTableSelect": "테이블을 하나 이상 선택하세요",
    "exportDownloaded": "내보내기 다운로드됨",
    "selectEngineFirst": "먼저 엔진을 선택하세요",
    "statementExecuted": "구문 실행됨"
  },
  "confirm": {
    "deleteRecord": "이 레코드를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
    "deleteTitle": "레코드 삭제",
    "deleteConfirmText": "삭제"
  },
  "info": {
    "installing": "{label} 설치 중… 몇 분 정도 걸릴 수 있습니다.",
    "installed": "{label} 설치됨. 엔진 감지 중…",
    "pager": "{from}–{to}행 ({limit}개씩 표시)",
    "statementExecuted": "구문 실행됨",
    "rowCount": "{count}개 행",
    "truncated": "· 결과가 {count}행으로 잘림"
  },
  "runtime": {
    "createPromptWithPrefix": "이름은 {prefix}(으)로 시작하고 할당량을 지켜야 합니다.",
    "createPrompt": "활성 서버에 만들 새 데이터베이스의 이름.",
    "invalidPrefix": "이름은 {prefix}(으)로 시작해야 합니다",
    "createError": "데이터베이스를 만들지 못했습니다.",
    "created": "데이터베이스를 만들었습니다."
  },
  "settings": {
    "title": "데이터베이스 설정",
    "description": "데이터베이스 모듈 환경설정입니다.",
    "table": "표",
    "pagination": "페이지 나누기",
    "rowsPerPage": "구조 및 콘솔 결과에서 페이지당 표시할 행 수입니다.",
    "serverPagination": "레코드 표는 서버 측 페이지 나누기를 사용하므로 여기에서 변경할 수 없습니다.",
    "relatedModules": "관련 모듈",
    "hostingQuotas": "호스팅 및 할당량",
    "databaseBackups": "데이터베이스 백업",
    "sqlFiles": "SQL 파일",
    "allowWriteDefault": "콘솔을 열 때 기본적으로 쓰기 허용",
    "allowWriteHelp": "모듈을 불러올 때 적용되며 콘솔에서 언제든지 변경할 수 있습니다.",
    "createDatabase": "데이터베이스 만들기",
    "create": "만들기"
  }
} as const;

export default databases;
