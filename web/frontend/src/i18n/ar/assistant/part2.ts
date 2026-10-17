const assistantPart2 = {
  "cliUsageBars": {
    "sourceReal": "الحصة المتبقية للحساب",
    "sourceEstimated": "الرموز المتبقية تقديريًا",
    "sourceTokens": "الرموز المتبقية",
    "cliUsage": "المتاح عبر CLI",
    "session5h": "الجلسة (5h)",
    "week": "أسبوع",
    "sessionHours": "الجلسة ({hours}h)",
    "resetSameDay": "إعادة تعيين {time}",
    "resetOtherDay": "إعادة تعيين {day}، {time}",
    "unavailable": "تعذّر تحميل حصة {provider}",
    "retry": "إعادة المحاولة"
  },
  "notifySettings": {
    "title": "إشعارات المساعد",
    "description": "نبّهني على أجهزتي (الويب والتطبيق وسطح المكتب) عند انتهاء محادثة بينما لا أكون أتابعها.",
    "saveError": "تعذّر الحفظ."
  },
  "voiceSettings": {
    "title": "الصوت (audio)",
    "description": "تحدث إلى المساعد واستمع إلى ردوده باستخدام OpenAI.",
    "missingCapabilities": "اضبط مفتاح API من OpenAI في مزود Codex لتفعيل الصوت.",
    "inputLabel": "الإدخال (STT)",
    "outputLabel": "الإخراج (TTS)",
    "notAvailable": "غير متاح",
    "voiceLabel": "الصوت",
    "autoSpeak": "قراءة الردود صوتياً تلقائياً عند الانتهاء",
    "audioProvider": "مزود الصوت",
    "providerApi": "API ‏(OpenAI/Gemini)",
    "providerPiper": "Piper (محلي)",
    "providerMinimax": "MiniMax",
    "providerApiHint": "يستخدم مفتاح API المُهيأ مسبقًا.",
    "piperReady": "Piper مثبّت",
    "piperMissing": "Piper غير مثبّت",
    "minimaxReady": "MiniMax جاهز",
    "minimaxMissing": "MiniMax غير متاح",
    "minimaxAuthMissing": "مفتاح MiniMax مفقود",
    "minimaxVoiceHint": "صوت MiniMax المستخدم."
  },
  "agentMarket": {
    "overrideHint": "يؤدي الحفظ إلى استبدال الإعدادات الموروثة في هذا المشروع بهذه الإعدادات.",
    "title": "Market",
    "description": "ملفات تعريف قابلة لإعادة الاستخدام لمشاريع هذا الخادم.",
    "search": "البحث بالاسم أو الوصف أو التخصص أو التقنية",
    "project": "المشروع النشط",
    "chooseProject": "اختر مشروعًا",
    "allProviders": "جميع المزوّدين",
    "allRoles": "جميع الأدوار",
    "allAssignments": "جميع التعيينات",
    "assigned": "معيّن",
    "unassigned": "غير معيّن",
    "inherited": "موروث",
    "removed": "تمت إزالته",
    "empty": "لا توجد ملفات تعريف للوكلاء بعد.",
    "noMatches": "لا توجد ملفات تعريف تطابق عوامل التصفية.",
    "loading": "جارٍ تحميل الكتالوج…",
    "retry": "إعادة المحاولة",
    "error": "تعذر تحميل الكتالوج أو تحديثه.",
    "pending": "العملية قيد التنفيذ…",
    "add": "إضافة إلى المشروع",
    "remove": "إزالة من المشروع",
    "configure": "إعداد التعيين",
    "editProfile": "تعديل الملف العام",
    "profileHint": "تنطبق تغييرات الملف على جميع مشاريعه.",
    "assignmentHint": "تنطبق هذه الإعدادات على المشروع المحدد فقط.",
    "removeConfirm": "هل تريد إزالة {name} من هذا المشروع؟ سيُحتفظ بالملف والسجل.",
    "saved": "تم حفظ التغييرات.",
    "specialty": "التخصص",
    "technologies": "التقنيات (مفصولة بفواصل)",
    "newProfile": "إنشاء ملف تعريف",
    "back": "العودة إلى الدردشة",
    "inheritedHint": "موروث من {project}. تُدار الإزالة من المشروع الأصلي.",
    "readOnly": "للقراءة فقط",
    "busy": "توجد أعمال أو موافقات معلقة. أكملها قبل تغيير التعيين.",
    "forbidden": "ليس لديك إذن لتنفيذ هذا الإجراء.",
    "contextChanged": "تغير الخادم أو الجلسة. أعد تحميل الكتالوج.",
    "uncertain": "تعذر تأكيد النتيجة. راجع الكتالوج قبل تكرار الإجراء.",
    "historical": "سجل سابق: غير متاح لدردشات جديدة",
    "inherit": "توريث من الملف",
    "none": "لا شيء",
    "jobTitle": "المنصب في المشروع",
    "instructions": "تعليمات المشروع",
    "limitsHint": "تُدمج الحدود مع الأذونات الحالية ولا تمنح وصولًا إضافيًا."
  },
  "agentsTab": {
    "teams": {
      "newTeamBtn": "فريق جديد",
      "newTeamTitle": "إنشاء فريق",
      "editTeamTitle": "تعديل الفريق",
      "nameLabel": "الاسم",
      "namePlaceholder": "مثال: الواجهة الخلفية، الواجهة الأمامية، التصميم…",
      "descriptionLabel": "الوصف (اختياري)",
      "colorLabel": "اللون",
      "createBtn": "إنشاء الفريق",
      "saveBtn": "حفظ",
      "cancelBtn": "إلغاء",
      "addAgentsBtn": "إضافة وكلاء",
      "addAgentsTitle": "إضافة وكلاء إلى الفريق",
      "addAgentsEmpty": "لا يوجد وكلاء متاحون للإضافة.",
      "addAgentsConfirm": "إضافة",
      "alreadyInTeam": "في فريق آخر",
      "removeFromTeamBtn": "إزالة من الفريق",
      "removeFromTeamConfirm": "إزالة هذا الوكيل من الفريق؟ لن يتم حذف الوكيل.",
      "deleteTeamBtn": "حذف الفريق",
      "deleteTeamConfirm": "حذف هذا الفريق؟",
      "deleteTeamKeepsAgentsNote": "لا يتم حذف الوكلاء: تتم إزالتهم من الفريق فقط.",
      "teamSelectorLabel": "الفريق",
      "groupRequired": "اختر أو أنشئ مجموعة",
      "teamSelectorPlaceholder": "— اختر مجموعة —",
      "noTeamOption": "بدون فريق",
      "emptyTeamHint": "فريق فارغ — أضف وكلاء بزر +.",
      "memberCount": "{count} عضو/أعضاء"
    },
    "cancel": "إلغاء",
    "saving": "جارٍ الحفظ…",
    "saveChanges": "حفظ التغييرات",
    "noDescription": "بدون وصف",
    "allTools": "جميع الأدوات",
    "toolsCount": "{count} أدوات",
    "noActiveModules": "لا توجد وحدات نشطة تحتوي على أدوات.",
    "removeAll": "إزالة الكل",
    "selectAll": "تحديد الكل",
    "sensitiveTool": "إجراء حساس",
    "confirmDeleteAgent": "هل تريد حذف الوكيل \"{name}\"؟",
    "confirmDeleteRole": "هل تريد حذف الدور \"{name}\"؟ سيتم إزالته من الوكلاء الذين يستخدمونه.",
    "duplicateName": "{name} (نسخة)",
    "editBtn": "تعديل",
    "deleteTitle": "حذف",
    "errorPrefix": "خطأ: {message}",
    "backToAgents": "الوكلاء",
    "createdBy": "أنشأه {ownerName}",
    "diagram": {
      "empty": "لا يوجد وكلاء — أنشئ وكيلاً لعرضه هنا",
      "connection": "اتصال"
    },
    "archetypes": {
      "devops": "DevOps / SRE",
      "security": "مدقق الأمان",
      "dba": "مدير قواعد البيانات",
      "support": "الدعم الفني",
      "nginx": "مدير الويب / Nginx",
      "backups": "متخصص النسخ الاحتياطية",
      "logs": "محلل السجلات",
      "automation": "الأتمتة / Cron"
    },
    "editor": {
      "titleNew": "وكيل جديد",
      "titleEdit": "تعديل الوكيل",
      "headerTitleNew": "وكيل جديد",
      "headerDescNew": "إعداد وكيل ذكاء اصطناعي جديد",
      "headerTitleEdit": "تحرير الوكيل",
      "headerDescEdit": "تغيير إعدادات الوكيل",
      "backToList": "العودة إلى الوكلاء",
      "tabGeneral": "عام",
      "tabModel": "النموذج",
      "tabHierarchy": "التسلسل الهرمي",
      "tabTools": "الأدوات",
      "tabResources": "الموارد",
      "tabAccess": "الوصول",
      "aiHelpTitle": "مساعدة AI",
      "aiHelpDesc": "اختر ملفاً وسيقوم AI بصياغة الاسم والوصف والموجّه والأدوات بشكل احترافي.",
      "aiHelpSelect": "اختر ملفاً…",
      "aiHelpFromDesc": "من وصفي الحالي",
      "aiHelpFromDescTitle": "تحسين بناءً على الوصف الحالي",
      "aiHelpGenerating": "جارٍ إنشاء الوكيل باستخدام AI…",
      "fieldName": "الاسم",
      "namePlaceholder": "مثال: مدقق الأمان",
      "fieldDescription": "الوصف",
      "descPlaceholder": "الغرض من هذا الوكيل",
      "fieldSystemPrompt": "موجّه النظام",
      "systemPromptPlaceholder": "تعليمات الوكيل وشخصيته وأهدافه…",
      "fieldAvatar": "الصورة الرمزية",
      "avatarRandomize": "عشوائي",
      "avatarAuto": "تلقائي",
      "avatarAttrs": {
        "top": "الشعر / القبعة",
        "hairColor": "لون الشعر",
        "eyes": "العينان",
        "eyebrows": "الحواجب",
        "mouth": "الفم",
        "skinColor": "لون البشرة",
        "clothing": "الملابس",
        "clothesColor": "لون الملابس",
        "accessories": "إكسسوار",
        "facialHair": "شعر الوجه",
        "facialHairColor": "لون اللحية"
      },
      "fieldProvider": "المزوّد",
      "fieldModel": "النموذج",
      "modelPlaceholder": "(افتراضي المزوّد)",
      "realtimeLabel": "الاتصال في الوقت الفعلي (جلسة منخفضة التأخير)",
      "realtimeDesc": "جلسة ثنائية الاتجاه للصوت/النص في البث (حسب المزوّد: OpenAI Realtime أو Gemini Live).",
      "realtimeUnavailable": "المزوّد \"{providerId}\" لا يدعم الجلسات في الوقت الفعلي. متاح فقط مع codex (OpenAI) أو gemini.",
      "multiAgentLabel": "وضع متعدد الوكلاء: تكرار هذا الوكيل عدة مرات بالتوازي",
      "multiAgentDescPre": "الوكيل ",
      "multiAgentDescBold": "يتضاعف × X",
      "multiAgentDescPost": ": تُقسَّم المهمة إلى X أجزاء وتحل كل نسخة (بنفس الموجّه والأدوات والمزوّد) جزءاً منها بالتوازي؛ ثم تُجمَّع في إجابة واحدة.",
      "multiAgentCopies": "عدد النسخ (X)",
      "multiAgentCopiesHint": "نسخ من الوكيل (2–8)",
      "multiAgentProvidersPre": "اختياري — توزيع النسخ بين عدة مزوّدين (المزوّد الرئيسي ",
      "multiAgentProvidersPost": " يشارك دائماً؛ حدّد مزوّدين آخرين للتوزيع):",
      "multiAgentApiHint": "يُستخدم المزوّدون في وضع API مع مفتاح API فقط. يتطلب وضع متعدد الوكلاء وضع API.",
      "roleHeading": "الدور والتسلسل الهرمي",
      "roleAssigned": "الدور المعيَّن",
      "roleNone": "بدون دور",
      "roleHint": "يوفر الدور موجّهاً أساسياً وأدوات افتراضية؛ ويقوم الوكيل بتخصيصها. أدِر الأدوار من قائمة الوكلاء.",
      "parentAgent": "الوكيل الأعلى (التبعية)",
      "parentNone": "لا شيء (المستوى الأعلى)",
      "parentHintPre": "سيتمكن وكيله الأعلى من ",
      "parentHintBold": "تفويضه",
      "parentHintPost": " مهاماً أثناء التنفيذ واستخدام إجابته.",
      "connectionsLabel": "الاتصالات مع وكلاء آخرين",
      "connectionsEmpty": "لا يوجد وكلاء آخرون.",
      "connectionsHint": "قناة ثنائية الاتجاه: يمكن لأي منهما طلب المعلومات أو تقديمها للآخر أثناء التنفيذ (أداة التفويض).",
      "supervisorLabel": "مشرف: يمكنه إنشاء محادثات لمرؤوسيه",
      "supervisorDesc": "يفتح محادثات فعلية في تبويب المحادثة ويُكلّف مرؤوسيه بالعمل (كل محادثة تبقى كسجل لذلك الوكيل). يُمنح أيضاً عبر الدور.",
      "allowAllTools": "السماح بجميع الأدوات المتاحة",
      "toolsDesc": "حدّد مجموعة الأدوات التي يمكن لهذا الوكيل استخدامها. تتقاطع القائمة مع ما تسمح به كل وحدة، لذلك لا توسّع الصلاحيات أبداً.",
      "associatedServers": "الخوادم المرتبطة",
      "serversEmpty": "لا توجد خوادم مسجّلة.",
      "attachedProjects": "المشاريع المرفقة",
      "attachedProjectsDesc": "اختر مشروعًا أو أكثر من الشجرة. تحديد مشروع أب يحدد كل مجلداته المتداخلة؛ يستخدم الوكيل مسارات عمل المشاريع المحددة.",
      "noParentProjects": "لا توجد مشاريع.",
      "graphIndexesTitle": "فهارس مخطط الكود",
      "graphIndexesDesc": "سيستخدم الوكيل هذه الفهارس لاستكشاف الكود عبر المخطط (الرموز والاستدعاءات والبنية) بدلاً من قراءة الملفات كاملة — ما يقلل استهلاك الرموز (tokens).",
      "graphIndexesEmpty": "لا توجد فهارس مخطط متاحة. قم بفهرسة مشروع من تبويب المشاريع.",
      "credentialTitle": "بيانات اعتماد الوصول",
      "saveObsidian": "حفظ الملخصات في مخزن Obsidian للمشروع المرفق",
      "agentSkills": "مهارات الوكيل",
      "createAgent": "إنشاء وكيل",
      "snippetsSection": "Snippets الطرفية",
      "snippetsCategoryLabel": "فئة الـ snippets",
      "snippetsCategoryNone": "(بدون)",
      "snippetsTagsLabel": "وسوم الفئة",
      "snippetsHelp": "يُرشِّح مسبقًا snippets الطرفية المتاحة لهذا الوكيل: اختر فئة، واختياريًا وسومًا من تلك الفئة. بدون فئة = بدون فلتر.",
      "snippetsNoAccess": "تعذّر تحميل snippets الطرفية (يتطلب صلاحية الطرفية).",
      "snippetsNoTags": "لا توجد وسوم لهذه الفئة."
    },
    "roleEditor": {
      "titleNew": "دور جديد",
      "titleEdit": "تعديل الدور",
      "fieldName": "اسم الدور",
      "namePlaceholder": "مثال: منسّق، مدقق، متخصص قواعد بيانات",
      "fieldDesc": "الوصف",
      "descPlaceholder": "ما الذي يمثّله هذا الدور",
      "fieldBasePrompt": "الموجّه الأساسي للدور",
      "basePromptPlaceholder": "السياسات والمسؤوليات والأسلوب المشترك لجميع الوكلاء بهذا الدور…",
      "basePromptHint": "يُحقن كأساس، قبل الموجّه الخاص بالوكيل.",
      "noToolLimit": "بدون حدّ للأدوات من الدور",
      "toolsDesc": "أدوات الدور تحدّد ما يمكن لوكلائه الوصول إليه (تتقاطع، لا توسّع أبداً).",
      "supervisorLabel": "منصب المشرف: الوكلاء بهذا الدور يمكنهم إنشاء محادثات لمرؤوسيهم",
      "supervisorDesc": "يمنح صلاحية التصرف كمشرف (أداة لفتح المحادثات وتعيين المهام) لكل وكيل يمتلك هذا الدور.",
      "createRole": "إنشاء دور"
    },
    "treeView": {
      "title": "التسلسل الهرمي للوكلاء",
      "reloadTitle": "إعادة تحميل الوكلاء وإعادة إنشاء الشجرة",
      "regenerating": "جارٍ إعادة الإنشاء…",
      "regenerate": "إعادة إنشاء",
      "description": "مخطط شجرة التبعية (خط متصل = الأعلى → المرؤوس) والاتصالات بين الأقران (خط منقّط). عيّن «الوكيل الأعلى» في محرر كل وكيل لبناء الشجرة."
    },
    "rolesList": {
      "newRole": "دور جديد",
      "description": "أدوار قابلة لإعادة الاستخدام (ملف تعريف بموجّه أساسي وأدوات) يمكن تعيينها لوكيل أو أكثر.",
      "emptyTitle": "لا توجد أدوار بعد",
      "emptyDesc": "أنشئ دوراً لتوحيد سلوك عدة وكلاء.",
      "agentsCount": "{count} وكيل"
    },
    "list": {
      "description": "وكلاء AI مخصصون: موجّه خاص وأدوات ومزوّد/نموذج. استخدمهم في المحادثة أو جدولتهم في Cron.",
      "treeBtn": "الشجرة",
      "treeBtnTitle": "عرض شجرة التسلسل الهرمي للوكلاء",
      "rolesBtn": "الأدوار",
      "rolesBtnTitle": "إنشاء أدوار الوكلاء وإدارتها",
      "newAgent": "وكيل جديد",
      "loading": "جارٍ تحميل الوكلاء…",
      "emptyTitle": "لا يوجد وكلاء بعد",
      "emptyDesc": "أنشئ وكيلاً للمحادثة بموجّه ومجموعة أدوات مخصصة.",
      "multiAgentTitle": "متعدد الوكلاء: {count} نسخ",
      "roleAssignedTitle": "الدور المعيَّن",
      "subordinateTitle": "مرؤوس لـ",
      "connectionsTitle": "الاتصالات مع وكلاء آخرين",
      "supervisorTitle": "مشرف: يمكنه إنشاء محادثات للمرؤوسين",
      "supervisorBadge": "مشرف",
      "realtimeTitle": "الاتصال في الوقت الفعلي",
      "realtimeBadge": "وقت فعلي",
      "startChat": "بدء المحادثة",
      "duplicateTitle": "تكرار",
      "noRoleGroupTitle": "بدون مجموعة عمل",
      "groupAria": "{name}: مجموعة عمل",
      "groupCount": "{count} وكيل",
      "noRoleGroupDesc": "وكلاء بدون دور مُعيَّن. عيّن دورًا من المحرر."
    },
    "resync": {
      "applying": "جارٍ الإنشاء…",
      "close": "إغلاق",
      "btn": "مزامنة مع القالب",
      "btnTitle": "مقارنة هذا الفريق بقالبه وإنشاء الوكلاء الناقصين",
      "modalTitle": "مزامنة «{name}» مع قالبه",
      "loading": "جارٍ المقارنة مع القالب…",
      "markersMissing": "فقد هذا الفريق علامات مصدر القالب، لذا لا يمكن مقارنته تلقائياً. يمكنك إنشاء الوكلاء الناقصين يدوياً.",
      "missingHeading": "ناقصون",
      "presentHeading": "موجودون",
      "extraHeading": "أُضيفوا يدوياً",
      "extraNote": "لن تُغيّر.",
      "nothingMissing": "الفريق مكتمل: لا يوجد وكلاء ناقصون من القالب.",
      "confirm": "إنشاء المحددين"
    }
  },
  "accessTab": {
    "all": "الكل",
    "permissionsTitle": "الوصول والأذونات",
    "permissionsDescription": "اليوم تخضع رؤية المساعد لإذن وحدة assistant في ملفك الشخصي. التفاصيل لكل دور (assistant.use / assistant.configure / assistant.module.<id>) مخطط لها في التكرار التالي.",
    "recentInvocations": "آخر استدعاءات الأدوات",
    "refreshAriaLabel": "تحديث الوصول",
    "loading": "جار التحميل...",
    "emptyRecent": "لا يوجد نشاط حديث.",
    "emptyProvider": "لا يوجد نشاط لهذا المزود.",
    "byUser": "بواسطة",
    "crossServerTitle": "الوصول إلى الخادم المرتبط",
    "cmdPrefix": "$ ",
    "passwordLabel": "كلمة المرور: ",
    "passphraseLabel": "عبارة المرور: ",
    "privateKeyLabel": "المفتاح الخاص",
    "autoApproveRevoke": "إلغاء",
    "autoApproveTitle": "الموافقة التلقائية",
    "autoApproveDescription": "أدوات لم تعد تطلب التأكيد (تمت الموافقة عليها باختيار «الموافقة وعدم السؤال مجدداً»). تسري التغييرات من التشغيل التالي.",
    "autoApproveEmpty": "لا توجد أدوات بموافقة تلقائية. تظهر الأدوات هنا عندما تختار «الموافقة وعدم السؤال مجدداً» عند الموافقة على إجراء للوكيل.",
    "autoApproveModeAuto": "الوضع التلقائي: لا تنطبق هذه القائمة"
  },
  "directoryPicker": {
    "title": "اختيار مجلد",
    "goUp": "للأعلى",
    "loading": "جارٍ التحميل…",
    "emptyDirs": "(لا توجد مجلدات فرعية)",
    "cancel": "إلغاء",
    "select": "استخدام هذا المجلد",
    "readError": "تعذّر قراءة المجلد"
  },
  "skillsSettings": {
    "title": "مهارات وأساليب المساعد",
    "helper": "قم بتفعيل أو تعطيل المكتبات والمهارات والأساليب التي تُحسّن سلوك المساعد.",
    "tokenNote": "تُرسل تعليمات كل مهارة ضمن الـ prompt المخزّن مؤقتاً (~0.1× في الأدوار التالية). يُقلّل Ponytail الكود وتوكنات الإخراج؛ في UI/UX Pro Max استخدم مستوى «مختصر» لتوفير التوكنات.",
    "search": "البحث عن مهارة…",
    "allCategories": "جميع الفئات",
    "loading": "جارٍ تحميل المهارات...",
    "empty": "لا توجد مهارات متاحة.",
    "noMatch": "لا توجد مهارة تطابق الفلتر.",
    "sourcePrefix": "المصدر:",
    "errorGeneric": "تعذّر تحديث المهارة. حاول مجدداً.",
    "activeShown": "{count} نشطة · {shown} معروضة."
  },
  "skillsPicker": {
    "searchPlaceholder": "البحث عن مهارة…",
    "resetTitle": "إزالة التخصيص (استخدام المهارات العامة)",
    "reset": "إعادة ضبط ({count})",
    "loading": "جارٍ تحميل المهارات…",
    "empty": "لا توجد مهارات.",
    "globalNote": "تُطبَّق فقط في محادثاتك، فوق المهارات العامة للمزوّد."
  },
  "skillCategories": {
    "methods": "أساليب المساعد",
    "code-quality": "جودة الكود",
    "web-quality": "جودة الويب (Lighthouse / CWV)",
    "ui-ux": "UI / UX / التصميم",
    "web-fullstack": "تطوير الويب الشامل بالذكاء الاصطناعي",
    "mobile": "تطبيقات الجوال",
    "code-agents": "وكلاء الكود",
    "reusable-skills": "مهارات AI قابلة لإعادة الاستخدام",
    "security": "أمان AI / الويب / التطبيقات",
    "token-savings": "توفير الرموز / تكاليف AI",
    "ai-prod": "وكلاء AI في الإنتاج",
    "devops": "DevOps / النشر",
    "testing": "الاختبار / جودة الكود",
    "data-rag": "قواعد البيانات / RAG / البحث",
    "automation": "الأتمتة / سير العمل",
    "other": "أخرى"
  },
  "skillCatalog": {
    "ask-protocol": {
      "name": "الاستفسار قبل اتخاذ القرار",
      "description": "يتيح للمساعد التوقف وسؤالك عن قرار محوري بدلاً من افتراضه (أداة lxp_ask + بروتوكول الأسئلة)."
    },
    "project-context-vault": {
      "name": "سياق المشروع (Obsidian)",
      "description": "يحقن ملاحظات سياق المشروع (Contexto.md / Errores.md) ويتيح البحث عن المزيد بـ obsidian.search_notes."
    },
    "ponytail": {
      "name": "Ponytail (كود مُختصر)",
      "description": "وضع التطوير المُختصر: كتابة الحد الأدنى الضروري من الكود (سلّم القرار + الضوابط)."
    },
    "ui-ux-pro-max": {
      "name": "UI/UX Pro Max (جودة الواجهة)",
      "description": "معايير UI/UX الاحترافية (إمكانية الوصول، اللمس، الطباعة، الحالات) مُحقنة في الطلب؛ مستوى مختصر أو كامل."
    },
    "openai-agents-sdk": {
      "name": "OpenAI Agents SDK",
      "description": "وكلاء OpenAI بالأدوات والتسليمات والضوابط والجلسات والتتبع."
    },
    "openai-agents-python": {
      "name": "OpenAI Agents Python SDK",
      "description": "Python SDK للوكلاء: Agent وRunner و@function_tool والتسليمات والتتبع."
    },
    "openai-agents-js": {
      "name": "OpenAI Agents JS SDK",
      "description": "TypeScript/JS SDK لوكلاء OpenAI: Agent وrun والأدوات (Zod) والتسليمات."
    },
    "mcp-docs": {
      "name": "Model Context Protocol",
      "description": "معيار مفتوح ('USB-C للذكاء الاصطناعي') لربط LLMs بالأدوات والموارد والطلبات."
    },
    "mcp-github": {
      "name": "MCP (GitHub)",
      "description": "مؤسسة MCP على GitHub: SDK رسمية (10 لغات) وخوادم مرجعية ومفتش."
    },
    "anthropic-mcp-intro": {
      "name": "Anthropic MCP Intro",
      "description": "إعلان Anthropic: MCP كمعيار مفتوح يحل مشكلة تكاملات N×M."
    },
    "n8n": {
      "name": "n8n",
      "description": "أتمتة سير العمل بترخيص مفتوح وقابلة للاستضافة الذاتية."
    },
    "make": {
      "name": "Make",
      "description": "أتمتة بصرية بدون كود عبر السيناريوهات (المعروفة سابقاً بـ Integromat)."
    },
    "zapier": {
      "name": "Zapier",
      "description": "أتمتة SaaS عبر المحفزات والإجراءات (Zaps)."
    },
    "temporal": {
      "name": "Temporal",
      "description": "تنسيق سير العمل المتين والمقاوم للأعطال."
    },
    "bullmq": {
      "name": "BullMQ",
      "description": "قوائم انتظار الوظائف المدعومة بـ Redis لـ Node.js."
    },
    "langgraph": {
      "name": "LangGraph",
      "description": "تنسيق وكلاء LLM كرسوم بيانية ذات حالة."
    },
    "codex-cli": {
      "name": "OpenAI Codex CLI",
      "description": "يوجّه الوكيل لاستخدام Codex CLI من OpenAI (وكيل كود في الطرفية)."
    },
    "codex-cli-features": {
      "name": "Codex CLI Features",
      "description": "يُعرّف الوكيل بقدرات Codex CLI (بيئة معزولة، موافقات، MCP، إعدادات)."
    },
    "codex-cloud": {
      "name": "Codex Cloud",
      "description": "يوجّه الوكيل لتفويض المهام إلى Codex Cloud (بيئات بعيدة، تنفيذ متوازٍ، طلبات PR)."
    },
    "claude-code-skills": {
      "name": "Claude Code Skills",
      "description": "يوجّه الوكيل لإنشاء واستخدام Claude Code Skills (مجلد يحتوي SKILL.md، معيار Agent Skills)."
    },
    "copilot-cloud-agent": {
      "name": "GitHub Copilot Cloud Agent",
      "description": "يوجّه الوكيل لتفويض المشكلات إلى وكيل البرمجة GitHub Copilot الذي يعمل في السحابة ويفتح طلبات PR."
    },
    "cursor": {
      "name": "Cursor",
      "description": "يوجّه الوكيل للعمل في محرر Cursor (Agent، سياق المستودع، القواعد)."
    },
    "agents-md": {
      "name": "AGENTS.md",
      "description": "يوجّه الوكيل لكتابة واتباع AGENTS.md، ملف التعليمات القياسي لوكلاء الكود."
    },
    "open-design-contribute": {
      "name": "Open Design — المساهمة (بدون كود)",
      "description": "تدفق موجّه بدون كود للمساهمة في Open Design (nexu-io): إرسال مهارة أو نظام تصميم، ترجمة الوثائق، تصحيح النصوص أو الإبلاغ عن خطأ، ويفتح PR/issue نيابةً عنك."
    },
    "supabase": {
      "name": "Supabase",
      "description": "خلفية Postgres مُدارة مع المصادقة والتخزين والبيانات الفورية."
    },
    "postgresql": {
      "name": "PostgreSQL",
      "description": "قاعدة بيانات علائقية متينة بأنواع بيانات غنية."
    },
    "pgvector": {
      "name": "pgvector",
      "description": "بحث التشابه المتجهي داخل Postgres."
    },
    "pinecone": {
      "name": "Pinecone",
      "description": "قاعدة بيانات متجهية مُدارة لـ RAG على نطاق واسع."
    },
    "qdrant": {
      "name": "Qdrant",
      "description": "محرك متجهي مفتوح المصدر مع تصفية الحمولة."
    },
    "weaviate": {
      "name": "Weaviate",
      "description": "قاعدة بيانات متجهية بمخطط ووحدات تضمين."
    },
    "github-actions": {
      "name": "GitHub Actions",
      "description": "CI/CD على GitHub بسير عمل YAML (.github/workflows) مُطلَقة بالأحداث."
    },
    "vercel": {
      "name": "Vercel",
      "description": "نشر الواجهات الأمامية والدوال بلا خادم مع معاينة لكل commit/PR."
    },
    "docker": {
      "name": "Docker",
      "description": "يُعبّئ التطبيقات في حاويات مؤقتة بصور خفيفة وقابلة للاستنساخ."
    },
    "nginx": {
      "name": "Nginx",
      "description": "خادم ويب عالي الأداء وبروكسي عكسي."
    },
    "pm2": {
      "name": "PM2",
      "description": "مدير عمليات Node مع التجميع وإعادة التشغيل والسجلات."
    },
    "redis": {
      "name": "Redis",
      "description": "مخزن في الذاكرة للتخزين المؤقت وقوائم الانتظار وهياكل البيانات."
    },
    "expo": {
      "name": "Expo",
      "description": "يوجّه الوكيل لتطوير تطبيقات React Native بـ Expo (expo-router، الوحدات، إضافات الإعداد)."
    },
    "eas-build": {
      "name": "EAS Build",
      "description": "يوجّه الوكيل لبناء ثنائيات iOS/Android في السحابة بـ EAS Build وملفات تعريف eas.json."
    },
    "eas-services": {
      "name": "EAS Services",
      "description": "يساعد الوكيل على استخدام منظومة EAS (Submit وUpdate/OTA وWorkflows) من البداية للنهاية."
    },
    "react-native": {
      "name": "React Native",
      "description": "يوجّه الوكيل لبناء واجهات أصيلة بـ React Native (المكونات الأساسية، الأنماط، المنصة)."
    },
    "firebase-auth": {
      "name": "Firebase Auth",
      "description": "يوجّه الوكيل لتطبيق المصادقة بـ Firebase Auth (مزودو الهوية، الرموز، الجلسة)."
    },
    "claude-agent-skills": {
      "name": "Claude Agent Skills",
      "description": "يُعبّئ القدرات القابلة لإعادة الاستخدام كـ Agent Skills (SKILL.md) تُحمَّل عند الطلب."
    },
    "claude-skills-github": {
      "name": "Claude Skills (GitHub)",
      "description": "مستودع anthropics/skills الرسمي: أمثلة ومواصفات وقالب كقاعدة ونمط."
    },
    "codex-agents-md-guide": {
      "name": "Codex AGENTS.md Guide",
      "description": "اصطلاح AGENTS.md في Codex لإعطاء تعليمات المشروع لوكلاء الكود."
    },
    "owasp-llm-top10": {
      "name": "OWASP Top 10 LLM",
      "description": "أبرز 10 مخاطر في تطبيقات LLM: حقن الطلبات، المخرجات غير الآمنة، الوكالة المفرطة."
    },
    "owasp-asvs": {
      "name": "OWASP ASVS",
      "description": "ASVS v5.0: معيار متطلبات الأمان القابلة للتحقق حسب المستويات."
    },
    "codeql": {
      "name": "CodeQL",
      "description": "CodeQL: استعلام الكود كبيانات (تدفق البيانات/التلوث) للكشف عن الثغرات."
    },
    "semgrep": {
      "name": "Semgrep",
      "description": "Semgrep: SAST بقواعد شبيهة بالكود + سلسلة التوريد (SCA) والأسرار، إشارة عالية."
    },
    "snyk": {
      "name": "Snyk",
      "description": "Snyk: SCA وCode (SAST) والحاويات وIaC وAPI/Web (DAST) مع معالجة موجّهة."
    },
    "owasp-zap": {
      "name": "OWASP ZAP",
      "description": "OWASP ZAP: أبرز ماسح ويب مفتوح المصدر لـ DAST (فحص سلبي/نشط)."
    },
    "skillspector": {
      "name": "SkillSpector (تدقيق مهارات AI)",
      "description": "يُدقق مهارات وكيل AI (SKILL.md + السكريبتات) بحثاً عن ثغرات ونوايا خبيثة قبل تثبيتها (NVIDIA, Apache-2.0)."
    },
    "playwright": {
      "name": "Playwright",
      "description": "اختبار E2E عبر المتصفحات مع انتظار تلقائي وتتبع."
    },
    "cypress": {
      "name": "Cypress",
      "description": "اختبار المكونات وE2E في المتصفح مع إعادة المحاولة."
    },
    "vitest": {
      "name": "Vitest",
      "description": "أداة اختبار سريعة أصيلة لـ Vite/ESM."
    },
    "jest": {
      "name": "Jest",
      "description": "إطار اختبار مع محاكاة ولقطات مدمجة."
    },
    "testing-library": {
      "name": "Testing Library",
      "description": "استعلامات محورها المستخدم لاختبار واجهات سهلة الوصول."
    },
    "storybook": {
      "name": "Storybook",
      "description": "تطوير واختبار مكونات UI بشكل معزول."
    },
    "openai-prompt-caching": {
      "name": "OpenAI Prompt Caching",
      "description": "يُقلل التكلفة تلقائياً بإعادة استخدام بادئة الطلب المخزنة مؤقتاً في OpenAI."
    },
    "openai-prompt-engineering": {
      "name": "OpenAI Prompt Engineering",
      "description": "كتابة طلبات دقيقة لتقليل التكرار واستهلاك الرموز."
    },
    "gemini-context-caching": {
      "name": "Gemini Context Caching",
      "description": "تخزين السياق الكبير المتكرر مؤقتاً في Gemini (صريح أو ضمني) لتخفيض تكلفة المدخلات."
    },
    "gemini-caching-api": {
      "name": "Gemini Caching API",
      "description": "واجهة Gemini cachedContents: إنشاء ذاكرة التخزين المؤقت وإعادة استخدامها وتحديث TTL وحذفها."
    },
    "litellm-cost-tracking": {
      "name": "LiteLLM Cost Tracking",
      "description": "قياس التكلفة وإسنادها لكل مفتاح/مستخدم/فريق عبر وكيل LiteLLM."
    },
    "litellm": {
      "name": "LiteLLM",
      "description": "بوابة موحدة لأكثر من 100 LLM (بتنسيق OpenAI) مع التخزين المؤقت والبدائل والتوجيه."
    },
    "figma-ai": {
      "name": "Figma AI",
      "description": "Figma AI: وكيل اللوحة، توليد الصور، والتحويل من التصميم إلى الكود."
    },
    "figma-make": {
      "name": "Figma Make",
      "description": "Figma Make: من الطلب أو الإطار إلى نموذج أولي/تطبيق وظيفي بكود حقيقي."
    },
    "figma-ai-tools": {
      "name": "Figma AI Tools",
      "description": "أدوات AI في Figma Design: First Draft، إعادة تسمية الطبقات، الصور، النص."
    },
    "framer": {
      "name": "Framer",
      "description": "Framer: مواقع بدون كود بلوحة بصرية ووكلاء AI وCMS ونشر."
    },
    "relume": {
      "name": "Relume",
      "description": "Relume: من الموجز إلى خريطة الموقع والنماذج الأولية ودليل الأسلوب بـ AI + مكتبة."
    },
    "design-md-tokens": {
      "name": "DESIGN.md (نظام قائم على الرموز)",
      "description": "توليد واجهة مخلصة للعلامة التجارية بـ DESIGN.md منظّم: رموز اللون/الطباعة/التباعد، مواصفات المكونات وقواعد ما يجوز وما لا يجوز (voltagent, MIT)."
    },
    "nextjs-app-router": {
      "name": "Next.js App Router",
      "description": "يوجّه الوكيل لبناء تطبيقات Next.js بـ App Router (Server Components، معالجات المسار، التخطيطات)."
    },
    "vercel-ai-sdk": {
      "name": "Vercel AI SDK",
      "description": "يساعد الوكيل على دمج LLMs بـ AI SDK (generateText، streamText، الأدوات، المخرجات المنظمة)."
    },
    "vercel-ai-gateway": {
      "name": "Vercel AI Gateway",
      "description": "يوجّه الوكيل لتوجيه الطلبات إلى نماذج متعددة عبر AI Gateway (نقطة نهاية واحدة، بديل، مراقبة)."
    },
    "openai-sdk-cli": {
      "name": "OpenAI SDKs and CLI",
      "description": "يوجّه الوكيل لاستخدام SDK الرسمية من OpenAI (Python/Node) وواجهة API بأسلوب صحيح."
    },
    "v0-vercel": {
      "name": "v0 by Vercel",
      "description": "يساعد الوكيل على توليد وتحسين واجهات React/Tailwind/shadcn بـ v0 من الطلبات."
    },
    "web-quality-audit": {
      "name": "تدقيق جودة الويب",
      "description": "تدقيق شامل لجودة الويب (الأداء، إمكانية الوصول، SEO، الأمان) مع تصنيف الخطورة."
    },
    "web-performance": {
      "name": "أداء الويب",
      "description": "تحسين سرعة التحميل وكفاءة وقت التشغيل (ميزانية الموارد + Lighthouse)."
    },
    "core-web-vitals": {
      "name": "Core Web Vitals (LCP/INP/CLS)",
      "description": "تحسين LCP وINP وCLS (العتبات عند الشريحة المئوية 75)."
    },
    "web-accessibility": {
      "name": "إمكانية الوصول للويب (WCAG 2.2)",
      "description": "تدقيق وتحسين إمكانية الوصول وفق WCAG 2.2 (الهدف AA)."
    },
    "web-seo": {
      "name": "SEO (تقني + في الصفحة)",
      "description": "تحسين ظهور محركات البحث: SEO التقني، في الصفحة والبيانات المنظمة."
    },
    "web-best-practices": {
      "name": "أفضل ممارسات الويب (الأمان)",
      "description": "أنماط حديثة للأمان والتوافق وجودة الكود."
    }
  }
} as const;

export default assistantPart2;
