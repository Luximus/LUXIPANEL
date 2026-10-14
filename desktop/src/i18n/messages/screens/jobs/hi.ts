import type { JobsMessages } from "./es";

export const hi: JobsMessages = {
  section: "कार्य",
  title: "कार्य",
  subtitle: "टोकन एस्क्रो के साथ सॉफ़्टवेयर अनुरोध",

  tab: {
    buyer: "मेरे अनुरोध",
    professional: "मुझे सौंपे गए",
    profile: "मेरी पेशेवर प्रोफ़ाइल",
  },

  status: {
    draft: "ड्राफ़्ट",
    published: "प्रकाशित",
    assigned: "सौंपा गया",
    in_progress: "जारी",
    disputed: "विवाद में",
    released: "जारी किया गया",
    cancelled: "रद्द",
  },

  field: {
    title: "शीर्षक",
    description: "विवरण",
    price: "मूल्य (टोकन)",
    deadline: "अंतिम तिथि",
    deliverables: "डिलिवरेबल्स",
    country: "देश",
    language: "भाषा",
    workType: "कार्य का प्रकार",
  },

  workType: {
    fixed: "निश्चित मूल्य",
    hourly: "प्रति घंटा",
  },

  action: {
    publish: "प्रकाशित करें और फंड करें",
    offer: "पेशेवर को प्रस्ताव दें",
    release: "भुगतान जारी करें",
    delete: "हटाएँ",
    accept: "स्वीकार करें",
    reject: "अस्वीकार करें",
    detail: "विवरण",
  },

  confirm: {
    publish: "{price} टोकन एस्क्रो में रोके जाएँगे। जारी रखें?",
    release: "पेशेवर को 90% का भुगतान किया जाएगा। पुष्टि करें?",
    delete: "95% वापस किया जाएगा (5% शुल्क)। हटाएँ?",
  },

  toast: {
    created: "अनुरोध बनाया गया",
    published: "अनुरोध प्रकाशित और फंड किया गया",
    released: "भुगतान जारी किया गया",
    deleted: "अनुरोध हटाया गया",
    accepted: "प्रस्ताव स्वीकृत",
    rejected: "प्रस्ताव अस्वीकृत",
  },

  empty: {
    buyer: "अभी तक आपके कोई अनुरोध नहीं हैं",
    professional: "आपको कोई कार्य नहीं सौंपा गया है",
  },

  error: {
    generic: "एक त्रुटि हुई",
    insufficientTokens: "टोकन शेष अपर्याप्त है",
    notCancellable: "जारी कार्य को हटाया नहीं जा सकता",
    offerActive: "एक सक्रिय प्रस्ताव पहले से मौजूद है",
  },

  ai: {
    moderatePlan: "मॉडरेट करें और योजना बनाएँ",
    plan: "कार्य योजना",
    translate: "मेरी भाषा में अनुवाद करें",
    mustModerate: "प्रकाशित करने से पहले आपको मॉडरेट करना होगा",
    notModerated: "अनुरोध मॉडरेशन में उत्तीर्ण नहीं हुआ",
    noBalance: "AI उपयोग के लिए कोई डेटा शेष नहीं है",
    unavailable: "AI सहायक उपलब्ध नहीं है",
    estimate: "अनुमान (टोकन)",
    professionalShare: "पेशेवर (90%)",
    platformShare: "प्लेटफ़ॉर्म (10%)",
    milestones: "मील के पत्थर",
    risks: "जोखिम",
    questions: "पूरा करने हेतु प्रश्न",
    missing: "अनुपलब्ध फ़ील्ड",
    draftPlaceholder: "बताएँ कि आपको क्या चाहिए…",
    assist: "AI से सहायता लें",
    moderation: {
      apto: "स्वीकृत",
      spam: "स्पैम",
      malicioso: "दुर्भावनापूर्ण",
      adulto: "वयस्क सामग्री",
      "no-software": "सॉफ़्टवेयर नहीं",
      approved: "स्वीकृत",
    },
    toast: {
      moderated: "अनुरोध मॉडरेट किया गया",
      planned: "योजना तैयार की गई",
      translated: "अनुवाद तैयार है",
    },
  },

  prof: {
    score: "अनुकूलता",
    busyCount: "व्यस्त: {n}",
    search: {
      empty: "उस ईमेल वाला कोई पेशेवर नहीं मिला",
    },
  },

  profile: {
    enroll: "पेशेवर प्रोफ़ाइल सक्रिय करें",
    save: "प्रोफ़ाइल सहेजें",
    saved: "प्रोफ़ाइल सहेजी गई",
    displayName: "प्रदर्शित नाम",
    headline: "शीर्षपंक्ति",
    bio: "मेरे बारे में",
    cvUrl: "CV का URL",
    country: "देश",
    skills: "कौशल",
    languages: "भाषाएँ",
    links: "पोर्टफ़ोलियो लिंक",
    availability: "उपलब्धता",
    rating: "रेटिंग",
    activeJobs: "सक्रिय कार्य",
    avail: {
      available: "उपलब्ध",
      busy: "व्यस्त",
      away: "अनुपस्थित",
    },
  },

  offer: {
    sendMany: "{n} पेशेवरों को प्रस्ताव भेजें",
    sent: {
      summary: "{sent} प्रस्ताव भेजे गए, {skipped} छोड़े गए",
    },
    none: {
      selected: "कम से कम एक पेशेवर चुनें",
    },
    searchPlaceholder: "ईमेल से पेशेवर खोजें",
    message: "संदेश (वैकल्पिक)",
    onlyAvailable: "केवल उपलब्ध",
  },

  channel: {
    title: "ट्रैकिंग",
    empty: "इस अनुरोध पर अभी तक कोई संदेश नहीं है।",
    loadMore: "पुराने लोड करें",
    sendError: "संदेश नहीं भेजा जा सका।",
    notAssignedYet: "पेशेवर सौंपे जाने पर चैनल सक्रिय होता है।",
    attachTooLarge: "फ़ाइल अनुमत सीमा से बड़ी है।",
    systemRevoked: "एक साझा पहुँच निरस्त की गई",
    input: "संदेश लिखें…",
    send: "भेजें",
    attach: "संलग्न करें",
  },

  grants: {
    empty: "आपने कोई पहुँच साझा नहीं की है।",
    share: "पहुँच साझा करें",
    shareError: "पहुँच साझा नहीं की जा सकी।",
    revoke: "निरस्त करें",
    revokeError: "पहुँच निरस्त नहीं की जा सकी।",
    revoked: "निरस्त",
    refLabel: "संदर्भ (id / लिंक / नोट)",
    keyForbidden:
      "कुंजी सामग्री साझा नहीं की जा सकती। इसके बजाय संसाधन का संदर्भ (id) साझा करें।",
    label: "लेबल",
    type: {
      server: "सर्वर",
      ssh_key: "SSH कुंजी",
      group: "समूह",
      link: "लिंक",
      note: "नोट",
    },
  },

  progress: {
    title: "कार्य की प्रगति",
    meets100: "100% पूरा",
    inProgress: "प्रगति पर",
    report: "प्रगति रिपोर्ट",
    review: "प्रगति की समीक्षा करें (AI)",
    toast: {
      done: "प्रगति की समीक्षा की गई",
    },
  },

  milestone: {
    title: "50% मील का पत्थर",
    request: "50% का अनुरोध करें",
    requested: "50% अनुरोधित",
    approve: "50% स्वीकृत करें",
    approved: "50% वितरित",
    note: "नोट (वैकल्पिक)",
    split: "पेशेवर {dev} · प्लेटफ़ॉर्म {fee}",
    toast: {
      requested: "मील का पत्थर अनुरोधित",
      approved: "पेशेवर को 50% वितरित किया गया",
    },
  },

  edit: {
    title: "अनुरोध संपादित करें",
    save: "परिवर्तन सहेजें",
    propose: "परिवर्तन प्रस्तावित करें",
    accept: "परिवर्तन स्वीकार करें",
    reject: "परिवर्तन अस्वीकार करें",
    pending: "प्रस्तावित परिवर्तन",
    topup: "अतिरिक्त लागत (टोकन)",
    topupWarn: "इन परिवर्तनों को स्वीकार करने पर {n} अतिरिक्त टोकन रोके जाएँगे।",
    remoderate: "शीर्षक या विवरण संपादित करने पर पुनः मॉडरेशन आवश्यक है।",
    toast: {
      saved: "अनुरोध अपडेट किया गया",
      proposed: "पेशेवर को परिवर्तन प्रस्तावित किए गए",
      accepted: "परिवर्तन स्वीकृत",
      rejected: "परिवर्तन अस्वीकृत",
    },
  },

  dispute: {
    title: "विवाद / धनवापसी",
    badge: "विवाद में",
    open: "विवाद खोलें",
    request: "धनवापसी का अनुरोध करें",
    reason: "विवाद का कारण",
    notEligible: "आप अभी विवाद नहीं कर सकते (समय का 30% बीतना चाहिए)।",
    refundPct: "वापसी का प्रतिशत",
    refundPartial: "आंशिक धनवापसी",
    refundFull: "पूर्ण धनवापसी",
    continue: "कार्य जारी रखें",
    toast: {
      requested: "विवाद खोला गया",
      resolved: "विवाद हल किया गया",
    },
  },

  rating: {
    title: "पेशेवर को रेट करें",
    submit: "रेटिंग सबमिट करें",
    comment: "टिप्पणी (वैकल्पिक)",
    done: "आप इस कार्य को पहले ही रेट कर चुके हैं",
    toast: {
      done: "आपकी रेटिंग के लिए धन्यवाद",
    },
  },

  test: {
    require: "तकनीकी टेस्ट अनिवार्य करें",
    generate: "टेस्ट बनाएँ (एआई)",
    ready: "टेस्ट तैयार · {n} प्रश्न",
    aiUnavailable: "टेस्ट बनाने के लिए एआई उपलब्ध नहीं है",
    required: "टेस्ट आवश्यक",
    present: "टेस्ट दें",
    passed: "उत्तीर्ण",
    failed: "उत्तीर्ण नहीं",
    passedBadge: "टेस्ट ✓",
    noTestBadge: "कोई टेस्ट नहीं",
    acceptLocked: "स्वीकार करने के लिए आपको टेस्ट पास करना होगा",
    oneAttempt: "आपके पास केवल 1 मौका और समय सीमा है। क्या अभी टेस्ट शुरू करें?",
    attemptExists: "आप यह टेस्ट पहले ही दे चुके हैं (1 मौका)",
    gateRequired: "इस आवश्यकता के लिए तकनीकी टेस्ट पास करना अनिवार्य है",
    notGenerated: "परीक्षण अभी तक उत्पन्न नहीं हुआ है",
    invalid: "परीक्षण मान्य नहीं है; खरीदार को इसे फिर से उत्पन्न करना होगा",
    questionOf: "प्रश्न {n} / 12",
    autoAdvance: "स्वतः आगे: प्रति प्रश्न 10 सेकंड, पीछे नहीं जा सकते",
    next: "अगला",
    submit: "उत्तर भेजें",
    result: {
      passed: "उत्तीर्ण! अब आप कार्य स्वीकार कर सकते हैं।",
      failed: "उत्तीर्ण नहीं। स्कोर: {score}/12।",
      timedOut: "टेस्ट का समय समाप्त हो गया।",
    },
    toast: {
      required: "टेस्ट प्राथमिकता अपडेट की गई",
      generated: "टेस्ट बनाया गया",
    },
  },
};
