const firewall = {
  "pageTitle": "Firewall",
  "installWarning": {
    "title": "Firewall घटक नहीं मिले",
    "description": "पैकेज मैनेजर (apt/dnf/apk/...) डिफ़ॉल्ट कॉन्फ़िगरेशन के साथ चलाया जाएगा और समाप्ति पर सेवाएँ सक्षम होंगी।",
    "btnInstall": "अभी इंस्टॉल करें"
  },
  "statusCard": {
    "label": "Firewall की स्थिति (UFW)",
    "verifying": "सत्यापित हो रहा है...",
    "btnDisable": "निष्क्रिय करें",
    "btnEnable": "सक्रिय करें"
  },
  "securityAudit": {
    "title": "सुरक्षा ऑडिट (प्रीमियम)",
    "btnStartAudit": "विश्लेषण प्रारंभ करें",
    "scannerChecking": "जाँच हो रही है…",
    "btnInstallScanner": "इंस्टॉल करें",
    "scanProgress": "स्कैन प्रगति",
    "scanAi": "AI विश्लेषण: 0%",
    "noReports": "कोई पूर्ण ऑडिट नहीं है। शुरू करने के लिए नया ऑडिट आरंभ करें।"
  },
  "ufwRules": {
    "title": "UFW नियम",
    "btnNewRule": "नया नियम",
    "loading": "नियम लोड हो रहे हैं...",
    "btnAllowCloudflare": "Cloudflare को अनुमति दें",
    "searchLabel": "नियम खोजें",
    "searchPlaceholder": "पोर्ट, IP या टिप्पणी खोजें…"
  },
  "fail2ban": {
    "btnBanIp": "IP बैन करें",
    "loading": "Jails लोड हो रहे हैं..."
  },
  "ruleDialog": {
    "title": "नया UFW नियम",
    "labelAction": "क्रिया",
    "optionAllow": "अनुमति दें",
    "optionDeny": "अस्वीकार करें",
    "optionReject": "अस्वीकृत करें",
    "labelProtocol": "प्रोटोकॉल",
    "optionAny": "कोई भी",
    "labelPort": "पोर्ट",
    "placeholderPort": "25 या 8080:8090",
    "labelFromIp": "स्रोत IP",
    "placeholderFromIp": "any या 192.168.0.0/24",
    "labelComment": "टिप्पणी (वैकल्पिक)",
    "placeholderComment": "आने वाला SMTP",
    "btnCancel": "रद्द करें",
    "btnAdd": "नियम जोड़ें"
  },
  "banDialog": {
    "title": "IP को मैन्युअल रूप से बैन करें",
    "labelIp": "IP पता",
    "placeholderIp": "192.168.1.100",
    "labelJail": "Fail2ban जेल",
    "btnCancel": "रद्द करें",
    "btnBan": "बैन करें"
  },
  "auditReportDialog": {
    "title": "सुरक्षा ऑडिट रिपोर्ट",
    "btnClose": "बंद करें"
  },
  "aiAssistant": {
    "btnSuggestRules": "नियम सुझाएं (AI)",
    "btnSuggestBans": "प्रतिबंध सुझाएं (AI)",
    "btnAnalyze": "AI विश्लेषण",
    "promptUfw": "कनेक्ट किए गए सर्वर के UFW फ़ायरवॉल का विश्लेषण करें: इसकी स्थिति और मौजूदा नियमों की समीक्षा करें (firewall.ufw_status टूल का उपयोग करें) और उपयोग में चल रही सेवाओं को तोड़े बिना सुरक्षा बढ़ाने के लिए स्मार्ट UFW नियम सुझाएँ। प्रत्येक प्रस्तावित नियम के लिए कारण बताएँ और उसे लागू करने हेतु सटीक `ufw` कमांड शामिल करें।",
    "promptFail2ban": "कनेक्ट किए गए सर्वर पर Fail2ban का विश्लेषण करें: कॉन्फ़िगर किए गए jail और बैन किए गए IP की समीक्षा करें (firewall.fail2ban_status टूल का उपयोग करें) और ब्रूट-फ़ोर्स हमलों से सुरक्षा के लिए बैन और कॉन्फ़िगरेशन सुधार सुझाएँ। jail, IP/रेंज और कारण, तथा लागू करने के कमांड बताएँ।",
    "promptAnalyze": "कनेक्ट किए गए सर्वर पर फ़ायरवॉल का सामान्य सुरक्षा विश्लेषण करें। UFW और Fail2ban की स्थिति की समीक्षा करें (firewall.ufw_status और firewall.fail2ban_status टूल का उपयोग करें), जोखिम, उजागर पोर्ट और कमज़ोर कॉन्फ़िगरेशन की पहचान करें, और उन्हें लागू करने के कमांड के साथ प्राथमिकता-क्रमित सिफ़ारिशें दें।",
    "analyzeRule": "AI से विश्लेषण करें",
    "promptRule": "कनेक्ट किए गए सर्वर पर इस मौजूदा UFW नियम का विश्लेषण करें। यह कौन सा ट्रैफ़िक अनुमत या अवरुद्ध करता है, समझाएँ; इसके जोखिमों का आकलन करें और सुझाव दें कि इसे रखा, समायोजित या बदला जाना चाहिए। यदि परिवर्तन सुझाते हैं तो सटीक कमांड शामिल करें।\n\nनियम #{number}\nक्रिया: {action}\nगंतव्य/पोर्ट: {to}\nस्रोत: {from}\nप्रोटोकॉल: {proto}\nटिप्पणी: {comment}"
  },
  "labels": {
    "active": "सक्रिय",
    "inactive": "निष्क्रिय",
    "bannedCount": "{count} प्रतिबंधित",
    "moreIps": "+{n} और",
    "installingText": "UFW और Fail2ban इंस्टॉल हो रहा है… इसमें कुछ मिनट लग सकते हैं।",
    "installSuccessText": "फ़ायरवॉल सफलतापूर्वक इंस्टॉल हुआ।",
    "cfEdgeBlockQuestion": "क्या {ip} को Cloudflare एज पर भी ब्लॉक करें?",
    "findingsCount": "{n} निष्कर्ष मिले",
    "completedAt": "{time} में पूर्ण",
    "scanAiProgress": "AI विश्लेषण: {pct}%",
    "overallRisk": "कुल जोखिम",
    "unknown": "अज्ञात",
    "keyThreats": "मुख्य खतरे",
    "recommendations": "सुझाव",
    "findingsTitle": "निष्कर्ष ({n})",
    "moreFindingsCount": "+{n} और निष्कर्ष",
    "from": "से",
    "any": "कोई भी",
    "scanBitNinjaProgress": "BitNinja: {pct}%",
    "scanLynisProgress": "Lynis: {pct}%",
    "scanRkhunterProgress": "Rkhunter: {pct}%",
    "scanChkrootkitProgress": "Chkrootkit: {pct}%"
  },
  "empty": {
    "noRules": "कोई नियम नहीं",
    "noJails": "कोई सक्रिय jail नहीं"
  },
  "actions": {
    "unban": "प्रतिबंध हटाएं",
    "blockInCloudflare": "Cloudflare में ब्लॉक करें",
    "dismiss": "खारिज करें"
  },
  "confirm": {
    "deleteRuleMsg": "नियम #{number} हटाएं?",
    "deleteRuleTitle": "नियम हटाएं",
    "disableFwMsg": "Firewall निष्क्रिय करें? सर्वर नेटवर्क सुरक्षा के बिना रह जाएगा।",
    "disableFwTitle": "Firewall निष्क्रिय करें",
    "disableFwBtn": "हाँ, निष्क्रिय करें",
    "cfAllowMsg": "Cloudflare की आधिकारिक IP सीमाओं से 80/443 की अनुमति देने के लिए UFW नियम जोड़े जाएँगे। जारी रखें?",
    "cfAllowTitle": "Cloudflare IPs की अनुमति दें",
    "cfAllowBtn": "जारी रखें"
  },
  "toasts": {
    "ruleDeleted": "नियम हटाया गया",
    "errorDelete": "हटाने में त्रुटि",
    "ipUnbanned": "{ip} का प्रतिबंध हटाया गया",
    "errorUnban": "प्रतिबंध हटाने में त्रुटि",
    "fwEnabled": "Firewall सक्रिय",
    "errorEnable": "सक्रिय करने में त्रुटि",
    "fwDisabled": "Firewall निष्क्रिय",
    "errorDisable": "निष्क्रिय करने में त्रुटि",
    "fwInstalled": "Firewall इंस्टॉल हुआ",
    "ruleAdded": "नियम जोड़ा गया",
    "ipBanned": "{ip} को {jail} में प्रतिबंधित किया",
    "errorBan": "प्रतिबंधित करने में त्रुटि",
    "cfRulesApplied": "Cloudflare नियम लागू ({applied})",
    "errorCfRules": "Cloudflare नियम लागू करने में त्रुटि",
    "errorStartAudit": "ऑडिट शुरू करने में त्रुटि",
    "auditCompleted": "ऑडिट पूर्ण",
    "auditFailed": "ऑडिट विफल",
    "errorLoadReport": "रिपोर्ट लोड करने में त्रुटि",
    "reportOf": "{date} की रिपोर्ट"
  },
  "errors": {
    "addRule": "नियम जोड़ने में त्रुटि"
  },
  "runtime": {
    "statusError": "स्थिति जाँची नहीं जा सकी",
    "rulesLoadError": "नियम लोड नहीं हो सके।",
    "noMatchingRules": "फ़िल्टर से कोई नियम मेल नहीं खाता।",
    "loggingSaved": "लॉगिंग स्तर सहेजा गया।",
    "loggingSaveError": "लॉगिंग स्तर सहेजा नहीं जा सका।"
  },
  "settingsUi": {
    "rulesView": "नियम दृश्य",
    "ufwLog": "UFW लॉग",
    "related": "संबंधित",
    "title": "फ़ायरवॉल सेटिंग",
    "description": "निजी फ़िल्टर और सक्रिय सर्वर का UFW लॉग।",
    "sectionsLabel": "फ़ायरवॉल सेटिंग के अनुभाग",
    "showActions": "कार्रवाइयाँ दिखाएँ",
    "all": "सभी",
    "limit": "सीमित करें",
    "serverSettingHint": "यह सेटिंग सक्रिय सर्वर की कॉन्फ़िगरेशन बदलती है।",
    "logLevel": "लॉग स्तर",
    "off": "बंद",
    "low": "निम्न",
    "medium": "मध्यम",
    "high": "उच्च",
    "full": "पूर्ण",
    "saveLevel": "स्तर सहेजें",
    "relatedModules": "संबंधित मॉड्यूल"
  }
} as const;

export default firewall;
