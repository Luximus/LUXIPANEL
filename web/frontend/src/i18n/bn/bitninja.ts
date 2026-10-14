const bitninja = {
  "header": {
    "description": "সংযুক্ত সার্ভারে সমন্বিত নিরাপত্তা এজেন্ট (WAF, অ্যান্টি-DoS, ম্যালওয়্যার সনাক্তকরণ এবং IP সুনাম)।",
    "statusChecking": "পরীক্ষা করা হচ্ছে…"
  },
  "sudo": {
    "label": "sudo পাসওয়ার্ড (আপনার সেশনের passphrase)",
    "placeholder": "শুধুমাত্র যদি সার্ভার sudo-এর জন্য চায়",
    "hint": "শুধুমাত্র এই ক্রিয়ার জন্য ব্যবহার করা হয় এবং ব্রাউজারে কখনো সংরক্ষণ করা হয় না।"
  },
  "installCard": {
    "title": "BitNinja ইনস্টল করা নেই",
    "description": "এই সার্ভারে এজেন্ট ইনস্টল করতে আপনার BitNinja অ্যাকাউন্টের license key লিখুন। অফিসিয়াল ইনস্টলার (get.bitninja.io) ডাউনলোড হয়ে sudo দিয়ে চালানো হবে।",
    "licensePlaceholder": "লাইসেন্স কী (যেমন: ab12cd34-…)",
    "installButton": "BitNinja ইনস্টল করুন"
  },
  "stats": {
    "service": "সার্ভিস",
    "license": "লাইসেন্স",
    "version": "সংস্করণ"
  },
  "serviceControl": {
    "title": "সার্ভিস নিয়ন্ত্রণ",
    "start": "শুরু করুন",
    "restart": "পুনরায় চালু করুন",
    "stop": "বন্ধ করুন"
  },
  "components": {
    "title": "সুরক্ষা উপাদান",
    "checking": "পরীক্ষা করা হচ্ছে…",
    "noReported": "এজেন্ট কোনো কম্পোনেন্ট রিপোর্ট করেনি।",
    "active": "সক্রিয়",
    "inactive": "নিষ্ক্রিয়"
  },
  "updateLicense": {
    "title": "license key আপডেট করুন",
    "placeholder": "নতুন license key",
    "applyButton": "প্রয়োগ করুন"
  },
  "toasts": {
    "sudoRequired": "আপনার sudo পাসওয়ার্ড দিন এবং পুনরায় চেষ্টা করুন।",
    "sudoInvalid": "sudo পাসওয়ার্ড অবৈধ।",
    "actionFailed": "কাজটি ব্যর্থ হয়েছে। আউটপুট দেখুন।",
    "installing": "BitNinja ইনস্টল হচ্ছে… কয়েক মিনিট লাগতে পারে।",
    "installed": "BitNinja ইনস্টল হয়েছে।",
    "serviceAction": "সার্ভিস: {action} সফল।",
    "componentToggleEnabled": "{component}: সক্রিয়।",
    "componentToggleDisabled": "{component}: নিষ্ক্রিয়।",
    "licenseApplied": "লাইসেন্স কী প্রয়োগ হয়েছে।"
  },
  "errors": {
    "unknown": "অজানা ত্রুটি"
  },
  "status": {
    "notInstalled": "ইনস্টল নেই",
    "running": "সক্রিয়",
    "installedStopped": "ইনস্টল আছে (বন্ধ)",
    "serviceRunning": "চলছে",
    "serviceStopped": "বন্ধ",
    "licenseValid": "বৈধ",
    "licenseReview": "পর্যালোচনা করুন"
  },
  "validation": {
    "licenseKeyRequired": "লাইসেন্স কী দিন।",
    "newLicenseKeyRequired": "নতুন লাইসেন্স কী দিন।"
  },
  "settingsUi": {
    "settingsTitle": "BitNinja সেটিংস",
    "settingsButton": "সেটিংস",
    "settingsDescription": "সক্রিয় সার্ভারের নির্ণয়ের পছন্দ।",
    "settingsSections": "BitNinja সেটিংসের বিভাগ",
    "diagnostics": "নির্ণয়",
    "related": "সংশ্লিষ্ট",
    "logSource": "নির্বাচিত সার্ভারের BitNinja পরিষেবা থেকে লগ পড়া হয়।",
    "autoRefresh": "প্রতি ৩০ সেকেন্ডে অবস্থা হালনাগাদ করুন",
    "logLines": "লগের লাইন",
    "relatedModules": "সংশ্লিষ্ট মডিউল",
    "firewallAudit": "ফায়ারওয়াল ও নিরীক্ষা",
    "credentials": "BitNinja পরিচয়পত্র"
  },
  "logsUi": {
    "loading": "লগ লোড হচ্ছে…",
    "empty": "সাম্প্রতিক কোনো ইভেন্ট নেই।",
    "loadError": "লগ লোড করা যায়নি।",
    "logsTitle": "সাম্প্রতিক লগ",
    "logsDescription": "সক্রিয় সার্ভারের পরিষেবা ইভেন্ট।",
    "refreshLogs": "লগ হালনাগাদ করুন",
    "logsHint": "ইভেন্ট লোড করতে «লগ হালনাগাদ করুন» নির্বাচন করুন।"
  }
} as const;

export default bitninja;
