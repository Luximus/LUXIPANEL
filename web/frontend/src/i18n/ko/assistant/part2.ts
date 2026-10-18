const assistantPart2 = {
  "cliUsageBars": {
    "sourceReal": "계정의 남은 할당량",
    "sourceEstimated": "예상 잔여 토큰",
    "sourceTokens": "잔여 토큰",
    "cliUsage": "CLI 잔여량",
    "session5h": "세션 (5h)",
    "week": "주간",
    "sessionHours": "세션 ({hours}h)",
    "resetSameDay": "{time}에 초기화",
    "resetOtherDay": "{day}, {time}에 초기화",
    "unavailable": "{provider} 할당량을 불러올 수 없습니다",
    "retry": "다시 시도"
  },
  "notifySettings": {
    "title": "어시스턴트 알림",
    "description": "채팅이 끝났는데 보고 있지 않을 때 내 기기(웹, 앱, 데스크톱)로 알려주세요.",
    "saveError": "저장하지 못했습니다."
  },
  "voiceSettings": {
    "title": "음성(오디오)",
    "description": "OpenAI로 어시스턴트에게 말하고 답변을 음성으로 들으세요.",
    "missingCapabilities": "오디오를 사용하려면 Codex 제공자에 OpenAI API 키를 설정하세요.",
    "inputLabel": "입력 (STT)",
    "outputLabel": "출력 (TTS)",
    "notAvailable": "사용 불가",
    "voiceLabel": "음성",
    "autoSpeak": "응답이 끝나면 자동으로 읽어주기",
    "audioProvider": "오디오 제공자",
    "providerApi": "API (OpenAI/Gemini)",
    "providerPiper": "Piper (로컬)",
    "providerMinimax": "MiniMax",
    "providerApiHint": "이미 설정된 API 키를 사용합니다.",
    "piperReady": "Piper 설치됨",
    "piperMissing": "Piper 미설치",
    "minimaxReady": "MiniMax 준비됨",
    "minimaxMissing": "MiniMax 사용 불가",
    "minimaxAuthMissing": "MiniMax 키 없음",
    "minimaxVoiceHint": "사용할 MiniMax 음성."
  },
  "agentMarket": {
    "creationUncertain": "프로필 생성 결과를 확인하지 못했습니다. 중복을 방지하기 위해 다시 전송하지 않습니다. 카탈로그를 확인하고 생성된 프로필을 식별할 수 있을 때만 선택하세요. 보이지 않으면 결과는 여전히 미확인 상태입니다.",
    "reviewProfiles": "카탈로그 확인",
    "recoverProfile": "생성된 프로필 선택",
    "overrideHint": "저장하면 이 프로젝트에서 상속된 구성이 이 설정으로 바뀝니다.",
    "title": "Market",
    "description": "이 서버의 프로젝트에서 재사용할 수 있는 프로필입니다.",
    "search": "이름, 설명, 전문 분야 또는 기술로 검색",
    "project": "현재 프로젝트",
    "chooseProject": "프로젝트 선택",
    "allProviders": "모든 제공자",
    "allRoles": "모든 역할",
    "allAssignments": "모든 할당",
    "assigned": "할당됨",
    "unassigned": "할당되지 않음",
    "inherited": "상속됨",
    "removed": "제거됨",
    "empty": "아직 에이전트 프로필이 없습니다.",
    "noMatches": "필터에 맞는 프로필이 없습니다.",
    "loading": "카탈로그 로딩 중…",
    "retry": "다시 시도",
    "error": "카탈로그를 불러오거나 업데이트할 수 없습니다.",
    "pending": "작업 진행 중…",
    "add": "프로젝트에 추가",
    "remove": "프로젝트에서 제거",
    "configure": "할당 설정",
    "editProfile": "공통 프로필 편집",
    "profileHint": "프로필 변경 사항은 모든 소속 프로젝트에 적용됩니다.",
    "assignmentHint": "이 설정은 선택한 프로젝트에만 적용됩니다.",
    "removeConfirm": "이 프로젝트에서 {name}을(를) 제거하시겠습니까? 프로필과 기록은 유지됩니다.",
    "saved": "변경 사항을 저장했습니다.",
    "specialty": "전문 분야",
    "technologies": "기술 (쉼표로 구분)",
    "newProfile": "프로필 만들기",
    "back": "채팅으로 돌아가기",
    "inheritedHint": "{project}에서 상속되었습니다. 원본 프로젝트에서 제거를 관리하세요.",
    "readOnly": "읽기 전용",
    "busy": "대기 중인 작업이나 승인이 있습니다. 할당을 변경하기 전에 완료하세요.",
    "forbidden": "이 작업을 수행할 권한이 없습니다.",
    "contextChanged": "서버 또는 세션이 변경되었습니다. 카탈로그를 새로 고치세요.",
    "uncertain": "결과를 확인할 수 없습니다. 작업을 반복하기 전에 카탈로그를 확인하세요.",
    "historical": "기록: 새 채팅에서 사용할 수 없음",
    "inherit": "프로필에서 상속",
    "none": "없음",
    "jobTitle": "프로젝트 직책",
    "instructions": "프로젝트 지침",
    "limitsHint": "제한은 기존 권한과 결합되며 추가 접근 권한을 부여하지 않습니다."
  },
  "agentsTab": {
    "teams": {
      "newTeamBtn": "새 팀",
      "newTeamTitle": "팀 만들기",
      "editTeamTitle": "팀 편집",
      "nameLabel": "이름",
      "namePlaceholder": "예: Backend, Frontend, Design…",
      "descriptionLabel": "설명(선택)",
      "colorLabel": "색상",
      "createBtn": "팀 만들기",
      "saveBtn": "저장",
      "cancelBtn": "취소",
      "addAgentsBtn": "에이전트 추가",
      "addAgentsTitle": "팀에 에이전트 추가",
      "addAgentsEmpty": "추가할 수 있는 에이전트가 없습니다.",
      "addAgentsConfirm": "추가",
      "alreadyInTeam": "다른 팀에 있음",
      "removeFromTeamBtn": "팀에서 제거",
      "removeFromTeamConfirm": "이 에이전트를 팀에서 제거할까요? 에이전트는 삭제되지 않습니다.",
      "deleteTeamBtn": "팀 삭제",
      "deleteTeamConfirm": "이 팀을 삭제할까요?",
      "deleteTeamKeepsAgentsNote": "에이전트는 삭제되지 않고 팀에서만 제거됩니다.",
      "teamSelectorLabel": "팀",
      "groupRequired": "그룹을 선택하거나 만드세요",
      "teamSelectorPlaceholder": "— 그룹 선택 —",
      "noTeamOption": "팀 없음",
      "emptyTeamHint": "빈 팀 — + 버튼으로 에이전트를 추가하세요.",
      "memberCount": "{count}명"
    },
    "cancel": "취소",
    "saving": "저장 중…",
    "saveChanges": "변경사항 저장",
    "noDescription": "설명 없음",
    "allTools": "모든 도구",
    "toolsCount": "{count}개 도구",
    "noActiveModules": "도구가 있는 활성 모듈이 없습니다.",
    "removeAll": "모두 제거",
    "selectAll": "모두 선택",
    "sensitiveTool": "민감한 작업",
    "confirmDeleteAgent": "에이전트 \"{name}\"을(를) 삭제하시겠습니까?",
    "confirmDeleteRole": "역할 \"{name}\"을(를) 삭제하시겠습니까? 이 역할을 사용하는 에이전트에서 제거됩니다.",
    "duplicateName": "{name} (복사본)",
    "editBtn": "편집",
    "deleteTitle": "삭제",
    "errorPrefix": "오류: {message}",
    "backToAgents": "에이전트",
    "createdBy": "{ownerName}이(가) 생성",
    "diagram": {
      "empty": "에이전트 없음 — 에이전트를 만들면 여기서 볼 수 있습니다",
      "connection": "연결"
    },
    "archetypes": {
      "devops": "DevOps / SRE",
      "security": "보안 감사관",
      "dba": "DB 관리자",
      "support": "기술 지원",
      "nginx": "웹 관리자 / Nginx",
      "backups": "백업 전문가",
      "logs": "로그 분석가",
      "automation": "자동화 / Cron"
    },
    "editor": {
      "titleNew": "새 에이전트",
      "titleEdit": "에이전트 편집",
      "headerTitleNew": "새 에이전트",
      "headerDescNew": "새 AI 에이전트 설정",
      "headerTitleEdit": "에이전트 편집 중",
      "headerDescEdit": "에이전트 구성 변경",
      "backToList": "에이전트로 돌아가기",
      "tabGeneral": "일반",
      "tabModel": "모델",
      "tabHierarchy": "계층 구조",
      "tabTools": "도구",
      "tabResources": "리소스",
      "tabAccess": "액세스",
      "aiHelpTitle": "AI 도움말",
      "aiHelpDesc": "프로필을 선택하면 AI가 이름, 설명, 프롬프트 및 도구를 전문적으로 작성합니다.",
      "aiHelpSelect": "프로필 선택…",
      "aiHelpFromDesc": "내 설명에서",
      "aiHelpFromDescTitle": "현재 설명을 기반으로 개선",
      "aiHelpGenerating": "AI로 에이전트 생성 중…",
      "fieldName": "이름",
      "namePlaceholder": "예: 보안 감사관",
      "fieldDescription": "설명",
      "descPlaceholder": "이 에이전트의 용도",
      "fieldSystemPrompt": "시스템 프롬프트",
      "systemPromptPlaceholder": "에이전트의 지침, 성격 및 목표…",
      "fieldAvatar": "아바타",
      "avatarRandomize": "랜덤",
      "avatarAuto": "자동",
      "avatarAttrs": {
        "top": "머리/모자",
        "hairColor": "머리 색",
        "eyes": "눈",
        "eyebrows": "눈썹",
        "mouth": "입",
        "skinColor": "피부색",
        "clothing": "옷",
        "clothesColor": "옷 색상",
        "accessories": "액세서리",
        "facialHair": "수염",
        "facialHairColor": "수염 색"
      },
      "fieldProvider": "제공자",
      "fieldModel": "모델",
      "modelPlaceholder": "(제공자 기본값)",
      "realtimeLabel": "실시간 통신 (저지연 세션)",
      "realtimeDesc": "오디오/텍스트 양방향 스트리밍 세션 (제공자에 따라 OpenAI Realtime 또는 Gemini Live).",
      "realtimeUnavailable": "제공자 \"{providerId}\"는 실시간 세션을 지원하지 않습니다. codex (OpenAI) 또는 gemini에서만 사용 가능합니다.",
      "multiAgentLabel": "멀티 에이전트 모드: 동일한 에이전트를 병렬로 여러 번 복제",
      "multiAgentDescPre": "에이전트가 ",
      "multiAgentDescBold": "X배로 복제되며",
      "multiAgentDescPost": ": 작업이 X개로 분할되어 각 복사본(동일한 프롬프트, 도구, 제공자)이 병렬로 처리하고, 이후 단일 응답으로 합성됩니다.",
      "multiAgentCopies": "복사본 수 (X)",
      "multiAgentCopiesHint": "에이전트 복사본 (2–8)",
      "multiAgentProvidersPre": "선택 사항 — 여러 제공자에 복사본을 분산 (기본 제공자 ",
      "multiAgentProvidersPost": " 는 항상 참여합니다. 다른 제공자를 선택하여 분산하세요):",
      "multiAgentApiHint": "API 키가 있는 API 모드의 제공자만 사용됩니다. 멀티 에이전트는 API 모드가 필요합니다.",
      "roleHeading": "역할 및 계층 구조",
      "roleAssigned": "지정된 역할",
      "roleNone": "역할 없음",
      "roleHint": "역할은 기본 프롬프트와 기본 도구를 제공하며, 에이전트가 이를 세부화합니다. 에이전트 목록에서 역할을 관리합니다.",
      "parentAgent": "상위 에이전트 (하위 관계)",
      "parentNone": "없음 (최상위 레벨)",
      "parentHintPre": "상위 에이전트가 ",
      "parentHintBold": "위임",
      "parentHintPost": "할 수 있으며, 실행 중 작업을 할당하고 응답을 활용합니다.",
      "connectionsLabel": "다른 에이전트와의 연결",
      "connectionsEmpty": "다른 에이전트가 없습니다.",
      "connectionsHint": "양방향 채널: 실행 중에 서로 정보를 요청하거나 전달할 수 있습니다 (위임 도구).",
      "supervisorLabel": "감독관: 하위 에이전트를 위한 채팅을 생성할 수 있음",
      "supervisorDesc": "채팅 탭에서 실제 채팅을 열고 하위 에이전트를 작업에 투입합니다 (각 채팅은 해당 에이전트의 기록으로 남습니다). 역할을 통해서도 부여됩니다.",
      "allowAllTools": "사용 가능한 모든 도구 허용",
      "toolsDesc": "이 에이전트가 사용할 수 있는 도구 하위 집합을 선택합니다. 목록은 각 모듈이 허용하는 것과 교집합되므로 권한을 확장하지 않습니다.",
      "associatedServers": "연결된 서버",
      "serversEmpty": "등록된 서버가 없습니다.",
      "attachedProjects": "연결된 프로젝트",
      "attachedProjectsDesc": "트리에서 하나 이상의 프로젝트를 선택하세요. 상위 프로젝트를 선택하면 중첩된 모든 폴더가 선택됩니다. 에이전트는 선택한 프로젝트의 작업 경로를 사용합니다.",
      "noParentProjects": "프로젝트가 없습니다.",
      "graphIndexesTitle": "코드 그래프 인덱스",
      "graphIndexesDesc": "에이전트는 전체 파일을 읽는 대신 이 인덱스로 그래프를 통해 코드를 탐색합니다(심볼·호출·아키텍처) — 토큰 사용량이 줄어듭니다.",
      "graphIndexesEmpty": "사용 가능한 그래프 인덱스가 없습니다. 프로젝트 탭에서 프로젝트를 인덱싱하세요.",
      "credentialTitle": "액세스 자격 증명",
      "saveObsidian": "연결된 프로젝트의 Obsidian 볼트에 요약 저장",
      "agentSkills": "에이전트 스킬",
      "createAgent": "에이전트 만들기",
      "snippetsSection": "터미널 Snippets",
      "snippetsCategoryLabel": "Snippets 카테고리",
      "snippetsCategoryNone": "(없음)",
      "snippetsTagsLabel": "카테고리 태그",
      "snippetsHelp": "이 에이전트가 사용할 수 있는 터미널 Snippets를 미리 필터링합니다. 카테고리를 선택하고, 선택적으로 해당 카테고리의 태그를 선택하세요. 카테고리 없음 = 필터 없음.",
      "snippetsNoAccess": "터미널 Snippets를 불러오지 못했습니다 (터미널 권한 필요).",
      "snippetsNoTags": "이 카테고리에는 태그가 없습니다."
    },
    "roleEditor": {
      "titleNew": "새 역할",
      "titleEdit": "역할 편집",
      "fieldName": "역할 이름",
      "namePlaceholder": "예: 조정자, 감사관, DB 전문가",
      "fieldDesc": "설명",
      "descPlaceholder": "이 역할이 나타내는 것",
      "fieldBasePrompt": "역할 기본 프롬프트",
      "basePromptPlaceholder": "이 역할을 가진 모든 에이전트에 공통된 정책, 책임 및 톤…",
      "basePromptHint": "에이전트 자체 프롬프트 이전에 기본값으로 주입됩니다.",
      "noToolLimit": "역할에서 도구 제한 없음",
      "toolsDesc": "역할의 도구는 해당 에이전트가 사용할 수 있는 것을 제한합니다 (교집합으로 처리되며, 확장되지 않습니다).",
      "supervisorLabel": "감독관 직책: 이 역할을 가진 에이전트는 하위 에이전트를 위한 채팅을 생성할 수 있음",
      "supervisorDesc": "이 역할을 가진 모든 에이전트에게 감독관 역할(채팅 열기 및 작업 할당 도구)을 수행할 권한을 부여합니다.",
      "createRole": "역할 만들기"
    },
    "treeView": {
      "title": "에이전트 계층 구조",
      "reloadTitle": "에이전트를 다시 로드하고 트리 재생성",
      "regenerating": "재생성 중…",
      "regenerate": "재생성",
      "description": "하위 관계 트리 다이어그램 (실선 = 상위 → 하위) 및 피어 간 연결 (점선). 트리를 구성하려면 각 에이전트 편집기에서 «상위 에이전트»를 지정하세요."
    },
    "rolesList": {
      "newRole": "새 역할",
      "description": "하나 이상의 에이전트에 할당하는 재사용 가능한 역할 (기본 프롬프트 및 도구가 포함된 프로필).",
      "emptyTitle": "아직 역할이 없습니다",
      "emptyDesc": "여러 에이전트의 동작을 표준화하려면 역할을 만드세요.",
      "agentsCount": "{count}개 에이전트"
    },
    "list": {
      "description": "맞춤 AI 에이전트: 자체 프롬프트, 도구 및 제공자/모델. 채팅에서 사용하거나 Cron에서 예약하세요.",
      "treeBtn": "트리",
      "treeBtnTitle": "에이전트 계층 트리 보기",
      "rolesBtn": "역할",
      "rolesBtnTitle": "에이전트 역할 생성 및 관리",
      "newAgent": "새 에이전트",
      "loading": "에이전트 불러오는 중…",
      "emptyTitle": "아직 에이전트가 없습니다",
      "emptyDesc": "맞춤 프롬프트와 도구 세트로 채팅하려면 에이전트를 만드세요.",
      "multiAgentTitle": "멀티 에이전트: {count}개 복사본",
      "roleAssignedTitle": "지정된 역할",
      "subordinateTitle": "하위 에이전트",
      "connectionsTitle": "다른 에이전트와의 연결",
      "supervisorTitle": "감독관: 하위 에이전트를 위한 채팅 생성 가능",
      "supervisorBadge": "감독관",
      "realtimeTitle": "실시간 통신",
      "realtimeBadge": "실시간",
      "startChat": "채팅 시작",
      "duplicateTitle": "복제",
      "noRoleGroupTitle": "작업 그룹 없음",
      "groupAria": "작업 그룹: {name}",
      "groupCount": "{count}개 에이전트",
      "noRoleGroupDesc": "역할이 할당되지 않은 에이전트입니다. 편집기에서 할당하세요."
    },
    "resync": {
      "applying": "생성 중…",
      "close": "닫기",
      "btn": "템플릿과 동기화",
      "btnTitle": "이 팀을 템플릿과 비교하고 누락된 에이전트 만들기",
      "modalTitle": "«{name}»을(를) 템플릿과 동기화",
      "loading": "템플릿과 비교 중…",
      "markersMissing": "이 팀은 템플릿 출처 표시가 없어 자동으로 비교할 수 없습니다. 누락된 에이전트를 직접 만들 수 있습니다.",
      "missingHeading": "누락",
      "presentHeading": "존재",
      "extraHeading": "직접 추가됨",
      "extraNote": "변경되지 않습니다.",
      "nothingMissing": "팀이 완성되었습니다. 템플릿에서 누락된 에이전트가 없습니다.",
      "confirm": "선택 항목 만들기"
    }
  },
  "accessTab": {
    "all": "전체",
    "permissionsTitle": "접근 및 권한",
    "permissionsDescription": "현재 어시스턴트 표시 여부는 프로필의 assistant 모듈 권한에 의해 결정됩니다. 역할별 세부 정보(assistant.use / assistant.configure / assistant.module.<id>)는 다음 이터레이션에서 제공될 예정입니다.",
    "recentInvocations": "최근 도구 호출",
    "refreshAriaLabel": "접근 새로고침",
    "loading": "로딩 중...",
    "emptyRecent": "최근 활동 없음.",
    "emptyProvider": "이 공급자의 활동 없음.",
    "byUser": "사용자:",
    "crossServerTitle": "연결된 서버 접근",
    "cmdPrefix": "$ ",
    "passwordLabel": "비밀번호: ",
    "passphraseLabel": "암호 문구: ",
    "privateKeyLabel": "개인 키",
    "autoApproveRevoke": "취소",
    "autoApproveTitle": "자동 승인",
    "autoApproveDescription": "더 이상 확인을 요청하지 않는 도구(“승인하고 다시 묻지 않기”로 승인됨)입니다. 변경 사항은 다음 실행부터 적용됩니다.",
    "autoApproveEmpty": "자동 승인된 도구가 없습니다. 에이전트 작업을 승인할 때 “승인하고 다시 묻지 않기”를 선택하면 여기에 표시됩니다.",
    "autoApproveModeAuto": "자동 모드: 이 목록은 적용되지 않습니다"
  },
  "directoryPicker": {
    "title": "폴더 선택",
    "goUp": "위로",
    "loading": "불러오는 중…",
    "emptyDirs": "(하위 폴더 없음)",
    "cancel": "취소",
    "select": "이 폴더 사용",
    "readError": "디렉토리를 읽을 수 없습니다"
  },
  "skillsSettings": {
    "title": "어시스턴트 skills 및 방법",
    "helper": "어시스턴트의 동작을 조정하는 라이브러리, skills 및 방법을 활성화하거나 비활성화합니다.",
    "tokenNote": "각 skill의 지침은 캐시된 프롬프트에 포함됩니다(이후 턴에서 ~0.1×). Ponytail은 코드와 출력 토큰을 줄입니다. UI/UX Pro Max에서는 «간결» 수준을 사용하면 토큰을 절약할 수 있습니다.",
    "search": "skill 검색…",
    "allCategories": "전체 카테고리",
    "loading": "skills 불러오는 중...",
    "empty": "사용 가능한 skills이 없습니다.",
    "noMatch": "필터와 일치하는 skill이 없습니다.",
    "sourcePrefix": "출처:",
    "errorGeneric": "skill을 업데이트할 수 없습니다. 다시 시도하세요.",
    "activeShown": "{count}개 활성화 · {shown}개 표시됨."
  },
  "skillsPicker": {
    "searchPlaceholder": "skill 검색…",
    "resetTitle": "개인 설정 제거 (전역 skills 사용)",
    "reset": "초기화 ({count})",
    "loading": "skills 불러오는 중…",
    "empty": "skills 없음.",
    "globalNote": "본인의 채팅에만 적용되며, 제공업체의 전역 skills 위에 추가됩니다."
  },
  "skillCategories": {
    "methods": "어시스턴트 메서드",
    "code-quality": "코드 품질",
    "web-quality": "웹 품질 (Lighthouse / CWV)",
    "ui-ux": "UI / UX / 디자인",
    "web-fullstack": "웹 / 풀스택 AI 개발",
    "mobile": "모바일 앱",
    "code-agents": "코드 에이전트",
    "reusable-skills": "재사용 가능한 AI 스킬",
    "security": "AI / 웹 / 앱 보안",
    "token-savings": "토큰 절약 / AI 비용",
    "ai-prod": "프로덕션 AI 에이전트",
    "devops": "DevOps / 배포",
    "testing": "테스팅 / 코드 품질",
    "data-rag": "데이터베이스 / RAG / 검색",
    "automation": "자동화 / 워크플로우",
    "other": "기타"
  },
  "skillCatalog": {
    "ask-protocol": {
      "name": "결정 전 확인",
      "description": "어시스턴트가 가정하는 대신 핵심 결정 사항을 먼저 질문하도록 합니다 (lxp_ask 도구 + 질문 프로토콜)."
    },
    "project-context-vault": {
      "name": "프로젝트 컨텍스트 (Obsidian)",
      "description": "프로젝트 컨텍스트 노트(Contexto.md / Errores.md)를 주입하고 obsidian.search_notes로 추가 검색을 허용합니다."
    },
    "ponytail": {
      "name": "Ponytail (미니멀 코드)",
      "description": "미니멀 개발 모드: 필요한 최소한의 코드만 작성합니다 (결정 사다리 + guardrails)."
    },
    "ui-ux-pro-max": {
      "name": "UI/UX Pro Max (인터페이스 품질)",
      "description": "전문적인 UI/UX 기준(접근성, 터치, 타이포그래피, 상태)을 프롬프트에 주입합니다. 간략 또는 전체 수준 선택 가능."
    },
    "openai-agents-sdk": {
      "name": "OpenAI Agents SDK",
      "description": "도구, handoffs, guardrails, 세션 및 트레이싱을 갖춘 OpenAI 에이전트."
    },
    "openai-agents-python": {
      "name": "OpenAI Agents Python SDK",
      "description": "에이전트용 Python SDK: Agent, Runner, @function_tool, handoffs 및 트레이싱."
    },
    "openai-agents-js": {
      "name": "OpenAI Agents JS SDK",
      "description": "OpenAI 에이전트용 TypeScript/JS SDK: Agent, run, tools (Zod), handoffs."
    },
    "mcp-docs": {
      "name": "Model Context Protocol",
      "description": "LLM을 도구, 리소스 및 프롬프트에 연결하는 개방형 표준 ('AI의 USB-C')."
    },
    "mcp-github": {
      "name": "MCP (GitHub)",
      "description": "MCP GitHub 조직: 공식 SDK(10개 언어), 레퍼런스 서버 및 인스펙터."
    },
    "anthropic-mcp-intro": {
      "name": "Anthropic MCP Intro",
      "description": "Anthropic 발표: N×M 통합 문제를 해결하는 개방형 표준으로서의 MCP."
    },
    "n8n": {
      "name": "n8n",
      "description": "Fair-code, 자체 호스팅 가능한 워크플로우 자동화."
    },
    "make": {
      "name": "Make",
      "description": "시나리오 기반 비주얼 노코드 자동화 (구 Integromat)."
    },
    "zapier": {
      "name": "Zapier",
      "description": "트리거와 액션(Zaps)으로 구성된 SaaS 자동화."
    },
    "temporal": {
      "name": "Temporal",
      "description": "내구성 있고 장애 허용 워크플로우의 오케스트레이션."
    },
    "bullmq": {
      "name": "BullMQ",
      "description": "Node.js를 위한 Redis 기반 작업 큐."
    },
    "langgraph": {
      "name": "LangGraph",
      "description": "상태 그래프로서 LLM 에이전트 오케스트레이션."
    },
    "codex-cli": {
      "name": "OpenAI Codex CLI",
      "description": "에이전트가 OpenAI의 Codex CLI(터미널 코드 에이전트)를 사용하도록 안내합니다."
    },
    "codex-cli-features": {
      "name": "Codex CLI Features",
      "description": "에이전트에게 Codex CLI 기능(sandbox, 승인, MCP, config)을 상세히 안내합니다."
    },
    "codex-cloud": {
      "name": "Codex Cloud",
      "description": "에이전트가 Codex Cloud(원격 환경, 병렬 실행, PR)에 작업을 위임하도록 안내합니다."
    },
    "claude-code-skills": {
      "name": "Claude Code Skills",
      "description": "에이전트가 Claude Code Skills(SKILL.md 포함 폴더, Agent Skills 표준)을 생성하고 사용하도록 안내합니다."
    },
    "copilot-cloud-agent": {
      "name": "GitHub Copilot Cloud Agent",
      "description": "에이전트가 클라우드에서 작동하고 PR을 여는 GitHub Copilot 코딩 에이전트에 이슈를 위임하도록 안내합니다."
    },
    "cursor": {
      "name": "Cursor",
      "description": "에이전트가 Cursor 에디터(Agent, 리포지토리 컨텍스트, 규칙)에서 작업하도록 안내합니다."
    },
    "agents-md": {
      "name": "AGENTS.md",
      "description": "에이전트가 코드 에이전트의 표준 명령 파일인 AGENTS.md를 작성하고 따르도록 안내합니다."
    },
    "open-design-contribute": {
      "name": "Open Design — 기여 (노코드)",
      "description": "Open Design(nexu-io)에 노코드로 기여하는 가이드 플로우: 스킬 또는 디자인 시스템 제출, 문서 번역, 텍스트 수정 또는 버그 신고 후 PR/이슈를 자동으로 생성합니다."
    },
    "supabase": {
      "name": "Supabase",
      "description": "인증, 스토리지 및 실시간 기능을 갖춘 관리형 Postgres 백엔드."
    },
    "postgresql": {
      "name": "PostgreSQL",
      "description": "풍부한 타입을 갖춘 견고한 관계형 데이터베이스."
    },
    "pgvector": {
      "name": "pgvector",
      "description": "Postgres 내부에서의 벡터 유사도 검색."
    },
    "pinecone": {
      "name": "Pinecone",
      "description": "대규모 RAG를 위한 관리형 벡터 데이터베이스."
    },
    "qdrant": {
      "name": "Qdrant",
      "description": "페이로드 필터링을 지원하는 오픈소스 벡터 엔진."
    },
    "weaviate": {
      "name": "Weaviate",
      "description": "스키마 및 벡터화 모듈을 갖춘 벡터 데이터베이스."
    },
    "github-actions": {
      "name": "GitHub Actions",
      "description": "이벤트로 트리거되는 YAML 워크플로우(.github/workflows)를 사용한 GitHub CI/CD."
    },
    "vercel": {
      "name": "Vercel",
      "description": "커밋/PR별 미리보기를 지원하는 프론트엔드 및 서버리스 함수 배포."
    },
    "docker": {
      "name": "Docker",
      "description": "경량의 재현 가능한 이미지로 앱을 임시 컨테이너에 패키징합니다."
    },
    "nginx": {
      "name": "Nginx",
      "description": "고성능 웹 서버 및 리버스 프록시."
    },
    "pm2": {
      "name": "PM2",
      "description": "클러스터, 재시작 및 로그 기능을 갖춘 Node 프로세스 매니저."
    },
    "redis": {
      "name": "Redis",
      "description": "캐싱, 큐 및 데이터 구조를 위한 인메모리 스토어."
    },
    "expo": {
      "name": "Expo",
      "description": "에이전트가 Expo(expo-router, 모듈, config 플러그인)로 React Native 앱을 개발하도록 안내합니다."
    },
    "eas-build": {
      "name": "EAS Build",
      "description": "에이전트가 EAS Build와 eas.json 프로파일로 클라우드에서 iOS/Android 바이너리를 빌드하도록 안내합니다."
    },
    "eas-services": {
      "name": "EAS Services",
      "description": "에이전트가 EAS 생태계(Submit, Update/OTA, Workflows)를 end-to-end로 사용하도록 돕습니다."
    },
    "react-native": {
      "name": "React Native",
      "description": "에이전트가 React Native(핵심 컴포넌트, 스타일, 플랫폼)로 네이티브 UI를 빌드하도록 안내합니다."
    },
    "firebase-auth": {
      "name": "Firebase Auth",
      "description": "에이전트가 Firebase Auth(프로바이더, 토큰, 세션)로 인증을 구현하도록 안내합니다."
    },
    "claude-agent-skills": {
      "name": "Claude Agent Skills",
      "description": "재사용 가능한 기능을 필요 시 로드되는 Agent Skills(SKILL.md)로 패키징합니다."
    },
    "claude-skills-github": {
      "name": "Claude Skills (GitHub)",
      "description": "공식 anthropics/skills 리포지토리: 예제, 스펙 및 기반 템플릿과 패턴."
    },
    "codex-agents-md-guide": {
      "name": "Codex AGENTS.md Guide",
      "description": "코드 에이전트에 프로젝트 지침을 제공하는 Codex의 AGENTS.md 규칙."
    },
    "owasp-llm-top10": {
      "name": "OWASP Top 10 LLM",
      "description": "LLM 앱의 10대 위험: 프롬프트 인젝션, 안전하지 않은 출력, 과도한 에이전시."
    },
    "owasp-asvs": {
      "name": "OWASP ASVS",
      "description": "ASVS v5.0: 수준별 검증 가능한 보안 요구사항 표준."
    },
    "codeql": {
      "name": "CodeQL",
      "description": "CodeQL: 취약점을 찾기 위해 코드를 데이터로 쿼리합니다 (데이터 흐름/오염 분석)."
    },
    "semgrep": {
      "name": "Semgrep",
      "description": "Semgrep: 코드 유사 규칙 SAST + Supply Chain(SCA)과 Secrets, 높은 신호 정확도."
    },
    "snyk": {
      "name": "Snyk",
      "description": "Snyk: 가이드 기반 수정을 갖춘 SCA, Code(SAST), Container, IaC 및 API/Web(DAST)."
    },
    "owasp-zap": {
      "name": "OWASP ZAP",
      "description": "OWASP ZAP: DAST(패시브/액티브 스캔)를 위한 선도적인 오픈소스 웹 스캐너."
    },
    "skillspector": {
      "name": "SkillSpector (AI 스킬 감사)",
      "description": "설치 전 AI 에이전트 Skills(SKILL.md + 스크립트)의 취약점 및 악의적 의도를 감사합니다 (NVIDIA, Apache-2.0)."
    },
    "playwright": {
      "name": "Playwright",
      "description": "자동 대기 및 트레이스를 갖춘 크로스 브라우저 E2E 테스팅."
    },
    "cypress": {
      "name": "Cypress",
      "description": "재시도를 지원하는 브라우저 내 컴포넌트 및 E2E 테스팅."
    },
    "vitest": {
      "name": "Vitest",
      "description": "Vite/ESM 네이티브 고속 테스트 러너."
    },
    "jest": {
      "name": "Jest",
      "description": "내장 목 및 스냅샷을 갖춘 테스팅 프레임워크."
    },
    "testing-library": {
      "name": "Testing Library",
      "description": "접근 가능한 UI를 테스트하기 위한 사용자 중심 쿼리."
    },
    "storybook": {
      "name": "Storybook",
      "description": "UI 컴포넌트의 격리된 개발 및 테스팅."
    },
    "openai-prompt-caching": {
      "name": "OpenAI Prompt Caching",
      "description": "OpenAI에서 캐시된 프롬프트 접두사를 재사용하여 자동으로 비용을 절감합니다."
    },
    "openai-prompt-engineering": {
      "name": "OpenAI Prompt Engineering",
      "description": "반복 횟수와 토큰을 줄이기 위한 정밀한 프롬프트 작성."
    },
    "gemini-context-caching": {
      "name": "Gemini Context Caching",
      "description": "Gemini에서 반복되는 대용량 컨텍스트를 캐시(명시적 또는 암묵적)하여 입력 비용을 절감합니다."
    },
    "gemini-caching-api": {
      "name": "Gemini Caching API",
      "description": "Gemini cachedContents API: 캐시 생성, 재사용, TTL 업데이트 및 삭제."
    },
    "litellm-cost-tracking": {
      "name": "LiteLLM Cost Tracking",
      "description": "LiteLLM 프록시로 키/사용자/팀별 비용을 측정하고 귀속합니다."
    },
    "litellm": {
      "name": "LiteLLM",
      "description": "캐싱, 폴백 및 라우팅을 갖춘 100개 이상의 LLM(OpenAI 포맷)에 대한 통합 게이트웨이."
    },
    "figma-ai": {
      "name": "Figma AI",
      "description": "Figma AI: 캔버스 에이전트, 이미지 생성 및 디자인-투-코드."
    },
    "figma-make": {
      "name": "Figma Make",
      "description": "Figma Make: 프롬프트 또는 프레임에서 실제 코드로 작동하는 프로토타입/앱 생성."
    },
    "figma-ai-tools": {
      "name": "Figma AI Tools",
      "description": "Figma Design의 AI 도구: First Draft, 레이어 이름 변경, 이미지, 텍스트."
    },
    "framer": {
      "name": "Framer",
      "description": "Framer: 비주얼 캔버스, AI 에이전트, CMS 및 게시 기능을 갖춘 노코드 사이트."
    },
    "relume": {
      "name": "Relume",
      "description": "Relume: AI + 라이브러리로 브리프에서 사이트맵, 와이어프레임, 스타일 가이드까지."
    },
    "design-md-tokens": {
      "name": "DESIGN.md (토큰 기반 시스템)",
      "description": "구조화된 DESIGN.md로 브랜드에 충실한 UI를 생성합니다: 색상/타이포그래피/간격 토큰, 컴포넌트 스펙 및 do/don't 규칙 (voltagent, MIT)."
    },
    "nextjs-app-router": {
      "name": "Next.js App Router",
      "description": "에이전트가 App Router(서버 컴포넌트, route 핸들러, 레이아웃)로 Next.js 앱을 빌드하도록 안내합니다."
    },
    "vercel-ai-sdk": {
      "name": "Vercel AI SDK",
      "description": "에이전트가 AI SDK(generateText, streamText, tools, structured output)로 LLM을 통합하도록 돕습니다."
    },
    "vercel-ai-gateway": {
      "name": "Vercel AI Gateway",
      "description": "에이전트가 AI Gateway(단일 엔드포인트, 폴백, 관측성)를 통해 여러 모델로 요청을 라우팅하도록 안내합니다."
    },
    "openai-sdk-cli": {
      "name": "OpenAI SDKs and CLI",
      "description": "에이전트가 OpenAI 공식 SDK(Python/Node)와 API를 관용적으로 사용하도록 안내합니다."
    },
    "v0-vercel": {
      "name": "v0 by Vercel",
      "description": "에이전트가 프롬프트로 v0을 통해 React/Tailwind/shadcn UI를 생성하고 다듬도록 돕습니다."
    },
    "web-quality-audit": {
      "name": "웹 품질 감사",
      "description": "심각도 분류를 포함한 종합적인 웹 품질 감사 (성능, 접근성, SEO, 보안)."
    },
    "web-performance": {
      "name": "웹 성능",
      "description": "로드 속도 및 런타임 효율 최적화 (리소스 예산 + Lighthouse)."
    },
    "core-web-vitals": {
      "name": "Core Web Vitals (LCP/INP/CLS)",
      "description": "LCP, INP 및 CLS 개선 (75번째 백분위수 임계값)."
    },
    "web-accessibility": {
      "name": "웹 접근성 (WCAG 2.2)",
      "description": "WCAG 2.2에 따른 접근성 감사 및 개선 (AA 수준 목표)."
    },
    "web-seo": {
      "name": "SEO (기술적 + 온페이지)",
      "description": "검색 엔진 가시성 최적화: 기술적 SEO, 온페이지 및 구조화 데이터."
    },
    "web-best-practices": {
      "name": "웹 모범 사례 (보안)",
      "description": "보안, 호환성 및 코드 품질을 위한 현대적인 패턴."
    }
  }
} as const;

export default assistantPart2;
