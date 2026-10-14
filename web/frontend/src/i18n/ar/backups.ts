const backups = {
  "pageTitle": "النسخ الاحتياطية",
  "settings": {
    "title": "إعدادات النسخ الاحتياطي",
    "description": "الوجهة والتفضيلات للخادم المتصل.",
    "sections": "أقسام الإعدادات",
    "localHelp": "تُخزّن النسخ الاحتياطية المحلية لهذا الخادم هنا.",
    "changeDirWarning": "سيؤدي تغيير المجلد إلى حذف النسخ الاحتياطية المحلية السابقة بعد تأكيدك.",
    "retentionHelp": "للنسخ اليدوية والجداول الجديدة. تحتفظ الجداول الحالية بحدها الخاص.",
    "save": "حفظ التغييرات",
    "lastSuccess": "آخر نسخة احتياطية ناجحة",
    "localCopies": "نسخ احتياطية محلية",
    "activeSchedules": "جداول نشطة",
    "advancedCron": "تعبير Cron مخصص",
    "loading": "جارٍ تحميل الإعدادات…",
    "loadError": "تعذّر تحميل إعدادات هذا الخادم.",
    "pending": "تغييرات غير محفوظة.",
    "countError": "اختر عدداً بين 1 و365 نسخة احتياطية.",
    "saving": "جارٍ الحفظ…",
    "saved": "تم حفظ الإعدادات.",
    "previewError": "تعذّر فحص المجلد.",
    "destinationNotEmpty": "يحتوي المجلد الجديد بالفعل على نسخ LUXIPANEL احتياطية.",
    "changeConfirm": "ستُحذف {count} نسخة احتياطية محلية في {path}. ستبقى نسخ S3/R2. هل تريد تغيير المجلد؟",
    "changeTitle": "تغيير مجلد النسخ الاحتياطية",
    "changeError": "تعذّر تغيير المجلد.",
    "tables": "الجداول",
    "localHeading": "الوجهة المحلية",
    "overview": "حالة النسخ الاحتياطي",
    "targetChanged": "تغيّر الخادم؛ راجع إعداداته مرة أخرى."
  },
  "status": {
    "completed": "مكتمل",
    "failed": "فشل",
    "running": "قيد التنفيذ"
  },
  "header": {
    "heading": "النسخ الاحتياطية",
    "subheading": "احمِ ملفات الخادم وقواعد البيانات والبريد والإعدادات.",
    "btnBackupNow": "نسخ احتياطي الآن"
  },
  "configCard": {
    "title": "إعداد النسخ الاحتياطية",
    "subtitle": "الدليل المحلي والتخزين البعيد.",
    "labelLocalDir": "دليل النسخ الاحتياطي المحلي",
    "placeholderLocalDir": "/var/backups/luxipanel",
    "labelRetentionDefault": "عدد النسخ المحلية الافتراضي",
    "s3Section": "S3 / Cloudflare R2",
    "labelEndpoint": "نقطة الوصول",
    "labelBucket": "الحاوية (Bucket)",
    "labelAccessKeyId": "معرّف مفتاح الوصول",
    "labelSecretAccessKey": "مفتاح الوصول السري",
    "btnBrowse": "تصفّح",
    "tabLocal": "محلي",
    "tabCloud": "سحابي"
  },
  "pathBrowserDialog": {
    "title": "اختيار مجلد",
    "btnUp": "للأعلى",
    "btnCancel": "إلغاء",
    "btnSelect": "استخدام هذا المجلد"
  },
  "backupSources": {
    "title": "ما يجب نسخه احتياطياً",
    "scopeFull": "الخادم كاملاً (منقّح)",
    "scopeFullHint": "قواعد البيانات، البريد، إعدادات اللوحة و /etc /home /var/www /root",
    "scopeCustom": "مخصص",
    "labelDatabases": "قواعد البيانات",
    "dbAll": "الكل",
    "dbPick": "اختيار…",
    "dbChoose": "اختيار قواعد البيانات",
    "dbNone": "لم يُحدَّد شيء",
    "labelMail": "البريد (vmail + Postfix/Dovecot)",
    "labelPanelConfig": "إعدادات اللوحة",
    "foldersTitle": "المجلدات",
    "addFolder": "إضافة مجلد",
    "noFolders": "لا توجد مجلدات محددة"
  },
  "dbPickerDialog": {
    "title": "تحديد قواعد البيانات",
    "loading": "جارٍ التحميل…",
    "btnCancel": "إلغاء",
    "btnSelect": "استخدام التحديد",
    "btnRetry": "إعادة المحاولة",
    "unavailableSelection": "لم تعد إحدى قواعد البيانات المحددة متاحة. راجع التحديد."
  },
  "storagesSection": {
    "subtitle": "وجهات التخزين السحابي للنسخ الاحتياطية (S3 / Cloudflare R2).",
    "tableTitle": "التخزين",
    "btnNew": "تخزين جديد"
  },
  "storageDialog": {
    "titleNew": "تخزين سحابي جديد",
    "titleEdit": "تعديل التخزين السحابي",
    "labelName": "الاسم",
    "placeholderName": "حاوية R2 الخاصة بي",
    "labelProvider": "المزوّد",
    "optS3": "Amazon S3",
    "optR2": "Cloudflare R2",
    "labelBucket": "الحاوية (Bucket)",
    "labelPrefix": "البادئة (المجلد)",
    "placeholderPrefix": "backups/",
    "labelEndpoint": "نقطة الاتصال (Endpoint)",
    "labelRegion": "المنطقة",
    "labelAccessKey": "معرّف مفتاح الوصول (Access Key ID)",
    "labelSecret": "مفتاح الوصول السري (Secret Access Key)",
    "secretKeepHint": "اتركه فارغاً للاحتفاظ بالمفتاح السري الحالي.",
    "btnCancel": "إلغاء",
    "btnSave": "حفظ",
    "usingCentralCred": "يستخدم البيانات المركزية من الإعدادات ← البيانات (تحدّد البكت فقط).",
    "credRequired": "لا توجد بيانات اعتماد {provider} مُعدَّة. سجّلها في الإعدادات ← البيانات لاستخدام هذا الوجهة.",
    "credRequiredCta": "الذهاب إلى الإعدادات ← البيانات"
  },
  "progress": {
    "creating": "جارٍ إنشاء النسخة الاحتياطية… قد يستغرق ذلك عدة دقائق."
  },
  "historySection": {
    "title": "سجل النسخ الاحتياطية",
    "tableTitle": "النسخ الاحتياطية",
    "count": "{count} نسخة",
    "countPartial": "عرض {shown} من أصل {total} نسخة"
  },
  "schedulesSection": {
    "title": "الجداول الزمنية",
    "btnNew": "جديد",
    "loading": "جارٍ التحميل...",
    "active": "نشطة",
    "paused": "متوقفة",
    "copies": "نسخ",
    "pause": "إيقاف",
    "enable": "تفعيل",
    "edit": "تعديل",
    "delete": "حذف"
  },
  "backupDialog": {
    "title": "إنشاء نسخة احتياطية يدوية",
    "labelName": "التسمية",
    "placeholderName": "pre-upgrade",
    "labelStorage": "التخزين",
    "optionLocal": "محلي",
    "optionS3": "AWS S3",
    "optionR2": "Cloudflare R2",
    "labelIncludeDb": "تضمين تفريغ PostgreSQL",
    "sourcesTitle": "ما الذي سيُنسَخ احتياطيًا",
    "labelIncludeDatabases": "قواعد البيانات (MySQL/MariaDB + PostgreSQL)",
    "labelIncludeMail": "حسابات البريد (صناديق البريد + الإعدادات)",
    "labelIncludePanelConfig": "إعدادات LuxiPanel",
    "btnCancel": "إلغاء",
    "btnStart": "بدء النسخ الاحتياطي"
  },
  "scheduleDialog": {
    "title": "جدولة نسخة احتياطية",
    "labelName": "الاسم",
    "placeholderName": "نسخ احتياطي أسبوعي",
    "labelSchedule": "الجدول الزمني (cron)",
    "placeholderSchedule": "0 3 * * 0",
    "labelStorage": "التخزين",
    "optionLocal": "محلي",
    "optionS3": "S3",
    "optionR2": "R2",
    "labelRetention": "عدد النسخ المحلية للاحتفاظ بها",
    "labelFrequency": "التكرار",
    "optHourly": "كل ساعة",
    "optDaily": "يومي",
    "optWeekly": "أسبوعي",
    "optMonthly": "شهري",
    "labelTime": "الوقت",
    "labelWeekday": "يوم الأسبوع",
    "labelMonthday": "يوم الشهر",
    "cronPreview": "يعادل",
    "cronExample": "0 3 * * *",
    "weekdays": [
      "الأحد",
      "الاثنين",
      "الثلاثاء",
      "الأربعاء",
      "الخميس",
      "الجمعة",
      "السبت"
    ],
    "btnCancel": "إلغاء",
    "btnSave": "حفظ",
    "localRetentionHint": "سيتم الاحتفاظ بأحدث النسخ الاحتياطية المحلية لهذا الجدول.",
    "cloudRetentionHint": "اضبط مدة الاحتفاظ بنسخ S3/R2 لدى مزود الخدمة السحابية.",
    "editTitle": "تعديل الجدول"
  },
  "toasts": {
    "errorSaveSettings": "خطأ في حفظ إعدادات النسخ الاحتياطي",
    "preparingDownload": "جارٍ تحضير التنزيل…",
    "backupDeleted": "تم حذف النسخة الاحتياطية",
    "backupsDeleted": "تم حذف النسخ الاحتياطية",
    "scheduleDeleted": "تم حذف الجدولة",
    "errorDelete": "خطأ في الحذف",
    "errorCreateBackup": "خطأ في إنشاء النسخة الاحتياطية",
    "backupStarted": "بدأ النسخ الاحتياطي",
    "backupCompleted": "اكتمل النسخ الاحتياطي",
    "backupStillRunning": "النسخ الاحتياطي لا يزال جارياً…",
    "scheduleCreated": "تم إنشاء الجدولة",
    "errorCreateSchedule": "خطأ في إنشاء الجدولة",
    "storageDeleted": "تم حذف التخزين",
    "storageUpdated": "تم تحديث التخزين",
    "storageCreated": "تم إنشاء التخزين",
    "errorSaveStorage": "خطأ في حفظ التخزين",
    "recordRemoved": "أُزيل السجل من المحفوظات"
  },
  "errors": {
    "listPathFailed": "تعذّر سرد هذا المسار (هل الأذونات صحيحة؟).",
    "listDbFailed": "تعذّر سرد قواعد البيانات.",
    "downloadFailed": "تعذّر تنزيل النسخة الاحتياطية",
    "backupErrorDetail": "خطأ: {error}"
  },
  "empty": {
    "noSubfolders": "(لا توجد مجلدات فرعية)",
    "noDbEngines": "لم يُكتشف أي محرك قاعدة بيانات نشط.",
    "noDatabases": "(لا توجد قواعد بيانات)",
    "noneSelected": "لم يُحدَّد شيء",
    "noSchedules": "لا توجد جدولات"
  },
  "labels": {
    "loading": "جارٍ التحميل…",
    "fullServer": "الخادم بالكامل",
    "editStorage": "تعديل التخزين",
    "newStorage": "تخزين جديد"
  },
  "confirm": {
    "deleteBackup": "حذف النسخة الاحتياطية «{label}»؟",
    "deleteBackupTitle": "حذف النسخة الاحتياطية",
    "deleteBulkBackup": "حذف {count} نسخة احتياطية محددة؟",
    "deleteBulkBackupTitle": "حذف النسخ الاحتياطية",
    "deleteSchedule": "حذف هذه الجدولة؟",
    "deleteScheduleTitle": "حذف الجدولة",
    "deleteStorage": "حذف التخزين «{name}»؟",
    "deleteStorageTitle": "حذف التخزين",
    "removeRecord": "هل تريد إزالة «{label}» من المحفوظات؟ سيبقى الكائن في السحابة.",
    "removeRecordTitle": "إزالة السجل",
    "cloudBulkNote": "ستبقى كائنات S3/R2."
  },
  "table": {
    "columns": {
      "label": "التسمية",
      "status": "الحالة",
      "size": "الحجم",
      "storage": "التخزين",
      "fecha": "التاريخ"
    },
    "storagesColumns": {
      "name": "الاسم",
      "provider": "المزود",
      "bucket": "الحاوية",
      "endpoint": "نقطة الوصول"
    },
    "filters": {
      "searchBackupLabel": "البحث عن تسمية...",
      "filterBackupStorage": "التخزين",
      "searchStorageName": "البحث عن اسم...",
      "filterStorageProvider": "المزود"
    },
    "rowActions": {
      "download": "تنزيل",
      "removeRecord": "إزالة من السجل",
      "details": "عرض الخطأ",
      "delete": "حذف",
      "refresh": "تحديث الحالة"
    },
    "quickActions": {
      "deleteSelected": "حذف المحدد"
    },
    "storagesRowActions": {
      "edit": "تعديل",
      "delete": "حذف"
    }
  }
} as const;

export default backups;
