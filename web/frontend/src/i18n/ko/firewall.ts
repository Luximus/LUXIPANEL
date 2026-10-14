const firewall = {
  "pageTitle": "방화벽",
  "installWarning": {
    "title": "방화벽 구성 요소가 감지되지 않음",
    "description": "패키지 관리자(apt/dnf/apk/...)가 기본 설정으로 실행되며 완료 후 서비스가 활성화됩니다.",
    "btnInstall": "지금 설치"
  },
  "statusCard": {
    "label": "방화벽 상태 (UFW)",
    "verifying": "확인 중...",
    "btnDisable": "비활성화",
    "btnEnable": "활성화"
  },
  "securityAudit": {
    "title": "보안 감사 (프리미엄)",
    "btnStartAudit": "분석 시작",
    "scannerChecking": "확인 중…",
    "btnInstallScanner": "설치",
    "scanProgress": "스캔 진행률",
    "scanAi": "AI 분석: 0%",
    "noReports": "완료된 감사가 없습니다. 새로운 감사를 시작하세요."
  },
  "ufwRules": {
    "title": "UFW 규칙",
    "btnNewRule": "새 규칙",
    "loading": "규칙 로드 중...",
    "btnAllowCloudflare": "Cloudflare 허용",
    "searchLabel": "규칙 검색",
    "searchPlaceholder": "포트, IP 또는 설명 검색…"
  },
  "fail2ban": {
    "btnBanIp": "IP 차단",
    "loading": "jail 로드 중..."
  },
  "ruleDialog": {
    "title": "새 UFW 규칙",
    "labelAction": "작업",
    "optionAllow": "허용",
    "optionDeny": "거부",
    "optionReject": "거절",
    "labelProtocol": "프로토콜",
    "optionAny": "모두",
    "labelPort": "포트",
    "placeholderPort": "25 또는 8080:8090",
    "labelFromIp": "출발 IP",
    "placeholderFromIp": "any 또는 192.168.0.0/24",
    "labelComment": "설명 (선택)",
    "placeholderComment": "SMTP 수신",
    "btnCancel": "취소",
    "btnAdd": "규칙 추가"
  },
  "banDialog": {
    "title": "IP 수동 차단",
    "labelIp": "IP 주소",
    "placeholderIp": "192.168.1.100",
    "labelJail": "Fail2ban 차단 그룹",
    "btnCancel": "취소",
    "btnBan": "차단"
  },
  "auditReportDialog": {
    "title": "보안 감사 보고서",
    "btnClose": "닫기"
  },
  "aiAssistant": {
    "btnSuggestRules": "규칙 제안 (AI)",
    "btnSuggestBans": "차단 제안 (AI)",
    "btnAnalyze": "AI 분석",
    "promptUfw": "연결된 서버의 UFW 방화벽을 분석하세요: 상태와 현재 규칙을 확인하고(firewall.ufw_status 도구 사용) 사용 중인 서비스를 손상시키지 않으면서 보안을 강화할 수 있는 똑똑한 UFW 규칙을 제안하세요. 제안하는 각 규칙에 대해 이유를 설명하고 적용할 정확한 `ufw` 명령을 포함하세요.",
    "promptFail2ban": "연결된 서버의 Fail2ban을 분석하세요: 구성된 jail과 차단된 IP를 확인하고(firewall.fail2ban_status 도구 사용) 무차별 대입 공격으로부터 보호하기 위한 차단 및 설정 개선을 제안하세요. jail, IP/범위 및 사유, 그리고 적용할 명령을 명시하세요.",
    "promptAnalyze": "연결된 서버의 방화벽에 대한 일반적인 보안 분석을 수행하세요. UFW와 Fail2ban의 상태를 확인하고(firewall.ufw_status 및 firewall.fail2ban_status 도구 사용), 위험, 노출된 포트, 취약한 설정을 식별한 뒤 우선순위가 지정된 권장 사항과 적용할 명령을 제공하세요.",
    "analyzeRule": "AI로 분석",
    "promptRule": "연결된 서버의 이 기존 UFW 규칙을 분석해 주세요. 어떤 트래픽을 허용하거나 차단하는지 설명하고, 위험을 평가하며, 유지/조정/교체 중 어느 쪽이 적절한지 제안하세요. 변경을 제안한다면 정확한 명령을 포함해 주세요.\n\n규칙 #{number}\n작업: {action}\n대상/포트: {to}\n출처: {from}\n프로토콜: {proto}\n설명: {comment}"
  },
  "labels": {
    "active": "활성",
    "inactive": "비활성",
    "bannedCount": "{count}개 차단됨",
    "moreIps": "+{n} 더",
    "installingText": "UFW 및 Fail2ban 설치 중… 몇 분이 걸릴 수 있습니다.",
    "installSuccessText": "방화벽이 성공적으로 설치되었습니다.",
    "cfEdgeBlockQuestion": "{ip}을(를) Cloudflare 엣지에서도 차단하시겠습니까?",
    "findingsCount": "{n}개의 항목 발견",
    "completedAt": "{time}에 완료됨",
    "scanAiProgress": "AI 분석: {pct}%",
    "overallRisk": "전체 위험도",
    "unknown": "알 수 없음",
    "keyThreats": "주요 위협",
    "recommendations": "권장 사항",
    "findingsTitle": "발견 항목 ({n})",
    "moreFindingsCount": "+{n}개 항목 더",
    "from": "출처",
    "any": "모두",
    "scanBitNinjaProgress": "BitNinja: {pct}%",
    "scanLynisProgress": "Lynis: {pct}%",
    "scanRkhunterProgress": "Rkhunter: {pct}%",
    "scanChkrootkitProgress": "Chkrootkit: {pct}%"
  },
  "empty": {
    "noRules": "규칙 없음",
    "noJails": "활성 jail 없음"
  },
  "actions": {
    "unban": "차단 해제",
    "blockInCloudflare": "Cloudflare에서 차단",
    "dismiss": "닫기"
  },
  "confirm": {
    "deleteRuleMsg": "규칙 #{number}을(를) 삭제하시겠습니까?",
    "deleteRuleTitle": "규칙 삭제",
    "disableFwMsg": "방화벽을 비활성화하시겠습니까? 서버의 네트워크 보호가 해제됩니다.",
    "disableFwTitle": "방화벽 비활성화",
    "disableFwBtn": "예, 비활성화",
    "cfAllowMsg": "Cloudflare 공식 IP 범위에서 80/443을 허용하는 UFW 규칙이 추가됩니다. 계속하시겠습니까?",
    "cfAllowTitle": "Cloudflare IP 허용",
    "cfAllowBtn": "계속"
  },
  "toasts": {
    "ruleDeleted": "규칙 삭제됨",
    "errorDelete": "삭제 오류",
    "ipUnbanned": "{ip} 차단 해제됨",
    "errorUnban": "차단 해제 오류",
    "fwEnabled": "방화벽 활성화됨",
    "errorEnable": "활성화 오류",
    "fwDisabled": "방화벽 비활성화됨",
    "errorDisable": "비활성화 오류",
    "fwInstalled": "방화벽 설치됨",
    "ruleAdded": "규칙 추가됨",
    "ipBanned": "{jail}에서 {ip} 차단됨",
    "errorBan": "차단 오류",
    "cfRulesApplied": "Cloudflare 규칙 적용됨 ({applied})",
    "errorCfRules": "Cloudflare 규칙 적용 오류",
    "errorStartAudit": "감사 시작 오류",
    "auditCompleted": "감사 완료",
    "auditFailed": "감사 실패",
    "errorLoadReport": "보고서 로드 오류",
    "reportOf": "{date} 보고서"
  },
  "errors": {
    "addRule": "규칙 추가 오류"
  },
  "runtime": {
    "statusError": "상태를 확인하지 못했습니다",
    "rulesLoadError": "규칙을 불러오지 못했습니다.",
    "noMatchingRules": "필터와 일치하는 규칙이 없습니다.",
    "loggingSaved": "로깅 수준을 저장했습니다.",
    "loggingSaveError": "로깅 수준을 저장하지 못했습니다."
  },
  "settingsUi": {
    "rulesView": "규칙 보기",
    "ufwLog": "UFW 로그",
    "related": "관련 항목",
    "title": "방화벽 설정",
    "description": "개인 필터 및 활성 서버의 UFW 로그입니다.",
    "sectionsLabel": "방화벽 설정 항목",
    "showActions": "작업 표시",
    "all": "전체",
    "limit": "제한",
    "serverSettingHint": "이 설정은 활성 서버 구성을 변경합니다.",
    "logLevel": "로그 수준",
    "off": "비활성화됨",
    "low": "낮음",
    "medium": "중간",
    "high": "높음",
    "full": "전체",
    "saveLevel": "수준 저장",
    "relatedModules": "관련 모듈"
  }
} as const;

export default firewall;
