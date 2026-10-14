import type { JobsMessages } from "./es";

export const ko: JobsMessages = {
  section: "작업",
  title: "작업",
  subtitle: "토큰 에스크로가 적용된 소프트웨어 요청",

  tab: {
    buyer: "내 요청",
    professional: "나에게 배정됨",
    profile: "내 전문가 프로필",
  },

  status: {
    draft: "초안",
    published: "게시됨",
    assigned: "배정됨",
    in_progress: "진행 중",
    disputed: "분쟁 중",
    released: "지급됨",
    cancelled: "취소됨",
  },

  field: {
    title: "제목",
    description: "설명",
    price: "가격(토큰)",
    deadline: "마감일",
    deliverables: "산출물",
    country: "국가",
    language: "언어",
    workType: "작업 유형",
  },

  workType: {
    fixed: "고정 가격",
    hourly: "시간당",
  },

  action: {
    publish: "게시 및 예치",
    offer: "전문가에게 제안",
    release: "결제 지급",
    delete: "삭제",
    accept: "수락",
    reject: "거절",
    detail: "상세",
  },

  confirm: {
    publish: "{price} 토큰이 에스크로에 예치됩니다. 계속하시겠습니까?",
    release: "전문가에게 90%가 지급됩니다. 확인하시겠습니까?",
    delete: "95%가 환불됩니다(수수료 5%). 삭제하시겠습니까?",
  },

  toast: {
    created: "요청이 생성됨",
    published: "요청이 게시 및 예치됨",
    released: "결제가 지급됨",
    deleted: "요청이 삭제됨",
    accepted: "제안이 수락됨",
    rejected: "제안이 거절됨",
  },

  empty: {
    buyer: "아직 요청이 없습니다",
    professional: "배정된 작업이 없습니다",
  },

  error: {
    generic: "오류가 발생했습니다",
    insufficientTokens: "토큰 잔액이 부족합니다",
    notCancellable: "진행 중인 작업은 삭제할 수 없습니다",
    offerActive: "이미 활성 제안이 존재합니다",
  },

  ai: {
    moderatePlan: "검토 및 계획",
    plan: "작업 계획",
    translate: "내 언어로 번역",
    mustModerate: "게시하기 전에 검토해야 합니다",
    notModerated: "요청이 검토를 통과하지 못했습니다",
    noBalance: "AI를 사용할 데이터 잔액이 없습니다",
    unavailable: "AI 어시스턴트를 사용할 수 없습니다",
    estimate: "견적(토큰)",
    professionalShare: "전문가(90%)",
    platformShare: "플랫폼(10%)",
    milestones: "마일스톤",
    risks: "위험 요소",
    questions: "보완할 질문",
    missing: "누락된 항목",
    draftPlaceholder: "필요한 내용을 설명하세요…",
    assist: "AI로 지원",
    moderation: {
      apto: "승인됨",
      spam: "스팸",
      malicioso: "악성",
      adulto: "성인 콘텐츠",
      "no-software": "소프트웨어 아님",
      approved: "승인됨",
    },
    toast: {
      moderated: "요청이 검토됨",
      planned: "계획이 생성됨",
      translated: "번역 완료",
    },
  },

  prof: {
    score: "적합도",
    busyCount: "바쁨: {n}",
    search: {
      empty: "해당 이메일의 전문가를 찾을 수 없습니다",
    },
  },

  profile: {
    enroll: "전문가 프로필 활성화",
    save: "프로필 저장",
    saved: "프로필이 저장됨",
    displayName: "표시 이름",
    headline: "헤드라인",
    bio: "자기소개",
    cvUrl: "이력서 URL",
    country: "국가",
    skills: "기술",
    languages: "언어",
    links: "포트폴리오 링크",
    availability: "가용성",
    rating: "평점",
    activeJobs: "진행 중인 작업",
    avail: {
      available: "가능",
      busy: "바쁨",
      away: "자리 비움",
    },
  },

  offer: {
    sendMany: "전문가 {n}명에게 제안 보내기",
    sent: {
      summary: "제안 {sent}건 전송됨, {skipped}건 건너뜀",
    },
    none: {
      selected: "전문가를 한 명 이상 선택하세요",
    },
    searchPlaceholder: "이메일로 전문가 검색",
    message: "메시지(선택)",
    onlyAvailable: "가능한 사람만",
  },

  channel: {
    title: "추적",
    empty: "이 요청에 아직 메시지가 없습니다.",
    loadMore: "이전 항목 불러오기",
    sendError: "메시지를 보낼 수 없습니다.",
    notAssignedYet: "전문가가 배정되면 채널이 열립니다.",
    attachTooLarge: "파일이 허용 용량을 초과합니다.",
    systemRevoked: "공유 액세스가 취소됨",
    input: "메시지를 입력하세요…",
    send: "보내기",
    attach: "첨부",
  },

  grants: {
    empty: "공유한 액세스가 없습니다.",
    share: "액세스 공유",
    shareError: "액세스를 공유할 수 없습니다.",
    revoke: "취소",
    revokeError: "액세스를 취소할 수 없습니다.",
    revoked: "취소됨",
    refLabel: "참조(id / 링크 / 메모)",
    keyForbidden:
      "키 자료는 공유할 수 없습니다. 대신 리소스의 참조(id)를 공유하세요.",
    label: "레이블",
    type: {
      server: "서버",
      ssh_key: "SSH 키",
      group: "그룹",
      link: "링크",
      note: "메모",
    },
  },

  progress: {
    title: "작업 진행 상황",
    meets100: "100% 충족",
    inProgress: "진행 중",
    report: "진행 보고서",
    review: "진행 상황 검토(AI)",
    toast: {
      done: "진행 상황이 검토됨",
    },
  },

  milestone: {
    title: "50% 마일스톤",
    request: "50% 요청",
    requested: "50% 요청됨",
    approve: "50% 승인",
    approved: "50% 지급됨",
    note: "메모(선택)",
    split: "전문가 {dev} · 플랫폼 {fee}",
    toast: {
      requested: "마일스톤이 요청됨",
      approved: "전문가에게 50% 지급됨",
    },
  },

  edit: {
    title: "요청 편집",
    save: "변경사항 저장",
    propose: "변경 제안",
    accept: "변경 수락",
    reject: "변경 거절",
    pending: "제안된 변경사항",
    topup: "추가 비용(토큰)",
    topupWarn: "이 변경을 수락하면 토큰 {n}개가 추가로 예치됩니다.",
    remoderate: "제목이나 설명을 편집하면 재검토가 필요합니다.",
    toast: {
      saved: "요청이 업데이트됨",
      proposed: "전문가에게 변경이 제안됨",
      accepted: "변경이 수락됨",
      rejected: "변경이 거절됨",
    },
  },

  dispute: {
    title: "분쟁 / 환불",
    badge: "분쟁 중",
    open: "분쟁 열기",
    request: "환불 요청",
    reason: "분쟁 사유",
    notEligible: "아직 분쟁을 제기할 수 없습니다(기간의 30%가 경과해야 함).",
    refundPct: "환불 비율",
    refundPartial: "부분 환불",
    refundFull: "전액 환불",
    continue: "작업 계속",
    toast: {
      requested: "분쟁이 열림",
      resolved: "분쟁이 해결됨",
    },
  },

  rating: {
    title: "전문가 평가",
    submit: "평가 제출",
    comment: "댓글(선택)",
    done: "이미 이 작업을 평가했습니다",
    toast: {
      done: "평가해 주셔서 감사합니다",
    },
  },

  test: {
    require: "기술 테스트 요구",
    generate: "테스트 생성(AI)",
    ready: "테스트 준비됨 · {n}문항",
    aiUnavailable: "테스트를 생성할 AI를 사용할 수 없습니다",
    required: "테스트 필요",
    present: "테스트 응시",
    passed: "합격",
    failed: "불합격",
    passedBadge: "테스트 ✓",
    noTestBadge: "테스트 없음",
    acceptLocked: "수락하려면 테스트에 합격해야 합니다",
    oneAttempt: "기회는 1번뿐이며 시간 제한이 있습니다. 지금 테스트를 시작할까요?",
    attemptExists: "이미 이 테스트에 응시했습니다(1회)",
    gateRequired: "이 요건은 기술 테스트 합격이 필요합니다",
    notGenerated: "테스트가 아직 생성되지 않았습니다",
    invalid: "테스트가 유효하지 않습니다. 구매자가 다시 생성해야 합니다",
    questionOf: "12문항 중 {n}번",
    autoAdvance: "자동 진행: 문항당 10초, 되돌아갈 수 없음",
    next: "다음",
    submit: "답안 제출",
    result: {
      passed: "합격! 이제 작업을 수락할 수 있습니다.",
      failed: "불합격. 점수: {score}/12.",
      timedOut: "테스트 시간이 종료되었습니다.",
    },
    toast: {
      required: "테스트 설정이 업데이트되었습니다",
      generated: "테스트가 생성되었습니다",
    },
  },
};
