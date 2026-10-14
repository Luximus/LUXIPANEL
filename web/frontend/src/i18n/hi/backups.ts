const backups = {
  "pageTitle": "बैकअप",
  "settings": {
    "title": "बैकअप सेटिंग्स",
    "description": "जुड़े हुए सर्वर के लिए गंतव्य और प्राथमिकताएँ।",
    "sections": "सेटिंग अनुभाग",
    "localHelp": "इस सर्वर के स्थानीय बैकअप यहाँ रखे जाते हैं।",
    "changeDirWarning": "फ़ोल्डर बदलने पर पुष्टि के बाद पुराने स्थानीय बैकअप मिटा दिए जाएँगे।",
    "retentionHelp": "मैन्युअल बैकअप और नए शेड्यूल के लिए। पुराने शेड्यूल की अपनी सीमा बनी रहेगी।",
    "save": "बदलाव सहेजें",
    "lastSuccess": "पिछला सफल बैकअप",
    "localCopies": "स्थानीय बैकअप",
    "activeSchedules": "सक्रिय शेड्यूल",
    "advancedCron": "कस्टम Cron अभिव्यक्ति",
    "loading": "सेटिंग लोड हो रही हैं…",
    "loadError": "इस सर्वर की सेटिंग लोड नहीं हो सकीं।",
    "pending": "बदलाव सहेजे नहीं गए हैं।",
    "countError": "1 से 365 बैकअप के बीच चुनें।",
    "saving": "सहेजा जा रहा है…",
    "saved": "सेटिंग सहेज दी गई हैं।",
    "previewError": "फ़ोल्डर की जाँच नहीं हो सकी।",
    "destinationNotEmpty": "नए फ़ोल्डर में LUXIPANEL बैकअप पहले से मौजूद हैं।",
    "changeConfirm": "{path} में {count} स्थानीय बैकअप मिटा दिए जाएँगे। S3/R2 बैकअप रहेंगे। फ़ोल्डर बदलें?",
    "changeTitle": "बैकअप फ़ोल्डर बदलें",
    "changeError": "फ़ोल्डर नहीं बदला जा सका।",
    "tables": "तालिकाएँ",
    "localHeading": "स्थानीय गंतव्य",
    "overview": "बैकअप स्थिति",
    "targetChanged": "सर्वर बदल गया है; इसकी सेटिंग फिर जाँचें।"
  },
  "status": {
    "completed": "पूर्ण",
    "failed": "विफल",
    "running": "प्रगति में"
  },
  "header": {
    "heading": "बैकअप",
    "subheading": "सर्वर फ़ाइलों, डेटाबेस, मेल और सेटिंग्स का बैकअप लें।",
    "btnBackupNow": "अभी बैकअप करें"
  },
  "configCard": {
    "title": "बैकअप कॉन्फ़िगरेशन",
    "subtitle": "स्थानीय निर्देशिका और दूरस्थ संग्रहण।",
    "labelLocalDir": "स्थानीय बैकअप निर्देशिका",
    "placeholderLocalDir": "/var/backups/luxipanel",
    "labelRetentionDefault": "डिफ़ॉल्ट रूप से रखे जाने वाले स्थानीय बैकअप",
    "s3Section": "S3 / Cloudflare R2",
    "labelEndpoint": "Endpoint",
    "labelBucket": "Bucket",
    "labelAccessKeyId": "एक्सेस कुंजी आईडी",
    "labelSecretAccessKey": "गुप्त एक्सेस कुंजी",
    "btnBrowse": "ब्राउज़ करें",
    "tabLocal": "स्थानीय",
    "tabCloud": "क्लाउड"
  },
  "pathBrowserDialog": {
    "title": "फ़ोल्डर चुनें",
    "btnUp": "ऊपर जाएँ",
    "btnCancel": "रद्द करें",
    "btnSelect": "यह फ़ोल्डर उपयोग करें"
  },
  "backupSources": {
    "title": "क्या बैकअप करें",
    "scopeFull": "पूरा सर्वर (क्यूरेटेड)",
    "scopeFullHint": "डेटाबेस, मेल, पैनल कॉन्फ़िगरेशन और /etc /home /var/www /root",
    "scopeCustom": "कस्टम",
    "labelDatabases": "डेटाबेस",
    "dbAll": "सभी",
    "dbPick": "चुनें…",
    "dbChoose": "डेटाबेस चुनें",
    "dbNone": "कोई चयन नहीं",
    "labelMail": "मेल (vmail + Postfix/Dovecot)",
    "labelPanelConfig": "पैनल कॉन्फ़िगरेशन",
    "foldersTitle": "फ़ोल्डर",
    "addFolder": "फ़ोल्डर जोड़ें",
    "noFolders": "कोई फ़ोल्डर चयनित नहीं"
  },
  "dbPickerDialog": {
    "title": "डेटाबेस चुनें",
    "loading": "लोड हो रहा है…",
    "btnCancel": "रद्द करें",
    "btnSelect": "चयन उपयोग करें",
    "btnRetry": "फिर से प्रयास करें",
    "unavailableSelection": "चयनित डेटाबेस अब उपलब्ध नहीं है। चयन की जाँच करें।"
  },
  "storagesSection": {
    "subtitle": "आपके बैकअप के लिए क्लाउड गंतव्य (S3 / Cloudflare R2)।",
    "tableTitle": "स्टोरेज",
    "btnNew": "नया storage"
  },
  "storageDialog": {
    "titleNew": "नया cloud storage",
    "titleEdit": "cloud storage संपादित करें",
    "labelName": "नाम",
    "placeholderName": "मेरा R2 bucket",
    "labelProvider": "प्रदाता",
    "optS3": "Amazon S3",
    "optR2": "Cloudflare R2",
    "labelBucket": "Bucket",
    "labelPrefix": "उपसर्ग (फ़ोल्डर)",
    "placeholderPrefix": "backups/",
    "labelEndpoint": "Endpoint",
    "labelRegion": "क्षेत्र",
    "labelAccessKey": "एक्सेस कुंजी आईडी",
    "labelSecret": "गुप्त एक्सेस कुंजी",
    "secretKeepHint": "वर्तमान गोपनीय कुंजी बनाए रखने के लिए खाली छोड़ें।",
    "btnCancel": "रद्द करें",
    "btnSave": "सहेजें",
    "usingCentralCred": "सेटिंग → क्रेडेंशियल की केंद्रीय क्रेडेंशियल उपयोग हो रही है (केवल bucket परिभाषित करें)।",
    "credRequired": "{provider} क्रेडेंशियल कॉन्फ़िगर नहीं है। इस गंतव्य को उपयोग करने के लिए सेटिंग → क्रेडेंशियल में दर्ज करें।",
    "credRequiredCta": "सेटिंग → क्रेडेंशियल पर जाएं"
  },
  "progress": {
    "creating": "बैकअप बनाया जा रहा है… इसमें कुछ मिनट लग सकते हैं।"
  },
  "historySection": {
    "title": "बैकअप इतिहास",
    "tableTitle": "बैकअप",
    "count": "{count} बैकअप",
    "countPartial": "कुल {total} में से {shown} बैकअप दिखाए जा रहे हैं"
  },
  "schedulesSection": {
    "title": "शेड्यूल",
    "btnNew": "नया",
    "loading": "लोड हो रहा है...",
    "active": "सक्रिय",
    "paused": "रुकी हुई",
    "copies": "प्रतियाँ",
    "pause": "रोकें",
    "enable": "चालू करें",
    "edit": "संपादित करें",
    "delete": "हटाएँ"
  },
  "backupDialog": {
    "title": "मैन्युअल बैकअप बनाएं",
    "labelName": "लेबल",
    "placeholderName": "pre-upgrade",
    "labelStorage": "भंडारण",
    "optionLocal": "स्थानीय",
    "optionS3": "AWS S3",
    "optionR2": "Cloudflare R2",
    "labelIncludeDb": "PostgreSQL डंप शामिल करें",
    "sourcesTitle": "क्या बैकअप करें",
    "labelIncludeDatabases": "डेटाबेस (MySQL/MariaDB + PostgreSQL)",
    "labelIncludeMail": "मेल खाते (मेलबॉक्स + कॉन्फ़िगरेशन)",
    "labelIncludePanelConfig": "LuxiPanel कॉन्फ़िगरेशन",
    "btnCancel": "रद्द करें",
    "btnStart": "बैकअप शुरू करें"
  },
  "scheduleDialog": {
    "title": "बैकअप शेड्यूल करें",
    "labelName": "नाम",
    "placeholderName": "साप्ताहिक बैकअप",
    "labelSchedule": "समय-सारणी (cron)",
    "placeholderSchedule": "0 3 * * 0",
    "labelStorage": "भंडारण",
    "optionLocal": "स्थानीय",
    "optionS3": "S3",
    "optionR2": "R2",
    "labelRetention": "रखे जाने वाले स्थानीय बैकअप",
    "labelFrequency": "आवृत्ति",
    "optHourly": "हर घंटे",
    "optDaily": "दैनिक",
    "optWeekly": "साप्ताहिक",
    "optMonthly": "मासिक",
    "labelTime": "समय",
    "labelWeekday": "सप्ताह का दिन",
    "labelMonthday": "महीने का दिन",
    "cronPreview": "के बराबर",
    "cronExample": "0 3 * * *",
    "weekdays": [
      "रविवार",
      "सोमवार",
      "मंगलवार",
      "बुधवार",
      "गुरुवार",
      "शुक्रवार",
      "शनिवार"
    ],
    "btnCancel": "रद्द करें",
    "btnSave": "सहेजें",
    "localRetentionHint": "इस शेड्यूल के सबसे हाल के स्थानीय बैकअप रखे जाएँगे।",
    "cloudRetentionHint": "S3/R2 बैकअप रखने की अवधि क्लाउड प्रदाता के पास तय करें।",
    "editTitle": "शेड्यूल संपादित करें"
  },
  "toasts": {
    "errorSaveSettings": "बैकअप सेटिंग सहेजने में त्रुटि",
    "preparingDownload": "डाउनलोड तैयार हो रहा है…",
    "backupDeleted": "बैकअप हटाया गया",
    "backupsDeleted": "बैकअप हटाए गए",
    "scheduleDeleted": "शेड्यूल हटाया गया",
    "errorDelete": "हटाने में त्रुटि",
    "errorCreateBackup": "बैकअप बनाने में त्रुटि",
    "backupStarted": "बैकअप शुरू हुआ",
    "backupCompleted": "बैकअप पूर्ण हुआ",
    "backupStillRunning": "बैकअप अभी भी चल रहा है…",
    "scheduleCreated": "शेड्यूल बनाया गया",
    "errorCreateSchedule": "शेड्यूल बनाने में त्रुटि",
    "storageDeleted": "स्टोरेज हटाया गया",
    "storageUpdated": "स्टोरेज अपडेट हुआ",
    "storageCreated": "स्टोरेज बनाया गया",
    "errorSaveStorage": "स्टोरेज सहेजने में त्रुटि",
    "recordRemoved": "रिकॉर्ड इतिहास से हटाया गया"
  },
  "errors": {
    "listPathFailed": "यह पथ सूचीबद्ध नहीं हो सका (अनुमति?)।",
    "listDbFailed": "डेटाबेस सूचीबद्ध नहीं हो सके।",
    "downloadFailed": "बैकअप डाउनलोड नहीं हो सका",
    "backupErrorDetail": "त्रुटि: {error}"
  },
  "empty": {
    "noSubfolders": "(कोई सबफ़ोल्डर नहीं)",
    "noDbEngines": "कोई सक्रिय DB इंजन नहीं मिला।",
    "noDatabases": "(कोई डेटाबेस नहीं)",
    "noneSelected": "कोई चयन नहीं",
    "noSchedules": "कोई शेड्यूल नहीं"
  },
  "labels": {
    "loading": "लोड हो रहा है…",
    "fullServer": "पूरा सर्वर",
    "editStorage": "स्टोरेज संपादित करें",
    "newStorage": "नया स्टोरेज"
  },
  "confirm": {
    "deleteBackup": "बैकअप \"{label}\" हटाएं?",
    "deleteBackupTitle": "बैकअप हटाएं",
    "deleteBulkBackup": "{count} चयनित बैकअप हटाएं?",
    "deleteBulkBackupTitle": "बैकअप हटाएं",
    "deleteSchedule": "यह शेड्यूल हटाएं?",
    "deleteScheduleTitle": "शेड्यूल हटाएं",
    "deleteStorage": "स्टोरेज \"{name}\" हटाएं?",
    "deleteStorageTitle": "स्टोरेज हटाएं",
    "removeRecord": "«{label}» को इतिहास से हटाएँ? क्लाउड में मौजूद ऑब्जेक्ट बना रहेगा।",
    "removeRecordTitle": "रिकॉर्ड हटाएँ",
    "cloudBulkNote": "S3/R2 ऑब्जेक्ट बने रहेंगे।"
  },
  "table": {
    "columns": {
      "label": "लेबल",
      "status": "स्थिति",
      "size": "आकार",
      "storage": "भंडारण",
      "fecha": "तारीख"
    },
    "storagesColumns": {
      "name": "नाम",
      "provider": "प्रदाता",
      "bucket": "Bucket",
      "endpoint": "Endpoint"
    },
    "filters": {
      "searchBackupLabel": "लेबल खोजें...",
      "filterBackupStorage": "भंडारण",
      "searchStorageName": "नाम खोजें...",
      "filterStorageProvider": "प्रदाता"
    },
    "rowActions": {
      "download": "डाउनलोड करें",
      "removeRecord": "इतिहास से हटाएँ",
      "details": "त्रुटि देखें",
      "delete": "हटाएं",
      "refresh": "स्थिति रीफ़्रेश करें"
    },
    "quickActions": {
      "deleteSelected": "चयनित हटाएँ"
    },
    "storagesRowActions": {
      "edit": "संपादित करें",
      "delete": "हटाएं"
    }
  }
} as const;

export default backups;
