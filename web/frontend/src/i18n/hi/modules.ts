const modules = {
  "pageTitle": "मॉड्यूल",
  "header": {
    "heading": "मॉड्यूल और इंटीग्रेशन",
    "subheading": "साइडबार मेनू में दिखने वाले पूर्व-स्थापित मॉड्यूल सक्रिय या छिपाएं"
  },
  "search": {
    "placeholder": "मॉड्यूल खोजें..."
  },
  "tabs": {
    "all": "सभी",
    "modules": "मॉड्यूल",
    "integrations": "एकीकरण",
    "visible": "दृश्यमान"
  },
  "stats": {
    "visible": "दृश्यमान:",
    "hidden": "छिपे हुए:",
    "systemNote": "सिस्टम मॉड्यूल पूर्व-स्थापित रहते हैं"
  },
  "categories": {
    "label": "श्रेणियाँ",
    "all": "सभी",
    "communication": "संचार",
    "infrastructure": "इन्फ्रास्ट्रक्चर",
    "security": "सुरक्षा",
    "developer": "डेवलपर"
  },
  "statusFilter": {
    "label": "स्थिति",
    "all": "सभी",
    "visible": "दृश्यमान",
    "hidden": "छिपे हुए"
  },
  "empty": {
    "title": "कोई मॉड्यूल नहीं मिला",
    "subtitle": "कोई अन्य खोज शब्द या श्रेणी आज़माएं"
  },
  "errors": {
    "loadTitle": "मॉड्यूल लोड करने में त्रुटि",
    "loadSubtitle": "मॉड्यूल सूची नहीं मिली"
  },
  "labels": {
    "metaVersion": "संस्करण",
    "metaInstalls": "इंस्टॉलेशन",
    "metaRating": "रेटिंग",
    "metaAuthor": "लेखक",
    "metaCreatedAt": "बनाने की तारीख",
    "metaUpdatedAt": "अंतिम अपडेट",
    "kindIntegration": "इंटीग्रेशन",
    "kindModule": "मॉड्यूल",
    "tagFree": "निःशुल्क",
    "tagLicense": "लाइसेंस आवश्यक",
    "statusVisible": "मेनू में दिखाई दे रहा है",
    "statusHidden": "छिपा हुआ",
    "dragHandle": "क्रम बदलने के लिए खींचें",
    "menuToggle": "साइडबार मेनू में दिखाएं",
    "moduleToggle": "मॉड्यूल सक्षम करें",
    "fabToggle": "फ़्लोटिंग बटन दिखाएं"
  },
  "toasts": {
    "moduleVisible": "{name} दृश्यमान",
    "moduleHidden": "{name} छिपा",
    "moduleVisibleWithDeps": "{name} दृश्यमान (भी सक्रिय: {deps})",
    "moduleHiddenWithDeps": "{name} छिपा (भी सक्रिय: {deps})",
    "moduleUpdateError": "{name} अपडेट नहीं हो सका",
    "sidebarShown": "{name} मेनू में दिखाई दे रहा है",
    "sidebarHidden": "{name} मेनू से छिपा हुआ",
    "fabShown": "{name}: फ़्लोटिंग बटन सक्षम",
    "fabHidden": "{name}: फ़्लोटिंग बटन अक्षम",
    "orderSaved": "क्रम अपडेट हुआ",
    "orderError": "क्रम सहेजा नहीं जा सका",
    "orderHttpError": "क्रम सहेजा नहीं जा सका ({status})"
  }
} as const;

export default modules;
