const moduleCatalog = {
  "users": {
    "name": "المستخدمون",
    "description": "إدارة مستخدمي اللوحة والأدوار والصلاحيات."
  },
  "mail": {
    "name": "البريد",
    "description": "SMTP / IMAP والنطاقات وصناديق بريد المستخدمين."
  },
  "monitor": {
    "name": "المراقبة",
    "description": "مقاييس حية لاستخدام CPU وRAM والقرص والعمليات."
  },
  "files": {
    "name": "الملفات",
    "description": "مستكشف ملفات بعيد مع محرر مدمج."
  },
  "firewall": {
    "name": "جدار الحماية",
    "description": "إدارة قواعد UFW وحظر عناوين IP."
  },
  "bitninja": {
    "name": "BitNinja",
    "description": "وكيل أمني شامل: WAF وحماية anti-DoS وكشف البرمجيات الخبيثة وسمعة عناوين IP."
  },
  "assistant": {
    "name": "وكلاء الذكاء الاصطناعي",
    "description": "مساعد مدعوم بالذكاء الاصطناعي للتشخيص والأتمتة."
  },
  "repository-store": {
    "name": "GitHub",
    "description": "كتالوج المستودعات والتثبيت الموجَّه."
  },
  "dns": {
    "name": "Nginx",
    "description": "إدارة Nginx: المواقع والوكيل العكسي وSSL والسجلات والحالة."
  },
  "backups": {
    "name": "النسخ الاحتياطي",
    "description": "نسخ احتياطي مجدول مع تشفير ووجهات متعددة."
  },
  "cron": {
    "name": "Cron",
    "description": "مهام مجدولة مع محرر مرئي."
  },
  "databases": {
    "name": "قواعد البيانات",
    "description": "مدير قواعد البيانات (MySQL/MariaDB وPostgreSQL): استكشاف المخططات وكونسول SQL."
  },
  "obsidian": {
    "name": "Obsidian",
    "description": "خزائن ملاحظات Obsidian على خادمك: محرر markdown وروابط wikilinks وملاحظات يديرها وكلاء الذكاء الاصطناعي في المساعد."
  },
  "cloudflare": {
    "name": "Cloudflare",
    "description": "إدارة Cloudflare للخادم: DNS والتخزين المؤقت وSSL/TLS ووضع المطور وقواعد الوصول بعناوين IP."
  },
  "server-alerts": {
    "name": "الإشعارات",
    "description": "إشعارات الخادم لمالك اللوحة: تفضيلات التنبيهات والإشعارات الفورية والمجدولة/المتكررة والقواعد حسب المقاييس (CPU/RAM/القرص/الحِمل/تعطّل الخدمة)، تُرسَل إلى أجهزته عبر LP."
  },
  "expo": {
    "name": "Expo",
    "description": "إدارة تطبيقات Expo/React Native: بناءات EAS والنشر إلى المتاجر وتحديثات OTA ورمز QR لعميل التطوير والحصص، باستخدام access token الخاص بالعميل."
  },
  "webhooks": {
    "name": "Webhooks",
    "description": "إشعارات HTTP لأحداث اللوحة."
  },
  "openclaw": {
    "name": "OpenClaw",
    "description": "الاتصال بـ OpenClaw AI مع محدِّد النموذج."
  },
  "hosting": {
    "name": "الاستضافة",
    "description": "المواقع والمضيفات الافتراضية وعمليات النشر الموجَّهة."
  },
  "terminal": {
    "name": "الطرفية",
    "description": "طرفية عائمة يمكن الوصول إليها من أي عرض في اللوحة. فعِّل الزر العائم أو عطِّله."
  },
  "module-dev": {
    "name": "وحداتي",
    "description": "دورة حياة وحداتك في السوق: حالة المراجعة والإرساليات والاختبارات والمعاينة الخاصة."
  },
  "filesystem-mcp": {
    "name": "Filesystem MCP",
    "description": "MCP لعمليات نظام الملفات."
  },
  "github-mcp": {
    "name": "GitHub MCP",
    "description": "MCP للعمليات على API الخاص بـ GitHub."
  },
  "google-drive": {
    "name": "Google Drive",
    "description": "ابحث عن مستندات Google Drive وأرفقها من محادثة المساعد."
  },
  "onedrive": {
    "name": "OneDrive",
    "description": "الوصول إلى ملفات Microsoft OneDrive / SharePoint من المحادثة."
  },
  "dropbox": {
    "name": "Dropbox",
    "description": "ابحث عن ملفات Dropbox وأرفقها من المحادثة."
  },
  "notion": {
    "name": "Notion",
    "description": "استعرض صفحات وقواعد بيانات Notion من المحادثة."
  }
} as const;

export default moduleCatalog;
