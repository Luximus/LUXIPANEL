const webhooks = {
  "pageTitle": "Webhooks و API Keys",
  "tabs": {
    "webhooks": "Webhooks",
    "apiKeys": "مفاتيح API",
    "discovered": "المكتشفة"
  },
  "webhooksPanel": {
    "description": "إشعارات HTTP صادرة بتوقيع HMAC",
    "btnNew": "webhook جديد"
  },
  "apiKeysPanel": {
    "description": "وصول برمجي بتوكنات دائمة",
    "btnNew": "API key جديدة"
  },
  "newKeyReveal": {
    "message": "تم إنشاء API Key — انسخها الآن، لن تظهر مجدداً",
    "btnCopy": "نسخ"
  },
  "webhookDialog": {
    "placeholderUrl": "https://example.com/webhook",
    "title": "webhook جديد",
    "labelUrl": "URL نقطة الاتصال",
    "labelEvents": "الأحداث المراد الاستماع إليها",
    "labelEnabled": "Webhook نشط",
    "btnCancel": "إلغاء",
    "btnSave": "حفظ"
  },
  "apiKeyDialog": {
    "placeholderName": "تكاملي",
    "title": "API Key جديدة",
    "labelName": "اسم وصفي",
    "labelExpires": "تاريخ الانتهاء (اختياري)",
    "btnCancel": "إلغاء",
    "btnCreate": "إنشاء مفتاح"
  },
  "discovered": {
    "description": "Webhooks المكتشفة على الخادم (Git وnginx وcron وsystemd وملفات الإعداد والمشاريع)",
    "btnRescan": "إعادة الفحص",
    "scanning": "جارٍ فحص الخادم…",
    "empty": "لم يتم اكتشاف أي webhooks على الخادم",
    "cols": {
      "source": "المصدر",
      "name": "الاسم",
      "target": "الوجهة",
      "location": "الموقع",
      "estado": "الحالة"
    },
    "filters": {
      "searchTarget": "البحث عن وجهة…",
      "source": "المصدر"
    },
    "sources": {
      "sidecar": "اللوحة",
      "git-hook": "خطاف Git",
      "nginx": "Nginx",
      "cron": "Cron",
      "systemd": "systemd",
      "config": "إعداد",
      "project": "المشروع"
    },
    "status": {
      "enabled": "نشط",
      "disabled": "غير نشط",
      "unknown": "—"
    },
    "actions": {
      "detail": "عرض التفاصيل",
      "delete": "حذف"
    },
    "detail": {
      "title": "تفاصيل الـ webhook المكتشف",
      "source": "المصدر",
      "target": "الوجهة",
      "location": "الموقع",
      "info": "معلومات",
      "raw": "الإعداد",
      "managedNote": "تتم إدارة هذا الـ webhook بواسطة اللوحة",
      "readonlyNote": "للقراءة فقط: أدِره من الوحدة المقابلة له",
      "btnClose": "إغلاق"
    },
    "confirm": {
      "deleteTitle": "حذف الـ webhook المكتشف",
      "deleteBody": "حذف \"{name}\"؟ سيؤدي ذلك إلى تعديل الملف على الخادم.",
      "deleteBtn": "نعم، احذف"
    },
    "toasts": {
      "deleted": "تم الحذف",
      "errorDeleting": "تعذّر الحذف",
      "scanComplete": "اكتمل الفحص: {count}",
      "notManageable": "أدِره من الوحدة المقابلة له"
    }
  },
  "labels": {
    "statusFailing": "فاشل",
    "statusActive": "نشط",
    "statusPaused": "موقوف مؤقتاً",
    "newWebhookTitle": "webhook جديد",
    "noExpiry": "بلا انتهاء"
  },
  "confirm": {
    "rotateSecretBody": "تدوير secret هذا الـ webhook؟ ستحتاج إلى تحديث المستقبل.",
    "rotateSecretTitle": "تدوير الـ secret",
    "rotateSecretBtn": "نعم، دوِّر",
    "deleteWebhookBody": "حذف هذا الـ webhook؟",
    "deleteWebhookTitle": "حذف الـ webhook",
    "revokeKeyBody": "إلغاء API key «{name}»؟",
    "revokeKeyTitle": "إلغاء API key",
    "revokeKeyBtn": "نعم، ألغِ"
  },
  "toasts": {
    "secretRotated": "تم تدوير الـ secret",
    "errorRotating": "خطأ في التدوير",
    "webhookDeleted": "تم حذف الـ webhook",
    "errorDeleting": "خطأ في الحذف",
    "webhookUpdated": "تم تحديث الـ webhook",
    "webhookCreated": "تم إنشاء الـ webhook",
    "errorSaving": "خطأ في الحفظ",
    "keyRevoked": "تم إلغاء الـ key",
    "errorRevoking": "خطأ في الإلغاء",
    "copiedToClipboard": "تم النسخ إلى الحافظة",
    "errorCreatingKey": "خطأ في إنشاء الـ key"
  },
  "categories": {
    "receiveData": "استقبال البيانات",
    "mailhook": "Mailhook",
    "response": "استجابة webhook",
    "soon": "قريباً",
    "soonDesc": "سيتم تحديد إعدادات هذه الفئة وفحصها في مرحلة لاحقة."
  },
  "gateway": {
    "description": "نقاط نهاية يستضيفها اللوحة لاستقبال البيانات الواردة (على غرار Make.com). المصادقة عبر API key (x-make-apikey)، وتقييد بالـ IP، والتحقق من بنية البيانات.",
    "btnNew": "Webhook جديد",
    "detectedTitle": "المستقبِلات المكتشفة على الخادم",
    "urlReveal": "رابط webhook — أرسل الطلبات إلى هنا",
    "cols": {
      "name": "الاسم",
      "auth": "المصادقة",
      "recibidos": "المستلَم",
      "ultima": "الأخير",
      "estado": "الحالة",
      "estadoActive": "نشط",
      "estadoPaused": "موقوف"
    },
    "dialog": {
      "titleNew": "إنشاء webhook",
      "titleEdit": "تعديل webhook",
      "name": "اسم webhook",
      "namePlaceholder": "Webhook البوابة الخاص بي",
      "nameHint": "يجب أن يكون بين 1 و128 حرفاً.",
      "apiAuth": "المصادقة عبر API key",
      "apiAuthHint": "أرسل الـ API key في الترويسة x-make-apikey. أضف مفتاحاً أو أكثر؛ يُمنح الوصول عند تطابق أي منها.",
      "apiKeyName": "الاسم",
      "apiKeyValue": "قيمة API key",
      "apiKeyKeep": "(محفوظة — اتركها فارغة للإبقاء عليها)",
      "addApiKey": "إضافة API key",
      "ipTitle": "قيود IP",
      "ipHint": "قائمة عناوين IP مفصولة بفاصلة. يمكن استخدام صيغة CIDR. فارغ = بلا تحقق.",
      "dataStructure": "بنية البيانات",
      "dataStructureHint": "التحقق من البيانات الواردة. فارغ = قبول البيانات بدون تحقق.",
      "dsValidate": "التحقق من بنية البيانات",
      "dsStrict": "صارم (رفض الحقول غير المحددة)",
      "dsFieldName": "الاسم",
      "dsFieldDesc": "الوصف",
      "dsFieldType": "النوع",
      "dsFieldDefault": "القيمة الافتراضية",
      "dsFieldRequired": "مطلوب",
      "dsFieldMultiline": "متعدد الأسطر",
      "addItem": "إضافة حقل",
      "getHeaders": "الحصول على ترويسات الطلب",
      "getHeadersHint": "ستُضاف الترويسات إلى جسم الطلب.",
      "getMethod": "الحصول على طريقة HTTP",
      "getMethodHint": "ستُضاف الطريقة (الفعل) إلى جسم الطلب.",
      "jsonPassthrough": "حفظ JSON كنص",
      "jsonPassthroughHint": "عند التفعيل، يُحفظ الحمولة JSON كسلسلة نصية.",
      "enabled": "Webhook نشط",
      "advanced": "إعدادات متقدمة",
      "btnCancel": "إلغاء",
      "btnSave": "حفظ"
    },
    "payloads": {
      "title": "الحمولات المستلمة",
      "empty": "لم يتم استلام أي حمولة بعد.",
      "btnClose": "إغلاق"
    },
    "confirm": {
      "deleteTitle": "حذف webhook",
      "deleteBody": "هل تريد حذف webhook \"{name}\"؟ ستُفقد الحمولات المخزنة.",
      "deleteBtn": "نعم، احذف"
    },
    "toasts": {
      "created": "تم إنشاء webhook",
      "updated": "تم تحديث webhook",
      "deleted": "تم حذف webhook",
      "copied": "تم نسخ URL",
      "error": "خطأ في الحفظ"
    }
  },
  "table": {
    "gateway": {
      "columns": {
        "name": "الاسم",
        "auth": "المصادقة",
        "recibidos": "المستلمة",
        "ultima": "الأخيرة",
        "estado": "الحالة"
      },
      "filters": {
        "searchName": "ابحث عن اسم…",
        "estado": "الحالة"
      },
      "rowActions": {
        "copy": "نسخ URL",
        "payloads": "عرض الحمولات",
        "edit": "تعديل",
        "delete": "حذف"
      },
      "options": {
        "statusActive": "نشط",
        "statusPaused": "موقوف مؤقتاً"
      }
    },
    "webhooks": {
      "columns": {
        "url": "URL",
        "eventos": "الأحداث",
        "estado": "الحالة"
      },
      "filters": {
        "searchUrl": "البحث عن رابط…",
        "estado": "الحالة"
      },
      "rowActions": {
        "regenerate": "تدوير الـ secret",
        "delete": "حذف"
      },
      "options": {
        "statusActive": "نشط",
        "statusPaused": "موقوف مؤقتاً",
        "statusFailing": "فاشل"
      }
    },
    "apiKeys": {
      "columns": {
        "name": "الاسم",
        "prefix": "البادئة",
        "creada": "تم الإنشاء",
        "expira": "ينتهي"
      },
      "filters": {
        "searchName": "ابحث عن اسم…"
      },
      "rowActions": {
        "revoke": "إلغاء"
      }
    },
    "discovered": {
      "columns": {
        "origen": "المصدر",
        "name": "الاسم",
        "target": "الوجهة",
        "location": "الموقع",
        "estado": "الحالة"
      },
      "filters": {
        "searchTarget": "البحث عن وجهة…",
        "origen": "المصدر"
      },
      "rowActions": {
        "detail": "عرض التفاصيل",
        "delete": "حذف"
      },
      "options": {
        "panel": "اللوحة",
        "gitHook": "خطاف Git",
        "nginx": "Nginx",
        "cron": "Cron",
        "systemd": "systemd",
        "config": "إعداد",
        "proyecto": "المشروع"
      }
    }
  },
  "runtime": {
    "testDelivered": "تم تسليم الاختبار بنجاح.",
    "testFailed": "فشل تسليم الاختبار.",
    "loadingDeliveries": "جارٍ تحميل عمليات التسليم…",
    "loadDeliveriesError": "تعذّر تحميل عمليات التسليم.",
    "noDeliveries": "لم تُسجَّل أي عمليات تسليم بعد.",
    "delivered": "تم التسليم",
    "failed": "فشل",
    "attempts": "المحاولات: {count}",
    "selectEvent": "اختر حدثًا واحدًا على الأقل."
  },
  "settingsUi": {
    "title": "إعدادات Webhooks",
    "description": "ترقيم الصفحات والإجراءات الظاهرة لجداول Webhooks.",
    "gateway": "البوابة",
    "webhooks": "Webhooks",
    "signingSecret": "سر التوقيع · انسخه الآن",
    "signingSecretHint": "يُعرض مرة واحدة فقط. اضبطه في المستقبِل للتحقق من X-Luxipanel-Signature.",
    "recentDeliveries": "عمليات التسليم الأخيرة"
  }
} as const;

export default webhooks;
