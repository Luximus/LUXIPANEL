const components = {
  "setupWizardFooter": {
    "rights": "सर्वाधिकार सुरक्षित।",
    "madeBy": "LUXISOFT द्वारा निर्मित",
    "termsAndConditions": "नियम और शर्तें",
    "privacyPolicy": "गोपनीयता नीति",
    "documentation": "दस्तावेज़",
    "refundPolicy": "धनवापसी नीति"
  },
  "dataTable": {
    "boolTrue": "हाँ",
    "boolFalse": "नहीं",
    "selectPage": "पृष्ठ चुनें",
    "selectRow": "पंक्ति चुनें",
    "actions": "क्रियाएँ",
    "configure": "तालिका कॉन्फ़िगर करें",
    "empty": "{title} के लिए कोई परिणाम नहीं।",
    "total": "कुल",
    "selectedSummary": "{selected} चयनित • {pageSize} परिणामों में से {shown} दिखा रहे हैं, कुल परिणाम: {total}",
    "summary": "{pageSize} परिणामों में से {shown} दिखा रहे हैं, कुल परिणाम: {total}",
    "prev": "पिछला",
    "next": "अगला",
    "pageOf": "{totalPages} में से पृष्ठ {currentPage}",
    "configureTitle": "तालिका कॉन्फ़िगर करें",
    "columnsAndOrder": "दृश्यमान कॉलम और क्रम",
    "resultsPerPage": "प्रति पृष्ठ परिणाम",
    "moveUp": "{col} को ऊपर ले जाएँ",
    "moveDown": "{col} को नीचे ले जाएँ",
    "defaultTitle": "तालिका",
    "dragHandle": "पुनः क्रमबद्ध करने के लिए खींचें",
    "moveUpAria": "{col} को ऊपर ले जाएँ",
    "moveDownAria": "{col} को नीचे ले जाएँ",
    "emptyCell": "-"
  },
  "confirmModal": {
    "title": "पुष्टि करें",
    "cancel": "रद्द करें",
    "confirm": "पुष्टि करें",
    "alertTitle": "सूचना",
    "alertOk": "समझ गया",
    "promptTitle": "एक मान दर्ज करें",
    "promptCancel": "रद्द करें",
    "promptOk": "ठीक है"
  },
  "modalNavbar": {
    "back": "वापस",
    "close": "बंद करें"
  },
  "viewSettingsModal": {
    "buttonLabel": "सेटिंग्स",
    "description": "इस मॉड्यूल की विशिष्ट सेटिंग्स",
    "close": "बंद करें"
  },
  "floatingTerminal": {
    "newSnippet": "नया स्निपेट",
    "close": "बंद करें",
    "name": "नाम",
    "namePlaceholder": "उदा. Postfix पुनः आरंभ करें",
    "category": "श्रेणी",
    "tags": "टैग",
    "tagsHelp": "टैग चयनित श्रेणी पर निर्भर करते हैं",
    "command": "कमांड",
    "monacoHelp": "शेल सिंटैक्स के लिए Monaco। संपादक से सहेजने के लिए Ctrl+Enter का उपयोग करें।",
    "cancel": "रद्द करें",
    "save": "सहेजें"
  },
  "installModal": {
    "running": "इंस्टॉल हो रहा है… इसमें कुछ मिनट लग सकते हैं।",
    "success": "इंस्टॉलेशन पूर्ण हुई।",
    "failed": "इंस्टॉलेशन विफल रही। लॉग जांचें।"
  },
  "enterPage": {
    "pageTitle": "कोड से प्रवेश",
    "heading": "एक्सेस कोड से प्रवेश करें",
    "subtitle": "पैनल तक पहुँचने के लिए प्राप्त कोड दर्ज करें।",
    "codeLabel": "एक्सेस कोड",
    "codePlaceholder": "जैसे a1b2c3d4e5f6g7",
    "continue": "जारी रखें",
    "useAnotherCode": "दूसरा कोड उपयोग करें",
    "codeShort": "कोड",
    "terminalAi": "टर्मिनल / एआई",
    "enter": "प्रवेश करें",
    "willBeRedirected": "आपको पैनल लॉगिन पर ले जाया जाएगा।",
    "featuresAvailable": "उपलब्ध",
    "featuresUnavailable": "अनुपलब्ध",
    "invalidCode": "अमान्य एक्सेस कोड।",
    "verifyError": "कोड सत्यापित नहीं हो सका। पुनः प्रयास करें।",
    "networkError": "नेटवर्क त्रुटि। पुनः प्रयास करें।",
    "guestSessionError": "अतिथि सत्र प्रारंभ नहीं हो सका."
  },
  "dragHandle": "पुनः क्रमबद्ध करने के लिए खींचें",
  "logoAlt": "LUXIPANEL",
  "default": " (डिफ़ॉल्ट)",
  "emptyCell": "-",
  "loginEffects": {
    "defaultSuffix": " (डिफ़ॉल्ट)",
    "webGpuHint": "WebGPU आवश्यक है। समर्थन न होने पर डिफ़ॉल्ट पृष्ठभूमि दिखाई देगी।"
  },
  "tableSettings": {
    "pagination": "पृष्ठांकन",
    "rowsPerPage": "इस तालिका में प्रति पृष्ठ पंक्तियाँ।",
    "visibleActions": "दिखाई देने वाली कार्रवाइयाँ",
    "actionsHint": "हर पंक्ति के «···» मेनू में दिखने वाली कार्रवाइयाँ चुनें।"
  }
} as const;

export default components;
