const login = {
  "pageTitle": "تسجيل الدخول",
  "panelSubtitle": "لوحة الإدارة",
  "authError": "خطأ في المصادقة",
  "forgotPassword": "نسيت كلمة المرور",
  "forgotHint": "أدخل بريدك الإلكتروني وسنرسل لك رابطاً لتغيير كلمة مرورك.",
  "backToLogin": "العودة إلى تسجيل الدخول",
  "recoverLinkSent": "إذا كان البريد موجوداً، فقد أرسلنا رابط استرجاع.",
  "recoverLinkError": "تعذّر إرسال رابط الاسترجاع.",
  "languageLabel": "اللغة",
  "hostLabelFallback": "هذه اللوحة",
  "tabs": {
    "password": "كلمة المرور",
    "passkey": "Passkey",
    "recovery": "الاسترجاع"
  },
  "labels": {
    "user": "المستخدم",
    "password": "كلمة المرور",
    "sshPassphrase": "عبارة مرور مفتاح SSH",
    "remember": "تذكّرني",
    "email": "البريد الإلكتروني",
    "recoveryCode": "رمز الاسترجاع",
    "code6Digits": "رمز من 6 أرقام"
  },
  "placeholders": {
    "user": "admin",
    "email": "user@example.com",
    "password": "********",
    "sshPassphrase": "عبارة مرور مفتاح SSH الخاص بك",
    "recoveryCode": "XXXX-XXXX-XXXX",
    "totp": "000000"
  },
  "text": {
    "biometricAuth": "المصادقة البيومترية",
    "biometricHelp": "استخدم Face ID أو بصمة الإصبع أو مفتاح الأمان",
    "usePasskey": "استخدام Passkey",
    "signIn": "تسجيل الدخول",
    "sendRecoveryLink": "إرسال رابط الاسترجاع",
    "recoveryWarning": "استخدم رمز استرجاع للاستعمال مرة واحدة إذا فقدت الوصول إلى جهازك.",
    "verifyCode": "التحقق من الرمز",
    "twoFactorTitle": "التحقق بخطوتين",
    "twoFactorHelp": "أدخل الرمز من تطبيق المصادقة الخاص بك",
    "verify": "التحقق",
    "footer": "LuxiPanel v2.0 - إدارة البريد الآمنة"
  },
  "errors": {
    "captchaRequired": "يرجى إكمال تحدي hCaptcha.",
    "enterEmail": "أدخل عنوان بريد إلكتروني",
    "browserNoPasskey": "متصفحك لا يدعم Passkey. استخدم Chrome أو Firefox أو Safari أو Edge حديث.",
    "passkeyOptionsFailed": "تعذّر الحصول على خيارات المصادقة",
    "passkeyCanceled": "تم إلغاء المصادقة",
    "passkeyCanceledByUser": "تم إلغاء المصادقة من قِبل المستخدم",
    "passkeyError": "خطأ في Passkey",
    "enterUserRecoveryCode": "أدخل اسم المستخدم ورمز الاسترجاع",
    "enterTotp6Digits": "أدخل أرقام الرمز الستة",
    "invalidTotpCode": "رمز 2FA غير صالح"
  },
  "status": {
    "passkeyInit": "جارٍ بدء المصادقة...",
    "passkeyWaiting": "في انتظار Passkey الخاص بك...",
    "passkeyVerifying": "جارٍ التحقق..."
  },
  "authErrors": {
    "AUTH_ERROR": "خطأ في المصادقة.",
    "NO_SSH_KEY": "لا يوجد مفتاح SSH مرتبط بهذا المستخدم في هذه اللوحة.",
    "PANEL_UNRESOLVED": "تعذّر تحديد لوحة الوصول.",
    "PANEL_NO_IP": "اللوحة لا تملك عنوان IP مُعدّاً.",
    "USER_PROVISION_FAILED": "تعذّر تجهيز المستخدم في اللوحة.",
    "ACCOUNT_DISABLED": "الحساب معطّل.",
    "ACCOUNT_NOT_FOUND": "الحساب غير موجود أو معطّل.",
    "USER_NOT_FOUND": "المستخدم غير موجود.",
    "TWO_FA_REQUIRED": "يتطلب هذا الحساب المصادقة الثنائية 2FA. قم بإعدادها من الإعدادات › الأمان قبل تسجيل الدخول.",
    "INVALID_PASSPHRASE": "عبارة المرور غير صحيحة.",
    "PASSPHRASE_REQUIRED": "يجب إدخال عبارة مرور المستخدم.",
    "PASSPHRASE_VERIFY_FAILED": "تعذّر التحقق من كلمة المرور مع الخادم.",
    "SERVER_SSH_KEY_MISSING": "مفتاح SSH الخاص بالخادم غير مُعدّ.",
    "PANEL_SSH_KEY_REJECTED": "مفتاح SSH الخاص باللوحة غير مقبول من الخادم.",
    "SSH_CONNECT_FAILED": "تعذّر الاتصال بخادم SSH.",
    "SSH_CONNECTION_CLOSED": "أُغلق اتصال SSH بشكل غير متوقع.",
    "PASSWORD_LOGIN_DISABLED": "تسجيل الدخول بكلمة المرور معطّل.",
    "PASSKEY_LOGIN_DISABLED": "تسجيل الدخول عبر Passkey معطّل.",
    "RECOVERY_LOGIN_DISABLED": "تسجيل الدخول عبر رمز الاسترجاع معطّل.",
    "PASSKEY_INVALID": "Passkey غير صالح.",
    "INVALID_AUTH_RESPONSE": "استجابة المصادقة غير صالحة.",
    "INVALID_TOTP": "رمز TOTP غير صالح.",
    "CAPTCHA_REQUIRED": "مطلوب التحقق عبر captcha.",
    "CAPTCHA_FAILED": "فشل التحقق عبر captcha."
  }
} as const;

export default login;
