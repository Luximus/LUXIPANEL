const modules = {
  "pageTitle": "الوحدات",
  "header": {
    "heading": "الوحدات والتكاملات",
    "subheading": "فعّل أو أخفِ الوحدات المثبّتة مسبقاً التي تظهر في القائمة الجانبية"
  },
  "search": {
    "placeholder": "بحث عن وحدة..."
  },
  "tabs": {
    "all": "الكل",
    "modules": "الوحدات",
    "integrations": "التكاملات",
    "visible": "المرئية"
  },
  "stats": {
    "visible": "المرئية:",
    "hidden": "المخفية:",
    "systemNote": "وحدات النظام تبقى مثبّتة مسبقاً"
  },
  "categories": {
    "label": "الفئات",
    "all": "الكل",
    "communication": "التواصل",
    "infrastructure": "البنية التحتية",
    "security": "الأمان",
    "developer": "المطوّر"
  },
  "statusFilter": {
    "label": "الحالة",
    "all": "الكل",
    "visible": "المرئية",
    "hidden": "المخفية"
  },
  "empty": {
    "title": "لم يُعثر على وحدات",
    "subtitle": "جرّب مصطلح بحث أو فئة أخرى"
  },
  "errors": {
    "loadTitle": "خطأ في تحميل الوحدات",
    "loadSubtitle": "تعذّر الحصول على قائمة الوحدات"
  },
  "labels": {
    "metaVersion": "الإصدار",
    "metaInstalls": "التثبيتات",
    "metaRating": "التقييم",
    "metaAuthor": "المؤلف",
    "metaCreatedAt": "تاريخ الإنشاء",
    "metaUpdatedAt": "آخر تحديث",
    "kindIntegration": "تكامل",
    "kindModule": "وحدة",
    "tagFree": "مجاني",
    "tagLicense": "يتطلب ترخيصاً",
    "statusVisible": "ظاهر في القائمة",
    "statusHidden": "مخفي",
    "dragHandle": "اسحب لإعادة الترتيب",
    "menuToggle": "إظهار في القائمة الجانبية",
    "moduleToggle": "تفعيل الوحدة",
    "fabToggle": "إظهار الزر العائم"
  },
  "toasts": {
    "moduleVisible": "{name} ظاهر",
    "moduleHidden": "{name} مخفي",
    "moduleVisibleWithDeps": "{name} ظاهر (تم تفعيل أيضاً: {deps})",
    "moduleHiddenWithDeps": "{name} مخفي (تم تفعيل أيضاً: {deps})",
    "moduleUpdateError": "تعذّر تحديث {name}",
    "sidebarShown": "{name} يظهر في القائمة",
    "sidebarHidden": "{name} مخفي من القائمة",
    "fabShown": "{name}: تم تفعيل الزر العائم",
    "fabHidden": "{name}: تم تعطيل الزر العائم",
    "orderSaved": "تم حفظ الترتيب",
    "orderError": "تعذّر حفظ الترتيب",
    "orderHttpError": "تعذّر حفظ الترتيب ({status})"
  }
} as const;

export default modules;
