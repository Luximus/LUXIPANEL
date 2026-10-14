const webhooks = {
  "pageTitle": "Webhooks और API Keys",
  "tabs": {
    "webhooks": "Webhooks",
    "apiKeys": "API कुंजियाँ",
    "discovered": "पता लगाए गए"
  },
  "webhooksPanel": {
    "description": "HMAC हस्ताक्षर के साथ आउटगोइंग HTTP सूचनाएं",
    "btnNew": "नया webhook"
  },
  "apiKeysPanel": {
    "description": "स्थायी टोकन के साथ प्रोग्रामेटिक एक्सेस",
    "btnNew": "नई API key"
  },
  "newKeyReveal": {
    "message": "API Key बनाई गई — इसे अभी कॉपी करें, यह फिर नहीं दिखाई देगी",
    "btnCopy": "कॉपी करें"
  },
  "webhookDialog": {
    "placeholderUrl": "https://example.com/webhook",
    "title": "नया webhook",
    "labelUrl": "एंडपॉइंट URL",
    "labelEvents": "सुनने योग्य इवेंट",
    "labelEnabled": "Webhook सक्रिय",
    "btnCancel": "रद्द करें",
    "btnSave": "सहेजें"
  },
  "apiKeyDialog": {
    "placeholderName": "मेरा इंटीग्रेशन",
    "title": "नई API Key",
    "labelName": "वर्णनात्मक नाम",
    "labelExpires": "समाप्ति (वैकल्पिक)",
    "btnCancel": "रद्द करें",
    "btnCreate": "Key बनाएं"
  },
  "discovered": {
    "description": "सर्वर पर पता लगाए गए webhooks (Git, nginx, cron, systemd, कॉन्फ़िग फ़ाइलें और प्रोजेक्ट)",
    "btnRescan": "फिर से स्कैन करें",
    "scanning": "सर्वर स्कैन किया जा रहा है…",
    "empty": "सर्वर पर कोई webhook नहीं मिला",
    "cols": {
      "source": "स्रोत",
      "name": "नाम",
      "target": "लक्ष्य",
      "location": "स्थान",
      "estado": "स्थिति"
    },
    "filters": {
      "searchTarget": "लक्ष्य खोजें…",
      "source": "स्रोत"
    },
    "sources": {
      "sidecar": "पैनल",
      "git-hook": "Git hook",
      "nginx": "Nginx",
      "cron": "Cron",
      "systemd": "systemd",
      "config": "कॉन्फ़िग",
      "project": "प्रोजेक्ट"
    },
    "status": {
      "enabled": "सक्रिय",
      "disabled": "निष्क्रिय",
      "unknown": "—"
    },
    "actions": {
      "detail": "विवरण देखें",
      "delete": "हटाएं"
    },
    "detail": {
      "title": "पता लगाए गए webhook का विवरण",
      "source": "स्रोत",
      "target": "लक्ष्य",
      "location": "स्थान",
      "info": "जानकारी",
      "raw": "कॉन्फ़िगरेशन",
      "managedNote": "यह webhook पैनल द्वारा प्रबंधित है",
      "readonlyNote": "केवल पढ़ने के लिए: इसे संबंधित मॉड्यूल से प्रबंधित करें",
      "btnClose": "बंद करें"
    },
    "confirm": {
      "deleteTitle": "पता लगाया गया webhook हटाएं",
      "deleteBody": "\"{name}\" हटाएं? यह सर्वर पर फ़ाइल को बदल देगा।",
      "deleteBtn": "हां, हटाएं"
    },
    "toasts": {
      "deleted": "हटा दिया गया",
      "errorDeleting": "हटाया नहीं जा सका",
      "scanComplete": "स्कैन पूर्ण: {count}",
      "notManageable": "इसे संबंधित मॉड्यूल से प्रबंधित करें"
    }
  },
  "labels": {
    "statusFailing": "विफल हो रहा है",
    "statusActive": "सक्रिय",
    "statusPaused": "रुका हुआ",
    "newWebhookTitle": "नया webhook",
    "noExpiry": "कोई समाप्ति नहीं"
  },
  "confirm": {
    "rotateSecretBody": "इस webhook का secret बदलें? आपको रिसीवर अपडेट करना होगा।",
    "rotateSecretTitle": "Secret बदलें",
    "rotateSecretBtn": "हाँ, बदलें",
    "deleteWebhookBody": "यह webhook हटाएं?",
    "deleteWebhookTitle": "Webhook हटाएं",
    "revokeKeyBody": "API key \"{name}\" रद्द करें?",
    "revokeKeyTitle": "API key रद्द करें",
    "revokeKeyBtn": "हाँ, रद्द करें"
  },
  "toasts": {
    "secretRotated": "Secret बदला गया",
    "errorRotating": "बदलने में त्रुटि",
    "webhookDeleted": "Webhook हटाया गया",
    "errorDeleting": "हटाने में त्रुटि",
    "webhookUpdated": "Webhook अपडेट हुआ",
    "webhookCreated": "Webhook बनाया गया",
    "errorSaving": "सहेजने में त्रुटि",
    "keyRevoked": "Key रद्द की गई",
    "errorRevoking": "रद्द करने में त्रुटि",
    "copiedToClipboard": "क्लिपबोर्ड पर कॉपी हुआ",
    "errorCreatingKey": "Key बनाने में त्रुटि"
  },
  "categories": {
    "receiveData": "डेटा प्राप्त करें",
    "mailhook": "Mailhook",
    "response": "Webhook का जवाब",
    "soon": "जल्द आएगा",
    "soonDesc": "इस श्रेणी का कॉन्फ़िगरेशन और स्कैन बाद के चरण में परिभाषित किया जाएगा।"
  },
  "gateway": {
    "description": "पैनल द्वारा होस्ट किए गए endpoints जो इनकमिंग डेटा प्राप्त करते हैं (Make.com स्टाइल)। API key (x-make-apikey) से प्रमाणीकरण, IP प्रतिबंध और डेटा संरचना सत्यापन।",
    "btnNew": "नया webhook",
    "detectedTitle": "सर्वर पर पाए गए रिसीवर",
    "urlReveal": "Webhook URL — यहाँ अनुरोध भेजें",
    "cols": {
      "name": "नाम",
      "auth": "प्रमाणीकरण",
      "recibidos": "प्राप्त",
      "ultima": "अंतिम",
      "estado": "स्थिति",
      "estadoActive": "सक्रिय",
      "estadoPaused": "रुका हुआ"
    },
    "dialog": {
      "titleNew": "नया webhook बनाएं",
      "titleEdit": "Webhook संपादित करें",
      "name": "Webhook का नाम",
      "namePlaceholder": "मेरा webhook gateway",
      "nameHint": "1 से 128 वर्णों के बीच होना चाहिए।",
      "apiAuth": "API key प्रमाणीकरण",
      "apiAuthHint": "API key को x-make-apikey हेडर में भेजें। एक या अधिक जोड़ें; कोई भी मेल खाने पर एक्सेस मिलेगी।",
      "apiKeyName": "नाम",
      "apiKeyValue": "API key का मान",
      "apiKeyKeep": "(सहेजी गई — रखने के लिए खाली छोड़ें)",
      "addApiKey": "API key जोड़ें",
      "ipTitle": "IP प्रतिबंध",
      "ipHint": "अल्पविराम से अलग IP सूची। CIDR नोटेशन का उपयोग कर सकते हैं। खाली = कोई जाँच नहीं।",
      "dataStructure": "डेटा संरचना",
      "dataStructureHint": "आने वाले डेटा का सत्यापन। खाली = बिना सत्यापन के स्वीकार किया जाएगा।",
      "dsValidate": "डेटा संरचना सत्यापित करें",
      "dsStrict": "सख्त (अनिर्दिष्ट फ़ील्ड अस्वीकार करें)",
      "dsFieldName": "नाम",
      "dsFieldDesc": "विवरण",
      "dsFieldType": "प्रकार",
      "dsFieldDefault": "डिफ़ॉल्ट मान",
      "dsFieldRequired": "आवश्यक",
      "dsFieldMultiline": "बहु-पंक्ति",
      "addItem": "फ़ील्ड जोड़ें",
      "getHeaders": "अनुरोध हेडर प्राप्त करें",
      "getHeadersHint": "हेडर बॉडी में जोड़े जाएंगे।",
      "getMethod": "HTTP मेथड प्राप्त करें",
      "getMethodHint": "मेथड (वर्ब) बॉडी में जोड़ा जाएगा।",
      "jsonPassthrough": "JSON को पाठ के रूप में सहेजें",
      "jsonPassthroughHint": "यदि सक्रिय हो, तो JSON payload स्ट्रिंग के रूप में सहेजा जाता है।",
      "enabled": "Webhook सक्रिय",
      "advanced": "उन्नत सेटिंग्स",
      "btnCancel": "रद्द करें",
      "btnSave": "सहेजें"
    },
    "payloads": {
      "title": "प्राप्त Payloads",
      "empty": "अभी तक कोई payload प्राप्त नहीं हुआ।",
      "btnClose": "बंद करें"
    },
    "confirm": {
      "deleteTitle": "Webhook हटाएं",
      "deleteBody": "Webhook \"{name}\" हटाएं? सहेजे गए payloads मिट जाएंगे।",
      "deleteBtn": "हाँ, हटाएं"
    },
    "toasts": {
      "created": "Webhook बनाया गया",
      "updated": "Webhook अपडेट किया गया",
      "deleted": "Webhook हटाया गया",
      "copied": "URL कॉपी की गई",
      "error": "सहेजने में त्रुटि"
    }
  },
  "table": {
    "gateway": {
      "columns": {
        "name": "नाम",
        "auth": "प्रमाणीकरण",
        "recibidos": "प्राप्त",
        "ultima": "अंतिम",
        "estado": "स्थिति"
      },
      "filters": {
        "searchName": "नाम खोजें…",
        "estado": "स्थिति"
      },
      "rowActions": {
        "copy": "URL कॉपी करें",
        "payloads": "पेलोड देखें",
        "edit": "संपादित करें",
        "delete": "हटाएं"
      },
      "options": {
        "statusActive": "सक्रिय",
        "statusPaused": "रुका हुआ"
      }
    },
    "webhooks": {
      "columns": {
        "url": "URL",
        "eventos": "इवेंट",
        "estado": "स्थिति"
      },
      "filters": {
        "searchUrl": "URL खोजें…",
        "estado": "स्थिति"
      },
      "rowActions": {
        "regenerate": "Secret बदलें",
        "delete": "हटाएं"
      },
      "options": {
        "statusActive": "सक्रिय",
        "statusPaused": "रुका हुआ",
        "statusFailing": "विफल हो रहा है"
      }
    },
    "apiKeys": {
      "columns": {
        "name": "नाम",
        "prefix": "उपसर्ग",
        "creada": "बनाया गया",
        "expira": "समाप्ति"
      },
      "filters": {
        "searchName": "नाम खोजें…"
      },
      "rowActions": {
        "revoke": "रद्द करें"
      }
    },
    "discovered": {
      "columns": {
        "origen": "स्रोत",
        "name": "नाम",
        "target": "लक्ष्य",
        "location": "स्थान",
        "estado": "स्थिति"
      },
      "filters": {
        "searchTarget": "लक्ष्य खोजें…",
        "origen": "स्रोत"
      },
      "rowActions": {
        "detail": "विवरण देखें",
        "delete": "हटाएं"
      },
      "options": {
        "panel": "पैनल",
        "gitHook": "Git hook",
        "nginx": "Nginx",
        "cron": "Cron",
        "systemd": "systemd",
        "config": "कॉन्फ़िग",
        "proyecto": "प्रोजेक्ट"
      }
    }
  },
  "runtime": {
    "testDelivered": "परीक्षण सफलतापूर्वक डिलीवर हुआ।",
    "testFailed": "परीक्षण डिलीवरी विफल रही।",
    "loadingDeliveries": "डिलीवरी लोड हो रही हैं…",
    "loadDeliveriesError": "डिलीवरी लोड नहीं हो सकीं।",
    "noDeliveries": "अभी तक कोई डिलीवरी दर्ज नहीं हुई है।",
    "delivered": "डिलीवर हुआ",
    "failed": "विफल",
    "attempts": "प्रयास: {count}",
    "selectEvent": "कम से कम एक इवेंट चुनें।"
  },
  "settingsUi": {
    "title": "Webhooks सेटिंग",
    "description": "Webhooks तालिकाओं का पृष्ठांकन और दिखाई देने वाली कार्रवाइयाँ।",
    "gateway": "गेटवे",
    "webhooks": "Webhooks",
    "signingSecret": "हस्ताक्षर का गुप्त कोड · अभी कॉपी करें",
    "signingSecretHint": "यह केवल एक बार दिखता है। X-Luxipanel-Signature की जाँच के लिए रिसीवर में इसे सेट करें।",
    "recentDeliveries": "हाल की डिलीवरी"
  }
} as const;

export default webhooks;
