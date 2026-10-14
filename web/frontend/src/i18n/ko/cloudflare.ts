const cloudflare = {
  "options": {
    "essentiallyOff": "사실상 꺼짐",
    "low": "낮음",
    "medium": "중간",
    "high": "높음"
  },
  "pageTitle": "Cloudflare",
  "header": {
    "heading": "Cloudflare",
    "subheading": "이 서버의 Cloudflare 존에 대한 DNS, 캐시, SSL/TLS 및 보안을 관리합니다."
  },
  "config": {
    "title": "Cloudflare 연결",
    "tokenLabel": "API 토큰",
    "tokenPlaceholder": "Cloudflare API 토큰",
    "tokenHint": "dash.cloudflare.com → My Profile → API Tokens에서 존 권한(DNS, Cache Purge, Zone Settings, Firewall Services)을 가진 토큰을 생성하세요.",
    "save": "저장",
    "test": "연결 테스트",
    "clear": "토큰 제거",
    "tokenSet": "토큰이 구성됨",
    "tokenMissing": "시작하려면 API Token을 구성하세요",
    "saved": "토큰이 저장되었습니다",
    "cleared": "토큰이 제거되었습니다",
    "confirmClear": "Cloudflare 토큰을 제거하시겠습니까?",
    "confirmClearBtn": "제거"
  },
  "zones": {
    "title": "존",
    "select": "존을 선택하세요",
    "empty": "이 토큰으로 표시되는 존이 없습니다.",
    "status": "상태",
    "plan": "플랜",
    "nameServers": "네임 서버",
    "domainNotFound": "도메인 {domain}은(는) 토큰의 어떤 영역에도 속하지 않습니다"
  },
  "runtime": {
    "active": "활성",
    "pending": "대기 중",
    "initializing": "초기화 중",
    "moved": "이동됨",
    "paused": "일시 중지됨",
    "pausedHint": "영역이 일시 중지되었습니다. DNS를 변경하기 전에 설정을 확인하세요.",
    "inactiveHint": "영역 {status}: 등록기관에서 네임서버를 확인하세요.",
    "activeHint": "활성 영역 · 네임서버 {count}개가 설정되었습니다."
  },
  "tabs": {
    "dns": "DNS",
    "cache": "캐시",
    "security": "SSL / 보안",
    "access": "접근 규칙",
    "config": "설정"
  },
  "dns": {
    "title": "DNS 레코드",
    "add": "레코드 추가",
    "type": "유형",
    "name": "이름",
    "content": "내용",
    "ttl": "TTL",
    "proxied": "프록시",
    "pointsToServer": "이 서버를 가리킴",
    "edit": "편집",
    "delete": "삭제",
    "confirmDelete": "{name} 레코드를 삭제하시겠습니까?",
    "saved": "레코드가 저장되었습니다",
    "deleted": "레코드가 삭제되었습니다",
    "useServerIp": "서버 IP 사용",
    "priority": "우선순위",
    "confirmDeleteTitle": "레코드 삭제",
    "typeA": "A",
    "typeAAAA": "AAAA",
    "typeCNAME": "CNAME",
    "typeTXT": "TXT",
    "typeMX": "MX",
    "typeNS": "NS",
    "ttlAuto": "자동",
    "ttl60": "60",
    "ttl300": "300",
    "ttl1800": "1800",
    "ttl3600": "3600",
    "ttl86400": "86400"
  },
  "cache": {
    "title": "캐시",
    "purgeAll": "모두 퍼지",
    "purgeAllHint": "Cloudflare에서 해당 존의 캐시된 콘텐츠를 모두 제거합니다.",
    "confirmPurgeAll": "이 존의 모든 캐시를 퍼지하시겠습니까?",
    "purgeUrls": "URL 퍼지",
    "purgeUrlsPlaceholder": "https://example.com/styles.css (한 줄에 URL 하나)",
    "purged": "캐시가 퍼지되었습니다",
    "devMode": "개발 모드",
    "devModeHint": "Cloudflare 캐시를 일시적으로 우회합니다 (3시간 후 자동으로 꺼집니다).",
    "confirmPurgeTitle": "캐시 제거",
    "confirmPurgeBtn": "제거"
  },
  "security": {
    "title": "SSL / 보안",
    "sslMode": "SSL/TLS 모드",
    "alwaysHttps": "항상 HTTPS 사용",
    "securityLevel": "보안 수준",
    "underAttack": "공격 대응 모드",
    "updated": "설정이 업데이트되었습니다",
    "sslOff": "끄기",
    "sslFlexible": "유연",
    "sslFull": "전체",
    "sslFullStrict": "전체 (엄격)"
  },
  "access": {
    "title": "IP 접근 규칙",
    "add": "규칙 추가",
    "mode": "동작",
    "block": "차단",
    "allow": "허용",
    "challenge": "챌린지",
    "ip": "IP / 범위",
    "notes": "메모",
    "empty": "이 존에는 접근 규칙이 없습니다.",
    "confirmDelete": "{ip}에 대한 규칙을 삭제하시겠습니까?",
    "created": "규칙이 생성되었습니다",
    "deleted": "규칙이 삭제되었습니다",
    "ipHeader": "IP",
    "confirmDeleteTitle": "규칙 삭제"
  },
  "common": {
    "loading": "불러오는 중...",
    "error": "오류",
    "save": "저장",
    "cancel": "취소",
    "delete": "삭제",
    "refresh": "새로 고침",
    "serverIp": "서버 IP",
    "noToken": "설정 탭에서 Cloudflare API Token을 구성하세요."
  },
  "settingsUi": {
    "title": "Cloudflare 설정",
    "description": "Cloudflare 모듈의 표 환경설정입니다.",
    "access": "접근",
    "credentialsConnections": "인증 정보 및 연결",
    "cloudflareToken": "Cloudflare 토큰",
    "serverFirewall": "서버 방화벽",
    "dnsWebhooks": "Webhooks의 DNS 이벤트"
  }
} as const;

export default cloudflare;
