import type { JobsMessages } from "./es";

export const zh: JobsMessages = {
  section: "工作",
  title: "工作",
  subtitle: "采用代币托管的软件需求",

  tab: {
    buyer: "我的需求",
    professional: "分配给我的",
    profile: "我的专业档案",
  },

  status: {
    draft: "草稿",
    published: "已发布",
    assigned: "已分配",
    in_progress: "进行中",
    disputed: "争议中",
    released: "已放款",
    cancelled: "已取消",
  },

  field: {
    title: "标题",
    description: "描述",
    price: "价格（代币）",
    deadline: "截止日期",
    deliverables: "交付物",
    country: "国家/地区",
    language: "语言",
    workType: "工作类型",
  },

  workType: {
    fixed: "固定价格",
    hourly: "按小时",
  },

  action: {
    publish: "发布并注资",
    offer: "向专业人员发出报价",
    release: "放款",
    delete: "删除",
    accept: "接受",
    reject: "拒绝",
    detail: "详情",
  },

  confirm: {
    publish: "将有 {price} 个代币被托管。是否继续？",
    release: "将向专业人员支付 90%。是否确认？",
    delete: "将退还 95%（收取 5% 手续费）。是否删除？",
  },

  toast: {
    created: "需求已创建",
    published: "需求已发布并注资",
    released: "款项已放款",
    deleted: "需求已删除",
    accepted: "报价已接受",
    rejected: "报价已拒绝",
  },

  empty: {
    buyer: "您还没有任何需求",
    professional: "您没有已分配的工作",
  },

  error: {
    generic: "发生错误",
    insufficientTokens: "代币余额不足",
    notCancellable: "进行中的工作无法删除",
    offerActive: "已存在有效的报价",
  },

  ai: {
    moderatePlan: "审核并规划",
    plan: "工作计划",
    translate: "翻译为我的语言",
    mustModerate: "发布前必须先通过审核",
    notModerated: "该需求未通过审核",
    noBalance: "没有数据余额可用于 AI",
    unavailable: "AI 助手不可用",
    estimate: "估算（代币）",
    professionalShare: "专业人员（90%）",
    platformShare: "平台（10%）",
    milestones: "里程碑",
    risks: "风险",
    questions: "需补充的问题",
    missing: "缺少字段",
    draftPlaceholder: "描述您的需求……",
    assist: "用 AI 协助",
    moderation: {
      apto: "已通过",
      spam: "垃圾内容",
      malicioso: "恶意内容",
      adulto: "成人内容",
      "no-software": "非软件",
      approved: "已通过",
    },
    toast: {
      moderated: "需求已审核",
      planned: "计划已生成",
      translated: "翻译已就绪",
    },
  },

  prof: {
    score: "匹配度",
    busyCount: "忙碌：{n}",
    search: {
      empty: "未找到使用该邮箱的专业人员",
    },
  },

  profile: {
    enroll: "启用专业档案",
    save: "保存档案",
    saved: "档案已保存",
    displayName: "显示名称",
    headline: "标题",
    bio: "关于我",
    cvUrl: "简历链接",
    country: "国家/地区",
    skills: "技能",
    languages: "语言",
    links: "作品集链接",
    availability: "可用状态",
    rating: "评分",
    activeJobs: "进行中的工作",
    avail: {
      available: "空闲",
      busy: "忙碌",
      away: "离开",
    },
  },

  offer: {
    sendMany: "向 {n} 位专业人员发送报价",
    sent: {
      summary: "已发送 {sent} 条报价，跳过 {skipped} 条",
    },
    none: {
      selected: "请至少选择一位专业人员",
    },
    searchPlaceholder: "按邮箱查找专业人员",
    message: "留言（可选）",
    onlyAvailable: "仅显示空闲",
  },

  channel: {
    title: "跟踪",
    empty: "该需求暂无消息。",
    loadMore: "加载更早消息",
    sendError: "无法发送消息。",
    notAssignedYet: "分配专业人员后将开启沟通渠道。",
    attachTooLarge: "文件超出允许的大小。",
    systemRevoked: "已撤销一项共享访问",
    input: "输入消息……",
    send: "发送",
    attach: "附件",
  },

  grants: {
    empty: "您尚未共享任何访问权限。",
    share: "共享访问权限",
    shareError: "无法共享访问权限。",
    revoke: "撤销",
    revokeError: "无法撤销访问权限。",
    revoked: "已撤销",
    refLabel: "引用（id / 链接 / 备注）",
    keyForbidden:
      "不能共享密钥材料。请改为共享资源的引用（id）。",
    label: "标签",
    type: {
      server: "服务器",
      ssh_key: "SSH 密钥",
      group: "群组",
      link: "链接",
      note: "备注",
    },
  },

  progress: {
    title: "工作进度",
    meets100: "完成 100%",
    inProgress: "进行中",
    report: "进度报告",
    review: "审查进度（AI）",
    toast: {
      done: "进度已审查",
    },
  },

  milestone: {
    title: "50% 里程碑",
    request: "申请 50%",
    requested: "已申请 50%",
    approve: "批准 50%",
    approved: "已支付 50%",
    note: "备注（可选）",
    split: "专业人员 {dev} · 平台 {fee}",
    toast: {
      requested: "已申请里程碑",
      approved: "已向专业人员支付 50%",
    },
  },

  edit: {
    title: "编辑需求",
    save: "保存更改",
    propose: "提议更改",
    accept: "接受更改",
    reject: "拒绝更改",
    pending: "已提议的更改",
    topup: "追加费用（代币）",
    topupWarn: "接受这些更改将额外托管 {n} 个代币。",
    remoderate: "编辑标题或描述需要重新审核。",
    toast: {
      saved: "需求已更新",
      proposed: "已向专业人员提议更改",
      accepted: "更改已接受",
      rejected: "更改已拒绝",
    },
  },

  dispute: {
    title: "争议 / 退款",
    badge: "争议中",
    open: "发起争议",
    request: "申请退款",
    reason: "争议原因",
    notEligible: "暂时无法发起争议（需经过 30% 的时间）。",
    refundPct: "退款百分比",
    refundPartial: "部分退款",
    refundFull: "全额退款",
    continue: "继续工作",
    toast: {
      requested: "争议已发起",
      resolved: "争议已解决",
    },
  },

  rating: {
    title: "评价专业人员",
    submit: "提交评价",
    comment: "评论（可选）",
    done: "您已评价过此工作",
    toast: {
      done: "感谢您的评价",
    },
  },

  test: {
    require: "要求技术测试",
    generate: "生成测试（AI）",
    ready: "测试就绪 · {n} 道题",
    aiUnavailable: "AI 不可用，无法生成测试",
    required: "需要测试",
    present: "参加测试",
    passed: "通过",
    failed: "未通过",
    passedBadge: "测试 ✓",
    noTestBadge: "无测试",
    acceptLocked: "必须通过测试才能接受",
    oneAttempt: "您只有 1 次机会且有时间限制。现在开始测试吗？",
    attemptExists: "您已参加过此测试（仅 1 次机会）",
    gateRequired: "此需求要求通过技术测试",
    notGenerated: "测试尚未生成",
    invalid: "测试无效；买家必须重新生成",
    questionOf: "第 {n} 题，共 12 题",
    autoAdvance: "自动跳转：每题 10 秒，不能返回",
    next: "下一题",
    submit: "提交答案",
    result: {
      passed: "通过！现在您可以接受该工作。",
      failed: "未通过。得分：{score}/12。",
      timedOut: "测试时间已用完。",
    },
    toast: {
      required: "测试偏好已更新",
      generated: "测试已生成",
    },
  },
};
