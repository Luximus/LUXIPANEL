// Auto-split fragment of mail.ts (part 2/2) — data only, keeps <1000 lines.
// Do not reorder keys: the aggregator merges parts by spread in original order.
const mailPart2 = {
  "routing": {
    "labels": {
      "autoRemote": "स्वचालित कॉन्फ़िगरेशन: रिमोट",
      "local": "स्थानीय मेल एक्सचेंजर",
      "backup": "बैकअप मेल एक्सचेंजर",
      "remote": "रिमोट मेल एक्सचेंजर"
    },
    "currentMode": "वर्तमान: {mode}"
  },
  "tracking": {
    "statuses": {
      "success": "सफल",
      "deferred": "स्थगित",
      "failure": "विफल",
      "inProgress": "प्रगति में",
      "unknown": "अज्ञात"
    },
    "columns": {
      "event": "घटना",
      "fromAddress": "प्रेषक पता",
      "sentTime": "भेजने का समय",
      "spamScore": "स्पैम स्कोर",
      "recipient": "प्राप्तकर्ता",
      "domain": "डोमेन",
      "id": "ID",
      "result": "परिणाम",
      "actions": "क्रियाएं"
    },
    "noRecordsFound": "कोई रिकॉर्ड नहीं मिला।",
    "zeroRecords": "0 रिकॉर्ड",
    "matchesZeroRecords": "खोज से 0 रिकॉर्ड मिले।",
    "recordsCount": "{count} रिकॉर्ड",
    "matchesRecords": "खोज से {count} रिकॉर्ड मिले।",
    "detailMeta": "घटना: {event} | ID: {id} | प्राप्तकर्ता: {recipient}"
  },
  "filters": {
    "ruleParts": {
      "from": "प्रेषक",
      "subject": "विषय",
      "to": "प्राप्तकर्ता",
      "anyRecipient": "कोई भी प्राप्तकर्ता",
      "reply": "उत्तर",
      "body": "मुख्य भाग",
      "anyHeader": "कोई भी हेडर",
      "notDelivered": "पहले डिलीवर नहीं हुआ",
      "errorMessage": "त्रुटि संदेश है",
      "listId": "सूची ID",
      "spamStatus": "स्पैम स्थिति",
      "spamBar": "स्पैम बार",
      "spamScore": "स्पैम स्कोर"
    },
    "matches": {
      "contains": "शामिल है",
      "matchesRegex": "regex से मेल खाता है",
      "doesNotContain": "शामिल नहीं है",
      "equals": "बराबर है",
      "beginsWith": "से शुरू होता है",
      "endsWith": "पर समाप्त होता है",
      "doesNotBegin": "से शुरू नहीं होता",
      "doesNotEnd": "पर समाप्त नहीं होता",
      "doesNotMatch": "मेल नहीं खाता",
      "isAbove": "से अधिक है (केवल संख्याएं)",
      "isNotAbove": "से अधिक नहीं है (केवल संख्याएं)",
      "isBelow": "से कम है (केवल संख्याएं)",
      "isNotBelow": "से कम नहीं है (केवल संख्याएं)"
    },
    "actions": {
      "discard": "संदेश छोड़ें",
      "redirect": "ईमेल पर रीडायरेक्ट करें",
      "fail": "संदेश के साथ विफल करें",
      "stop": "नियम प्रक्रिया रोकें",
      "deliverToFolder": "फ़ोल्डर में डिलीवर करें",
      "pipe": "प्रोग्राम को पाइप करें"
    },
    "joinOp": {
      "and": "और",
      "or": "या"
    },
    "removeBtn": "-"
  },
  "defaultAddress": {
    "currentSetting": {
      "none": "वर्तमान सेटिंग: (कोई नहीं)",
      "forward": "वर्तमान सेटिंग: {destination}",
      "forwardDefault": "(फॉरवर्ड)",
      "fail": "वर्तमान सेटिंग: :fail: {message}"
    },
    "defaultFailMessage": "ऐसा कोई उपयोगकर्ता नहीं है"
  },
  "archive": {
    "retentionOptions": {
      "oneMonth": "1 माह",
      "threeMonths": "3 माह",
      "sixMonths": "6 माह",
      "oneYear": "1 वर्ष",
      "twoYears": "2 वर्ष",
      "fiveYears": "5 वर्ष",
      "tenYears": "10 वर्ष",
      "forever": "हमेशा के लिए",
      "custom": "कस्टम"
    },
    "fields": {
      "incomingEmail": "आने वाले ईमेल संदेश",
      "outgoingMailingList": "जाने वाली मेलिंग सूची के ईमेल संदेश",
      "outgoingEmail": "जाने वाले ईमेल संदेश"
    }
  },
  "encryption": {
    "neverExpires": "कभी समाप्त नहीं होता"
  },
  "actions": {
    "view": "देखें",
    "save": "सहेजें",
    "clone": "क्लोन करें",
    "copy": "कॉपी करें",
    "delete": "हटाएँ",
    "edit": "संपादित करें",
    "remove": "हटाएँ"
  },
  "outbound": {
    "cardTitle": "पैनल ईमेल भेजना (SMTP)",
    "cardDesc": "डिफ़ॉल्ट खाता या बाहरी SMTP जिससे पैनल रिपोर्ट और सिस्टम ईमेल भेजता है।",
    "back": "वापस",
    "intro": "वह पहचान जिससे LUXIPANEL सिस्टम ईमेल भेजता है (cron एजेंट रिपोर्ट, अनुमोदन लिंक, परीक्षण)। यह इस सर्वर का एक ईमेल खाता या सर्वर से बाहर का बाहरी SMTP हो सकता है।",
    "modeLabel": "भेजने का मोड",
    "modeDisabled": "अक्षम",
    "modeAccount": "सर्वर का ईमेल खाता (डिफ़ॉल्ट)",
    "modeExternal": "बाहरी SMTP",
    "accountLabel": "डिफ़ॉल्ट भेजने वाला खाता",
    "accountHint": "उस खाते की संग्रहीत SMTP क्रेडेंशियल का उपयोग करता है।",
    "hostLabel": "SMTP सर्वर",
    "portLabel": "पोर्ट",
    "userLabel": "उपयोगकर्ता",
    "passLabel": "पासवर्ड",
    "passPlaceholder": "(कोई बदलाव नहीं)",
    "fromLabel": "प्रेषक (ईमेल)",
    "fromNameLabel": "प्रेषक का नाम",
    "secureLabel": "प्रत्यक्ष TLS (पोर्ट 465)",
    "save": "सहेजें",
    "testPlaceholder": "to@example.com",
    "test": "परीक्षण भेजें",
    "hostPlaceholder": "smtp.example.com",
    "fromPlaceholder": "sender@example.com",
    "fromNamePlaceholder": "मेरी कंपनी"
  },
  "table": {
    "status": {
      "active": "सक्रिय",
      "inactive": "निष्क्रिय",
      "disabled": "निष्क्रिय"
    },
    "redirect": {
      "columns": {
        "domain": "डोमेन",
        "destinos": "गंतव्य"
      },
      "filters": {
        "searchDomain": "डोमेन खोजें…"
      },
      "rowActions": {
        "edit": "संपादित करें",
        "delete": "हटाएं"
      }
    },
    "encryption": {
      "columns": {
        "keyId": "कुंजी ID",
        "label": "पहचान",
        "keySize": "कुंजी आकार",
        "created": "निर्मित",
        "expires": "समाप्त होता है"
      },
      "filters": {
        "searchKey": "कुंजी खोजें…"
      },
      "rowActions": {
        "view": "देखें",
        "delete": "हटाएं"
      }
    },
    "accounts": {
      "columns": {
        "address": "पता",
        "domain": "डोमेन",
        "uso": "कोटा / उपयोग",
        "reenvios": "फ़ॉरवर्ड",
        "estado": "स्थिति"
      },
      "filters": {
        "search": "पता या डोमेन खोजें…",
        "domain": "डोमेन",
        "estado": "स्थिति"
      },
      "rowActions": {
        "edit": "खाता संपादित करें",
        "depurarIa": "AI से साफ़ करें",
        "password": "पासवर्ड बदलें",
        "toggle": "सक्षम / अक्षम करें",
        "inbox": "मेलबॉक्स खोलें",
        "signatures": "हस्ताक्षर प्रबंधित करें",
        "default": "डिफ़ॉल्ट के रूप में उपयोग करें",
        "contacts": "संपर्क प्रबंधित करें",
        "calendars": "कैलेंडर प्रबंधित करें",
        "autoresponder": "ऑटोरेस्पॉन्डर प्रबंधित करें",
        "filters": "फ़िल्टर प्रबंधित करें",
        "forwards": "फ़ॉरवर्ड प्रबंधित करें",
        "diskusage": "डिस्क उपयोग प्रबंधित करें",
        "clone": "मेल क्लोन करें",
        "delete": "खाता हटाएँ"
      },
      "quickActions": {
        "bulkForward": "फ़ॉरवर्ड जोड़ें",
        "bulkQuota": "कोटा बदलें",
        "bulkDelete": "खाते हटाएं"
      }
    },
    "globalFilters": {
      "columns": {
        "name": "फ़िल्टर",
        "estado": "स्थिति",
        "rules": "नियम",
        "actionsCount": "क्रियाएं"
      },
      "filters": {
        "search": "फ़िल्टर खोजें…"
      },
      "rowActions": {
        "edit": "संपादित करें",
        "delete": "हटाएं"
      }
    },
    "contacts": {
      "columns": {
        "email": "ईमेल",
        "name": "नाम"
      },
      "filters": {
        "searchEmail": "ईमेल खोजें…"
      },
      "rowActions": {
        "edit": "संपादित करें",
        "delete": "हटाएं"
      }
    },
    "calendars": {
      "columns": {
        "name": "नाम",
        "timezone": "टाइमज़ोन",
        "estado": "स्थिति"
      },
      "filters": {
        "search": "कैलेंडर खोजें…"
      },
      "rowActions": {
        "edit": "संपादित करें",
        "delete": "हटाएं"
      }
    },
    "signatures": {
      "columns": {
        "sender": "प्रेषक",
        "preview": "हस्ताक्षर"
      },
      "filters": {
        "search": "फ़िल्टर और खोजें…"
      },
      "rowActions": {
        "edit": "संपादित करें",
        "delete": "हटाएं"
      }
    },
    "filters": {
      "columns": {
        "name": "नाम",
        "estado": "स्थिति"
      },
      "filters": {
        "search": "फ़िल्टर खोजें…"
      },
      "rowActions": {
        "edit": "संपादित करें",
        "delete": "हटाएं"
      }
    }
  },
  "confirm": {
    "bulkDeleteAccounts": "{count} email खाता हटाएँ? यह क्रिया पूर्ववत नहीं की जा सकती।",
    "deleteAccount": "खाता {address} हटाएँ? यह क्रिया पूर्ववत नहीं की जा सकती।",
    "deleteAccountTitle": "खाता हटाएँ",
    "deleteAutoresponder": "इस खाते का autoresponder हटाएँ?",
    "deleteByDate": "{from} और {to} के बीच {folder} के email हटाए जाएँगे। जारी रखें?",
    "deleteByDateTitle": "दिनांक के अनुसार email हटाएँ",
    "deleteCalendar": "कैलेंडर \"{label}\" हटाएँ?",
    "deleteCalendarTitle": "कैलेंडर हटाएँ",
    "deleteContact": "संपर्क \"{label}\" हटाएँ?",
    "deleteContactTitle": "संपर्क हटाएँ",
    "deleteDomainForward": "@{domain} का वैश्विक रीडायरेक्ट हटाएँ?",
    "deleteDomainForwardTitle": "वैश्विक रीडायरेक्ट हटाएँ",
    "deleteEncryptionKey": "यह एन्क्रिप्शन कुंजी हटाएँ?",
    "deleteFilter": "फ़िल्टर \"{name}\" हटाएँ?",
    "deleteFilterTitle": "फ़िल्टर हटाएँ",
    "deleteForward": "{destination} पर फ़ॉरवर्ड हटाएँ?",
    "deleteGlobalFilter": "वैश्विक फ़िल्टर \"{label}\" हटाएँ?",
    "deleteGlobalFilterTitle": "वैश्विक फ़िल्टर हटाएँ",
    "yesDelete": "हाँ, हटाएँ"
  },
  "empty": {
    "noDomains": "कोई domain नहीं",
    "noFolders": "इस खाते के लिए कोई फ़ोल्डर नहीं मिला।",
    "noOtherAccount": "कोई अन्य खाता उपलब्ध नहीं"
  },
  "errors": {
    "accountCreateFailed": "खाता बनाने में त्रुटि",
    "accountNotFound": "खाता नहीं मिला",
    "accountUpdateFailed": "खाता अपडेट करने में त्रुटि",
    "accountUpdatedForwardsFailed": "खाता अपडेट हो गया, परंतु फ़ॉरवर्ड अपडेट करना विफल रहा",
    "accountsLoadFailed": "खाते लोड करने में त्रुटि",
    "autoDeleteThresholdInvalid": "स्वतः-हटाएँ थ्रेशोल्ड अमान्य है।",
    "autoresponderDeleteFailed": "autoresponder हटाया नहीं जा सका",
    "autoresponderSaveFailed": "autoresponder सहेजा नहीं जा सका।",
    "calendarDeleteFailed": "कैलेंडर हटाया नहीं जा सका",
    "calendarNotFound": "कैलेंडर नहीं मिला",
    "calendarSaveFailed": "कैलेंडर सहेजा नहीं जा सका।",
    "cloneCreateFailed": "नया खाता नहीं बनाया जा सका।",
    "cloneFailed": "email क्लोन नहीं किया जा सका।",
    "cloneIdResolveFailed": "खाता बन गया, परंतु इसका ID हल नहीं किया जा सका। 'मौजूदा' के रूप में पुनः प्रयास करें।",
    "cloneLocalAndDomainRequired": "लोकल भाग और domain दर्ज करें।",
    "clonePasswordTooShort": "पासवर्ड में कम से कम 6 वर्ण होने चाहिए।",
    "contactDeleteFailed": "संपर्क हटाया नहीं जा सका",
    "contactNotFound": "संपर्क नहीं मिला",
    "contactSaveFailed": "संपर्क सहेजा नहीं जा सका।",
    "copyByRangeFailed": "रेंज के अनुसार कॉपी नहीं किया जा सका",
    "customScoreInvalid": "कस्टम स्कोर अमान्य है।",
    "dateRangeRequired": "आपको आरंभ और अंतिम दिनांक चुनना होगा",
    "defaultAddressLoadFailed": "डिफ़ॉल्ट पता लोड नहीं किया जा सका।",
    "defaultAddressSaveFailed": "डिफ़ॉल्ट पता सहेजा नहीं जा सका।",
    "deleteByRangeFailed": "रेंज के अनुसार हटाया नहीं जा सका",
    "deleteFailed": "हटाने में त्रुटि",
    "destEmailInvalid": "गंतव्य email अमान्य",
    "destinationsInvalidFormat": "एक या अधिक गंतव्यों का प्रारूप अमान्य है।",
    "diskUsageLoadFailed": "डिस्क उपयोग लोड नहीं किया जा सका",
    "domainForwardDeleteFailed": "वैश्विक रीडायरेक्ट हटाया नहीं जा सका।",
    "domainForwardsLoadFailed": "वैश्विक रीडायरेक्ट लोड नहीं किए जा सके।",
    "domainRedirectSaveFailed": "वैश्विक रीडायरेक्ट सहेजा नहीं जा सका।",
    "domainsLoadFailed": "DNS domain लोड नहीं किए जा सके",
    "filterDeleteFailed": "फ़िल्टर हटाया नहीं जा सका",
    "filterNotFound": "फ़िल्टर नहीं मिला",
    "filterSaveFailed": "फ़िल्टर सहेजा नहीं जा सका।",
    "forwardAlreadyExists": "{destination} पर पहले से एक फ़ॉरवर्ड मौजूद है",
    "forwardsSaveFailed": "सर्वर पर फ़ॉरवर्ड सहेजे नहीं जा सके",
    "globalFilterDeleteFailed": "वैश्विक फ़िल्टर हटाया नहीं जा सका।",
    "globalFilterSaveFailed": "वैश्विक फ़िल्टर सहेजा नहीं जा सका।",
    "globalFilterTestFailed": "परीक्षण निष्पादित नहीं किया जा सका।",
    "globalFiltersLoadFailed": "वैश्विक फ़िल्टर लोड नहीं किए जा सके।",
    "indicateTestDestEmail": "परीक्षण का गंतव्य email दर्ज करें।",
    "localPartInvalid": "@ से पहले के उपयोगकर्ता का प्रारूप अमान्य है।",
    "localPartInvalidNoPoint": "@ से पहले के उपयोगकर्ता का प्रारूप अमान्य है",
    "mustAddAtLeastOneAction": "आपको कम से कम एक क्रिया जोड़नी होगी।",
    "mustAddAtLeastOneDestEmail": "आपको कम से कम एक गंतव्य email जोड़ना होगा।",
    "mustAddAtLeastOneRule": "आपको कम से कम एक नियम जोड़ना होगा।",
    "mustEnterBody": "आपको संदेश की सामग्री दर्ज करनी होगी।",
    "mustEnterSubject": "आपको एक विषय दर्ज करना होगा।",
    "mustEnterTestMessage": "आपको एक परीक्षण संदेश दर्ज करना होगा।",
    "mustEnterValidDestEmail": "आपको एक मान्य गंतव्य email दर्ज करना होगा।",
    "mustIndicateCalendarName": "आपको कैलेंडर का नाम दर्ज करना होगा।",
    "mustIndicateContactEmail": "आपको संपर्क का email दर्ज करना होगा।",
    "mustIndicateFilterName": "आपको फ़िल्टर का नाम दर्ज करना होगा।",
    "mustIndicateName": "आपको एक नाम दर्ज करना होगा।",
    "mustSelectDomain": "आपको एक domain चुनना होगा।",
    "mustSelectDomainNoPoint": "आपको एक domain चुनना होगा",
    "noAutoresponderToDelete": "हटाने के लिए कोई autoresponder नहीं है",
    "passwordChangeFailed": "पासवर्ड बदलने में त्रुटि",
    "quotaInvalid": "quota अमान्य",
    "routingLoadFailed": "ईमेल रूटिंग कॉन्फ़िगरेशन लोड नहीं किया जा सका।",
    "routingSaveFailed": "ईमेल रूटिंग कॉन्फ़िगरेशन सहेजा नहीं जा सका।",
    "saveFailed": "सहेजने में त्रुटि",
    "scoreTypesLoadFailed": "स्कोर प्रकारों का कैटलॉग लोड नहीं किया जा सका।",
    "selectDestAccount": "एक गंतव्य खाता चुनें",
    "selectValidDomain": "एक मान्य domain चुनें।",
    "spamFiltersLoadFailed": "स्पैम फ़िल्टर लोड नहीं किए जा सके।",
    "spamFiltersSaveFailed": "स्पैम फ़िल्टर कॉन्फ़िगरेशन सहेजा नहीं जा सका।",
    "testEmailFailed": "परीक्षण भेजना विफल रहा",
    "toggleFailed": "स्थिति बदलने में त्रुटि",
    "trackDeliveryLoadFailed": "डिलीवरी ट्रैकिंग लोड नहीं किया जा सका।"
  },
  "labels": {
    "accountColon": "खाता: {address}",
    "activating": "सक्रिय किया जा रहा है",
    "cloneStartedBg": "क्लोनिंग पृष्ठभूमि में शुरू हो गई। पूरा होने पर हम आपको सूचनाओं के माध्यम से सूचित करेंगे।",
    "cloning": "क्लोन किया जा रहा है…",
    "currentAccountColon": "वर्तमान खाता: {address}",
    "deactivating": "निष्क्रिय किया जा रहा है",
    "destEmailForCount": "{count} खाते में जोड़ने हेतु फ़ॉरवर्ड का गंतव्य email:",
    "loading": "लोड हो रहा है...",
    "newQuotaFor": "{count} खाते के लिए MB में नई quota। असीमित के लिए 0 का उपयोग करें।",
    "no": "नहीं",
    "noGlobalLimit": "कोई वैश्विक सीमा नहीं",
    "originColon": "स्रोत: {addr}",
    "sendingTest": "परीक्षण भेजा जा रहा है…",
    "sudoPromptMessage": "सर्वर पर बिना विशेषाधिकारों के मेलबॉक्स का उपयोग नहीं पढ़ा जा सकता। SSH उपयोगकर्ता का sudo पासवर्ड दर्ज करें (सर्वर पर एन्क्रिप्टेड रूप में सहेजा जाता है)।",
    "to": "को",
    "total": "कुल",
    "unlimited": "असीमित",
    "yes": "हाँ",
    "keepCopy": "प्रति सहेजें"
  },
  "placeholders": {
    "passwordNoChanges": "•••••••• (कोई बदलाव नहीं)",
    "selectDomain": "domain चुनें...",
    "value": "मान",
    "valueIfApplicable": "मान (यदि लागू हो)"
  },
  "status": {
    "active": "सक्रिय",
    "deactivated": "निष्क्रिय",
    "inactive": "निष्क्रिय"
  },
  "titles": {
    "addForward": "फ़ॉरवर्ड जोड़ें",
    "changeQuota": "quota बदलें",
    "deleteAccounts": "खाते हटाएँ",
    "deleteAutoresponder": "autoresponder हटाएँ",
    "deleteEncryptionKey": "कुंजी हटाएँ",
    "deleteForward": "फ़ॉरवर्ड हटाएँ"
  },
  "toasts": {
    "accountActivated": "खाता सक्रिय किया गया",
    "accountCreated": "खाता सफलतापूर्वक बनाया गया",
    "accountDeactivated": "खाता निष्क्रिय किया गया",
    "accountDeleted": "खाता हटाया गया",
    "accountUpdated": "खाता अपडेट किया गया ({localPart}@{domain})",
    "archiveDefaultUpdated": "आर्काइव का default कॉन्फ़िगरेशन अपडेट किया गया।",
    "archiveDomainUpdated": "{domain} के लिए आर्काइव अपडेट किया गया।",
    "autoDeleteDisabled": "स्वतः-हटाएँ अक्षम किया गया",
    "autoDeleteEnabled": "स्वतः-हटाएँ सक्षम किया गया",
    "autoDeleteUpdated": "स्वतः-हटाएँ अपडेट किया गया",
    "autoresponderDeleted": "autoresponder हटाया गया",
    "autoresponderSaved": "autoresponder सहेजा गया",
    "blacklistUpdated": "काली सूची अपडेट की गई",
    "bulkDeletedCount": "{ok}/{count} खाता हटाया गया",
    "bulkUpdatedCount": "{ok}/{count} खाता अपडेट किया गया",
    "calculatedScoresUpdated": "परिकलित स्कोर अपडेट किए गए",
    "calendarCreated": "कैलेंडर बनाया गया",
    "calendarDeleted": "कैलेंडर हटाया गया",
    "calendarUpdated": "कैलेंडर अपडेट किया गया",
    "cloneStarted": "क्लोनिंग शुरू हुई — पूरा होने पर हम आपको सूचित करेंगे",
    "contactCreated": "संपर्क बनाया गया",
    "contactDeleted": "संपर्क हटाया गया",
    "contactUpdated": "संपर्क अपडेट किया गया",
    "defaultAddressUpdated": "@{domain} के लिए डिफ़ॉल्ट पता अपडेट किया गया",
    "defaultInboxSet": "{address} अब डिफ़ॉल्ट email है",
    "domainForwardDeleted": "@{domain} का वैश्विक रीडायरेक्ट हटाया गया",
    "emailRoutingUpdated": "@{domain} के लिए ईमेल रूटिंग अपडेट किया गया",
    "emailsCopied": "{folder} के {count} email कॉपी किए गए",
    "emailsDeleted": "{folder} के {count} email हटाए गए",
    "filterCreated": "फ़िल्टर बनाया गया",
    "filterDeleted": "फ़िल्टर हटाया गया",
    "filterUpdated": "फ़िल्टर अपडेट किया गया",
    "forwardAddedCount": "{ok}/{count} खाते में फ़ॉरवर्ड जोड़ा गया",
    "forwardDeleted": "फ़ॉरवर्ड हटाया गया",
    "forwardsUpdated": "फ़ॉरवर्ड अपडेट किए गए",
    "globalFilterCreated": "वैश्विक फ़िल्टर बनाया गया",
    "globalFilterDeleted": "वैश्विक फ़िल्टर हटाया गया",
    "globalFilterUpdated": "वैश्विक फ़िल्टर अपडेट किया गया",
    "globalRedirectSaved": "@{domain} के लिए वैश्विक रीडायरेक्ट सहेजा गया",
    "keyDeleted": "कुंजी हटाई गई।",
    "keyGenerated": "कुंजी जनरेट की गई।",
    "passwordUpdated": "पासवर्ड अपडेट किया गया",
    "publicKeyImported": "सार्वजनिक कुंजी आयात की गई।",
    "settingsSaved": "कॉन्फ़िगरेशन सहेजा गया ✓",
    "spamBoxDisabled": "स्पैम बॉक्स अक्षम किया गया",
    "spamBoxEnabled": "स्पैम बॉक्स सक्षम किया गया",
    "spamBoxUpdated": "स्पैम बॉक्स अपडेट किया गया",
    "spamFiltersDisabled": "स्पैम फ़िल्टर अक्षम किए गए",
    "spamFiltersEnabled": "स्पैम फ़िल्टर सक्षम किए गए",
    "spamThresholdUpdated": "स्पैम सीमा अपडेट किया गया",
    "testEmailSent": "परीक्षण email भेजा गया ✓",
    "whitelistUpdated": "श्वेतसूची अपडेट की गई"
  },
  "signaturesDrawer": {
    "title": "हस्ताक्षर",
    "addSignature": "हस्ताक्षर जोड़ें",
    "close": "बंद करें",
    "tableTitle": "हस्ताक्षर"
  },
  "dataTableTitles": {
    "rules": "नियम",
    "publicKeys": "सार्वजनिक कुंजियाँ",
    "privateKeys": "निजी कुंजियाँ",
    "accounts": "खाते",
    "globalFilters": "वैश्विक फ़िल्टर",
    "contacts": "संपर्क",
    "calendars": "कैलेंडर",
    "filters": "फ़िल्टर"
  },
  "trackColumns": {
    "event": "घटना",
    "fromAddress": "प्रेषक पता",
    "sentTime": "भेजने का समय",
    "spamScore": "स्पैम स्कोर",
    "recipient": "प्राप्तकर्ता",
    "domain": "डोमेन",
    "queueId": "ID",
    "result": "परिणाम",
    "actions": "क्रियाएँ"
  }
} as const;

export default mailPart2;
