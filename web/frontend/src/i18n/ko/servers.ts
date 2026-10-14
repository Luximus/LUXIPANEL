const servers = {
  "pageTitle": "서버",
  "description": "이 패널이 연결할 수 있는 SSH 대상의 로컬 목록입니다. 비밀 정보(키와 비밀번호)는 암호화되어 저장되며 여기에 표시되지 않습니다.",
  "btnNew": "서버 추가",
  "table": {
    "name": "이름",
    "host": "호스트",
    "username": "사용자",
    "authType": "인증",
    "status": "상태"
  },
  "authTypes": {
    "key": "SSH 키",
    "password": "비밀번호"
  },
  "status": {
    "approved": "승인됨",
    "pending": "대기 중",
    "untested": "테스트 전"
  },
  "common": {
    "test": "테스트",
    "edit": "편집",
    "delete": "삭제",
    "cancel": "취소",
    "save": "저장",
    "close": "닫기",
    "error": "오류",
    "yes": "예",
    "no": "아니요"
  },
  "dialog": {
    "titleNew": "서버 추가",
    "titleEdit": "서버 편집",
    "name": "이름",
    "namePlaceholder": "내 운영 서버",
    "host": "호스트 또는 IP",
    "hostPlaceholder": "203.0.113.10 또는 server.example.com",
    "port": "포트",
    "username": "사용자",
    "usernamePlaceholder": "root",
    "authType": "인증 방식",
    "secretKey": "SSH 개인 키",
    "secretKeyPlaceholder": "-----BEGIN OPENSSH PRIVATE KEY-----",
    "passphrase": "키 암호(선택 사항)",
    "passphrasePlaceholder": "키 잠금 해제 암호",
    "secretPassword": "비밀번호",
    "secretPasswordPlaceholder": "SSH 사용자 비밀번호",
    "secretKeepHint": "현재 비밀 정보를 유지하려면 비워 두세요.",
    "btnCancel": "취소",
    "btnSave": "저장"
  },
  "fingerprint": {
    "title": "호스트 지문 승인",
    "intro": "이 서버에 처음 연결합니다. 승인하기 전에 호스트 키 지문이 예상한 값과 일치하는지 확인하세요.",
    "approve": "지문 승인",
    "approving": "승인 중…",
    "approved": "지문이 승인되었습니다",
    "approveError": "지문을 승인할 수 없습니다"
  },
  "toasts": {
    "created": "서버가 추가되었습니다",
    "updated": "서버가 업데이트되었습니다",
    "deleted": "서버가 삭제되었습니다",
    "testOk": "연결 성공",
    "testFailed": "연결 실패"
  },
  "validation": {
    "nameRequired": "이름을 입력하세요",
    "hostRequired": "호스트를 입력하세요",
    "usernameRequired": "사용자를 입력하세요",
    "secretRequired": "인증 비밀 정보를 입력하세요"
  },
  "confirmDelete": "서버 {name}을(를) 삭제할까요? 이 작업은 취소할 수 없습니다.",
  "confirmDeleteTitle": "서버 삭제",
  "testing": "연결 테스트 중…"
} as const;

export default servers;
