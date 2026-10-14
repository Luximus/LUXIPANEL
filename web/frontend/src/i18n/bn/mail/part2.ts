// Auto-split fragment of mail.ts (part 2/2) — data only, keeps <1000 lines.
// Do not reorder keys: the aggregator merges parts by spread in original order.
const mailPart2 = {
  "routing": {
    "labels": {
      "autoRemote": "স্বয়ংক্রিয়ভাবে কনফিগারেশন শনাক্ত করুন: রিমোট",
      "local": "লোকাল মেইল এক্সচেঞ্জার",
      "backup": "ব্যাকআপ মেইল এক্সচেঞ্জার",
      "remote": "রিমোট মেইল এক্সচেঞ্জার"
    },
    "currentMode": "বর্তমান: {mode}"
  },
  "tracking": {
    "statuses": {
      "success": "সফল",
      "deferred": "স্থগিত",
      "failure": "ব্যর্থ",
      "inProgress": "চলমান",
      "unknown": "অজানা"
    },
    "columns": {
      "event": "ঘটনা",
      "fromAddress": "প্রেরকের ঠিকানা",
      "sentTime": "প্রেরণের সময়",
      "spamScore": "স্প্যাম স্কোর",
      "recipient": "প্রাপক",
      "domain": "ডোমেইন",
      "id": "ID",
      "result": "ফলাফল",
      "actions": "কার্যক্রম"
    },
    "noRecordsFound": "কোনো রেকর্ড পাওয়া যায়নি।",
    "zeroRecords": "০টি রেকর্ড",
    "matchesZeroRecords": "অনুসন্ধানে ০টি রেকর্ড মিলেছে।",
    "recordsCount": "{count}টি রেকর্ড",
    "matchesRecords": "অনুসন্ধানে {count}টি রেকর্ড মিলেছে।",
    "detailMeta": "ইভেন্ট: {event} | ID: {id} | প্রাপক: {recipient}"
  },
  "filters": {
    "ruleParts": {
      "from": "প্রেরক",
      "subject": "বিষয়",
      "to": "প্রাপক",
      "anyRecipient": "যেকোনো প্রাপক",
      "reply": "উত্তর",
      "body": "মূল বিষয়বস্তু",
      "anyHeader": "যেকোনো হেডার",
      "notDelivered": "পূর্বে ডেলিভারি হয়নি",
      "errorMessage": "ত্রুটি বার্তা",
      "listId": "তালিকা ID",
      "spamStatus": "স্প্যাম স্ট্যাটাস",
      "spamBar": "স্প্যাম বার",
      "spamScore": "স্প্যাম স্কোর"
    },
    "matches": {
      "contains": "অন্তর্ভুক্ত করে",
      "matchesRegex": "regex-এর সাথে মেলে",
      "doesNotContain": "অন্তর্ভুক্ত করে না",
      "equals": "সমান",
      "beginsWith": "দিয়ে শুরু",
      "endsWith": "দিয়ে শেষ",
      "doesNotBegin": "দিয়ে শুরু হয় না",
      "doesNotEnd": "দিয়ে শেষ হয় না",
      "doesNotMatch": "মেলে না",
      "isAbove": "এর উপরে (শুধু সংখ্যা)",
      "isNotAbove": "এর উপরে নয় (শুধু সংখ্যা)",
      "isBelow": "এর নিচে (শুধু সংখ্যা)",
      "isNotBelow": "এর নিচে নয় (শুধু সংখ্যা)"
    },
    "actions": {
      "discard": "বার্তা বাতিল করুন",
      "redirect": "ইমেইলে পুনঃনির্দেশ করুন",
      "fail": "বার্তাসহ ব্যর্থ করুন",
      "stop": "নিয়ম প্রক্রিয়াকরণ বন্ধ করুন",
      "deliverToFolder": "ফোল্ডারে ডেলিভারি করুন",
      "pipe": "প্রোগ্রামে পাইপ করুন"
    },
    "joinOp": {
      "and": "এবং",
      "or": "বা"
    },
    "removeBtn": "-"
  },
  "defaultAddress": {
    "currentSetting": {
      "none": "বর্তমান সেটিং: (কিছু নেই)",
      "forward": "বর্তমান সেটিং: {destination}",
      "forwardDefault": "(ফরওয়ার্ড)",
      "fail": "বর্তমান সেটিং: :fail: {message}"
    },
    "defaultFailMessage": "এখানে এমন কোনো ব্যবহারকারী নেই"
  },
  "archive": {
    "retentionOptions": {
      "oneMonth": "১ মাস",
      "threeMonths": "৩ মাস",
      "sixMonths": "৬ মাস",
      "oneYear": "১ বছর",
      "twoYears": "২ বছর",
      "fiveYears": "৫ বছর",
      "tenYears": "১০ বছর",
      "forever": "চিরকাল",
      "custom": "কাস্টম"
    },
    "fields": {
      "incomingEmail": "আগত ইমেইল বার্তা",
      "outgoingMailingList": "বহির্গামী মেইলিং লিস্ট ইমেইল বার্তা",
      "outgoingEmail": "বহির্গামী ইমেইল বার্তা"
    }
  },
  "encryption": {
    "neverExpires": "কখনো মেয়াদ শেষ হয় না"
  },
  "actions": {
    "view": "দেখুন",
    "save": "সংরক্ষণ করুন",
    "clone": "ক্লোন",
    "copy": "কপি",
    "delete": "মুছুন",
    "edit": "এডিট",
    "remove": "সরান"
  },
  "outbound": {
    "cardTitle": "প্যানেল ইমেল প্রেরণ (SMTP)",
    "cardDesc": "ডিফল্ট অ্যাকাউন্ট বা বহিরাগত SMTP যা দিয়ে প্যানেল রিপোর্ট এবং সিস্টেম ইমেল পাঠায়।",
    "back": "ফিরে যান",
    "intro": "যে পরিচয় দিয়ে LUXIPANEL সিস্টেম ইমেল পাঠায় (cron এজেন্ট রিপোর্ট, অনুমোদন লিঙ্ক, পরীক্ষা)। এটি এই সার্ভারের একটি ইমেল অ্যাকাউন্ট বা সার্ভারের বাইরের একটি বহিরাগত SMTP হতে পারে।",
    "modeLabel": "প্রেরণ মোড",
    "modeDisabled": "নিষ্ক্রিয়",
    "modeAccount": "সার্ভারের ইমেল অ্যাকাউন্ট (ডিফল্ট)",
    "modeExternal": "বহিরাগত SMTP",
    "accountLabel": "ডিফল্ট প্রেরণ অ্যাকাউন্ট",
    "accountHint": "সেই অ্যাকাউন্টের সংরক্ষিত SMTP শংসাপত্র ব্যবহার করে।",
    "hostLabel": "SMTP সার্ভার",
    "portLabel": "পোর্ট",
    "userLabel": "ব্যবহারকারী",
    "passLabel": "পাসওয়ার্ড",
    "passPlaceholder": "(অপরিবর্তিত)",
    "fromLabel": "প্রেরক (ইমেল)",
    "fromNameLabel": "প্রেরকের নাম",
    "secureLabel": "সরাসরি TLS (পোর্ট 465)",
    "save": "সংরক্ষণ",
    "testPlaceholder": "to@example.com",
    "test": "পরীক্ষা পাঠান",
    "hostPlaceholder": "smtp.example.com",
    "fromPlaceholder": "sender@example.com",
    "fromNamePlaceholder": "আমার কোম্পানি"
  },
  "table": {
    "status": {
      "active": "সক্রিয়",
      "inactive": "নিষ্ক্রিয়",
      "disabled": "নিষ্ক্রিয়"
    },
    "redirect": {
      "columns": {
        "domain": "ডোমেইন",
        "destinos": "গন্তব্য"
      },
      "filters": {
        "searchDomain": "ডোমেইন খুঁজুন…"
      },
      "rowActions": {
        "edit": "সম্পাদনা",
        "delete": "মুছুন"
      }
    },
    "encryption": {
      "columns": {
        "keyId": "কী ID",
        "label": "পরিচয়",
        "keySize": "কী সাইজ",
        "created": "তৈরি",
        "expires": "মেয়াদ শেষ"
      },
      "filters": {
        "searchKey": "কী খুঁজুন…"
      },
      "rowActions": {
        "view": "দেখুন",
        "delete": "মুছুন"
      }
    },
    "accounts": {
      "columns": {
        "address": "ঠিকানা",
        "domain": "ডোমেইন",
        "uso": "কোটা / ব্যবহার",
        "reenvios": "ফরওয়ার্ড",
        "estado": "অবস্থা"
      },
      "filters": {
        "search": "ঠিকানা বা ডোমেইন খুঁজুন…",
        "domain": "ডোমেইন",
        "estado": "অবস্থা"
      },
      "rowActions": {
        "edit": "অ্যাকাউন্ট সম্পাদনা",
        "depurarIa": "AI দিয়ে পরিষ্কার করুন",
        "password": "পাসওয়ার্ড পরিবর্তন করুন",
        "toggle": "সক্রিয় / নিষ্ক্রিয়",
        "inbox": "মেইলবক্স খুলুন",
        "signatures": "স্বাক্ষর পরিচালনা",
        "default": "ডিফল্ট হিসেবে ব্যবহার",
        "contacts": "পরিচিতি পরিচালনা",
        "calendars": "ক্যালেন্ডার পরিচালনা",
        "autoresponder": "অটোরেসপন্ডার পরিচালনা",
        "filters": "ফিল্টার পরিচালনা",
        "forwards": "ফরওয়ার্ডিং পরিচালনা করুন",
        "diskusage": "ডিস্ক ব্যবহার পরিচালনা",
        "clone": "মেইল ক্লোন করুন",
        "delete": "অ্যাকাউন্ট মুছুন"
      },
      "quickActions": {
        "bulkForward": "ফরওয়ার্ড যোগ করুন",
        "bulkQuota": "কোটা পরিবর্তন",
        "bulkDelete": "অ্যাকাউন্ট মুছুন"
      }
    },
    "globalFilters": {
      "columns": {
        "name": "ফিল্টার",
        "estado": "অবস্থা",
        "rules": "নিয়ম",
        "actionsCount": "কার্যক্রম"
      },
      "filters": {
        "search": "ফিল্টার খুঁজুন…"
      },
      "rowActions": {
        "edit": "সম্পাদনা",
        "delete": "মুছুন"
      }
    },
    "contacts": {
      "columns": {
        "email": "ইমেইল",
        "name": "নাম"
      },
      "filters": {
        "searchEmail": "ইমেল খুঁজুন…"
      },
      "rowActions": {
        "edit": "সম্পাদনা",
        "delete": "মুছুন"
      }
    },
    "calendars": {
      "columns": {
        "name": "নাম",
        "timezone": "টাইমজোন",
        "estado": "অবস্থা"
      },
      "filters": {
        "search": "ক্যালেন্ডার খুঁজুন…"
      },
      "rowActions": {
        "edit": "সম্পাদনা",
        "delete": "মুছুন"
      }
    },
    "signatures": {
      "columns": {
        "sender": "প্রেরক",
        "preview": "স্বাক্ষর"
      },
      "filters": {
        "search": "ফিল্টার ও খুঁজুন…"
      },
      "rowActions": {
        "edit": "সম্পাদনা",
        "delete": "মুছুন"
      }
    },
    "filters": {
      "columns": {
        "name": "নাম",
        "estado": "অবস্থা"
      },
      "filters": {
        "search": "ফিল্টার খুঁজুন…"
      },
      "rowActions": {
        "edit": "সম্পাদনা",
        "delete": "মুছুন"
      }
    }
  },
  "confirm": {
    "bulkDeleteAccounts": "{count}টি email অ্যাকাউন্ট মুছবেন? এই কাজটি ফেরানো যাবে না।",
    "deleteAccount": "{address} অ্যাকাউন্টটি মুছবেন? এই কাজটি ফেরানো যাবে না।",
    "deleteAccountTitle": "অ্যাকাউন্ট মুছুন",
    "deleteAutoresponder": "এই অ্যাকাউন্টের autoresponder মুছবেন?",
    "deleteByDate": "{from} এবং {to} এর মধ্যে {folder} এর email মুছে ফেলা হবে। চালিয়ে যাবেন?",
    "deleteByDateTitle": "তারিখ অনুযায়ী email মুছুন",
    "deleteCalendar": "\"{label}\" ক্যালেন্ডার মুছবেন?",
    "deleteCalendarTitle": "ক্যালেন্ডার মুছুন",
    "deleteContact": "\"{label}\" কন্টাক্ট মুছবেন?",
    "deleteContactTitle": "কন্টাক্ট মুছুন",
    "deleteDomainForward": "@{domain} এর গ্লোবাল রিডাইরেকশন মুছবেন?",
    "deleteDomainForwardTitle": "গ্লোবাল রিডাইরেকশন মুছুন",
    "deleteEncryptionKey": "এই এনক্রিপশন কী মুছবেন?",
    "deleteFilter": "\"{name}\" ফিল্টারটি মুছবেন?",
    "deleteFilterTitle": "ফিল্টার মুছুন",
    "deleteForward": "{destination} এ ফরওয়ার্ডিং মুছবেন?",
    "deleteGlobalFilter": "\"{label}\" গ্লোবাল ফিল্টার মুছবেন?",
    "deleteGlobalFilterTitle": "গ্লোবাল ফিল্টার মুছুন",
    "yesDelete": "হ্যাঁ, মুছুন"
  },
  "empty": {
    "noDomains": "কোনো domain নেই",
    "noFolders": "এই অ্যাকাউন্টের জন্য কোনো ফোল্ডার পাওয়া যায়নি।",
    "noOtherAccount": "অন্য কোনো অ্যাকাউন্ট উপলব্ধ নেই"
  },
  "errors": {
    "accountCreateFailed": "অ্যাকাউন্ট তৈরি করতে ব্যর্থ",
    "accountNotFound": "অ্যাকাউন্ট পাওয়া যায়নি",
    "accountUpdateFailed": "অ্যাকাউন্ট আপডেট করতে ব্যর্থ",
    "accountUpdatedForwardsFailed": "অ্যাকাউন্ট আপডেট হয়েছে, তবে ফরওয়ার্ডিং আপডেট করতে ব্যর্থ হয়েছে",
    "accountsLoadFailed": "অ্যাকাউন্ট লোড করতে ব্যর্থ",
    "autoDeleteThresholdInvalid": "Auto-Delete Threshold অবৈধ।",
    "autoresponderDeleteFailed": "autoresponder মুছতে পারা যায়নি",
    "autoresponderSaveFailed": "autoresponder সংরক্ষণ করা যায়নি।",
    "calendarDeleteFailed": "ক্যালেন্ডার মুছতে পারা যায়নি",
    "calendarNotFound": "ক্যালেন্ডার পাওয়া যায়নি",
    "calendarSaveFailed": "ক্যালেন্ডার সংরক্ষণ করা যায়নি।",
    "cloneCreateFailed": "নতুন অ্যাকাউন্ট তৈরি করা যায়নি।",
    "cloneFailed": "email ক্লোন করা যায়নি।",
    "cloneIdResolveFailed": "অ্যাকাউন্ট তৈরি হয়েছে, তবে এর ID সমাধান করা যায়নি। 'বিদ্যমান' হিসেবে পুনরায় চেষ্টা করুন।",
    "cloneLocalAndDomainRequired": "লোকাল অংশ এবং domain উল্লেখ করুন।",
    "clonePasswordTooShort": "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।",
    "contactDeleteFailed": "কন্টাক্ট মুছতে পারা যায়নি",
    "contactNotFound": "কন্টাক্ট পাওয়া যায়নি",
    "contactSaveFailed": "কন্টাক্ট সংরক্ষণ করা যায়নি।",
    "copyByRangeFailed": "রেঞ্জ অনুযায়ী কপি করা যায়নি",
    "customScoreInvalid": "Custom score অবৈধ।",
    "dateRangeRequired": "আপনাকে শুরু এবং শেষের তারিখ নির্বাচন করতে হবে",
    "defaultAddressLoadFailed": "Default Address লোড করা যায়নি।",
    "defaultAddressSaveFailed": "Default Address সংরক্ষণ করা যায়নি।",
    "deleteByRangeFailed": "রেঞ্জ অনুযায়ী মুছতে পারা যায়নি",
    "deleteFailed": "মুছতে ব্যর্থ",
    "destEmailInvalid": "গন্তব্য email অবৈধ",
    "destinationsInvalidFormat": "এক বা একাধিক গন্তব্যের ফরম্যাট অবৈধ।",
    "diskUsageLoadFailed": "disk usage লোড করা যায়নি",
    "domainForwardDeleteFailed": "গ্লোবাল রিডাইরেকশন মুছা যায়নি।",
    "domainForwardsLoadFailed": "গ্লোবাল রিডাইরেকশন লোড করা যায়নি।",
    "domainRedirectSaveFailed": "গ্লোবাল রিডাইরেকশন সংরক্ষণ করা যায়নি।",
    "domainsLoadFailed": "DNS domain লোড করা যায়নি",
    "filterDeleteFailed": "ফিল্টার মুছা যায়নি",
    "filterNotFound": "ফিল্টার পাওয়া যায়নি",
    "filterSaveFailed": "ফিল্টার সংরক্ষণ করা যায়নি।",
    "forwardAlreadyExists": "{destination} এ একটি ফরওয়ার্ডিং ইতিমধ্যে বিদ্যমান",
    "forwardsSaveFailed": "সার্ভারে ফরওয়ার্ডিং সংরক্ষণ করা যায়নি",
    "globalFilterDeleteFailed": "গ্লোবাল ফিল্টার মুছা যায়নি।",
    "globalFilterSaveFailed": "গ্লোবাল ফিল্টার সংরক্ষণ করা যায়নি।",
    "globalFilterTestFailed": "টেস্ট চালানো যায়নি।",
    "globalFiltersLoadFailed": "গ্লোবাল ফিল্টার লোড করা যায়নি।",
    "indicateTestDestEmail": "টেস্টের গন্তব্য email উল্লেখ করুন।",
    "localPartInvalid": "@ এর আগের ব্যবহারকারীর ফরম্যাট অবৈধ।",
    "localPartInvalidNoPoint": "@ এর আগের ব্যবহারকারীর ফরম্যাট অবৈধ",
    "mustAddAtLeastOneAction": "আপনাকে অন্তত একটি অ্যাকশন যোগ করতে হবে।",
    "mustAddAtLeastOneDestEmail": "আপনাকে অন্তত একটি গন্তব্য email যোগ করতে হবে।",
    "mustAddAtLeastOneRule": "আপনাকে অন্তত একটি নিয়ম যোগ করতে হবে।",
    "mustEnterBody": "আপনাকে বার্তার বিষয়বস্তু লিখতে হবে।",
    "mustEnterSubject": "আপনাকে একটি বিষয় লিখতে হবে।",
    "mustEnterTestMessage": "আপনাকে একটি টেস্ট বার্তা লিখতে হবে।",
    "mustEnterValidDestEmail": "আপনাকে একটি বৈধ গন্তব্য email লিখতে হবে।",
    "mustIndicateCalendarName": "আপনাকে ক্যালেন্ডারের নাম উল্লেখ করতে হবে।",
    "mustIndicateContactEmail": "আপনাকে কন্টাক্টের email উল্লেখ করতে হবে।",
    "mustIndicateFilterName": "আপনাকে একটি ফিল্টারের নাম উল্লেখ করতে হবে।",
    "mustIndicateName": "আপনাকে একটি নাম উল্লেখ করতে হবে।",
    "mustSelectDomain": "আপনাকে একটি domain নির্বাচন করতে হবে।",
    "mustSelectDomainNoPoint": "আপনাকে একটি domain নির্বাচন করতে হবে",
    "noAutoresponderToDelete": "মুছার জন্য কোনো autoresponder নেই",
    "passwordChangeFailed": "পাসওয়ার্ড পরিবর্তন করতে ব্যর্থ",
    "quotaInvalid": "Quota অবৈধ",
    "routingLoadFailed": "Email Routing কনফিগারেশন লোড করা যায়নি।",
    "routingSaveFailed": "Email Routing কনফিগারেশন সংরক্ষণ করা যায়নি।",
    "saveFailed": "সংরক্ষণ করতে ব্যর্থ",
    "scoreTypesLoadFailed": "score types ক্যাটালগ লোড করা যায়নি।",
    "selectDestAccount": "একটি গন্তব্য অ্যাকাউন্ট নির্বাচন করুন",
    "selectValidDomain": "একটি বৈধ domain নির্বাচন করুন।",
    "spamFiltersLoadFailed": "Spam Filters লোড করা যায়নি।",
    "spamFiltersSaveFailed": "Spam Filters কনফিগারেশন সংরক্ষণ করা যায়নি।",
    "testEmailFailed": "টেস্ট পাঠাতে ব্যর্থ",
    "toggleFailed": "অবস্থা পরিবর্তন করতে ব্যর্থ",
    "trackDeliveryLoadFailed": "Track Delivery লোড করা যায়নি।"
  },
  "labels": {
    "accountColon": "অ্যাকাউন্ট: {address}",
    "activating": "সক্রিয় করা হচ্ছে",
    "cloneStartedBg": "ক্লোনিং ব্যাকগ্রাউন্ডে শুরু হয়েছে। শেষ হলে আমরা আপনাকে নোটিফিকেশনের মাধ্যমে জানাব।",
    "cloning": "ক্লোন করা হচ্ছে…",
    "currentAccountColon": "বর্তমান অ্যাকাউন্ট: {address}",
    "deactivating": "নিষ্ক্রিয় করা হচ্ছে",
    "destEmailForCount": "{count}টি অ্যাকাউন্টে যোগ করার ফরওয়ার্ডিং এর গন্তব্য email:",
    "loading": "লোড হচ্ছে...",
    "newQuotaFor": "{count}টি অ্যাকাউন্টের জন্য MB তে নতুন quota। সীমাহীনের জন্য 0 ব্যবহার করুন।",
    "no": "না",
    "noGlobalLimit": "কোনো গ্লোবাল সীমা নেই",
    "originColon": "উৎস: {addr}",
    "sendingTest": "টেস্ট পাঠানো হচ্ছে…",
    "sudoPromptMessage": "সার্ভারে প্রিভিলেজ ছাড়া মেইলবক্সের ব্যবহার পড়া যায় না। SSH ব্যবহারকারীর sudo পাসওয়ার্ড লিখুন (সার্ভারে এনক্রিপ্ট করে সংরক্ষণ করা হয়)।",
    "to": "এ",
    "total": "মোট",
    "unlimited": "সীমাহীন",
    "yes": "হ্যাঁ",
    "keepCopy": "অনুলিপি সংরক্ষণ করুন"
  },
  "placeholders": {
    "passwordNoChanges": "•••••••• (কোনো পরিবর্তন নেই)",
    "selectDomain": "domain নির্বাচন করুন...",
    "value": "মান",
    "valueIfApplicable": "মান (প্রযোজ্য হলে)"
  },
  "status": {
    "active": "সক্রিয়",
    "deactivated": "নিষ্ক্রিয়",
    "inactive": "নিষ্ক্রিয়"
  },
  "titles": {
    "addForward": "ফরওয়ার্ডিং যোগ করুন",
    "changeQuota": "quota পরিবর্তন করুন",
    "deleteAccounts": "অ্যাকাউন্ট মুছুন",
    "deleteAutoresponder": "autoresponder মুছুন",
    "deleteEncryptionKey": "কী মুছুন",
    "deleteForward": "ফরওয়ার্ডিং মুছুন"
  },
  "toasts": {
    "accountActivated": "অ্যাকাউন্ট সক্রিয় হয়েছে",
    "accountCreated": "অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে",
    "accountDeactivated": "অ্যাকাউন্ট নিষ্ক্রিয় হয়েছে",
    "accountDeleted": "অ্যাকাউন্ট মুছে ফেলা হয়েছে",
    "accountUpdated": "অ্যাকাউন্ট আপডেট হয়েছে ({localPart}@{domain})",
    "archiveDefaultUpdated": "আর্কাইভের default কনফিগারেশন আপডেট হয়েছে।",
    "archiveDomainUpdated": "{domain} এর জন্য আর্কাইভ আপডেট হয়েছে।",
    "autoDeleteDisabled": "Auto-Delete নিষ্ক্রিয় হয়েছে",
    "autoDeleteEnabled": "Auto-Delete সক্রিয় হয়েছে",
    "autoDeleteUpdated": "Auto-Delete আপডেট হয়েছে",
    "autoresponderDeleted": "autoresponder মুছে ফেলা হয়েছে",
    "autoresponderSaved": "autoresponder সংরক্ষিত হয়েছে",
    "blacklistUpdated": "Blacklist আপডেট হয়েছে",
    "bulkDeletedCount": "{ok}/{count}টি অ্যাকাউন্ট মুছে ফেলা হয়েছে",
    "bulkUpdatedCount": "{ok}/{count}টি অ্যাকাউন্ট আপডেট হয়েছে",
    "calculatedScoresUpdated": "Calculated scores আপডেট হয়েছে",
    "calendarCreated": "ক্যালেন্ডার তৈরি হয়েছে",
    "calendarDeleted": "ক্যালেন্ডার মুছে ফেলা হয়েছে",
    "calendarUpdated": "ক্যালেন্ডার আপডেট হয়েছে",
    "cloneStarted": "ক্লোনিং শুরু হয়েছে — শেষ হলে আমরা আপনাকে জানাব",
    "contactCreated": "কন্টাক্ট তৈরি হয়েছে",
    "contactDeleted": "কন্টাক্ট মুছে ফেলা হয়েছে",
    "contactUpdated": "কন্টাক্ট আপডেট হয়েছে",
    "defaultAddressUpdated": "@{domain} এর জন্য Default Address আপডেট হয়েছে",
    "defaultInboxSet": "{address} এখন ডিফল্ট email",
    "domainForwardDeleted": "@{domain} এর গ্লোবাল রিডাইরেকশন মুছে ফেলা হয়েছে",
    "emailRoutingUpdated": "@{domain} এর জন্য Email Routing আপডেট হয়েছে",
    "emailsCopied": "{folder} থেকে {count}টি email কপি হয়েছে",
    "emailsDeleted": "{folder} থেকে {count}টি email মুছে ফেলা হয়েছে",
    "filterCreated": "ফিল্টার তৈরি হয়েছে",
    "filterDeleted": "ফিল্টার মুছে ফেলা হয়েছে",
    "filterUpdated": "ফিল্টার আপডেট হয়েছে",
    "forwardAddedCount": "{ok}/{count}টি অ্যাকাউন্টে ফরওয়ার্ডিং যোগ হয়েছে",
    "forwardDeleted": "ফরওয়ার্ডিং মুছে ফেলা হয়েছে",
    "forwardsUpdated": "ফরওয়ার্ডিং আপডেট হয়েছে",
    "globalFilterCreated": "গ্লোবাল ফিল্টার তৈরি হয়েছে",
    "globalFilterDeleted": "গ্লোবাল ফিল্টার মুছে ফেলা হয়েছে",
    "globalFilterUpdated": "গ্লোবাল ফিল্টার আপডেট হয়েছে",
    "globalRedirectSaved": "@{domain} এর জন্য গ্লোবাল রিডাইরেকশন সংরক্ষিত হয়েছে",
    "keyDeleted": "কী মুছে ফেলা হয়েছে।",
    "keyGenerated": "কী তৈরি হয়েছে।",
    "passwordUpdated": "পাসওয়ার্ড আপডেট হয়েছে",
    "publicKeyImported": "পাবলিক কী ইমপোর্ট হয়েছে।",
    "settingsSaved": "কনফিগারেশন সংরক্ষিত হয়েছে ✓",
    "spamBoxDisabled": "Spam Box নিষ্ক্রিয় হয়েছে",
    "spamBoxEnabled": "Spam Box সক্রিয় হয়েছে",
    "spamBoxUpdated": "Spam Box আপডেট হয়েছে",
    "spamFiltersDisabled": "Spam Filters নিষ্ক্রিয় হয়েছে",
    "spamFiltersEnabled": "Spam Filters সক্রিয় হয়েছে",
    "spamThresholdUpdated": "Spam Threshold আপডেট হয়েছে",
    "testEmailSent": "টেস্ট email পাঠানো হয়েছে ✓",
    "whitelistUpdated": "Whitelist আপডেট হয়েছে"
  },
  "signaturesDrawer": {
    "title": "স্বাক্ষরসমূহ",
    "addSignature": "স্বাক্ষর যোগ করুন",
    "close": "বন্ধ করুন",
    "tableTitle": "স্বাক্ষরসমূহ"
  },
  "dataTableTitles": {
    "rules": "নিয়মসমূহ",
    "publicKeys": "পাবলিক কী",
    "privateKeys": "প্রাইভেট কী",
    "accounts": "অ্যাকাউন্টসমূহ",
    "globalFilters": "গ্লোবাল ফিল্টার",
    "contacts": "পরিচিতিসমূহ",
    "calendars": "ক্যালেন্ডারসমূহ",
    "filters": "ফিল্টারসমূহ"
  },
  "trackColumns": {
    "event": "ইভেন্ট",
    "fromAddress": "প্রেরকের ঠিকানা",
    "sentTime": "পাঠানোর সময়",
    "spamScore": "স্প্যাম স্কোর",
    "recipient": "প্রাপক",
    "domain": "ডোমেইন",
    "queueId": "ID",
    "result": "ফলাফল",
    "actions": "ক্রিয়াসমূহ"
  }
} as const;

export default mailPart2;
