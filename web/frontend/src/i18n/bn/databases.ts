const databases = {
  "pageTitle": "ডেটাবেস",
  "header": {
    "heading": "ডেটাবেস ম্যানেজার",
    "subheading": "সার্ভারের ডেটাবেস অন্বেষণ ও কুয়েরি করুন (MySQL/MariaDB, PostgreSQL)।"
  },
  "databases": {
    "title": "ডেটাবেস"
  },
  "tables": {
    "title": "টেবিল"
  },
  "tabs": {
    "rows": "সারি",
    "structure": "কাঠামো",
    "console": "SQL কনসোল"
  },
  "rows": {
    "prev": "পূর্ববর্তী",
    "next": "পরবর্তী"
  },
  "console": {
    "placeholder": "SELECT * FROM ...",
    "run": "চালান",
    "allowWrite": "লেখার অনুমতি দিন",
    "hint": "Ctrl/⌘ + Enter চালানোর জন্য। লেখা/DDL স্টেটমেন্টের জন্য \"লেখার অনুমতি দিন\" চিহ্নিত করতে হবে।"
  },
  "common": {
    "selectEngine": "একটি ইঞ্জিন নির্বাচন করুন।",
    "selectDb": "একটি ডেটাবেস নির্বাচন করুন।",
    "selectTable": "একটি টেবিল নির্বাচন করুন।"
  },
  "actions": {
    "export": "রপ্তানি",
    "addRecord": "রেকর্ড যোগ করুন",
    "cancel": "বাতিল",
    "save": "সংরক্ষণ",
    "edit": "সম্পাদনা",
    "downloadSql": "SQL ডাউনলোড",
    "install": "{label} ইন্সটল করুন"
  },
  "titles": {
    "record": "রেকর্ড",
    "exportDb": "ডেটাবেস রপ্তানি",
    "editRecord": "রেকর্ড সম্পাদনা · {table}",
    "newRecord": "নতুন রেকর্ড · {table}"
  },
  "labels": {
    "tablesLabel": "টেবিল",
    "allTables": "সব",
    "includeData": "ডেটাসহ",
    "active": "সক্রিয়",
    "actions": "ক্রিয়া",
    "colName": "কলাম",
    "colType": "ধরন",
    "colNullable": "নাল",
    "colKey": "কী",
    "colDefault": "ডিফল্ট",
    "yes": "হ্যাঁ",
    "no": "না",
    "primaryKey": "প্রাথমিক কী",
    "tbl": "টেবিল"
  },
  "install": {
    "title": "ডেটাবেস ইঞ্জিন ইন্সটল করুন",
    "description": "ডেটাবেস পরিচালনা শুরু করতে সংযুক্ত সার্ভারে MariaDB বা PostgreSQL ইন্সটল করুন।",
    "mariadb": "MariaDB",
    "postgresql": "PostgreSQL"
  },
  "empty": {
    "noResults": "কোনো ফলাফল নেই।",
    "noEngines": "সার্ভারে কোনো সক্রিয় ডেটাবেস ইঞ্জিন নেই। শুরু করতে একটি ইন্সটল করুন।",
    "noDatabases": "কোনো ডেটাবেস নেই।",
    "noTables": "কোনো টেবিল নেই।"
  },
  "errors": {
    "detectEngines": "ইঞ্জিন শনাক্তে ত্রুটি",
    "loadRows": "সারি লোড করতে ত্রুটি",
    "saveRecord": "রেকর্ড সংরক্ষণ করা যায়নি",
    "deleteRecord": "রেকর্ড মুছতে ব্যর্থ হয়েছে",
    "networkError": "নেটওয়ার্ক ত্রুটি",
    "runQuery": "কোয়েরি চালাতে ত্রুটি হয়েছে"
  },
  "loading": {
    "generic": "লোড হচ্ছে…",
    "rows": "সারি লোড হচ্ছে…",
    "structure": "কাঠামো লোড হচ্ছে…",
    "tablesExport": "টেবিল লোড হচ্ছে…",
    "running": "চলছে…"
  },
  "toasts": {
    "engineInstalled": "{label} ইনস্টল হয়েছে",
    "noColumnsMetadata": "এই টেবিলের কলামের কোনো মেটাডেটা নেই",
    "recordUpdated": "রেকর্ড আপডেট হয়েছে",
    "recordCreated": "রেকর্ড তৈরি হয়েছে",
    "recordDeleted": "রেকর্ড মুছে হয়েছে",
    "noTableSelect": "অন্তত একটি টেবিল নির্বাচন করুন",
    "exportDownloaded": "এক্সপোর্ট ডাউনলোড হয়েছে",
    "selectEngineFirst": "প্রথমে একটি ইঞ্জিন নির্বাচন করুন",
    "statementExecuted": "স্টেটমেন্ট কার্যকর হয়েছে"
  },
  "confirm": {
    "deleteRecord": "এই রেকর্ড মুছে ফেলবেন? এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।",
    "deleteTitle": "রেকর্ড মুছুন",
    "deleteConfirmText": "মুছুন"
  },
  "info": {
    "installing": "{label} ইনস্টল হচ্ছে… কয়েক মিনিট সময় লাগতে পারে।",
    "installed": "{label} ইনস্টল হয়েছে। ইঞ্জিন শনাক্ত করা হচ্ছে…",
    "pager": "{from}–{to} সারি ({limit} প্রতি পৃষ্ঠা)",
    "statementExecuted": "স্টেটমেন্ট কার্যকর হয়েছে",
    "rowCount": "{count} সারি",
    "truncated": "· ফলাফল {count} সারিতে সীমাবদ্ধ"
  },
  "runtime": {
    "createPromptWithPrefix": "নামটি {prefix} দিয়ে শুরু হতে হবে এবং আপনার কোটা মানতে হবে।",
    "createPrompt": "সক্রিয় সার্ভারে নতুন ডেটাবেসের নাম।",
    "invalidPrefix": "নামটি {prefix} দিয়ে শুরু হতে হবে",
    "createError": "ডেটাবেস তৈরি করা যায়নি।",
    "created": "ডেটাবেস তৈরি হয়েছে।"
  },
  "settings": {
    "title": "ডাটাবেস সেটিংস",
    "description": "ডাটাবেস মডিউলের পছন্দসমূহ।",
    "table": "সারণি",
    "pagination": "পৃষ্ঠা বিন্যাস",
    "rowsPerPage": "স্ট্রাকচার ও কনসোলের ফলাফলে প্রতি পৃষ্ঠায় সারির সংখ্যা।",
    "serverPagination": "রেকর্ড সারণিতে সার্ভারভিত্তিক পৃষ্ঠা বিন্যাস ব্যবহৃত হয়; এখানে এটি বদলানো যায় না।",
    "relatedModules": "সংশ্লিষ্ট মডিউল",
    "hostingQuotas": "হোস্টিং ও কোটা",
    "databaseBackups": "ডাটাবেস ব্যাকআপ",
    "sqlFiles": "SQL ফাইল",
    "allowWriteDefault": "কনসোল খোলার সময় ডিফল্টভাবে লেখার অনুমতি দিন",
    "allowWriteHelp": "মডিউল লোড হলে এটি প্রযোজ্য হয়; যেকোনো সময় কনসোলে বদলাতে পারেন।",
    "createDatabase": "ডাটাবেস তৈরি করুন",
    "create": "তৈরি করুন"
  }
} as const;

export default databases;
