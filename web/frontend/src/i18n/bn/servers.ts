const servers = {
  "pageTitle": "সার্ভার",
  "description": "এই প্যানেল যেসব SSH সার্ভারে সংযোগ করতে পারে, সেগুলোর স্থানীয় তালিকা। গোপন তথ্য (কী ও পাসওয়ার্ড) এনক্রিপ্ট করে রাখা হয় এবং এখানে কখনো দেখানো হয় না।",
  "btnNew": "সার্ভার যোগ করুন",
  "table": {
    "name": "নাম",
    "host": "হোস্ট",
    "username": "ব্যবহারকারী",
    "authType": "প্রমাণীকরণ",
    "status": "অবস্থা"
  },
  "authTypes": {
    "key": "SSH কী",
    "password": "পাসওয়ার্ড"
  },
  "status": {
    "approved": "অনুমোদিত",
    "pending": "অপেক্ষমাণ",
    "untested": "পরীক্ষা করা হয়নি"
  },
  "common": {
    "test": "পরীক্ষা করুন",
    "edit": "সম্পাদনা করুন",
    "delete": "মুছুন",
    "cancel": "বাতিল করুন",
    "save": "সংরক্ষণ করুন",
    "close": "বন্ধ করুন",
    "error": "ত্রুটি",
    "yes": "হ্যাঁ",
    "no": "না"
  },
  "dialog": {
    "titleNew": "সার্ভার যোগ করুন",
    "titleEdit": "সার্ভার সম্পাদনা করুন",
    "name": "নাম",
    "namePlaceholder": "আমার প্রোডাকশন সার্ভার",
    "host": "হোস্ট বা IP",
    "hostPlaceholder": "203.0.113.10 অথবা server.example.com",
    "port": "পোর্ট",
    "username": "ব্যবহারকারী",
    "usernamePlaceholder": "root",
    "authType": "প্রমাণীকরণের ধরন",
    "secretKey": "ব্যক্তিগত SSH কী",
    "secretKeyPlaceholder": "-----BEGIN OPENSSH PRIVATE KEY-----",
    "passphrase": "কীর পাসফ্রেজ (ঐচ্ছিক)",
    "passphrasePlaceholder": "কী আনলক করার পাসফ্রেজ",
    "secretPassword": "পাসওয়ার্ড",
    "secretPasswordPlaceholder": "SSH ব্যবহারকারীর পাসওয়ার্ড",
    "secretKeepHint": "বর্তমান গোপন তথ্য রাখতে ফাঁকা রাখুন।",
    "btnCancel": "বাতিল করুন",
    "btnSave": "সংরক্ষণ করুন"
  },
  "fingerprint": {
    "title": "হোস্টের ফিঙ্গারপ্রিন্ট অনুমোদন করুন",
    "intro": "এই সার্ভারে এটি প্রথম সংযোগ। অনুমোদনের আগে যাচাই করুন, হোস্ট কীর ফিঙ্গারপ্রিন্ট প্রত্যাশিতটির সঙ্গে মেলে কি না।",
    "approve": "ফিঙ্গারপ্রিন্ট অনুমোদন করুন",
    "approving": "অনুমোদন করা হচ্ছে…",
    "approved": "ফিঙ্গারপ্রিন্ট অনুমোদিত",
    "approveError": "ফিঙ্গারপ্রিন্ট অনুমোদন করা যায়নি"
  },
  "toasts": {
    "created": "সার্ভার যোগ করা হয়েছে",
    "updated": "সার্ভার আপডেট করা হয়েছে",
    "deleted": "সার্ভার মুছে ফেলা হয়েছে",
    "testOk": "সংযোগ সফল",
    "testFailed": "সংযোগ ব্যর্থ"
  },
  "validation": {
    "nameRequired": "একটি নাম লিখুন",
    "hostRequired": "হোস্ট লিখুন",
    "usernameRequired": "ব্যবহারকারী লিখুন",
    "secretRequired": "প্রমাণীকরণের গোপন তথ্য লিখুন"
  },
  "confirmDelete": "সার্ভার {name} মুছবেন? এটি ফিরিয়ে আনা যাবে না।",
  "confirmDeleteTitle": "সার্ভার মুছুন",
  "testing": "সংযোগ পরীক্ষা করা হচ্ছে…"
} as const;

export default servers;
