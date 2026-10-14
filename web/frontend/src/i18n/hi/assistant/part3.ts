const assistantPart3 = {
  "skillOptions": {
    "ponytail": {
      "mode": {
        "label": "तीव्रता",
        "choices": {
          "off": "बंद",
          "lite": "Lite — सरलतम विकल्प सुझाएँ",
          "full": "Full — सीढ़ी लागू करें",
          "ultra": "Ultra — YAGNI अतिवादी"
        }
      }
    },
    "ui-ux-pro-max": {
      "detalle": {
        "label": "विवरण",
        "choices": {
          "breve": "संक्षिप्त (न्यूनतम टोकन)",
          "completo": "पूर्ण (अधिक विवरण)"
        }
      }
    }
  },
  "toolCatalog": {
    "admin.bash": {
      "title": "Bash कमांड चलाएँ"
    },
    "admin.restart_service": {
      "title": "systemd सेवा पुनरारंभ करें"
    },
    "backup.list_jobs": {
      "title": "कॉन्फ़िगर किए गए बैकअप सूचीबद्ध करें"
    },
    "bitninja.status": {
      "title": "BitNinja स्थिति"
    },
    "cloudflare.status": {
      "title": "Cloudflare स्थिति"
    },
    "cloudflare.list_zones": {
      "title": "Cloudflare ज़ोन सूचीबद्ध करें"
    },
    "cloudflare.list_dns_records": {
      "title": "DNS रिकॉर्ड सूचीबद्ध करें"
    },
    "cloudflare.create_dns_record": {
      "title": "DNS रिकॉर्ड बनाएँ"
    },
    "cloudflare.update_dns_record": {
      "title": "DNS रिकॉर्ड अपडेट करें"
    },
    "cloudflare.delete_dns_record": {
      "title": "DNS रिकॉर्ड हटाएँ"
    },
    "cloudflare.purge_cache": {
      "title": "Cloudflare कैश साफ़ करें"
    },
    "cloudflare.get_zone_settings": {
      "title": "ज़ोन सेटिंग देखें"
    },
    "cloudflare.set_zone_setting": {
      "title": "ज़ोन सेटिंग बदलें"
    },
    "cloudflare.list_access_rules": {
      "title": "IP एक्सेस नियम सूचीबद्ध करें"
    },
    "cloudflare.block_ip": {
      "title": "Cloudflare में IP ब्लॉक करें"
    },
    "cron.list": {
      "title": "cron जॉब सूचीबद्ध करें"
    },
    "cron.add": {
      "title": "cron जॉब बनाएँ"
    },
    "cron.update": {
      "title": "cron जॉब संपादित करें"
    },
    "cron.toggle": {
      "title": "cron जॉब रोकें/शुरू करें"
    },
    "cron.remove": {
      "title": "cron जॉब हटाएँ"
    },
    "cron.ai_list": {
      "title": "शेड्यूल किए गए AI एजेंट सूचीबद्ध करें"
    },
    "cron.ai_logs": {
      "title": "AI एजेंट के रन सूचीबद्ध करें"
    },
    "cron.ai_read_log": {
      "title": "AI एजेंट का रन पढ़ें"
    },
    "cron.ai_run": {
      "title": "शेड्यूल किया गया AI एजेंट अभी चलाएँ"
    },
    "cron.ai_toggle": {
      "title": "शेड्यूल किए गए AI एजेंट को रोकें/शुरू करें"
    },
    "cron.ai_add": {
      "title": "शेड्यूल किया गया AI एजेंट बनाएँ"
    },
    "cron.ai_update": {
      "title": "शेड्यूल किए गए AI एजेंट को संपादित करें"
    },
    "cron.ai_remove": {
      "title": "शेड्यूल किए गए AI एजेंट को हटाएँ"
    },
    "cron.presets_get": {
      "title": "एजेंट कॉन्फ़िगरेशन पढ़ें (प्रीसेट)"
    },
    "cron.presets_set": {
      "title": "एजेंट कॉन्फ़िगरेशन सहेजें (प्रीसेट)"
    },
    "dashboard.overview": {
      "title": "सर्वर अवलोकन"
    },
    "databases.list_engines": {
      "title": "डेटाबेस इंजन पहचानें"
    },
    "databases.list_databases": {
      "title": "डेटाबेस सूचीबद्ध करें"
    },
    "databases.list_tables": {
      "title": "टेबल सूचीबद्ध करें"
    },
    "databases.run_query": {
      "title": "SQL क्वेरी चलाएँ"
    },
    "expo.status": {
      "title": "Expo स्थिति"
    },
    "expo.account": {
      "title": "Expo खाता"
    },
    "expo.list_projects": {
      "title": "Expo प्रोजेक्ट सूचीबद्ध करें"
    },
    "expo.project_info": {
      "title": "प्रोजेक्ट जानकारी"
    },
    "expo.init_project": {
      "title": "Expo प्रोजेक्ट बनाएँ"
    },
    "expo.link_project": {
      "title": "प्रोजेक्ट को EAS से लिंक करें"
    },
    "expo.build": {
      "title": "EAS बिल्ड शुरू करें"
    },
    "expo.build_list": {
      "title": "बिल्ड इतिहास"
    },
    "expo.build_view": {
      "title": "बिल्ड स्थिति"
    },
    "expo.build_cancel": {
      "title": "बिल्ड रद्द करें"
    },
    "expo.submit": {
      "title": "स्टोर में सबमिट करें"
    },
    "expo.dev_client": {
      "title": "dev-client शुरू करें (QR)"
    },
    "expo.quota": {
      "title": "बिल्ड कोटा"
    },
    "expo.update": {
      "title": "OTA अपडेट प्रकाशित करें"
    },
    "expo.env_list": {
      "title": "EAS वेरिएबल सूचीबद्ध करें"
    },
    "expo.env_set": {
      "title": "EAS वेरिएबल बनाएँ"
    },
    "expo.set_google_credential": {
      "title": "Play Store क्रेडेंशियल"
    },
    "expo.set_apple_credential": {
      "title": "App Store क्रेडेंशियल"
    },
    "expo.webhook_create": {
      "title": "EAS वेबहुक पंजीकृत करें"
    },
    "expo.device_create": {
      "title": "iOS डिवाइस पंजीकृत करें"
    },
    "files.read": {
      "title": "फ़ाइल पढ़ें"
    },
    "files.list_dir": {
      "title": "डायरेक्टरी सूचीबद्ध करें"
    },
    "files.grep": {
      "title": "फ़ाइलों में खोजें"
    },
    "files.project_info": {
      "title": "प्रोजेक्ट प्रकार पहचानें"
    },
    "files.security_scan": {
      "title": "ह्यूरिस्टिक सुरक्षा स्कैन"
    },
    "files.write": {
      "title": "फ़ाइल लिखें"
    },
    "files.mkdir": {
      "title": "फ़ोल्डर बनाएँ"
    },
    "files.delete": {
      "title": "फ़ाइल या फ़ोल्डर हटाएँ"
    },
    "files.rename": {
      "title": "नाम बदलें या स्थानांतरित करें"
    },
    "files.copy": {
      "title": "फ़ाइल कॉपी करें"
    },
    "files.chmod": {
      "title": "अनुमतियाँ बदलें (chmod)"
    },
    "files.chown": {
      "title": "स्वामी बदलें (chown)"
    },
    "firewall.ufw_status": {
      "title": "UFW स्थिति"
    },
    "firewall.fail2ban_status": {
      "title": "fail2ban स्थिति (jails)"
    },
    "hosting.list_accounts": {
      "title": "होस्टिंग खाते सूचीबद्ध करें"
    },
    "hosting.list_audit": {
      "title": "होस्टिंग खाते का ऑडिट लॉग देखें"
    },
    "hosting.account_stats": {
      "title": "होस्टिंग खाता उपयोग आँकड़े"
    },
    "mail.list_domains": {
      "title": "उपलब्ध डोमेन"
    },
    "mail.list_messages": {
      "title": "मेलबॉक्स संदेश सूचीबद्ध करें"
    },
    "mail.fetch_message": {
      "title": "पूरा संदेश पढ़ें"
    },
    "mail.move_messages": {
      "title": "संदेश क्वारंटाइन में ले जाएँ"
    },
    "mail.flag_messages": {
      "title": "संदेश फ़्लैग करें"
    },
    "mail.delete_messages": {
      "title": "संदेश हटाएँ (स्थायी)"
    },
    "module-dev.validate_manifest": {
      "title": "मैनिफ़ेस्ट सत्यापित करें"
    },
    "module-dev.run_checks": {
      "title": "मॉड्यूल स्टैटिक जाँच"
    },
    "module-dev.run_tests": {
      "title": "मॉड्यूल परीक्षण चलाएँ"
    },
    "module-dev.list_modules": {
      "title": "मेरे मार्केटप्लेस मॉड्यूल"
    },
    "module-dev.module_status": {
      "title": "मॉड्यूल स्थिति"
    },
    "module-dev.submit_module": {
      "title": "मॉड्यूल समीक्षा के लिए सबमिट करें"
    },
    "module-dev.resubmit_module": {
      "title": "सुधारा गया मॉड्यूल पुनः सबमिट करें"
    },
    "module-dev.unpublish_module": {
      "title": "मॉड्यूल अप्रकाशित करें"
    },
    "module-dev.republish_module": {
      "title": "मॉड्यूल पुनः प्रकाशित करें"
    },
    "module-dev.preview_install": {
      "title": "प्रिव्यू इंस्टॉल करें (Mode B)"
    },
    "module-dev.preview_uninstall": {
      "title": "प्रिव्यू अनइंस्टॉल करें"
    },
    "module-dev.link_project": {
      "title": "प्रोजेक्ट ↔ मॉड्यूल लिंक करें"
    },
    "monitor.cpu_top": {
      "title": "शीर्ष CPU प्रक्रियाएँ"
    },
    "monitor.watchdog_status": {
      "title": "ऑटो-रीबूट स्थिति"
    },
    "monitor.watchdog_configure": {
      "title": "ऑटो-रीबूट कॉन्फ़िगर करें"
    },
    "nginx.list_sites": {
      "title": "nginx साइट सूचीबद्ध करें"
    },
    "nginx.tail_access_log": {
      "title": "access.log की पूँछ देखें"
    },
    "obsidian.list_vaults": {
      "title": "वॉल्ट सूचीबद्ध करें"
    },
    "obsidian.list_notes": {
      "title": "नोट सूचीबद्ध करें"
    },
    "obsidian.read_note": {
      "title": "नोट पढ़ें"
    },
    "obsidian.search_notes": {
      "title": "नोटों में खोजें"
    },
    "obsidian.backlinks": {
      "title": "नोट बैकलिंक"
    },
    "obsidian.write_note": {
      "title": "नोट लिखें"
    },
    "obsidian.append_note": {
      "title": "नोट में जोड़ें"
    },
    "obsidian.daily_note": {
      "title": "दैनिक नोट"
    },
    "obsidian.delete_note": {
      "title": "नोट हटाएँ"
    },
    "obsidian.list_containers": {
      "title": "संदर्भ कंटेनर सूचीबद्ध करें"
    },
    "obsidian.sync_containers": {
      "title": "संदर्भ कंटेनर सिंक करें"
    },
    "openclaw.config": {
      "title": "OpenClaw कॉन्फ़िगरेशन"
    },
    "openclaw.test_connection": {
      "title": "OpenClaw कनेक्शन परीक्षण करें"
    },
    "security-audit.last_report": {
      "title": "नवीनतम ऑडिट रिपोर्ट"
    },
    "security-audit.ssh_posture": {
      "title": "सर्वर SSH स्थिति"
    },
    "server-alerts.send": {
      "title": "सर्वर को सूचना भेजें"
    },
    "server-alerts.list_rules": {
      "title": "अलर्ट नियम सूचीबद्ध करें"
    },
    "server-alerts.create_rule": {
      "title": "अलर्ट नियम बनाएँ"
    },
    "users.list": {
      "title": "पैनल उपयोगकर्ता सूचीबद्ध करें"
    },
    "users.create": {
      "title": "उपयोगकर्ता बनाएँ"
    },
    "users.update": {
      "title": "उपयोगकर्ता संपादित करें"
    },
    "users.delete": {
      "title": "उपयोगकर्ता हटाएँ"
    },
    "users.groups_list": {
      "title": "अनुमतियों के साथ समूह सूचीबद्ध करें"
    },
    "users.group_create": {
      "title": "समूह बनाएँ"
    },
    "users.group_update": {
      "title": "समूह संपादित करें"
    },
    "users.group_delete": {
      "title": "समूह हटाएँ"
    },
    "webhooks.list": {
      "title": "कॉन्फ़िगर किए गए वेबहुक सूचीबद्ध करें"
    }
  },
  "dataPanelCatalog": {
    "admin.health": {
      "title": "सर्वर स्वास्थ्य",
      "description": "जुड़े लक्ष्य की त्वरित पहुँच / लोड जाँच — परिचालन प्रश्नों का उत्तर देने से पहले सिस्टम-प्रॉम्प्ट संदर्भ के रूप में उपयोगी।"
    },
    "dashboard.snapshot": {
      "title": "संक्षिप्त अवलोकन",
      "description": "जुड़े लक्ष्य का संक्षिप्त प्री-प्रॉम्प्ट सारांश: लोड, RAM%, रूट डिस्क%, और कितनी मुख्य सेवाएँ चल रही हैं।"
    },
    "monitor.snapshot": {
      "title": "सिस्टम स्नैपशॉट",
      "description": "जुड़े लक्ष्य का वर्तमान संसाधन सारांश: CPU उपयोग %, लोड औसत, मेमोरी उपयोग / कुल, रूट फ़ाइलसिस्टम उपयोग।"
    },
    "obsidian.vaults_summary": {
      "title": "वॉल्ट सारांश",
      "description": "जुड़े सर्वर पर पंजीकृत Obsidian वॉल्ट उनके पथ, अस्तित्व और मार्कडाउन नोट गिनती के साथ।"
    }
  },
  "structurePanel": {
    "editorLoading": "एडिटर लोड हो रहा है...",
    "loading": "लोड हो रहा है...",
    "createdNotice": "{count} आइटम बनाए गए।",
    "nothingToCreate": "बनाने के लिए कुछ नहीं (पहले से मौजूद है)।",
    "savedNotice": "{rel} सहेजा गया।",
    "noActiveProviders": "कोई AI प्रदाता सक्रिय नहीं है। Providers में एक सक्षम करें।",
    "improvedNotice": "AI से सुधारा गया। diff देखें और पसंद आने पर Save क्लिक करें।",
    "noAiChanges": "AI ने कोई परिवर्तन प्रस्तावित नहीं किया।",
    "structureLoading": "संरचना का विश्लेषण हो रहा है...",
    "retry": "पुनः प्रयास करें",
    "copyAllContent": "सभी सामग्री कॉपी करें",
    "copied": "कॉपी हो गया",
    "copy": "कॉपी करें",
    "downloadFile": "फ़ाइल डाउनलोड करें",
    "download": "डाउनलोड करें",
    "diff": "Diff",
    "originalDiffTitle": "मूल सामग्री से अंतर देखें",
    "back": "वापस",
    "improveContentTitle": "प्रोजेक्ट संदर्भ का उपयोग करके AI से सामग्री सुधारें",
    "improving": "सुधार हो रहा है...",
    "improveWithAi": "AI से सुधारें",
    "cancel": "रद्द करें",
    "saving": "सहेजा जा रहा है...",
    "save": "सहेजें",
    "chooseProvider": "AI प्रदाता चुनें",
    "close": "बंद करें",
    "noModel": "(कोई मॉडल नहीं)",
    "directory": "डायरेक्टरी",
    "structureCount": "संरचना · {count} बनाने के लिए",
    "markMissing": "अनुपस्थित चिह्नित करें",
    "creating": "बनाया जा रहा है...",
    "create": "बनाएँ ({count})",
    "expand": "विस्तार करें",
    "collapse": "संकुचित करें",
    "edit": "संपादित करें",
    "exists": "मौजूद है",
    "createLabel": "बनाएँ",
    "fallbackFilename": "file.txt",
    "structureHints": {
      "claude": "निर्देश, कॉन्फ़िगरेशन, नियम, कमांड, स्किल, एजेंट और हुक जिन्हें Claude Code प्रोजेक्ट डायरेक्टरी से पढ़ता है।",
      "codex": "Codex CLI प्रोजेक्ट गाइड के रूप में AGENTS.md और कॉन्फ़िगरेशन व प्रॉम्प्ट के लिए .codex/ पढ़ता है।",
      "gemini": "Gemini CLI प्रोजेक्ट संदर्भ के रूप में GEMINI.md और कॉन्फ़िगरेशन व कमांड के लिए .gemini/ पढ़ता है।"
    },
    "structureNodes": {
      "CLAUDE.md": "प्रोजेक्ट निर्देश (संदर्भ, कमांड, परंपराएँ)",
      "CLAUDE.local.md": "स्थानीय निर्देश (कमिट न करें; व्यक्तिगत प्राथमिकताएँ)",
      ".mcp.json": "प्रोजेक्ट MCP सर्वर",
      ".claude/settings.json": "प्रोजेक्ट कॉन्फ़िगरेशन (वर्शन-नियंत्रित)",
      ".claude/settings.local.json": "स्थानीय कॉन्फ़िगरेशन (वर्शन-नियंत्रित नहीं)",
      ".claude/rules": "पुन: प्रयोग योग्य नियम",
      ".claude/rules/code-style.md": "नियम: कोड शैली",
      ".claude/rules/testing.md": "नियम: परीक्षण",
      ".claude/rules/api-conventions.md": "नियम: API परंपराएँ",
      ".claude/commands": "कस्टम स्लैश कमांड",
      ".claude/commands/review.md": "/review कमांड",
      ".claude/commands/fix-issue.md": "/fix-issue कमांड",
      ".claude/skills": "प्रोजेक्ट स्किल",
      ".claude/skills/deploy": "स्किल: डिप्लॉय",
      ".claude/skills/deploy/SKILL.md": "डिप्लॉय स्किल परिभाषा",
      ".claude/skills/deploy/deploy-config.md": "डिप्लॉय स्किल कॉन्फ़िगरेशन",
      ".claude/agents": "विशेषीकृत सबएजेंट",
      ".claude/agents/code-reviewer.md": "एजेंट: कोड समीक्षक",
      ".claude/agents/security-auditor.md": "एजेंट: सुरक्षा ऑडिटर",
      ".claude/hooks": "हुक (लाइफ़साइकल स्क्रिप्ट)",
      ".claude/hooks/validate-bash.sh": "हुक: bash कमांड सत्यापित करें",
      "AGENTS.md": "Codex/एजेंट के लिए प्रोजेक्ट गाइड",
      ".codex": "Codex कॉन्फ़िगरेशन",
      ".codex/config.toml": "Codex प्रोजेक्ट कॉन्फ़िगरेशन",
      ".codex/prompts": "पुन: प्रयोग योग्य प्रॉम्प्ट/टेम्पलेट",
      ".codex/prompts/review.md": "प्रॉम्प्ट: कोड समीक्षा",
      "GEMINI.md": "Gemini के लिए प्रोजेक्ट संदर्भ",
      ".gemini": "Gemini कॉन्फ़िगरेशन",
      ".gemini/settings.json": "Gemini प्रोजेक्ट कॉन्फ़िगरेशन",
      ".gemini/commands": "कस्टम कमांड",
      ".gemini/commands/review.toml": "कमांड: समीक्षा",
      "modules/*": "मार्केटप्लेस मॉड्यूल रूट",
      "modules/*/module.manifest.json": "ड्राफ़्ट मैनिफ़ेस्ट (AUTO फ़ील्ड प्लेटफ़ॉर्म द्वारा सेट किए जाते हैं)",
      "modules/*/backend/index.js": "मॉड्यूल बैकएंड — SDK defineModule() स्केलेटन",
      "modules/*/frontend": "मॉड्यूल फ़्रंटएंड (Astro, वैकल्पिक)",
      "modules/*/README.md": "मॉड्यूल README",
      ".claude/rules/marketplace.md": "नियम: मार्केटप्लेस आर्किटेक्चर (मैनिफ़ेस्ट, SDK, क्षमताएँ)",
      "MARKETPLACE.md": "मार्केटप्लेस आर्किटेक्चर नियम (मैनिफ़ेस्ट, SDK, क्षमताएँ)"
    }
  },
  "mcpConfigPanel": {
    "noInstallResponse": "कोई इंस्टॉल प्रतिक्रिया नहीं",
    "summaryTitle": "पैनल क्षमताएँ CLI (MCP) को उजागर करें",
    "optional": "वैकल्पिक",
    "description": "{providerId} CLI को पैनल के टूल से कनेक्ट करें। पैनल कॉन्फ़िगरेशन सीधे लक्ष्य सर्वर पर लिखता है; आपको कुछ भी कॉपी नहीं करना है।",
    "configuredTitle": "लक्ष्य पर कॉन्फ़िगर किया गया",
    "tokenValidUntil": "टोकन {date} तक वैध है।",
    "restartCli": "नया MCP सर्वर लोड करने के लिए टर्मिनल में CLI पुनरारंभ करें।",
    "configuring": "कॉन्फ़िगर हो रहा है...",
    "configureAutomatically": "स्वचालित रूप से कॉन्फ़िगर करें",
    "regenerate": "टोकन पुनः जनरेट करें और पुनः कॉन्फ़िगर करें",
    "manualTitle": "मैनुअल कॉन्फ़िगरेशन (उन्नत)",
    "generating": "जनरेट हो रहा है...",
    "generateManualSnippet": "मैनुअल स्निपेट जनरेट करें",
    "fileLabel": "फ़ाइल",
    "snippetLabel": "स्निपेट ({format})",
    "copy": "कॉपी करें",
    "mcpUrlLabel": "MCP URL"
  },
  "conversationMedia": {
    "download": "डाउनलोड करें",
    "close": "बंद करें",
    "previous": "पिछला",
    "next": "अगला",
    "all": "सभी",
    "images": "छवियाँ",
    "documents": "दस्तावेज़",
    "attachmentsTitle": "बातचीत के अनुलग्नक",
    "emptyConversation": "इस बातचीत में कोई अनुलग्नक नहीं है।",
    "imagesSection": "छवियाँ",
    "documentsSection": "दस्तावेज़",
    "clickToExpand": "विस्तार के लिए क्लिक करें",
    "emptyImages": "कोई छवि नहीं।",
    "emptyDocuments": "कोई दस्तावेज़ नहीं।",
    "mediaTitle": "मीडिया",
    "attachToChat": "चैट में संलग्न करें",
    "uploadToChat": "चैट में फ़ाइलें अपलोड करें",
    "attachFailed": "फ़ाइल को चैट में संलग्न नहीं किया जा सका।"
  },
  "teamBoard": {
    "title": "टीम काम कर रही है",
    "progressOf": "{total} में से {done} कार्य पूर्ण",
    "statusPending": "लंबित",
    "statusRunning": "प्रगति में",
    "statusDone": "पूर्ण",
    "statusFailed": "विफल",
    "statusCanceled": "रद्द",
    "pendingPermission": "आपकी स्वीकृति की प्रतीक्षा में",
    "openChat": "चैट खोलें",
    "cancel": "कार्य रद्द करें",
    "cancelConfirm": "क्या इस कार्य को रद्द करें? एजेंट इस पर काम करना बंद कर देगा।",
    "assignedTo": "{agent} को सौंपा गया",
    "autoTurn": "टीम की स्वचालित सूचना",
    "dashboardTitle": "काम कर रही टीमें",
    "tokensSummary": "टोकन: {total} (लीडर {leader} · टीम {workers})",
    "lessThan1s": "<1 से",
    "insertions": "+{count}",
    "deletions": "-{count}",
    "viewDiff": "Diff देखें",
    "close": "बंद करें",
    "loading": "लोड हो रहा है…",
    "statusQueued": "कतार में",
    "addTaskSubmit": "असाइन करें",
    "verifyPassed": "सत्यापित",
    "verifyFailed": "सत्यापन विफल ({attempts})",
    "filesChanged": "{count} फ़ाइल",
    "diffTitle": "कार्य के बदलाव",
    "diffUnavailable": "इस कार्य के लिए कोई अंतर उपलब्ध नहीं है (वर्कट्री या बदलाव नहीं हैं)।",
    "diffTruncated": "अंतर संक्षिप्त किया गया: कार्य में दिखाए गए से अधिक सामग्री बदली है।",
    "branchIntegrated": "शाखा एकीकृत",
    "cancelAll": "सभी रद्द करें",
    "cancelAllConfirm": "सभी चल रहे कार्य रद्द करें? सक्रिय योजना विफल चिह्नित होगी।",
    "addTask": "कार्य जोड़ें",
    "addTaskTitle": "अधीनस्थ एजेंट को कार्य सौंपें",
    "addTaskWorker": "अधीनस्थ एजेंट",
    "addTaskWorkerPlaceholder": "— एजेंट चुनें —",
    "addTaskNoWorkers": "इस प्रमुख के सीधे अधीन कोई एजेंट नहीं है।",
    "addTaskInstruction": "निर्देश",
    "addTaskInstructionHint": "एजेंट यह बातचीत नहीं देख सकता; पूरा आवश्यक संदर्भ दें।",
    "addTaskTitleField": "शीर्षक (वैकल्पिक)",
    "addTaskProject": "प्रोजेक्ट (वैकल्पिक)",
    "addTaskProjectNone": "— कोई प्रोजेक्ट नहीं —",
    "addTaskSubmitting": "सौंपा जा रहा है…",
    "feedbackUp": "अच्छा परिणाम",
    "feedbackDown": "खराब परिणाम",
    "orgChart": "संगठन चार्ट",
    "tokensChipTitle": "इस कार्य में उपयोग किए गए टोकन",
    "verifyRunning": "सत्यापन चल रहा है…"
  },
  "agentInfo": {
    "roleLabel": "भूमिका",
    "roleTooltip": "एजेंट की भूमिका: {role}",
    "providerLabel": "प्रदाता",
    "providerModelTooltip": "प्रदाता {provider} · मॉडल {model}",
    "projectLabel": "परियोजना",
    "projectTooltip": "परियोजना: {project}"
  },
  "mermaidDiagram": {
    "zoomOut": "ज़ूम आउट",
    "zoomIn": "ज़ूम इन",
    "zoomReset": "ज़ूम रीसेट करें"
  },
  "assistantErrorBoundary": {
    "errorMessage": "असिस्टेंट लोड होते समय एक त्रुटि हुई।",
    "retry": "पुनः प्रयास करें"
  }
} as const;

export default assistantPart3;
