const cloudflare = {
  "options": {
    "essentiallyOff": "متوقف فعليًا",
    "low": "منخفض",
    "medium": "متوسط",
    "high": "مرتفع"
  },
  "pageTitle": "Cloudflare",
  "header": {
    "heading": "Cloudflare",
    "subheading": "أدر DNS والتخزين المؤقت وSSL/TLS والأمان لمناطق Cloudflare الخاصة بهذا الخادم."
  },
  "config": {
    "title": "الاتصال بـ Cloudflare",
    "tokenLabel": "رمز API",
    "tokenPlaceholder": "API Token الخاص بـ Cloudflare",
    "tokenHint": "أنشئ رمزًا في dash.cloudflare.com → My Profile → API Tokens مع أذونات المنطقة: DNS وCache Purge وZone Settings وFirewall Services.",
    "save": "حفظ",
    "test": "اختبار الاتصال",
    "clear": "إزالة الرمز",
    "tokenSet": "تم تكوين الرمز",
    "tokenMissing": "كوّن API Token للبدء",
    "saved": "تم حفظ الرمز",
    "cleared": "تمت إزالة الرمز",
    "confirmClear": "هل تريد إزالة رمز Cloudflare؟",
    "confirmClearBtn": "إزالة"
  },
  "zones": {
    "title": "المنطقة",
    "select": "اختر منطقة",
    "empty": "لا توجد مناطق مرئية بهذا الرمز.",
    "status": "الحالة",
    "plan": "الخطة",
    "nameServers": "خوادم الأسماء",
    "domainNotFound": "النطاق {domain} لا ينتمي إلى أي منطقة في هذا الرمز"
  },
  "runtime": {
    "active": "نشطة",
    "pending": "معلّقة",
    "initializing": "جارٍ التهيئة",
    "moved": "منقولة",
    "paused": "متوقفة مؤقتًا",
    "pausedHint": "المنطقة متوقفة مؤقتًا: راجع الإعدادات قبل تغيير DNS.",
    "inactiveHint": "المنطقة {status}: تحقق من خوادم الأسماء لدى مسجّل النطاق.",
    "activeHint": "منطقة نشطة · عدد خوادم الأسماء المضبوطة: {count}."
  },
  "tabs": {
    "dns": "DNS",
    "cache": "التخزين المؤقت",
    "security": "SSL / الأمان",
    "access": "قواعد الوصول",
    "config": "الإعدادات"
  },
  "dns": {
    "title": "سجلات DNS",
    "add": "إضافة سجل",
    "type": "النوع",
    "name": "الاسم",
    "content": "المحتوى",
    "ttl": "TTL",
    "proxied": "البروكسي",
    "pointsToServer": "يشير إلى هذا الخادم",
    "edit": "تعديل",
    "delete": "حذف",
    "confirmDelete": "هل تريد حذف السجل {name}؟",
    "saved": "تم حفظ السجل",
    "deleted": "تم حذف السجل",
    "useServerIp": "استخدام عنوان IP الخاص بالخادم",
    "priority": "الأولوية",
    "confirmDeleteTitle": "حذف السجل",
    "typeA": "A",
    "typeAAAA": "AAAA",
    "typeCNAME": "CNAME",
    "typeTXT": "TXT",
    "typeMX": "MX",
    "typeNS": "NS",
    "ttlAuto": "تلقائي",
    "ttl60": "60",
    "ttl300": "300",
    "ttl1800": "1800",
    "ttl3600": "3600",
    "ttl86400": "86400"
  },
  "cache": {
    "title": "التخزين المؤقت",
    "purgeAll": "مسح الكل",
    "purgeAllHint": "يزيل كل المحتوى المخزن مؤقتًا للمنطقة في Cloudflare.",
    "confirmPurgeAll": "هل تريد مسح كل التخزين المؤقت لهذه المنطقة؟",
    "purgeUrls": "مسح عناوين URL",
    "purgeUrlsPlaceholder": "https://ejemplo.com/estilos.css (عنوان URL واحد في كل سطر)",
    "purged": "تم مسح التخزين المؤقت",
    "devMode": "وضع التطوير",
    "devModeHint": "يعطّل التخزين المؤقت لـ Cloudflare مؤقتًا (يتوقف تلقائيًا بعد 3 ساعات).",
    "confirmPurgeTitle": "تفريغ الذاكرة المؤقتة",
    "confirmPurgeBtn": "تفريغ"
  },
  "security": {
    "title": "SSL / الأمان",
    "sslMode": "وضع SSL/TLS",
    "alwaysHttps": "استخدام HTTPS دائمًا",
    "securityLevel": "مستوى الأمان",
    "underAttack": "وضع التعرض للهجوم",
    "updated": "تم تحديث الإعداد",
    "sslOff": "إيقاف",
    "sslFlexible": "مرن",
    "sslFull": "كامل",
    "sslFullStrict": "كامل (صارم)"
  },
  "access": {
    "title": "قواعد الوصول عبر IP",
    "add": "إضافة قاعدة",
    "mode": "الإجراء",
    "block": "حظر",
    "allow": "سماح",
    "challenge": "تحدي",
    "ip": "IP / نطاق",
    "notes": "ملاحظات",
    "empty": "لا توجد قواعد وصول في هذه المنطقة.",
    "confirmDelete": "هل تريد حذف القاعدة الخاصة بـ {ip}؟",
    "created": "تم إنشاء القاعدة",
    "deleted": "تم حذف القاعدة",
    "ipHeader": "IP",
    "confirmDeleteTitle": "حذف القاعدة"
  },
  "common": {
    "loading": "جارٍ التحميل...",
    "error": "خطأ",
    "save": "حفظ",
    "cancel": "إلغاء",
    "delete": "حذف",
    "refresh": "تحديث",
    "serverIp": "عنوان IP الخاص بالخادم",
    "noToken": "كوّن API Token الخاص بـ Cloudflare في تبويب الإعدادات."
  },
  "settingsUi": {
    "title": "إعدادات Cloudflare",
    "description": "تفضيلات جداول وحدة Cloudflare.",
    "access": "الوصول",
    "credentialsConnections": "بيانات الاعتماد والاتصالات",
    "cloudflareToken": "رمز Cloudflare",
    "serverFirewall": "جدار حماية الخادم",
    "dnsWebhooks": "أحداث DNS في Webhooks"
  }
} as const;

export default cloudflare;
