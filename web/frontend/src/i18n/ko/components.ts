const components = {
  "setupWizardFooter": {
    "rights": "모든 권리 보유.",
    "madeBy": "LUXISOFT 제작",
    "termsAndConditions": "이용약관",
    "privacyPolicy": "개인정보 처리방침",
    "documentation": "문서",
    "refundPolicy": "환불 정책"
  },
  "dataTable": {
    "boolTrue": "예",
    "boolFalse": "아니오",
    "selectPage": "페이지 선택",
    "selectRow": "행 선택",
    "actions": "작업",
    "configure": "테이블 구성",
    "empty": "{title}에 대한 결과가 없습니다.",
    "total": "합계",
    "selectedSummary": "{selected}개 선택됨 • {pageSize}개 결과 중 {shown}개 표시, 총 결과: {total}",
    "summary": "{pageSize}개 결과 중 {shown}개 표시, 총 결과: {total}",
    "prev": "이전",
    "next": "다음",
    "pageOf": "{totalPages} 페이지 중 {currentPage} 페이지",
    "configureTitle": "테이블 구성",
    "columnsAndOrder": "표시할 열 및 순서",
    "resultsPerPage": "페이지당 결과",
    "moveUp": "{col} 위로 이동",
    "moveDown": "{col} 아래로 이동",
    "defaultTitle": "테이블",
    "dragHandle": "드래그하여 순서 변경",
    "moveUpAria": "{col} 위로 이동",
    "moveDownAria": "{col} 아래로 이동",
    "emptyCell": "-"
  },
  "confirmModal": {
    "title": "확인",
    "cancel": "취소",
    "confirm": "확인",
    "alertTitle": "알림",
    "alertOk": "확인",
    "promptTitle": "값을 입력하세요",
    "promptCancel": "취소",
    "promptOk": "확인"
  },
  "modalNavbar": {
    "back": "뒤로",
    "close": "닫기"
  },
  "viewSettingsModal": {
    "buttonLabel": "설정",
    "description": "이 모듈에 특정한 설정",
    "close": "닫기"
  },
  "floatingTerminal": {
    "newSnippet": "새 스니펫",
    "close": "닫기",
    "name": "이름",
    "namePlaceholder": "예: Postfix 재시작",
    "category": "카테고리",
    "tags": "태그",
    "tagsHelp": "태그는 선택한 카테고리에 따라 달라집니다",
    "command": "명령",
    "monacoHelp": "셸 구문용 Monaco. 편집기에서 저장하려면 Ctrl+Enter를 사용하세요.",
    "cancel": "취소",
    "save": "저장"
  },
  "installModal": {
    "running": "설치 중… 몇 분 정도 걸릴 수 있습니다.",
    "success": "설치가 완료되었습니다.",
    "failed": "설치에 실패했습니다. 로그를 확인하세요."
  },
  "enterPage": {
    "pageTitle": "코드로 입장",
    "heading": "액세스 코드로 입장",
    "subtitle": "수신한 코드를 입력하여 패널에 접근하세요.",
    "codeLabel": "액세스 코드",
    "codePlaceholder": "예: a1b2c3d4e5f6g7",
    "continue": "계속",
    "useAnotherCode": "다른 코드 사용",
    "codeShort": "코드",
    "terminalAi": "터미널 / AI",
    "enter": "입장",
    "willBeRedirected": "패널 로그인 페이지로 이동합니다.",
    "featuresAvailable": "사용 가능",
    "featuresUnavailable": "사용 불가",
    "invalidCode": "유효하지 않은 액세스 코드입니다.",
    "verifyError": "코드를 확인할 수 없습니다. 다시 시도하세요.",
    "networkError": "네트워크 오류. 다시 시도하세요.",
    "guestSessionError": "게스트 세션을 시작할 수 없습니다."
  },
  "dragHandle": "드래그하여 순서 변경",
  "logoAlt": "LUXIPANEL",
  "default": " (기본값)",
  "emptyCell": "-",
  "loginEffects": {
    "defaultSuffix": " (기본값)",
    "webGpuHint": "WebGPU가 필요합니다. 지원하지 않는 브라우저에서는 기본 배경이 표시됩니다."
  },
  "tableSettings": {
    "pagination": "페이지 나누기",
    "rowsPerPage": "이 표에서 페이지당 표시할 행 수입니다.",
    "visibleActions": "표시할 작업",
    "actionsHint": "각 행의 «···» 메뉴에 표시할 작업을 선택하세요."
  }
} as const;

export default components;
