const bitninja = {
  "header": {
    "description": "وكيل أمان شامل (WAF، مكافحة DoS، كشف البرمجيات الخبيثة وسمعة IP) على الخادم المتصل.",
    "statusChecking": "جارٍ التحقق…"
  },
  "sudo": {
    "label": "كلمة مرور sudo (عبارة مرور جلستك)",
    "placeholder": "فقط إذا طلبها الخادم لـ sudo",
    "hint": "يُستخدم فقط لهذا الإجراء ولا يُحفظ أبدًا في المتصفح."
  },
  "installCard": {
    "title": "BitNinja غير مثبّت",
    "description": "أدخل مفتاح الترخيص من حساب BitNinja الخاص بك لتثبيت العميل على هذا الخادم. يتم تنزيل المثبّت الرسمي (get.bitninja.io) وتشغيله بصلاحيات sudo.",
    "licensePlaceholder": "مفتاح الترخيص (مثال: ab12cd34-…)",
    "installButton": "تثبيت BitNinja"
  },
  "stats": {
    "service": "الخدمة",
    "license": "الترخيص",
    "version": "الإصدار"
  },
  "serviceControl": {
    "title": "التحكم في الخدمة",
    "start": "تشغيل",
    "restart": "إعادة التشغيل",
    "stop": "إيقاف"
  },
  "components": {
    "title": "مكونات الحماية",
    "checking": "جارٍ الفحص…",
    "noReported": "لم يُبلِّغ الوكيل عن أي مكوّن.",
    "active": "نشط",
    "inactive": "غير نشط"
  },
  "updateLicense": {
    "title": "تحديث مفتاح الترخيص",
    "placeholder": "مفتاح الترخيص الجديد",
    "applyButton": "تطبيق"
  },
  "toasts": {
    "sudoRequired": "أدخل كلمة مرور sudo وأعد المحاولة.",
    "sudoInvalid": "كلمة مرور sudo غير صحيحة.",
    "actionFailed": "فشل الإجراء. راجع المخرجات.",
    "installing": "جارٍ تثبيت BitNinja… قد يستغرق بضع دقائق.",
    "installed": "تم تثبيت BitNinja.",
    "serviceAction": "الخدمة: {action} بنجاح.",
    "componentToggleEnabled": "{component}: مُفعَّل.",
    "componentToggleDisabled": "{component}: مُعطَّل.",
    "licenseApplied": "تم تطبيق مفتاح الترخيص."
  },
  "errors": {
    "unknown": "خطأ غير معروف"
  },
  "status": {
    "notInstalled": "غير مثبّت",
    "running": "نشط",
    "installedStopped": "مثبّت (متوقف)",
    "serviceRunning": "يعمل",
    "serviceStopped": "متوقف",
    "licenseValid": "صالح",
    "licenseReview": "مراجعة"
  },
  "validation": {
    "licenseKeyRequired": "أدخل مفتاح الترخيص.",
    "newLicenseKeyRequired": "أدخل مفتاح الترخيص الجديد."
  },
  "settingsUi": {
    "settingsTitle": "إعدادات BitNinja",
    "settingsButton": "الإعدادات",
    "settingsDescription": "تفضيلات التشخيص للخادم النشط.",
    "settingsSections": "أقسام إعدادات BitNinja",
    "diagnostics": "التشخيص",
    "related": "ذات صلة",
    "logSource": "تُقرأ السجلات من خدمة BitNinja على الخادم المحدد.",
    "autoRefresh": "تحديث الحالة كل 30 ثانية",
    "logLines": "أسطر السجل",
    "relatedModules": "وحدات ذات صلة",
    "firewallAudit": "الجدار الناري والتدقيق",
    "credentials": "بيانات اعتماد BitNinja"
  },
  "logsUi": {
    "loading": "جارٍ تحميل السجل…",
    "empty": "لا توجد أحداث حديثة.",
    "loadError": "تعذّر تحميل السجل.",
    "logsTitle": "السجل الأخير",
    "logsDescription": "أحداث الخدمة على الخادم النشط.",
    "refreshLogs": "تحديث السجل",
    "logsHint": "اختر «تحديث السجل» لتحميل الأحداث."
  }
} as const;

export default bitninja;
