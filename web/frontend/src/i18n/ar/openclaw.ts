const openclaw = {
  "pageTitle": "OpenClaw",
  "header": {
    "subtitle": "اربط اللوحة بـ",
    "subtitleSuffix": "لاستخدام نماذجه وأدواته."
  },
  "statusCard": {
    "title": "حالة الاتصال",
    "descKeySet": "تم تعيين مفتاح API. اضغط \"اختبار الاتصال\" للتحقق.",
    "descNoKey": "لم يتم تعيين مفتاح API بعد.",
    "btnTest": "اختبار الاتصال"
  },
  "form": {
    "sectionTitle": "بيانات الاعتماد ونقطة النهاية",
    "sectionDesc": "يُحفظ مفتاح API مشفَّرًا في قاعدة بيانات اللوحة.",
    "labelEndpoint": "Endpoint",
    "placeholderEndpoint": "https://openclaw.ai",
    "hintEndpoint": "URL الأساسي لـ API. الافتراضي",
    "labelApiKey": "مفتاح API",
    "placeholderApiKeySet": "مُعيَّن · {preview}",
    "placeholderApiKeyUnset": "sk-...",
    "ariaToggleKey": "إظهار أو إخفاء",
    "btnClearKey": "مسح",
    "hintApiKey": "اتركه فارغًا للإبقاء على مفتاح API الحالي.",
    "labelDefaultModel": "النموذج الافتراضي",
    "placeholderDefaultModel": "claw-default",
    "hintDefaultModel": "معرّف النموذج الذي ستستخدمه الاستدعاءات الداخلية التي لا تحدد واحدًا.",
    "btnSave": "حفظ التغييرات"
  },
  "help": {
    "title": "كيف أحصل على مفتاح API الخاص بي؟",
    "step1": "سجّل الدخول إلى",
    "step2": "افتح إعدادات حسابك وأنشئ مفتاح API جديدًا.",
    "step3": "الصقه أعلاه واحفظ — لن تعرضه اللوحة بنص واضح مرة أخرى."
  }
} as const;

export default openclaw;
