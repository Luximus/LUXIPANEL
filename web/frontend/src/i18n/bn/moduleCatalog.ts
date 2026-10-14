const moduleCatalog = {
  "users": {
    "name": "ব্যবহারকারী",
    "description": "প্যানেলের ব্যবহারকারী, রোল এবং অনুমতি ব্যবস্থাপনা।"
  },
  "mail": {
    "name": "মেইল",
    "description": "SMTP / IMAP, ডোমেইন এবং ব্যবহারকারীর মেইলবক্স।"
  },
  "monitor": {
    "name": "মনিটর",
    "description": "CPU, RAM, ডিস্ক এবং প্রসেসের লাইভ মেট্রিক্স।"
  },
  "files": {
    "name": "ফাইল",
    "description": "অন্তর্নির্মিত এডিটরসহ রিমোট ফাইল এক্সপ্লোরার।"
  },
  "firewall": {
    "name": "ফায়ারওয়াল",
    "description": "UFW নিয়ম ব্যবস্থাপনা এবং IP ব্লকিং।"
  },
  "bitninja": {
    "name": "BitNinja",
    "description": "সমন্বিত নিরাপত্তা এজেন্ট: WAF, anti-DoS, ম্যালওয়্যার শনাক্তকরণ এবং IP রেপুটেশন।"
  },
  "assistant": {
    "name": "AI এজেন্ট",
    "description": "ডায়াগনস্টিক ও অটোমেশনের জন্য AI সহকারী।"
  },
  "repository-store": {
    "name": "GitHub",
    "description": "রিপোজিটরি ক্যাটালগ এবং নির্দেশিত ইনস্টলেশন।"
  },
  "dns": {
    "name": "Nginx",
    "description": "Nginx ব্যবস্থাপনা: সাইট, রিভার্স প্রক্সি, SSL, লগ এবং স্ট্যাটাস।"
  },
  "backups": {
    "name": "ব্যাকআপ",
    "description": "এনক্রিপশন এবং একাধিক গন্তব্যসহ নির্ধারিত ব্যাকআপ।"
  },
  "cron": {
    "name": "ক্রন",
    "description": "ভিজ্যুয়াল এডিটরসহ নির্ধারিত কাজ।"
  },
  "databases": {
    "name": "ডেটাবেস",
    "description": "ডেটাবেস ম্যানেজার (MySQL/MariaDB এবং PostgreSQL): স্কিমা ব্রাউজ করুন এবং SQL কনসোল।"
  },
  "obsidian": {
    "name": "Obsidian",
    "description": "আপনার সার্ভারে Obsidian নোট ভল্ট: মার্কডাউন এডিটর, উইকিলিঙ্ক এবং সহকারীর AI এজেন্ট দ্বারা পরিচালিত নোট।"
  },
  "cloudflare": {
    "name": "Cloudflare",
    "description": "সার্ভারের জন্য Cloudflare ব্যবস্থাপনা: DNS, ক্যাশ, SSL/TLS, ডেভেলপমেন্ট মোড এবং IP অ্যাক্সেস নিয়ম।"
  },
  "server-alerts": {
    "name": "নোটিফিকেশন",
    "description": "প্যানেল মালিকের জন্য সার্ভার নোটিফিকেশন: সতর্কতা পছন্দ, তাৎক্ষণিক বার্তা, নির্ধারিত/পুনরাবৃত্ত বার্তা এবং মেট্রিক-ভিত্তিক নিয়ম (CPU/RAM/ডিস্ক/লোড/সার্ভিস ডাউন), LP-এর মাধ্যমে তার ডিভাইসে পৌঁছানো হয়।"
  },
  "expo": {
    "name": "Expo",
    "description": "Expo/React Native অ্যাপ পরিচালনা করুন: EAS বিল্ড, স্টোরে জমা, OTA আপডেট, dev-client এর QR এবং কোটা, ক্লায়েন্টের একটি অ্যাক্সেস টোকেন দিয়ে।"
  },
  "webhooks": {
    "name": "ওয়েবহুক",
    "description": "প্যানেল ইভেন্টের HTTP নোটিফিকেশন।"
  },
  "openclaw": {
    "name": "OpenClaw",
    "description": "মডেল সিলেক্টরসহ OpenClaw AI-তে সংযোগ।"
  },
  "hosting": {
    "name": "হোস্টিং",
    "description": "সাইট, vhost এবং সহায়তাকৃত ডিপ্লয়মেন্ট।"
  },
  "terminal": {
    "name": "টার্মিনাল",
    "description": "প্যানেলের যেকোনো ভিউ থেকে অ্যাক্সেসযোগ্য ভাসমান টার্মিনাল। ভাসমান বোতামটি চালু বা বন্ধ করুন।"
  },
  "module-dev": {
    "name": "আমার মডিউল",
    "description": "আপনার মার্কেটপ্লেস মডিউলের লাইফসাইকেল: পর্যালোচনার অবস্থা, জমা, টেস্ট এবং প্রাইভেট প্রিভিউ।"
  },
  "filesystem-mcp": {
    "name": "Filesystem MCP",
    "description": "ফাইলসিস্টেম অপারেশনের জন্য MCP।"
  },
  "github-mcp": {
    "name": "GitHub MCP",
    "description": "GitHub API-এর বিরুদ্ধে অপারেশনের জন্য MCP।"
  },
  "google-drive": {
    "name": "Google Drive",
    "description": "সহকারীর চ্যাট থেকে আপনার Google Drive-এর ডকুমেন্ট খুঁজুন এবং সংযুক্ত করুন।"
  },
  "onedrive": {
    "name": "OneDrive",
    "description": "চ্যাট থেকে Microsoft OneDrive / SharePoint-এর ফাইল অ্যাক্সেস করুন।"
  },
  "dropbox": {
    "name": "Dropbox",
    "description": "চ্যাট থেকে Dropbox-এর ফাইল খুঁজুন এবং সংযুক্ত করুন।"
  },
  "notion": {
    "name": "Notion",
    "description": "চ্যাট থেকে Notion-এর পেজ এবং ডেটাবেস দেখুন।"
  }
} as const;

export default moduleCatalog;
