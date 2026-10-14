const backups = {
  "pageTitle": "ব্যাকআপ",
  "settings": {
    "title": "ব্যাকআপ সেটিংস",
    "description": "সংযুক্ত সার্ভারের গন্তব্য ও পছন্দ।",
    "sections": "সেটিংসের বিভাগ",
    "localHelp": "এই সার্ভারের স্থানীয় ব্যাকআপগুলো এখানে রাখা হয়।",
    "changeDirWarning": "ফোল্ডার বদলালে নিশ্চিত করার পরে পুরোনো স্থানীয় ব্যাকআপ মুছে যাবে।",
    "retentionHelp": "ম্যানুয়াল ব্যাকআপ ও নতুন সময়সূচির জন্য। পুরোনো সময়সূচির নিজস্ব সীমা থাকবে।",
    "save": "পরিবর্তন সংরক্ষণ করুন",
    "lastSuccess": "সর্বশেষ সফল ব্যাকআপ",
    "localCopies": "স্থানীয় ব্যাকআপ",
    "activeSchedules": "সক্রিয় সময়সূচি",
    "advancedCron": "নিজস্ব Cron অভিব্যক্তি",
    "loading": "সেটিংস লোড হচ্ছে…",
    "loadError": "এই সার্ভারের সেটিংস লোড করা যায়নি।",
    "pending": "সংরক্ষণ না করা পরিবর্তন।",
    "countError": "১ থেকে ৩৬৫টি ব্যাকআপের মধ্যে বেছে নিন।",
    "saving": "সংরক্ষণ করা হচ্ছে…",
    "saved": "সেটিংস সংরক্ষিত হয়েছে।",
    "previewError": "ফোল্ডার পরীক্ষা করা যায়নি।",
    "destinationNotEmpty": "নতুন ফোল্ডারে আগে থেকেই LUXIPANEL ব্যাকআপ আছে।",
    "changeConfirm": "{path}-এ থাকা {count}টি স্থানীয় ব্যাকআপ মুছে যাবে। S3/R2 ব্যাকআপ থাকবে। ফোল্ডার বদলাবেন?",
    "changeTitle": "ব্যাকআপ ফোল্ডার বদলান",
    "changeError": "ফোল্ডার বদলানো যায়নি।",
    "tables": "টেবিল",
    "localHeading": "স্থানীয় গন্তব্য",
    "overview": "ব্যাকআপের অবস্থা",
    "targetChanged": "সার্ভার বদলেছে; এর সেটিংস আবার যাচাই করুন।"
  },
  "status": {
    "completed": "সম্পন্ন",
    "failed": "ব্যর্থ",
    "running": "চলছে"
  },
  "header": {
    "heading": "ব্যাকআপ",
    "subheading": "সার্ভারের ফাইল, ডেটাবেস, মেইল ও সেটিংস সুরক্ষিত রাখুন।",
    "btnBackupNow": "এখনই Backup করুন"
  },
  "configCard": {
    "title": "ব্যাকআপ কনফিগারেশন",
    "subtitle": "স্থানীয় ডিরেক্টরি ও দূরবর্তী স্টোরেজ।",
    "labelLocalDir": "স্থানীয় backup ডিরেক্টরি",
    "placeholderLocalDir": "/var/backups/luxipanel",
    "labelRetentionDefault": "ডিফল্টভাবে রাখার স্থানীয় ব্যাকআপ",
    "s3Section": "S3 / Cloudflare R2",
    "labelEndpoint": "Endpoint",
    "labelBucket": "Bucket",
    "labelAccessKeyId": "অ্যাক্সেস কী আইডি",
    "labelSecretAccessKey": "গোপন অ্যাক্সেস কী",
    "btnBrowse": "ব্রাউজ",
    "tabLocal": "স্থানীয়",
    "tabCloud": "ক্লাউড"
  },
  "pathBrowserDialog": {
    "title": "ফোল্ডার নির্বাচন করুন",
    "btnUp": "উপরে যান",
    "btnCancel": "বাতিল করুন",
    "btnSelect": "এই ফোল্ডারটি ব্যবহার করুন"
  },
  "backupSources": {
    "title": "কী ব্যাকআপ করবেন",
    "scopeFull": "সম্পূর্ণ সার্ভার (নির্বাচিত)",
    "scopeFullHint": "ডেটাবেস, মেইল, প্যানেল কনফিগারেশন এবং /etc /home /var/www /root",
    "scopeCustom": "কাস্টম",
    "labelDatabases": "ডেটাবেস",
    "dbAll": "সব",
    "dbPick": "বেছে নিন…",
    "dbChoose": "ডেটাবেস বেছে নিন",
    "dbNone": "কোনোটি নির্বাচিত নয়",
    "labelMail": "মেইল (vmail + Postfix/Dovecot)",
    "labelPanelConfig": "প্যানেল কনফিগারেশন",
    "foldersTitle": "ফোল্ডার",
    "addFolder": "ফোল্ডার যোগ করুন",
    "noFolders": "কোনো ফোল্ডার নির্বাচিত নয়"
  },
  "dbPickerDialog": {
    "title": "ডেটাবেস নির্বাচন করুন",
    "loading": "লোড হচ্ছে…",
    "btnCancel": "বাতিল করুন",
    "btnSelect": "নির্বাচন ব্যবহার করুন",
    "btnRetry": "আবার চেষ্টা করুন",
    "unavailableSelection": "নির্বাচিত একটি ডেটাবেস আর উপলব্ধ নেই। নির্বাচনটি পরীক্ষা করুন।"
  },
  "storagesSection": {
    "subtitle": "আপনার backup-এর জন্য ক্লাউড গন্তব্য (S3 / Cloudflare R2)।",
    "tableTitle": "স্টোরেজ",
    "btnNew": "নতুন storage"
  },
  "storageDialog": {
    "titleNew": "নতুন ক্লাউড storage",
    "titleEdit": "ক্লাউড storage সম্পাদনা করুন",
    "labelName": "নাম",
    "placeholderName": "আমার R2 bucket",
    "labelProvider": "প্রদানকারী",
    "optS3": "Amazon S3",
    "optR2": "Cloudflare R2",
    "labelBucket": "Bucket",
    "labelPrefix": "প্রিফিক্স (ফোল্ডার)",
    "placeholderPrefix": "backups/",
    "labelEndpoint": "Endpoint",
    "labelRegion": "অঞ্চল",
    "labelAccessKey": "অ্যাক্সেস কী আইডি",
    "labelSecret": "গোপন অ্যাক্সেস কী",
    "secretKeepHint": "বর্তমান গোপন কী সংরক্ষণ করতে খালি রাখুন।",
    "btnCancel": "বাতিল করুন",
    "btnSave": "সংরক্ষণ করুন",
    "usingCentralCred": "সেটিংস → ক্রেডেনশিয়ালের কেন্দ্রীয় ক্রেডেনশিয়াল ব্যবহার করা হচ্ছে (শুধু বাকেট নির্ধারণ করুন)।",
    "credRequired": "{provider}-এর কোনো ক্রেডেনশিয়াল কনফিগার করা নেই। এই গন্তব্য ব্যবহার করতে সেটিংস → ক্রেডেনশিয়ালে নিবন্ধন করুন।",
    "credRequiredCta": "সেটিংস → ক্রেডেনশিয়ালে যান"
  },
  "progress": {
    "creating": "ব্যাকআপ তৈরি হচ্ছে… কয়েক মিনিট সময় লাগতে পারে।"
  },
  "historySection": {
    "title": "Backup ইতিহাস",
    "tableTitle": "ব্যাকআপ",
    "count": "{count} কপি",
    "countPartial": "মোট {total}টির মধ্যে {shown}টি দেখানো হচ্ছে"
  },
  "schedulesSection": {
    "title": "সময়সূচি",
    "btnNew": "নতুন",
    "loading": "লোড হচ্ছে...",
    "active": "সক্রিয়",
    "paused": "বিরত",
    "copies": "কপি",
    "pause": "বিরতি",
    "enable": "চালু",
    "edit": "সম্পাদনা",
    "delete": "মুছুন"
  },
  "backupDialog": {
    "title": "ম্যানুয়াল ব্যাকআপ তৈরি করুন",
    "labelName": "লেবেল",
    "placeholderName": "pre-upgrade",
    "labelStorage": "স্টোরেজ",
    "optionLocal": "স্থানীয়",
    "optionS3": "AWS S3",
    "optionR2": "Cloudflare R2",
    "labelIncludeDb": "PostgreSQL ডাম্প অন্তর্ভুক্ত করুন",
    "sourcesTitle": "কী ব্যাকআপ করবেন",
    "labelIncludeDatabases": "ডেটাবেস (MySQL/MariaDB + PostgreSQL)",
    "labelIncludeMail": "মেইল অ্যাকাউন্ট (মেইলবক্স + কনফিগারেশন)",
    "labelIncludePanelConfig": "LuxiPanel কনফিগারেশন",
    "btnCancel": "বাতিল",
    "btnStart": "ব্যাকআপ শুরু করুন"
  },
  "scheduleDialog": {
    "title": "ব্যাকআপ নির্ধারণ করুন",
    "labelName": "নাম",
    "placeholderName": "সাপ্তাহিক ব্যাকআপ",
    "labelSchedule": "সময়সূচি (cron)",
    "placeholderSchedule": "0 3 * * 0",
    "labelStorage": "স্টোরেজ",
    "optionLocal": "স্থানীয়",
    "optionS3": "S3",
    "optionR2": "R2",
    "labelRetention": "রাখার স্থানীয় ব্যাকআপ",
    "labelFrequency": "কম্পাঙ্ক",
    "optHourly": "প্রতি ঘণ্টায়",
    "optDaily": "দৈনিক",
    "optWeekly": "সাপ্তাহিক",
    "optMonthly": "মাসিক",
    "labelTime": "সময়",
    "labelWeekday": "সপ্তাহের দিন",
    "labelMonthday": "মাসের দিন",
    "cronPreview": "সমতুল্য",
    "cronExample": "0 3 * * *",
    "weekdays": [
      "রবিবার",
      "সোমবার",
      "মঙ্গলবার",
      "বুধবার",
      "বৃহস্পতিবার",
      "শুক্রবার",
      "শনিবার"
    ],
    "btnCancel": "বাতিল",
    "btnSave": "সংরক্ষণ করুন",
    "localRetentionHint": "এই সময়সূচির সাম্প্রতিক স্থানীয় ব্যাকআপগুলো রাখা হবে।",
    "cloudRetentionHint": "ক্লাউড প্রদানকারীর কাছে S3/R2 সংরক্ষণের মেয়াদ নির্ধারণ করুন।",
    "editTitle": "সময়সূচি সম্পাদনা করুন"
  },
  "toasts": {
    "errorSaveSettings": "ব্যাকআপ কনফিগারেশন সংরক্ষণে ত্রুটি",
    "preparingDownload": "ডাউনলোড প্রস্তুত হচ্ছে…",
    "backupDeleted": "ব্যাকআপ মুছে গেছে",
    "backupsDeleted": "ব্যাকআপগুলো মুছে গেছে",
    "scheduleDeleted": "সময়সূচি মুছে গেছে",
    "errorDelete": "মুছতে ত্রুটি",
    "errorCreateBackup": "ব্যাকআপ তৈরিতে ত্রুটি",
    "backupStarted": "ব্যাকআপ শুরু হয়েছে",
    "backupCompleted": "ব্যাকআপ সম্পন্ন",
    "backupStillRunning": "ব্যাকআপ এখনও চলছে…",
    "scheduleCreated": "সময়সূচি তৈরি হয়েছে",
    "errorCreateSchedule": "সময়সূচি তৈরিতে ত্রুটি",
    "storageDeleted": "স্টোরেজ মুছে গেছে",
    "storageUpdated": "স্টোরেজ আপডেট হয়েছে",
    "storageCreated": "স্টোরেজ তৈরি হয়েছে",
    "errorSaveStorage": "স্টোরেজ সংরক্ষণে ত্রুটি",
    "recordRemoved": "ইতিহাস থেকে রেকর্ড সরানো হয়েছে"
  },
  "errors": {
    "listPathFailed": "এই পাথ তালিকা করা যায়নি (অনুমতি নেই?)।",
    "listDbFailed": "ডেটাবেস তালিকা করা যায়নি।",
    "downloadFailed": "ব্যাকআপ ডাউনলোড করা যায়নি",
    "backupErrorDetail": "ত্রুটি: {error}"
  },
  "empty": {
    "noSubfolders": "(কোনো সাবফোল্ডার নেই)",
    "noDbEngines": "কোনো সক্রিয় ডিবি ইঞ্জিন পাওয়া যায়নি।",
    "noDatabases": "(কোনো ডেটাবেস নেই)",
    "noneSelected": "কিছু নির্বাচিত নয়",
    "noSchedules": "কোনো সময়সূচি নেই"
  },
  "labels": {
    "loading": "লোড হচ্ছে…",
    "fullServer": "সম্পূর্ণ সার্ভার",
    "editStorage": "স্টোরেজ সম্পাদনা",
    "newStorage": "নতুন স্টোরেজ"
  },
  "confirm": {
    "deleteBackup": "ব্যাকআপ \"{label}\" মুছবেন?",
    "deleteBackupTitle": "ব্যাকআপ মুছুন",
    "deleteBulkBackup": "{count}টি নির্বাচিত ব্যাকআপ মুছবেন?",
    "deleteBulkBackupTitle": "ব্যাকআপ মুছুন",
    "deleteSchedule": "এই সময়সূচি মুছবেন?",
    "deleteScheduleTitle": "সময়সূচি মুছুন",
    "deleteStorage": "স্টোরেজ \"{name}\" মুছবেন?",
    "deleteStorageTitle": "স্টোরেজ মুছুন",
    "removeRecord": "ইতিহাস থেকে «{label}» সরাবেন? ক্লাউডের অবজেক্টটি রাখা হবে।",
    "removeRecordTitle": "রেকর্ড সরান",
    "cloudBulkNote": "S3/R2 অবজেক্টগুলো রাখা হবে।"
  },
  "table": {
    "columns": {
      "label": "লেবেল",
      "status": "অবস্থা",
      "size": "আকার",
      "storage": "স্টোরেজ",
      "fecha": "তারিখ"
    },
    "storagesColumns": {
      "name": "নাম",
      "provider": "প্রদানকারী",
      "bucket": "Bucket",
      "endpoint": "Endpoint"
    },
    "filters": {
      "searchBackupLabel": "লেবেল খুঁজুন...",
      "filterBackupStorage": "স্টোরেজ",
      "searchStorageName": "নাম খুঁজুন...",
      "filterStorageProvider": "প্রদানকারী"
    },
    "rowActions": {
      "download": "ডাউনলোড করুন",
      "removeRecord": "ইতিহাস থেকে সরান",
      "details": "ত্রুটি দেখুন",
      "delete": "মুছুন",
      "refresh": "অবস্থা হালনাগাদ করুন"
    },
    "quickActions": {
      "deleteSelected": "নির্বাচিত মুছুন"
    },
    "storagesRowActions": {
      "edit": "সম্পাদনা",
      "delete": "মুছুন"
    }
  }
} as const;

export default backups;
