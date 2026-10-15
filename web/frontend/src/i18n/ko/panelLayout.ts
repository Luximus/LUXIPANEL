const panelLayout = {
  "community": {
    "title": "커뮤니티 및 버전",
    "comments": "댓글",
    "read": "읽음으로 표시",
    "empty": "새 소식 없음",
    "notes": "출시 안내",
    "update": "업데이트",
    "updating": "업데이트 중…",
    "installed": "설치됨",
    "version": "버전",
    "openGithub": "GitHub에서 열기",
    "close": "닫기",
    "newVersion": "새 버전이 있습니다",
    "translating": "AI로 번역 중…",
    "showOriginal": "원문 보기",
    "showTranslation": "번역 보기",
    "translationUnavailable": "AI 번역을 사용할 수 없어 원문을 표시합니다.",
    "allComments": "GitHub에서 모든 댓글 보기",
    "activity": "커뮤니티 활동",
    "loading": "불러오는 중…",
    "loadError": "정보를 불러올 수 없습니다."
},
  "groups": {
    "main": "메인",
    "system": "시스템",
    "admin": "관리",
    "tools": "도구",
    "modules": "모듈"
  },
  "nav": {
    "monitor": "모니터",
    "files": "파일",
    "firewall": "방화벽",
    "bitninja": "BitNinja",
    "users": "사용자",
    "assistant": "AI 에이전트",
    "terminal": "터미널",
    "modules": "모듈",
    "githubStore": "GitHub",
    "settings": "설정",
    "mail": "메일",
    "dns": "NGINX",
    "backups": "백업",
    "cron": "Cron",
    "databases": "데이터베이스",
    "obsidian": "Obsidian",
    "cloudflare": "Cloudflare",
    "serverAlerts": "알림",
    "ssl": "SSL",
    "webhooks": "Webhooks",
    "hosting": "호스팅",
    "openclaw": "OpenClaw",
    "preferences": "내 환경설정",
    "moduleDev": "모듈 개발",
    "expo": "Expo",
    "codebaseGraph": "코드베이스 그래프"
  },
  "actions": {
    "closeSession": "로그아웃",
    "closingSession": "로그아웃 중…",
    "openMenu": "메뉴 열기",
    "openHistory": "기록 열기",
    "openCommandPalette": "명령 팔레트 열기",
    "search": "검색...",
    "settings": "구성",
    "switchTheme": "테마 변경",
    "notifications": "알림",
    "chat": "메시지",
    "navigate": "이동",
    "open": "열기",
    "close": "닫기",
    "toggleFilesEditor": "파일 편집기",
    "noResults": "결과 없음:",
    "lightMode": "라이트 모드로 전환",
    "darkMode": "다크 모드로 전환"
  },
  "superSearch": {
    "placeholder": "LUXIPANEL 검색… (화면, 설정, 작업)",
    "triggerLabel": "LUXIPANEL 검색",
    "recent": "최근",
    "suggestions": "추천",
    "aiSuggested": "AI 추천",
    "noResults": "결과 없음",
    "hint": "원하는 작업을 입력하세요: “사용자 편집”, “메일 계정 만들기”, “다크 모드”…",
    "kinds": {
      "view": "화면",
      "subview": "페이지",
      "tab": "탭",
      "drawer-section": "섹션",
      "action": "작업"
    },
    "groups": {
      "actions": "작업",
      "views": "화면"
    }
  },
  "clock": {
    "serverTimeTitle": "서버 시간"
  },
  "serverSwitcher": {
    "label": "서버 전환",
    "title": "서버 전환",
    "currentOption": "{server} (전환)",
    "connectingTitle": "서버에 연결 중...",
    "connectingStatus": "새 연결 세션을 준비하는 중입니다.",
    "changeServer": "서버 변경...",
    "localOption": "로컬 (이 서버)",
    "manageServers": "서버 관리...",
    "viewServers": "서버 보기...",
    "noOtherServers": "다른 활성 서버가 없습니다",
    "sshKeyFallback": "키 {n}",
    "chooseSshKey": "SSH 키 선택",
    "chooseSshKeyHelp": "이 서버에 구성된 사용자가 여러 명입니다. 연결할 사용자를 선택하세요.",
    "cancel": "취소",
    "openingConnection": "새 서버와 보안 연결을 여는 중...",
    "unknownError": "알 수 없는 오류",
    "switchFailedStatus": "서버를 변경할 수 없습니다 ({detail}).",
    "switchFailedAlert": "새 서버에 연결할 수 없습니다: {detail}",
    "connectionErrorTitle": "연결 오류",
    "returnButton": "돌아가기",
    "returnTitle": "로컬 서버로 돌아가기"
  },
  "notificationsPanel": {
    "title": "알림",
    "subtitle": "시스템, 모듈 및 AI 메시지",
    "markAllTitle": "모두 읽음으로 표시",
    "filters": {
      "all": "전체",
      "system": "시스템",
      "module": "모듈",
      "ai": "AI",
      "security": "보안",
      "user": "채팅"
    },
    "loading": "로딩 중...",
    "clearAll": "모두 지우기",
    "connecting": "연결 중...",
    "live": "실시간",
    "retrying": "다시 시도 중...",
    "disconnected": "연결 끊김",
    "errorLoad": "알림을 불러올 수 없습니다.",
    "empty": "알림이 없습니다.",
    "emptyFiltered": "이 필터에 알림이 없습니다.",
    "dismiss": "알림 삭제",
    "sources": {
      "system": "시스템",
      "module": "모듈",
      "ai": "AI",
      "security": "보안",
      "user": "채팅"
    },
    "severity": {
      "info": "정보",
      "success": "성공",
      "warning": "경고",
      "error": "오류"
    },
    "relative": {
      "now": "방금",
      "min": "{n}분 전",
      "h": "{n}시간 전",
      "d": "{n}일 전",
      "mo": "{n}개월 전",
      "y": "{n}년 전"
    }
  },
  "chatPanel": {
    "title": "메시지",
    "newConversation": "새 대화",
    "seeMore": "더 보기",
    "loading": "로딩 중...",
    "empty": "아직 대화가 없습니다.",
    "errorLoad": "채팅을 불러올 수 없습니다.",
    "connecting": "연결 중...",
    "live": "실시간",
    "retrying": "다시 시도 중...",
    "disconnected": "연결 끊김",
    "you": "나",
    "attachment": "첨부 파일",
    "newMessage": "새 메시지",
    "newMessageIn": "{title}의 새 메시지",
    "unknownUser": "사용자",
    "callIncoming": "수신 전화",
    "callIncomingHint": "실시간 번역 음성",
    "callAccept": "수락",
    "callReject": "거절"
  },
  "commandSub": {
    "main": "메인",
    "system": "시스템",
    "admin": "관리",
    "tools": "도구",
    "account": "계정",
    "action": "작업"
  },
  "defaultUser": "사용자",
  "logoAlt": "LUXIPANEL",
  "searchEntries": {
    "view.chat": "내부 채팅",
    "chat.action.new-conversation": "새 대화",
    "chat.media": "대화의 미디어",
    "chat.call": "통화",
    "chat.settings": "메시지 설정",
    "chat.settings.general": "Chat · 일반",
    "chat.settings.presence": "Chat · 상태",
    "chat.settings.calls": "Chat · 통화",
    "chat.settings.appearance": "Chat · 모양",
    "chat.settings.groups": "Chat · 그룹",
    "users.tab.users": "사용자",
    "users.tab.roles": "역할",
    "users.action.new-user": "새 사용자",
    "users.action.new-role": "새 역할",
    "mail.tab.emails": "계정",
    "mail.action.new-account": "새 메일 계정",
    "mail.tab.spam": "스팸 필터",
    "mail.tab.track": "전송 추적",
    "mail.tab.global-filters": "전역 필터",
    "mail.settings.routing": "이메일 라우팅",
    "mail.settings.domain-redirect": "도메인 전달",
    "mail.settings.default-address": "기본 주소",
    "mail.settings.archive": "메일 보관",
    "mail.settings.encryption": "암호화",
    "mail.settings.outbound": "발신 메일",
    "mail.subview.compose": "작성",
    "nginx.action.new-site": "새 사이트",
    "nginx.action.https": "HTTPS / SSL 인증서 활성화",
    "nginx.action.proxy": "리버스 프록시 대상",
    "nginx.action.edit-conf": "nginx.conf 편집",
    "firewall.action.new-rule": "새 규칙",
    "firewall.action.ban-ip": "IP 차단",
    "firewall.action.audit": "보안 감사",
    "backups.action.now": "지금 백업",
    "backups.action.new-storage": "새 스토리지",
    "backups.action.new-schedule": "새 일정",
    "cron.action.new-agent": "새 AI 작업",
    "databases.tab.rows": "행",
    "databases.tab.structure": "구조",
    "databases.tab.console": "SQL 콘솔",
    "cloudflare.tab.dns": "DNS",
    "cloudflare.tab.cache": "캐시",
    "cloudflare.tab.security": "보안",
    "cloudflare.tab.access": "접근",
    "cloudflare.tab.config": "설정",
    "webhooks.tab.receive": "수신",
    "webhooks.tab.mailhook": "메일훅",
    "webhooks.tab.response": "웹훅 응답",
    "webhooks.tab.webhooks": "발신 웹훅",
    "webhooks.tab.keys": "API 키",
    "webhooks.tab.discovered": "감지됨",
    "server-alerts.tab.prefs": "환경설정",
    "server-alerts.tab.send": "보내기",
    "server-alerts.tab.scheduled": "예약됨",
    "server-alerts.tab.rules": "알림 규칙",
    "repository-store.tab.saved": "저장됨",
    "repository-store.tab.cloned": "복제됨",
    "repository-store.tab.update": "업데이트",
    "modules.tab.installed": "설치됨",
    "modules.tab.integrations": "통합",
    "settings.tab.general": "일반",
    "settings.tab.layout": "디자인 및 브랜딩",
    "settings.tab.security": "보안",
    "settings.tab.credentials": "자격 증명",
    "settings.credentials.elevenlabs": "ElevenLabs 자격 증명",
    "settings.credentials.tolqia": "Tolqia API 토큰",
    "settings.tab.servers": "서버",
    "settings.tab.modules": "모듈 및 캐시",
    "settings.tab.system": "시스템",
    "preferences.section.profile": "프로필",
    "preferences.section.password": "비밀번호 변경",
    "preferences.section.passkeys": "Passkeys",
    "preferences.section.2fa": "2단계 인증 (2FA)",
    "preferences.section.audit": "활동 로그",
    "assistant.settings.general": "일반",
    "assistant.settings.agentes": "에이전트",
    "assistant.settings.providers": "공급자",
    "assistant.settings.modules": "모듈 및 도구",
    "assistant.settings.stats": "사용량 및 비용",
    "assistant.settings.access": "접근 및 승인",
    "assistant.action.new-conversation": "새 AI 대화",
    "assistant.action.new-project": "새 프로젝트",
    "action.theme-dark": "다크 모드로 전환",
    "action.theme-light": "라이트 모드로 전환",
    "action.language": "언어 변경",
    "action.server-switcher": "서버 전환",
    "action.sidebar-toggle": "메뉴 접기 또는 펼치기",
    "action.logout": "로그아웃"
  },
  "workspaceViews": {
    "assistant": {
      "chat": "대화"
    },
    "users": {
      "users": "사용자",
      "roles": "그룹"
    },
    "monitor": {
      "history": "기록",
      "processes": "프로세스"
    },
    "files": {
      "browser": "탐색기",
      "editor": "편집기"
    },
    "firewall": {
      "audit": "감사",
      "rules": "UFW 규칙",
      "fail2ban": "Fail2ban"
    },
    "bitninja": {
      "status": "상태",
      "components": "구성 요소",
      "logs": "레코드"
    },
    "mail": {
      "emails": "이메일",
      "spam-filters": "스팸 필터",
      "track-delivery": "전달",
      "global-filters": "필터"
    },
    "dns": {
      "overview": "개요",
      "sites": "사이트와 HTTPS",
      "proxy": "트래픽",
      "perf": "성능",
      "logs": "로그",
      "status": "서비스"
    },
    "nginx": {
      "overview": "개요",
      "sites": "사이트와 HTTPS",
      "proxy": "트래픽",
      "perf": "성능",
      "logs": "로그",
      "status": "서비스"
    },
    "backups": {
      "overview": "상태",
      "schedules": "예약",
      "history": "기록"
    },
    "cron": {
      "jobs": "작업",
      "agents": "AI 에이전트"
    },
    "databases": {
      "databases": "데이터베이스",
      "tables": "테이블",
      "console": "SQL 콘솔"
    },
    "obsidian": {
      "vaults": "보관함과 메모",
      "editor": "편집기"
    },
    "cloudflare": {
      "dns": "DNS",
      "cache": "캐시",
      "security": "보안",
      "access": "접근",
      "config": "설정"
    },
    "server-alerts": {
      "prefs": "환경설정",
      "send": "보내기",
      "scheduled": "예약됨",
      "rules": "규칙",
      "history": "기록"
    },
    "expo": {
      "account": "계정",
      "projects": "프로젝트",
      "builds": "빌드",
      "store": "스토어",
      "environment": "변수"
    },
    "module-dev": {
      "my-modules": "내 모듈",
      "project-map": "프로젝트 맵"
    },
    "terminal": {
      "terminal": "터미널"
    },
    "repository-store": {
      "all": "찾아보기",
      "saved": "저장됨",
      "cloned": "복제됨",
      "update": "업데이트"
    },
    "webhooks": {
      "receive": "수신",
      "webhooks": "웹훅",
      "keys": "키",
      "discovered": "감지됨"
    },
    "openclaw": {
      "assistant": "어시스턴트"
    },
    "hosting": {
      "accounts": "계정",
      "new": "새 계정"
    },
    "codebase-graph": {
      "graph": "시각적 그래프",
      "symbols": "심볼"
    },
    "preferences": {
      "profile": "프로필",
      "security": "보안",
      "audit": "활동"
    },
    "settings": {
      "settings": "구성"
    },
    "modules": {
      "catalog": "카탈로그"
    },
    "chat": {
      "chat": "채팅"
    },
    "_default": {
      "overview": "개요"
    }
  },
  "workspace": {
    "closeModuleBackToChat": "모듈을 닫고 채팅으로 돌아가기",
    "module": "모듈",
    "loadingModule": "모듈 불러오는 중…",
    "moduleFrameTitle": "LUXIPANEL 모듈",
    "loadingSettings": "설정 불러오는 중…",
    "closeHistory": "기록 닫기"
  }
} as const;

export default panelLayout;
