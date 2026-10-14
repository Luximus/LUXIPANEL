// Auto-split fragment of mail.ts (part 2/2) — data only, keeps <1000 lines.
// Do not reorder keys: the aggregator merges parts by spread in original order.
const mailPart2 = {
  "routing": {
    "labels": {
      "autoRemote": "الكشف التلقائي للإعداد: عن بُعد",
      "local": "خادم بريد محلي",
      "backup": "خادم بريد احتياطي",
      "remote": "خادم بريد عن بُعد"
    },
    "currentMode": "الحالي: {mode}"
  },
  "tracking": {
    "statuses": {
      "success": "ناجح",
      "deferred": "مؤجّل",
      "failure": "فشل",
      "inProgress": "قيد التنفيذ",
      "unknown": "غير معروف"
    },
    "columns": {
      "event": "الحدث",
      "fromAddress": "من",
      "sentTime": "وقت الإرسال",
      "spamScore": "درجة البريد المزعج",
      "recipient": "المستلم",
      "domain": "النطاق",
      "id": "المعرّف",
      "result": "النتيجة",
      "actions": "الإجراءات"
    },
    "noRecordsFound": "لا توجد سجلات.",
    "zeroRecords": "0 سجلات",
    "matchesZeroRecords": "لا تطابق البحث أي سجل.",
    "recordsCount": "{count} سجلات",
    "matchesRecords": "تطابق البحث {count} سجل.",
    "detailMeta": "الحدث: {event} | المعرّف: {id} | المستلم: {recipient}"
  },
  "filters": {
    "ruleParts": {
      "from": "من",
      "subject": "الموضوع",
      "to": "إلى",
      "anyRecipient": "أي مستلم",
      "reply": "الرد",
      "body": "نص الرسالة",
      "anyHeader": "أي رأسية",
      "notDelivered": "لم يُسلَّم مسبقًا",
      "errorMessage": "رسالة خطأ",
      "listId": "معرّف القائمة",
      "spamStatus": "حالة البريد المزعج",
      "spamBar": "شريط البريد المزعج",
      "spamScore": "درجة البريد المزعج"
    },
    "matches": {
      "contains": "يحتوي على",
      "matchesRegex": "يطابق regex",
      "doesNotContain": "لا يحتوي على",
      "equals": "يساوي",
      "beginsWith": "يبدأ بـ",
      "endsWith": "ينتهي بـ",
      "doesNotBegin": "لا يبدأ بـ",
      "doesNotEnd": "لا ينتهي بـ",
      "doesNotMatch": "لا يطابق",
      "isAbove": "أعلى من (أرقام فقط)",
      "isNotAbove": "ليس أعلى من (أرقام فقط)",
      "isBelow": "أقل من (أرقام فقط)",
      "isNotBelow": "ليس أقل من (أرقام فقط)"
    },
    "actions": {
      "discard": "تجاهل الرسالة",
      "redirect": "إعادة توجيه إلى بريد",
      "fail": "رفض مع رسالة",
      "stop": "إيقاف معالجة القواعد",
      "deliverToFolder": "التسليم إلى مجلد",
      "pipe": "تمرير إلى برنامج"
    },
    "joinOp": {
      "and": "و",
      "or": "أو"
    },
    "removeBtn": "-"
  },
  "defaultAddress": {
    "currentSetting": {
      "none": "الإعداد الحالي: (لا شيء)",
      "forward": "الإعداد الحالي: {destination}",
      "forwardDefault": "(إعادة توجيه)",
      "fail": "الإعداد الحالي: :fail: {message}"
    },
    "defaultFailMessage": "لا يوجد مستخدم بهذا العنوان"
  },
  "archive": {
    "retentionOptions": {
      "oneMonth": "شهر واحد",
      "threeMonths": "3 أشهر",
      "sixMonths": "6 أشهر",
      "oneYear": "سنة واحدة",
      "twoYears": "سنتان",
      "fiveYears": "5 سنوات",
      "tenYears": "10 سنوات",
      "forever": "للأبد",
      "custom": "مخصص"
    },
    "fields": {
      "incomingEmail": "رسائل البريد الواردة",
      "outgoingMailingList": "رسائل القائمة البريدية الصادرة",
      "outgoingEmail": "رسائل البريد الصادرة"
    }
  },
  "encryption": {
    "neverExpires": "لا تنتهي أبدًا"
  },
  "actions": {
    "view": "عرض",
    "save": "حفظ",
    "clone": "استنساخ",
    "copy": "نسخ",
    "delete": "حذف",
    "edit": "تعديل",
    "remove": "إزالة"
  },
  "outbound": {
    "cardTitle": "إرسال بريد اللوحة (SMTP)",
    "cardDesc": "الحساب الافتراضي أو SMTP خارجي تستخدمه اللوحة لإرسال التقارير ورسائل النظام.",
    "back": "رجوع",
    "intro": "الهوية التي يرسل بها LUXIPANEL رسائل النظام (تقارير وكلاء cron، روابط الموافقة، الاختبارات). يمكن أن تكون حساب بريد على هذا الخادم أو SMTP خارجيًا لا ينتمي إلى الخادم.",
    "modeLabel": "وضع الإرسال",
    "modeDisabled": "معطّل",
    "modeAccount": "حساب بريد الخادم (افتراضي)",
    "modeExternal": "SMTP خارجي",
    "accountLabel": "حساب الإرسال الافتراضي",
    "accountHint": "يستخدم بيانات اعتماد SMTP المخزّنة لذلك الحساب.",
    "hostLabel": "خادم SMTP",
    "portLabel": "المنفذ",
    "userLabel": "المستخدم",
    "passLabel": "كلمة المرور",
    "passPlaceholder": "(بدون تغيير)",
    "fromLabel": "المُرسِل (البريد الإلكتروني)",
    "fromNameLabel": "اسم المُرسِل",
    "secureLabel": "TLS مباشر (المنفذ 465)",
    "save": "حفظ",
    "testPlaceholder": "to@example.com",
    "test": "إرسال اختبار",
    "hostPlaceholder": "smtp.example.com",
    "fromPlaceholder": "sender@example.com",
    "fromNamePlaceholder": "شركتي"
  },
  "table": {
    "status": {
      "active": "نشط",
      "inactive": "غير نشط",
      "disabled": "معطَّل"
    },
    "redirect": {
      "columns": {
        "domain": "النطاق",
        "destinos": "الوجهات"
      },
      "filters": {
        "searchDomain": "البحث عن نطاق…"
      },
      "rowActions": {
        "edit": "تعديل",
        "delete": "حذف"
      }
    },
    "encryption": {
      "columns": {
        "keyId": "معرّف المفتاح",
        "label": "الهوية",
        "keySize": "حجم المفتاح",
        "created": "تم الإنشاء",
        "expires": "ينتهي"
      },
      "filters": {
        "searchKey": "البحث عن مفتاح…"
      },
      "rowActions": {
        "view": "عرض",
        "delete": "حذف"
      }
    },
    "accounts": {
      "columns": {
        "address": "العنوان",
        "domain": "النطاق",
        "uso": "الحصة / الاستخدام",
        "reenvios": "عمليات إعادة التوجيه",
        "estado": "الحالة"
      },
      "filters": {
        "search": "البحث عن عنوان أو نطاق…",
        "domain": "النطاق",
        "estado": "الحالة"
      },
      "rowActions": {
        "edit": "تعديل الحساب",
        "depurarIa": "تنظيف بالذكاء الاصطناعي",
        "password": "تغيير كلمة المرور",
        "toggle": "تفعيل / تعطيل",
        "inbox": "فتح البريد",
        "signatures": "إدارة التواقيع",
        "default": "تعيين كافتراضي",
        "contacts": "إدارة جهات الاتصال",
        "calendars": "إدارة التقاويم",
        "autoresponder": "إدارة الرد الآلي",
        "filters": "إدارة الفلاتر",
        "forwards": "إدارة إعادة التوجيه",
        "diskusage": "إدارة استخدام القرص",
        "clone": "استنساخ البريد",
        "delete": "حذف الحساب"
      },
      "quickActions": {
        "bulkForward": "إضافة إعادة توجيه",
        "bulkQuota": "تغيير الحصة",
        "bulkDelete": "حذف الحسابات"
      }
    },
    "globalFilters": {
      "columns": {
        "name": "الفلتر",
        "estado": "الحالة",
        "rules": "القواعد",
        "actionsCount": "الإجراءات"
      },
      "filters": {
        "search": "البحث عن فلتر…"
      },
      "rowActions": {
        "edit": "تعديل",
        "delete": "حذف"
      }
    },
    "contacts": {
      "columns": {
        "email": "البريد الإلكتروني",
        "name": "الاسم"
      },
      "filters": {
        "searchEmail": "البحث عن بريد…"
      },
      "rowActions": {
        "edit": "تعديل",
        "delete": "حذف"
      }
    },
    "calendars": {
      "columns": {
        "name": "الاسم",
        "timezone": "المنطقة الزمنية",
        "estado": "الحالة"
      },
      "filters": {
        "search": "البحث عن تقويم…"
      },
      "rowActions": {
        "edit": "تعديل",
        "delete": "حذف"
      }
    },
    "signatures": {
      "columns": {
        "sender": "المُرسِل",
        "preview": "التوقيع"
      },
      "filters": {
        "search": "تصفية وبحث…"
      },
      "rowActions": {
        "edit": "تعديل",
        "delete": "حذف"
      }
    },
    "filters": {
      "columns": {
        "name": "الاسم",
        "estado": "الحالة"
      },
      "filters": {
        "search": "البحث عن فلتر…"
      },
      "rowActions": {
        "edit": "تعديل",
        "delete": "حذف"
      }
    }
  },
  "confirm": {
    "bulkDeleteAccounts": "هل تريد حذف {count} حساب/حسابات بريد؟ لا يمكن التراجع عن هذا الإجراء.",
    "deleteAccount": "هل تريد حذف الحساب {address}؟ لا يمكن التراجع عن هذا الإجراء.",
    "deleteAccountTitle": "حذف الحساب",
    "deleteAutoresponder": "هل تريد حذف الرد التلقائي لهذا الحساب؟",
    "deleteByDate": "سيتم حذف الرسائل من {folder} بين {from} و {to}. هل تريد المتابعة؟",
    "deleteByDateTitle": "حذف الرسائل حسب التاريخ",
    "deleteCalendar": "هل تريد حذف التقويم \"{label}\"؟",
    "deleteCalendarTitle": "حذف التقويم",
    "deleteContact": "هل تريد حذف جهة الاتصال \"{label}\"؟",
    "deleteContactTitle": "حذف جهة الاتصال",
    "deleteDomainForward": "هل تريد حذف إعادة التوجيه الشاملة لـ @{domain}؟",
    "deleteDomainForwardTitle": "حذف إعادة التوجيه الشاملة",
    "deleteEncryptionKey": "هل تريد حذف مفتاح التشفير هذا؟",
    "deleteFilter": "هل تريد حذف الفلتر \"{name}\"؟",
    "deleteFilterTitle": "حذف الفلتر",
    "deleteForward": "هل تريد حذف إعادة التوجيه إلى {destination}؟",
    "deleteGlobalFilter": "هل تريد حذف الفلتر الشامل \"{label}\"؟",
    "deleteGlobalFilterTitle": "حذف الفلتر الشامل",
    "yesDelete": "نعم، حذف"
  },
  "empty": {
    "noDomains": "لا توجد نطاقات",
    "noFolders": "لم يتم العثور على مجلدات لهذا الحساب.",
    "noOtherAccount": "لا يوجد حساب آخر متاح"
  },
  "errors": {
    "accountCreateFailed": "فشل إنشاء الحساب",
    "accountNotFound": "لم يتم العثور على الحساب",
    "accountUpdateFailed": "فشل تحديث الحساب",
    "accountUpdatedForwardsFailed": "تم تحديث الحساب، لكن فشل تحديث عمليات إعادة التوجيه",
    "accountsLoadFailed": "فشل تحميل الحسابات",
    "autoDeleteThresholdInvalid": "حد الحذف التلقائي غير صالح.",
    "autoresponderDeleteFailed": "تعذّر حذف الرد التلقائي",
    "autoresponderSaveFailed": "تعذّر حفظ الرد التلقائي.",
    "calendarDeleteFailed": "تعذّر حذف التقويم",
    "calendarNotFound": "لم يتم العثور على التقويم",
    "calendarSaveFailed": "تعذّر حفظ التقويم.",
    "cloneCreateFailed": "تعذّر إنشاء الحساب الجديد.",
    "cloneFailed": "تعذّر استنساخ البريد.",
    "cloneIdResolveFailed": "تم إنشاء الحساب، لكن تعذّر تحديد معرّفه. أعد المحاولة كحساب «موجود».",
    "cloneLocalAndDomainRequired": "أدخل الجزء المحلي والنطاق.",
    "clonePasswordTooShort": "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.",
    "contactDeleteFailed": "تعذّر حذف جهة الاتصال",
    "contactNotFound": "لم يتم العثور على جهة الاتصال",
    "contactSaveFailed": "تعذّر حفظ جهة الاتصال.",
    "copyByRangeFailed": "تعذّر النسخ حسب النطاق",
    "customScoreInvalid": "النتيجة المخصصة غير صالحة.",
    "dateRangeRequired": "يجب اختيار تاريخ البداية والنهاية",
    "defaultAddressLoadFailed": "تعذّر تحميل العنوان الافتراضي.",
    "defaultAddressSaveFailed": "تعذّر حفظ العنوان الافتراضي.",
    "deleteByRangeFailed": "تعذّر الحذف حسب النطاق",
    "deleteFailed": "فشل الحذف",
    "destEmailInvalid": "بريد الوجهة غير صالح",
    "destinationsInvalidFormat": "وجهة واحدة أو أكثر بتنسيق غير صالح.",
    "diskUsageLoadFailed": "تعذّر تحميل استخدام القرص",
    "domainForwardDeleteFailed": "تعذّر حذف إعادة التوجيه الشاملة.",
    "domainForwardsLoadFailed": "تعذّر تحميل عمليات إعادة التوجيه الشاملة.",
    "domainRedirectSaveFailed": "تعذّر حفظ إعادة التوجيه الشاملة.",
    "domainsLoadFailed": "تعذّر تحميل نطاقات DNS",
    "filterDeleteFailed": "تعذّر حذف الفلتر",
    "filterNotFound": "لم يتم العثور على الفلتر",
    "filterSaveFailed": "تعذّر حفظ الفلتر.",
    "forwardAlreadyExists": "يوجد بالفعل إعادة توجيه إلى {destination}",
    "forwardsSaveFailed": "تعذّر حفظ عمليات إعادة التوجيه على الخادم",
    "globalFilterDeleteFailed": "تعذّر حذف الفلتر الشامل.",
    "globalFilterSaveFailed": "تعذّر حفظ الفلتر الشامل.",
    "globalFilterTestFailed": "تعذّر تنفيذ الاختبار.",
    "globalFiltersLoadFailed": "تعذّر تحميل الفلاتر الشاملة.",
    "indicateTestDestEmail": "حدّد بريد وجهة الاختبار.",
    "localPartInvalid": "الجزء قبل @ بتنسيق غير صالح.",
    "localPartInvalidNoPoint": "الجزء قبل @ بتنسيق غير صالح",
    "mustAddAtLeastOneAction": "يجب إضافة إجراء واحد على الأقل.",
    "mustAddAtLeastOneDestEmail": "يجب إضافة بريد وجهة واحد على الأقل.",
    "mustAddAtLeastOneRule": "يجب إضافة قاعدة واحدة على الأقل.",
    "mustEnterBody": "يجب إدخال محتوى الرسالة.",
    "mustEnterSubject": "يجب إدخال موضوع.",
    "mustEnterTestMessage": "يجب إدخال رسالة اختبار.",
    "mustEnterValidDestEmail": "يجب إدخال بريد وجهة صالح.",
    "mustIndicateCalendarName": "يجب تحديد اسم التقويم.",
    "mustIndicateContactEmail": "يجب تحديد بريد جهة الاتصال.",
    "mustIndicateFilterName": "يجب تحديد اسم الفلتر.",
    "mustIndicateName": "يجب تحديد اسم.",
    "mustSelectDomain": "يجب اختيار نطاق.",
    "mustSelectDomainNoPoint": "يجب اختيار نطاق",
    "noAutoresponderToDelete": "لا يوجد رد تلقائي لحذفه",
    "passwordChangeFailed": "فشل تغيير كلمة المرور",
    "quotaInvalid": "قيمة quota غير صالحة",
    "routingLoadFailed": "تعذّر تحميل إعدادات توجيه البريد الإلكتروني.",
    "routingSaveFailed": "تعذّر حفظ إعدادات توجيه البريد الإلكتروني.",
    "saveFailed": "فشل الحفظ",
    "scoreTypesLoadFailed": "تعذّر تحميل كتالوج أنواع النتائج.",
    "selectDestAccount": "اختر حساب الوجهة",
    "selectValidDomain": "اختر نطاقًا صالحًا.",
    "spamFiltersLoadFailed": "تعذّر تحميل فلاتر البريد المزعج.",
    "spamFiltersSaveFailed": "تعذّر حفظ إعدادات فلاتر البريد المزعج.",
    "testEmailFailed": "فشل إرسال رسالة الاختبار",
    "toggleFailed": "فشل تغيير الحالة",
    "trackDeliveryLoadFailed": "تعذّر تحميل تتبع التسليم."
  },
  "labels": {
    "accountColon": "الحساب: {address}",
    "activating": "جارٍ التفعيل",
    "cloneStartedBg": "بدأ الاستنساخ في الخلفية. سنُعلمك عبر الإشعارات عند الانتهاء.",
    "cloning": "جارٍ الاستنساخ…",
    "currentAccountColon": "الحساب الحالي: {address}",
    "deactivating": "جارٍ إلغاء التفعيل",
    "destEmailForCount": "بريد وجهة إعادة التوجيه المراد إضافته في {count} حساب/حسابات:",
    "loading": "جارٍ التحميل...",
    "newQuotaFor": "quota جديدة بالميغابايت لـ {count} حساب/حسابات. استخدم 0 لغير محدود.",
    "no": "لا",
    "noGlobalLimit": "بلا حد شامل",
    "originColon": "المصدر: {addr}",
    "sendingTest": "جارٍ إرسال الاختبار…",
    "sudoPromptMessage": "لا يمكن قراءة استخدام صناديق البريد دون صلاحيات على الخادم. أدخل كلمة مرور sudo لمستخدم SSH (تُحفظ مشفّرة على الخادم).",
    "to": "إلى",
    "total": "الإجمالي",
    "unlimited": "غير محدود",
    "yes": "نعم",
    "keepCopy": "الاحتفاظ بنسخة"
  },
  "placeholders": {
    "passwordNoChanges": "•••••••• (بدون تغييرات)",
    "selectDomain": "اختر نطاقًا...",
    "value": "القيمة",
    "valueIfApplicable": "القيمة (إن وُجدت)"
  },
  "status": {
    "active": "نشط",
    "deactivated": "معطّل",
    "inactive": "غير نشط"
  },
  "titles": {
    "addForward": "إضافة إعادة توجيه",
    "changeQuota": "تغيير quota",
    "deleteAccounts": "حذف الحسابات",
    "deleteAutoresponder": "حذف الرد التلقائي",
    "deleteEncryptionKey": "حذف المفتاح",
    "deleteForward": "حذف إعادة التوجيه"
  },
  "toasts": {
    "accountActivated": "تم تفعيل الحساب",
    "accountCreated": "تم إنشاء الحساب بنجاح",
    "accountDeactivated": "تم إلغاء تفعيل الحساب",
    "accountDeleted": "تم حذف الحساب",
    "accountUpdated": "تم تحديث الحساب ({localPart}@{domain})",
    "archiveDefaultUpdated": "تم تحديث إعدادات الأرشفة الافتراضية.",
    "archiveDomainUpdated": "تم تحديث الأرشفة لـ {domain}.",
    "autoDeleteDisabled": "تم تعطيل الحذف التلقائي",
    "autoDeleteEnabled": "تم تفعيل الحذف التلقائي",
    "autoDeleteUpdated": "تم تحديث الحذف التلقائي",
    "autoresponderDeleted": "تم حذف الرد التلقائي",
    "autoresponderSaved": "تم حفظ الرد التلقائي",
    "blacklistUpdated": "تم تحديث القائمة السوداء",
    "bulkDeletedCount": "تم حذف {ok}/{count} حساب/حسابات",
    "bulkUpdatedCount": "تم تحديث {ok}/{count} حساب/حسابات",
    "calculatedScoresUpdated": "تم تحديث النتائج المحسوبة",
    "calendarCreated": "تم إنشاء التقويم",
    "calendarDeleted": "تم حذف التقويم",
    "calendarUpdated": "تم تحديث التقويم",
    "cloneStarted": "بدأ الاستنساخ — سنُعلمك عند الانتهاء",
    "contactCreated": "تم إنشاء جهة الاتصال",
    "contactDeleted": "تم حذف جهة الاتصال",
    "contactUpdated": "تم تحديث جهة الاتصال",
    "defaultAddressUpdated": "تم تحديث العنوان الافتراضي لـ @{domain}",
    "defaultInboxSet": "{address} أصبح الآن البريد الافتراضي",
    "domainForwardDeleted": "تم حذف إعادة التوجيه الشاملة لـ @{domain}",
    "emailRoutingUpdated": "تم تحديث توجيه البريد الإلكتروني لـ @{domain}",
    "emailsCopied": "تم نسخ {count} رسالة من {folder}",
    "emailsDeleted": "تم حذف {count} رسالة من {folder}",
    "filterCreated": "تم إنشاء الفلتر",
    "filterDeleted": "تم حذف الفلتر",
    "filterUpdated": "تم تحديث الفلتر",
    "forwardAddedCount": "تمت إضافة إعادة التوجيه في {ok}/{count} حساب/حسابات",
    "forwardDeleted": "تم حذف إعادة التوجيه",
    "forwardsUpdated": "تم تحديث عمليات إعادة التوجيه",
    "globalFilterCreated": "تم إنشاء الفلتر الشامل",
    "globalFilterDeleted": "تم حذف الفلتر الشامل",
    "globalFilterUpdated": "تم تحديث الفلتر الشامل",
    "globalRedirectSaved": "تم حفظ إعادة التوجيه الشاملة لـ @{domain}",
    "keyDeleted": "تم حذف المفتاح.",
    "keyGenerated": "تم توليد المفتاح.",
    "passwordUpdated": "تم تحديث كلمة المرور",
    "publicKeyImported": "تم استيراد المفتاح العام.",
    "settingsSaved": "تم حفظ الإعدادات ✓",
    "spamBoxDisabled": "تم تعطيل صندوق البريد المزعج",
    "spamBoxEnabled": "تم تفعيل صندوق البريد المزعج",
    "spamBoxUpdated": "تم تحديث صندوق البريد المزعج",
    "spamFiltersDisabled": "تم تعطيل فلاتر البريد المزعج",
    "spamFiltersEnabled": "تم تفعيل فلاتر البريد المزعج",
    "spamThresholdUpdated": "تم تحديث حد البريد المزعج",
    "testEmailSent": "تم إرسال رسالة الاختبار ✓",
    "whitelistUpdated": "تم تحديث القائمة البيضاء"
  },
  "signaturesDrawer": {
    "title": "التواقيع",
    "addSignature": "إضافة توقيع",
    "close": "إغلاق",
    "tableTitle": "التواقيع"
  },
  "dataTableTitles": {
    "rules": "القواعد",
    "publicKeys": "المفاتيح العامة",
    "privateKeys": "المفاتيح الخاصة",
    "accounts": "الحسابات",
    "globalFilters": "المرشحات العامة",
    "contacts": "جهات الاتصال",
    "calendars": "التقويمات",
    "filters": "المرشحات"
  },
  "trackColumns": {
    "event": "الحدث",
    "fromAddress": "عنوان المصدر",
    "sentTime": "وقت الإرسال",
    "spamScore": "درجة البريد المزعج",
    "recipient": "المستلم",
    "domain": "النطاق",
    "queueId": "المعرّف",
    "result": "النتيجة",
    "actions": "الإجراءات"
  }
} as const;

export default mailPart2;
