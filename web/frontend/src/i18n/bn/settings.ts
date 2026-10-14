const settings = {
  "passkeyName": {
    "title": "পাসকির নাম",
    "hint": "ডিভাইসটি সহজে চেনা যায় এমন একটি নাম দিন।",
    "placeholder": "যেমন: ব্যক্তিগত ল্যাপটপ",
    "save": "নাম সংরক্ষণ করুন",
    "edit": "নাম সম্পাদনা করুন",
    "invalid": "1 থেকে 128 অক্ষরের একটি নাম লিখুন।",
    "saved": "নাম আপডেট হয়েছে",
    "error": "নাম সংরক্ষণ করা যায়নি।",
    "cancel": "বাতিল"
},
  "placeholders": {
    "logoUrl": "https://example.com/logo.png",
    "imageUrl": "https://…/image.jpg"
  },
  "pageTitle": "সেটিংস",
  "loadFailure": {
    "title": "সেটিংস লোড করা যায়নি",
    "sessionMessage": "সেটিংস লোড করা যায়নি: সার্ভারের সাথে আপনার সেশন উপলব্ধ নেই। সিলেক্টরে সার্ভারটি আবার নির্বাচন করুন, অথবা লগ আউট করে আবার লগ ইন করুন।",
    "genericMessage": "সেটিংস লোড করা যায়নি। আপনার সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।",
    "retry": "আবার চেষ্টা করুন"
  },
  "header": {
    "title": "প্যানেল সেটিংস",
    "subtitle": "LuxiPanel-এর গ্লোবাল কনফিগারেশন",
    "autosave": "স্বয়ংক্রিয় সেভ"
  },
  "tabs": {
    "general": "সাধারণ",
    "layoutUi": "Layout/UI",
    "security": "নিরাপত্তা",
    "modules": "মডিউল",
    "system": "সিস্টেম",
    "credentials": "শংসাপত্র"
  },
  "credentials": {
    "hcaptcha": {
      "title": "hCaptcha",
      "desc": "একটি hCaptcha চ্যালেঞ্জ দিয়ে প্যানেল লগইন সুরক্ষিত করুন। আপনার hCaptcha ড্যাশবোর্ড থেকে কীগুলি লিখুন।",
      "sitekeyLabel": "সাইট কী",
      "sitekeyPlaceholder": "আপনার hCaptcha সাইট কী",
      "secretLabel": "সিক্রেট কী",
      "secretPlaceholder": "একটি নতুন সিক্রেট কী লিখুন",
      "secretConfigured": "একটি সিক্রেট কী ইতিমধ্যে সেট করা আছে। এটি রাখতে এই ঘরটি খালি রাখুন।",
      "statusConfigured": "কনফিগার করা হয়েছে",
      "statusMissing": "কনফিগার করা হয়নি",
      "saved": "hCaptcha সেটিংস সংরক্ষিত হয়েছে"
    },
    "tolqia": {
      "label": "Tolqia",
      "help": "আপনার Tolqia অ্যাকাউন্টের API টোকেন (Plus বা Premium প্ল্যান) — এই সার্ভারের ব্যবহারকারীদের জন্য অনুবাদসহ কল চালু করে",
      "guide": {
        "steps": [
          "tolqia.com-এ যান এবং আপনার অ্যাকাউন্টে (Plus বা Premium প্ল্যান) সাইন ইন করুন।",
          "«সেটিংস» › «API» খুলুন এবং একটি নতুন টোকেন তৈরি করুন।",
          "টোকেনটি কপি করুন (এটি tq_live_ দিয়ে শুরু হয়) এবং «কনফিগার করুন»-এ পেস্ট করুন।"
        ],
        "docUrl": "https://tolqia.com/settings/api",
        "docLabel": "tolqia.com-এ টোকেন তৈরি করুন → সেটিংস › API",
        "docUrl2": "https://tolqia.com/docs",
        "docLabel2": "ডকুমেন্টেশন"
      }
    },
    "elevenlabs": {
      "label": "ElevenLabs",
      "help": "অডিও কলের রিয়েল-টাইম অনুবাদের জন্য ব্যবহৃত হয়",
      "voiceIdLabel": "ডিফল্ট ভয়েস আইডি",
      "voiceIdPlaceholder": "যেমন 21m00Tcm4TlvDq8ikWAM",
      "guide": {
        "steps": [
          "elevenlabs.io-তে গিয়ে সাইন ইন করুন।",
          "«My Account» → «API Keys» খুলে একটি নতুন কী তৈরি করুন।",
          "কী-টি (sk_ দিয়ে শুরু) কপি করে «কনফিগার» ট্যাবে পেস্ট করুন।"
        ],
        "docUrl": "https://elevenlabs.io/app/settings/api-keys",
        "docLabel": "ElevenLabs API কী"
      }
    },
    "title": "মডিউল শংসাপত্র",
    "subtitle": "মডিউলগুলির জন্য প্রয়োজনীয় অ্যাক্সেস টোকেন এবং API কী পরিচালনা করুন।",
    "empty": "এই সার্ভারে কোনো শংসাপত্র প্রয়োজন এমন মডিউল সক্ষম নেই।",
    "statusSet": "কনফিগার করা হয়েছে",
    "statusMissing": "কনফিগার করা হয়নি",
    "tokenLabel": "অ্যাক্সেস টোকেন / API কী",
    "tokenPlaceholder": "টোকেন পেস্ট করুন…",
    "save": "সংরক্ষণ করুন",
    "test": "পরীক্ষা করুন",
    "clear": "সরান",
    "manage": "পরিচালনা করুন",
    "show": "দেখান",
    "hide": "লুকান",
    "saved": "শংসাপত্র সংরক্ষিত হয়েছে",
    "cleared": "শংসাপত্র সরানো হয়েছে",
    "testOk": "সংযোগ বৈধ",
    "testFail": "শংসাপত্র যাচাই করতে পারা যায়নি",
    "confirmClear": "এই শংসাপত্র সরাতে চান?",
    "confirmClearTitle": "শংসাপত্র সরান",
    "error": "কিছু ভুল হয়েছে",
    "getDoc": "টোকেন পান",
    "managedLabel": {
      "assistant": "এআই এজেন্ট"
    },
    "managedHint": {
      "assistant": "সহায়কের প্রদানকারী API কী তার প্যানেলে পরিচালনা করা হয়।",
      "backups": "স্টোরেজ কী (S3 / R2) ব্যাকআপ মডিউলে পরিচালিত হয়।"
    },
    "managedSummary": {
      "assistant": "AI প্রদানকারী (Claude, OpenAI, Gemini, …)",
      "backups": "S3 / R2 স্টোরেজ শংসাপত্র"
    },
    "storage": {
      "accountId": "অ্যাকাউন্ট ID (Cloudflare)",
      "accessKeyId": "অ্যাক্সেস কী ID",
      "secret": "গোপন অ্যাক্সেস কী",
      "endpoint": "এন্ডপয়েন্ট (ঐচ্ছিক)",
      "region": "অঞ্চল (ঐচ্ছিক)",
      "r2Hint": "অ্যাকাউন্ট-স্তরের R2 শংসাপত্র ব্যাকআপ দ্বারা পুনরায় ব্যবহৃত হয়: একবার কী এখানে সেট করুন এবং শুধুমাত্র ব্যাকআপে একটি বাকেট বেছে নিন।",
      "s3Hint": "S3 শংসাপত্র ব্যাকআপ দ্বারা পুনরায় ব্যবহৃত হয়: একবার কী এখানে সেট করুন এবং শুধুমাত্র ব্যাকআপে একটি বাকেট বেছে নিন।"
    },
    "connector": {
      "connect": "সংরক্ষণ করুন এবং সংযোগ করুন",
      "disconnect": "সংযোগ বিচ্ছিন্ন করুন",
      "connected": "সংযুক্ত",
      "configured": "কনফিগার করা হয়েছে",
      "notConnected": "সংযুক্ত নয়",
      "unavailable": "AI এজেন্ট মডিউল সক্ষম হওয়া প্রয়োজন",
      "setupGuide": "সেটআপ গাইড"
    },
    "help": {
      "tabConfig": "কনফিগার",
      "tabHelp": "সাহায্য",
      "openLink": "লিঙ্ক খুলুন",
      "guides": {
        "cloudflare": {
          "steps": [
            "dash.cloudflare.com-এ প্রবেশ করুন → «আমার প্রোফাইল» → «API Tokens»।",
            "«Token তৈরি করুন» চাপুন: «DNS জোন সম্পাদনা» টেমপ্লেট ব্যবহার করুন বা প্রয়োজনীয় অনুমতি দিয়ে কাস্টম তৈরি করুন (Zone:Read, DNS:Edit ইত্যাদি)।",
            "অ্যাক্সেস দেওয়া জোন বেছে নিন এবং Token তৈরি করুন।",
            "Token কপি করুন (একবারই দেখা যাবে) এবং «কনফিগার» ট্যাবে পেস্ট করুন।"
          ],
          "docUrl": "https://dash.cloudflare.com/profile/api-tokens",
          "docLabel": "Cloudflare API টোকেন"
        },
        "expo": {
          "steps": [
            "expo.dev-এ প্রবেশ করুন → «Account settings» → «Access tokens»।",
            "«Create token» চাপুন, নাম দিন এবং মানটি কপি করুন।",
            "«কনফিগার» ট্যাবে পেস্ট করুন।"
          ],
          "docUrl": "https://expo.dev/settings/access-tokens",
          "docLabel": "Expo অ্যাক্সেস টোকেন"
        },
        "openclaw": {
          "steps": [
            "openclaw.ai-এ প্রবেশ করুন এবং লগইন করুন।",
            "OpenClaw ড্যাশবোর্ড থেকে আপনার API key তৈরি বা কপি করুন।",
            "«কনফিগার»-এ পেস্ট করুন (প্রয়োজনে endpoint ও ডিফল্ট মডেল পরিবর্তন করুন)।"
          ],
          "docUrl": "https://openclaw.ai",
          "docLabel": "OpenClaw"
        },
        "repository-store": {
          "steps": [
            "github.com → «Settings» → «Developer settings» → «Personal access tokens»-এ যান।",
            "রিপোজিটরি পড়ার অনুমতিসহ (public_repo বা Contents: Read) একটি Token (classic বা fine-grained) তৈরি করুন।",
            "Token কপি করুন (ghp_ বা github_pat_ দিয়ে শুরু) এবং «কনফিগার»-এ পেস্ট করুন।"
          ],
          "docUrl": "https://github.com/settings/tokens",
          "docLabel": "GitHub টোকেন"
        },
        "bitninja": {
          "steps": [
            "BitNinja প্যানেলে (admin.bitninja.io) প্রবেশ করুন এবং লগইন করুন।",
            "লাইসেন্স/সার্ভার বিভাগ থেকে আপনার License Key কপি করুন।",
            "«কনফিগার»-এ পেস্ট করুন।"
          ],
          "docUrl": "https://bitninja.io",
          "docLabel": "BitNinja"
        },
        "r2": {
          "steps": [
            "dash.cloudflare.com → «R2» → «Manage R2 API Tokens»-এ যান।",
            "অবজেক্ট পড়া/লেখার অনুমতিসহ একটি «R2 API Token» (S3 compatible) তৈরি করুন।",
            "প্রদর্শিত Access Key ID এবং Secret Access Key কপি করুন।",
            "আপনার Account ID R2 পেজ / অ্যাকাউন্ট সারসংক্ষেপে পাওয়া যাবে।",
            "Account ID + Access Key ID + Secret «কনফিগার»-এ পেস্ট করুন (Account ID থেকে endpoint নির্ধারিত হয়)।"
          ],
          "docUrl": "https://dash.cloudflare.com/?to=/:account/r2/api-tokens",
          "docLabel": "R2 API টোকেন"
        },
        "s3": {
          "steps": [
            "AWS কনসোলে: «IAM» → «Users» → আপনার ব্যবহারকারী → «Security credentials» → «Create access key»।",
            "Access Key ID এবং Secret Access Key কপি করুন।",
            "S3 compatible সার্ভিস (Wasabi, MinIO ইত্যাদি) ব্যবহার করলে Endpoint ও Region নোট করুন।",
            "কী (এবং প্রযোজ্য হলে Endpoint/Region) «কনফিগার»-এ পেস্ট করুন।"
          ],
          "docUrl": "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html",
          "docLabel": "AWS অ্যাক্সেস কী"
        }
      }
    }
  },
  "general": {
    "hcaptchaEnabled": "লগইনে hCaptcha আবশ্যক করুন",
    "hcaptchaEnabledHint": "প্যানেল লগইন ফর্মে একটি hCaptcha চ্যালেঞ্জ দেখান।",
    "sectionTitle": "সাধারণ",
    "labelPanelName": "প্যানেলের নাম",
    "labelTimezone": "সময় অঞ্চল",
    "labelLanguage": "ভাষা",
    "languageOptions": {
      "en": "English",
      "es": "Español"
    },
    "labelSessionTtl": "সেশন মেয়াদ (ঘণ্টা)",
    "labelMaxLoginAttempts": "ব্যর্থ লগইন প্রচেষ্টা (ব্লক)",
    "labelRequire2fa": "সকল ব্যবহারকারীর জন্য 2FA আবশ্যক করুন",
    "btnViewLog": "লগ দেখুন",
    "labelAuditLog": "অডিট লগ সক্রিয় করুন",
    "labelSwitchNewTab": "সার্ভার পরিবর্তন করার সময় নতুন ট্যাবে খুলুন"
  },
  "imageList": {
    "labelJson": "(JSON)",
    "labelUrls": "(ছবির URLs)",
    "addButton": "ছবি যোগ করুন"
  },
  "layout": {
    "sectionTitle": "Layout, ব্র্যান্ডিং ও UI",
    "sectionSubtitle": "ফ্রন্টএন্ডের লোগো, রেডিয়াস, ছায়া ও বেস রং কাস্টমাইজ করুন।",
    "branding": {
      "groupTitle": "ব্র্যান্ডিং ও লোগো",
      "groupDesc": "সাইডবার, লগইন, হেডার, ফুটার ও ফ্যাভিকনে প্রযোজ্য একক লোগো।",
      "labelLogoUrl": "লোগো URL",
      "logoUrlHelp": "সর্বত্র ব্যবহৃত একটি লোগো: সাইডবার, লগইন, প্যানেল হেডার, ফুটার এবং পাবলিক স্ক্রিন।",
      "btnUpload": "আপলোড করুন",
      "btnPick": "বেছে নিন",
      "btnDefault": "ডিফল্ট",
      "restoreLogos": "লোগো রিসেট করুন",
      "loginLogoOpacity": "লগইন লোগো কনটেইনার অস্বচ্ছতা",
      "loginLogoOpacityHelp": "/login-এ লোগো বৃত্তের পটভূমির স্বচ্ছতা (0 = স্বচ্ছ, 100 = কঠিন)।"
    },
    "loginBg": {
      "groupTitle": "লগইন পটভূমি",
      "groupDesc": "/login পৃষ্ঠায় অ্যানিমেটেড ব্যাকগ্রাউন্ড ও এর ফলব্যাক রঙ।",
      "enableLabel": "/login-এ অ্যানিমেটেড পটভূমি দেখান",
      "labelFallbackColor": "নিষ্ক্রিয় থাকলে ব্যাকগ্রাউন্ড রঙ",
      "labelActiveEffect": "/login-এ সক্রিয় প্রভাব",
      "previewTitle": "লগইন পূর্বরূপ"
    },
    "shape": {
      "groupTitle": "আকার ও ছায়া",
      "groupDesc": "গ্লোবাল রেডিয়াস, কার্ড ও মোডাল শ্যাডো।",
      "labelRadius": "গ্লোবাল রেডিয়াস",
      "radiusHelp": "উদা: 0.5rem, 12px।",
      "labelShadow": "বেস ছায়া",
      "labelModalShadow": "মোডাল ছায়া",
      "labelModalBackdrop": "মোডাল ওভারলে",
      "backdropHelp": "ডায়ালগের ব্যাকগ্রাউন্ড।",
      "layer1": "স্তর ১",
      "layer2": "স্তর ২",
      "labelColor": "রঙ",
      "labelShadowSingle": "ছায়া"
    },
    "palettes": {
      "title": "রঙের থিম",
      "subtitle": "একটি পূর্বনির্ধারিত প্যালেট বেছে নিন; এটি পুরো প্যানেলে (লাইট ও ডার্ক) প্রযোজ্য।",
      "light": "লাইট থিম",
      "dark": "ডার্ক থিম",
      "intensity": "তীব্রতা"
    },
    "resetButton": "স্টাইল ডিফল্টে রিসেট করুন",
    "panelBg": {
      "groupTitle": "প্যানেলের ব্যাকগ্রাউন্ড",
      "groupDesc": "প্যানেলের ভেতরে অ্যানিমেটেড ব্যাকগ্রাউন্ড ও এর ফলব্যাক রঙ।",
      "enableLabel": "প্যানেলে অ্যানিমেটেড ব্যাকগ্রাউন্ড দেখান",
      "labelFallbackColor": "নিষ্ক্রিয় থাকলে ব্যাকগ্রাউন্ড রঙ",
      "labelActiveEffect": "প্যানেলে সক্রিয় প্রভাব"
    }
  },
  "security": {
    "sectionTitle": "নিরাপত্তা",
    "loginMethodsTitle": "অনুমোদিত লগইন পদ্ধতি",
    "loginMethodsDesc": "কমপক্ষে একটি পদ্ধতি সক্রিয় থাকতে হবে। নিষ্ক্রিয় পদ্ধতিগুলো লগইন স্ক্রিনে দেখাবে না।",
    "loginMethodsWarning": "কমপক্ষে একটি পদ্ধতি সক্রিয় থাকতে হবে।",
    "passkey": {
      "name": "Passkey",
      "desc": "বায়োমেট্রিক / FIDO2 প্রমাণীকরণ। ব্যবহারকারীদের তাদের ডিভাইস নিবন্ধন করতে হবে।",
      "verifying": "যাচাই করা হচ্ছে...",
      "btnManage": "পরিচালনা করুন"
    },
    "password": {
      "name": "পাসওয়ার্ড",
      "desc": "ব্যবহারকারী নাম ও পাসওয়ার্ড দিয়ে লগইন। পূর্ব কনফিগারেশন ছাড়াই সর্বদা উপলব্ধ।",
      "configured": "কনফিগার করা হয়েছে"
    },
    "recovery": {
      "name": "পুনরুদ্ধার",
      "desc": "জরুরি ব্যাকআপ হিসেবে একবার ব্যবহারযোগ্য কোড।",
      "verifying": "যাচাই করা হচ্ছে...",
      "btnManage": "পরিচালনা করুন"
    },
    "twoFaStatus": {
      "groupTitle": "এই অ্যাকাউন্টের 2FA অবস্থা",
      "badgeDisabled": "নিষ্ক্রিয়",
      "promptText": "এই অ্যাডমিন অ্যাকাউন্ট সুরক্ষিত করতে 2FA সক্রিয় করুন।",
      "btnSetup": "কনফিগার করুন",
      "btnDelete": "মুছুন",
      "btnDisable": "নিষ্ক্রিয় করুন"
    }
  },
  "modules": {
    "sectionTitle": "মডিউল অনুযায়ী ক্যাশ ইঞ্জিন",
    "sectionDesc1": "ক্লায়েন্ট সার্ভারে নির্ধারিত সংগ্রহের অবস্থা ও সমন্বয়।",
    "sectionDescBold": "সক্রিয়/নিষ্ক্রিয় মূল মডিউল থেকে নির্ধারিত হয়",
    "modulesLink": "মডিউল",
    "sectionDesc2": ": একটি মডিউল নিষ্ক্রিয় করলে তার সংগ্রহ বন্ধ হয়; পুনরায় সক্রিয় করলে আবার নির্ধারিত হয়। এখানে শুধু ফ্রিকোয়েন্সি সমন্বয় করা হয়। DataTables সেই সার্ভারের ডেডিকেটেড Redis থেকে প্রি-ফর্মড ডেটা পড়ে; বন্ধ বা অনেক পুরনো হলে সাধারণ JSON-এ পড়ে।",
    "loading": "লোড হচ্ছে…",
    "tableHeaders": {
      "module": "মডিউল / সংগ্রহ",
      "source": "উৎস",
      "active": "সক্রিয়",
      "interval": "ব্যবধান (সে)",
      "lastRefresh": "সর্বশেষ রিফ্রেশ",
      "duration": "সময়কাল",
      "size": "আকার",
      "hitRatio": "হিট অনুপাত"
    },
    "managedInPre": " (",
    "managedInPost": "-এ পরিচালিত)"
  },
  "system": {
    "factoryReset": {
      "sectionTitle": "সেটিংস পুনরুদ্ধার করুন",
      "sectionSubtitle": "প্যানেলের সেটিংস ফ্যাক্টরি মান পুনরুদ্ধার করুন।",
      "warningTitle": "সতর্কতা",
      "warningBefore": "এই কাজটি পুনরায় সেট করে ",
      "warningAllSettings": "সকল কনফিগারেশন সেটিংস",
      "warningMiddle": " প্যানেলের (সাধারণ, layout/UI, SMTP, নিরাপত্তা এবং মডিউল দ্বারা সংরক্ষিত পছন্দ) ডিফল্ট মানে। ব্যবহারকারী এবং ইন্সটল্ড মডিউলগুলো ",
      "warningNotDeleted": "মুছে ফেলা হয় না",
      "warningAfter": ".",
      "btnReset": "ফ্যাক্টরি সেটিংস পুনরুদ্ধার করুন"
    },
    "backupRestore": {
      "sectionTitle": "ব্যাকআপ থেকে পুনরুদ্ধার করুন",
      "sectionSubtitle": "পূর্ববর্তী ব্যাকআপ থেকে প্যানেল পুনরুদ্ধার করুন (Backups মডিউল প্রয়োজন)।",
      "loading": "ব্যাকআপ লোড হচ্ছে...",
      "btnRestore": "নির্বাচিত ব্যাকআপ পুনরুদ্ধার করুন"
    },
    "noBackup": {
      "title": "ব্যাকআপ থেকে পুনরুদ্ধার উপলব্ধ নেই",
      "descBefore": "এই ফিচার সক্রিয় করতে মডিউল প্যানেল থেকে ",
      "backupsModule": "ব্যাকআপ",
      "descAfter": " মডিউল ইন্সটল করুন।"
    }
  },
  "imagePicker": {
    "title": "ছবি বেছে নিন",
    "subtitle": "ফ্রন্টেন্ডের পাবলিক ফোল্ডারে উপলব্ধ ছবি।",
    "empty": "পাবলিক ফোল্ডারে কোনো ছবি নেই।",
    "btnUpload": "নতুন ছবি আপলোড করুন",
    "btnCancel": "বাতিল করুন"
  },
  "smtpTest": {
    "dialogTitle": "পরীক্ষামূলক ইমেইল পাঠান",
    "labelRecipient": "প্রাপক",
    "placeholderRecipient": "আপনি@উদাহরণ.com",
    "btnCancel": "বাতিল করুন",
    "btnSend": "পাঠান"
  },
  "passkeysDialog": {
    "title": "Passkey পরিচালনা করুন",
    "btnAdd": "Passkey যোগ করুন",
    "empty": "কোনো Passkey নিবন্ধিত নেই"
  },
  "recoveryDialog": {
    "title": "পুনরুদ্ধার কোড",
    "btnGenerate": "তৈরি / পুনরায় তৈরি করুন",
    "loading": "লোড হচ্ছে...",
    "warningText": "এই কোডগুলো নিরাপদ স্থানে রাখুন। এগুলো শুধুমাত্র একবার দেখানো হয়।",
    "btnCopy": "সব কপি করুন",
    "btnPrint": "মুদ্রণ করুন"
  },
  "setup2faDialog": {
    "title": "2FA কনফিগার করুন",
    "subtitle": "আপনার প্রমাণীকরণ অ্যাপ দিয়ে এই QR কোড স্ক্যান করুন।",
    "secretLabel": "ম্যানুয়াল Secret:",
    "copyTitle": "কপি করুন",
    "verifyLabel": "৬ সংখ্যার কোড লিখুন:",
    "btnCancel": "বাতিল করুন",
    "btnActivate": "2FA সক্রিয় করুন"
  },
  "disable2faDialog": {
    "title": "2FA নিষ্ক্রিয় করবেন?",
    "body": "2FA নিষ্ক্রিয় হবে, তবে পরে পুনরায় সক্রিয় করার জন্য সিক্রেট সংরক্ষিত থাকবে।",
    "btnCancel": "বাতিল করুন",
    "btnConfirm": "2FA নিষ্ক্রিয় করুন"
  },
  "delete2faDialog": {
    "title": "2FA মুছবেন?",
    "body": "সংরক্ষিত সিক্রেট মুছে যাবে এবং 2FA আবার ব্যবহার করতে নতুনভাবে কনফিগার করতে হবে।",
    "btnCancel": "বাতিল করুন",
    "btnConfirm": "2FA মুছে ফেলুন"
  },
  "auditLogDialog": {
    "title": "অডিট লগ",
    "empty": "কোনো কার্যকলাপ রেকর্ড নেই"
  },
  "modulesCache": {
    "agoSeconds": "{n}স আগে",
    "agoMinutes": "{n}মি আগে",
    "agoHours": "{n}ঘ আগে",
    "agoDays": "{n}দ আগে",
    "collectionSingular": "কালেকশন",
    "collectionPlural": "কালেকশন",
    "activeSingular": "সক্রিয়",
    "activePlural": "সক্রিয়",
    "enabledTitle": "ক্লায়েন্ট সার্ভারের dispatcher-এর মাধ্যমে নির্ধারিত সংগ্রহ",
    "badgeEnabled": "সক্রিয়",
    "disabledTitle": "/panel/modules-এ প্যারেন্ট মডিউল নিষ্ক্রিয় — সংগ্রহ বিরতিতে",
    "badgeDisabled": "নিষ্ক্রিয়",
    "buttonSave": "সংরক্ষণ করুন",
    "saving": "সংরক্ষণ হচ্ছে…",
    "savedStatus": "{module}/{collection} আপডেট হয়েছে",
    "saveError": "{module}/{collection} সংরক্ষণে ত্রুটি: {message}",
    "loadedSummary": "{modules} মডিউলে {count}টি ক্যাশযোগ্য কালেকশন। পরিবর্তনগুলো কালেক্টরের পরবর্তী চক্রে প্রয়োগ হবে (≤60s)।",
    "loadError": "ত্রুটি: {message}"
  },
  "labels": {
    "auditLogin": "লগইন",
    "auditLoginFailed": "লগইন প্রচেষ্টা ব্যর্থ",
    "auditLogout": "লগআউট",
    "auditPasswordChange": "পাসওয়ার্ড পরিবর্তন",
    "auditPasskeyRegister": "Passkey নিবন্ধিত",
    "auditPasskeyDelete": "Passkey মুছে ফেলা হয়েছে",
    "auditRecoveryCodeUsed": "পুনরুদ্ধার কোড ব্যবহৃত",
    "auditProfileUpdate": "প্রোফাইল আপডেট হয়েছে",
    "auditSettingsUpdate": "সেটিংস আপডেট হয়েছে",
    "audit2faEnabled": "2FA সক্রিয় করা হয়েছে",
    "audit2faDisabled": "2FA নিষ্ক্রিয় করা হয়েছে",
    "auditEventDefault": "ইভেন্ট",
    "aiHintAnthropic": "প্রস্তাবিত মডেল: claude-fable-5 (সর্বশেষ), claude-sonnet-4-6 (ভারসাম্যপূর্ণ), claude-opus-4-6 (সবচেয়ে শক্তিশালী)",
    "aiKeyHintAnthropic": "console.anthropic.com থেকে আপনার API key নিন",
    "aiHintOpenai": "gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna",
    "aiKeyHintOpenai": "platform.openai.com থেকে আপনার API key নিন",
    "aiHintOllama": "স্থানীয় Ollama-তে ইনস্টল করা মডেলের নাম। টুল সমর্থিত নয়।",
    "aiKeyHintOllama": "স্থানীয় Ollama-তে API key প্রয়োজন নেই",
    "managedByLp": "LP-LICENSE-SERVER দ্বারা পরিচালিত",
    "notAvailable": "অনুপলব্ধ",
    "managedExternally": "বাহ্যিকভাবে পরিচালিত",
    "twoFaManagedByLp": "এই মোডে প্রমাণীকরণ LP-LICENSE-SERVER থেকে পরিচালিত হয়।",
    "licenseNoStatus": "কোনো অবস্থা নেই",
    "licenseActive": "সক্রিয়",
    "licenseExpires": "{date} তারিখে মেয়াদ শেষ",
    "licenseActiveDesc": "লাইসেন্স সক্রিয়",
    "licenseDegraded": "অবনমিত",
    "licensePending": "অপেক্ষমাণ",
    "licenseDegradedDesc": "লাইসেন্স যাচাই করা যায়নি এবং প্যানেলটি অবনমিত মোডে চলছে।",
    "licenseNotActivated": "লাইসেন্স এখনও সক্রিয় করা হয়নি।",
    "passkeyCount": "{count}টি Passkey নিবন্ধিত",
    "noPasskeys": "কোনো Passkey নিবন্ধিত নেই",
    "recoveryCodesGenerated": "পুনরুদ্ধার কোড তৈরি হয়েছে",
    "noRecoveryCodes": "কোনো কোড তৈরি হয়নি",
    "passkeyRegistered": "{date} তারিখে নিবন্ধিত",
    "recoveryCodesActive": "আপনার কাছে সক্রিয় পুনরুদ্ধার কোড রয়েছে।",
    "recoveryCodesNone": "আপনার কাছে কোনো সক্রিয় পুনরুদ্ধার কোড নেই।",
    "recoveryCodesDisplayed": "{count}টি কোড তৈরি হয়েছে। এগুলো নিরাপদ স্থানে সংরক্ষণ করুন।",
    "twoFaEnabled": "সক্রিয়",
    "twoFaEnabledDesc": "পরবর্তী লগইনে এই 2FA চাওয়া হবে। সিক্রেট না মুছে এটি নিষ্ক্রিয় করতে পারবেন।",
    "twoFaDisabled": "নিষ্ক্রিয়",
    "twoFaDisabledDesc": "সিক্রেট সংরক্ষিত আছে, তবে পুনরায় সক্রিয় না করা পর্যন্ত লগইনে চাওয়া হবে না।",
    "twoFaSetupPrompt": "এই প্রশাসনিক অ্যাকাউন্ট সুরক্ষিত করতে 2FA সক্রিয় করুন।",
    "printRecoveryCodesTitle": "পুনরুদ্ধার কোড - LUXIPANEL",
    "printRecoveryCodesDesc": "এই কোডগুলো নিরাপদ স্থানে সংরক্ষণ করুন। প্রতিটি শুধুমাত্র একবার ব্যবহার করা যাবে।"
  },
  "toasts": {
    "errorSaving": "সেটিংস সংরক্ষণে ত্রুটি",
    "errorSavingAppearance": "লাইসেন্স সার্ভারে চেহারা সংরক্ষণ করা যায়নি। কয়েক সেকেন্ড পরে আবার চেষ্টা করুন।",
    "licenseKeyAndRefRequired": "লাইসেন্স কী এবং পেমেন্ট রেফারেন্স দিন",
    "licenseActivated": "লাইসেন্স সফলভাবে সক্রিয় হয়েছে",
    "licenseActivateError": "লাইসেন্স সক্রিয় করা যায়নি",
    "timezoneApplyError": "সিস্টেমে টাইমজোন প্রয়োগ করা যায়নি",
    "timezoneSavedNotApplied": "প্যানেলে টাইমজোন সংরক্ষিত হয়েছে, তবে সিস্টেমে প্রয়োগ করা যায়নি (sudo অনুমতি পরীক্ষা করুন)।",
    "passkeysInLp": "Passkey LP-LICENSE-SERVER-এ পরিচালিত হয়",
    "passkeyDeleted": "Passkey মুছে ফেলা হয়েছে",
    "passkeyDeleteError": "Passkey মুছতে ত্রুটি",
    "passkeyBrowserUnsupported": "আপনার ব্রাউজার Passkey সমর্থন করে না",
    "passkeyRegisterInitError": "নিবন্ধন শুরু করা যায়নি",
    "passkeyRegisterCancelled": "নিবন্ধন বাতিল হয়েছে",
    "passkeyRegisterFinishError": "নিবন্ধন সম্পন্ন করতে ত্রুটি",
    "passkeyRegistered": "Passkey সফলভাবে নিবন্ধিত হয়েছে",
    "passkeyRegisterUserCancelled": "ব্যবহারকারী নিবন্ধন বাতিল করেছেন",
    "passkeyRegisterError": "Passkey নিবন্ধনে ত্রুটি",
    "recoveryCodesInLp": "পুনরুদ্ধার কোড LP-LICENSE-SERVER-এ পরিচালিত হয়",
    "recoveryCodesGenerateError": "কোড তৈরিতে ত্রুটি",
    "twoFaInLp": "2FA LP-LICENSE-SERVER-এ পরিচালিত হয়",
    "twoFaSetupInitError": "2FA কনফিগারেশন শুরু করতে ত্রুটি",
    "twoFaQrError": "QR তৈরি করা যায়নি",
    "twoFaActivated": "2FA সফলভাবে সক্রিয় হয়েছে",
    "twoFaDisabled": "লগইনের জন্য 2FA নিষ্ক্রিয় করা হয়েছে",
    "twoFaDisableError": "2FA নিষ্ক্রিয় করতে ত্রুটি",
    "twoFaReactivated": "লগইনের জন্য 2FA সক্রিয় করা হয়েছে",
    "twoFaActivateError": "2FA সক্রিয় করতে ত্রুটি",
    "twoFaDeleted": "2FA মুছে ফেলা হয়েছে",
    "twoFaDeleteError": "2FA মুছতে ত্রুটি",
    "backupRestoreUnavailable": "এই প্যানেল থেকে Backups পুনরুদ্ধার এখনও উপলব্ধ নয়।",
    "imageExceeds5mb": "ছবিটি 5MB ছাড়িয়ে গেছে",
    "uploadingImage": "ছবি আপলোড হচ্ছে...",
    "imageUploadError": "ছবি আপলোডে ত্রুটি",
    "imageUploadInvalidResponse": "সার্ভার থেকে অবৈধ প্রতিক্রিয়া",
    "imageUploaded": "ছবি সফলভাবে আপলোড হয়েছে",
    "logosRestored": "লোগো ডিফল্ট মানে পুনরুদ্ধার হয়েছে",
    "codesCopied": "কোড কপি হয়েছে",
    "secretCopied": "Secret কপি হয়েছে",
    "smtpTestSent": "{to}-এ পরীক্ষামূলক ইমেইল পাঠানো হয়েছে",
    "smtpTestError": "পাঠাতে ত্রুটি",
    "layoutReset": "ইন্টারফেস স্টাইল ডিফল্টে পুনরায় সেট হয়েছে",
    "settingsReset": "সেটিংস পুনরায় সেট হয়েছে",
    "settingsResetError": "পুনরায় সেট করতে ত্রুটি",
    "licenseRevalidated": "লাইসেন্স পুনরায় যাচাই হয়েছে",
    "licenseRevalidateError": "লাইসেন্স পুনরায় যাচাই করা যায়নি"
  },
  "actions": {
    "activating": "সক্রিয় করা হচ্ছে...",
    "activateOrUpdate": "সক্রিয় / আপডেট করুন",
    "manage": "পরিচালনা করুন",
    "configure": "কনফিগার করুন",
    "viewOrRegenerate": "দেখুন / পুনরায় তৈরি করুন",
    "generate": "তৈরি করুন",
    "generating": "তৈরি হচ্ছে...",
    "generateOrRegenerate": "তৈরি / পুনরায় তৈরি করুন",
    "disable": "নিষ্ক্রিয় করুন",
    "activate": "সক্রিয় করুন",
    "activate2fa": "2FA সক্রিয় করুন",
    "continue": "চালিয়ে যান",
    "sending": "পাঠানো হচ্ছে...",
    "send": "পাঠান",
    "resetting": "পুনরায় সেট হচ্ছে...",
    "factoryReset": "ফ্যাক্টরি রিসেট করুন"
  },
  "errors": {
    "twoFaEnter6Digits": "কোডের ৬টি সংখ্যা দিন",
    "twoFaInvalidCode": "অবৈধ কোড"
  },
  "confirm": {
    "deletePasskeyTitle": "Passkey মুছুন",
    "deletePasskeyBody": "এই Passkey মুছবেন?",
    "restoreBackupBody": "Backup \"{id}\" পুনরুদ্ধার করবেন?",
    "restoreBackupTitle": "Backup পুনরুদ্ধার করুন",
    "restoreLogosBody": "লোগো LUXIPANEL-এর ডিফল্টে পুনরুদ্ধার করবেন?",
    "restoreLogosTitle": "লোগো পুনরুদ্ধার করুন",
    "restoreLogosConfirm": "হ্যাঁ, পুনরুদ্ধার করুন",
    "resetLayoutBody": "ইন্টারফেস স্টাইল LUXIPANEL-এর ডিফল্টে পুনরায় সেট করবেন? কাস্টম লোগো, রং, ছায়া এবং পটভূমি মুছে যাবে।",
    "resetLayoutTitle": "স্টাইল পুনরায় সেট করুন",
    "resetLayoutConfirm": "হ্যাঁ, পুনরায় সেট করুন",
    "factoryResetBody": "আপনি কি নিশ্চিত? এটি প্যানেলের সব সেটিংস পুনরায় সেট করবে।",
    "factoryResetTitle": "সেটিংস পুনরায় সেট করুন",
    "factoryResetConfirm": "হ্যাঁ, পুনরায় সেট করুন"
  },
  "empty": {
    "noBackups": "কোনো Backup উপলব্ধ নেই।"
  },
  "palettes": {
    "violet": {
      "name": "বেগুনি",
      "description": "LUXIPANEL-এর ডিফল্ট প্যালেট।"
    },
    "ocean": {
      "name": "সমুদ্র",
      "description": "পেশাদার ও প্রশান্ত নীল রঙ।"
    },
    "emerald": {
      "name": "পান্না",
      "description": "তাজা ও প্রাকৃতিক সবুজ রঙ।"
    },
    "sunset": {
      "name": "সূর্যাস্ত",
      "description": "উষ্ণ কমলা ও অ্যাম্বার রঙ।"
    },
    "rose": {
      "name": "গোলাপ",
      "description": "প্রাণবন্ত গোলাপি ও ম্যাজেন্টা রঙ।"
    },
    "indigo": {
      "name": "ইন্ডিগো",
      "description": "মার্জিত ও আধুনিক ইন্ডিগো রঙ।"
    },
    "aqua": {
      "name": "আকোয়া",
      "description": "উজ্জ্বল ফিরোজা ও সায়ান রঙ।"
    },
    "graphite": {
      "name": "গ্রাফাইট",
      "description": "সংযত ও একরঙা নিরপেক্ষ ধূসর রঙ।"
    },
    "amber": {
      "name": "অ্যাম্বার",
      "description": "উষ্ণ সোনালি ও মধুবর্ণ রঙ।"
    },
    "fuchsia": {
      "name": "ফুশিয়া",
      "description": "গভীর ম্যাজেন্টা ও বেগুনি রঙ।"
    },
    "lime": {
      "name": "লাইম",
      "description": "প্রাণবন্ত লাইম সবুজ রঙ।"
    },
    "slate": {
      "name": "স্লেট",
      "description": "পেশাদার নীলাভ ধূসর রঙ।"
    },
    "prisma": {
      "name": "প্রিজম",
      "description": "সব প্যালেটের রংকে একটি ধারাবাহিক, অসীম রূপান্তরে মিশিয়ে দেয়।",
      "colors": "রং",
      "addColorButton": "রং যোগ করুন",
      "addColorAria": "প্রিজম ইফেক্টের জন্য একটি রং বেছে নিন এবং যোগ করুন",
      "addColorInputAria": "প্রিজম ইফেক্টে যোগ করার রং",
      "editColorAria": "রং সম্পাদনা করুন",
      "editColorInputAria": "রংয়ের মান সম্পাদনা করুন",
      "editColorHexAria": "রংয়ের হেক্স মান",
      "removeColorAria": "রং মুছে ফেলুন",
      "moveUpAria": "রং উপরে সরান",
      "moveDownAria": "রং নিচে সরান",
      "helpText": "তীর দিয়ে তালিকার ক্রম পুনর্বিন্যাস করুন। প্রতিটি রং ইফেক্টের ক্রম নির্ধারণ করে।"
    },
    "custom": {
      "name": "কাস্টম",
      "description": "আপনার বেস রং বেছে নিন এবং এর তীব্রতা সামঞ্জস্য করুন।",
      "baseColor": "বেস রং",
      "baseColorAria": "কাস্টম বেস রং",
      "hexAria": "কাস্টম বেস রঙের হেক্স মান"
    },
    "luxisoft": {
      "description": "হালকা মোডে নেভি নীল ও মিন্ট; গাঢ় মোডে গ্রাফাইট ও মিন্ট।",
      "name": "Luxisoft"
    }
  },
  "managers": {
    "default": "ম্যানেজার ১"
  },
  "git": {
    "errorFallback": "ত্রুটি"
  }
} as const;

export default settings;
