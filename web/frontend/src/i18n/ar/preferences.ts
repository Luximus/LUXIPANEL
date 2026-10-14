const preferences = {
  "pageTitle": "التفضيلات",
  "header": {
    "title": "التفضيلات",
    "subtitle": "إدارة ملفك الشخصي وأمان الحساب"
  },
  "placeholders": {
    "phone": "+966 50 000 0000"
  },
  "profile": {
    "sectionTitle": "الملف الشخصي",
    "labelDisplayName": "اسم العرض",
    "labelPhone": "الهاتف",
    "labelUsername": "اسم المستخدم",
    "labelRole": "الدور",
    "btnSave": "حفظ الملف الشخصي"
  },
  "password": {
    "sectionTitle": "تغيير كلمة المرور",
    "disabledNotice": "تغيير كلمة المرور معطّل في LuxiPanel. يجب التواصل مع مدير الخادم."
  },
  "passkeys": {
    "sectionTitle": "مفاتيح المرور (Passkeys)",
    "sectionSubtitle": "المصادقة البيومترية / FIDO2",
    "btnAdd": "إضافة مفتاح مرور",
    "emptyState": "لا توجد مفاتيح مرور مسجّلة بعد"
  },
  "recoveryCodes": {
    "sectionTitle": "رموز الاسترداد",
    "sectionSubtitle": "استخدمها إذا فقدت الوصول إلى جهازك",
    "btnRegenerate": "إعادة توليد",
    "loading": "جارٍ التحميل...",
    "warning": "احفظ هذه الرموز في مكان آمن. تظهر مرة واحدة فقط.",
    "btnCopy": "نسخ الكل",
    "btnPrint": "طباعة"
  },
  "twoFactor": {
    "sectionTitle": "المصادقة الثنائية (2FA)",
    "sectionSubtitle": "احمِ حسابك برمز إضافي",
    "badgeDisabled": "معطَّل",
    "enabledDescription": "حسابك محمي بالمصادقة الثنائية. ستحتاج إلى رمز من تطبيق المصادقة في كل مرة تسجّل فيها الدخول.",
    "btnEnable": "تفعيل 2FA",
    "btnDisable": "تعطيل 2FA"
  },
  "auditLog": {
    "sectionTitle": "النشاط الأخير",
    "emptyState": "لا يوجد نشاط مسجَّل"
  },
  "dialogRegenCodes": {
    "title": "إعادة إنشاء الرموز؟",
    "body": "ستُبطَل الرموز السابقة. لا يمكن التراجع عن هذا الإجراء.",
    "btnCancel": "إلغاء",
    "btnConfirm": "إعادة توليد"
  },
  "dialogSetup2fa": {
    "title": "تفعيل المصادقة الثنائية",
    "subtitle": "امسح رمز QR هذا بتطبيق المصادقة (Google Authenticator أو Authy أو غيره)",
    "manualEntryLabel": "إذا تعذَّر المسح الضوئي، أدخل يدوياً:",
    "titleCopySecret": "نسخ",
    "verifyCodeLabel": "أدخل الرمز المكوّن من 6 أرقام للتأكيد:",
    "btnCancel": "إلغاء",
    "btnConfirm": "تفعيل 2FA"
  },
  "dialogDisable2fa": {
    "title": "تعطيل 2FA؟",
    "body": "سيصبح حسابك أقل أماناً. يمكنك إعادة تفعيله في أي وقت.",
    "btnCancel": "إلغاء",
    "btnConfirm": "تعطيل 2FA"
  },
  "toasts": {
    "profileUpdated": "تم تحديث الملف الشخصي",
    "errorUpdate": "خطأ في التحديث",
    "passwordUpdated": "تم تحديث كلمة المرور",
    "passkeyDeleted": "تم حذف الـ Passkey",
    "error": "خطأ",
    "registrationCancelled": "تم إلغاء التسجيل",
    "passkeyRegistered": "تم تسجيل الـ Passkey بنجاح",
    "registrationCancelledByUser": "ألغى المستخدم التسجيل",
    "codesCopied": "تم نسخ الرموز إلى الحافظة",
    "secretCopied": "تم نسخ الـ secret إلى الحافظة",
    "twoFaActivated": "تم تفعيل 2FA بنجاح",
    "twoFaDeactivated": "تم تعطيل 2FA"
  },
  "errors": {
    "passwordMismatch": "كلمتا المرور غير متطابقتين",
    "passwordTooShort": "يجب أن تتكوّن كلمة المرور من 8 أحرف على الأقل",
    "passwordChangeError": "خطأ في تغيير كلمة المرور",
    "passkeyNotSupported": "متصفحك لا يدعم Passkey. استخدم Chrome أو Firefox أو Safari أو Edge حديثاً.",
    "passkeyInitFailed": "تعذّر بدء التسجيل",
    "passkeyFinishError": "خطأ في إتمام التسجيل",
    "generateCodesError": "خطأ في توليد الرموز",
    "twoFaSetupError": "خطأ في بدء إعداد 2FA",
    "enterSixDigits": "أدخل الرمز المكوّن من 6 أرقام",
    "invalidCode": "رمز غير صالح",
    "twoFaDeactivateError": "خطأ في تعطيل 2FA",
    "genericWithMessage": "خطأ: {message}"
  },
  "labels": {
    "passkeyRegistered": "مسجَّل {date}",
    "hasActiveCodes": "لديك رموز استرداد نشطة.",
    "noActiveCodes": "لا توجد رموز استرداد نشطة.",
    "notAvailable": "غير متاح",
    "codesGenerated": "تم توليد {count} رمز. احتفظ بها في مكان آمن.",
    "printTitle": "رموز الاسترداد — LUXIPANEL",
    "printWarning": "احتفظ بهذه الرموز في مكان آمن. كل رمز يُستخدم مرة واحدة فقط.",
    "twoFaBadgeEnabled": "مُفعَّل",
    "twoFaBadgeDisabled": "مُعطَّل"
  },
  "confirm": {
    "deletePasskey": "حذف هذه الـ Passkey؟",
    "deletePasskeyTitle": "حذف الـ Passkey"
  },
  "actions": {
    "login": "تسجيل الدخول",
    "logout": "تسجيل الخروج",
    "passwordChange": "تغيير كلمة المرور",
    "passkeyRegister": "تسجيل Passkey",
    "passkeyDelete": "حذف Passkey",
    "recoveryCodeUsed": "استخدام رمز الاسترداد",
    "profileUpdate": "تحديث الملف الشخصي",
    "twoFaEnabled": "تفعيل 2FA",
    "twoFaDisabled": "تعطيل 2FA",
    "activateTwoFa": "تفعيل 2FA"
  }
} as const;

export default preferences;
