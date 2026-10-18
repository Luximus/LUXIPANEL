const assistantPart3 = {
  "skillOptions": {
    "ponytail": {
      "mode": {
        "label": "강도",
        "choices": {
          "off": "끄기",
          "lite": "Lite — 가장 단순한 대안 제안",
          "full": "Full — 사다리 적용",
          "ultra": "Ultra — YAGNI 극단주의"
        }
      }
    },
    "ui-ux-pro-max": {
      "detalle": {
        "label": "상세도",
        "choices": {
          "breve": "간략 (최소 토큰)",
          "completo": "전체 (더 많은 상세)"
        }
      }
    }
  },
  "toolCatalog": {
    "admin.bash": {
      "title": "bash 명령 실행"
    },
    "admin.restart_service": {
      "title": "systemd 서비스 재시작"
    },
    "backup.list_jobs": {
      "title": "구성된 백업 목록"
    },
    "bitninja.status": {
      "title": "BitNinja 상태"
    },
    "cloudflare.status": {
      "title": "Cloudflare 상태"
    },
    "cloudflare.list_zones": {
      "title": "Cloudflare 영역 목록"
    },
    "cloudflare.list_dns_records": {
      "title": "DNS 레코드 목록"
    },
    "cloudflare.create_dns_record": {
      "title": "DNS 레코드 생성"
    },
    "cloudflare.update_dns_record": {
      "title": "DNS 레코드 업데이트"
    },
    "cloudflare.delete_dns_record": {
      "title": "DNS 레코드 삭제"
    },
    "cloudflare.purge_cache": {
      "title": "Cloudflare 캐시 삭제"
    },
    "cloudflare.get_zone_settings": {
      "title": "영역 설정 보기"
    },
    "cloudflare.set_zone_setting": {
      "title": "영역 설정 변경"
    },
    "cloudflare.list_access_rules": {
      "title": "IP 접근 규칙 목록"
    },
    "cloudflare.block_ip": {
      "title": "Cloudflare에서 IP 차단"
    },
    "cron.list": {
      "title": "cron 작업 목록"
    },
    "cron.add": {
      "title": "cron 작업 생성"
    },
    "cron.update": {
      "title": "cron 작업 편집"
    },
    "cron.toggle": {
      "title": "cron 작업 일시정지/재개"
    },
    "cron.remove": {
      "title": "cron 작업 삭제"
    },
    "cron.ai_list": {
      "title": "예약된 AI 에이전트 목록"
    },
    "cron.ai_logs": {
      "title": "AI 에이전트 실행 목록"
    },
    "cron.ai_read_log": {
      "title": "AI 에이전트 실행 읽기"
    },
    "cron.ai_run": {
      "title": "예약된 AI 에이전트 지금 실행"
    },
    "cron.ai_toggle": {
      "title": "예약된 AI 에이전트 일시정지/재개"
    },
    "cron.ai_add": {
      "title": "예약된 AI 에이전트 생성"
    },
    "cron.ai_update": {
      "title": "예약된 AI 에이전트 편집"
    },
    "cron.ai_remove": {
      "title": "예약된 AI 에이전트 삭제"
    },
    "cron.presets_get": {
      "title": "에이전트 구성 읽기 (프리셋)"
    },
    "cron.presets_set": {
      "title": "에이전트 구성 저장 (프리셋)"
    },
    "dashboard.overview": {
      "title": "서버 개요"
    },
    "databases.list_engines": {
      "title": "데이터베이스 엔진 감지"
    },
    "databases.list_databases": {
      "title": "데이터베이스 목록"
    },
    "databases.list_tables": {
      "title": "테이블 목록"
    },
    "databases.run_query": {
      "title": "SQL 쿼리 실행"
    },
    "expo.status": {
      "title": "Expo 상태"
    },
    "expo.account": {
      "title": "Expo 계정"
    },
    "expo.list_projects": {
      "title": "Expo 프로젝트 목록"
    },
    "expo.project_info": {
      "title": "프로젝트 정보"
    },
    "expo.init_project": {
      "title": "Expo 프로젝트 생성"
    },
    "expo.link_project": {
      "title": "EAS에 프로젝트 연결"
    },
    "expo.build": {
      "title": "EAS 빌드 시작"
    },
    "expo.build_list": {
      "title": "빌드 기록"
    },
    "expo.build_view": {
      "title": "빌드 상태"
    },
    "expo.build_cancel": {
      "title": "빌드 취소"
    },
    "expo.submit": {
      "title": "스토어에 제출"
    },
    "expo.dev_client": {
      "title": "dev-client 시작 (QR)"
    },
    "expo.quota": {
      "title": "빌드 할당량"
    },
    "expo.update": {
      "title": "OTA 업데이트 게시"
    },
    "expo.env_list": {
      "title": "EAS 변수 목록"
    },
    "expo.env_set": {
      "title": "EAS 변수 생성"
    },
    "expo.set_google_credential": {
      "title": "Play Store 자격증명"
    },
    "expo.set_apple_credential": {
      "title": "App Store 자격증명"
    },
    "expo.webhook_create": {
      "title": "EAS 웹훅 등록"
    },
    "expo.device_create": {
      "title": "iOS 기기 등록"
    },
    "files.read": {
      "title": "파일 읽기"
    },
    "files.list_dir": {
      "title": "디렉터리 목록"
    },
    "files.grep": {
      "title": "파일 내 검색"
    },
    "files.project_info": {
      "title": "프로젝트 유형 감지"
    },
    "files.security_scan": {
      "title": "휴리스틱 보안 스캔"
    },
    "files.write": {
      "title": "파일 쓰기"
    },
    "files.mkdir": {
      "title": "폴더 생성"
    },
    "files.delete": {
      "title": "파일 또는 폴더 삭제"
    },
    "files.rename": {
      "title": "이름 변경 또는 이동"
    },
    "files.copy": {
      "title": "파일 복사"
    },
    "files.chmod": {
      "title": "권한 변경 (chmod)"
    },
    "files.chown": {
      "title": "소유자 변경 (chown)"
    },
    "firewall.ufw_status": {
      "title": "UFW 상태"
    },
    "firewall.fail2ban_status": {
      "title": "fail2ban 상태 (jails)"
    },
    "hosting.list_accounts": {
      "title": "호스팅 계정 목록"
    },
    "hosting.list_audit": {
      "title": "호스팅 계정 감사 로그 보기"
    },
    "hosting.account_stats": {
      "title": "호스팅 계정 사용량 통계"
    },
    "mail.list_domains": {
      "title": "사용 가능한 도메인"
    },
    "mail.list_messages": {
      "title": "사서함 메시지 목록"
    },
    "mail.fetch_message": {
      "title": "전체 메시지 읽기"
    },
    "mail.move_messages": {
      "title": "메시지를 격리함으로 이동"
    },
    "mail.flag_messages": {
      "title": "메시지 플래그 지정"
    },
    "mail.delete_messages": {
      "title": "메시지 삭제 (영구)"
    },
    "module-dev.validate_manifest": {
      "title": "매니페스트 검증"
    },
    "module-dev.run_checks": {
      "title": "모듈 정적 검사"
    },
    "module-dev.run_tests": {
      "title": "모듈 테스트 실행"
    },
    "module-dev.list_modules": {
      "title": "내 마켓플레이스 모듈"
    },
    "module-dev.module_status": {
      "title": "모듈 상태"
    },
    "module-dev.submit_module": {
      "title": "검토를 위한 모듈 제출"
    },
    "module-dev.resubmit_module": {
      "title": "수정된 모듈 재제출"
    },
    "module-dev.unpublish_module": {
      "title": "모듈 게시 취소"
    },
    "module-dev.republish_module": {
      "title": "모듈 재게시"
    },
    "module-dev.preview_install": {
      "title": "미리보기 설치 (Mode B)"
    },
    "module-dev.preview_uninstall": {
      "title": "미리보기 제거"
    },
    "module-dev.link_project": {
      "title": "프로젝트 ↔ 모듈 연결"
    },
    "monitor.cpu_top": {
      "title": "CPU 상위 프로세스"
    },
    "monitor.watchdog_status": {
      "title": "자동 재부팅 상태"
    },
    "monitor.watchdog_configure": {
      "title": "자동 재부팅 구성"
    },
    "nginx.list_sites": {
      "title": "nginx 사이트 목록"
    },
    "nginx.tail_access_log": {
      "title": "access.log 실시간 보기"
    },
    "obsidian.list_vaults": {
      "title": "볼트 목록"
    },
    "obsidian.list_notes": {
      "title": "노트 목록"
    },
    "obsidian.read_note": {
      "title": "노트 읽기"
    },
    "obsidian.search_notes": {
      "title": "노트 내 검색"
    },
    "obsidian.backlinks": {
      "title": "노트 백링크"
    },
    "obsidian.write_note": {
      "title": "노트 쓰기"
    },
    "obsidian.append_note": {
      "title": "노트에 추가"
    },
    "obsidian.daily_note": {
      "title": "일일 노트"
    },
    "obsidian.delete_note": {
      "title": "노트 삭제"
    },
    "obsidian.list_containers": {
      "title": "컨텍스트 컨테이너 목록"
    },
    "obsidian.sync_containers": {
      "title": "컨텍스트 컨테이너 동기화"
    },
    "openclaw.config": {
      "title": "OpenClaw 구성"
    },
    "openclaw.test_connection": {
      "title": "OpenClaw 연결 테스트"
    },
    "security-audit.last_report": {
      "title": "최신 감사 보고서"
    },
    "security-audit.ssh_posture": {
      "title": "서버 SSH 보안 상태"
    },
    "server-alerts.send": {
      "title": "서버에 알림 전송"
    },
    "server-alerts.list_rules": {
      "title": "경보 규칙 목록"
    },
    "server-alerts.create_rule": {
      "title": "경보 규칙 생성"
    },
    "users.list": {
      "title": "패널 사용자 목록"
    },
    "users.create": {
      "title": "사용자 생성"
    },
    "users.update": {
      "title": "사용자 편집"
    },
    "users.delete": {
      "title": "사용자 삭제"
    },
    "users.groups_list": {
      "title": "권한이 있는 그룹 목록"
    },
    "users.group_create": {
      "title": "그룹 생성"
    },
    "users.group_update": {
      "title": "그룹 편집"
    },
    "users.group_delete": {
      "title": "그룹 삭제"
    },
    "webhooks.list": {
      "title": "구성된 웹훅 목록"
    }
  },
  "dataPanelCatalog": {
    "admin.health": {
      "title": "서버 상태",
      "description": "연결된 대상의 빠른 도달성 / 부하 프로브 — 운영 질문에 답하기 전 시스템 프롬프트 컨텍스트로 유용합니다."
    },
    "dashboard.snapshot": {
      "title": "간략 개요",
      "description": "연결된 대상의 간략한 사전 프롬프트 요약: 부하, RAM%, 루트 디스크%, 실행 중인 주요 서비스 수."
    },
    "monitor.snapshot": {
      "title": "시스템 스냅샷",
      "description": "연결된 대상의 현재 리소스 요약: CPU 사용률 %, 부하 평균, 사용 메모리 / 전체, 루트 파일시스템 사용량."
    },
    "obsidian.vaults_summary": {
      "title": "볼트 요약",
      "description": "연결된 서버에 등록된 Obsidian 볼트의 경로, 존재 여부 및 마크다운 노트 수."
    }
  },
  "structurePanel": {
    "editorLoading": "편집기 로딩 중...",
    "loading": "로딩 중...",
    "createdNotice": "{count}개 항목이 생성되었습니다.",
    "nothingToCreate": "생성할 항목이 없습니다 (이미 존재함).",
    "savedNotice": "{rel} 저장됨.",
    "noActiveProviders": "활성화된 AI 공급자가 없습니다. 공급자 설정에서 활성화하세요.",
    "improvedNotice": "AI로 개선되었습니다. 차이를 검토하고 마음에 들면 저장을 클릭하세요.",
    "noAiChanges": "AI가 변경 사항을 제안하지 않았습니다.",
    "structureLoading": "구조 분석 중...",
    "retry": "다시 시도",
    "copyAllContent": "모든 내용 복사",
    "copied": "복사됨",
    "copy": "복사",
    "downloadFile": "파일 다운로드",
    "download": "다운로드",
    "diff": "Diff",
    "originalDiffTitle": "원본 내용과의 차이 보기",
    "back": "뒤로",
    "improveContentTitle": "프로젝트 컨텍스트를 사용하여 AI로 내용 개선",
    "improving": "개선 중...",
    "improveWithAi": "AI로 개선",
    "cancel": "취소",
    "saving": "저장 중...",
    "save": "저장",
    "chooseProvider": "AI 공급자 선택",
    "close": "닫기",
    "noModel": "(모델 없음)",
    "directory": "디렉터리",
    "structureCount": "구조 · {count}개 생성 예정",
    "markMissing": "누락 항목 표시",
    "creating": "생성 중...",
    "create": "생성 ({count})",
    "expand": "펼치기",
    "collapse": "접기",
    "edit": "편집",
    "exists": "존재함",
    "createLabel": "생성",
    "fallbackFilename": "file.txt",
    "structureHints": {
      "claude": "Claude Code가 프로젝트 디렉터리에서 읽는 지침, 구성, 규칙, 명령, 스킬, 에이전트 및 훅.",
      "codex": "Codex CLI는 AGENTS.md를 프로젝트 가이드로, .codex/를 구성 및 프롬프트용으로 읽습니다.",
      "gemini": "Gemini CLI는 GEMINI.md를 프로젝트 컨텍스트로, .gemini/를 구성 및 명령용으로 읽습니다."
    },
    "structureNodes": {
      "CLAUDE.md": "프로젝트 지침 (컨텍스트, 명령, 규칙)",
      "CLAUDE.local.md": "로컬 지침 (커밋하지 않음; 개인 환경설정)",
      ".mcp.json": "프로젝트 MCP 서버",
      ".claude/settings.json": "프로젝트 구성 (버전 관리됨)",
      ".claude/settings.local.json": "로컬 구성 (버전 관리되지 않음)",
      ".claude/rules": "재사용 가능한 규칙",
      ".claude/rules/code-style.md": "규칙: 코드 스타일",
      ".claude/rules/testing.md": "규칙: 테스트",
      ".claude/rules/api-conventions.md": "규칙: API 규약",
      ".claude/commands": "사용자 지정 슬래시 명령",
      ".claude/commands/review.md": "/review 명령",
      ".claude/commands/fix-issue.md": "/fix-issue 명령",
      ".claude/skills": "프로젝트 스킬",
      ".claude/skills/deploy": "스킬: 배포",
      ".claude/skills/deploy/SKILL.md": "배포 스킬 정의",
      ".claude/skills/deploy/deploy-config.md": "배포 스킬 구성",
      ".claude/agents": "전문 서브에이전트",
      ".claude/agents/code-reviewer.md": "에이전트: 코드 리뷰어",
      ".claude/agents/security-auditor.md": "에이전트: 보안 감사관",
      ".claude/hooks": "훅 (라이프사이클 스크립트)",
      ".claude/hooks/validate-bash.sh": "훅: bash 명령 검증",
      "AGENTS.md": "Codex/에이전트용 프로젝트 가이드",
      ".codex": "Codex 구성",
      ".codex/config.toml": "Codex 프로젝트 구성",
      ".codex/prompts": "재사용 가능한 프롬프트/템플릿",
      ".codex/prompts/review.md": "프롬프트: 코드 리뷰",
      "GEMINI.md": "Gemini용 프로젝트 컨텍스트",
      ".gemini": "Gemini 구성",
      ".gemini/settings.json": "Gemini 프로젝트 구성",
      ".gemini/commands": "사용자 지정 명령",
      ".gemini/commands/review.toml": "명령: review",
      "modules/*": "마켓플레이스 모듈 루트",
      "modules/*/module.manifest.json": "초안 매니페스트 (AUTO 필드는 플랫폼에서 설정됨)",
      "modules/*/backend/index.js": "모듈 백엔드 — SDK defineModule() 골격",
      "modules/*/frontend": "모듈 프런트엔드 (Astro, 선택 사항)",
      "modules/*/README.md": "모듈 README",
      ".claude/rules/marketplace.md": "규칙: 마켓플레이스 아키텍처 (매니페스트, SDK, 기능)",
      "MARKETPLACE.md": "마켓플레이스 아키텍처 규칙 (매니페스트, SDK, 기능)"
    }
  },
  "mcpConfigPanel": {
    "noInstallResponse": "설치 응답 없음",
    "summaryTitle": "패널 기능을 CLI에 노출 (MCP)",
    "optional": "선택 사항",
    "description": "{providerId} CLI를 패널 도구와 연결합니다. 패널이 대상 서버에 직접 구성을 작성하므로 복사할 필요가 없습니다.",
    "configuredTitle": "대상에 구성됨",
    "tokenValidUntil": "토큰 유효 기간: {date}까지.",
    "restartCli": "새 MCP 서버를 로드하려면 터미널에서 CLI를 재시작하세요.",
    "configuring": "구성 중...",
    "configureAutomatically": "자동 구성",
    "regenerate": "토큰 재생성 및 재구성",
    "manualTitle": "수동 구성 (고급)",
    "generating": "생성 중...",
    "generateManualSnippet": "수동 스니펫 생성",
    "fileLabel": "파일",
    "snippetLabel": "스니펫 ({format})",
    "copy": "복사",
    "mcpUrlLabel": "MCP URL"
  },
  "conversationMedia": {
    "download": "다운로드",
    "close": "닫기",
    "previous": "이전",
    "next": "다음",
    "all": "전체",
    "images": "이미지",
    "documents": "문서",
    "attachmentsTitle": "대화 첨부 파일",
    "emptyConversation": "이 대화에 첨부 파일이 없습니다.",
    "imagesSection": "이미지",
    "documentsSection": "문서",
    "clickToExpand": "클릭하여 확장",
    "emptyImages": "이미지가 없습니다.",
    "emptyDocuments": "문서가 없습니다.",
    "mediaTitle": "미디어",
    "attachToChat": "채팅에 첨부",
    "uploadToChat": "채팅에 파일 업로드",
    "attachFailed": "채팅에 파일을 첨부하지 못했습니다."
  },
  "teamBoard": {
    "showMoreTasks": "작업 {count}개 더 보기",
    "showFewerTasks": "작업 간략히 보기",
    "title": "팀 작업 중",
    "progressOf": "{total}개 중 {done}개 작업 완료",
    "statusPending": "대기 중",
    "statusRunning": "진행 중",
    "statusDone": "완료",
    "statusFailed": "실패",
    "statusCanceled": "취소됨",
    "pendingPermission": "승인 대기 중",
    "openChat": "채팅 열기",
    "cancel": "작업 취소",
    "cancelConfirm": "이 작업을 취소할까요? 에이전트가 작업을 중단합니다.",
    "assignedTo": "담당: {agent}",
    "autoTurn": "팀 자동 알림",
    "dashboardTitle": "작업 중인 팀",
    "tokensSummary": "토큰: {total} (리더 {leader} · 팀 {workers})",
    "lessThan1s": "1초 미만",
    "insertions": "+{count}",
    "deletions": "-{count}",
    "viewDiff": "Diff 보기",
    "close": "닫기",
    "statusQueued": "대기열",
    "verifyRunning": "확인 중…",
    "addTaskSubmit": "할당",
    "verifyPassed": "검증됨",
    "verifyFailed": "검증 실패({attempts})",
    "filesChanged": "파일 {count}개",
    "diffTitle": "작업 변경 사항",
    "diffUnavailable": "이 작업의 변경 내용이 없습니다(워크트리 또는 변경 사항 없음).",
    "diffTruncated": "변경 내용이 잘렸습니다. 표시된 것보다 더 많은 내용이 변경되었습니다.",
    "branchIntegrated": "브랜치 통합됨",
    "cancelAll": "모두 취소",
    "cancelAllConfirm": "진행 중인 모든 작업을 취소하시겠습니까? 활성 계획은 실패로 표시됩니다.",
    "addTask": "작업 추가",
    "addTaskTitle": "하위 에이전트에게 작업 할당",
    "addTaskWorker": "하위 에이전트",
    "addTaskWorkerPlaceholder": "— 에이전트 선택 —",
    "addTaskNoWorkers": "이 리더에게 직접 연결된 하위 에이전트가 없습니다.",
    "addTaskInstruction": "지시 사항",
    "addTaskInstructionHint": "에이전트는 이 대화를 볼 수 없습니다. 필요한 맥락을 모두 포함하세요.",
    "addTaskTitleField": "제목(선택 사항)",
    "addTaskProject": "프로젝트(선택 사항)",
    "addTaskProjectNone": "— 프로젝트 없음 —",
    "addTaskSubmitting": "할당 중…",
    "feedbackUp": "좋은 결과",
    "feedbackDown": "좋지 않은 결과",
    "orgChart": "조직도",
    "tokensChipTitle": "이 작업에서 사용한 토큰",
    "loading": "불러오는 중…"
  },
  "agentInfo": {
    "roleLabel": "역할",
    "roleTooltip": "에이전트 역할: {role}",
    "providerLabel": "제공자",
    "providerModelTooltip": "제공자 {provider} · 모델 {model}",
    "projectLabel": "프로젝트",
    "projectTooltip": "프로젝트: {project}"
  },
  "mermaidDiagram": {
    "zoomOut": "축소",
    "zoomIn": "확대",
    "zoomReset": "확대/축소 재설정"
  },
  "assistantErrorBoundary": {
    "errorMessage": "어시스턴트를 불러오는 중 오류가 발생했습니다.",
    "retry": "다시 시도"
  }
} as const;

export default assistantPart3;
