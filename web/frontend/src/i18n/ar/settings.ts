const settings = {
  "passkeyName": {
    "title": "اسم مفتاح المرور",
    "hint": "استخدم اسمًا يساعدك على التعرف على الجهاز.",
    "placeholder": "مثال: الحاسوب المحمول الشخصي",
    "save": "حفظ الاسم",
    "edit": "تعديل الاسم",
    "invalid": "أدخل اسمًا من حرف واحد إلى 128 حرفًا.",
    "saved": "تم تحديث الاسم",
    "error": "تعذّر حفظ الاسم.",
    "cancel": "إلغاء"
},
  "placeholders": {
    "logoUrl": "https://example.com/logo.png",
    "imageUrl": "https://…/image.jpg"
  },
  "pageTitle": "الإعدادات",
  "loadFailure": {
    "title": "تعذّر تحميل الإعدادات",
    "sessionMessage": "تعذّر تحميل الإعدادات: الجلسة مع الخادم غير متاحة. أعد اختيار الخادم من القائمة، أو سجّل الخروج ثم الدخول من جديد.",
    "genericMessage": "تعذّر تحميل الإعدادات. تحقّق من اتصالك وحاول مرة أخرى.",
    "retry": "إعادة المحاولة"
  },
  "header": {
    "title": "إعدادات اللوحة",
    "subtitle": "الإعداد العام لـ LuxiPanel",
    "autosave": "حفظ تلقائي"
  },
  "tabs": {
    "general": "عام",
    "layoutUi": "التخطيط/الواجهة",
    "security": "الأمان",
    "modules": "الوحدات",
    "system": "النظام",
    "credentials": "بيانات الاعتماد"
  },
  "credentials": {
    "hcaptcha": {
      "title": "hCaptcha",
      "desc": "احمِ تسجيل الدخول إلى اللوحة بتحدي hCaptcha. أدخل المفاتيح من لوحة تحكم hCaptcha الخاصة بك.",
      "sitekeyLabel": "مفتاح الموقع",
      "sitekeyPlaceholder": "مفتاح موقع hCaptcha الخاص بك",
      "secretLabel": "المفتاح السري",
      "secretPlaceholder": "أدخل مفتاحًا سريًا جديدًا",
      "secretConfigured": "يوجد مفتاح سري مُعيَّن بالفعل. اترك هذا الحقل فارغًا للاحتفاظ به.",
      "statusConfigured": "مُهيَّأ",
      "statusMissing": "غير مُهيَّأ",
      "saved": "تم حفظ إعدادات hCaptcha"
    },
    "tolqia": {
      "label": "Tolqia",
      "help": "رمز API لحسابك في Tolqia (خطة Plus أو Premium) — يفعّل المكالمات المترجمة لمستخدمي هذا الخادم",
      "guide": {
        "steps": [
          "ادخل إلى tolqia.com وسجّل الدخول إلى حسابك (خطة Plus أو Premium).",
          "افتح «الإعدادات» › «API» وأنشئ رمزًا جديدًا.",
          "انسخ الرمز (يبدأ بـ tq_live_) والصقه في «إعداد»."
        ],
        "docUrl": "https://tolqia.com/settings/api",
        "docLabel": "إنشاء رمز في tolqia.com ← الإعدادات › API",
        "docUrl2": "https://tolqia.com/docs",
        "docLabel2": "التوثيق"
      }
    },
    "elevenlabs": {
      "label": "ElevenLabs",
      "help": "تُستخدم للترجمة الفورية للمكالمات الصوتية",
      "voiceIdLabel": "معرّف الصوت الافتراضي (Voice ID)",
      "voiceIdPlaceholder": "مثال: 21m00Tcm4TlvDq8ikWAM",
      "guide": {
        "steps": [
          "ادخل إلى elevenlabs.io وسجّل الدخول.",
          "افتح «My Account» ← «API Keys» وأنشئ مفتاحًا جديدًا.",
          "انسخ المفتاح (يبدأ بـ sk_) والصقه في تبويب «التهيئة»."
        ],
        "docUrl": "https://elevenlabs.io/app/settings/api-keys",
        "docLabel": "مفاتيح API الخاصة بـ ElevenLabs"
      }
    },
    "title": "بيانات اعتماد الوحدات",
    "subtitle": "أدر Access Tokens ومفاتيح API التي تحتاجها الوحدات للعمل.",
    "empty": "لا توجد وحدات تتطلب بيانات اعتماد مفعلة على هذا الخادم.",
    "statusSet": "مكتمل",
    "statusMissing": "لم يتم التكوين",
    "tokenLabel": "رمز وصول / مفتاح API",
    "tokenPlaceholder": "الصق الرمز…",
    "save": "حفظ",
    "test": "اختبار",
    "clear": "إزالة",
    "manage": "إدارة",
    "show": "إظهار",
    "hide": "إخفاء",
    "saved": "تم حفظ بيانات الاعتماد",
    "cleared": "تم حذف بيانات الاعتماد",
    "testOk": "الاتصال صالح",
    "testFail": "تعذر التحقق من صحة بيانات الاعتماد",
    "confirmClear": "إزالة بيانات الاعتماد هذه؟",
    "confirmClearTitle": "إزالة بيانات الاعتماد",
    "error": "حدث خطأ ما",
    "getDoc": "الحصول على رمز",
    "managedLabel": {
      "assistant": "وكلاء الذكاء الاصطناعي"
    },
    "managedHint": {
      "assistant": "يتم إدارة مفاتيح API الخاصة بموفري المساعد في لوحتهم.",
      "backups": "يتم إدارة مفاتيح التخزين (S3 / R2) في وحدة النسخ الاحتياطية."
    },
    "managedSummary": {
      "assistant": "موفرو الذكاء الاصطناعي (Claude, OpenAI, Gemini, …)",
      "backups": "بيانات اعتماد التخزين S3 / R2"
    },
    "storage": {
      "accountId": "معرّف الحساب (Cloudflare)",
      "accessKeyId": "معرّف مفتاح الوصول",
      "secret": "مفتاح الوصول السري",
      "endpoint": "Endpoint (اختياري)",
      "region": "المنطقة (اختيارية)",
      "r2Hint": "بيانات اعتماد R2 على مستوى الحساب قابلة لإعادة الاستخدام بواسطة النسخ الاحتياطية: عيّن المفاتيح مرة واحدة هنا واختر bucket في النسخ الاحتياطية.",
      "s3Hint": "بيانات اعتماد S3 قابلة لإعادة الاستخدام بواسطة النسخ الاحتياطية: عيّن المفاتيح مرة واحدة هنا واختر bucket في النسخ الاحتياطية."
    },
    "connector": {
      "connect": "الحفظ والاتصال",
      "disconnect": "قطع الاتصال",
      "connected": "متصل",
      "configured": "مكتمل",
      "notConnected": "غير متصل",
      "unavailable": "يتطلب تفعيل وحدة وكلاء الذكاء الاصطناعي",
      "setupGuide": "دليل الإعداد"
    },
    "help": {
      "tabConfig": "تكوين",
      "tabHelp": "مساعدة",
      "openLink": "فتح الرابط",
      "guides": {
        "cloudflare": {
          "steps": [
            "ادخل إلى dash.cloudflare.com ← «ملفي الشخصي» ← «رموز API».",
            "انقر على «إنشاء رمز»: استخدم قالب «تعديل منطقة DNS» أو أنشئ رمزاً مخصصاً بالأذونات التي تحتاجها (منطقة:قراءة، DNS:تعديل، إلخ).",
            "اختر المناطق التي سيتمتع الرمز بالوصول إليها ثم أنشئه.",
            "انسخ الرمز (يظهر مرة واحدة فقط) والصقه في تبويب «تكوين»."
          ],
          "docUrl": "https://dash.cloudflare.com/profile/api-tokens",
          "docLabel": "رموز API Cloudflare"
        },
        "expo": {
          "steps": [
            "ادخل إلى expo.dev وسجّل الدخول ← «Account settings» ← «Access tokens».",
            "انقر على «Create token»، أعطِه اسماً وانسخ القيمة المولَّدة.",
            "الصقه في تبويب «تكوين»."
          ],
          "docUrl": "https://expo.dev/settings/access-tokens",
          "docLabel": "رموز وصول Expo"
        },
        "openclaw": {
          "steps": [
            "ادخل إلى openclaw.ai وسجّل الدخول.",
            "ولّد مفتاح API أو انسخه من لوحة OpenClaw.",
            "الصقه في «تكوين» (اضبط endpoint والنموذج الافتراضي إذا اختلفا)."
          ],
          "docUrl": "https://openclaw.ai",
          "docLabel": "OpenClaw"
        },
        "repository-store": {
          "steps": [
            "ادخل إلى github.com ← «Settings» ← «Developer settings» ← «Personal access tokens».",
            "ولّد رمزاً (classic أو fine-grained) بصلاحية قراءة المستودعات (public_repo أو Contents: Read).",
            "انسخ الرمز (يبدأ بـ ghp_ أو github_pat_) والصقه في «تكوين»."
          ],
          "docUrl": "https://github.com/settings/tokens",
          "docLabel": "رموز GitHub"
        },
        "bitninja": {
          "steps": [
            "ادخل إلى لوحة BitNinja (admin.bitninja.io) وسجّل الدخول.",
            "انسخ License Key من قسم التراخيص/الخوادم.",
            "الصقه في «تكوين»."
          ],
          "docUrl": "https://bitninja.io",
          "docLabel": "BitNinja"
        },
        "r2": {
          "steps": [
            "ادخل إلى dash.cloudflare.com ← «R2» ← «Manage R2 API Tokens».",
            "أنشئ «R2 API Token» (متوافق مع S3) بصلاحية قراءة/كتابة الكائنات.",
            "انسخ Access Key ID وSecret Access Key الظاهرَين.",
            "يظهر Account ID في صفحة R2 / ملخص الحساب.",
            "الصق Account ID + Access Key ID + Secret في «تكوين» (يُستنتج endpoint من Account ID)."
          ],
          "docUrl": "https://dash.cloudflare.com/?to=/:account/r2/api-tokens",
          "docLabel": "رموز API R2"
        },
        "s3": {
          "steps": [
            "في وحدة تحكم AWS: «IAM» ← «Users» ← مستخدمك ← «Security credentials» ← «Create access key».",
            "انسخ Access Key ID وSecret Access Key.",
            "إذا كنت تستخدم خدمة متوافقة مع S3 (Wasabi أو MinIO وغيرها)، سجّل Endpoint والمنطقة الخاصة بها.",
            "الصق المفاتيح (والـ Endpoint/المنطقة إن وُجدا) في «تكوين»."
          ],
          "docUrl": "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html",
          "docLabel": "مفاتيح وصول AWS"
        }
      }
    }
  },
  "general": {
    "hcaptchaEnabled": "طلب hCaptcha عند تسجيل الدخول",
    "hcaptchaEnabledHint": "إظهار تحدي hCaptcha في نموذج تسجيل الدخول للوحة.",
    "sectionTitle": "عام",
    "labelPanelName": "اسم اللوحة",
    "labelTimezone": "المنطقة الزمنية",
    "labelLanguage": "اللغة",
    "languageOptions": {
      "en": "English",
      "es": "Español"
    },
    "labelSessionTtl": "مدة الجلسة (ساعات)",
    "labelMaxLoginAttempts": "محاولات تسجيل الدخول الفاشلة (الحظر)",
    "labelRequire2fa": "طلب 2FA لجميع المستخدمين",
    "btnViewLog": "عرض السجل",
    "labelAuditLog": "تفعيل سجل المراجعة",
    "labelSwitchNewTab": "فتح الخادم في علامة تبويب جديدة عند التبديل"
  },
  "imageList": {
    "labelJson": "(JSON)",
    "labelUrls": "(روابط الصور)",
    "addButton": "إضافة صورة"
  },
  "layout": {
    "sectionTitle": "التخطيط والهوية البصرية والواجهة",
    "sectionSubtitle": "خصِّص الشعارات والزوايا والظلال والألوان الأساسية للواجهة الأمامية.",
    "branding": {
      "groupTitle": "الهوية البصرية والشعارات",
      "groupDesc": "شعار واحد يُطبَّق على الشريط الجانبي وتسجيل الدخول والرأس والتذييل والأيقونة.",
      "labelLogoUrl": "URL الشعار",
      "logoUrlHelp": "شعار واحد يُستخدم في كل مكان: الشريط الجانبي، تسجيل الدخول، رأس اللوحة، التذييل والشاشات العامة.",
      "btnUpload": "رفع",
      "btnPick": "اختيار",
      "btnDefault": "الافتراضي",
      "restoreLogos": "إعادة تعيين الشعارات",
      "loginLogoOpacity": "تعتيم حاوية شعار تسجيل الدخول",
      "loginLogoOpacityHelp": "شفافية خلفية دائرة الشعار في /login (0 = شفاف، 100 = صلب)."
    },
    "loginBg": {
      "groupTitle": "خلفية تسجيل الدخول",
      "groupDesc": "تأثير خلفية متحرك في /login ولون احتياطي له.",
      "enableLabel": "عرض خلفية متحركة في /login",
      "labelFallbackColor": "لون الخلفية عند التعطيل",
      "labelActiveEffect": "التأثير النشط في /login",
      "previewTitle": "معاينة تسجيل الدخول"
    },
    "shape": {
      "groupTitle": "الشكل والظلال",
      "groupDesc": "نصف القطر العام وظلال البطاقات والنوافذ في الواجهة.",
      "labelRadius": "الزاوية العامة",
      "radiusHelp": "مثال: 0.5rem، 12px.",
      "labelShadow": "الظل الأساسي",
      "labelModalShadow": "ظل النافذة المنبثقة",
      "labelModalBackdrop": "تراكب النافذة المنبثقة",
      "backdropHelp": "خلفية مربعات الحوار.",
      "layer1": "طبقة 1",
      "layer2": "طبقة 2",
      "labelColor": "اللون",
      "labelShadowSingle": "ظل"
    },
    "palettes": {
      "title": "نظام الألوان",
      "subtitle": "اختر لوحة ألوان معدّة مسبقًا؛ تُطبَّق على اللوحة بأكملها (فاتح وداكن).",
      "light": "السمة الفاتحة",
      "dark": "السمة الداكنة",
      "intensity": "الكثافة"
    },
    "resetButton": "إعادة تعيين الأنماط إلى الافتراضي",
    "panelBg": {
      "groupTitle": "خلفية اللوحة",
      "groupDesc": "تأثير خلفية متحرك داخل اللوحة ولون احتياطي له.",
      "enableLabel": "عرض خلفية متحركة في اللوحة",
      "labelFallbackColor": "لون الخلفية عند التعطيل",
      "labelActiveEffect": "التأثير النشط للوحة"
    }
  },
  "security": {
    "sectionTitle": "الأمان",
    "loginMethodsTitle": "طرق تسجيل الدخول المسموح بها",
    "loginMethodsDesc": "يجب أن تبقى طريقة واحدة على الأقل نشطة. لن تظهر الطرق المعطّلة في شاشة تسجيل الدخول.",
    "loginMethodsWarning": "يجب أن تبقى طريقة واحدة على الأقل نشطة.",
    "passkey": {
      "name": "مفتاح المرور (Passkey)",
      "desc": "مصادقة بيومترية / FIDO2. يجب على المستخدمين تسجيل أجهزتهم.",
      "verifying": "جارٍ التحقق...",
      "btnManage": "إدارة"
    },
    "password": {
      "name": "كلمة المرور",
      "desc": "تسجيل الدخول باسم المستخدم وكلمة المرور. متاح دائماً دون إعداد مسبق.",
      "configured": "مُهيَّأ"
    },
    "recovery": {
      "name": "الاسترداد",
      "desc": "رموز أحادية الاستخدام كاحتياط طارئ.",
      "verifying": "جارٍ التحقق...",
      "btnManage": "إدارة"
    },
    "twoFaStatus": {
      "groupTitle": "حالة المصادقة الثنائية لهذا الحساب",
      "badgeDisabled": "معطَّل",
      "promptText": "فعِّل المصادقة الثنائية لحماية هذا الحساب الإداري.",
      "btnSetup": "إعداد",
      "btnDelete": "حذف",
      "btnDisable": "تعطيل"
    }
  },
  "modules": {
    "sectionTitle": "محركات التخزين المؤقت لكل وحدة",
    "sectionDesc1": "حالة وضبط الجمع المجدول على خادم العميل.",
    "sectionDescBold": "النشاط/الخمول مشتق من الوحدة الأصل",
    "modulesLink": "الوحدات",
    "sectionDesc2": ": عند تعطيل وحدة يتوقف جمعها؛ وعند إعادة تفعيلها يُجدوَل مجدداً. هنا يُضبط التكرار فقط. تقرأ DataTables البيانات المُهيأة مسبقاً من Redis المخصص على ذلك الخادم؛ وإذا كان متوقفاً أو قديماً جداً تتراجع إلى JSON العادي.",
    "loading": "جارٍ التحميل…",
    "tableHeaders": {
      "module": "الوحدة / المجموعة",
      "source": "المصدر",
      "active": "نشط",
      "interval": "الفاصل الزمني (ث)",
      "lastRefresh": "آخر تحديث",
      "duration": "المدة",
      "size": "الحجم",
      "hitRatio": "نسبة الإصابة"
    },
    "managedInPre": " (مُدار في ",
    "managedInPost": ")"
  },
  "system": {
    "factoryReset": {
      "sectionTitle": "إعادة تعيين الإعدادات",
      "sectionSubtitle": "استعادة إعدادات اللوحة إلى القيم الافتراضية.",
      "warningTitle": "تحذير",
      "warningBefore": "سيُعيد هذا الإجراء ضبط ",
      "warningAllSettings": "جميع إعدادات التكوين",
      "warningMiddle": " في اللوحة (العامة، والتخطيط/الواجهة، وSMTP، والأمان، والتفضيلات المحفوظة للوحدات) إلى قيمها الافتراضية. المستخدمون والوحدات المثبّتة ",
      "warningNotDeleted": "لن تُحذف",
      "warningAfter": ".",
      "btnReset": "استعادة الإعدادات الافتراضية"
    },
    "backupRestore": {
      "sectionTitle": "الاستعادة من نسخة احتياطية",
      "sectionSubtitle": "استعادة اللوحة من نسخة احتياطية سابقة (يتطلب وحدة النسخ الاحتياطية).",
      "loading": "جارٍ تحميل النسخ الاحتياطية...",
      "btnRestore": "استعادة النسخة الاحتياطية المحددة"
    },
    "noBackup": {
      "title": "الاستعادة من نسخة احتياطية غير متاحة",
      "descBefore": "ثبّت وحدة ",
      "backupsModule": "النسخ الاحتياطية",
      "descAfter": " من لوحة الوحدات لتفعيل هذه الميزة."
    }
  },
  "imagePicker": {
    "title": "اختيار صورة",
    "subtitle": "الصور المتاحة في المجلد العام للواجهة الأمامية.",
    "empty": "لا توجد صور في المجلد العام.",
    "btnUpload": "رفع صورة جديدة",
    "btnCancel": "إلغاء"
  },
  "smtpTest": {
    "dialogTitle": "إرسال بريد اختباري",
    "labelRecipient": "المستلم",
    "placeholderRecipient": "you@example.com",
    "btnCancel": "إلغاء",
    "btnSend": "إرسال"
  },
  "passkeysDialog": {
    "title": "إدارة مفاتيح المرور",
    "btnAdd": "إضافة مفتاح مرور",
    "empty": "لا توجد مفاتيح مرور مسجَّلة"
  },
  "recoveryDialog": {
    "title": "رموز الاسترداد",
    "btnGenerate": "إنشاء / إعادة إنشاء",
    "loading": "جارٍ التحميل...",
    "warningText": "احفظ هذه الرموز في مكان آمن. تظهر مرة واحدة فقط.",
    "btnCopy": "نسخ الكل",
    "btnPrint": "طباعة"
  },
  "setup2faDialog": {
    "title": "إعداد المصادقة الثنائية",
    "subtitle": "امسح رمز QR هذا بتطبيق المصادقة.",
    "secretLabel": "المفتاح السري اليدوي:",
    "copyTitle": "نسخ",
    "verifyLabel": "أدخل الرمز المكوّن من 6 أرقام:",
    "btnCancel": "إلغاء",
    "btnActivate": "تفعيل المصادقة الثنائية"
  },
  "disable2faDialog": {
    "title": "تعطيل 2FA؟",
    "body": "سيُعطَّل 2FA لكن سيُحتفظ بالسر لإعادة تفعيله لاحقاً.",
    "btnCancel": "إلغاء",
    "btnConfirm": "تعطيل المصادقة الثنائية"
  },
  "delete2faDialog": {
    "title": "حذف 2FA؟",
    "body": "سيُحذف السر المحفوظ وستحتاج إلى إعداده من جديد لاستخدام 2FA.",
    "btnCancel": "إلغاء",
    "btnConfirm": "حذف المصادقة الثنائية"
  },
  "auditLogDialog": {
    "title": "سجل المراجعة",
    "empty": "لا يوجد نشاط مسجَّل"
  },
  "modulesCache": {
    "agoSeconds": "منذ {n}ث",
    "agoMinutes": "منذ {n}د",
    "agoHours": "منذ {n}س",
    "agoDays": "منذ {n}ي",
    "collectionSingular": "مجموعة",
    "collectionPlural": "مجموعات",
    "activeSingular": "نشطة",
    "activePlural": "نشطات",
    "enabledTitle": "جمع مجدوَل عبر موزّع الخادم العميل",
    "badgeEnabled": "نشط",
    "disabledTitle": "الوحدة الأصلية معطّلة في /panel/modules — الجمع متوقف",
    "badgeDisabled": "غير نشط",
    "buttonSave": "حفظ",
    "saving": "جارٍ الحفظ…",
    "savedStatus": "تم تحديث {module}/{collection}",
    "saveError": "خطأ في حفظ {module}/{collection}: {message}",
    "loadedSummary": "{count} مجموعات قابلة للتخزين المؤقت في {modules} وحدات. تُطبَّق التغييرات في الدورة التالية للمجمّع (≤60s).",
    "loadError": "خطأ: {message}"
  },
  "labels": {
    "auditLogin": "تسجيل الدخول",
    "auditLoginFailed": "محاولة تسجيل دخول فاشلة",
    "auditLogout": "تسجيل الخروج",
    "auditPasswordChange": "تغيير كلمة المرور",
    "auditPasskeyRegister": "تم تسجيل Passkey",
    "auditPasskeyDelete": "تم حذف Passkey",
    "auditRecoveryCodeUsed": "تم استخدام رمز الاسترداد",
    "auditProfileUpdate": "تم تحديث الملف الشخصي",
    "auditSettingsUpdate": "تم تحديث الإعدادات",
    "audit2faEnabled": "تم تفعيل 2FA",
    "audit2faDisabled": "تم تعطيل 2FA",
    "auditEventDefault": "حدث",
    "aiHintAnthropic": "النماذج الموصى بها: claude-fable-5 (الأحدث), claude-sonnet-4-6 (توازن), claude-opus-4-6 (الأقوى)",
    "aiKeyHintAnthropic": "احصل على مفتاح API من console.anthropic.com",
    "aiHintOpenai": "gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna",
    "aiKeyHintOpenai": "احصل على مفتاح API من platform.openai.com",
    "aiHintOllama": "اسم النموذج المثبت في Ollama المحلي. لا يدعم الأدوات.",
    "aiKeyHintOllama": "لا يتطلب مفتاح API لـ Ollama المحلي",
    "managedByLp": "مُدار بواسطة LP-LICENSE-SERVER",
    "notAvailable": "غير متاح",
    "managedExternally": "مُدار خارجياً",
    "twoFaManagedByLp": "تتم إدارة المصادقة من LP-LICENSE-SERVER في هذا الوضع.",
    "licenseNoStatus": "بدون حالة",
    "licenseActive": "نشطة",
    "licenseExpires": "تنتهي {date}",
    "licenseActiveDesc": "الترخيص نشط",
    "licenseDegraded": "متدهورة",
    "licensePending": "معلقة",
    "licenseDegradedDesc": "تعذر التحقق من الترخيص واللوحة في وضع متدهور.",
    "licenseNotActivated": "الترخيص لم يُفعَّل بعد.",
    "passkeyCount": "{count} Passkey مسجلة",
    "noPasskeys": "لا توجد Passkeys مسجلة",
    "recoveryCodesGenerated": "تم إنشاء رموز الاسترداد",
    "noRecoveryCodes": "لا توجد رموز مُنشأة",
    "passkeyRegistered": "مسجلة {date}",
    "recoveryCodesActive": "لديك رموز استرداد نشطة.",
    "recoveryCodesNone": "لا توجد لديك رموز استرداد نشطة.",
    "recoveryCodesDisplayed": "تم إنشاء {count} رمز. احتفظ بها في مكان آمن.",
    "twoFaEnabled": "مفعّل",
    "twoFaEnabledDesc": "سيُطلب هذا 2FA في تسجيل الدخول التالي. يمكنك تعطيله دون حذف السر.",
    "twoFaDisabled": "معطّل",
    "twoFaDisabledDesc": "يبقى السر محفوظاً لكنه لن يُطلب عند تسجيل الدخول حتى تعيد تفعيله.",
    "twoFaSetupPrompt": "فعّل 2FA لحماية هذا الحساب الإداري.",
    "printRecoveryCodesTitle": "رموز الاسترداد - LUXIPANEL",
    "printRecoveryCodesDesc": "احتفظ بهذه الرموز في مكان آمن. كل رمز لا يمكن استخدامه إلا مرة واحدة."
  },
  "toasts": {
    "errorSaving": "خطأ في حفظ الإعدادات",
    "errorSavingAppearance": "تعذر حفظ المظهر في خادم الترخيص. أعد المحاولة بعد ثوانٍ.",
    "licenseKeyAndRefRequired": "أدخل المفتاح ومرجع الدفع",
    "licenseActivated": "تم تفعيل الترخيص بنجاح",
    "licenseActivateError": "تعذر تفعيل الترخيص",
    "timezoneApplyError": "تعذر تطبيق المنطقة الزمنية على النظام",
    "timezoneSavedNotApplied": "تم حفظ المنطقة الزمنية في اللوحة، لكن تعذر تطبيقها على النظام (تحقق من صلاحيات sudo).",
    "passkeysInLp": "تتم إدارة Passkeys في LP-LICENSE-SERVER",
    "passkeyDeleted": "تم حذف Passkey",
    "passkeyDeleteError": "خطأ في حذف Passkey",
    "passkeyBrowserUnsupported": "متصفحك لا يدعم Passkey",
    "passkeyRegisterInitError": "تعذر بدء التسجيل",
    "passkeyRegisterCancelled": "تم إلغاء التسجيل",
    "passkeyRegisterFinishError": "خطأ في إنهاء التسجيل",
    "passkeyRegistered": "تم تسجيل Passkey بنجاح",
    "passkeyRegisterUserCancelled": "تم إلغاء التسجيل من قِبل المستخدم",
    "passkeyRegisterError": "خطأ في تسجيل Passkey",
    "recoveryCodesInLp": "تتم إدارة رموز الاسترداد في LP-LICENSE-SERVER",
    "recoveryCodesGenerateError": "خطأ في إنشاء الرموز",
    "twoFaInLp": "تتم إدارة 2FA في LP-LICENSE-SERVER",
    "twoFaSetupInitError": "خطأ في بدء إعداد 2FA",
    "twoFaQrError": "تعذر إنشاء رمز QR",
    "twoFaActivated": "تم تفعيل 2FA بنجاح",
    "twoFaDisabled": "تم تعطيل 2FA عند تسجيل الدخول",
    "twoFaDisableError": "خطأ في تعطيل 2FA",
    "twoFaReactivated": "تم تفعيل 2FA عند تسجيل الدخول",
    "twoFaActivateError": "خطأ في تفعيل 2FA",
    "twoFaDeleted": "تم حذف 2FA",
    "twoFaDeleteError": "خطأ في حذف 2FA",
    "backupRestoreUnavailable": "استعادة Backups غير متاحة بعد من هذه اللوحة.",
    "imageExceeds5mb": "الصورة تتجاوز 5MB",
    "uploadingImage": "جارٍ رفع الصورة...",
    "imageUploadError": "خطأ في رفع الصورة",
    "imageUploadInvalidResponse": "استجابة غير صالحة من الخادم",
    "imageUploaded": "تم رفع الصورة بنجاح",
    "logosRestored": "تم استعادة الشعارات إلى القيم الافتراضية",
    "codesCopied": "تم نسخ الرموز",
    "secretCopied": "تم نسخ السر",
    "smtpTestSent": "تم إرسال بريد اختبار إلى {to}",
    "smtpTestError": "خطأ في الإرسال",
    "layoutReset": "تم إعادة الأنماط إلى القيم الافتراضية",
    "settingsReset": "تم إعادة الإعدادات",
    "settingsResetError": "خطأ في إعادة الضبط",
    "licenseRevalidated": "تم إعادة التحقق من الترخيص",
    "licenseRevalidateError": "تعذر إعادة التحقق من الترخيص"
  },
  "actions": {
    "activating": "جارٍ التفعيل...",
    "activateOrUpdate": "تفعيل / تحديث",
    "manage": "إدارة",
    "configure": "تكوين",
    "viewOrRegenerate": "عرض / إعادة إنشاء",
    "generate": "إنشاء",
    "generating": "جارٍ الإنشاء...",
    "generateOrRegenerate": "إنشاء / إعادة إنشاء",
    "disable": "تعطيل",
    "activate": "تفعيل",
    "activate2fa": "تفعيل 2FA",
    "continue": "متابعة",
    "sending": "جارٍ الإرسال...",
    "send": "إرسال",
    "resetting": "جارٍ إعادة الضبط...",
    "factoryReset": "إعادة الضبط إلى إعدادات المصنع"
  },
  "errors": {
    "twoFaEnter6Digits": "أدخل الأرقام الـ 6 للرمز",
    "twoFaInvalidCode": "رمز غير صالح"
  },
  "confirm": {
    "deletePasskeyTitle": "حذف Passkey",
    "deletePasskeyBody": "هل تريد حذف هذه Passkey؟",
    "restoreBackupBody": "هل تريد استعادة النسخة الاحتياطية \"{id}\"؟",
    "restoreBackupTitle": "استعادة النسخة الاحتياطية",
    "restoreLogosBody": "هل تريد استعادة الشعار إلى قيم LUXIPANEL الافتراضية؟",
    "restoreLogosTitle": "استعادة الشعارات",
    "restoreLogosConfirm": "نعم، استعادة",
    "resetLayoutBody": "هل تريد إعادة أنماط الواجهة إلى قيم LUXIPANEL الافتراضية؟ ستُفقد الشعارات والألوان والظلال والخلفيات المخصصة.",
    "resetLayoutTitle": "إعادة الأنماط",
    "resetLayoutConfirm": "نعم، إعادة الضبط",
    "factoryResetBody": "هل أنت متأكد؟ سيؤدي هذا إلى إعادة ضبط جميع إعدادات اللوحة.",
    "factoryResetTitle": "إعادة ضبط الإعدادات",
    "factoryResetConfirm": "نعم، إعادة الضبط"
  },
  "empty": {
    "noBackups": "لا توجد Backups متاحة."
  },
  "palettes": {
    "violet": {
      "name": "البنفسجي",
      "description": "لوحة الألوان الافتراضية لـ LUXIPANEL."
    },
    "ocean": {
      "name": "المحيط",
      "description": "أزرق احترافي وهادئ."
    },
    "emerald": {
      "name": "الزمرد",
      "description": "أخضر منعش وطبيعي."
    },
    "sunset": {
      "name": "الغروب",
      "description": "برتقالي وكهرماني دافئان."
    },
    "rose": {
      "name": "الوردي",
      "description": "وردي وأرجواني نابض بالحيوية."
    },
    "indigo": {
      "name": "النيلي",
      "description": "نيلي أنيق وعصري."
    },
    "aqua": {
      "name": "الأكوا",
      "description": "فيروزي وسماوي مضيء."
    },
    "graphite": {
      "name": "الجرافيت",
      "description": "محايد أحادي اللون ورصين."
    },
    "amber": {
      "name": "الكهرمان",
      "description": "ذهبي وعسلي دافئان."
    },
    "fuchsia": {
      "name": "الفوشيا",
      "description": "أرجواني وبنفسجي مكثف."
    },
    "lime": {
      "name": "الليمي",
      "description": "أخضر ليموني نابض بالطاقة."
    },
    "slate": {
      "name": "الأردوازي",
      "description": "رمادي مزرق احترافي."
    },
    "prisma": {
      "name": "موشور",
      "description": "يدمج ألوان جميع اللوحات في انتقال مستمر لا ينتهي.",
      "colors": "الألوان",
      "addColorButton": "إضافة لون",
      "addColorAria": "اختر لونًا وأضفه إلى تأثير بريزما",
      "addColorInputAria": "لون لإضافته إلى تأثير بريزما",
      "editColorAria": "تعديل اللون",
      "editColorInputAria": "تعديل قيمة اللون",
      "editColorHexAria": "القيمة السداسية العشرية للون",
      "removeColorAria": "إزالة اللون",
      "moveUpAria": "تحريك اللون للأعلى",
      "moveDownAria": "تحريك اللون للأسفل",
      "helpText": "أعد ترتيب القائمة بالأسهم. كل لون يحدد تسلسل التأثير."
    },
    "custom": {
      "name": "مخصص",
      "description": "اختر لونك الأساسي واضبط كثافته.",
      "baseColor": "اللون الأساسي",
      "baseColorAria": "اللون الأساسي المخصص",
      "hexAria": "قيمة ست عشرية للون الأساسي المخصص"
    },
    "luxisoft": {
      "description": "أزرق كحلي ونعناعي في الوضع الفاتح؛ وغرافيتي ونعناعي في الوضع الداكن.",
      "name": "Luxisoft"
    }
  },
  "managers": {
    "default": "مدير 1"
  },
  "git": {
    "errorFallback": "خطأ"
  }
} as const;

export default settings;
