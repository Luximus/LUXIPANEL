const hosting = {
  "pageTitle": "الاستضافة المشتركة",
  "pageSubtitle": "إدارة حسابات استضافة عملائك · متعدد المستأجرين بأسلوب WHM",
  "btnNewAccount": "حساب جديد",
  "options": {
    "planBasic": "أساسي",
    "planPro": "احترافي",
    "planBusiness": "أعمال",
    "planCustom": "مخصص"
  },
  "stats": {
    "total": "إجمالي الحسابات",
    "active": "نشطة",
    "suspended": "معلّقة",
    "terminated": "مُنهاة",
    "title": "استخدام {username}",
    "disk": "القرص (ميغابايت)",
    "domains": "النطاقات",
    "emails": "حسابات البريد",
    "databases": "قواعد البيانات",
    "subusers": "المستخدمون الفرعيون",
    "bandwidth": "النطاق الترددي (ميغابايت)",
    "percentUsed": "% مُستخدَم",
    "method": "طريقة القياس",
    "methodDu": "تقدير بـ du (أفضل جهد)",
    "methodQuotaTools": "حصة النظام (quota-tools)"
  },
  "tableTitle": "حسابات",
  "modal": {
    "titleNew": "حساب استضافة جديد",
    "tabs": {
      "account": "الحساب",
      "resources": "الموارد",
      "security": "الوحدات والأمان"
    },
    "labelUsername": "المستخدم *",
    "labelPassword": "كلمة المرور *",
    "labelName": "الاسم",
    "labelEmail": "البريد الإلكتروني",
    "labelPlan": "الخطة",
    "resourcesTitle": "حدود الموارد",
    "labelDisk": "القرص (MB)",
    "labelBandwidth": "عرض النطاق (MB)",
    "labelDomains": "النطاقات",
    "labelEmails": "حسابات البريد الإلكتروني",
    "labelNotes": "ملاحظات داخلية",
    "btnCancel": "إلغاء",
    "btnCreate": "إنشاء حساب",
    "hintUsername": "أحرف صغيرة وأرقام و - و _ فقط",
    "phUsername": "exampleclient",
    "phPassword": "8 أحرف على الأقل",
    "phName": "الشركة م.م",
    "phEmail": "admin@empresa.com",
    "phNotes": "ملاحظات اختيارية…",
    "labelStatus": "الحالة",
    "labelTenantGroup": "مجموعة المستأجر",
    "labelHomeRoot": "المجلد الجذر (home)",
    "hintTenantGroup": "مجموعة Linux المخصّصة للحساب (للقراءة فقط).",
    "hintHomeRoot": "جذر المستأجر على الخادم VPS (للقراءة فقط).",
    "labelDiskQuotaMb": "حصة القرص (ميغابايت)",
    "labelBandwidthQuotaMb": "حصة النطاق الترددي (ميغابايت)",
    "labelMaxDomains": "الحد الأقصى للنطاقات",
    "labelMaxEmailAccounts": "الحد الأقصى لحسابات البريد",
    "labelMaxDatabases": "الحد الأقصى لقواعد البيانات",
    "labelMaxSubUsers": "الحد الأقصى للمستخدمين الفرعيين",
    "labelAllowedModules": "الوحدات المسموح بها",
    "labelJailEnabled": "عزل الـ shell (chroot)",
    "hintJailEnabled": "يحصر طرفية/SSH هذا الحساب داخل مجلده (قفص chroot).",
    "modulesLoading": "جارٍ تحميل الوحدات…",
    "labelExpiresAt": "تاريخ الانتهاء",
    "hintExpiresAt": "اتركه فارغاً لعدم التحديد",
    "labelModules": "الوحدات المسموح بها",
    "hintModules": "حدد وحدات اللوحة التي يمكن لهذا العميل الوصول إليها.",
    "labelDatabases": "قواعد البيانات",
    "labelSubUsers": "المستخدمون الفرعيون",
    "labelJail": "عزل الصدفة (chroot)",
    "hintJail": "يحصر طرفية SSH لهذا الحساب داخل مجلده (قفص chroot).",
    "titleEdit": "تعديل: {username}"
  },
  "pwdModal": {
    "title": "تغيير كلمة المرور",
    "labelNew": "كلمة المرور الجديدة",
    "phPassword": "8 أحرف على الأقل",
    "btnCancel": "إلغاء",
    "btnChange": "تغيير"
  },
  "apiPageTitle": "توثيق API الاستضافة",
  "apiSubtitle": "إدارة آلية لحسابات الاستضافة المشتركة",
  "apiIntro": "تتيح لك Reseller API أتمتة إنشاء حسابات الاستضافة وتحديثها وتعليقها وحذفها من أي نظام خارجي — منصة الفوترة الخاصة بك، أو WHMCS، أو سكريبتات Bash، أو تكاملات Zapier، وغيرها. وهي متوافقة مع أي لغة أو أداة قادرة على إرسال طلبات HTTP.",
  "toc": {
    "label": "المحتويات",
    "items": [
      "1. المصادقة",
      "2. العزل والأمان",
      "3. نقاط النهاية المتاحة",
      "4. إنشاء حساب",
      "5. عرض الحسابات",
      "6. الحصول على حساب",
      "7. تحديث حساب",
      "8. تعليق / إعادة تفعيل",
      "9. تغيير كلمة المرور",
      "10. إحصائيات الحساب",
      "11. حذف حساب",
      "12. تسجيل دخول حساب الاستضافة",
      "13. رموز الخطأ",
      "14. أمثلة كاملة"
    ]
  },
  "auth": {
    "title": "المصادقة",
    "intro": "تقبل جميع نقاط النهاية في Reseller API طريقتَي مصادقة:",
    "apiKeyTitle": "API Key (موصى به للأتمتة)",
    "apiKeyDesc": "أنشئ API key من لوحة التحكم ← Webhooks ← API Keys. أرسلها في ترويسة Authorization:",
    "sessionTitle": "جلسة المدير (من اللوحة)",
    "sessionDesc": "إذا كنت تُرسل طلبات من لوحة LUXIPANEL نفسها (مثلاً من JavaScript في المتصفح)، فإن كوكي جلسة المدير تُقبل تلقائياً.",
    "warningTitle": "Ù…Ù‡Ù…:",
    "warningText": "لا تكشف عن API key في كود جانب العميل (JavaScript في المتصفح، تطبيقات الجوال، إلخ). استخدمها حصراً من الخوادم أو البيئات الخاصة."
  },
  "isolation": {
    "title": "العزل والأمان",
    "intro": "كل حساب استضافة بيئة معزولة تماماً. يضمن ذلك أن لا عميل يستطيع رؤية موارد الآخرين أو تعديلها، بصرف النظر عمّا إذا حاول ذلك عبر لوحة الويب أو API أو SSH أو أي وسيلة أخرى.",
    "features": [
      {
        "title": "بيانات معزولة",
        "desc": "ترتبط صناديق البريد والنطاقات وDNS وSSL والنسخ الاحتياطية بـ tenant_id الخاص بكل حساب. لا تتجاوز استعلامات SQL حدود المستأجرين أبداً."
      },
      {
        "title": "نظام الملفات",
        "desc": "لكل حساب دليله الرئيسي الخاص (/home/username). يقتصر مستكشف الملفات ووحدة التحكم على ذلك الدليل."
      },
      {
        "title": "جلسات مستقلة",
        "desc": "يتضمن JWT الخاص بحساب الاستضافة معرّف tenantId الخاص به. يرفض الخادم الخلفي أي طلب يحاول الوصول إلى موارد خارج هذا النطاق."
      }
    ]
  },
  "endpoints": {
    "title": "نقاط النهاية المتاحة",
    "colMethod": "الطريقة",
    "colPath": "المسار",
    "colDesc": "الوصف",
    "colAuth": "المصادقة",
    "rows": [
      [
        "POST",
        "/api/hosting/accounts",
        "إنشاء حساب استضافة",
        "مسؤول / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts",
        "سرد الحسابات (مقسّمة إلى صفحات)",
        "مسؤول / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts/:id",
        "الحصول على حساب واحد",
        "مسؤول / API Key"
      ],
      [
        "PUT",
        "/api/hosting/accounts/:id",
        "تحديث الحساب",
        "مسؤول / API Key"
      ],
      [
        "DELETE",
        "/api/hosting/accounts/:id",
        "حذف الحساب وجميع بياناته",
        "مسؤول / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/suspend",
        "تعليق الحساب",
        "مسؤول / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/unsuspend",
        "إعادة تنشيط حساب معلّق",
        "مسؤول / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/change-password",
        "تغيير كلمة المرور",
        "مسؤول / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts/:id/stats",
        "إحصائيات الاستخدام",
        "مسؤول / API Key"
      ],
      [
        "POST",
        "/api/hosting/auth/login",
        "تسجيل دخول حساب الاستضافة",
        "عام"
      ],
      [
        "POST",
        "/api/hosting/auth/logout",
        "تسجيل خروج الاستضافة",
        "جلسة استضافة"
      ]
    ]
  },
  "create": {
    "title": "إنشاء حساب",
    "labelBody": "الجسم (JSON)",
    "labelResp": "الاستجابة 201"
  },
  "list": {
    "title": "عرض الحسابات",
    "labelParams": "معاملات الاستعلام",
    "colParam": "المعامل",
    "colType": "النوع",
    "colDefault": "الافتراضي",
    "colDesc": "الوصف",
    "labelResp": "الاستجابة 200",
    "params": [
      [
        "page",
        "integer",
        "1",
        "الصفحة الحالية"
      ],
      [
        "limit",
        "integer",
        "20",
        "النتائج لكل صفحة (بحد أقصى 100)"
      ],
      [
        "search",
        "string",
        "—",
        "البحث في username وdisplayName وemail"
      ],
      [
        "status",
        "string",
        "—",
        "active | suspended | terminated"
      ]
    ]
  },
  "compactEndpoints": [
    {
      "id": "get",
      "num": "6",
      "title": "الحصول على الحساب",
      "method": "GET",
      "path": "/api/hosting/accounts/:id",
      "note": "يُرجع كائن الحساب دون حقل passwordHash."
    },
    {
      "id": "update",
      "num": "7",
      "title": "تحديث الحساب",
      "method": "PUT",
      "path": "/api/hosting/accounts/:id",
      "note": "يقبل الحقول نفسها المستخدمة في الإنشاء (باستثناء username وpassword). تُحدَّث الحقول المُرسَلة فقط."
    },
    {
      "id": "suspend",
      "num": "8",
      "title": "التعليق / إعادة التنشيط",
      "method": "POST",
      "path": "/api/hosting/accounts/:id/suspend  |  /unsuspend",
      "note": "يحظر التعليق وصول العميل فوراً. تُعيد إلغاء التعليق الحالة إلى 'active'. لا حاجة إلى نص في الطلب."
    },
    {
      "id": "password",
      "num": "9",
      "title": "تغيير كلمة المرور",
      "method": "POST",
      "path": "/api/hosting/accounts/:id/change-password",
      "note": "Body: {\"password\": \"NewPass123!\"} — 8 أحرف كحد أدنى."
    },
    {
      "id": "stats",
      "num": "10",
      "title": "إحصائيات الاستخدام",
      "method": "GET",
      "path": "/api/hosting/accounts/:id/stats",
      "note": "يُرجع الحصص المُكوَّنة والاستخدام الحالي للقرص وعرض النطاق والنطاقات النشطة وحسابات البريد الإلكتروني."
    },
    {
      "id": "delete",
      "num": "11",
      "title": "حذف الحساب",
      "method": "DELETE",
      "path": "/api/hosting/accounts/:id",
      "note": "⚠️ لا يمكن التراجع عنه. يحذف الحساب، وعبر ON DELETE CASCADE، جميع موارده: صناديق البريد والنطاقات وDNS وSSL والنسخ الاحتياطية."
    }
  ],
  "login": {
    "title": "تسجيل دخول حساب الاستضافة",
    "badgePublic": "· عام",
    "desc": "يُدخل العميل بيانات اعتماده في لوحة تسجيل الدخول. إذا كانت صحيحة، تُنشأ جلسة من النوع kind: \"hosting\" تقصر الوصول على موارد حسابه فحسب.",
    "labelBody": "الجسم (JSON)",
    "labelResp": "الاستجابة 200"
  },
  "errors": {
    "title": "رموز الخطأ",
    "intro": "جميع الأخطاء تتبع نفس البنية:",
    "colHttp": "HTTP",
    "colCode": "الرمز",
    "colDesc": "الوصف",
    "rows": [
      [
        "400",
        "VALIDATION_ERROR",
        "حقول غير صالحة أو مفقودة"
      ],
      [
        "401",
        "AUTH_ERROR",
        "مفتاح API key غير صالح أو منتهي الصلاحية أو مفقود"
      ],
      [
        "403",
        "FORBIDDEN",
        "ليس لديك إذن لهذه العملية"
      ],
      [
        "404",
        "NOT_FOUND",
        "الحساب المطلوب غير موجود"
      ],
      [
        "409",
        "CONFLICT",
        "اسم المستخدم مستخدم بالفعل"
      ],
      [
        "429",
        "RATE_LIMIT",
        "طلبات كثيرة جداً — انتظر قبل إعادة المحاولة"
      ],
      [
        "500",
        "INTERNAL_ERROR",
        "خطأ داخلي في الخادم"
      ]
    ],
    "generic": "خطأ",
    "unknown": "خطأ غير معروف"
  },
  "examples": {
    "title": "أمثلة كاملة",
    "labelCurl": "إنشاء حساب",
    "labelSuspend": "تعليق حساب",
    "labelList": "عرض القائمة مع الفلاتر",
    "labelNodeClient": "عميل قابل لإعادة الاستخدام",
    "labelPhpHelper": "فئة مساعدة بـ PHP"
  },
  "table": {
    "columnStatus": "الحالة",
    "columnPlan": "الخطة",
    "columnModules": "الوحدات",
    "columnCreated": "أُنشئ",
    "columnUpdated": "حُدّث",
    "columnTenantGroup": "المجموعة",
    "columnHomeRoot": "المجلد الرئيسي",
    "modulesCount": "{count} وحدات"
  },
  "audit": {
    "title": "تدقيق {username}",
    "eventType": "الحدث",
    "actor": "الفاعل",
    "date": "التاريخ",
    "empty": "لا توجد أحداث مسجّلة."
  },
  "actions": {
    "editModules": "تعديل الوحدات",
    "viewStats": "عرض الاستخدام",
    "viewAudit": "عرض التدقيق",
    "enableJail": "تفعيل القفص",
    "disableJail": "تعطيل القفص",
    "save": "حفظ",
    "saveChanges": "حفظ التغييرات",
    "saving": "جارٍ الحفظ…"
  },
  "confirm": {
    "enableJailBody": "تفعيل قفص chroot لهذا الحساب؟ سيُحصر طرفيته/SSH داخل مجلده.",
    "disableJailBody": "تعطيل قفص chroot؟ سيعود الحساب إلى shell عادي (/bin/bash).",
    "suspendBody": "هل تريد إيقاف هذا الحساب؟ سيفقد العميل وصوله.",
    "suspendTitle": "إيقاف الحساب",
    "suspendOk": "نعم، إيقاف",
    "deleteBody": "هل تريد حذف حساب \"{username}\" وجميع بياناته (البريد، النطاقات، الملفات)؟ لا يمكن التراجع عن هذا الإجراء.",
    "deleteTitle": "حذف الحساب"
  },
  "jail": {
    "degraded": "jailkit غير مثبّت على الخادم؛ لم يُفعّل القفص. ثبّت jailkit وأعد المحاولة.",
    "degradedTitle": "لم يُطبّق القفص",
    "enabledOk": "تم تفعيل القفص بنجاح."
  },
  "toasts": {
    "jailAlready": "القفص مُفعّل بالفعل",
    "jailNotActive": "القفص غير مُفعّل",
    "notActive": "الحساب غير نشط",
    "notSuspended": "الحساب غير موقوف"
  },
  "labels": {
    "statusActive": "نشط",
    "statusSuspended": "موقوف",
    "statusTerminated": "مُنهى"
  },
  "dataTable": {
    "columns": {
      "username": "المستخدم",
      "plan": "الخطة",
      "estado": "الحالة",
      "modulos": "الوحدات",
      "tenantGroup": "المجموعة",
      "homeRoot": "المجلد الرئيسي",
      "creado": "تاريخ الإنشاء",
      "actualizado": "آخر تحديث"
    },
    "filters": {
      "searchUser": "البحث حسب المستخدم…",
      "estado": "الحالة",
      "plan": "الخطة",
      "statusActive": "نشطة",
      "statusSuspended": "موقوفة",
      "statusTerminated": "منتهية"
    },
    "rowActions": {
      "edit": "تعديل",
      "viewStats": "عرض الاستخدام",
      "viewAudit": "عرض التدقيق",
      "password": "تغيير كلمة المرور",
      "suspend": "تعليق",
      "unsuspend": "إعادة التفعيل",
      "enableJail": "تفعيل القفص",
      "disableJail": "تعطيل القفص",
      "delete": "حذف"
    }
  },
  "runtime": {
    "defaultsLoadError": "تعذّر تحميل القيم الافتراضية.",
    "defaultsSaveError": "تعذّر حفظ القيم.",
    "defaultsSaved": "تم حفظ القيم على الخادم النشط."
  },
  "settingsUi": {
    "title": "إعدادات الاستضافة",
    "description": "تفضيلات جدول حسابات الاستضافة",
    "table": "الجدول",
    "apiProviders": "مزودو واجهة API",
    "rowsPerPage": "عدد الصفوف في الصفحة بجدول الحسابات.",
    "newAccountDefaults": "القيم الافتراضية للحسابات الجديدة",
    "defaultsHint": "تُحفظ على الخادم النشط. لا تتغير الحسابات الحالية.",
    "emailAccounts": "البريد الإلكتروني",
    "subusers": "المستخدمون الفرعيون",
    "defaultJail": "تفعيل العزل افتراضيًا",
    "defaultModules": "الوحدات الافتراضية (معرّفات مفصولة بفواصل)",
    "saveDefaults": "حفظ القيم الافتراضية",
    "relatedModules": "الوحدات ذات الصلة",
    "users": "المستخدمون",
    "domainsSsl": "النطاقات وSSL",
    "showAll": "إظهار الكل",
    "hideAll": "إخفاء الكل",
    "providerConnections": "اتصالات مديري الاستضافة",
    "providerConnectionsHint": "يوفر LUXIPANEL واجهة API. يحصل كل مدير على مفتاح وصلاحية محدودة لخادم ووحدات وعمليات محددة.",
    "newProvider": "مزود جديد",
    "managedServer": "الخادم المُدار",
    "localServer": "الخادم المحلي",
    "panelHttpsOrigin": "مصدر HTTPS لـ LUXIPANEL",
    "siteEngine": "محرك الموقع على الخادم",
    "accountModules": "وحدات الحسابات",
    "modulesHint": "معرّفات مفصولة بفواصل؛ تتحقق HOSTING من القائمة.",
    "apiOperations": "عمليات واجهة API",
    "readAccounts": "قراءة الحسابات",
    "createAccounts": "إنشاء الحسابات",
    "accountStatus": "حالة الحساب وبياناته",
    "viewUsage": "عرض الاستهلاك",
    "linkSites": "ربط المواقع",
    "panelAccess": "الوصول إلى اللوحة",
    "deleteAccounts": "حذف الحسابات",
    "createProviderKey": "إنشاء مزود ومفتاح",
    "copyKeyNow": "انسخ المفتاح الآن: لن يظهر إلا مرة واحدة.",
    "groupPolicy": {
      "editProvider": "تعديل المزود",
      "saveProvider": "حفظ المزود",
      "templateTitle": "صلاحيات المجموعة الأولية",
      "templateHint": "يتلقى كل حساب جديد هذه الصلاحيات في مجموعته الخاصة. للحسابات الحالية، عدّل المجموعة في المستخدمين.",
      "permissions": "صلاحيات تفصيلية",
      "sidebar": "القوائم",
      "views": "الصفحات",
      "actions": "الإجراءات",
      "filesScope": "الوصول إلى الملفات",
      "relativeHint": "مسار واحد في كل سطر، نسبة إلى مجلد الحساب. استخدم . للمجلد بأكمله.",
      "allowPaths": "المجلدات المسموحة",
      "denyPaths": "المجلدات المحظورة",
      "readOnlyPaths": "مجلدات للقراءة فقط",
      "defaultPath": "مجلد البداية",
      "commands": "أوامر الطرفية",
      "allowAllCommands": "السماح بجميع أوامر المستخدم",
      "commandGroups": "مجموعات الأوامر",
      "allowedCommands": "الأوامر المسموحة، أمر في كل سطر",
      "deniedCommands": "الأوامر المحظورة، أمر في كل سطر",
      "saving": "جارٍ الحفظ…",
      "saved": "تم حفظ المزود. يطبق على الحسابات الجديدة.",
      "created": "تم إنشاء المزود.",
      "loading": "جارٍ تحميل المزودين والصلاحيات…",
      "loadError": "تعذر تحميل الإعدادات.",
      "active": "نشط",
      "revoked": "ملغى",
      "rotateKey": "تجديد المفتاح",
      "rotateSuccess": "تم تجديد المفتاح. انسخ المفتاح الجديد.",
      "revoke": "إلغاء الوصول",
      "reactivate": "إعادة التفعيل",
      "accessUpdated": "تم تحديث الوصول.",
      "emptyProviders": "لم يتم إعداد مزودين بعد."
},
    "apiGuide": "دليل واجهة API",
    "retry": "إعادة المحاولة"
  },
  "apiDocs": {
    "pageTitle": "واجهة API لموفري الاستضافة",
    "backToHosting": "العودة إلى HOSTING",
    "contractVersion": "عقد HTTP · الإصدار 1",
    "heading": "اربط نظام إدارة الاستضافة",
    "intro": "يوفر LUXIPANEL هذه الواجهة ليُنشئ نظامك حسابات ويربط المواقع ويمنح الوصول وفق الصلاحيات المحددة في HOSTING.",
    "guideContents": "محتويات الدليل",
    "preparation": "الإعداد",
    "authentication": "المصادقة",
    "operations": "العمليات",
    "example": "مثال",
    "panelAccess": "الوصول إلى اللوحة",
    "limitsErrors": "الحدود والأخطاء",
    "preparationHeading": "الإعداد في HOSTING",
    "administrator": "المسؤول",
    "scope": "النطاق",
    "key": "المفتاح",
    "adminStep": "افتح HOSTING ← الإعدادات ← موفرو API وأنشئ موفرًا.",
    "scopeStep": "حدّد الخادم ومحرك المواقع والوحدات والحصص والعمليات المسموحة.",
    "keyStep": "انسخ مفتاح lhp_… مرة واحدة واحفظه فقط في خلفية نظام الإدارة.",
    "providerScopeNote": "يرتبط كل موفر بخادم واحد. تحصل الحسابات على مستخدم Linux ومجلد خاصين؛ ولا يختار نظام الإدارة كلمة المرور أو يتلقاها.",
    "anyProvider": "أي موفر",
    "endpointCapabilities": "يعرض الإصدار والعمليات والوحدات والخادم المعيّن.",
    "endpointPutAccount": "ينشئ حسابًا أو يسترجعه مع displayName وemail اختياريين.",
    "endpointGetAccount": "يعرض الحساب دون كشف كلمة المرور.",
    "endpointPatchAccount": "يحدّث الاسم أو البريد الإلكتروني أو الحالة active/suspended.",
    "endpointDeleteAccount": "يحذف حسابًا بلا مواقع مرتبطة. معطّل افتراضيًا.",
    "endpointUsage": "يعرض الحصص وبيانات الاستخدام المتاحة وتحذيرات القياس.",
    "endpointPutSite": "يربط نطاقًا بمحرك المواقع المُعدّ في HOSTING.",
    "endpointDeleteSite": "يزيل الموقع التابع لهذا الموفّر فقط.",
    "endpointTicket": "يصدر تذكرة وصول واحدة للوحة صالحة لمدة 60 ثانية.",
    "method": "الطريقة",
    "pathFromBase": "المسار من عنوان URL الأساسي",
    "permission": "الصلاحية",
    "result": "النتيجة",
    "operationsHeading": "عمليات نظام الإدارة",
    "authNote": "أرسل الطلبات إلى اللوحة عبر HTTPS. لا تُصادق ملفات تعريف ارتباط المسؤول ولا مفاتيح lxp_… على هذه الواجهة. لا تكشف مفتاح lhp_… للمتصفح.",
    "baseNote": "عنوان URL الأساسي: https://<panel>/api/hosting/v1. تقبل المعرّفات الخارجية من 1 إلى 128 حرفًا: حروفًا وأرقامًا و _ . : -.",
    "idempotencyNote": "طلبات PUT للحسابات والمواقع متكررة بأمان عند تطابق المرجع والمحتوى. لا يستطيع موفر الوصول إلى حسابات موفر آخر.",
    "createAccount": "إنشاء حساب أو استرجاعه",
    "accountResponseNote": "تتضمن الاستجابة { \"ok\": true, \"data\": … } المستخدم والمجلد الرئيسي والحالة والحصص. لا تتضمن تجزئة كلمة المرور.",
    "siteExampleNote": "للموقع، أرسل PUT /accounts/account-42/sites/site-1 مع { \"domain\": \"example.com\" }. ينشئ LUXIPANEL وكيل NGINX إلى المحرك المُعدّ؛ وينشر النظام المحتوى ويوجه حركة TLS للخادم.",
    "clientAccessHeading": "وصول العميل إلى LUXIPANEL",
    "clientAccessNote": "يتحقق خادم الإدارة من ملكية الحساب ويطلب POST /accounts/{accountId}/access-ticket. يرسل العنوان والتذكرة إلى المتصفح الذي يرسل POST إلى /api/auth/sso/handoff. التذكرة للاستخدام مرة واحدة وتنتهي بعد 60 ثانية. إذا لزم عامل ثانٍ، تكون الاستجابة 403 حتى يتوفر مسار متوافق.",
    "limitsHeading": "الحدود واستجابات الخطأ",
    "limitsNote": "تقبل الواجهة المراجع وبيانات الحساب الأساسية والنطاقات فقط. لا يستطيع النظام إرسال أوامر أو مسارات أو خوادم هدف أو إعدادات NGINX. يشير الموقع فقط إلى المحرك والمنفذ اللذين حددهما المسؤول.",
    "errorCodes": "400: إدخال غير صالح · 401: مفتاح مفقود أو غير صالح · 403: عملية غير مسموحة · 404: مرجع غير موجود · 409: تعارض أو عملية متزامنة · 5xx: خطأ في الخادم.",
    "bandwidthNote": "قياس استهلاك النطاق الترددي ليس موثوقًا بعد. راجع warnings في استجابة usage."
  }
} as const;

export default hosting;
