const firewall = {
  "pageTitle": "Firewall",
  "installWarning": {
    "title": "Firewall উপাদান সনাক্ত হয়নি",
    "description": "ডিফল্ট কনফিগারেশন সহ প্যাকেজ ম্যানেজার (apt/dnf/apk/...) চালানো হবে এবং শেষে সার্ভিস সক্ষম করা হবে।",
    "btnInstall": "এখনই ইনস্টল করুন"
  },
  "statusCard": {
    "label": "Firewall অবস্থা (UFW)",
    "verifying": "যাচাই করা হচ্ছে...",
    "btnDisable": "নিষ্ক্রিয় করুন",
    "btnEnable": "সক্রিয় করুন"
  },
  "securityAudit": {
    "title": "নিরাপত্তা অডিট (প্রিমিয়াম)",
    "btnStartAudit": "বিশ্লেষণ শুরু করুন",
    "scannerChecking": "পরীক্ষা করা হচ্ছে…",
    "btnInstallScanner": "ইনস্টল করুন",
    "scanProgress": "স্ক্যানের অগ্রগতি",
    "scanAi": "AI বিশ্লেষণ: ০%",
    "noReports": "কোনো সম্পন্ন অডিট নেই। শুরু করতে নতুন একটি শুরু করুন।"
  },
  "ufwRules": {
    "title": "UFW নিয়মাবলী",
    "btnNewRule": "নতুন নিয়ম",
    "loading": "নিয়মাবলী লোড হচ্ছে...",
    "btnAllowCloudflare": "Cloudflare অনুমোদন করুন",
    "searchLabel": "নিয়ম খুঁজুন",
    "searchPlaceholder": "পোর্ট, IP বা মন্তব্য খুঁজুন…"
  },
  "fail2ban": {
    "btnBanIp": "IP নিষিদ্ধ করুন",
    "loading": "jail লোড হচ্ছে..."
  },
  "ruleDialog": {
    "title": "নতুন UFW নিয়ম",
    "labelAction": "ক্রিয়া",
    "optionAllow": "অনুমতি দিন",
    "optionDeny": "অস্বীকার করুন",
    "optionReject": "প্রত্যাখ্যান করুন",
    "labelProtocol": "প্রোটোকল",
    "optionAny": "যেকোনো",
    "labelPort": "পোর্ট",
    "placeholderPort": "25 অথবা 8080:8090",
    "labelFromIp": "উৎস IP",
    "placeholderFromIp": "any অথবা 192.168.0.0/24",
    "labelComment": "মন্তব্য (ঐচ্ছিক)",
    "placeholderComment": "আগত SMTP",
    "btnCancel": "বাতিল করুন",
    "btnAdd": "নিয়ম যোগ করুন"
  },
  "banDialog": {
    "title": "ম্যানুয়ালি IP নিষিদ্ধ করুন",
    "labelIp": "IP ঠিকানা",
    "placeholderIp": "192.168.1.100",
    "labelJail": "Fail2ban জেল",
    "btnCancel": "বাতিল করুন",
    "btnBan": "নিষিদ্ধ করুন"
  },
  "auditReportDialog": {
    "title": "নিরাপত্তা অডিট রিপোর্ট",
    "btnClose": "বন্ধ করুন"
  },
  "aiAssistant": {
    "btnSuggestRules": "নিয়ম প্রস্তাব (AI)",
    "btnSuggestBans": "নিষেধাজ্ঞা প্রস্তাব (AI)",
    "btnAnalyze": "AI বিশ্লেষণ",
    "promptUfw": "সংযুক্ত সার্ভারের UFW ফায়ারওয়াল বিশ্লেষণ করুন: এর অবস্থা ও বর্তমান নিয়মগুলো পর্যালোচনা করুন (firewall.ufw_status টুল ব্যবহার করুন) এবং ব্যবহৃত পরিষেবাগুলো না ভেঙে নিরাপত্তা উন্নত করতে স্মার্ট UFW নিয়ম প্রস্তাব করুন। প্রতিটি প্রস্তাবিত নিয়মের কারণ ব্যাখ্যা করুন এবং প্রয়োগের জন্য সঠিক `ufw` কমান্ড অন্তর্ভুক্ত করুন।",
    "promptFail2ban": "সংযুক্ত সার্ভারে Fail2ban বিশ্লেষণ করুন: কনফিগার করা jail ও নিষিদ্ধ IPগুলো পর্যালোচনা করুন (firewall.fail2ban_status টুল ব্যবহার করুন) এবং ব্রুট-ফোর্স আক্রমণ থেকে রক্ষা করতে নিষেধাজ্ঞা ও কনফিগারেশন উন্নতির প্রস্তাব দিন। jail, IP/পরিসীমা ও কারণ এবং প্রয়োগের কমান্ড উল্লেখ করুন।",
    "promptAnalyze": "সংযুক্ত সার্ভারের ফায়ারওয়ালের একটি সাধারণ নিরাপত্তা বিশ্লেষণ চালান। UFW ও Fail2ban-এর অবস্থা পর্যালোচনা করুন (firewall.ufw_status ও firewall.fail2ban_status টুল ব্যবহার করুন), ঝুঁকি, উন্মুক্ত পোর্ট ও দুর্বল কনফিগারেশন চিহ্নিত করুন এবং প্রয়োগের কমান্ডসহ অগ্রাধিকারভিত্তিক সুপারিশ প্রদান করুন।",
    "analyzeRule": "AI দিয়ে বিশ্লেষণ",
    "promptRule": "সংযুক্ত সার্ভারের এই বিদ্যমান UFW নিয়মটি বিশ্লেষণ করুন। এটি কোন ট্রাফিক অনুমতি দেয় বা ব্লক করে তা ব্যাখ্যা করুন, ঝুঁকি মূল্যায়ন করুন এবং এটি রাখতে, সামঞ্জস্য করতে না প্রতিস্থাপন করতে হবে কিনা তা সুপারিশ করুন। পরিবর্তন প্রস্তাব করলে সঠিক কমান্ড অন্তর্ভুক্ত করুন।\n\nনিয়ম #{number}\nক্রিয়া: {action}\nগন্তব্য/পোর্ট: {to}\nউৎস: {from}\nপ্রোটোকল: {proto}\nমন্তব্য: {comment}"
  },
  "labels": {
    "active": "সক্রিয়",
    "inactive": "নিষ্ক্রিয়",
    "bannedCount": "{count}টি নিষিদ্ধ",
    "moreIps": "+{n} আরও",
    "installingText": "UFW ও Fail2ban ইনস্টল হচ্ছে… কয়েক মিনিট সময় লাগতে পারে।",
    "installSuccessText": "ফায়ারওয়াল সফলভাবে ইনস্টল হয়েছে।",
    "cfEdgeBlockQuestion": "{ip}-কে Cloudflare এজেও ব্লক করবেন?",
    "findingsCount": "{n}টি ফলাফল পাওয়া গেছে",
    "completedAt": "{time}-এ সম্পন্ন",
    "scanAiProgress": "AI বিশ্লেষণ: {pct}%",
    "overallRisk": "সামগ্রিক ঝুঁকি",
    "unknown": "অজানা",
    "keyThreats": "প্রধান হুমকি",
    "recommendations": "সুপারিশ",
    "findingsTitle": "ফলাফল ({n})",
    "moreFindingsCount": "+{n} আরও ফলাফল",
    "from": "থেকে",
    "any": "যেকোনো",
    "scanBitNinjaProgress": "BitNinja: {pct}%",
    "scanLynisProgress": "Lynis: {pct}%",
    "scanRkhunterProgress": "Rkhunter: {pct}%",
    "scanChkrootkitProgress": "Chkrootkit: {pct}%"
  },
  "empty": {
    "noRules": "কোনো নিয়ম নেই",
    "noJails": "কোনো সক্রিয় jail নেই"
  },
  "actions": {
    "unban": "আনব্যান করুন",
    "blockInCloudflare": "Cloudflare-এ ব্লক করুন",
    "dismiss": "বাতিল করুন"
  },
  "confirm": {
    "deleteRuleMsg": "নিয়ম #{number} মুছবেন?",
    "deleteRuleTitle": "নিয়ম মুছুন",
    "disableFwMsg": "ফায়ারওয়াল নিষ্ক্রিয় করবেন? সার্ভার নেটওয়ার্ক সুরক্ষা ছাড়া থাকবে।",
    "disableFwTitle": "ফায়ারওয়াল নিষ্ক্রিয় করুন",
    "disableFwBtn": "হ্যাঁ, নিষ্ক্রিয় করুন",
    "cfAllowMsg": "Cloudflare-এর অফিশিয়াল রেঞ্জ থেকে 80/443 অনুমতি দিতে UFW নিয়ম যুক্ত হবে। চালিয়ে যাবেন?",
    "cfAllowTitle": "Cloudflare IP অনুমতি দিন",
    "cfAllowBtn": "চালিয়ে যান"
  },
  "toasts": {
    "ruleDeleted": "নিয়ম মুছে ফেলা হয়েছে",
    "errorDelete": "মুছতে ত্রুটি",
    "ipUnbanned": "{ip} আনব্যান করা হয়েছে",
    "errorUnban": "আনব্যান করতে ত্রুটি",
    "fwEnabled": "ফায়ারওয়াল সক্রিয়",
    "errorEnable": "সক্রিয় করতে ত্রুটি",
    "fwDisabled": "ফায়ারওয়াল নিষ্ক্রিয়",
    "errorDisable": "নিষ্ক্রিয় করতে ত্রুটি",
    "fwInstalled": "ফায়ারওয়াল ইনস্টল হয়েছে",
    "ruleAdded": "নিয়ম যোগ হয়েছে",
    "ipBanned": "{jail}-এ {ip} ব্যান হয়েছে",
    "errorBan": "ব্যান করতে ত্রুটি",
    "cfRulesApplied": "Cloudflare নিয়ম প্রয়োগ হয়েছে ({applied})",
    "errorCfRules": "Cloudflare নিয়ম প্রয়োগে ত্রুটি",
    "errorStartAudit": "অডিট শুরু করতে ত্রুটি",
    "auditCompleted": "অডিট সম্পন্ন",
    "auditFailed": "অডিট ব্যর্থ",
    "errorLoadReport": "রিপোর্ট লোড করতে ত্রুটি",
    "reportOf": "{date}-এর রিপোর্ট"
  },
  "errors": {
    "addRule": "নিয়ম যোগ করতে ত্রুটি"
  },
  "runtime": {
    "statusError": "অবস্থা পরীক্ষা করা যায়নি",
    "rulesLoadError": "নিয়ম লোড করা যায়নি।",
    "noMatchingRules": "কোনো নিয়ম ফিল্টারের সঙ্গে মেলেনি।",
    "loggingSaved": "লগিং স্তর সংরক্ষিত হয়েছে।",
    "loggingSaveError": "লগিং স্তর সংরক্ষণ করা যায়নি।"
  },
  "settingsUi": {
    "rulesView": "নিয়মের দৃশ্য",
    "ufwLog": "UFW লগ",
    "related": "সংশ্লিষ্ট",
    "title": "ফায়ারওয়াল সেটিংস",
    "description": "ব্যক্তিগত ফিল্টার ও সক্রিয় সার্ভারের UFW লগ।",
    "sectionsLabel": "ফায়ারওয়াল সেটিংসের বিভাগ",
    "showActions": "কার্যক্রম দেখান",
    "all": "সব",
    "limit": "সীমিত করুন",
    "serverSettingHint": "এই সেটিং সক্রিয় সার্ভারের কনফিগারেশন বদলায়।",
    "logLevel": "লগিং স্তর",
    "off": "নিষ্ক্রিয়",
    "low": "নিম্ন",
    "medium": "মাঝারি",
    "high": "উচ্চ",
    "full": "সম্পূর্ণ",
    "saveLevel": "স্তর সংরক্ষণ করুন",
    "relatedModules": "সংশ্লিষ্ট মডিউল"
  }
} as const;

export default firewall;
