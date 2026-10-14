const servers = {
  "pageTitle": "सर्वर",
  "description": "यह पैनल जिन SSH सर्वरों से जुड़ सकता है, उनकी स्थानीय सूची। गुप्त जानकारी (कुंजियाँ और पासवर्ड) एन्क्रिप्ट करके रखी जाती है और यहाँ कभी नहीं दिखाई जाती।",
  "btnNew": "सर्वर जोड़ें",
  "table": {
    "name": "नाम",
    "host": "होस्ट",
    "username": "उपयोगकर्ता",
    "authType": "प्रमाणीकरण",
    "status": "स्थिति"
  },
  "authTypes": {
    "key": "SSH कुंजी",
    "password": "पासवर्ड"
  },
  "status": {
    "approved": "स्वीकृत",
    "pending": "लंबित",
    "untested": "परीक्षण नहीं हुआ"
  },
  "common": {
    "test": "परीक्षण करें",
    "edit": "संपादित करें",
    "delete": "हटाएँ",
    "cancel": "रद्द करें",
    "save": "सहेजें",
    "close": "बंद करें",
    "error": "त्रुटि",
    "yes": "हाँ",
    "no": "नहीं"
  },
  "dialog": {
    "titleNew": "सर्वर जोड़ें",
    "titleEdit": "सर्वर संपादित करें",
    "name": "नाम",
    "namePlaceholder": "मेरा प्रोडक्शन सर्वर",
    "host": "होस्ट या IP",
    "hostPlaceholder": "203.0.113.10 या server.example.com",
    "port": "पोर्ट",
    "username": "उपयोगकर्ता",
    "usernamePlaceholder": "root",
    "authType": "प्रमाणीकरण का प्रकार",
    "secretKey": "निजी SSH कुंजी",
    "secretKeyPlaceholder": "-----BEGIN OPENSSH PRIVATE KEY-----",
    "passphrase": "कुंजी की पासफ़्रेज़ (वैकल्पिक)",
    "passphrasePlaceholder": "कुंजी खोलने के लिए पासफ़्रेज़",
    "secretPassword": "पासवर्ड",
    "secretPasswordPlaceholder": "SSH उपयोगकर्ता का पासवर्ड",
    "secretKeepHint": "मौजूदा गुप्त जानकारी रखने के लिए खाली छोड़ें।",
    "btnCancel": "रद्द करें",
    "btnSave": "सहेजें"
  },
  "fingerprint": {
    "title": "होस्ट फ़िंगरप्रिंट स्वीकृत करें",
    "intro": "इस सर्वर से यह पहला कनेक्शन है। स्वीकृति देने से पहले जाँचें कि होस्ट कुंजी का फ़िंगरप्रिंट अपेक्षित फ़िंगरप्रिंट से मेल खाता है।",
    "approve": "फ़िंगरप्रिंट स्वीकृत करें",
    "approving": "स्वीकृति जारी है…",
    "approved": "फ़िंगरप्रिंट स्वीकृत",
    "approveError": "फ़िंगरप्रिंट स्वीकृत नहीं किया जा सका"
  },
  "toasts": {
    "created": "सर्वर जोड़ा गया",
    "updated": "सर्वर अपडेट किया गया",
    "deleted": "सर्वर हटाया गया",
    "testOk": "कनेक्शन सफल",
    "testFailed": "कनेक्शन विफल"
  },
  "validation": {
    "nameRequired": "नाम दर्ज करें",
    "hostRequired": "होस्ट दर्ज करें",
    "usernameRequired": "उपयोगकर्ता दर्ज करें",
    "secretRequired": "प्रमाणीकरण की गुप्त जानकारी दर्ज करें"
  },
  "confirmDelete": "सर्वर {name} हटाएँ? इसे वापस नहीं किया जा सकता।",
  "confirmDeleteTitle": "सर्वर हटाएँ",
  "testing": "कनेक्शन का परीक्षण हो रहा है…"
} as const;

export default servers;
