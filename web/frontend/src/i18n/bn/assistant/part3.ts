const assistantPart3 = {
  "skillOptions": {
    "ponytail": {
      "mode": {
        "label": "তীব্রতা",
        "choices": {
          "off": "বন্ধ",
          "lite": "Lite — সবচেয়ে সরল বিকল্প পরামর্শ দিন",
          "full": "Full — সিঁড়ি প্রয়োগ করুন",
          "ultra": "Ultra — YAGNI চরমপন্থী"
        }
      }
    },
    "ui-ux-pro-max": {
      "detalle": {
        "label": "বিস্তারিত",
        "choices": {
          "breve": "সংক্ষিপ্ত (ন্যূনতম টোকেন)",
          "completo": "সম্পূর্ণ (আরও বিস্তারিত)"
        }
      }
    }
  },
  "toolCatalog": {
    "admin.bash": {
      "title": "Bash কমান্ড চালান"
    },
    "admin.restart_service": {
      "title": "systemd সার্ভিস পুনরায় চালু করুন"
    },
    "backup.list_jobs": {
      "title": "কনফিগার করা ব্যাকআপ তালিকা"
    },
    "bitninja.status": {
      "title": "BitNinja স্ট্যাটাস"
    },
    "cloudflare.status": {
      "title": "Cloudflare স্ট্যাটাস"
    },
    "cloudflare.list_zones": {
      "title": "Cloudflare জোন তালিকা"
    },
    "cloudflare.list_dns_records": {
      "title": "DNS রেকর্ড তালিকা"
    },
    "cloudflare.create_dns_record": {
      "title": "DNS রেকর্ড তৈরি করুন"
    },
    "cloudflare.update_dns_record": {
      "title": "DNS রেকর্ড আপডেট করুন"
    },
    "cloudflare.delete_dns_record": {
      "title": "DNS রেকর্ড মুছুন"
    },
    "cloudflare.purge_cache": {
      "title": "Cloudflare ক্যাশ পরিষ্কার করুন"
    },
    "cloudflare.get_zone_settings": {
      "title": "জোন সেটিংস দেখুন"
    },
    "cloudflare.set_zone_setting": {
      "title": "জোন সেটিং পরিবর্তন করুন"
    },
    "cloudflare.list_access_rules": {
      "title": "IP অ্যাক্সেস নিয়ম তালিকা"
    },
    "cloudflare.block_ip": {
      "title": "Cloudflare-এ IP ব্লক করুন"
    },
    "cron.list": {
      "title": "cron জব তালিকা"
    },
    "cron.add": {
      "title": "cron জব তৈরি করুন"
    },
    "cron.update": {
      "title": "cron জব সম্পাদনা করুন"
    },
    "cron.toggle": {
      "title": "cron জব বিরতি/পুনরায় চালু করুন"
    },
    "cron.remove": {
      "title": "cron জব মুছুন"
    },
    "cron.ai_list": {
      "title": "নির্ধারিত AI এজেন্ট তালিকা"
    },
    "cron.ai_logs": {
      "title": "একটি AI এজেন্টের রান তালিকা"
    },
    "cron.ai_read_log": {
      "title": "একটি AI এজেন্টের রান পড়ুন"
    },
    "cron.ai_run": {
      "title": "নির্ধারিত AI এজেন্ট এখনই চালান"
    },
    "cron.ai_toggle": {
      "title": "নির্ধারিত AI এজেন্ট বিরতি/পুনরায় চালু করুন"
    },
    "cron.ai_add": {
      "title": "নির্ধারিত AI এজেন্ট তৈরি করুন"
    },
    "cron.ai_update": {
      "title": "নির্ধারিত AI এজেন্ট সম্পাদনা করুন"
    },
    "cron.ai_remove": {
      "title": "নির্ধারিত AI এজেন্ট মুছুন"
    },
    "cron.presets_get": {
      "title": "এজেন্ট কনফিগারেশন পড়ুন (presets)"
    },
    "cron.presets_set": {
      "title": "এজেন্ট কনফিগারেশন সংরক্ষণ করুন (presets)"
    },
    "dashboard.overview": {
      "title": "সার্ভার ওভারভিউ"
    },
    "databases.list_engines": {
      "title": "ডেটাবেজ ইঞ্জিন সনাক্ত করুন"
    },
    "databases.list_databases": {
      "title": "ডেটাবেজ তালিকা"
    },
    "databases.list_tables": {
      "title": "টেবিল তালিকা"
    },
    "databases.run_query": {
      "title": "SQL কুয়েরি চালান"
    },
    "expo.status": {
      "title": "Expo স্ট্যাটাস"
    },
    "expo.account": {
      "title": "Expo অ্যাকাউন্ট"
    },
    "expo.list_projects": {
      "title": "Expo প্রকল্প তালিকা"
    },
    "expo.project_info": {
      "title": "প্রকল্পের তথ্য"
    },
    "expo.init_project": {
      "title": "Expo প্রকল্প তৈরি করুন"
    },
    "expo.link_project": {
      "title": "EAS-এ প্রকল্প লিংক করুন"
    },
    "expo.build": {
      "title": "EAS বিল্ড শুরু করুন"
    },
    "expo.build_list": {
      "title": "বিল্ড ইতিহাস"
    },
    "expo.build_view": {
      "title": "বিল্ড স্ট্যাটাস"
    },
    "expo.build_cancel": {
      "title": "বিল্ড বাতিল করুন"
    },
    "expo.submit": {
      "title": "স্টোরে জমা দিন"
    },
    "expo.dev_client": {
      "title": "dev-client শুরু করুন (QR)"
    },
    "expo.quota": {
      "title": "বিল্ড কোটা"
    },
    "expo.update": {
      "title": "OTA আপডেট প্রকাশ করুন"
    },
    "expo.env_list": {
      "title": "EAS ভেরিয়েবল তালিকা"
    },
    "expo.env_set": {
      "title": "EAS ভেরিয়েবল তৈরি করুন"
    },
    "expo.set_google_credential": {
      "title": "Play Store ক্রেডেনশিয়াল"
    },
    "expo.set_apple_credential": {
      "title": "App Store ক্রেডেনশিয়াল"
    },
    "expo.webhook_create": {
      "title": "EAS ওয়েবহুক নিবন্ধন করুন"
    },
    "expo.device_create": {
      "title": "iOS ডিভাইস নিবন্ধন করুন"
    },
    "files.read": {
      "title": "ফাইল পড়ুন"
    },
    "files.list_dir": {
      "title": "ডিরেক্টরি তালিকা"
    },
    "files.grep": {
      "title": "ফাইলে অনুসন্ধান করুন"
    },
    "files.project_info": {
      "title": "প্রকল্পের ধরন সনাক্ত করুন"
    },
    "files.security_scan": {
      "title": "হিউরিস্টিক নিরাপত্তা স্ক্যান"
    },
    "files.write": {
      "title": "ফাইল লিখুন"
    },
    "files.mkdir": {
      "title": "ফোল্ডার তৈরি করুন"
    },
    "files.delete": {
      "title": "ফাইল বা ফোল্ডার মুছুন"
    },
    "files.rename": {
      "title": "নাম পরিবর্তন বা সরান"
    },
    "files.copy": {
      "title": "ফাইল কপি করুন"
    },
    "files.chmod": {
      "title": "অনুমতি পরিবর্তন করুন (chmod)"
    },
    "files.chown": {
      "title": "মালিক পরিবর্তন করুন (chown)"
    },
    "firewall.ufw_status": {
      "title": "UFW স্ট্যাটাস"
    },
    "firewall.fail2ban_status": {
      "title": "fail2ban স্ট্যাটাস (jails)"
    },
    "hosting.list_accounts": {
      "title": "হোস্টিং অ্যাকাউন্ট তালিকা"
    },
    "hosting.list_audit": {
      "title": "একটি হোস্টিং অ্যাকাউন্টের অডিট লগ দেখুন"
    },
    "hosting.account_stats": {
      "title": "হোস্টিং অ্যাকাউন্ট ব্যবহারের পরিসংখ্যান"
    },
    "mail.list_domains": {
      "title": "উপলব্ধ ডোমেইন"
    },
    "mail.list_messages": {
      "title": "মেইলবক্স বার্তা তালিকা"
    },
    "mail.fetch_message": {
      "title": "সম্পূর্ণ বার্তা পড়ুন"
    },
    "mail.move_messages": {
      "title": "কোয়ারেন্টিনে বার্তা সরান"
    },
    "mail.flag_messages": {
      "title": "বার্তা ফ্ল্যাগ করুন"
    },
    "mail.delete_messages": {
      "title": "বার্তা মুছুন (স্থায়ী)"
    },
    "module-dev.validate_manifest": {
      "title": "ম্যানিফেস্ট যাচাই করুন"
    },
    "module-dev.run_checks": {
      "title": "মডিউলের স্ট্যাটিক চেক"
    },
    "module-dev.run_tests": {
      "title": "মডিউল টেস্ট চালান"
    },
    "module-dev.list_modules": {
      "title": "আমার মার্কেটপ্লেস মডিউল"
    },
    "module-dev.module_status": {
      "title": "মডিউল স্ট্যাটাস"
    },
    "module-dev.submit_module": {
      "title": "পর্যালোচনার জন্য মডিউল জমা দিন"
    },
    "module-dev.resubmit_module": {
      "title": "সংশোধিত মডিউল পুনরায় জমা দিন"
    },
    "module-dev.unpublish_module": {
      "title": "মডিউল অপ্রকাশিত করুন"
    },
    "module-dev.republish_module": {
      "title": "মডিউল পুনরায় প্রকাশ করুন"
    },
    "module-dev.preview_install": {
      "title": "প্রিভিউ ইনস্টল করুন (Mode B)"
    },
    "module-dev.preview_uninstall": {
      "title": "প্রিভিউ আনইনস্টল করুন"
    },
    "module-dev.link_project": {
      "title": "প্রকল্প ↔ মডিউল লিংক করুন"
    },
    "monitor.cpu_top": {
      "title": "শীর্ষ CPU প্রসেস"
    },
    "monitor.watchdog_status": {
      "title": "অটো-রিবুট স্ট্যাটাস"
    },
    "monitor.watchdog_configure": {
      "title": "অটো-রিবুট কনফিগার করুন"
    },
    "nginx.list_sites": {
      "title": "nginx সাইট তালিকা"
    },
    "nginx.tail_access_log": {
      "title": "access.log টেইল করুন"
    },
    "obsidian.list_vaults": {
      "title": "ভল্ট তালিকা"
    },
    "obsidian.list_notes": {
      "title": "নোট তালিকা"
    },
    "obsidian.read_note": {
      "title": "নোট পড়ুন"
    },
    "obsidian.search_notes": {
      "title": "নোটে অনুসন্ধান করুন"
    },
    "obsidian.backlinks": {
      "title": "নোটের ব্যাকলিংক"
    },
    "obsidian.write_note": {
      "title": "নোট লিখুন"
    },
    "obsidian.append_note": {
      "title": "নোটে যোগ করুন"
    },
    "obsidian.daily_note": {
      "title": "দৈনিক নোট"
    },
    "obsidian.delete_note": {
      "title": "নোট মুছুন"
    },
    "obsidian.list_containers": {
      "title": "প্রসঙ্গ কন্টেইনার তালিকা"
    },
    "obsidian.sync_containers": {
      "title": "প্রসঙ্গ কন্টেইনার সিংক করুন"
    },
    "openclaw.config": {
      "title": "OpenClaw কনফিগারেশন"
    },
    "openclaw.test_connection": {
      "title": "OpenClaw সংযোগ পরীক্ষা করুন"
    },
    "security-audit.last_report": {
      "title": "সর্বশেষ অডিট রিপোর্ট"
    },
    "security-audit.ssh_posture": {
      "title": "সার্ভার SSH পোশ্চার"
    },
    "server-alerts.send": {
      "title": "সার্ভারে বিজ্ঞপ্তি পাঠান"
    },
    "server-alerts.list_rules": {
      "title": "সতর্কতার নিয়ম তালিকা"
    },
    "server-alerts.create_rule": {
      "title": "সতর্কতার নিয়ম তৈরি করুন"
    },
    "users.list": {
      "title": "প্যানেল ব্যবহারকারী তালিকা"
    },
    "users.create": {
      "title": "ব্যবহারকারী তৈরি করুন"
    },
    "users.update": {
      "title": "ব্যবহারকারী সম্পাদনা করুন"
    },
    "users.delete": {
      "title": "ব্যবহারকারী মুছুন"
    },
    "users.groups_list": {
      "title": "অনুমতি সহ গ্রুপ তালিকা"
    },
    "users.group_create": {
      "title": "গ্রুপ তৈরি করুন"
    },
    "users.group_update": {
      "title": "গ্রুপ সম্পাদনা করুন"
    },
    "users.group_delete": {
      "title": "গ্রুপ মুছুন"
    },
    "webhooks.list": {
      "title": "কনফিগার করা ওয়েবহুক তালিকা"
    }
  },
  "dataPanelCatalog": {
    "admin.health": {
      "title": "সার্ভার স্বাস্থ্য",
      "description": "সংযুক্ত টার্গেটের দ্রুত রিচেবিলিটি / লোড প্রোব — অপারেশনাল প্রশ্নের উত্তর দেওয়ার আগে সিস্টেম-প্রম্পট প্রসঙ্গ হিসেবে উপযোগী।"
    },
    "dashboard.snapshot": {
      "title": "সংক্ষিপ্ত ওভারভিউ",
      "description": "সংযুক্ত টার্গেটের সংক্ষিপ্ত প্রি-প্রম্পট সারসংক্ষেপ: লোড, RAM%, রুট ডিস্ক%, এবং কতটি মূল সার্ভিস চলছে।"
    },
    "monitor.snapshot": {
      "title": "সিস্টেম স্ন্যাপশট",
      "description": "সংযুক্ত টার্গেটের বর্তমান রিসোর্স সারসংক্ষেপ: CPU ব্যবহার %, লোড গড়, ব্যবহৃত/মোট মেমরি, রুট ফাইলসিস্টেম ব্যবহার।"
    },
    "obsidian.vaults_summary": {
      "title": "ভল্ট সারসংক্ষেপ",
      "description": "সংযুক্ত সার্ভারে নিবন্ধিত Obsidian ভল্ট তাদের পাথ, অস্তিত্ব ও মার্কডাউন নোট সংখ্যা সহ।"
    }
  },
  "structurePanel": {
    "editorLoading": "এডিটর লোড হচ্ছে...",
    "loading": "লোড হচ্ছে...",
    "createdNotice": "{count}টি আইটেম তৈরি হয়েছে।",
    "nothingToCreate": "তৈরির কিছু নেই (ইতোমধ্যে বিদ্যমান)।",
    "savedNotice": "{rel} সংরক্ষিত হয়েছে।",
    "noActiveProviders": "কোনো AI প্রভাইডার সক্রিয় নেই। Providers-এ একটি সক্রিয় করুন।",
    "improvedNotice": "AI দিয়ে উন্নত করা হয়েছে। diff পর্যালোচনা করুন এবং পছন্দ হলে Save করুন।",
    "noAiChanges": "AI কোনো পরিবর্তন প্রস্তাব করেনি।",
    "structureLoading": "কাঠামো বিশ্লেষণ করা হচ্ছে...",
    "retry": "পুনরায় চেষ্টা করুন",
    "copyAllContent": "সমস্ত কনটেন্ট কপি করুন",
    "copied": "কপি হয়েছে",
    "copy": "কপি করুন",
    "downloadFile": "ফাইল ডাউনলোড করুন",
    "download": "ডাউনলোড",
    "diff": "Diff",
    "originalDiffTitle": "মূল কনটেন্টের বিপরীতে পার্থক্য দেখুন",
    "back": "পেছনে",
    "improveContentTitle": "প্রকল্প প্রসঙ্গ ব্যবহার করে AI দিয়ে কনটেন্ট উন্নত করুন",
    "improving": "উন্নত করা হচ্ছে...",
    "improveWithAi": "AI দিয়ে উন্নত করুন",
    "cancel": "বাতিল",
    "saving": "সংরক্ষণ করা হচ্ছে...",
    "save": "সংরক্ষণ করুন",
    "chooseProvider": "AI প্রভাইডার বেছে নিন",
    "close": "বন্ধ করুন",
    "noModel": "(কোনো মডেল নেই)",
    "directory": "ডিরেক্টরি",
    "structureCount": "কাঠামো · {count}টি তৈরি করতে হবে",
    "markMissing": "অনুপস্থিত চিহ্নিত করুন",
    "creating": "তৈরি করা হচ্ছে...",
    "create": "তৈরি করুন ({count})",
    "expand": "প্রসারিত করুন",
    "collapse": "সংকুচিত করুন",
    "edit": "সম্পাদনা করুন",
    "exists": "বিদ্যমান",
    "createLabel": "তৈরি করুন",
    "fallbackFilename": "file.txt",
    "structureHints": {
      "claude": "নির্দেশনা, কনফিগারেশন, নিয়ম, কমান্ড, স্কিল, এজেন্ট এবং হুক যা Claude Code প্রকল্প ডিরেক্টরি থেকে পড়ে।",
      "codex": "Codex CLI প্রকল্প নির্দেশিকা হিসেবে AGENTS.md পড়ে এবং কনফিগারেশন ও প্রম্পটের জন্য .codex/ পড়ে।",
      "gemini": "Gemini CLI প্রকল্পের প্রসঙ্গ হিসেবে GEMINI.md পড়ে এবং কনফিগারেশন ও কমান্ডের জন্য .gemini/ পড়ে।"
    },
    "structureNodes": {
      "CLAUDE.md": "প্রকল্প নির্দেশনা (প্রসঙ্গ, কমান্ড, কনভেনশন)",
      "CLAUDE.local.md": "স্থানীয় নির্দেশনা (কমিট করবেন না; ব্যক্তিগত পছন্দ)",
      ".mcp.json": "প্রকল্প MCP সার্ভার",
      ".claude/settings.json": "প্রকল্প কনফিগারেশন (সংস্করণযুক্ত)",
      ".claude/settings.local.json": "স্থানীয় কনফিগারেশন (সংস্করণযুক্ত নয়)",
      ".claude/rules": "পুনঃব্যবহারযোগ্য নিয়ম",
      ".claude/rules/code-style.md": "নিয়ম: কোড স্টাইল",
      ".claude/rules/testing.md": "নিয়ম: টেস্টিং",
      ".claude/rules/api-conventions.md": "নিয়ম: API কনভেনশন",
      ".claude/commands": "কাস্টম স্ল্যাশ কমান্ড",
      ".claude/commands/review.md": "/review কমান্ড",
      ".claude/commands/fix-issue.md": "/fix-issue কমান্ড",
      ".claude/skills": "প্রকল্প স্কিল",
      ".claude/skills/deploy": "স্কিল: ডিপ্লয়",
      ".claude/skills/deploy/SKILL.md": "ডিপ্লয় স্কিল সংজ্ঞা",
      ".claude/skills/deploy/deploy-config.md": "ডিপ্লয় স্কিল কনফিগারেশন",
      ".claude/agents": "বিশেষায়িত সাবএজেন্ট",
      ".claude/agents/code-reviewer.md": "এজেন্ট: কোড রিভিউয়ার",
      ".claude/agents/security-auditor.md": "এজেন্ট: সিকিউরিটি অডিটর",
      ".claude/hooks": "হুক (লাইফসাইকেল স্ক্রিপ্ট)",
      ".claude/hooks/validate-bash.sh": "হুক: bash কমান্ড যাচাই করুন",
      "AGENTS.md": "Codex/এজেন্টের জন্য প্রকল্প নির্দেশিকা",
      ".codex": "Codex কনফিগারেশন",
      ".codex/config.toml": "Codex প্রকল্প কনফিগারেশন",
      ".codex/prompts": "পুনঃব্যবহারযোগ্য প্রম্পট/টেমপ্লেট",
      ".codex/prompts/review.md": "প্রম্পট: কোড রিভিউ",
      "GEMINI.md": "Gemini-এর জন্য প্রকল্পের প্রসঙ্গ",
      ".gemini": "Gemini কনফিগারেশন",
      ".gemini/settings.json": "Gemini প্রকল্প কনফিগারেশন",
      ".gemini/commands": "কাস্টম কমান্ড",
      ".gemini/commands/review.toml": "কমান্ড: রিভিউ",
      "modules/*": "মার্কেটপ্লেস মডিউল রুট",
      "modules/*/module.manifest.json": "খসড়া ম্যানিফেস্ট (AUTO ফিল্ডগুলো প্ল্যাটফর্ম দ্বারা সেট করা হয়)",
      "modules/*/backend/index.js": "মডিউল ব্যাকএন্ড — SDK defineModule() কঙ্কাল",
      "modules/*/frontend": "মডিউল ফ্রন্টএন্ড (Astro, ঐচ্ছিক)",
      "modules/*/README.md": "মডিউল README",
      ".claude/rules/marketplace.md": "নিয়ম: মার্কেটপ্লেস আর্কিটেকচার (ম্যানিফেস্ট, SDK, ক্ষমতা)",
      "MARKETPLACE.md": "মার্কেটপ্লেস আর্কিটেকচার নিয়ম (ম্যানিফেস্ট, SDK, ক্ষমতা)"
    }
  },
  "mcpConfigPanel": {
    "noInstallResponse": "কোনো ইনস্টল প্রতিক্রিয়া নেই",
    "summaryTitle": "CLI-তে প্যানেলের সক্ষমতা উন্মুক্ত করুন (MCP)",
    "optional": "ঐচ্ছিক",
    "description": "{providerId} CLI-কে প্যানেলের টুলের সাথে সংযুক্ত করুন। প্যানেল সরাসরি টার্গেট সার্ভারে কনফিগারেশন লেখে; আপনাকে কিছু কপি করতে হবে না।",
    "configuredTitle": "টার্গেটে কনফিগার করা হয়েছে",
    "tokenValidUntil": "টোকেন {date} পর্যন্ত বৈধ।",
    "restartCli": "নতুন MCP সার্ভার লোড করতে টার্মিনালে CLI পুনরায় চালু করুন।",
    "configuring": "কনফিগার করা হচ্ছে...",
    "configureAutomatically": "স্বয়ংক্রিয়ভাবে কনফিগার করুন",
    "regenerate": "টোকেন পুনরায় তৈরি করুন ও পুনরায় কনফিগার করুন",
    "manualTitle": "ম্যানুয়াল কনফিগারেশন (উন্নত)",
    "generating": "তৈরি করা হচ্ছে...",
    "generateManualSnippet": "ম্যানুয়াল স্নিপেট তৈরি করুন",
    "fileLabel": "ফাইল",
    "snippetLabel": "স্নিপেট ({format})",
    "copy": "কপি করুন",
    "mcpUrlLabel": "MCP URL"
  },
  "conversationMedia": {
    "download": "ডাউনলোড",
    "close": "বন্ধ করুন",
    "previous": "পূর্ববর্তী",
    "next": "পরবর্তী",
    "all": "সব",
    "images": "ছবি",
    "documents": "দলিল",
    "attachmentsTitle": "কথোপকথনের সংযুক্তি",
    "emptyConversation": "এই কথোপকথনে কোনো সংযুক্তি নেই।",
    "imagesSection": "ছবি",
    "documentsSection": "দলিল",
    "clickToExpand": "প্রসারিত করতে ক্লিক করুন",
    "emptyImages": "কোনো ছবি নেই।",
    "emptyDocuments": "কোনো দলিল নেই।",
    "mediaTitle": "মিডিয়া",
    "attachToChat": "চ্যাটে সংযুক্ত করুন",
    "uploadToChat": "চ্যাটে ফাইল আপলোড করুন",
    "attachFailed": "চ্যাটে ফাইলটি সংযুক্ত করা যায়নি।"
  },
  "teamBoard": {
    "showMoreTasks": "আরও কাজ দেখুন ({count})",
    "showFewerTasks": "কম কাজ দেখান",
    "title": "টিম কাজ করছে",
    "progressOf": "{total}টির মধ্যে {done}টি কাজ সম্পন্ন",
    "statusPending": "অপেক্ষমাণ",
    "statusRunning": "চলমান",
    "statusDone": "সম্পন্ন",
    "statusFailed": "ব্যর্থ",
    "statusCanceled": "বাতিল",
    "pendingPermission": "আপনার অনুমোদনের অপেক্ষায়",
    "openChat": "চ্যাট খুলুন",
    "cancel": "কাজ বাতিল করুন",
    "cancelConfirm": "এই কাজটি বাতিল করবেন? এজেন্ট এতে কাজ করা বন্ধ করবে।",
    "assignedTo": "{agent}-কে বরাদ্দ",
    "autoTurn": "টিমের স্বয়ংক্রিয় বিজ্ঞপ্তি",
    "dashboardTitle": "কর্মরত টিম",
    "tokensSummary": "টোকেন: {total} (লিডার {leader} · টিম {workers})",
    "lessThan1s": "<১ সে",
    "insertions": "+{count}",
    "deletions": "-{count}",
    "viewDiff": "Diff দেখুন",
    "close": "বন্ধ করুন",
    "loading": "লোড হচ্ছে…",
    "verifyPassed": "যাচাই হয়েছে",
    "verifyFailed": "যাচাই ব্যর্থ হয়েছে ({attempts})",
    "filesChanged": "{count}টি ফাইল",
    "diffTitle": "কাজের পরিবর্তন",
    "diffUnavailable": "এই কাজের জন্য কোনো পার্থক্য নেই (ওয়ার্কট্রি বা পরিবর্তন নেই)।",
    "diffTruncated": "পার্থক্য সংক্ষিপ্ত করা হয়েছে: দেখানোর চেয়ে বেশি বিষয়বস্তু বদলেছে।",
    "branchIntegrated": "শাখা একীভূত হয়েছে",
    "cancelAll": "সব বাতিল করুন",
    "cancelAllConfirm": "চলমান সব কাজ বাতিল করবেন? সক্রিয় পরিকল্পনা ব্যর্থ হিসেবে চিহ্নিত হবে।",
    "addTask": "কাজ যোগ করুন",
    "addTaskTitle": "অধীনস্থ এজেন্টকে কাজ দিন",
    "addTaskWorker": "অধীনস্থ এজেন্ট",
    "addTaskWorkerPlaceholder": "— এজেন্ট বেছে নিন —",
    "addTaskNoWorkers": "এই নেতার সরাসরি কোনো অধীনস্থ এজেন্ট নেই।",
    "addTaskInstruction": "নির্দেশনা",
    "addTaskInstructionHint": "এজেন্ট এই কথোপকথন দেখতে পায় না; প্রয়োজনীয় সব প্রসঙ্গ দিন।",
    "addTaskTitleField": "শিরোনাম (ঐচ্ছিক)",
    "addTaskProject": "প্রকল্প (ঐচ্ছিক)",
    "addTaskProjectNone": "— কোনো প্রকল্প নয় —",
    "addTaskSubmitting": "কাজ দেওয়া হচ্ছে…",
    "feedbackUp": "ভালো ফল",
    "feedbackDown": "খারাপ ফল",
    "orgChart": "সাংগঠনিক চার্ট",
    "tokensChipTitle": "এই কাজে ব্যবহৃত টোকেন",
    "statusQueued": "সারিতে আছে",
    "verifyRunning": "যাচাই করা হচ্ছে…",
    "addTaskSubmit": "কাজ দিন"
  },
  "agentInfo": {
    "roleLabel": "ভূমিকা",
    "roleTooltip": "এজেন্টের ভূমিকা: {role}",
    "providerLabel": "প্রদানকারী",
    "providerModelTooltip": "প্রদানকারী {provider} · মডেল {model}",
    "projectLabel": "প্রকল্প",
    "projectTooltip": "প্রকল্প: {project}"
  },
  "mermaidDiagram": {
    "zoomOut": "জুম আউট",
    "zoomIn": "জুম ইন",
    "zoomReset": "জুম রিসেট করুন"
  },
  "assistantErrorBoundary": {
    "errorMessage": "সহকারী লোড করার সময় একটি ত্রুটি হয়েছে।",
    "retry": "আবার চেষ্টা করুন"
  }
} as const;

export default assistantPart3;
