const moduleCatalog = {
  "users": {
    "name": "उपयोगकर्ता",
    "description": "पैनल उपयोगकर्ताओं, भूमिकाओं और अनुमतियों का प्रबंधन।"
  },
  "mail": {
    "name": "मेल",
    "description": "SMTP / IMAP, डोमेन और उपयोगकर्ता मेलबॉक्स।"
  },
  "monitor": {
    "name": "मॉनिटर",
    "description": "CPU, RAM, डिस्क और प्रक्रियाओं के लाइव मेट्रिक्स।"
  },
  "files": {
    "name": "फ़ाइलें",
    "description": "एकीकृत एडिटर के साथ रिमोट फ़ाइल एक्सप्लोरर।"
  },
  "firewall": {
    "name": "फ़ायरवॉल",
    "description": "UFW नियमों का प्रबंधन और IP अवरोधन।"
  },
  "bitninja": {
    "name": "BitNinja",
    "description": "संपूर्ण सुरक्षा एजेंट: WAF, anti-DoS, मैलवेयर पहचान और IP प्रतिष्ठा।"
  },
  "assistant": {
    "name": "AI एजेंट",
    "description": "निदान और स्वचालन के लिए AI असिस्टेंट।"
  },
  "repository-store": {
    "name": "GitHub",
    "description": "रिपॉज़िटरी कैटलॉग और निर्देशित इंस्टॉलेशन।"
  },
  "dns": {
    "name": "Nginx",
    "description": "Nginx प्रबंधन: साइटें, रिवर्स प्रॉक्सी, SSL, लॉग और स्थिति।"
  },
  "backups": {
    "name": "बैकअप",
    "description": "एन्क्रिप्शन और कई गंतव्यों के साथ शेड्यूल किए गए बैकअप।"
  },
  "cron": {
    "name": "Cron",
    "description": "विज़ुअल एडिटर के साथ शेड्यूल किए गए कार्य।"
  },
  "databases": {
    "name": "डेटाबेस",
    "description": "डेटाबेस प्रबंधक (MySQL/MariaDB और PostgreSQL): स्कीमा एक्सप्लोर करें और SQL कंसोल।"
  },
  "obsidian": {
    "name": "Obsidian",
    "description": "आपके सर्वर पर Obsidian नोट्स वॉल्ट: मार्कडाउन एडिटर, विकीलिंक और असिस्टेंट के AI एजेंटों द्वारा संचालित नोट्स।"
  },
  "cloudflare": {
    "name": "Cloudflare",
    "description": "सर्वर के लिए Cloudflare प्रबंधन: DNS, कैश, SSL/TLS, डेवलपमेंट मोड और IP एक्सेस नियम।"
  },
  "server-alerts": {
    "name": "सूचनाएँ",
    "description": "पैनल मालिक के लिए सर्वर सूचनाएँ: अलर्ट प्राथमिकताएँ, तत्काल सूचनाएँ, शेड्यूल/आवर्ती सूचनाएँ और मेट्रिक्स आधारित नियम (CPU/RAM/डिस्क/लोड/सेवा बंद होना), जो LP के माध्यम से उनके डिवाइसों पर भेजी जाती हैं।"
  },
  "expo": {
    "name": "Expo",
    "description": "Expo/React Native ऐप्स प्रबंधित करें: EAS बिल्ड, स्टोर सबमिशन, OTA अपडेट, dev-client का QR और कोटा, क्लाइंट के एक्सेस टोकन के साथ।"
  },
  "webhooks": {
    "name": "वेबहुक",
    "description": "पैनल इवेंट्स की HTTP सूचनाएँ।"
  },
  "openclaw": {
    "name": "OpenClaw",
    "description": "मॉडल सिलेक्टर के साथ OpenClaw AI से कनेक्शन।"
  },
  "hosting": {
    "name": "होस्टिंग",
    "description": "साइटें, vhosts और सहायता-प्राप्त डिप्लॉयमेंट।"
  },
  "terminal": {
    "name": "टर्मिनल",
    "description": "पैनल के किसी भी व्यू से सुलभ फ्लोटिंग टर्मिनल। फ्लोटिंग बटन सक्षम या अक्षम करें।"
  },
  "module-dev": {
    "name": "मेरे मॉड्यूल",
    "description": "आपके मार्केटप्लेस मॉड्यूल का जीवनचक्र: समीक्षा स्थिति, सबमिशन, टेस्ट और निजी प्रीव्यू।"
  },
  "filesystem-mcp": {
    "name": "Filesystem MCP",
    "description": "फ़ाइलसिस्टम ऑपरेशनों के लिए MCP।"
  },
  "github-mcp": {
    "name": "GitHub MCP",
    "description": "GitHub API के विरुद्ध ऑपरेशनों के लिए MCP।"
  },
  "google-drive": {
    "name": "Google Drive",
    "description": "असिस्टेंट चैट से अपने Google Drive के दस्तावेज़ खोजें और संलग्न करें।"
  },
  "onedrive": {
    "name": "OneDrive",
    "description": "चैट से Microsoft OneDrive / SharePoint की फ़ाइलों तक पहुँचें।"
  },
  "dropbox": {
    "name": "Dropbox",
    "description": "चैट से Dropbox की फ़ाइलें खोजें और संलग्न करें।"
  },
  "notion": {
    "name": "Notion",
    "description": "चैट से Notion के पेज और डेटाबेस देखें।"
  }
} as const;

export default moduleCatalog;
