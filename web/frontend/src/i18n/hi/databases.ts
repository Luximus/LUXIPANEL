const databases = {
  "pageTitle": "डेटाबेस",
  "header": {
    "heading": "डेटाबेस प्रबंधक",
    "subheading": "सर्वर के डेटाबेस एक्सप्लोर करें और क्वेरी करें (MySQL/MariaDB, PostgreSQL)।"
  },
  "databases": {
    "title": "डेटाबेस"
  },
  "tables": {
    "title": "तालिकाएँ"
  },
  "tabs": {
    "rows": "पंक्तियाँ",
    "structure": "संरचना",
    "console": "SQL कंसोल"
  },
  "rows": {
    "prev": "पिछला",
    "next": "अगला"
  },
  "console": {
    "placeholder": "SELECT * FROM ...",
    "run": "चलाएँ",
    "allowWrite": "लिखने की अनुमति दें",
    "hint": "Ctrl/⌘ + Enter चलाने के लिए। लिखने/DDL स्टेटमेंट के लिए \"लिखने की अनुमति दें\" चेक करें।"
  },
  "common": {
    "selectEngine": "एक इंजन चुनें।",
    "selectDb": "एक डेटाबेस चुनें।",
    "selectTable": "एक तालिका चुनें।"
  },
  "actions": {
    "export": "निर्यात करें",
    "addRecord": "रिकॉर्ड जोड़ें",
    "cancel": "रद्द करें",
    "save": "सहेजें",
    "edit": "संपादित करें",
    "downloadSql": "SQL डाउनलोड करें",
    "install": "{label} इंस्टॉल करें"
  },
  "titles": {
    "record": "रिकॉर्ड",
    "exportDb": "डेटाबेस निर्यात करें",
    "editRecord": "रिकॉर्ड संपादित करें · {table}",
    "newRecord": "नया रिकॉर्ड · {table}"
  },
  "labels": {
    "tablesLabel": "टेबल",
    "allTables": "सभी",
    "includeData": "डेटा शामिल करें",
    "active": "सक्रिय",
    "actions": "क्रियाएं",
    "colName": "कॉलम",
    "colType": "प्रकार",
    "colNullable": "शून्य",
    "colKey": "कुंजी",
    "colDefault": "डिफ़ॉल्ट",
    "yes": "हाँ",
    "no": "नहीं",
    "primaryKey": "प्राथमिक कुंजी",
    "tbl": "टेबल"
  },
  "install": {
    "title": "डेटाबेस इंजन इंस्टॉल करें",
    "description": "कनेक्टेड सर्वर पर MariaDB या PostgreSQL इंस्टॉल करें और डेटाबेस प्रबंधन शुरू करें।",
    "mariadb": "MariaDB",
    "postgresql": "PostgreSQL"
  },
  "empty": {
    "noResults": "कोई परिणाम नहीं।",
    "noEngines": "सर्वर पर कोई सक्रिय डेटाबेस इंजन नहीं है। शुरू करने के लिए एक इंस्टॉल करें।",
    "noDatabases": "कोई डेटाबेस नहीं।",
    "noTables": "कोई टेबल नहीं।"
  },
  "errors": {
    "detectEngines": "इंजन पता लगाने में त्रुटि",
    "loadRows": "पंक्तियाँ लोड करने में त्रुटि",
    "saveRecord": "रिकॉर्ड सहेजा नहीं जा सका",
    "deleteRecord": "रिकॉर्ड हटाया नहीं जा सका",
    "networkError": "नेटवर्क त्रुटि",
    "runQuery": "क्वेरी चलाने में त्रुटि"
  },
  "loading": {
    "generic": "लोड हो रहा है…",
    "rows": "पंक्तियाँ लोड हो रही हैं…",
    "structure": "संरचना लोड हो रही है…",
    "tablesExport": "टेबल लोड हो रही हैं…",
    "running": "चल रहा है…"
  },
  "toasts": {
    "engineInstalled": "{label} इंस्टॉल हो गया",
    "noColumnsMetadata": "इस टेबल के लिए कॉलम मेटाडेटा उपलब्ध नहीं",
    "recordUpdated": "रिकॉर्ड अपडेट हुआ",
    "recordCreated": "रिकॉर्ड बना",
    "recordDeleted": "रिकॉर्ड हटाया गया",
    "noTableSelect": "कम से कम एक टेबल चुनें",
    "exportDownloaded": "निर्यात डाउनलोड हो गया",
    "selectEngineFirst": "पहले एक इंजन चुनें",
    "statementExecuted": "स्टेटमेंट निष्पादित हुआ"
  },
  "confirm": {
    "deleteRecord": "यह रिकॉर्ड हटाएं? यह क्रिया पूर्ववत नहीं की जा सकती।",
    "deleteTitle": "रिकॉर्ड हटाएं",
    "deleteConfirmText": "हटाएं"
  },
  "info": {
    "installing": "{label} इंस्टॉल हो रहा है… इसमें कुछ मिनट लग सकते हैं।",
    "installed": "{label} इंस्टॉल हो गया। इंजन पता लगाया जा रहा है…",
    "pager": "{from}–{to} पंक्तियाँ ({limit} प्रति पृष्ठ)",
    "statementExecuted": "स्टेटमेंट निष्पादित हुआ",
    "rowCount": "{count} पंक्ति(याँ)",
    "truncated": "· परिणाम {count} पंक्तियों तक सीमित"
  },
  "runtime": {
    "createPromptWithPrefix": "नाम {prefix} से शुरू होना चाहिए और आपके कोटे के भीतर होना चाहिए।",
    "createPrompt": "सक्रिय सर्वर पर नए डेटाबेस का नाम।",
    "invalidPrefix": "नाम {prefix} से शुरू होना चाहिए",
    "createError": "डेटाबेस नहीं बनाया जा सका।",
    "created": "डेटाबेस बनाया गया।"
  },
  "settings": {
    "title": "डेटाबेस सेटिंग",
    "description": "डेटाबेस मॉड्यूल की प्राथमिकताएँ।",
    "table": "तालिका",
    "pagination": "पृष्ठांकन",
    "rowsPerPage": "संरचना और कंसोल के परिणामों में प्रति पृष्ठ पंक्तियाँ।",
    "serverPagination": "रिकॉर्ड तालिका सर्वर पृष्ठांकन का उपयोग करती है; इसे यहाँ बदला नहीं जा सकता।",
    "relatedModules": "संबंधित मॉड्यूल",
    "hostingQuotas": "होस्टिंग और कोटा",
    "databaseBackups": "डेटाबेस बैकअप",
    "sqlFiles": "SQL फ़ाइलें",
    "allowWriteDefault": "कंसोल खोलने पर डिफ़ॉल्ट रूप से लिखने की अनुमति दें",
    "allowWriteHelp": "मॉड्यूल लोड होने पर यह लागू होता है; इसे कंसोल में कभी भी बदल सकते हैं।",
    "createDatabase": "डेटाबेस बनाएँ",
    "create": "बनाएँ"
  }
} as const;

export default databases;
