const cloudflare = {
  "options": {
    "essentiallyOff": "প্রায় বন্ধ",
    "low": "নিম্ন",
    "medium": "মাঝারি",
    "high": "উচ্চ"
  },
  "pageTitle": "Cloudflare",
  "header": {
    "heading": "Cloudflare",
    "subheading": "এই সার্ভারের Cloudflare জোনগুলির DNS, ক্যাশ, SSL/TLS এবং নিরাপত্তা পরিচালনা করুন।"
  },
  "config": {
    "title": "Cloudflare সংযোগ",
    "tokenLabel": "API টোকেন",
    "tokenPlaceholder": "Cloudflare API Token",
    "tokenHint": "dash.cloudflare.com → My Profile → API Tokens-এ গিয়ে জোন অনুমতিসহ একটি টোকেন তৈরি করুন: DNS, Cache Purge, Zone Settings এবং Firewall Services।",
    "save": "সংরক্ষণ করুন",
    "test": "সংযোগ পরীক্ষা করুন",
    "clear": "টোকেন সরান",
    "tokenSet": "টোকেন কনফিগার করা হয়েছে",
    "tokenMissing": "শুরু করতে একটি API Token কনফিগার করুন",
    "saved": "টোকেন সংরক্ষিত হয়েছে",
    "cleared": "টোকেন মুছে ফেলা হয়েছে",
    "confirmClear": "Cloudflare টোকেন সরিয়ে দেবেন?",
    "confirmClearBtn": "সরান"
  },
  "zones": {
    "title": "জোন",
    "select": "একটি জোন নির্বাচন করুন",
    "empty": "এই টোকেন দিয়ে কোনো জোন দেখা যাচ্ছে না।",
    "status": "অবস্থা",
    "plan": "প্ল্যান",
    "nameServers": "Name servers",
    "domainNotFound": "ডোমেইন {domain} টোকেনের কোনো জোনে নেই"
  },
  "runtime": {
    "active": "সক্রিয়",
    "pending": "অপেক্ষমাণ",
    "initializing": "শুরু হচ্ছে",
    "moved": "স্থানান্তরিত",
    "paused": "সাময়িক বিরতিতে",
    "pausedHint": "জোনটি সাময়িক বিরতিতে আছে: DNS বদলানোর আগে সেটিংস পরীক্ষা করুন।",
    "inactiveHint": "জোন {status}: নিবন্ধকের কাছে নেমসার্ভার পরীক্ষা করুন।",
    "activeHint": "সক্রিয় জোন · {count}টি নেমসার্ভার কনফিগার করা আছে।"
  },
  "tabs": {
    "dns": "DNS",
    "cache": "ক্যাশ",
    "security": "SSL / নিরাপত্তা",
    "access": "অ্যাক্সেস নিয়ম",
    "config": "কনফিগারেশন"
  },
  "dns": {
    "title": "DNS রেকর্ড",
    "add": "রেকর্ড যোগ করুন",
    "type": "ধরন",
    "name": "নাম",
    "content": "কনটেন্ট",
    "ttl": "TTL",
    "proxied": "প্রক্সি",
    "pointsToServer": "এই সার্ভারের দিকে নির্দেশ করে",
    "edit": "সম্পাদনা করুন",
    "delete": "মুছুন",
    "confirmDelete": "{name} রেকর্ডটি মুছবেন?",
    "saved": "রেকর্ড সংরক্ষিত হয়েছে",
    "deleted": "রেকর্ড মুছে ফেলা হয়েছে",
    "useServerIp": "সার্ভারের IP ব্যবহার করুন",
    "priority": "অগ্রাধিকার",
    "confirmDeleteTitle": "রেকর্ড মুছুন",
    "typeA": "A",
    "typeAAAA": "AAAA",
    "typeCNAME": "CNAME",
    "typeTXT": "TXT",
    "typeMX": "MX",
    "typeNS": "NS",
    "ttlAuto": "স্বয়ংক্রিয়",
    "ttl60": "60",
    "ttl300": "300",
    "ttl1800": "1800",
    "ttl3600": "3600",
    "ttl86400": "86400"
  },
  "cache": {
    "title": "ক্যাশ",
    "purgeAll": "সবকিছু পার্জ করুন",
    "purgeAllHint": "Cloudflare-এ জোনের সমস্ত ক্যাশ করা কনটেন্ট মুছে ফেলে।",
    "confirmPurgeAll": "জোনের সম্পূর্ণ ক্যাশ পার্জ করবেন?",
    "purgeUrls": "URL পার্জ করুন",
    "purgeUrlsPlaceholder": "https://ejemplo.com/estilos.css (প্রতি লাইনে একটি URL)",
    "purged": "ক্যাশ পার্জ করা হয়েছে",
    "devMode": "ডেভেলপমেন্ট মোড",
    "devModeHint": "সাময়িকভাবে Cloudflare-এর ক্যাশ নিষ্ক্রিয় করে (৩ ঘণ্টা পরে স্বয়ংক্রিয়ভাবে বন্ধ হয়ে যায়)।",
    "confirmPurgeTitle": "ক্যাশ পরিষ্কার করুন",
    "confirmPurgeBtn": "পরিষ্কার করুন"
  },
  "security": {
    "title": "SSL / নিরাপত্তা",
    "sslMode": "SSL/TLS মোড",
    "alwaysHttps": "সর্বদা HTTPS",
    "securityLevel": "নিরাপত্তার স্তর",
    "underAttack": "আন্ডার অ্যাটাক মোড",
    "updated": "সেটিং আপডেট হয়েছে",
    "sslOff": "বন্ধ",
    "sslFlexible": "নমনীয়",
    "sslFull": "সম্পূর্ণ",
    "sslFullStrict": "সম্পূর্ণ (কঠোর)"
  },
  "access": {
    "title": "IP অ্যাক্সেস নিয়ম",
    "add": "নিয়ম যোগ করুন",
    "mode": "অ্যাকশন",
    "block": "ব্লক করুন",
    "allow": "অনুমতি দিন",
    "challenge": "Challenge",
    "ip": "IP / রেঞ্জ",
    "notes": "নোট",
    "empty": "এই জোনে কোনো অ্যাক্সেস নিয়ম নেই।",
    "confirmDelete": "{ip}-এর জন্য নিয়মটি মুছবেন?",
    "created": "নিয়ম তৈরি হয়েছে",
    "deleted": "নিয়ম মুছে ফেলা হয়েছে",
    "ipHeader": "IP",
    "confirmDeleteTitle": "নিয়ম মুছুন"
  },
  "common": {
    "loading": "লোড হচ্ছে...",
    "error": "ত্রুটি",
    "save": "সংরক্ষণ করুন",
    "cancel": "বাতিল করুন",
    "delete": "মুছুন",
    "refresh": "রিফ্রেশ করুন",
    "serverIp": "সার্ভারের IP",
    "noToken": "কনফিগারেশন ট্যাবে Cloudflare API Token কনফিগার করুন।"
  },
  "settingsUi": {
    "title": "Cloudflare সেটিংস",
    "description": "Cloudflare মডিউলের সারণির পছন্দসমূহ।",
    "access": "অ্যাক্সেস",
    "credentialsConnections": "শংসাপত্র ও সংযোগ",
    "cloudflareToken": "Cloudflare টোকেন",
    "serverFirewall": "সার্ভার ফায়ারওয়াল",
    "dnsWebhooks": "Webhooks-এ DNS ইভেন্ট"
  }
} as const;

export default cloudflare;
