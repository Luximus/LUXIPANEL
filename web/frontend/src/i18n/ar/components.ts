const components = {
  "setupWizardFooter": {
    "rights": "جميع الحقوق محفوظة.",
    "madeBy": "صنع بواسطة LUXISOFT",
    "termsAndConditions": "الشروط والأحكام",
    "privacyPolicy": "سياسة الخصوصية",
    "documentation": "الوثائق",
    "refundPolicy": "سياسة الاسترداد"
  },
  "dataTable": {
    "boolTrue": "نعم",
    "boolFalse": "لا",
    "selectPage": "تحديد الصفحة",
    "selectRow": "تحديد الصف",
    "actions": "إجراءات",
    "configure": "تكوين الجدول",
    "empty": "لا توجد نتائج لـ {title}.",
    "total": "الإجمالي",
    "selectedSummary": "{selected} محددة • عرض {shown} من {pageSize} نتيجة، إجمالي النتائج: {total}",
    "summary": "عرض {shown} من {pageSize} نتيجة، إجمالي النتائج: {total}",
    "prev": "السابق",
    "next": "التالي",
    "pageOf": "الصفحة {currentPage} من {totalPages}",
    "configureTitle": "تكوين الجدول",
    "columnsAndOrder": "الأعمدة المرئية والترتيب",
    "resultsPerPage": "النتائج لكل صفحة",
    "moveUp": "نقل {col} لأعلى",
    "moveDown": "نقل {col} لأسفل",
    "defaultTitle": "جدول",
    "dragHandle": "اسحب لإعادة الترتيب",
    "moveUpAria": "نقل {col} لأعلى",
    "moveDownAria": "نقل {col} لأسفل",
    "emptyCell": "-"
  },
  "confirmModal": {
    "title": "تأكيد",
    "cancel": "إلغاء",
    "confirm": "تأكيد",
    "alertTitle": "تنبيه",
    "alertOk": "فهمت",
    "promptTitle": "أدخل قيمة",
    "promptCancel": "إلغاء",
    "promptOk": "موافق"
  },
  "modalNavbar": {
    "back": "رجوع",
    "close": "إغلاق"
  },
  "viewSettingsModal": {
    "buttonLabel": "الإعدادات",
    "description": "إعدادات خاصة بهذه الوحدة",
    "close": "إغلاق"
  },
  "floatingTerminal": {
    "newSnippet": "مقتطف جديد",
    "close": "إغلاق",
    "name": "الاسم",
    "namePlaceholder": "مثال: إعادة تشغيل Postfix",
    "category": "الفئة",
    "tags": "الوسوم",
    "tagsHelp": "تعتمد الوسوم على الفئة المحددة",
    "command": "الأمر",
    "monacoHelp": "Monaco لصياغة الشل. استخدم Ctrl+Enter للحفظ من المحرر.",
    "cancel": "إلغاء",
    "save": "حفظ"
  },
  "installModal": {
    "running": "جارٍ التثبيت… قد يستغرق بعض الدقائق.",
    "success": "اكتمل التثبيت.",
    "failed": "فشل التثبيت. راجع السجل."
  },
  "enterPage": {
    "pageTitle": "الدخول بالرمز",
    "heading": "الدخول برمز الوصول",
    "subtitle": "أدخل الرمز الذي تلقّيته للوصول إلى اللوحة.",
    "codeLabel": "رمز الوصول",
    "codePlaceholder": "مثال: a1b2c3d4e5f6g7",
    "continue": "متابعة",
    "useAnotherCode": "استخدام رمز آخر",
    "codeShort": "الرمز",
    "terminalAi": "الطرفية / الذكاء الاصطناعي",
    "enter": "دخول",
    "willBeRedirected": "ستنتقل إلى صفحة تسجيل الدخول.",
    "featuresAvailable": "المتاحة",
    "featuresUnavailable": "غير متاحة",
    "invalidCode": "رمز الوصول غير صالح.",
    "verifyError": "تعذّر التحقق من الرمز. حاول مجدداً.",
    "networkError": "خطأ في الشبكة. حاول مجدداً.",
    "guestSessionError": "تعذّر بدء جلسة الضيف."
  },
  "dragHandle": "اسحب لإعادة الترتيب",
  "logoAlt": "LUXIPANEL",
  "default": " (افتراضي)",
  "emptyCell": "-",
  "loginEffects": {
    "defaultSuffix": " (افتراضي)",
    "webGpuHint": "يتطلب WebGPU. ستعرض المتصفحات غير المتوافقة الخلفية الافتراضية."
  },
  "tableSettings": {
    "pagination": "ترقيم الصفحات",
    "rowsPerPage": "عدد الصفوف في الصفحة في هذا الجدول.",
    "visibleActions": "الإجراءات المعروضة",
    "actionsHint": "اختر الإجراءات التي تظهر في قائمة «···» لكل صف."
  }
} as const;

export default components;
