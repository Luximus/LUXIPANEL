const openclaw = {
  "pageTitle": "OpenClaw",
  "header": {
    "subtitle": "প্যানেল সংযুক্ত করুন",
    "subtitleSuffix": "এর মডেল ও সরঞ্জাম ব্যবহার করতে।"
  },
  "statusCard": {
    "title": "সংযোগের অবস্থা",
    "descKeySet": "API key কনফিগার করা হয়েছে। যাচাই করতে \"সংযোগ পরীক্ষা করুন\" টিপুন।",
    "descNoKey": "এখনো কোনো API key কনফিগার করা হয়নি।",
    "btnTest": "সংযোগ পরীক্ষা করুন"
  },
  "form": {
    "sectionTitle": "শংসাপত্র ও endpoint",
    "sectionDesc": "API key প্যানেলের ডেটাবেজে এনক্রিপ্ট করে সংরক্ষিত হয়।",
    "labelEndpoint": "Endpoint",
    "placeholderEndpoint": "https://openclaw.ai",
    "hintEndpoint": "API-এর বেস URL। ডিফল্ট",
    "labelApiKey": "API কী",
    "placeholderApiKeySet": "কনফিগার করা হয়েছে · {preview}",
    "placeholderApiKeyUnset": "sk-...",
    "ariaToggleKey": "দেখান বা লুকান",
    "btnClearKey": "মুছুন",
    "hintApiKey": "বর্তমান API key রাখতে ফাঁকা রাখুন।",
    "labelDefaultModel": "ডিফল্ট মডেল",
    "placeholderDefaultModel": "claw-default",
    "hintDefaultModel": "যে মডেলের পরিচয়কারী নির্দিষ্ট না করা অভ্যন্তরীণ কলগুলো ব্যবহার করবে।",
    "btnSave": "পরিবর্তন সংরক্ষণ করুন"
  },
  "help": {
    "title": "আমি কীভাবে আমার API key পাব?",
    "step1": "এখানে লগইন করুন",
    "step2": "আপনার অ্যাকাউন্টের সেটিংস খুলুন এবং একটি নতুন API key তৈরি করুন।",
    "step3": "উপরে পেস্ট করুন এবং সেভ করুন — প্যানেল এটি আর স্পষ্টভাবে দেখাবে না।"
  }
} as const;

export default openclaw;
