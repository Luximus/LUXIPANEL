const hosting = {
  "pageTitle": "साझा होस्टिंग",
  "pageSubtitle": "अपने क्लाइंट के होस्टिंग अकाउंट प्रबंधित करें · WHM-style multi-tenant",
  "btnNewAccount": "नया खाता",
  "options": {
    "planBasic": "बेसिक",
    "planPro": "प्रो",
    "planBusiness": "बिज़नेस",
    "planCustom": "कस्टम"
  },
  "stats": {
    "total": "कुल खाते",
    "active": "सक्रिय",
    "suspended": "निलंबित",
    "terminated": "समाप्त",
    "title": "{username} का उपयोग",
    "disk": "डिस्क (MB)",
    "domains": "डोमेन",
    "emails": "ईमेल खाते",
    "databases": "डेटाबेस",
    "subusers": "उप-उपयोगकर्ता",
    "bandwidth": "बैंडविड्थ (MB)",
    "percentUsed": "% उपयोग",
    "method": "मापन विधि",
    "methodDu": "du अनुमान (best-effort)",
    "methodQuotaTools": "सिस्टम कोटा (quota-tools)"
  },
  "tableTitle": "खाते",
  "modal": {
    "titleNew": "नया होस्टिंग खाता",
    "tabs": {
      "account": "खाता",
      "resources": "संसाधन",
      "security": "मॉड्यूल और सुरक्षा"
    },
    "labelUsername": "उपयोगकर्ता *",
    "labelPassword": "पासवर्ड *",
    "labelName": "नाम",
    "labelEmail": "Email",
    "labelPlan": "Plan",
    "resourcesTitle": "संसाधन सीमाएँ",
    "labelDisk": "डिस्क (MB)",
    "labelBandwidth": "बैंडविड्थ (MB)",
    "labelDomains": "डोमेन",
    "labelEmails": "Email खाते",
    "labelNotes": "आंतरिक नोट्स",
    "btnCancel": "रद्द करें",
    "btnCreate": "खाता बनाएं",
    "hintUsername": "केवल लोअरकेस, संख्याएँ, - और _",
    "phUsername": "exampleclient",
    "phPassword": "न्यूनतम 8 वर्ण",
    "phName": "कंपनी प्राइवेट लिमिटेड",
    "phEmail": "admin@empresa.com",
    "phNotes": "वैकल्पिक टिप्पणियाँ…",
    "labelStatus": "स्थिति",
    "labelTenantGroup": "टेनेंट समूह",
    "labelHomeRoot": "रूट फ़ोल्डर (home)",
    "hintTenantGroup": "खाते का समर्पित Linux समूह (केवल पढ़ने योग्य).",
    "hintHomeRoot": "VPS पर टेनेंट की रूट (केवल पढ़ने योग्य).",
    "labelDiskQuotaMb": "डिस्क कोटा (MB)",
    "labelBandwidthQuotaMb": "बैंडविड्थ कोटा (MB)",
    "labelMaxDomains": "अधिकतम डोमेन",
    "labelMaxEmailAccounts": "अधिकतम ईमेल खाते",
    "labelMaxDatabases": "अधिकतम डेटाबेस",
    "labelMaxSubUsers": "अधिकतम उप-उपयोगकर्ता",
    "labelAllowedModules": "अनुमत मॉड्यूल",
    "labelJailEnabled": "शेल अलग करें (chroot)",
    "hintJailEnabled": "इस खाते के टर्मिनल/SSH को उसके फ़ोल्डर तक सीमित करता है (chroot जेल).",
    "modulesLoading": "मॉड्यूल लोड हो रहे हैं…",
    "labelExpiresAt": "समाप्ति तिथि",
    "hintExpiresAt": "बिना समाप्ति के खाली छोड़ें",
    "labelModules": "अनुमत मॉड्यूल",
    "hintModules": "वे पैनल मॉड्यूल परिभाषित करें जिन तक इस क्लाइंट की पहुँच होगी।",
    "labelDatabases": "डेटाबेस",
    "labelSubUsers": "उप-उपयोगकर्ता",
    "labelJail": "Shell अलग करें (chroot)",
    "hintJail": "इस खाते की Terminal/SSH को उसके फ़ोल्डर तक सीमित करता है (chroot जेल)।",
    "titleEdit": "संपादन: {username}"
  },
  "pwdModal": {
    "title": "पासवर्ड बदलें",
    "labelNew": "नया पासवर्ड",
    "phPassword": "न्यूनतम 8 वर्ण",
    "btnCancel": "रद्द करें",
    "btnChange": "बदलें"
  },
  "apiPageTitle": "होस्टिंग API दस्तावेज़",
  "apiSubtitle": "साझा होस्टिंग अकाउंट का स्वचालित प्रबंधन",
  "apiIntro": "Reseller API आपको किसी भी बाहरी सिस्टम से होस्टिंग अकाउंट बनाने, अपडेट करने, निलंबित करने और हटाने को स्वचालित करने की सुविधा देता है — आपका खुद का बिलिंग प्लेटफ़ॉर्म, WHMCS, Bash स्क्रिप्ट, Zapier इंटीग्रेशन आदि। यह किसी भी ऐसी भाषा या टूल के साथ संगत है जो HTTP अनुरोध कर सकती है।",
  "toc": {
    "label": "सामग्री",
    "items": [
      "1. प्रमाणीकरण",
      "2. अलगाव और सुरक्षा",
      "3. उपलब्ध Endpoints",
      "4. खाता बनाएं",
      "5. खाते सूचीबद्ध करें",
      "6. खाता प्राप्त करें",
      "7. खाता अपडेट करें",
      "8. निलंबित करें / पुनः सक्रिय करें",
      "9. पासवर्ड बदलें",
      "10. खाता आँकड़े",
      "11. खाता हटाएं",
      "12. होस्टिंग खाते का लॉगिन",
      "13. त्रुटि कोड",
      "14. पूर्ण उदाहरण"
    ]
  },
  "auth": {
    "title": "प्रमाणीकरण",
    "intro": "Reseller API के सभी endpoints दो प्रमाणीकरण विधियाँ स्वीकार करते हैं:",
    "apiKeyTitle": "API Key (स्वचालन के लिए अनुशंसित)",
    "apiKeyDesc": "Panel → Webhooks → API Keys से एक API key बनाएं। इसे Authorization header में भेजें:",
    "sessionTitle": "एडमिन सेशन (पैनल से)",
    "sessionDesc": "यदि आप LUXIPANEL से ही अनुरोध कर रहे हैं (उदाहरण के लिए, ब्राउज़र में JavaScript से), तो आपकी एडमिन सेशन कुकी स्वचालित रूप से स्वीकार की जाती है।",
    "warningTitle": "महत्वपूर्ण:",
    "warningText": "अपनी API key को क्लाइंट-साइड कोड (ब्राउज़र में JavaScript, मोबाइल ऐप आदि) में कभी उजागर न करें। इसे केवल सर्वर या निजी वातावरण से उपयोग करें।"
  },
  "isolation": {
    "title": "आइसोलेशन और सुरक्षा",
    "intro": "प्रत्येक होस्टिंग अकाउंट एक पूरी तरह से अलग-थलग वातावरण है। यह सुनिश्चित करता है कि कोई भी क्लाइंट दूसरे के संसाधन न देख सके और न ही बदल सके, चाहे वह वेब पैनल, API, SSH कंसोल या किसी अन्य माध्यम से प्रयास करे।",
    "features": [
      {
        "title": "पृथक डेटा",
        "desc": "मेलबॉक्स, डोमेन, DNS, SSL और बैकअप प्रत्येक खाते के tenant_id से जुड़े होते हैं। SQL क्वेरीज़ कभी टेनेंट्स की सीमा पार नहीं करतीं।"
      },
      {
        "title": "फ़ाइल सिस्टम",
        "desc": "प्रत्येक खाते की अपनी होम डायरेक्टरी होती है (/home/username)। फ़ाइल एक्सप्लोरर और कंसोल उसी डायरेक्टरी तक सीमित रहते हैं।"
      },
      {
        "title": "स्वतंत्र सत्र",
        "desc": "किसी होस्टिंग खाते के JWT में उसका tenantId शामिल होता है। बैकएंड किसी भी ऐसे अनुरोध को अस्वीकार कर देता है जो उस स्कोप के बाहर संसाधनों तक पहुँचने का प्रयास करता है।"
      }
    ]
  },
  "endpoints": {
    "title": "उपलब्ध एंडपॉइंट",
    "colMethod": "विधि",
    "colPath": "पथ",
    "colDesc": "विवरण",
    "colAuth": "प्रमाणीकरण",
    "rows": [
      [
        "POST",
        "/api/hosting/accounts",
        "होस्टिंग खाता बनाएँ",
        "एडमिन / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts",
        "खाते सूचीबद्ध करें (पृष्ठांकित)",
        "एडमिन / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts/:id",
        "एकल खाता प्राप्त करें",
        "एडमिन / API Key"
      ],
      [
        "PUT",
        "/api/hosting/accounts/:id",
        "खाता अपडेट करें",
        "एडमिन / API Key"
      ],
      [
        "DELETE",
        "/api/hosting/accounts/:id",
        "खाता और उसका सारा डेटा हटाएँ",
        "एडमिन / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/suspend",
        "खाता निलंबित करें",
        "एडमिन / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/unsuspend",
        "निलंबित खाता पुनः सक्रिय करें",
        "एडमिन / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/change-password",
        "पासवर्ड बदलें",
        "एडमिन / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts/:id/stats",
        "उपयोग आँकड़े",
        "एडमिन / API Key"
      ],
      [
        "POST",
        "/api/hosting/auth/login",
        "होस्टिंग खाता लॉगिन",
        "सार्वजनिक"
      ],
      [
        "POST",
        "/api/hosting/auth/logout",
        "होस्टिंग लॉगआउट",
        "होस्टिंग सत्र"
      ]
    ]
  },
  "create": {
    "title": "खाता बनाएं",
    "labelBody": "Body (JSON)",
    "labelResp": "प्रतिक्रिया 201"
  },
  "list": {
    "title": "खाते सूचीबद्ध करें",
    "labelParams": "क्वेरी पैरामीटर",
    "colParam": "पैरामीटर",
    "colType": "प्रकार",
    "colDefault": "डिफ़ॉल्ट",
    "colDesc": "विवरण",
    "labelResp": "प्रतिक्रिया 200",
    "params": [
      [
        "page",
        "integer",
        "1",
        "वर्तमान पृष्ठ"
      ],
      [
        "limit",
        "integer",
        "20",
        "प्रति पृष्ठ परिणाम (अधिकतम 100)"
      ],
      [
        "search",
        "string",
        "—",
        "username, displayName, email में खोजें"
      ],
      [
        "status",
        "string",
        "—",
        "active | suspended | terminated"
      ]
    ]
  },
  "compactEndpoints": [
    {
      "id": "get",
      "num": "6",
      "title": "खाता प्राप्त करें",
      "method": "GET",
      "path": "/api/hosting/accounts/:id",
      "note": "passwordHash फ़ील्ड के बिना खाता ऑब्जेक्ट लौटाता है।"
    },
    {
      "id": "update",
      "num": "7",
      "title": "खाता अपडेट करें",
      "method": "PUT",
      "path": "/api/hosting/accounts/:id",
      "note": "create के समान फ़ील्ड स्वीकार करता है (username और password को छोड़कर)। केवल भेजे गए फ़ील्ड ही अपडेट होते हैं।"
    },
    {
      "id": "suspend",
      "num": "8",
      "title": "निलंबित करें / पुनः सक्रिय करें",
      "method": "POST",
      "path": "/api/hosting/accounts/:id/suspend  |  /unsuspend",
      "note": "निलंबित करने से क्लाइंट की पहुँच तुरंत अवरुद्ध हो जाती है। Unsuspend स्थिति को वापस 'active' पर पुनर्स्थापित करता है। किसी body की आवश्यकता नहीं।"
    },
    {
      "id": "password",
      "num": "9",
      "title": "पासवर्ड बदलें",
      "method": "POST",
      "path": "/api/hosting/accounts/:id/change-password",
      "note": "Body: {\"password\": \"NewPass123!\"} — न्यूनतम 8 वर्ण।"
    },
    {
      "id": "stats",
      "num": "10",
      "title": "उपयोग आँकड़े",
      "method": "GET",
      "path": "/api/hosting/accounts/:id/stats",
      "note": "कॉन्फ़िगर किए गए कोटा और डिस्क, बैंडविड्थ, सक्रिय डोमेन तथा ईमेल खातों का वर्तमान उपयोग लौटाता है।"
    },
    {
      "id": "delete",
      "num": "11",
      "title": "खाता हटाएँ",
      "method": "DELETE",
      "path": "/api/hosting/accounts/:id",
      "note": "⚠️ अपरिवर्तनीय। खाता हटाता है और, ON DELETE CASCADE के माध्यम से, उसके सभी संसाधन: मेलबॉक्स, डोमेन, DNS, SSL और बैकअप।"
    }
  ],
  "login": {
    "title": "होस्टिंग खाता लॉगिन",
    "badgePublic": "· सार्वजनिक",
    "desc": "क्लाइंट लॉगिन पैनल में अपनी क्रेडेंशियल दर्ज करता है। यदि वे मान्य हैं, तो kind: \"hosting\" प्रकार का एक सेशन बनाया जाता है जो एक्सेस को उसके अकाउंट के संसाधनों तक सीमित करता है।",
    "labelBody": "Body",
    "labelResp": "प्रतिक्रिया 200"
  },
  "errors": {
    "title": "त्रुटि कोड",
    "intro": "सभी त्रुटियाँ एक ही एन्वेलप का अनुसरण करती हैं:",
    "colHttp": "HTTP",
    "colCode": "कोड",
    "colDesc": "विवरण",
    "rows": [
      [
        "400",
        "VALIDATION_ERROR",
        "अमान्य या अनुपस्थित फ़ील्ड"
      ],
      [
        "401",
        "AUTH_ERROR",
        "अमान्य, समाप्त या अनुपस्थित API key"
      ],
      [
        "403",
        "FORBIDDEN",
        "आपके पास इस ऑपरेशन के लिए अनुमति नहीं है"
      ],
      [
        "404",
        "NOT_FOUND",
        "अनुरोधित खाता मौजूद नहीं है"
      ],
      [
        "409",
        "CONFLICT",
        "यह username पहले से उपयोग में है"
      ],
      [
        "429",
        "RATE_LIMIT",
        "बहुत अधिक अनुरोध — पुनः प्रयास से पहले प्रतीक्षा करें"
      ],
      [
        "500",
        "INTERNAL_ERROR",
        "आंतरिक सर्वर त्रुटि"
      ]
    ],
    "generic": "त्रुटि",
    "unknown": "अज्ञात त्रुटि"
  },
  "examples": {
    "title": "पूर्ण उदाहरण",
    "labelCurl": "खाता बनाएं",
    "labelSuspend": "खाता निलंबित करें",
    "labelList": "फ़िल्टर के साथ सूची",
    "labelNodeClient": "पुनः उपयोगी क्लाइंट",
    "labelPhpHelper": "PHP में हेल्पर क्लास"
  },
  "table": {
    "columnStatus": "स्थिति",
    "columnPlan": "योजना",
    "columnModules": "मॉड्यूल",
    "columnCreated": "बनाया गया",
    "columnUpdated": "अपडेट किया गया",
    "columnTenantGroup": "समूह",
    "columnHomeRoot": "होम निर्देशिका",
    "modulesCount": "{count} मॉड्यूल"
  },
  "audit": {
    "title": "{username} का ऑडिट",
    "eventType": "घटना",
    "actor": "अभिनेता",
    "date": "तारीख",
    "empty": "कोई घटना दर्ज नहीं।"
  },
  "actions": {
    "editModules": "मॉड्यूल संपादित करें",
    "viewStats": "उपयोग देखें",
    "viewAudit": "ऑडिट देखें",
    "enableJail": "जेल सक्षम करें",
    "disableJail": "जेल अक्षम करें",
    "save": "सहेजें",
    "saveChanges": "परिवर्तन सहेजें",
    "saving": "सहेजा जा रहा है…"
  },
  "confirm": {
    "enableJailBody": "इस खाते के लिए chroot जेल सक्षम करें? इसका टर्मिनल/SSH उसके फ़ोल्डर तक सीमित रहेगा।",
    "disableJailBody": "chroot जेल अक्षम करें? खाता सामान्य शेल (/bin/bash) पर लौट आएगा।",
    "suspendBody": "क्या यह खाता निलंबित करना है? क्लाइंट की पहुँच समाप्त हो जाएगी।",
    "suspendTitle": "खाता निलंबित करें",
    "suspendOk": "हाँ, निलंबित करें",
    "deleteBody": "क्या खाता \"{username}\" और उसका सभी डेटा (ईमेल, डोमेन, फ़ाइलें) हटाना है? यह क्रिया पूर्ववत नहीं की जा सकती।",
    "deleteTitle": "खाता हटाएँ"
  },
  "jail": {
    "degraded": "सर्वर पर jailkit स्थापित नहीं है; जेल सक्रिय नहीं हुई। jailkit स्थापित करें और पुनः प्रयास करें।",
    "degradedTitle": "जेल लागू नहीं हुई",
    "enabledOk": "जेल सफलतापूर्वक सक्षम।"
  },
  "toasts": {
    "jailAlready": "जेल पहले से सक्रिय है",
    "jailNotActive": "जेल सक्रिय नहीं है",
    "notActive": "खाता सक्रिय नहीं है",
    "notSuspended": "खाता निलंबित नहीं है"
  },
  "labels": {
    "statusActive": "सक्रिय",
    "statusSuspended": "निलंबित",
    "statusTerminated": "समाप्त"
  },
  "dataTable": {
    "columns": {
      "username": "उपयोगकर्ता",
      "plan": "योजना",
      "estado": "स्थिति",
      "modulos": "मॉड्यूल",
      "tenantGroup": "समूह",
      "homeRoot": "होम निर्देशिका",
      "creado": "बनाया गया",
      "actualizado": "अपडेट किया गया"
    },
    "filters": {
      "searchUser": "उपयोगकर्ता द्वारा खोजें…",
      "estado": "स्थिति",
      "plan": "योजना",
      "statusActive": "सक्रिय",
      "statusSuspended": "निलंबित",
      "statusTerminated": "समाप्त"
    },
    "rowActions": {
      "edit": "संपादित करें",
      "viewStats": "उपयोग देखें",
      "viewAudit": "ऑडिट देखें",
      "password": "पासवर्ड बदलें",
      "suspend": "निलंबित करें",
      "unsuspend": "पुनः सक्रिय करें",
      "enableJail": "जेल सक्षम करें",
      "disableJail": "जेल अक्षम करें",
      "delete": "हटाएं"
    }
  },
  "runtime": {
    "defaultsLoadError": "डिफ़ॉल्ट मान लोड नहीं हो सके।",
    "defaultsSaveError": "मान सहेजे नहीं जा सके।",
    "defaultsSaved": "मान सक्रिय सर्वर पर सहेजे गए।"
  },
  "settingsUi": {
    "title": "होस्टिंग सेटिंग",
    "description": "होस्टिंग खातों की तालिका की प्राथमिकताएँ",
    "table": "तालिका",
    "apiProviders": "API प्रदाता",
    "rowsPerPage": "खातों की तालिका में प्रति पृष्ठ पंक्तियाँ।",
    "newAccountDefaults": "नए खातों के डिफ़ॉल्ट मान",
    "defaultsHint": "सक्रिय सर्वर पर सहेजे जाते हैं। मौजूदा खाते नहीं बदलते।",
    "emailAccounts": "ईमेल",
    "subusers": "उपयोगकर्ता उपखाते",
    "defaultJail": "डिफ़ॉल्ट रूप से अलगाव चालू करें",
    "defaultModules": "डिफ़ॉल्ट मॉड्यूल (अल्पविराम से अलग ID)",
    "saveDefaults": "डिफ़ॉल्ट मान सहेजें",
    "relatedModules": "संबंधित मॉड्यूल",
    "users": "उपयोगकर्ता",
    "domainsSsl": "डोमेन और SSL",
    "showAll": "सभी दिखाएँ",
    "hideAll": "सभी छिपाएँ",
    "providerConnections": "होस्टिंग प्रबंधकों के कनेक्शन",
    "providerConnectionsHint": "LUXIPANEL API उपलब्ध कराता है। हर प्रबंधक को एक कुंजी और एक सर्वर, मॉड्यूल तथा कार्रवाइयों तक सीमित पहुँच मिलती है।",
    "newProvider": "नया प्रदाता",
    "managedServer": "प्रबंधित सर्वर",
    "localServer": "स्थानीय सर्वर",
    "panelHttpsOrigin": "LUXIPANEL का HTTPS स्रोत",
    "siteEngine": "सर्वर पर साइट इंजन",
    "accountModules": "खातों के मॉड्यूल",
    "modulesHint": "अल्पविराम से अलग ID; HOSTING सूची की जाँच करता है।",
    "apiOperations": "API कार्रवाइयाँ",
    "readAccounts": "खाते पढ़ें",
    "createAccounts": "खाते बनाएँ",
    "accountStatus": "खाते की स्थिति और विवरण",
    "viewUsage": "उपयोग देखें",
    "linkSites": "साइटें जोड़ें",
    "panelAccess": "पैनल तक पहुँच",
    "deleteAccounts": "खाते हटाएँ",
    "createProviderKey": "प्रदाता और कुंजी बनाएँ",
    "copyKeyNow": "कुंजी अभी कॉपी करें: यह केवल एक बार दिखाई देगी।",
    "groupPolicy": {
      "editProvider": "प्रदाता संपादित करें",
      "saveProvider": "प्रदाता सहेजें",
      "templateTitle": "नए समूह की अनुमतियाँ",
      "templateHint": "हर नए खाते को उसके अपने समूह में ये अनुमतियाँ मिलती हैं। मौजूदा खातों के समूह उपयोगकर्ता अनुभाग में संपादित करें।",
      "permissions": "विस्तृत अनुमतियाँ",
      "sidebar": "मेनू",
      "views": "दृश्य",
      "actions": "क्रियाएँ",
      "filesScope": "फ़ाइल पहुँच",
      "relativeHint": "प्रत्येक पंक्ति में खाते के फ़ोल्डर से संबंधित एक पथ। पूरे फ़ोल्डर के लिए . लिखें।",
      "allowPaths": "अनुमत फ़ोल्डर",
      "denyPaths": "अवरुद्ध फ़ोल्डर",
      "readOnlyPaths": "केवल पढ़ने वाले फ़ोल्डर",
      "defaultPath": "आरंभिक फ़ोल्डर",
      "commands": "टर्मिनल कमांड",
      "allowAllCommands": "उपयोगकर्ता के सभी कमांड की अनुमति दें",
      "commandGroups": "कमांड समूह",
      "allowedCommands": "अनुमत कमांड, प्रति पंक्ति एक",
      "deniedCommands": "अवरुद्ध कमांड, प्रति पंक्ति एक",
      "saving": "सहेजा जा रहा है…",
      "saved": "प्रदाता सहेजा गया। नए खातों पर लागू होगा।",
      "created": "प्रदाता बनाया गया।",
      "loading": "प्रदाता और अनुमतियाँ लोड हो रही हैं…",
      "loadError": "सेटिंग लोड नहीं हो सकीं।",
      "active": "सक्रिय",
      "revoked": "निरस्त",
      "rotateKey": "कुंजी बदलें",
      "rotateSuccess": "कुंजी बदली गई। नई कुंजी कॉपी करें।",
      "revoke": "पहुँच निरस्त करें",
      "reactivate": "फिर सक्रिय करें",
      "accessUpdated": "पहुँच अपडेट की गई।",
      "emptyProviders": "अभी कोई प्रदाता कॉन्फ़िगर नहीं है।"
},
    "apiGuide": "API मार्गदर्शिका",
    "retry": "फिर प्रयास करें"
  },
  "apiDocs": {
    "pageTitle": "होस्टिंग प्रदाता API",
    "backToHosting": "HOSTING पर लौटें",
    "contractVersion": "HTTP अनुबंध · संस्करण 1",
    "heading": "अपने होस्टिंग मैनेजर को कनेक्ट करें",
    "intro": "LUXIPANEL यह API देता है ताकि आपका मैनेजर HOSTING में तय अनुमतियों के अनुसार खाते बनाए, साइट जोड़े और पहुँच दे।",
    "guideContents": "मार्गदर्शिका की सामग्री",
    "preparation": "तैयारी",
    "authentication": "प्रमाणीकरण",
    "operations": "संचालन",
    "example": "उदाहरण",
    "panelAccess": "पैनल की पहुँच",
    "limitsErrors": "सीमाएँ और त्रुटियाँ",
    "preparationHeading": "HOSTING में तैयारी",
    "administrator": "व्यवस्थापक",
    "scope": "दायरा",
    "key": "कुंजी",
    "adminStep": "HOSTING → सेटिंग → API प्रदाता खोलें और एक प्रदाता बनाएँ।",
    "scopeStep": "सर्वर, साइट इंजन, मॉड्यूल, कोटा और अनुमत संचालन तय करें।",
    "keyStep": "lhp_… कुंजी एक बार कॉपी करें और केवल मैनेजर के बैकएंड में रखें।",
    "providerScopeNote": "हर प्रदाता एक सर्वर से जुड़ा है। खातों को अपना Linux उपयोगकर्ता और फ़ोल्डर मिलता है; मैनेजर पासवर्ड तय या प्राप्त नहीं करता।",
    "anyProvider": "कोई भी प्रदाता",
    "endpointCapabilities": "संस्करण, संचालन, मॉड्यूल और निर्धारित सर्वर देखें।",
    "endpointPutAccount": "वैकल्पिक displayName और email के साथ खाता बनाएँ या प्राप्त करें।",
    "endpointGetAccount": "पासवर्ड उजागर किए बिना खाता देखें।",
    "endpointPatchAccount": "नाम, ईमेल या active/suspended स्थिति अपडेट करें।",
    "endpointDeleteAccount": "बिना जुड़ी साइट वाले खाते को हटाएँ। डिफ़ॉल्ट रूप से बंद।",
    "endpointUsage": "कोटा, उपलब्ध उपयोग आँकड़े और माप चेतावनियाँ देखें।",
    "endpointPutSite": "HOSTING में सेट साइट इंजन से डोमेन जोड़ें।",
    "endpointDeleteSite": "केवल इस प्रदाता की साइट हटाएँ।",
    "endpointTicket": "पैनल में एक बार पहुँच का टिकट जारी करता है, जो 60 सेकंड मान्य है।",
    "method": "विधि",
    "pathFromBase": "आधार URL से पथ",
    "permission": "अनुमति",
    "result": "परिणाम",
    "operationsHeading": "मैनेजर संचालन",
    "authNote": "HTTPS पर पैनल को अनुरोध भेजें। एडमिन कुकी और lxp_… कुंजियाँ इस API को प्रमाणित नहीं करतीं। lhp_… कुंजी ब्राउज़र में कभी न भेजें।",
    "baseNote": "आधार URL: https://<panel>/api/hosting/v1। बाहरी ID में 1–128 अक्षर हो सकते हैं: अक्षर, अंक, _ . : -।",
    "idempotencyNote": "एक ही संदर्भ और सामग्री के साथ खाते और साइट के PUT अनुरोध समान परिणाम देते हैं। एक प्रदाता दूसरे के खातों तक नहीं पहुँच सकता।",
    "createAccount": "खाता बनाएँ या प्राप्त करें",
    "accountResponseNote": "उत्तर में { \"ok\": true, \"data\": … } के साथ उपयोगकर्ता, होम डायरेक्टरी, स्थिति और कोटा होते हैं। पासवर्ड हैश नहीं मिलता।",
    "siteExampleNote": "साइट के लिए { \"domain\": \"example.com\" } के साथ PUT /accounts/account-42/sites/site-1 भेजें। LUXIPANEL सेट इंजन के लिए NGINX प्रॉक्सी बनाता है; मैनेजर सामग्री प्रकाशित कर TLS ट्रैफ़िक सर्वर तक भेजता है।",
    "clientAccessHeading": "ग्राहक की LUXIPANEL तक पहुँच",
    "clientAccessNote": "मैनेजर बैकएंड खाते का स्वामित्व जाँचकर POST /accounts/{accountId}/access-ticket माँगता है। URL और टिकट ब्राउज़र को देता है, जो /api/auth/sso/handoff पर POST करता है। टिकट एक बार उपयोग होता है और 60 सेकंड में समाप्त होता है। दूसरे कारक की आवश्यकता हो तो संगत व्यवस्था तक 403 मिलता है।",
    "limitsHeading": "सीमाएँ और त्रुटि उत्तर",
    "limitsNote": "API केवल संदर्भ, बुनियादी खाता डेटा और डोमेन स्वीकार करता है। मैनेजर कमांड, फ़ाइल पथ, लक्ष्य सर्वर या NGINX सेटिंग नहीं भेज सकता। साइट केवल व्यवस्थापक के तय इंजन और पोर्ट पर जा सकती है।",
    "errorCodes": "400: अमान्य इनपुट · 401: कुंजी गुम या अमान्य · 403: संचालन की अनुमति नहीं · 404: संदर्भ नहीं मिला · 409: टकराव या एक साथ काम · 5xx: सर्वर त्रुटि।",
    "bandwidthNote": "बैंडविड्थ की माप अभी विश्वसनीय नहीं है। usage उत्तर में warnings देखें।"
  }
} as const;

export default hosting;
