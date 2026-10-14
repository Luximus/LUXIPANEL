import type { JobsMessages } from "./es";

export const ar: JobsMessages = {
  section: "الأعمال",
  title: "الأعمال",
  subtitle: "طلبات برمجية مع حجز ضمان للرموز",

  tab: {
    buyer: "طلباتي",
    professional: "المُسندة إليّ",
    profile: "ملفي المهني",
  },

  status: {
    draft: "مسودة",
    published: "منشور",
    assigned: "مُسند",
    in_progress: "قيد التنفيذ",
    disputed: "قيد النزاع",
    released: "تم الإفراج",
    cancelled: "ملغى",
  },

  field: {
    title: "العنوان",
    description: "الوصف",
    price: "السعر (رموز)",
    deadline: "الموعد النهائي",
    deliverables: "المُسلَّمات",
    country: "الدولة",
    language: "اللغة",
    workType: "نوع العمل",
  },

  workType: {
    fixed: "سعر ثابت",
    hourly: "بالساعة",
  },

  action: {
    publish: "نشر وتمويل",
    offer: "عرض على محترف",
    release: "الإفراج عن الدفعة",
    delete: "حذف",
    accept: "قبول",
    reject: "رفض",
    detail: "التفاصيل",
  },

  confirm: {
    publish: "سيتم حجز {price} رمزًا في الضمان. هل تريد المتابعة؟",
    release: "سيتم دفع 90% للمحترف. هل تؤكد؟",
    delete: "سيتم استرداد 95% (عمولة 5%). هل تريد الحذف؟",
  },

  toast: {
    created: "تم إنشاء الطلب",
    published: "تم نشر الطلب وتمويله",
    released: "تم الإفراج عن الدفعة",
    deleted: "تم حذف الطلب",
    accepted: "تم قبول العرض",
    rejected: "تم رفض العرض",
  },

  empty: {
    buyer: "ليس لديك أي طلبات بعد",
    professional: "ليس لديك أعمال مُسندة",
  },

  error: {
    generic: "حدث خطأ",
    insufficientTokens: "رصيد الرموز غير كافٍ",
    notCancellable: "لا يمكن حذف عمل قيد التنفيذ",
    offerActive: "يوجد عرض نشط بالفعل",
  },

  ai: {
    moderatePlan: "المراجعة والتخطيط",
    plan: "خطة العمل",
    translate: "الترجمة إلى لغتي",
    mustModerate: "يجب المراجعة قبل النشر",
    notModerated: "لم يجتز الطلب المراجعة",
    noBalance: "لا يوجد رصيد بيانات لاستخدام الذكاء الاصطناعي",
    unavailable: "مساعد الذكاء الاصطناعي غير متاح",
    estimate: "التقدير (رموز)",
    professionalShare: "المحترف (90%)",
    platformShare: "المنصة (10%)",
    milestones: "المراحل",
    risks: "المخاطر",
    questions: "أسئلة لاستكمالها",
    missing: "حقول ناقصة",
    draftPlaceholder: "صِف ما تحتاجه…",
    assist: "المساعدة بالذكاء الاصطناعي",
    moderation: {
      apto: "معتمد",
      spam: "بريد مزعج",
      malicioso: "ضار",
      adulto: "محتوى للبالغين",
      "no-software": "ليس برمجيات",
      approved: "معتمد",
    },
    toast: {
      moderated: "تمت مراجعة الطلب",
      planned: "تم إنشاء الخطة",
      translated: "الترجمة جاهزة",
    },
  },

  prof: {
    score: "التوافق",
    busyCount: "مشغول: {n}",
    search: {
      empty: "لم يُعثر على محترف بهذا البريد الإلكتروني",
    },
  },

  profile: {
    enroll: "تفعيل الملف المهني",
    save: "حفظ الملف",
    saved: "تم حفظ الملف",
    displayName: "الاسم المعروض",
    headline: "العنوان الرئيسي",
    bio: "نبذة عني",
    cvUrl: "رابط السيرة الذاتية",
    country: "الدولة",
    skills: "المهارات",
    languages: "اللغات",
    links: "روابط المعرض",
    availability: "التوفر",
    rating: "التقييم",
    activeJobs: "الأعمال النشطة",
    avail: {
      available: "متاح",
      busy: "مشغول",
      away: "غائب",
    },
  },

  offer: {
    sendMany: "إرسال عرض إلى {n} محترفين",
    sent: {
      summary: "تم إرسال {sent} عروض، وتخطّي {skipped}",
    },
    none: {
      selected: "اختر محترفًا واحدًا على الأقل",
    },
    searchPlaceholder: "البحث عن محترف بالبريد الإلكتروني",
    message: "رسالة (اختياري)",
    onlyAvailable: "المتاحون فقط",
  },

  channel: {
    title: "المتابعة",
    empty: "لا توجد رسائل بعد في هذا الطلب.",
    loadMore: "تحميل الأقدم",
    sendError: "تعذّر إرسال الرسالة.",
    notAssignedYet: "تُفتح القناة عند إسناد محترف.",
    attachTooLarge: "يتجاوز الملف الحد المسموح به.",
    systemRevoked: "تم إلغاء وصول مشترك",
    input: "اكتب رسالة…",
    send: "إرسال",
    attach: "إرفاق",
  },

  grants: {
    empty: "لم تشارك أي وصول.",
    share: "مشاركة الوصول",
    shareError: "تعذّرت مشاركة الوصول.",
    revoke: "إلغاء",
    revokeError: "تعذّر إلغاء الوصول.",
    revoked: "ملغى",
    refLabel: "المرجع (المعرّف / الرابط / ملاحظة)",
    keyForbidden:
      "لا يمكن مشاركة مادة المفتاح. شارك بدلاً من ذلك مرجع المورد (المعرّف).",
    label: "تسمية",
    type: {
      server: "خادم",
      ssh_key: "مفتاح SSH",
      group: "مجموعة",
      link: "رابط",
      note: "ملاحظة",
    },
  },

  progress: {
    title: "تقدّم العمل",
    meets100: "مكتمل 100%",
    inProgress: "قيد التنفيذ",
    report: "تقرير التقدّم",
    review: "مراجعة التقدّم (ذكاء اصطناعي)",
    toast: {
      done: "تمت مراجعة التقدّم",
    },
  },

  milestone: {
    title: "مرحلة 50%",
    request: "طلب 50%",
    requested: "تم طلب 50%",
    approve: "اعتماد 50%",
    approved: "تم صرف 50%",
    note: "ملاحظة (اختياري)",
    split: "المحترف {dev} · المنصة {fee}",
    toast: {
      requested: "تم طلب المرحلة",
      approved: "تم صرف 50% للمحترف",
    },
  },

  edit: {
    title: "تعديل الطلب",
    save: "حفظ التغييرات",
    propose: "اقتراح تغييرات",
    accept: "قبول التغييرات",
    reject: "رفض التغييرات",
    pending: "تغييرات مقترحة",
    topup: "تكلفة إضافية (رموز)",
    topupWarn: "قبول هذه التغييرات سيحجز {n} رمزًا إضافيًا.",
    remoderate: "يتطلب تعديل العنوان أو الوصف إعادة المراجعة.",
    toast: {
      saved: "تم تحديث الطلب",
      proposed: "تم اقتراح التغييرات على المحترف",
      accepted: "تم قبول التغييرات",
      rejected: "تم رفض التغييرات",
    },
  },

  dispute: {
    title: "نزاع / استرداد",
    badge: "قيد النزاع",
    open: "فتح نزاع",
    request: "طلب استرداد",
    reason: "سبب النزاع",
    notEligible: "لا يمكنك فتح نزاع بعد (يجب أن يمضي 30% من الوقت).",
    refundPct: "نسبة الاسترداد",
    refundPartial: "استرداد جزئي",
    refundFull: "استرداد كامل",
    continue: "متابعة العمل",
    toast: {
      requested: "تم فتح النزاع",
      resolved: "تم حل النزاع",
    },
  },

  rating: {
    title: "قيّم المحترف",
    submit: "إرسال التقييم",
    comment: "تعليق (اختياري)",
    done: "لقد قيّمت هذا العمل بالفعل",
    toast: {
      done: "شكرًا على تقييمك",
    },
  },

  test: {
    require: "اشتراط اختبار تقني",
    generate: "إنشاء الاختبار (ذكاء اصطناعي)",
    ready: "الاختبار جاهز · {n} أسئلة",
    aiUnavailable: "الذكاء الاصطناعي غير متاح لإنشاء الاختبار",
    required: "الاختبار مطلوب",
    present: "أداء الاختبار",
    passed: "ناجح",
    failed: "غير ناجح",
    passedBadge: "اختبار ✓",
    noTestBadge: "بدون اختبار",
    acceptLocked: "يجب اجتياز الاختبار للقبول",
    oneAttempt: "لديك محاولة واحدة فقط ووقت محدد. هل تبدأ الاختبار الآن؟",
    attemptExists: "لقد أديت هذا الاختبار بالفعل (محاولة واحدة)",
    gateRequired: "يتطلب هذا الطلب اجتياز اختبار تقني",
    notGenerated: "لم يتم إنشاء الاختبار بعد",
    invalid: "الاختبار غير صالح؛ يجب على المشتري إعادة إنشائه",
    questionOf: "السؤال {n} من 12",
    autoAdvance: "تقدم تلقائي: 10 ثوانٍ لكل سؤال، دون الرجوع",
    next: "التالي",
    submit: "إرسال الإجابات",
    result: {
      passed: "ناجح! يمكنك الآن قبول العمل.",
      failed: "غير ناجح. النتيجة: {score}/12.",
      timedOut: "انتهى وقت الاختبار.",
    },
    toast: {
      required: "تم تحديث تفضيل الاختبار",
      generated: "تم إنشاء الاختبار",
    },
  },
};
