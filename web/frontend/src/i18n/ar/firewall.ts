const firewall = {
  "pageTitle": "جدار الحماية",
  "installWarning": {
    "title": "مكونات جدار الحماية غير مكتشفة",
    "description": "سيتم تشغيل مدير الحزم (apt/dnf/apk/...) بالإعدادات الافتراضية وتفعيل الخدمات عند الانتهاء.",
    "btnInstall": "تثبيت الآن"
  },
  "statusCard": {
    "label": "حالة جدار الحماية (UFW)",
    "verifying": "جارٍ التحقق...",
    "btnDisable": "تعطيل",
    "btnEnable": "تفعيل"
  },
  "securityAudit": {
    "title": "التدقيق الأمني (Premium)",
    "btnStartAudit": "بدء الفحص",
    "scannerChecking": "جارٍ التحقق…",
    "btnInstallScanner": "تثبيت",
    "scanProgress": "تقدم الفحص",
    "scanAi": "تحليل الذكاء الاصطناعي: 0%",
    "noReports": "لا توجد تدقيقات مكتملة. ابدأ تدقيقاً جديداً للبدء."
  },
  "ufwRules": {
    "title": "قواعد UFW",
    "btnNewRule": "قاعدة جديدة",
    "loading": "جارٍ تحميل القواعد...",
    "btnAllowCloudflare": "السماح بـ Cloudflare",
    "searchLabel": "البحث عن قاعدة",
    "searchPlaceholder": "ابحث عن منفذ أو عنوان IP أو تعليق…"
  },
  "fail2ban": {
    "btnBanIp": "حظر IP",
    "loading": "جارٍ تحميل السجون..."
  },
  "ruleDialog": {
    "title": "قاعدة UFW جديدة",
    "labelAction": "الإجراء",
    "optionAllow": "سماح",
    "optionDeny": "رفض",
    "optionReject": "رفض",
    "labelProtocol": "البروتوكول",
    "optionAny": "أي",
    "labelPort": "المنفذ",
    "placeholderPort": "25 أو 8080:8090",
    "labelFromIp": "من IP",
    "placeholderFromIp": "any أو 192.168.0.0/24",
    "labelComment": "تعليق (اختياري)",
    "placeholderComment": "SMTP وارد",
    "btnCancel": "إلغاء",
    "btnAdd": "إضافة قاعدة"
  },
  "banDialog": {
    "title": "حظر IP يدوياً",
    "labelIp": "عنوان IP",
    "placeholderIp": "192.168.1.100",
    "labelJail": "السجن",
    "btnCancel": "إلغاء",
    "btnBan": "حظر"
  },
  "auditReportDialog": {
    "title": "تقرير التدقيق الأمني",
    "btnClose": "إغلاق"
  },
  "aiAssistant": {
    "btnSuggestRules": "اقتراح قواعد (ذكاء اصطناعي)",
    "btnSuggestBans": "اقتراح حظر (ذكاء اصطناعي)",
    "btnAnalyze": "تحليل بالذكاء الاصطناعي",
    "promptUfw": "حلل جدار الحماية UFW على الخادم المتصل: راجع حالته والقواعد الحالية (استخدم أداة firewall.ufw_status) واقترح قواعد UFW ذكية لتحسين الأمان دون كسر الخدمات قيد الاستخدام. لكل قاعدة مقترحة اشرح السبب وأضف أمر `ufw` الدقيق لتطبيقها.",
    "promptFail2ban": "حلل Fail2ban على الخادم المتصل: راجع الـ jails المهيّأة وعناوين IP المحظورة (استخدم أداة firewall.fail2ban_status) واقترح عمليات حظر وتحسينات في الإعدادات لحمايته من هجمات القوة الغاشمة. حدد الـ jail و IP/النطاق والسبب، والأوامر اللازمة لتطبيقها.",
    "promptAnalyze": "أجرِ تحليلاً أمنياً عاماً لجدار الحماية على الخادم المتصل. راجع حالة UFW و Fail2ban (استخدم أداتي firewall.ufw_status و firewall.fail2ban_status)، وحدد المخاطر والمنافذ المكشوفة والإعدادات الضعيفة، وقدّم توصيات مرتّبة حسب الأولوية مع الأوامر اللازمة لتطبيقها.",
    "analyzeRule": "تحليل بالذكاء الاصطناعي",
    "promptRule": "حلل قاعدة UFW الحالية هذه على الخادم المتصل. اشرح حركة المرور التي تسمح بها أو تحظرها، وقيم مخاطرها، واقترح الإبقاء عليها أو تعديلها أو استبدالها. إذا اقترحت تغييرات فاذكر الأوامر الدقيقة.\n\nقاعدة #{number}\nالإجراء: {action}\nالوجهة/المنفذ: {to}\nالمصدر: {from}\nالبروتوكول: {proto}\nتعليق: {comment}"
  },
  "labels": {
    "active": "نشط",
    "inactive": "غير نشط",
    "bannedCount": "{count} محظورة",
    "moreIps": "+{n} أخرى",
    "installingText": "جارٍ تثبيت UFW و Fail2ban… قد يستغرق بضع دقائق.",
    "installSuccessText": "تم تثبيت جدار الحماية بنجاح.",
    "cfEdgeBlockQuestion": "هل تريد حظر {ip} أيضاً على حافة Cloudflare؟",
    "findingsCount": "{n} نتيجة",
    "completedAt": "اكتمل في {time}",
    "scanAiProgress": "تحليل AI: {pct}%",
    "overallRisk": "المخاطر العامة",
    "unknown": "غير معروف",
    "keyThreats": "التهديدات الرئيسية",
    "recommendations": "التوصيات",
    "findingsTitle": "النتائج ({n})",
    "moreFindingsCount": "+{n} نتائج أخرى",
    "from": "من",
    "any": "أيّ",
    "scanBitNinjaProgress": "BitNinja: {pct}%",
    "scanLynisProgress": "Lynis: {pct}%",
    "scanRkhunterProgress": "Rkhunter: {pct}%",
    "scanChkrootkitProgress": "Chkrootkit: {pct}%"
  },
  "empty": {
    "noRules": "لا توجد قواعد",
    "noJails": "لا توجد سجون نشطة"
  },
  "actions": {
    "unban": "رفع الحظر",
    "blockInCloudflare": "حظر في Cloudflare",
    "dismiss": "رفض"
  },
  "confirm": {
    "deleteRuleMsg": "حذف القاعدة #{number}؟",
    "deleteRuleTitle": "حذف القاعدة",
    "disableFwMsg": "تعطيل جدار الحماية؟ سيصبح الخادم بدون حماية شبكية.",
    "disableFwTitle": "تعطيل جدار الحماية",
    "disableFwBtn": "نعم، تعطيل",
    "cfAllowMsg": "سيتم إضافة قواعد UFW للسماح بـ 80/443 من نطاقات Cloudflare الرسمية. هل تريد المتابعة؟",
    "cfAllowTitle": "السماح بـ IPs من Cloudflare",
    "cfAllowBtn": "متابعة"
  },
  "toasts": {
    "ruleDeleted": "تم حذف القاعدة",
    "errorDelete": "خطأ في الحذف",
    "ipUnbanned": "تم رفع حظر {ip}",
    "errorUnban": "خطأ في رفع الحظر",
    "fwEnabled": "تم تفعيل جدار الحماية",
    "errorEnable": "خطأ في التفعيل",
    "fwDisabled": "تم تعطيل جدار الحماية",
    "errorDisable": "خطأ في التعطيل",
    "fwInstalled": "تم تثبيت جدار الحماية",
    "ruleAdded": "تمت إضافة القاعدة",
    "ipBanned": "تم حظر {ip} في {jail}",
    "errorBan": "خطأ في الحظر",
    "cfRulesApplied": "تم تطبيق قواعد Cloudflare ({applied})",
    "errorCfRules": "خطأ في تطبيق قواعد Cloudflare",
    "errorStartAudit": "خطأ في بدء المراجعة",
    "auditCompleted": "اكتملت المراجعة",
    "auditFailed": "فشلت المراجعة",
    "errorLoadReport": "خطأ في تحميل التقرير",
    "reportOf": "تقرير {date}"
  },
  "errors": {
    "addRule": "خطأ في إضافة القاعدة"
  },
  "runtime": {
    "statusError": "تعذّر التحقق من الحالة",
    "rulesLoadError": "تعذّر تحميل القواعد.",
    "noMatchingRules": "لا توجد قواعد تطابق عامل التصفية.",
    "loggingSaved": "تم حفظ مستوى التسجيل.",
    "loggingSaveError": "تعذّر حفظ مستوى التسجيل."
  },
  "settingsUi": {
    "rulesView": "عرض القواعد",
    "ufwLog": "سجل UFW",
    "related": "ذات صلة",
    "title": "إعدادات جدار الحماية",
    "description": "مرشحات شخصية وسجل UFW للخادم النشط.",
    "sectionsLabel": "أقسام إعدادات جدار الحماية",
    "showActions": "إظهار الإجراءات",
    "all": "الكل",
    "limit": "تقييد",
    "serverSettingHint": "يغيّر هذا الإعداد تكوين الخادم النشط.",
    "logLevel": "مستوى التسجيل",
    "off": "معطّل",
    "low": "منخفض",
    "medium": "متوسط",
    "high": "مرتفع",
    "full": "كامل",
    "saveLevel": "حفظ المستوى",
    "relatedModules": "الوحدات ذات الصلة"
  }
} as const;

export default firewall;
