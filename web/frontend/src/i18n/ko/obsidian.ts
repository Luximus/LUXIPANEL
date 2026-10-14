const obsidian = {
  "workspace": {
    "settingsTitle": "Obsidian 설정",
    "settingsDescription": "개인 보기와 Vault 관리",
    "appearance": "모양",
    "shortcuts": "단축키",
    "vaults": "보관함",
    "aiIntegration": "AI 연동",
    "personalHint": "이 서버의 사용자 계정에 저장됩니다.",
    "defaultView": "기본 Markdown 보기",
    "edit": "편집",
    "preview": "미리 보기",
    "split": "분할",
    "fontSize": "글자 크기",
    "saved": "저장됨",
    "shortcutsHint": "이 작업 공간의 키보드 단축키입니다.",
    "saveShortcut": "노트 저장",
    "searchShortcut": "검색에 집중",
    "vaultsHint": "이 서버의 Vault를 등록하고 관리합니다.",
    "aiHint": "컨텍스트 파일을 준비하고 컨테이너를 동기화합니다.",
    "today": "오늘의 노트",
    "quickEntry": "빠른 입력",
    "quickEntryHint": "오늘의 노트 끝에 내용을 추가합니다.",
    "append": "항목 추가",
    "editorPane": "편집기",
    "mobileView": "작업 공간 보기",
    "clearSearch": "지우기",
    "askAdmin": "관리자에게 이 서버의 Vault 등록을 요청하세요.",
    "available": "사용 가능",
    "missing": "사용 불가",
    "notesCount": "노트",
    "noVault": "Vault 없음",
    "readOnly": "읽기 전용",
    "entryRequired": "추가할 내용을 먼저 입력하세요.",
    "entryError": "내용을 추가하지 못했습니다.",
    "previewError": "미리 보기를 불러오지 못했습니다.",
    "entryAdded": "내용이 추가되었습니다."
  },
  "pageTitle": "Obsidian",
  "header": {
    "heading": "Obsidian 볼트",
    "subheading": "연결된 서버의 볼트, 마크다운 노트, [[wikilink]] 연결을 관리합니다."
  },
  "toolbar": {
    "newVault": "새 볼트",
    "unregister": "등록 해제",
    "prepareAi": "AI 에이전트용 준비",
    "searchPlaceholder": "노트 검색...",
    "syncContainers": "컨테이너 동기화"
  },
  "tree": {
    "title": "노트",
    "newNote": "새 노트",
    "newFolder": "새 폴더"
  },
  "editor": {
    "emptyTitle": "노트를 선택하세요",
    "emptyDescription": "노트 내용이 여기에 표시되어 편집할 수 있습니다.",
    "save": "저장",
    "links": "링크",
    "analyzeAi": "AI로 분석",
    "unsavedChanges": "저장되지 않은 변경 사항"
  },
  "vaultDialog": {
    "title": "새 볼트",
    "labelName": "이름",
    "placeholderName": "내 볼트",
    "labelPath": "서버의 절대 경로",
    "placeholderPath": "/home/usuario/vaults/mi-vault",
    "btnBrowse": "찾아보기",
    "modeCreate": "새 폴더 만들기",
    "modeCreateHint": "서버에 볼트 폴더(및 .obsidian 마커)를 생성합니다.",
    "modeRegister": "기존 폴더 등록",
    "modeRegisterHint": "서버에 이미 존재하는 볼트 폴더를 사용합니다.",
    "btnCancel": "취소",
    "btnSave": "저장"
  },
  "pathBrowserDialog": {
    "title": "폴더 선택",
    "btnUp": "위로",
    "btnCancel": "취소",
    "btnSelect": "이 폴더 사용"
  },
  "inputDialog": {
    "btnCancel": "취소",
    "btnOk": "확인"
  },
  "search": {
    "title": "검색 결과"
  },
  "empty": {
    "noVaultsTitle": "등록된 볼트 없음",
    "noVaultsDescription": "Obsidian 볼트를 만들거나 등록하여 서버에서 노트 작업을 시작하세요.",
    "noVaultsCta": "새 볼트",
    "treeNoNotes": "볼트에 아직 노트가 없습니다.",
    "searchNoResults": "\"{q}\"에 대한 결과 없음."
  },
  "confirm": {
    "discardDirtyBody": "현재 노트에 저장되지 않은 변경 사항이 있습니다. 버리시겠습니까?",
    "discardDirtyTitle": "저장되지 않은 변경 사항",
    "discardDirtyConfirm": "버리기",
    "discardDirtyCancel": "계속 편집",
    "unregisterBody": "볼트 \"{name}\"의 등록을 해제하시겠습니까? 서버의 파일은 삭제되지 않습니다.",
    "unregisterTitle": "볼트 등록 해제",
    "unregisterConfirm": "등록 해제",
    "overwriteContextBody": "컨텍스트 파일이 이미 존재합니다({skipped}). 덮어쓰시겠습니까?",
    "overwriteContextTitle": "컨텍스트 덮어쓰기",
    "overwriteContextConfirm": "덮어쓰기",
    "deleteNoteBody": "\"{path}\" 노트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
    "deleteNoteTitle": "노트 삭제",
    "deleteNoteConfirm": "삭제"
  },
  "actions": {
    "retry": "다시 시도",
    "rename": "이름 변경",
    "delete": "삭제",
    "newNoteInputTitle": "새 노트",
    "newFolderInputTitle": "새 폴더",
    "renameInputTitle": "노트 이름 변경",
    "analyzeAiPrompt": "저는 LUXIPANEL의 Obsidian 모듈에서 Obsidian 볼트 \"{vaultName}\"(서버의 볼트 경로: {vaultPath})으로 작업 중이며, \"{notePath}\" 노트를 다루고 싶습니다.\n\nobsidian.* 도구(볼트의 노트 읽기/검색/생성/연결)를 사용하여:\n1. 노트를 읽고 핵심 내용을 요약하세요.\n2. 발신 [[wikilink]] 및 백링크를 검토하세요.\n3. 볼트 내 다른 관련 노트에 대한 내용, 구조 및 새 링크 개선을 제안하세요.\n\n노트에 변경을 적용하기 전에 먼저 물어봐 주세요."
  },
  "errors": {
    "loadVaults": "볼트를 불러올 수 없습니다",
    "vaultMissing": "서버에 볼트 폴더가 없습니다({path}). 등록을 해제하거나 폴더를 복원하세요.",
    "nameAndPathRequired": "이름과 경로는 필수입니다",
    "pathMustBeAbsolute": "경로는 절대 경로여야 합니다(/ 로 시작)",
    "createVault": "볼트를 생성할 수 없습니다",
    "unregisterVault": "볼트 등록을 해제할 수 없습니다",
    "prepareContext": "AI 컨텍스트를 준비할 수 없습니다",
    "syncContainers": "컨테이너를 동기화할 수 없습니다",
    "loadTree": "트리 로드 오류",
    "openNote": "노트를 열 수 없습니다",
    "saveNote": "노트를 저장할 수 없습니다",
    "noVaultSelected": "먼저 볼트를 선택하세요",
    "createNote": "노트를 생성할 수 없습니다",
    "createFolder": "폴더를 생성할 수 없습니다",
    "renameNote": "노트 이름을 변경할 수 없습니다",
    "deleteNote": "노트를 삭제할 수 없습니다",
    "loadLinks": "링크 로드 오류",
    "wikilinkNotFound": "볼트에서 \"{name}\" 노트를 찾을 수 없습니다",
    "search": "검색 오류",
    "listPath": "이 경로를 나열할 수 없습니다(권한 문제?)."
  },
  "labels": {
    "noteCount": " · {count}개 노트",
    "loading": "로드 중…",
    "noSubfolders": "(하위 폴더 없음)",
    "loadingLinks": "링크 로드 중…",
    "noOutgoingLinks": "발신 링크 없음.",
    "outgoing": "발신",
    "backlinks": "백링크",
    "noBacklinks": "백링크 없음.",
    "searching": "검색 중…",
    "newNoteInputLabel": "볼트 내 상대 경로 (예: Ideas/내 노트.md)",
    "newFolderInputLabel": "볼트 내 상대 경로 (예: Projects/2026)",
    "renameInputLabel": "새 상대 경로"
  },
  "toasts": {
    "vaultCreated": "볼트 생성됨",
    "vaultRegistered": "볼트 등록됨",
    "vaultUnregistered": "볼트 등록 해제됨",
    "contextWritten": "AI 컨텍스트 작성됨: {written}",
    "contextNoChanges": "변경 없음 (이미 존재: {skipped})",
    "containersSynced": "생성됨 {created} · 기존 {existing} · 저장소 {repos} · 프로젝트 {projects} · 채팅 {chats}",
    "containersBasic": "컨테이너 동기화됨",
    "noteSaved": "노트 저장됨",
    "noteCreated": "노트 생성됨",
    "folderCreated": "폴더 생성됨",
    "noteRenamed": "노트 이름 변경됨",
    "noteDeleted": "노트 삭제됨"
  }
} as const;

export default obsidian;
