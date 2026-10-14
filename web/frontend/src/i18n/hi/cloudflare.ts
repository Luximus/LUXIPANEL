const cloudflare = {
  "options": {
    "essentiallyOff": "लगभग बंद",
    "low": "निम्न",
    "medium": "मध्यम",
    "high": "उच्च"
  },
  "pageTitle": "Cloudflare",
  "header": {
    "heading": "Cloudflare",
    "subheading": "इस सर्वर के लिए अपने Cloudflare ज़ोन के DNS, कैश, SSL/TLS और सुरक्षा का प्रबंधन करें।"
  },
  "config": {
    "title": "Cloudflare कनेक्शन",
    "tokenLabel": "API टोकन",
    "tokenPlaceholder": "Cloudflare API Token",
    "tokenHint": "dash.cloudflare.com → My Profile → API Tokens पर ज़ोन अनुमतियों के साथ एक टोकन बनाएं: DNS, Cache Purge, Zone Settings और Firewall Services।",
    "save": "सहेजें",
    "test": "कनेक्शन जांचें",
    "clear": "टोकन हटाएं",
    "tokenSet": "टोकन कॉन्फ़िगर किया गया",
    "tokenMissing": "शुरू करने के लिए एक API Token कॉन्फ़िगर करें",
    "saved": "टोकन सहेजा गया",
    "cleared": "टोकन हटा दिया गया",
    "confirmClear": "Cloudflare टोकन हटाएं?",
    "confirmClearBtn": "हटाएं"
  },
  "zones": {
    "title": "ज़ोन",
    "select": "एक ज़ोन चुनें",
    "empty": "इस टोकन से कोई ज़ोन दिखाई नहीं देता।",
    "status": "स्थिति",
    "plan": "प्लान",
    "nameServers": "नेम सर्वर",
    "domainNotFound": "डोमेन {domain} टोकन की किसी भी ज़ोन से संबंधित नहीं है"
  },
  "runtime": {
    "active": "सक्रिय",
    "pending": "लंबित",
    "initializing": "आरंभ हो रहा है",
    "moved": "स्थानांतरित",
    "paused": "रुका हुआ",
    "pausedHint": "ज़ोन रुका हुआ है: DNS बदलने से पहले कॉन्फ़िगरेशन जाँचें।",
    "inactiveHint": "ज़ोन {status}: रजिस्ट्रार पर नेम सर्वर जाँचें।",
    "activeHint": "सक्रिय ज़ोन · {count} नेम सर्वर कॉन्फ़िगर हैं।"
  },
  "tabs": {
    "dns": "DNS",
    "cache": "कैश",
    "security": "SSL / सुरक्षा",
    "access": "एक्सेस नियम",
    "config": "कॉन्फ़िगरेशन"
  },
  "dns": {
    "title": "DNS रिकॉर्ड",
    "add": "रिकॉर्ड जोड़ें",
    "type": "प्रकार",
    "name": "नाम",
    "content": "सामग्री",
    "ttl": "TTL",
    "proxied": "प्रॉक्सी",
    "pointsToServer": "इस सर्वर की ओर इंगित करता है",
    "edit": "संपादित करें",
    "delete": "हटाएं",
    "confirmDelete": "रिकॉर्ड {name} हटाएं?",
    "saved": "रिकॉर्ड सहेजा गया",
    "deleted": "रिकॉर्ड हटा दिया गया",
    "useServerIp": "सर्वर का IP उपयोग करें",
    "priority": "प्राथमिकता",
    "confirmDeleteTitle": "रिकॉर्ड हटाएं",
    "typeA": "A",
    "typeAAAA": "AAAA",
    "typeCNAME": "CNAME",
    "typeTXT": "TXT",
    "typeMX": "MX",
    "typeNS": "NS",
    "ttlAuto": "स्वचालित",
    "ttl60": "60",
    "ttl300": "300",
    "ttl1800": "1800",
    "ttl3600": "3600",
    "ttl86400": "86400"
  },
  "cache": {
    "title": "कैश",
    "purgeAll": "सब कुछ साफ़ करें",
    "purgeAllHint": "Cloudflare पर ज़ोन की सभी कैश की गई सामग्री हटा देता है।",
    "confirmPurgeAll": "ज़ोन की पूरी कैश साफ़ करें?",
    "purgeUrls": "URLs साफ़ करें",
    "purgeUrlsPlaceholder": "https://ejemplo.com/estilos.css (प्रति पंक्ति एक URL)",
    "purged": "कैश साफ़ की गई",
    "devMode": "डेवलपमेंट मोड",
    "devModeHint": "Cloudflare की कैश को अस्थायी रूप से निष्क्रिय करता है (3 घंटे बाद अपने आप बंद हो जाता है)।",
    "confirmPurgeTitle": "कैश साफ करें",
    "confirmPurgeBtn": "साफ करें"
  },
  "security": {
    "title": "SSL / सुरक्षा",
    "sslMode": "SSL/TLS मोड",
    "alwaysHttps": "हमेशा HTTPS",
    "securityLevel": "सुरक्षा स्तर",
    "underAttack": "अंडर अटैक मोड",
    "updated": "सेटिंग अपडेट की गई",
    "sslOff": "बंद",
    "sslFlexible": "लचीला",
    "sslFull": "पूर्ण",
    "sslFullStrict": "पूर्ण (सख्त)"
  },
  "access": {
    "title": "IP एक्सेस नियम",
    "add": "नियम जोड़ें",
    "mode": "कार्रवाई",
    "block": "ब्लॉक करें",
    "allow": "अनुमति दें",
    "challenge": "चैलेंज",
    "ip": "IP / रेंज",
    "notes": "नोट्स",
    "empty": "इस ज़ोन में कोई एक्सेस नियम नहीं।",
    "confirmDelete": "{ip} के लिए नियम हटाएं?",
    "created": "नियम बनाया गया",
    "deleted": "नियम हटा दिया गया",
    "ipHeader": "IP",
    "confirmDeleteTitle": "नियम हटाएं"
  },
  "common": {
    "loading": "लोड हो रहा है...",
    "error": "त्रुटि",
    "save": "सहेजें",
    "cancel": "रद्द करें",
    "delete": "हटाएं",
    "refresh": "ताज़ा करें",
    "serverIp": "सर्वर का IP",
    "noToken": "कॉन्फ़िगरेशन टैब में Cloudflare API Token कॉन्फ़िगर करें।"
  },
  "settingsUi": {
    "title": "Cloudflare सेटिंग",
    "description": "Cloudflare मॉड्यूल की तालिकाओं की प्राथमिकताएँ।",
    "access": "पहुँच",
    "credentialsConnections": "क्रेडेंशियल और कनेक्शन",
    "cloudflareToken": "Cloudflare टोकन",
    "serverFirewall": "सर्वर फ़ायरवॉल",
    "dnsWebhooks": "Webhooks में DNS ईवेंट"
  }
} as const;

export default cloudflare;
