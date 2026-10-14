const moduleCatalog = {
  "users": {
    "name": "사용자",
    "description": "패널 사용자, 역할 및 권한 관리."
  },
  "mail": {
    "name": "메일",
    "description": "SMTP / IMAP, 도메인 및 사용자 메일함."
  },
  "monitor": {
    "name": "모니터",
    "description": "CPU, RAM, 디스크 및 프로세스의 실시간 지표."
  },
  "files": {
    "name": "파일",
    "description": "통합 편집기를 갖춘 원격 파일 탐색기."
  },
  "firewall": {
    "name": "방화벽",
    "description": "UFW 규칙 관리 및 IP 차단."
  },
  "bitninja": {
    "name": "BitNinja",
    "description": "통합 보안 에이전트: WAF, anti-DoS, 멀웨어 탐지 및 IP 평판."
  },
  "assistant": {
    "name": "AI 에이전트",
    "description": "진단 및 자동화를 위한 AI 어시스턴트."
  },
  "repository-store": {
    "name": "GitHub",
    "description": "저장소 카탈로그 및 가이드 방식 설치."
  },
  "dns": {
    "name": "Nginx",
    "description": "Nginx 관리: 사이트, 리버스 프록시, SSL, 로그 및 상태."
  },
  "backups": {
    "name": "백업",
    "description": "암호화 및 다중 대상을 지원하는 예약 백업."
  },
  "cron": {
    "name": "Cron",
    "description": "시각적 편집기로 관리하는 예약 작업."
  },
  "databases": {
    "name": "데이터베이스",
    "description": "데이터베이스 관리자(MySQL/MariaDB 및 PostgreSQL): 스키마 탐색 및 SQL 콘솔."
  },
  "obsidian": {
    "name": "Obsidian",
    "description": "서버에 보관하는 Obsidian 노트 볼트: 마크다운 편집기, 위키링크, 어시스턴트의 AI 에이전트가 다루는 노트."
  },
  "cloudflare": {
    "name": "Cloudflare",
    "description": "서버용 Cloudflare 관리: DNS, 캐시, SSL/TLS, 개발 모드 및 IP 접근 규칙."
  },
  "server-alerts": {
    "name": "알림",
    "description": "패널 소유자를 위한 서버 알림: 경보 환경설정, 즉시·예약/반복 알림, 지표 기반 규칙(CPU/RAM/디스크/부하/서비스 다운), LP를 통해 기기로 전달."
  },
  "expo": {
    "name": "Expo",
    "description": "Expo/React Native 앱 관리: EAS 빌드, 스토어 제출, OTA 업데이트, 개발 클라이언트 QR 및 할당량을 고객 액세스 토큰으로 처리."
  },
  "webhooks": {
    "name": "Webhooks",
    "description": "패널 이벤트의 HTTP 알림."
  },
  "openclaw": {
    "name": "OpenClaw",
    "description": "모델 선택기를 갖춘 OpenClaw AI 연결."
  },
  "hosting": {
    "name": "호스팅",
    "description": "사이트, 가상 호스트 및 보조 방식 배포."
  },
  "terminal": {
    "name": "터미널",
    "description": "패널의 어떤 화면에서도 접근할 수 있는 플로팅 터미널. 플로팅 버튼을 켜거나 끕니다."
  },
  "module-dev": {
    "name": "내 모듈",
    "description": "마켓플레이스 모듈의 수명 주기: 검토 상태, 제출, 테스트 및 비공개 미리보기."
  },
  "filesystem-mcp": {
    "name": "Filesystem MCP",
    "description": "파일시스템 작업을 위한 MCP."
  },
  "github-mcp": {
    "name": "GitHub MCP",
    "description": "GitHub API 작업을 위한 MCP."
  },
  "google-drive": {
    "name": "Google Drive",
    "description": "어시스턴트 채팅에서 Google Drive 문서를 검색하고 첨부합니다."
  },
  "onedrive": {
    "name": "OneDrive",
    "description": "채팅에서 Microsoft OneDrive / SharePoint 파일에 접근합니다."
  },
  "dropbox": {
    "name": "Dropbox",
    "description": "채팅에서 Dropbox 파일을 검색하고 첨부합니다."
  },
  "notion": {
    "name": "Notion",
    "description": "채팅에서 Notion 페이지와 데이터베이스를 조회합니다."
  }
} as const;

export default moduleCatalog;
