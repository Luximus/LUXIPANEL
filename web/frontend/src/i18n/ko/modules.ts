const modules = {
  "pageTitle": "모듈",
  "header": {
    "heading": "모듈 및 연동",
    "subheading": "사이드 메뉴에 표시되는 사전 설치된 모듈을 활성화하거나 숨깁니다"
  },
  "search": {
    "placeholder": "모듈 검색..."
  },
  "tabs": {
    "all": "전체",
    "modules": "모듈",
    "integrations": "통합",
    "visible": "표시됨"
  },
  "stats": {
    "visible": "표시됨:",
    "hidden": "숨김:",
    "systemNote": "시스템 모듈은 사전 설치 상태로 유지됩니다"
  },
  "categories": {
    "label": "카테고리",
    "all": "전체",
    "communication": "커뮤니케이션",
    "infrastructure": "인프라",
    "security": "보안",
    "developer": "개발자"
  },
  "statusFilter": {
    "label": "상태",
    "all": "전체",
    "visible": "표시됨",
    "hidden": "숨김"
  },
  "empty": {
    "title": "모듈을 찾을 수 없습니다",
    "subtitle": "다른 검색어나 카테고리를 시도해 보세요"
  },
  "errors": {
    "loadTitle": "모듈 로드 오류",
    "loadSubtitle": "모듈 목록을 가져올 수 없습니다"
  },
  "labels": {
    "metaVersion": "버전",
    "metaInstalls": "설치 수",
    "metaRating": "평점",
    "metaAuthor": "작성자",
    "metaCreatedAt": "생성일",
    "metaUpdatedAt": "최종 업데이트",
    "kindIntegration": "통합",
    "kindModule": "모듈",
    "tagFree": "무료",
    "tagLicense": "라이선스 필요",
    "statusVisible": "메뉴에 표시",
    "statusHidden": "숨김",
    "dragHandle": "드래그하여 순서 변경",
    "menuToggle": "사이드 메뉴에 표시",
    "moduleToggle": "모듈 활성화",
    "fabToggle": "플로팅 버튼 표시"
  },
  "toasts": {
    "moduleVisible": "{name} 표시됨",
    "moduleHidden": "{name} 숨겨짐",
    "moduleVisibleWithDeps": "{name} 표시됨 (함께 활성화됨: {deps})",
    "moduleHiddenWithDeps": "{name} 숨겨짐 (함께 활성화됨: {deps})",
    "moduleUpdateError": "{name}을(를) 업데이트할 수 없습니다",
    "sidebarShown": "{name}이(가) 메뉴에 표시됨",
    "sidebarHidden": "{name}이(가) 메뉴에서 숨겨짐",
    "fabShown": "{name}: 플로팅 버튼 활성화",
    "fabHidden": "{name}: 플로팅 버튼 비활성화",
    "orderSaved": "순서 저장됨",
    "orderError": "순서를 저장할 수 없습니다",
    "orderHttpError": "순서를 저장할 수 없습니다 ({status})"
  }
} as const;

export default modules;
