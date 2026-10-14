const settings = {
  "passkeyName": {
    "title": "पासकी का नाम",
    "hint": "ऐसा नाम दें जिससे आप डिवाइस पहचान सकें।",
    "placeholder": "जैसे: निजी लैपटॉप",
    "save": "नाम सहेजें",
    "edit": "नाम बदलें",
    "invalid": "1 से 128 अक्षरों का नाम दर्ज करें।",
    "saved": "नाम अपडेट हो गया",
    "error": "नाम सहेजा नहीं जा सका।",
    "cancel": "रद्द करें"
},
  "placeholders": {
    "logoUrl": "https://example.com/logo.png",
    "imageUrl": "https://…/image.jpg"
  },
  "pageTitle": "सेटिंग्स",
  "loadFailure": {
    "title": "सेटिंग्स लोड नहीं हो सकीं",
    "sessionMessage": "सेटिंग्स लोड नहीं हो सकीं: सर्वर के साथ आपका सत्र उपलब्ध नहीं है। सिलेक्टर में सर्वर फिर से चुनें, या लॉग आउट करके दोबारा लॉग इन करें।",
    "genericMessage": "सेटिंग्स लोड नहीं हो सकीं। अपना कनेक्शन जाँचें और पुनः प्रयास करें।",
    "retry": "पुनः प्रयास करें"
  },
  "header": {
    "title": "पैनल सेटिंग्स",
    "subtitle": "LUXIPANEL का वैश्विक कॉन्फ़िगरेशन",
    "autosave": "स्वतः सहेजना"
  },
  "tabs": {
    "general": "सामान्य",
    "layoutUi": "Layout/UI",
    "security": "सुरक्षा",
    "modules": "मॉड्यूल",
    "system": "सिस्टम",
    "credentials": "साख"
  },
  "credentials": {
    "hcaptcha": {
      "title": "hCaptcha",
      "desc": "hCaptcha चुनौती के साथ पैनल लॉगिन को सुरक्षित करें। अपने hCaptcha डैशबोर्ड से कुंजियाँ दर्ज करें।",
      "sitekeyLabel": "साइट कुंजी",
      "sitekeyPlaceholder": "आपकी hCaptcha साइट कुंजी",
      "secretLabel": "गुप्त कुंजी",
      "secretPlaceholder": "नई गुप्त कुंजी दर्ज करें",
      "secretConfigured": "एक गुप्त कुंजी पहले से सेट है। इसे बनाए रखने के लिए इस फ़ील्ड को खाली छोड़ें।",
      "statusConfigured": "कॉन्फ़िगर किया गया",
      "statusMissing": "कॉन्फ़िगर नहीं किया गया",
      "saved": "hCaptcha सेटिंग्स सहेजी गईं"
    },
    "tolqia": {
      "label": "Tolqia",
      "help": "आपके Tolqia खाते का API टोकन (Plus या Premium योजना) — इस सर्वर के उपयोगकर्ताओं के लिए अनुवाद वाली कॉल सक्षम करता है",
      "guide": {
        "steps": [
          "tolqia.com पर जाएँ और अपने खाते (Plus या Premium योजना) से साइन इन करें।",
          "«सेटिंग्स» › «API» खोलें और एक नया टोकन बनाएँ।",
          "टोकन कॉपी करें (यह tq_live_ से शुरू होता है) और «कॉन्फ़िगर करें» में चिपकाएँ।"
        ],
        "docUrl": "https://tolqia.com/settings/api",
        "docLabel": "tolqia.com पर टोकन बनाएँ → सेटिंग्स › API",
        "docUrl2": "https://tolqia.com/docs",
        "docLabel2": "दस्तावेज़"
      }
    },
    "elevenlabs": {
      "label": "ElevenLabs",
      "help": "ऑडियो कॉल के रीयल-टाइम अनुवाद के लिए उपयोग होती है",
      "voiceIdLabel": "डिफ़ॉल्ट Voice ID",
      "voiceIdPlaceholder": "उदा. 21m00Tcm4TlvDq8ikWAM",
      "guide": {
        "steps": [
          "elevenlabs.io पर जाकर साइन इन करें।",
          "«My Account» → «API Keys» खोलें और नई कुंजी बनाएँ।",
          "कुंजी (sk_ से शुरू) कॉपी करके «कॉन्फ़िगर» टैब में पेस्ट करें।"
        ],
        "docUrl": "https://elevenlabs.io/app/settings/api-keys",
        "docLabel": "ElevenLabs API कुंजियाँ"
      }
    },
    "title": "मॉड्यूल साख",
    "subtitle": "मॉड्यूल्स के काम करने के लिए आवश्यक एक्सेस टोकन और API कुंजी प्रबंधित करें।",
    "empty": "इस सर्वर पर साख की आवश्यकता वाला कोई मॉड्यूल सक्षम नहीं है।",
    "statusSet": "कॉन्फ़िगर किया गया",
    "statusMissing": "कॉन्फ़िगर नहीं किया गया",
    "tokenLabel": "एक्सेस टोकन / API कुंजी",
    "tokenPlaceholder": "टोकन पेस्ट करें…",
    "save": "सहेजें",
    "test": "परीक्षण करें",
    "clear": "हटाएँ",
    "manage": "प्रबंधित करें",
    "show": "दिखाएँ",
    "hide": "छिपाएँ",
    "saved": "साख सहेजी गई",
    "cleared": "साख हटाई गई",
    "testOk": "कनेक्शन मान्य है",
    "testFail": "साख को सत्यापित नहीं कर सकते",
    "confirmClear": "इस साख को हटाना है?",
    "confirmClearTitle": "साख हटाएँ",
    "error": "कुछ गलत हुआ",
    "getDoc": "टोकन प्राप्त करें",
    "managedLabel": {
      "assistant": "एआई एजेंट"
    },
    "managedHint": {
      "assistant": "सहायक के प्रदाता API कुंजी इसके पैनल में प्रबंधित होती हैं।",
      "backups": "स्टोरेज कुंजी (S3 / R2) बैकअप मॉड्यूल में प्रबंधित होती हैं।"
    },
    "managedSummary": {
      "assistant": "AI प्रदाता (Claude, OpenAI, Gemini, …)",
      "backups": "S3 / R2 स्टोरेज साख"
    },
    "storage": {
      "accountId": "खाता ID (Cloudflare)",
      "accessKeyId": "एक्सेस कुंजी ID",
      "secret": "गोपनीय एक्सेस कुंजी",
      "endpoint": "एंडपॉइंट (वैकल्पिक)",
      "region": "क्षेत्र (वैकल्पिक)",
      "r2Hint": "खाता-स्तर R2 साख बैकअप द्वारा पुनः उपयोग की जाती है: कुंजी को एक बार यहाँ सेट करें और बैकअप में कोई बाल्टी चुनें।",
      "s3Hint": "S3 साख बैकअप द्वारा पुनः उपयोग की जाती है: कुंजी को एक बार यहाँ सेट करें और बैकअप में कोई बाल्टी चुनें।"
    },
    "connector": {
      "connect": "सहेजें और कनेक्ट करें",
      "disconnect": "डिस्कनेक्ट करें",
      "connected": "कनेक्ट किया गया",
      "configured": "कॉन्फ़िगर किया गया",
      "notConnected": "कनेक्ट नहीं किया गया",
      "unavailable": "AI एजेंट मॉड्यूल सक्षम होना आवश्यक है",
      "setupGuide": "सेटअप गाइड"
    },
    "help": {
      "tabConfig": "कॉन्फ़िगर",
      "tabHelp": "मदद",
      "openLink": "लिंक खोलें",
      "guides": {
        "cloudflare": {
          "steps": [
            "dash.cloudflare.com → «मेरी प्रोफ़ाइल» → «API टोकन» पर जाएँ।",
            "«टोकन बनाएँ» दबाएँ: «DNS क्षेत्र संपादित करें» टेम्पलेट उपयोग करें या आवश्यक अनुमतियों के साथ कस्टम बनाएँ (Zone:Read, DNS:Edit, आदि)।",
            "वे ज़ोन चुनें जिन तक पहुँच देनी है और टोकन बनाएँ।",
            "टोकन कॉपी करें (केवल एक बार दिखता है) और «कॉन्फ़िगर» टैब में पेस्ट करें।"
          ],
          "docUrl": "https://dash.cloudflare.com/profile/api-tokens",
          "docLabel": "Cloudflare API टोकन"
        },
        "expo": {
          "steps": [
            "expo.dev पर जाएँ और लॉग इन करें → «Account settings» → «Access tokens»।",
            "«Create token» दबाएँ, उसे नाम दें और जनरेट हुई वैल्यू कॉपी करें।",
            "«कॉन्फ़िगर» टैब में पेस्ट करें।"
          ],
          "docUrl": "https://expo.dev/settings/access-tokens",
          "docLabel": "Expo एक्सेस टोकन"
        },
        "openclaw": {
          "steps": [
            "openclaw.ai पर जाएँ और लॉग इन करें।",
            "OpenClaw के पैनल से अपनी API key जनरेट करें या कॉपी करें।",
            "«कॉन्फ़िगर» में पेस्ट करें (यदि endpoint और डिफ़ॉल्ट मॉडल भिन्न हों तो समायोजित करें)।"
          ],
          "docUrl": "https://openclaw.ai",
          "docLabel": "OpenClaw"
        },
        "repository-store": {
          "steps": [
            "github.com → «Settings» → «Developer settings» → «Personal access tokens» पर जाएँ।",
            "रिपॉज़िटरी पढ़ने की अनुमति के साथ टोकन (classic या fine-grained) जनरेट करें (public_repo या Contents: Read)।",
            "टोकन कॉपी करें (ghp_ या github_pat_ से शुरू होता है) और «कॉन्फ़िगर» में पेस्ट करें।"
          ],
          "docUrl": "https://github.com/settings/tokens",
          "docLabel": "GitHub टोकन"
        },
        "bitninja": {
          "steps": [
            "BitNinja पैनल (admin.bitninja.io) पर जाएँ और लॉग इन करें।",
            "लाइसेंस/सर्वर अनुभाग से अपनी License Key कॉपी करें।",
            "«कॉन्फ़िगर» में पेस्ट करें।"
          ],
          "docUrl": "https://bitninja.io",
          "docLabel": "BitNinja"
        },
        "r2": {
          "steps": [
            "dash.cloudflare.com → «R2» → «Manage R2 API Tokens» पर जाएँ।",
            "ऑब्जेक्ट पढ़ने/लिखने की अनुमति के साथ एक «R2 API Token» (S3-compatible) बनाएँ।",
            "दिखाए गए Access Key ID और Secret Access Key कॉपी करें।",
            "आपका Account ID R2 पेज / खाते के सारांश पर दिखता है।",
            "«कॉन्फ़िगर» में Account ID + Access Key ID + Secret पेस्ट करें (endpoint Account ID से व्युत्पन्न होता है)।"
          ],
          "docUrl": "https://dash.cloudflare.com/?to=/:account/r2/api-tokens",
          "docLabel": "R2 API टोकन"
        },
        "s3": {
          "steps": [
            "AWS कंसोल में: «IAM» → «Users» → अपना उपयोगकर्ता → «Security credentials» → «Create access key»।",
            "Access Key ID और Secret Access Key कॉपी करें।",
            "यदि S3-compatible सेवा (Wasabi, MinIO, आदि) उपयोग कर रहे हैं, तो उसका Endpoint और Region नोट करें।",
            "«कॉन्फ़िगर» में कुंजियाँ (और Endpoint/Region यदि लागू हो) पेस्ट करें।"
          ],
          "docUrl": "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html",
          "docLabel": "AWS एक्सेस कुंजी"
        }
      }
    }
  },
  "general": {
    "hcaptchaEnabled": "लॉगिन पर hCaptcha आवश्यक करें",
    "hcaptchaEnabledHint": "पैनल लॉगिन फ़ॉर्म पर hCaptcha चुनौती दिखाएं।",
    "sectionTitle": "सामान्य",
    "labelPanelName": "पैनल का नाम",
    "labelTimezone": "समय क्षेत्र",
    "labelLanguage": "भाषा",
    "languageOptions": {
      "en": "English",
      "es": "Español"
    },
    "labelSessionTtl": "सेशन अवधि (घंटे)",
    "labelMaxLoginAttempts": "विफल लॉगिन प्रयास (ब्लॉकिंग)",
    "labelRequire2fa": "सभी उपयोगकर्ताओं के लिए 2FA अनिवार्य करें",
    "btnViewLog": "लॉग देखें",
    "labelAuditLog": "ऑडिट लॉग सक्षम करें",
    "labelSwitchNewTab": "सर्वर बदलते समय नए टैब में खोलें"
  },
  "imageList": {
    "labelJson": "(JSON)",
    "labelUrls": "(इमेज URLs)",
    "addButton": "इमेज जोड़ें"
  },
  "layout": {
    "sectionTitle": "Layout, branding और UI",
    "sectionSubtitle": "फ्रंटएंड के लोगो, रेडियस, छाया और बेस रंग अनुकूलित करें।",
    "branding": {
      "groupTitle": "Branding और लोगो",
      "groupDesc": "साइडबार, लॉगिन, हेडर, फ़ुटर और फ़ेविकॉन पर लागू एकल लोगो।",
      "labelLogoUrl": "लोगो URL",
      "logoUrlHelp": "हर जगह इस्तेमाल होने वाला एक लोगो: साइडबार, लॉगिन, पैनल हेडर, फ़ुटर और पब्लिक स्क्रीन।",
      "btnUpload": "अपलोड करें",
      "btnPick": "चुनें",
      "btnDefault": "डिफ़ॉल्ट",
      "restoreLogos": "लोगो रीसेट करें",
      "loginLogoOpacity": "लॉगिन लोगो कंटेनर अपारदर्शिता",
      "loginLogoOpacityHelp": "/login पर लोगो वृत्त पृष्ठभूमि की पारदर्शिता (0 = पारदर्शी, 100 = ठोस)।"
    },
    "loginBg": {
      "groupTitle": "लॉगिन पृष्ठभूमि",
      "groupDesc": "/login पर एनिमेटेड पृष्ठभूमि प्रभाव और उसका फ़ॉलबैक रंग।",
      "enableLabel": "/login पर एनिमेटेड पृष्ठभूमि दिखाएं",
      "labelFallbackColor": "निष्क्रिय होने पर पृष्ठभूमि रंग",
      "labelActiveEffect": "/login पर सक्रिय प्रभाव",
      "previewTitle": "लॉगिन पूर्वावलोकन"
    },
    "shape": {
      "groupTitle": "आकार और छाया",
      "groupDesc": "ग्लोबल रेडियस, कार्ड और मोडल शैडो।",
      "labelRadius": "वैश्विक रेडियस",
      "radiusHelp": "उदा: 0.5rem, 12px।",
      "labelShadow": "बेस छाया",
      "labelModalShadow": "मोडल छाया",
      "labelModalBackdrop": "मोडल ओवरले",
      "backdropHelp": "डायलॉग की पृष्ठभूमि।",
      "layer1": "परत 1",
      "layer2": "परत 2",
      "labelColor": "रंग",
      "labelShadowSingle": "छाया"
    },
    "palettes": {
      "title": "रंग थीम",
      "subtitle": "एक पूर्वनिर्धारित पैलेट चुनें; यह पूरे पैनल (लाइट और डार्क) पर लागू होता है।",
      "light": "लाइट थीम",
      "dark": "डार्क थीम",
      "intensity": "तीव्रता"
    },
    "resetButton": "स्टाइल डिफ़ॉल्ट पर रीसेट करें",
    "panelBg": {
      "groupTitle": "पैनल पृष्ठभूमि",
      "groupDesc": "पैनल के भीतर एनिमेटेड पृष्ठभूमि प्रभाव और उसका फ़ॉलबैक रंग।",
      "enableLabel": "पैनल में एनिमेटेड पृष्ठभूमि दिखाएं",
      "labelFallbackColor": "निष्क्रिय होने पर पृष्ठभूमि रंग",
      "labelActiveEffect": "पैनल का सक्रिय प्रभाव"
    }
  },
  "security": {
    "sectionTitle": "सुरक्षा",
    "loginMethodsTitle": "अनुमत लॉगिन विधियाँ",
    "loginMethodsDesc": "कम से कम एक विधि सक्रिय रहनी चाहिए। निष्क्रिय विधियाँ लॉगिन स्क्रीन पर नहीं दिखेंगी।",
    "loginMethodsWarning": "कम से कम एक विधि सक्रिय रहनी चाहिए।",
    "passkey": {
      "name": "Passkey",
      "desc": "बायोमेट्रिक प्रमाणीकरण / FIDO2। उपयोगकर्ताओं को अपना डिवाइस पंजीकृत करना होगा।",
      "verifying": "सत्यापित हो रहा है...",
      "btnManage": "प्रबंधित करें"
    },
    "password": {
      "name": "पासवर्ड",
      "desc": "उपयोगकर्ता नाम और पासवर्ड से लॉगिन। बिना किसी पूर्व कॉन्फ़िगरेशन के हमेशा उपलब्ध।",
      "configured": "कॉन्फ़िगर किया गया"
    },
    "recovery": {
      "name": "रिकवरी",
      "desc": "आपातकालीन बैकअप के रूप में एकल-उपयोग कोड।",
      "verifying": "सत्यापित हो रहा है...",
      "btnManage": "प्रबंधित करें"
    },
    "twoFaStatus": {
      "groupTitle": "इस खाते के लिए 2FA स्थिति",
      "badgeDisabled": "निष्क्रिय",
      "promptText": "इस प्रशासनिक खाते की सुरक्षा के लिए 2FA सक्रिय करें।",
      "btnSetup": "कॉन्फ़िगर करें",
      "btnDelete": "हटाएं",
      "btnDisable": "अक्षम करें"
    }
  },
  "modules": {
    "sectionTitle": "मॉड्यूल के अनुसार कैश इंजन",
    "sectionDesc1": "क्लाइंट सर्वर पर शेड्यूल्ड संग्रह की स्थिति और समायोजन।",
    "sectionDescBold": "सक्रिय/निष्क्रिय मूल मॉड्यूल से निर्धारित होता है",
    "modulesLink": "मॉड्यूल",
    "sectionDesc2": ": किसी मॉड्यूल को निष्क्रिय करने पर उसका संग्रह बंद हो जाता है; पुनः सक्रिय करने पर पुनः शेड्यूल हो जाता है। यहाँ केवल आवृत्ति समायोजित होती है। DataTables उस सर्वर के समर्पित Redis से पूर्व-संसाधित डेटा पढ़ती हैं; यदि बंद हो या बहुत पुराना हो तो सामान्य JSON पर वापस आ जाता है।",
    "loading": "लोड हो रहा है…",
    "tableHeaders": {
      "module": "मॉड्यूल / संग्रह",
      "source": "स्रोत",
      "active": "सक्रिय",
      "interval": "अंतराल (s)",
      "lastRefresh": "अंतिम रिफ्रेश",
      "duration": "अवधि",
      "size": "आकार",
      "hitRatio": "हिट अनुपात"
    },
    "managedInPre": " (में प्रबंधित ",
    "managedInPost": ")"
  },
  "system": {
    "factoryReset": {
      "sectionTitle": "सेटिंग्स रीसेट करें",
      "sectionSubtitle": "पैनल की सेटिंग को फ़ैक्टरी मूल्यों पर पुनर्स्थापित करता है।",
      "warningTitle": "चेतावनी",
      "warningBefore": "यह क्रिया ",
      "warningAllSettings": "सभी कॉन्फ़िगरेशन सेटिंग",
      "warningMiddle": " पैनल की (सामान्य, layout/UI, SMTP, सुरक्षा और मॉड्यूल द्वारा सहेजी गई प्राथमिकताएं) को उनके डिफ़ॉल्ट मूल्यों पर रीसेट करती है। स्थापित उपयोगकर्ता और मॉड्यूल ",
      "warningNotDeleted": "हटाए नहीं जाते",
      "warningAfter": ".",
      "btnReset": "फ़ैक्टरी सेटिंग पुनर्स्थापित करें"
    },
    "backupRestore": {
      "sectionTitle": "बैकअप से पुनर्स्थापित करें",
      "sectionSubtitle": "पिछले बैकअप से पैनल पुनर्स्थापित करें (Backups मॉड्यूल आवश्यक है)।",
      "loading": "बैकअप लोड हो रहे हैं...",
      "btnRestore": "चुना गया बैकअप पुनर्स्थापित करें"
    },
    "noBackup": {
      "title": "बैकअप से पुनर्स्थापना उपलब्ध नहीं",
      "descBefore": "यह फ़ंक्शन सक्षम करने के लिए ",
      "backupsModule": "बैकअप",
      "descAfter": " पैनल से इंस्टॉल करें।"
    }
  },
  "imagePicker": {
    "title": "छवि चुनें",
    "subtitle": "फ्रंटएंड के सार्वजनिक फ़ोल्डर में उपलब्ध छवियाँ।",
    "empty": "सार्वजनिक फ़ोल्डर में कोई छवि नहीं है।",
    "btnUpload": "नई छवि अपलोड करें",
    "btnCancel": "रद्द करें"
  },
  "smtpTest": {
    "dialogTitle": "परीक्षण ईमेल भेजें",
    "labelRecipient": "प्राप्तकर्ता",
    "placeholderRecipient": "tu@ejemplo.com",
    "btnCancel": "रद्द करें",
    "btnSend": "भेजें"
  },
  "passkeysDialog": {
    "title": "Passkeys प्रबंधित करें",
    "btnAdd": "Passkey जोड़ें",
    "empty": "कोई passkey पंजीकृत नहीं है"
  },
  "recoveryDialog": {
    "title": "रिकवरी कोड",
    "btnGenerate": "जनरेट / पुनः जनरेट करें",
    "loading": "लोड हो रहा है...",
    "warningText": "इन कोड को किसी सुरक्षित स्थान पर सहेजें। ये केवल एक बार दिखाए जाते हैं।",
    "btnCopy": "सभी कॉपी करें",
    "btnPrint": "प्रिंट करें"
  },
  "setup2faDialog": {
    "title": "2FA कॉन्फ़िगर करें",
    "subtitle": "अपने प्रमाणीकरण ऐप से इस QR कोड को स्कैन करें।",
    "secretLabel": "मैन्युअल Secret:",
    "copyTitle": "कॉपी करें",
    "verifyLabel": "6 अंकों का कोड दर्ज करें:",
    "btnCancel": "रद्द करें",
    "btnActivate": "2FA सक्रिय करें"
  },
  "disable2faDialog": {
    "title": "2FA निष्क्रिय करें?",
    "body": "2FA निष्क्रिय हो जाएगा, लेकिन रहस्य बाद में पुनः सक्रिय करने के लिए संरक्षित रहेगा।",
    "btnCancel": "रद्द करें",
    "btnConfirm": "2FA अक्षम करें"
  },
  "delete2faDialog": {
    "title": "2FA हटाएं?",
    "body": "संग्रहीत रहस्य हटा दिया जाएगा और 2FA का फिर से उपयोग करने के लिए आपको इसे फिर से कॉन्फ़िगर करना होगा।",
    "btnCancel": "रद्द करें",
    "btnConfirm": "2FA हटाएँ"
  },
  "auditLogDialog": {
    "title": "ऑडिट लॉग",
    "empty": "कोई गतिविधि दर्ज नहीं"
  },
  "modulesCache": {
    "agoSeconds": "{n}s पहले",
    "agoMinutes": "{n}m पहले",
    "agoHours": "{n}h पहले",
    "agoDays": "{n}d पहले",
    "collectionSingular": "संग्रह",
    "collectionPlural": "संग्रह",
    "activeSingular": "सक्रिय",
    "activePlural": "सक्रिय",
    "enabledTitle": "क्लाइंट सर्वर के dispatcher द्वारा शेड्यूल की गई संग्रहण",
    "badgeEnabled": "सक्रिय",
    "disabledTitle": "पैरेंट मॉड्यूल /panel/modules में निष्क्रिय है — संग्रहण रुका हुआ है",
    "badgeDisabled": "निष्क्रिय",
    "buttonSave": "सहेजें",
    "saving": "सहेजा जा रहा है…",
    "savedStatus": "{module}/{collection} अपडेट हुआ",
    "saveError": "{module}/{collection} सहेजने में त्रुटि: {message}",
    "loadedSummary": "{modules} मॉड्यूल में {count} कैशयोग्य संग्रह। बदलाव अगले संग्रहकर्ता चक्र में लागू होंगे (≤60s)।",
    "loadError": "त्रुटि: {message}"
  },
  "labels": {
    "auditLogin": "लॉगिन",
    "auditLoginFailed": "लॉगिन प्रयास विफल",
    "auditLogout": "लॉगआउट",
    "auditPasswordChange": "पासवर्ड बदला गया",
    "auditPasskeyRegister": "Passkey पंजीकृत",
    "auditPasskeyDelete": "Passkey हटाई गई",
    "auditRecoveryCodeUsed": "रिकवरी कोड उपयोग किया गया",
    "auditProfileUpdate": "प्रोफ़ाइल अपडेट हुई",
    "auditSettingsUpdate": "सेटिंग्स अपडेट हुईं",
    "audit2faEnabled": "2FA सक्षम",
    "audit2faDisabled": "2FA अक्षम",
    "auditEventDefault": "घटना",
    "aiHintAnthropic": "अनुशंसित मॉडल: claude-fable-5 (सबसे नया), claude-sonnet-4-6 (संतुलित), claude-opus-4-6 (सबसे शक्तिशाली)",
    "aiKeyHintAnthropic": "console.anthropic.com पर अपनी API key प्राप्त करें",
    "aiHintOpenai": "gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna",
    "aiKeyHintOpenai": "platform.openai.com पर अपनी API key प्राप्त करें",
    "aiHintOllama": "स्थानीय Ollama में स्थापित मॉडल का नाम। टूल्स का समर्थन नहीं करता।",
    "aiKeyHintOllama": "स्थानीय Ollama के लिए API key की आवश्यकता नहीं",
    "managedByLp": "LP-LICENSE-SERVER द्वारा प्रबंधित",
    "notAvailable": "उपलब्ध नहीं",
    "managedExternally": "बाहरी रूप से प्रबंधित",
    "twoFaManagedByLp": "इस मोड में प्रमाणीकरण LP-LICENSE-SERVER से प्रबंधित होता है।",
    "licenseNoStatus": "कोई स्थिति नहीं",
    "licenseActive": "सक्रिय",
    "licenseExpires": "{date} को समाप्त",
    "licenseActiveDesc": "लाइसेंस सक्रिय है",
    "licenseDegraded": "डिग्रेडेड",
    "licensePending": "लंबित",
    "licenseDegradedDesc": "लाइसेंस सत्यापित नहीं हो सका और पैनल डिग्रेडेड मोड में है।",
    "licenseNotActivated": "लाइसेंस अभी तक सक्रिय नहीं हुआ है।",
    "passkeyCount": "{count} Passkey पंजीकृत",
    "noPasskeys": "कोई Passkey पंजीकृत नहीं",
    "recoveryCodesGenerated": "रिकवरी कोड उत्पन्न हुए",
    "noRecoveryCodes": "कोई कोड उत्पन्न नहीं",
    "passkeyRegistered": "{date} को पंजीकृत",
    "recoveryCodesActive": "आपके पास सक्रिय रिकवरी कोड हैं।",
    "recoveryCodesNone": "आपके पास कोई सक्रिय रिकवरी कोड नहीं है।",
    "recoveryCodesDisplayed": "{count} कोड उत्पन्न हुए। इन्हें किसी सुरक्षित स्थान पर रखें।",
    "twoFaEnabled": "सक्षम",
    "twoFaEnabledDesc": "अगले लॉगिन पर यह 2FA माँगा जाएगा। सीक्रेट हटाए बिना इसे अक्षम किया जा सकता है।",
    "twoFaDisabled": "अक्षम",
    "twoFaDisabledDesc": "सीक्रेट सुरक्षित है, लेकिन जब तक दोबारा सक्षम न करें, लॉगिन पर नहीं माँगा जाएगा।",
    "twoFaSetupPrompt": "इस व्यवस्थापक खाते को सुरक्षित करने के लिए 2FA सक्षम करें।",
    "printRecoveryCodesTitle": "रिकवरी कोड - LUXIPANEL",
    "printRecoveryCodesDesc": "इन कोडों को किसी सुरक्षित स्थान पर रखें। प्रत्येक का उपयोग केवल एक बार किया जा सकता है।"
  },
  "toasts": {
    "errorSaving": "सेटिंग्स सहेजने में त्रुटि",
    "errorSavingAppearance": "लाइसेंस सर्वर पर रूप-रंग सहेजा नहीं जा सका। कुछ सेकंड बाद पुनः प्रयास करें।",
    "licenseKeyAndRefRequired": "लाइसेंस कुंजी और भुगतान संदर्भ दर्ज करें",
    "licenseActivated": "लाइसेंस सफलतापूर्वक सक्रिय हुआ",
    "licenseActivateError": "लाइसेंस सक्रिय नहीं हो सका",
    "timezoneApplyError": "सिस्टम पर टाइमज़ोन लागू नहीं हो सका",
    "timezoneSavedNotApplied": "टाइमज़ोन पैनल में सहेज लिया गया, लेकिन सिस्टम पर लागू नहीं हो सका (sudo अनुमतियाँ जाँचें)।",
    "passkeysInLp": "Passkeys LP-LICENSE-SERVER में प्रबंधित होती हैं",
    "passkeyDeleted": "Passkey हटाई गई",
    "passkeyDeleteError": "Passkey हटाने में त्रुटि",
    "passkeyBrowserUnsupported": "आपका ब्राउज़र Passkey का समर्थन नहीं करता",
    "passkeyRegisterInitError": "पंजीकरण प्रारंभ नहीं हो सका",
    "passkeyRegisterCancelled": "पंजीकरण रद्द हुआ",
    "passkeyRegisterFinishError": "पंजीकरण पूर्ण करने में त्रुटि",
    "passkeyRegistered": "Passkey सफलतापूर्वक पंजीकृत हुई",
    "passkeyRegisterUserCancelled": "उपयोगकर्ता द्वारा पंजीकरण रद्द किया गया",
    "passkeyRegisterError": "Passkey पंजीकृत करने में त्रुटि",
    "recoveryCodesInLp": "रिकवरी कोड LP-LICENSE-SERVER में प्रबंधित होते हैं",
    "recoveryCodesGenerateError": "कोड उत्पन्न करने में त्रुटि",
    "twoFaInLp": "2FA LP-LICENSE-SERVER में प्रबंधित होता है",
    "twoFaSetupInitError": "2FA कॉन्फ़िगरेशन प्रारंभ करने में त्रुटि",
    "twoFaQrError": "QR उत्पन्न नहीं हो सका",
    "twoFaActivated": "2FA सफलतापूर्वक सक्षम हुआ",
    "twoFaDisabled": "लॉगिन के लिए 2FA अक्षम किया गया",
    "twoFaDisableError": "2FA अक्षम करने में त्रुटि",
    "twoFaReactivated": "लॉगिन के लिए 2FA सक्षम किया गया",
    "twoFaActivateError": "2FA सक्षम करने में त्रुटि",
    "twoFaDeleted": "2FA हटाया गया",
    "twoFaDeleteError": "2FA हटाने में त्रुटि",
    "backupRestoreUnavailable": "इस पैनल से Backups पुनर्स्थापना अभी उपलब्ध नहीं है।",
    "imageExceeds5mb": "छवि 5MB से अधिक है",
    "uploadingImage": "छवि अपलोड हो रही है...",
    "imageUploadError": "छवि अपलोड करने में त्रुटि",
    "imageUploadInvalidResponse": "सर्वर से अमान्य प्रतिक्रिया",
    "imageUploaded": "छवि सफलतापूर्वक अपलोड हुई",
    "logosRestored": "लोगो डिफ़ॉल्ट मानों पर पुनर्स्थापित हुए",
    "codesCopied": "कोड कॉपी हुए",
    "secretCopied": "Secret कॉपी हुआ",
    "smtpTestSent": "परीक्षण मेल {to} को भेजा गया",
    "smtpTestError": "भेजने में त्रुटि",
    "layoutReset": "इंटरफ़ेस शैलियाँ डिफ़ॉल्ट पर रीसेट हुईं",
    "settingsReset": "सेटिंग्स रीसेट हुईं",
    "settingsResetError": "रीसेट करने में त्रुटि",
    "licenseRevalidated": "लाइसेंस पुनः सत्यापित हुआ",
    "licenseRevalidateError": "लाइसेंस पुनः सत्यापित नहीं हो सका"
  },
  "actions": {
    "activating": "सक्रिय हो रहा है...",
    "activateOrUpdate": "सक्रिय करें / अपडेट करें",
    "manage": "प्रबंधित करें",
    "configure": "कॉन्फ़िगर करें",
    "viewOrRegenerate": "देखें / पुनः उत्पन्न करें",
    "generate": "उत्पन्न करें",
    "generating": "उत्पन्न हो रहा है...",
    "generateOrRegenerate": "उत्पन्न करें / पुनः उत्पन्न करें",
    "disable": "अक्षम करें",
    "activate": "सक्रिय करें",
    "activate2fa": "2FA सक्षम करें",
    "continue": "जारी रखें",
    "sending": "भेजा जा रहा है...",
    "send": "भेजें",
    "resetting": "रीसेट हो रहा है...",
    "factoryReset": "फ़ैक्ट्री सेटिंग्स रीसेट करें"
  },
  "errors": {
    "twoFaEnter6Digits": "कोड के 6 अंक दर्ज करें",
    "twoFaInvalidCode": "अमान्य कोड"
  },
  "confirm": {
    "deletePasskeyTitle": "Passkey हटाएँ",
    "deletePasskeyBody": "क्या यह Passkey हटानी है?",
    "restoreBackupBody": "क्या \"{id}\" Backup पुनर्स्थापित करना है?",
    "restoreBackupTitle": "Backup पुनर्स्थापित करें",
    "restoreLogosBody": "क्या लोगो को LUXIPANEL के डिफ़ॉल्ट मानों पर पुनर्स्थापित करना है?",
    "restoreLogosTitle": "लोगो पुनर्स्थापित करें",
    "restoreLogosConfirm": "हाँ, पुनर्स्थापित करें",
    "resetLayoutBody": "क्या इंटरफ़ेस शैलियाँ LUXIPANEL के डिफ़ॉल्ट मानों पर रीसेट करनी हैं? कस्टम लोगो, रंग, छाया और पृष्ठभूमि मिट जाएंगी।",
    "resetLayoutTitle": "शैलियाँ रीसेट करें",
    "resetLayoutConfirm": "हाँ, रीसेट करें",
    "factoryResetBody": "क्या आप सुनिश्चित हैं? इससे पैनल की सभी सेटिंग्स रीसेट हो जाएंगी।",
    "factoryResetTitle": "सेटिंग्स रीसेट करें",
    "factoryResetConfirm": "हाँ, रीसेट करें"
  },
  "empty": {
    "noBackups": "कोई Backup उपलब्ध नहीं।"
  },
  "palettes": {
    "violet": {
      "name": "बैंगनी",
      "description": "LUXIPANEL की डिफ़ॉल्ट रंग-पट्टिका।"
    },
    "ocean": {
      "name": "महासागर",
      "description": "पेशेवर और शांत नीले रंग।"
    },
    "emerald": {
      "name": "पन्ना",
      "description": "ताज़े और प्राकृतिक हरे रंग।"
    },
    "sunset": {
      "name": "सूर्यास्त",
      "description": "गर्म नारंगी और अंबर रंग।"
    },
    "rose": {
      "name": "गुलाबी",
      "description": "जीवंत गुलाबी और मैजेंटा रंग।"
    },
    "indigo": {
      "name": "नील",
      "description": "सुरुचिपूर्ण और आधुनिक नील रंग।"
    },
    "aqua": {
      "name": "एक्वा",
      "description": "चमकीले फ़िरोज़ी और सियान रंग।"
    },
    "graphite": {
      "name": "ग्रेफाइट",
      "description": "तटस्थ एकरंगी और संयमित।"
    },
    "amber": {
      "name": "अंबर",
      "description": "गर्म सुनहरे और शहद रंग।"
    },
    "fuchsia": {
      "name": "फ्यूशिया",
      "description": "गहरे मैजेंटा और बैंगनी रंग।"
    },
    "lime": {
      "name": "नींबू",
      "description": "ऊर्जावान नींबू-हरे रंग।"
    },
    "slate": {
      "name": "स्लेट",
      "description": "पेशेवर नीलाभ स्लेटी रंग।"
    },
    "prisma": {
      "name": "प्रिज़्म",
      "description": "सभी पैलेट के रंगों को एक निरंतर, अनंत संक्रमण में मिलाता है।",
      "colors": "रंग",
      "addColorButton": "रंग जोड़ें",
      "addColorAria": "प्रिज़्म प्रभाव के लिए रंग चुनें और जोड़ें",
      "addColorInputAria": "प्रिज़्म प्रभाव में जोड़ने के लिए रंग",
      "editColorAria": "रंग संपादित करें",
      "editColorInputAria": "रंग मान संपादित करें",
      "editColorHexAria": "रंग का हेक्स मान",
      "removeColorAria": "रंग हटाएँ",
      "moveUpAria": "रंग ऊपर ले जाएँ",
      "moveDownAria": "रंग नीचे ले जाएँ",
      "helpText": "तीरों से सूची का क्रम बदलें। प्रत्येक रंग प्रभाव का क्रम निर्धारित करता है।"
    },
    "custom": {
      "name": "कस्टम",
      "description": "अपना आधार रंग चुनें और उसकी तीव्रता समायोजित करें।",
      "baseColor": "आधार रंग",
      "baseColorAria": "कस्टम आधार रंग",
      "hexAria": "कस्टम आधार रंग का हेक्स मान"
    },
    "luxisoft": {
      "description": "लाइट मोड में नेवी नीला और मिंट; डार्क मोड में ग्रेफाइट और मिंट।",
      "name": "Luxisoft"
    }
  },
  "managers": {
    "default": "मैनेजर 1"
  },
  "git": {
    "errorFallback": "त्रुटि"
  }
} as const;

export default settings;
