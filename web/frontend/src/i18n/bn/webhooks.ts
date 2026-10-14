const webhooks = {
  "pageTitle": "Webhooks ও API Keys",
  "tabs": {
    "webhooks": "Webhooks",
    "apiKeys": "API কীগুলি",
    "discovered": "শনাক্তকৃত"
  },
  "webhooksPanel": {
    "description": "HMAC স্বাক্ষরসহ আউটগোয়িং HTTP বিজ্ঞপ্তি",
    "btnNew": "নতুন webhook"
  },
  "apiKeysPanel": {
    "description": "স্থায়ী টোকেন দিয়ে প্রোগ্রামেটিক অ্যাক্সেস",
    "btnNew": "নতুন API key"
  },
  "newKeyReveal": {
    "message": "API Key তৈরি হয়েছে — এখনই কপি করুন, এটি আর দেখানো হবে না",
    "btnCopy": "কপি করুন"
  },
  "webhookDialog": {
    "placeholderUrl": "https://example.com/webhook",
    "title": "নতুন webhook",
    "labelUrl": "এন্ডপয়েন্ট URL",
    "labelEvents": "শোনার ইভেন্টসমূহ",
    "labelEnabled": "Webhook সক্রিয়",
    "btnCancel": "বাতিল",
    "btnSave": "সংরক্ষণ করুন"
  },
  "apiKeyDialog": {
    "placeholderName": "আমার ইন্টিগ্রেশন",
    "title": "নতুন API Key",
    "labelName": "বর্ণনামূলক নাম",
    "labelExpires": "মেয়াদ উত্তীর্ণ (ঐচ্ছিক)",
    "btnCancel": "বাতিল",
    "btnCreate": "কী তৈরি করুন"
  },
  "discovered": {
    "description": "সার্ভারে শনাক্তকৃত webhooks (Git, nginx, cron, systemd, কনফিগ ফাইল ও প্রজেক্ট)",
    "btnRescan": "পুনরায় স্ক্যান",
    "scanning": "সার্ভার স্ক্যান করা হচ্ছে…",
    "empty": "সার্ভারে কোনো webhook শনাক্ত করা হয়নি",
    "cols": {
      "source": "উৎস",
      "name": "নাম",
      "target": "গন্তব্য",
      "location": "অবস্থান",
      "estado": "স্ট্যাটাস"
    },
    "filters": {
      "searchTarget": "গন্তব্য খুঁজুন…",
      "source": "উৎস"
    },
    "sources": {
      "sidecar": "প্যানেল",
      "git-hook": "Git hook",
      "nginx": "Nginx",
      "cron": "Cron",
      "systemd": "systemd",
      "config": "কনফিগারেশন",
      "project": "প্রজেক্ট"
    },
    "status": {
      "enabled": "সক্রিয়",
      "disabled": "নিষ্ক্রিয়",
      "unknown": "—"
    },
    "actions": {
      "detail": "বিস্তারিত দেখুন",
      "delete": "মুছুন"
    },
    "detail": {
      "title": "শনাক্তকৃত webhook-এর বিস্তারিত",
      "source": "উৎস",
      "target": "গন্তব্য",
      "location": "অবস্থান",
      "info": "তথ্য",
      "raw": "কনফিগারেশন",
      "managedNote": "এই webhook প্যানেল দ্বারা পরিচালিত",
      "readonlyNote": "শুধু পঠনযোগ্য: সংশ্লিষ্ট মডিউল থেকে এটি পরিচালনা করুন",
      "btnClose": "বন্ধ করুন"
    },
    "confirm": {
      "deleteTitle": "শনাক্তকৃত webhook মুছুন",
      "deleteBody": "\"{name}\" মুছবেন? এটি সার্ভারের ফাইল পরিবর্তন করবে।",
      "deleteBtn": "হ্যাঁ, মুছুন"
    },
    "toasts": {
      "deleted": "মুছে ফেলা হয়েছে",
      "errorDeleting": "মুছে ফেলা যায়নি",
      "scanComplete": "স্ক্যান সম্পন্ন: {count}",
      "notManageable": "সংশ্লিষ্ট মডিউল থেকে এটি পরিচালনা করুন"
    }
  },
  "labels": {
    "statusFailing": "ব্যর্থ হচ্ছে",
    "statusActive": "সক্রিয়",
    "statusPaused": "বিরতিতে",
    "newWebhookTitle": "নতুন ওয়েবহুক",
    "noExpiry": "মেয়াদ নেই"
  },
  "confirm": {
    "rotateSecretBody": "এই ওয়েবহুকের সিক্রেট রোটেট করবেন? রিসিভার আপডেট করতে হবে।",
    "rotateSecretTitle": "সিক্রেট রোটেট করুন",
    "rotateSecretBtn": "হ্যাঁ, রোটেট করুন",
    "deleteWebhookBody": "এই ওয়েবহুক মুছবেন?",
    "deleteWebhookTitle": "ওয়েবহুক মুছুন",
    "revokeKeyBody": "API Key \"{name}\" বাতিল করবেন?",
    "revokeKeyTitle": "API Key বাতিল করুন",
    "revokeKeyBtn": "হ্যাঁ, বাতিল করুন"
  },
  "toasts": {
    "secretRotated": "সিক্রেট রোটেট হয়েছে",
    "errorRotating": "রোটেট করতে ত্রুটি",
    "webhookDeleted": "ওয়েবহুক মুছে গেছে",
    "errorDeleting": "মুছতে ত্রুটি",
    "webhookUpdated": "ওয়েবহুক আপডেট হয়েছে",
    "webhookCreated": "ওয়েবহুক তৈরি হয়েছে",
    "errorSaving": "সংরক্ষণে ত্রুটি",
    "keyRevoked": "কী বাতিল হয়েছে",
    "errorRevoking": "বাতিল করতে ত্রুটি",
    "copiedToClipboard": "ক্লিপবোর্ডে কপি হয়েছে",
    "errorCreatingKey": "কী তৈরিতে ত্রুটি"
  },
  "categories": {
    "receiveData": "ডেটা গ্রহণ করুন",
    "mailhook": "Mailhook",
    "response": "Webhook প্রতিক্রিয়া",
    "soon": "শীঘ্রই আসছে",
    "soonDesc": "এই বিভাগের কনফিগারেশন ও স্ক্যানিং পরবর্তী পর্যায়ে নির্ধারিত হবে।"
  },
  "gateway": {
    "description": "প্যানেল যে এন্ডপয়েন্টগুলো হোস্ট করে ইনকামিং ডেটা গ্রহণের জন্য (Make.com স্টাইল)। API key দ্বারা প্রমাণীকরণ (x-make-apikey), IP সীমাবদ্ধতা এবং ডেটা কাঠামো যাচাইকরণ।",
    "btnNew": "নতুন Webhook",
    "detectedTitle": "সার্ভারে শনাক্তকৃত রিসিভার",
    "urlReveal": "Webhook URL — এখানে অনুরোধ পাঠান",
    "cols": {
      "name": "নাম",
      "auth": "প্রমাণীকরণ",
      "recibidos": "প্রাপ্ত",
      "ultima": "সর্বশেষ",
      "estado": "অবস্থা",
      "estadoActive": "সক্রিয়",
      "estadoPaused": "বিরতি"
    },
    "dialog": {
      "titleNew": "Webhook তৈরি করুন",
      "titleEdit": "Webhook সম্পাদনা করুন",
      "name": "Webhook নাম",
      "namePlaceholder": "আমার Gateway Webhook",
      "nameHint": "১ থেকে ১২৮ অক্ষরের মধ্যে হতে হবে।",
      "apiAuth": "API key প্রমাণীকরণ",
      "apiAuthHint": "x-make-apikey হেডারে API key পাঠান। এক বা একাধিক যোগ করুন; যেকোনো একটি মিললে অ্যাক্সেস দেওয়া হবে।",
      "apiKeyName": "নাম",
      "apiKeyValue": "API key মান",
      "apiKeyKeep": "(সংরক্ষিত — বর্তমানটি রাখতে খালি রাখুন)",
      "addApiKey": "API key যোগ করুন",
      "ipTitle": "IP সীমাবদ্ধতা",
      "ipHint": "কমা দিয়ে আলাদা করা IP তালিকা। CIDR নোটেশন ব্যবহার করা যাবে। খালি = কোনো যাচাই নেই।",
      "dataStructure": "ডেটা কাঠামো",
      "dataStructureHint": "আগত ডেটার যাচাইকরণ। খালি রাখলে যাচাই ছাড়াই গৃহীত হবে।",
      "dsValidate": "ডেটা কাঠামো যাচাই করুন",
      "dsStrict": "কঠোর (অনির্দিষ্ট ফিল্ড প্রত্যাখ্যান করুন)",
      "dsFieldName": "নাম",
      "dsFieldDesc": "বিবরণ",
      "dsFieldType": "ধরন",
      "dsFieldDefault": "ডিফল্ট মান",
      "dsFieldRequired": "আবশ্যিক",
      "dsFieldMultiline": "বহু-লাইন",
      "addItem": "ফিল্ড যোগ করুন",
      "getHeaders": "অনুরোধের হেডার নিন",
      "getHeadersHint": "হেডারগুলো বডিতে যোগ করা হবে।",
      "getMethod": "HTTP পদ্ধতি নিন",
      "getMethodHint": "পদ্ধতিটি (ভার্ব) বডিতে যোগ করা হবে।",
      "jsonPassthrough": "JSON পাঠ্য হিসেবে সংরক্ষণ করুন",
      "jsonPassthroughHint": "সক্রিয় থাকলে JSON payload স্ট্রিং হিসেবে সংরক্ষিত হবে।",
      "enabled": "Webhook সক্রিয়",
      "advanced": "উন্নত সেটিংস",
      "btnCancel": "বাতিল",
      "btnSave": "সংরক্ষণ"
    },
    "payloads": {
      "title": "প্রাপ্ত Payload",
      "empty": "এখনও কোনো payload পাওয়া যায়নি।",
      "btnClose": "বন্ধ করুন"
    },
    "confirm": {
      "deleteTitle": "Webhook মুছুন",
      "deleteBody": "Webhook \"{name}\" মুছে দেবেন? সংরক্ষিত payload মুছে যাবে।",
      "deleteBtn": "হ্যাঁ, মুছুন"
    },
    "toasts": {
      "created": "Webhook তৈরি হয়েছে",
      "updated": "Webhook আপডেট হয়েছে",
      "deleted": "Webhook মুছে গেছে",
      "copied": "URL কপি হয়েছে",
      "error": "সংরক্ষণে ত্রুটি"
    }
  },
  "table": {
    "gateway": {
      "columns": {
        "name": "নাম",
        "auth": "প্রমাণীকরণ",
        "recibidos": "প্রাপ্ত",
        "ultima": "সর্বশেষ",
        "estado": "অবস্থা"
      },
      "filters": {
        "searchName": "নাম অনুসন্ধান করুন…",
        "estado": "অবস্থা"
      },
      "rowActions": {
        "copy": "URL কপি করুন",
        "payloads": "পেলোড দেখুন",
        "edit": "সম্পাদনা",
        "delete": "মুছুন"
      },
      "options": {
        "statusActive": "সক্রিয়",
        "statusPaused": "বিরতিতে"
      }
    },
    "webhooks": {
      "columns": {
        "url": "URL",
        "eventos": "ইভেন্ট",
        "estado": "অবস্থা"
      },
      "filters": {
        "searchUrl": "URL খুঁজুন…",
        "estado": "অবস্থা"
      },
      "rowActions": {
        "regenerate": "সিক্রেট রোটেট করুন",
        "delete": "মুছুন"
      },
      "options": {
        "statusActive": "সক্রিয়",
        "statusPaused": "বিরতিতে",
        "statusFailing": "ব্যর্থ হচ্ছে"
      }
    },
    "apiKeys": {
      "columns": {
        "name": "নাম",
        "prefix": "উপসর্গ",
        "creada": "তৈরি হয়েছে",
        "expira": "মেয়াদ শেষ"
      },
      "filters": {
        "searchName": "নাম অনুসন্ধান করুন…"
      },
      "rowActions": {
        "revoke": "বাতিল"
      }
    },
    "discovered": {
      "columns": {
        "origen": "উৎস",
        "name": "নাম",
        "target": "গন্তব্য",
        "location": "অবস্থান",
        "estado": "অবস্থা"
      },
      "filters": {
        "searchTarget": "গন্তব্য খুঁজুন…",
        "origen": "উৎস"
      },
      "rowActions": {
        "detail": "বিস্তারিত দেখুন",
        "delete": "মুছুন"
      },
      "options": {
        "panel": "প্যানেল",
        "gitHook": "Git hook",
        "nginx": "Nginx",
        "cron": "Cron",
        "systemd": "systemd",
        "config": "কনফিগারেশন",
        "proyecto": "প্রজেক্ট"
      }
    }
  },
  "runtime": {
    "testDelivered": "পরীক্ষামূলক ডেলিভারি সফল হয়েছে।",
    "testFailed": "পরীক্ষামূলক ডেলিভারি ব্যর্থ হয়েছে।",
    "loadingDeliveries": "ডেলিভারি লোড হচ্ছে…",
    "loadDeliveriesError": "ডেলিভারি লোড করা যায়নি।",
    "noDeliveries": "এখনও কোনো ডেলিভারি নথিভুক্ত হয়নি।",
    "delivered": "ডেলিভারি হয়েছে",
    "failed": "ব্যর্থ",
    "attempts": "চেষ্টা: {count}",
    "selectEvent": "অন্তত একটি ইভেন্ট নির্বাচন করুন।"
  },
  "settingsUi": {
    "title": "Webhooks সেটিংস",
    "description": "Webhooks সারণির পৃষ্ঠা বিন্যাস ও দৃশ্যমান কার্যক্রম।",
    "gateway": "গেটওয়ে",
    "webhooks": "Webhooks",
    "signingSecret": "স্বাক্ষরের গোপন কী · এখনই কপি করুন",
    "signingSecretHint": "এটি শুধু একবার দেখানো হয়। X-Luxipanel-Signature যাচাই করতে গ্রহণকারীতে সেট করুন।",
    "recentDeliveries": "সাম্প্রতিক ডেলিভারি"
  }
} as const;

export default webhooks;
