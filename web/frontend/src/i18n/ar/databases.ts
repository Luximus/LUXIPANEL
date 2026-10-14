const databases = {
  "pageTitle": "قواعد البيانات",
  "header": {
    "heading": "مدير قواعد البيانات",
    "subheading": "استعرض قواعد بيانات الخادم واستعلم منها (MySQL/MariaDB، PostgreSQL)."
  },
  "databases": {
    "title": "قواعد البيانات"
  },
  "tables": {
    "title": "الجداول"
  },
  "tabs": {
    "rows": "الصفوف",
    "structure": "البنية",
    "console": "وحدة تحكم SQL"
  },
  "rows": {
    "prev": "السابق",
    "next": "التالي"
  },
  "console": {
    "placeholder": "SELECT * FROM ...",
    "run": "تنفيذ",
    "allowWrite": "السماح بالكتابة",
    "hint": "Ctrl/⌘ + Enter للتنفيذ. تتطلب عبارات الكتابة/DDL تفعيل \"السماح بالكتابة\"."
  },
  "common": {
    "selectEngine": "اختر محرّكاً.",
    "selectDb": "اختر قاعدة بيانات.",
    "selectTable": "اختر جدولاً."
  },
  "actions": {
    "export": "تصدير",
    "addRecord": "إدراج سجل",
    "cancel": "إلغاء",
    "save": "حفظ",
    "edit": "تعديل",
    "downloadSql": "تنزيل SQL",
    "install": "تثبيت {label}"
  },
  "titles": {
    "record": "سجل",
    "exportDb": "تصدير قاعدة البيانات",
    "editRecord": "تعديل سجل · {table}",
    "newRecord": "سجل جديد · {table}"
  },
  "labels": {
    "tablesLabel": "الجداول",
    "allTables": "الكل",
    "includeData": "تضمين البيانات",
    "active": "نشط",
    "actions": "الإجراءات",
    "colName": "العمود",
    "colType": "النوع",
    "colNullable": "قابل للإفراغ",
    "colKey": "المفتاح",
    "colDefault": "الافتراضي",
    "yes": "نعم",
    "no": "لا",
    "primaryKey": "المفتاح الأساسي",
    "tbl": "جدول"
  },
  "install": {
    "title": "تثبيت محرك قاعدة البيانات",
    "description": "ثبّت MariaDB أو PostgreSQL على الخادم المتصل لبدء إدارة قواعد البيانات.",
    "mariadb": "MariaDB",
    "postgresql": "PostgreSQL"
  },
  "empty": {
    "noResults": "لا نتائج.",
    "noEngines": "لا يوجد محرك قاعدة بيانات نشط على الخادم. ثبّت أحدها للبدء.",
    "noDatabases": "لا توجد قواعد بيانات.",
    "noTables": "لا توجد جداول."
  },
  "errors": {
    "detectEngines": "خطأ في اكتشاف المحركات",
    "loadRows": "خطأ في تحميل الصفوف",
    "saveRecord": "تعذّر حفظ السجل",
    "deleteRecord": "تعذّر حذف السجل",
    "networkError": "خطأ في الشبكة",
    "runQuery": "خطأ في تنفيذ الاستعلام"
  },
  "loading": {
    "generic": "جارٍ التحميل…",
    "rows": "جارٍ تحميل الصفوف…",
    "structure": "جارٍ تحميل البنية…",
    "tablesExport": "جارٍ تحميل الجداول…",
    "running": "جارٍ التنفيذ…"
  },
  "toasts": {
    "engineInstalled": "تم تثبيت {label}",
    "noColumnsMetadata": "لا توجد بيانات وصفية للأعمدة في هذا الجدول",
    "recordUpdated": "تم تحديث السجل",
    "recordCreated": "تم إنشاء السجل",
    "recordDeleted": "تم حذف السجل",
    "noTableSelect": "حدد جدولاً واحداً على الأقل",
    "exportDownloaded": "تم تنزيل التصدير",
    "selectEngineFirst": "حدد محركاً أولاً",
    "statementExecuted": "تم تنفيذ العبارة"
  },
  "confirm": {
    "deleteRecord": "هل تريد حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.",
    "deleteTitle": "حذف السجل",
    "deleteConfirmText": "حذف"
  },
  "info": {
    "installing": "جارٍ تثبيت {label}… قد يستغرق بضع دقائق.",
    "installed": "تم تثبيت {label}. جارٍ اكتشاف المحرك…",
    "pager": "الصفوف {from}–{to} (صفحة من {limit})",
    "statementExecuted": "تم تنفيذ العبارة",
    "rowCount": "{count} صف(وف)",
    "truncated": "· النتيجة مقطوعة إلى {count} صفوف"
  },
  "runtime": {
    "createPromptWithPrefix": "يجب أن يبدأ الاسم بـ {prefix} وأن يلتزم بحصتك.",
    "createPrompt": "اسم قاعدة البيانات الجديدة على الخادم النشط.",
    "invalidPrefix": "يجب أن يبدأ الاسم بـ {prefix}",
    "createError": "تعذّر إنشاء قاعدة البيانات.",
    "created": "تم إنشاء قاعدة البيانات."
  },
  "settings": {
    "title": "إعدادات قواعد البيانات",
    "description": "تفضيلات وحدة قواعد البيانات.",
    "table": "الجدول",
    "pagination": "ترقيم الصفحات",
    "rowsPerPage": "عدد الصفوف في الصفحة ضمن نتائج البنية ووحدة التحكم.",
    "serverPagination": "يستخدم جدول السجلات ترقيم الصفحات من الخادم ولا يمكن ضبطه هنا.",
    "relatedModules": "الوحدات ذات الصلة",
    "hostingQuotas": "الاستضافة والحصص",
    "databaseBackups": "نسخ قواعد البيانات الاحتياطية",
    "sqlFiles": "ملفات SQL",
    "allowWriteDefault": "السماح بالكتابة افتراضيًا عند فتح وحدة التحكم",
    "allowWriteHelp": "يُطبّق عند تحميل الوحدة؛ ويمكنك تغييره في وحدة التحكم في أي وقت.",
    "createDatabase": "إنشاء قاعدة بيانات",
    "create": "إنشاء"
  }
} as const;

export default databases;
