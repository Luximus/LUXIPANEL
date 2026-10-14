const servers = {
  "pageTitle": "الخوادم",
  "description": "سجل محلي لأهداف SSH التي يمكن لهذه اللوحة الاتصال بها. تُخزَّن الأسرار (المفاتيح وكلمات المرور) مشفّرة ولا تُعرض هنا مطلقًا.",
  "btnNew": "إضافة خادم",
  "table": {
    "name": "الاسم",
    "host": "المضيف",
    "username": "المستخدم",
    "authType": "المصادقة",
    "status": "الحالة"
  },
  "authTypes": {
    "key": "مفتاح SSH",
    "password": "كلمة المرور"
  },
  "status": {
    "approved": "مُعتمد",
    "pending": "قيد الانتظار",
    "untested": "لم يُختبر"
  },
  "common": {
    "test": "اختبار",
    "edit": "تعديل",
    "delete": "حذف",
    "cancel": "إلغاء",
    "save": "حفظ",
    "close": "إغلاق",
    "error": "خطأ",
    "yes": "نعم",
    "no": "لا"
  },
  "dialog": {
    "titleNew": "إضافة خادم",
    "titleEdit": "تعديل الخادم",
    "name": "الاسم",
    "namePlaceholder": "خادم الإنتاج الخاص بي",
    "host": "المضيف أو عنوان IP",
    "hostPlaceholder": "203.0.113.10 أو server.example.com",
    "port": "المنفذ",
    "username": "المستخدم",
    "usernamePlaceholder": "root",
    "authType": "نوع المصادقة",
    "secretKey": "مفتاح SSH الخاص",
    "secretKeyPlaceholder": "-----BEGIN OPENSSH PRIVATE KEY-----",
    "passphrase": "عبارة مرور المفتاح (اختياري)",
    "passphrasePlaceholder": "عبارة المرور لفتح المفتاح",
    "secretPassword": "كلمة المرور",
    "secretPasswordPlaceholder": "كلمة مرور مستخدم SSH",
    "secretKeepHint": "اتركه فارغًا للاحتفاظ بالسر الحالي.",
    "btnCancel": "إلغاء",
    "btnSave": "حفظ"
  },
  "fingerprint": {
    "title": "اعتماد بصمة المضيف",
    "intro": "هذا أول اتصال بهذا الخادم. تحقق من تطابق بصمة مفتاح المضيف مع البصمة المتوقعة قبل اعتمادها.",
    "approve": "اعتماد البصمة",
    "approving": "جارٍ الاعتماد…",
    "approved": "تم اعتماد البصمة",
    "approveError": "تعذّر اعتماد البصمة"
  },
  "toasts": {
    "created": "تمت إضافة الخادم",
    "updated": "تم تحديث الخادم",
    "deleted": "تم حذف الخادم",
    "testOk": "نجح الاتصال",
    "testFailed": "فشل الاتصال"
  },
  "validation": {
    "nameRequired": "أدخل اسمًا",
    "hostRequired": "أدخل المضيف",
    "usernameRequired": "أدخل المستخدم",
    "secretRequired": "أدخل سر المصادقة"
  },
  "confirmDelete": "هل تريد حذف الخادم {name}؟ لا يمكن التراجع عن هذا الإجراء.",
  "confirmDeleteTitle": "حذف الخادم",
  "testing": "جارٍ اختبار الاتصال…"
} as const;

export default servers;
