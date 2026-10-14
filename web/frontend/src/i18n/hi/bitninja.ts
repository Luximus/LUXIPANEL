const bitninja = {
  "header": {
    "description": "कनेक्टेड सर्वर पर व्यापक सुरक्षा एजेंट (WAF, एंटी-DoS, मैलवेयर पहचान और IP प्रतिष्ठा)।",
    "statusChecking": "जाँच हो रही है…"
  },
  "sudo": {
    "label": "sudo पासवर्ड (आपके सत्र का पासफ्रेज़)",
    "placeholder": "केवल तब जब सर्वर sudo के लिए माँगे",
    "hint": "केवल इस क्रिया के लिए उपयोग किया जाता है और ब्राउज़र में कभी सहेजा नहीं जाता।"
  },
  "installCard": {
    "title": "BitNinja स्थापित नहीं है",
    "description": "इस सर्वर पर एजेंट इंस्टॉल करने के लिए अपने BitNinja खाते की license key दर्ज करें। आधिकारिक इंस्टॉलर (get.bitninja.io) डाउनलोड होकर sudo से चलाया जाएगा।",
    "licensePlaceholder": "License key (जैसे: ab12cd34-…)",
    "installButton": "BitNinja इंस्टॉल करें"
  },
  "stats": {
    "service": "सेवा",
    "license": "लाइसेंस",
    "version": "संस्करण"
  },
  "serviceControl": {
    "title": "सेवा नियंत्रण",
    "start": "प्रारंभ करें",
    "restart": "पुनः प्रारंभ करें",
    "stop": "रोकें"
  },
  "components": {
    "title": "सुरक्षा घटक",
    "checking": "जाँच हो रही है…",
    "noReported": "एजेंट ने कोई घटक रिपोर्ट नहीं किया।",
    "active": "सक्रिय",
    "inactive": "निष्क्रिय"
  },
  "updateLicense": {
    "title": "License key अपडेट करें",
    "placeholder": "नई license key",
    "applyButton": "लागू करें"
  },
  "toasts": {
    "sudoRequired": "sudo पासवर्ड दर्ज करें और पुनः प्रयास करें।",
    "sudoInvalid": "sudo पासवर्ड अमान्य है।",
    "actionFailed": "क्रिया विफल हुई। आउटपुट जांचें।",
    "installing": "BitNinja इंस्टॉल हो रहा है… इसमें कुछ मिनट लग सकते हैं।",
    "installed": "BitNinja इंस्टॉल हो गया।",
    "serviceAction": "सेवा: {action} ठीक।",
    "componentToggleEnabled": "{component}: सक्रिय।",
    "componentToggleDisabled": "{component}: निष्क्रिय।",
    "licenseApplied": "License key लागू हुई।"
  },
  "errors": {
    "unknown": "अज्ञात त्रुटि"
  },
  "status": {
    "notInstalled": "इंस्टॉल नहीं है",
    "running": "सक्रिय",
    "installedStopped": "इंस्टॉल (रुका हुआ)",
    "serviceRunning": "चल रहा है",
    "serviceStopped": "रुका हुआ",
    "licenseValid": "वैध",
    "licenseReview": "समीक्षा करें"
  },
  "validation": {
    "licenseKeyRequired": "License key दर्ज करें।",
    "newLicenseKeyRequired": "नई license key दर्ज करें।"
  },
  "settingsUi": {
    "settingsTitle": "BitNinja सेटिंग",
    "settingsButton": "सेटिंग",
    "settingsDescription": "सक्रिय सर्वर की निदान प्राथमिकताएँ।",
    "settingsSections": "BitNinja सेटिंग अनुभाग",
    "diagnostics": "निदान",
    "related": "संबंधित",
    "logSource": "लॉग चुने हुए सर्वर की BitNinja सेवा से पढ़ा जाता है।",
    "autoRefresh": "हर 30 सेकंड में स्थिति ताज़ा करें",
    "logLines": "लॉग पंक्तियाँ",
    "relatedModules": "संबंधित मॉड्यूल",
    "firewallAudit": "फ़ायरवॉल और ऑडिट",
    "credentials": "BitNinja क्रेडेंशियल"
  },
  "logsUi": {
    "loading": "लॉग लोड हो रहा है…",
    "empty": "कोई हालिया इवेंट नहीं है।",
    "loadError": "लॉग लोड नहीं हो सका।",
    "logsTitle": "हाल का लॉग",
    "logsDescription": "सक्रिय सर्वर पर सेवा की घटनाएँ।",
    "refreshLogs": "लॉग ताज़ा करें",
    "logsHint": "घटनाएँ लोड करने के लिए «लॉग ताज़ा करें» चुनें।"
  }
} as const;

export default bitninja;
