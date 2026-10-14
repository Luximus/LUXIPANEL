const openclaw = {
  "pageTitle": "OpenClaw",
  "header": {
    "subtitle": "पैनल को जोड़ें",
    "subtitleSuffix": "इसके मॉडल और टूल उपयोग करने के लिए।"
  },
  "statusCard": {
    "title": "कनेक्शन स्थिति",
    "descKeySet": "API key कॉन्फ़िगर की गई है। सत्यापित करने के लिए \"कनेक्शन टेस्ट करें\" दबाएं।",
    "descNoKey": "अभी तक कोई API key कॉन्फ़िगर नहीं की गई।",
    "btnTest": "कनेक्शन टेस्ट करें"
  },
  "form": {
    "sectionTitle": "क्रेडेंशियल और endpoint",
    "sectionDesc": "API key पैनल के डेटाबेस में एन्क्रिप्टेड रूप में सहेजी जाती है।",
    "labelEndpoint": "Endpoint",
    "placeholderEndpoint": "https://openclaw.ai",
    "hintEndpoint": "API का बेस URL। डिफ़ॉल्ट",
    "labelApiKey": "API कुंजी",
    "placeholderApiKeySet": "कॉन्फ़िगर की गई · {preview}",
    "placeholderApiKeyUnset": "sk-...",
    "ariaToggleKey": "दिखाएँ या छुपाएँ",
    "btnClearKey": "मिटाएँ",
    "hintApiKey": "वर्तमान API key बनाए रखने के लिए खाली छोड़ें।",
    "labelDefaultModel": "डिफ़ॉल्ट मॉडल",
    "placeholderDefaultModel": "claw-default",
    "hintDefaultModel": "उन आंतरिक कॉल द्वारा उपयोग किए जाने वाले मॉडल का पहचानकर्ता जो कोई निर्दिष्ट नहीं करते।",
    "btnSave": "परिवर्तन सहेजें"
  },
  "help": {
    "title": "मुझे अपनी API key कैसे मिलेगी?",
    "step1": "यहाँ लॉगिन करें",
    "step2": "अपने खाते की सेटिंग खोलें और एक नई API key बनाएँ।",
    "step3": "इसे ऊपर पेस्ट करें और सहेजें — पैनल इसे दोबारा स्पष्ट रूप में नहीं दिखाएगा।"
  }
} as const;

export default openclaw;
