import type { JobsMessages } from "./es";

export const en: JobsMessages = {
  section: "Jobs",
  title: "Jobs",
  subtitle: "Software requirements with token escrow",

  tab: {
    buyer: "My requirements",
    professional: "Assigned to me",
    profile: "My professional profile",
  },

  status: {
    draft: "Draft",
    published: "Published",
    assigned: "Assigned",
    in_progress: "In progress",
    disputed: "In dispute",
    released: "Released",
    cancelled: "Cancelled",
  },

  field: {
    title: "Title",
    description: "Description",
    price: "Price (tokens)",
    deadline: "Deadline",
    deliverables: "Deliverables",
    country: "Country",
    language: "Language",
    workType: "Work type",
  },

  workType: {
    fixed: "Fixed price",
    hourly: "Hourly",
  },

  action: {
    publish: "Publish & fund",
    offer: "Offer to professional",
    release: "Release payment",
    delete: "Delete",
    accept: "Accept",
    reject: "Reject",
    detail: "Details",
  },

  confirm: {
    publish: "{price} tokens will be held in escrow. Continue?",
    release: "90% will be paid to the professional. Confirm?",
    delete: "95% will be refunded (5% fee). Delete?",
  },

  toast: {
    created: "Requirement created",
    published: "Requirement published & funded",
    released: "Payment released",
    deleted: "Requirement deleted",
    accepted: "Offer accepted",
    rejected: "Offer rejected",
  },

  empty: {
    buyer: "You have no requirements yet",
    professional: "You have no assigned jobs",
  },

  error: {
    generic: "Something went wrong",
    insufficientTokens: "Insufficient token balance",
    notCancellable: "A job in progress cannot be deleted",
    offerActive: "An active offer already exists",
  },

  ai: {
    moderatePlan: "Moderate & plan",
    plan: "Work plan",
    translate: "Translate to my language",
    mustModerate: "You must moderate before publishing",
    notModerated: "The requirement did not pass moderation",
    noBalance: "No data balance to use AI",
    unavailable: "AI assistant unavailable",
    estimate: "Estimate (tokens)",
    professionalShare: "Professional (90%)",
    platformShare: "Platform (10%)",
    milestones: "Milestones",
    risks: "Risks",
    questions: "Questions to complete",
    missing: "Missing fields",
    draftPlaceholder: "Describe what you need…",
    assist: "Assist with AI",
    moderation: {
      apto: "Approved",
      spam: "Spam",
      malicioso: "Malicious",
      adulto: "Adult content",
      "no-software": "Not software",
      approved: "Approved",
    },
    toast: {
      moderated: "Requirement moderated",
      planned: "Plan generated",
      translated: "Translation ready",
    },
  },

  prof: {
    score: "Match score",
    busyCount: "Busy: {n}",
    search: {
      empty: "No professional found with that email",
    },
  },

  profile: {
    enroll: "Activate professional profile",
    save: "Save profile",
    saved: "Profile saved",
    displayName: "Display name",
    headline: "Headline",
    bio: "About me",
    cvUrl: "CV URL",
    country: "Country",
    skills: "Skills",
    languages: "Languages",
    links: "Portfolio links",
    availability: "Availability",
    rating: "Rating",
    activeJobs: "Active jobs",
    avail: {
      available: "Available",
      busy: "Busy",
      away: "Away",
    },
  },

  offer: {
    sendMany: "Send offer to {n} professionals",
    sent: {
      summary: "{sent} offers sent, {skipped} skipped",
    },
    none: {
      selected: "Select at least one professional",
    },
    searchPlaceholder: "Find professional by email",
    message: "Message (optional)",
    onlyAvailable: "Available only",
  },

  channel: {
    title: "Tracking",
    empty: "No messages yet on this requirement.",
    loadMore: "Load earlier",
    sendError: "Could not send the message.",
    notAssignedYet: "The channel opens once a professional is assigned.",
    attachTooLarge: "The file exceeds the allowed size.",
    systemRevoked: "A shared access was revoked",
    input: "Write a message…",
    send: "Send",
    attach: "Attach",
  },

  grants: {
    empty: "You haven't shared any access.",
    share: "Share access",
    shareError: "Could not share the access.",
    revoke: "Revoke",
    revokeError: "Could not revoke the access.",
    revoked: "Revoked",
    refLabel: "Reference (id / link / note)",
    keyForbidden:
      "Key material can't be shared. Share the resource reference (id) instead.",
    label: "Label",
    type: {
      server: "Server",
      ssh_key: "SSH key",
      group: "Group",
      link: "Link",
      note: "Note",
    },
  },

  progress: {
    title: "Work progress",
    meets100: "Meets 100%",
    inProgress: "In progress",
    report: "Progress report",
    review: "Review progress (AI)",
    toast: {
      done: "Progress reviewed",
    },
  },

  milestone: {
    title: "50% milestone",
    request: "Request 50%",
    requested: "50% requested",
    approve: "Approve 50%",
    approved: "50% disbursed",
    note: "Note (optional)",
    split: "Professional {dev} · Platform {fee}",
    toast: {
      requested: "Milestone requested",
      approved: "50% disbursed to the professional",
    },
  },

  edit: {
    title: "Edit requirement",
    save: "Save changes",
    propose: "Propose changes",
    accept: "Accept changes",
    reject: "Reject changes",
    pending: "Proposed changes",
    topup: "Additional cost (tokens)",
    topupWarn: "Accepting these changes will hold {n} additional tokens.",
    remoderate: "Editing title or description requires re-moderation.",
    toast: {
      saved: "Requirement updated",
      proposed: "Changes proposed to the professional",
      accepted: "Changes accepted",
      rejected: "Changes rejected",
    },
  },

  dispute: {
    title: "Dispute / refund",
    badge: "In dispute",
    open: "Open dispute",
    request: "Request refund",
    reason: "Dispute reason",
    notEligible: "You can't dispute yet (30% of time must elapse).",
    refundPct: "Percentage to refund",
    refundPartial: "Partial refund",
    refundFull: "Full refund",
    continue: "Continue work",
    toast: {
      requested: "Dispute opened",
      resolved: "Dispute resolved",
    },
  },

  rating: {
    title: "Rate the professional",
    submit: "Submit rating",
    comment: "Comment (optional)",
    done: "You already rated this job",
    toast: {
      done: "Thanks for your rating",
    },
  },

  test: {
    require: "Require technical test",
    generate: "Generate test (AI)",
    ready: "Test ready · {n} questions",
    aiUnavailable: "AI unavailable to generate the test",
    required: "Test required",
    present: "Take test",
    passed: "Passed",
    failed: "Not passed",
    passedBadge: "Test ✓",
    noTestBadge: "No test",
    acceptLocked: "You must pass the test to accept",
    oneAttempt: "You have only 1 attempt and a time limit. Start the test now?",
    attemptExists: "You already took this test (1 attempt)",
    gateRequired: "This requirement requires passing a technical test",
    notGenerated: "The test has not been generated yet",
    invalid: "The test is invalid; the buyer must regenerate it",
    questionOf: "Question {n} of 12",
    autoAdvance: "Auto-advance: 10 s per question, no going back",
    next: "Next",
    submit: "Submit answers",
    result: {
      passed: "Passed! You can now accept the job.",
      failed: "Not passed. Score: {score}/12.",
      timedOut: "The test time ran out.",
    },
    toast: {
      required: "Test preference updated",
      generated: "Test generated",
    },
  },
};
