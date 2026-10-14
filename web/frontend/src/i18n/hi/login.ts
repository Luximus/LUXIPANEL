const login = {
  "pageTitle": "लॉग इन करें",
  "panelSubtitle": "प्रशासन पैनल",
  "authError": "प्रमाणीकरण त्रुटि",
  "forgotPassword": "मैं अपना पासवर्ड भूल गया",
  "forgotHint": "अपना ईमेल दर्ज करें और हम आपको पासवर्ड बदलने के लिए एक लिंक भेजेंगे।",
  "backToLogin": "लॉगिन पर वापस जाएं",
  "recoverLinkSent": "यदि ईमेल मौजूद है, तो हमने एक रिकवरी लिंक भेज दिया है।",
  "recoverLinkError": "रिकवरी लिंक नहीं भेजा जा सका।",
  "languageLabel": "भाषा",
  "hostLabelFallback": "यह पैनल",
  "tabs": {
    "password": "पासवर्ड",
    "passkey": "Passkey",
    "recovery": "रिकवरी"
  },
  "labels": {
    "user": "उपयोगकर्ता",
    "password": "पासवर्ड",
    "sshPassphrase": "SSH कुंजी की passphrase",
    "remember": "मुझे याद रखें",
    "email": "ईमेल पता",
    "recoveryCode": "रिकवरी कोड",
    "code6Digits": "6 अंकों का कोड"
  },
  "placeholders": {
    "user": "admin",
    "email": "usuario@dominio.com",
    "password": "********",
    "sshPassphrase": "आपकी SSH कुंजी का Passphrase",
    "recoveryCode": "XXXX-XXXX-XXXX",
    "totp": "000000"
  },
  "text": {
    "biometricAuth": "बायोमेट्रिक प्रमाणीकरण",
    "biometricHelp": "Face ID, फिंगरप्रिंट या सुरक्षा कुंजी का उपयोग करें",
    "usePasskey": "Passkey का उपयोग करें",
    "signIn": "लॉग इन करें",
    "sendRecoveryLink": "रिकवरी लिंक भेजें",
    "recoveryWarning": "यदि आपने अपने डिवाइस तक पहुंच खो दी है तो एक बार उपयोग होने वाला रिकवरी कोड उपयोग करें।",
    "verifyCode": "कोड सत्यापित करें",
    "twoFactorTitle": "दो-चरणीय सत्यापन",
    "twoFactorHelp": "अपने प्रमाणीकरण ऐप का कोड दर्ज करें",
    "verify": "सत्यापित करें",
    "footer": "LuxiPanel v2.0 - सुरक्षित मेल प्रशासन"
  },
  "errors": {
    "captchaRequired": "कृपया hCaptcha चुनौती पूरी करें।",
    "enterEmail": "एक ईमेल पता दर्ज करें",
    "browserNoPasskey": "आपका ब्राउज़र Passkey का समर्थन नहीं करता। हालिया Chrome, Firefox, Safari या Edge का उपयोग करें।",
    "passkeyOptionsFailed": "प्रमाणीकरण विकल्प प्राप्त नहीं किए जा सके",
    "passkeyCanceled": "प्रमाणीकरण रद्द किया गया",
    "passkeyCanceledByUser": "उपयोगकर्ता द्वारा प्रमाणीकरण रद्द किया गया",
    "passkeyError": "passkey त्रुटि",
    "enterUserRecoveryCode": "उपयोगकर्ता और रिकवरी कोड दर्ज करें",
    "enterTotp6Digits": "कोड के 6 अंक दर्ज करें",
    "invalidTotpCode": "अमान्य 2FA कोड"
  },
  "status": {
    "passkeyInit": "प्रमाणीकरण शुरू हो रहा है...",
    "passkeyWaiting": "आपकी passkey की प्रतीक्षा है...",
    "passkeyVerifying": "सत्यापित किया जा रहा है..."
  },
  "authErrors": {
    "AUTH_ERROR": "प्रमाणीकरण त्रुटि।",
    "NO_SSH_KEY": "इस पैनल में इस उपयोगकर्ता से कोई SSH कुंजी संबद्ध नहीं है।",
    "PANEL_UNRESOLVED": "एक्सेस पैनल निर्धारित नहीं किया जा सका।",
    "PANEL_NO_IP": "पैनल में कोई IP कॉन्फ़िगर नहीं है।",
    "USER_PROVISION_FAILED": "पैनल में उपयोगकर्ता को प्रावधानित नहीं किया जा सका।",
    "ACCOUNT_DISABLED": "खाता अक्षम है।",
    "ACCOUNT_NOT_FOUND": "खाता नहीं मिला या अक्षम है।",
    "USER_NOT_FOUND": "उपयोगकर्ता नहीं मिला।",
    "TWO_FA_REQUIRED": "इस खाते के लिए 2FA आवश्यक है। लॉगिन करने से पहले इसे सेटिंग्स › सुरक्षा से कॉन्फ़िगर करें।",
    "INVALID_PASSPHRASE": "गलत passphrase।",
    "PASSPHRASE_REQUIRED": "आपको उपयोगकर्ता की passphrase दर्ज करनी होगी।",
    "PASSPHRASE_VERIFY_FAILED": "सर्वर के विरुद्ध पासवर्ड सत्यापित नहीं किया जा सका।",
    "SERVER_SSH_KEY_MISSING": "सर्वर की SSH कुंजी कॉन्फ़िगर नहीं है।",
    "PANEL_SSH_KEY_REJECTED": "पैनल की SSH कुंजी सर्वर द्वारा स्वीकार नहीं की गई।",
    "SSH_CONNECT_FAILED": "SSH सर्वर से कनेक्ट नहीं किया जा सका।",
    "SSH_CONNECTION_CLOSED": "SSH कनेक्शन अप्रत्याशित रूप से बंद हो गया।",
    "PASSWORD_LOGIN_DISABLED": "पासवर्ड द्वारा लॉगिन अक्षम है।",
    "PASSKEY_LOGIN_DISABLED": "passkey द्वारा लॉगिन अक्षम है।",
    "RECOVERY_LOGIN_DISABLED": "रिकवरी कोड द्वारा लॉगिन अक्षम है।",
    "PASSKEY_INVALID": "अमान्य passkey।",
    "INVALID_AUTH_RESPONSE": "अमान्य प्रमाणीकरण प्रतिक्रिया।",
    "INVALID_TOTP": "अमान्य TOTP कोड।",
    "CAPTCHA_REQUIRED": "captcha सत्यापन आवश्यक है।",
    "CAPTCHA_FAILED": "captcha सत्यापन विफल रहा।"
  }
} as const;

export default login;
