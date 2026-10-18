const assistantPart3 = {
  "skillOptions": {
    "ponytail": {
      "mode": {
        "label": "الحدّة",
        "choices": {
          "off": "معطّل",
          "lite": "خفيف — اقترح أبسط بديل",
          "full": "كامل — طبّق السلّم",
          "ultra": "أقصى — متطرف في مبدأ YAGNI"
        }
      }
    },
    "ui-ux-pro-max": {
      "detalle": {
        "label": "التفصيل",
        "choices": {
          "breve": "مختصر (رموز أقل)",
          "completo": "كامل (تفصيل أكثر)"
        }
      }
    }
  },
  "toolCatalog": {
    "admin.bash": {
      "title": "تشغيل أمر bash"
    },
    "admin.restart_service": {
      "title": "إعادة تشغيل خدمة systemd"
    },
    "backup.list_jobs": {
      "title": "قائمة النسخ الاحتياطية المُهيأة"
    },
    "bitninja.status": {
      "title": "حالة BitNinja"
    },
    "cloudflare.status": {
      "title": "حالة Cloudflare"
    },
    "cloudflare.list_zones": {
      "title": "قائمة مناطق Cloudflare"
    },
    "cloudflare.list_dns_records": {
      "title": "قائمة سجلات DNS"
    },
    "cloudflare.create_dns_record": {
      "title": "إنشاء سجل DNS"
    },
    "cloudflare.update_dns_record": {
      "title": "تعديل سجل DNS"
    },
    "cloudflare.delete_dns_record": {
      "title": "حذف سجل DNS"
    },
    "cloudflare.purge_cache": {
      "title": "مسح ذاكرة Cloudflare المؤقتة"
    },
    "cloudflare.get_zone_settings": {
      "title": "عرض إعدادات المنطقة"
    },
    "cloudflare.set_zone_setting": {
      "title": "تغيير إعداد المنطقة"
    },
    "cloudflare.list_access_rules": {
      "title": "قائمة قواعد وصول IP"
    },
    "cloudflare.block_ip": {
      "title": "حجب IP في Cloudflare"
    },
    "cron.list": {
      "title": "قائمة مهام cron"
    },
    "cron.add": {
      "title": "إنشاء مهمة cron"
    },
    "cron.update": {
      "title": "تعديل مهمة cron"
    },
    "cron.toggle": {
      "title": "إيقاف/استئناف مهمة cron"
    },
    "cron.remove": {
      "title": "حذف مهمة cron"
    },
    "cron.ai_list": {
      "title": "قائمة وكلاء AI المجدولة"
    },
    "cron.ai_logs": {
      "title": "قائمة تشغيلات وكيل AI"
    },
    "cron.ai_read_log": {
      "title": "قراءة تشغيل وكيل AI"
    },
    "cron.ai_run": {
      "title": "تشغيل وكيل AI مجدول الآن"
    },
    "cron.ai_toggle": {
      "title": "إيقاف/استئناف وكيل AI مجدول"
    },
    "cron.ai_add": {
      "title": "إنشاء وكيل AI مجدول"
    },
    "cron.ai_update": {
      "title": "تعديل وكيل AI مجدول"
    },
    "cron.ai_remove": {
      "title": "حذف وكيل AI مجدول"
    },
    "cron.presets_get": {
      "title": "قراءة إعدادات الوكيل (presets)"
    },
    "cron.presets_set": {
      "title": "حفظ إعدادات الوكيل (presets)"
    },
    "dashboard.overview": {
      "title": "نظرة عامة على الخادم"
    },
    "databases.list_engines": {
      "title": "اكتشاف محركات قواعد البيانات"
    },
    "databases.list_databases": {
      "title": "قائمة قواعد البيانات"
    },
    "databases.list_tables": {
      "title": "قائمة الجداول"
    },
    "databases.run_query": {
      "title": "تنفيذ استعلام SQL"
    },
    "expo.status": {
      "title": "حالة Expo"
    },
    "expo.account": {
      "title": "حساب Expo"
    },
    "expo.list_projects": {
      "title": "قائمة مشاريع Expo"
    },
    "expo.project_info": {
      "title": "معلومات المشروع"
    },
    "expo.init_project": {
      "title": "إنشاء مشروع Expo"
    },
    "expo.link_project": {
      "title": "ربط المشروع بـ EAS"
    },
    "expo.build": {
      "title": "بدء بناء EAS"
    },
    "expo.build_list": {
      "title": "سجل البناء"
    },
    "expo.build_view": {
      "title": "حالة البناء"
    },
    "expo.build_cancel": {
      "title": "إلغاء البناء"
    },
    "expo.submit": {
      "title": "إرسال إلى المتجر"
    },
    "expo.dev_client": {
      "title": "تشغيل dev-client (QR)"
    },
    "expo.quota": {
      "title": "حصة البناء"
    },
    "expo.update": {
      "title": "نشر تحديث OTA"
    },
    "expo.env_list": {
      "title": "قائمة متغيرات EAS"
    },
    "expo.env_set": {
      "title": "إنشاء متغير EAS"
    },
    "expo.set_google_credential": {
      "title": "بيانات اعتماد Play Store"
    },
    "expo.set_apple_credential": {
      "title": "بيانات اعتماد App Store"
    },
    "expo.webhook_create": {
      "title": "تسجيل EAS webhook"
    },
    "expo.device_create": {
      "title": "تسجيل جهاز iOS"
    },
    "files.read": {
      "title": "قراءة ملف"
    },
    "files.list_dir": {
      "title": "عرض المجلد"
    },
    "files.grep": {
      "title": "البحث في الملفات"
    },
    "files.project_info": {
      "title": "اكتشاف نوع المشروع"
    },
    "files.security_scan": {
      "title": "فحص أمني إرشادي"
    },
    "files.write": {
      "title": "كتابة ملف"
    },
    "files.mkdir": {
      "title": "إنشاء مجلد"
    },
    "files.delete": {
      "title": "حذف ملف أو مجلد"
    },
    "files.rename": {
      "title": "إعادة التسمية أو النقل"
    },
    "files.copy": {
      "title": "نسخ ملف"
    },
    "files.chmod": {
      "title": "تغيير الأذونات (chmod)"
    },
    "files.chown": {
      "title": "تغيير المالك (chown)"
    },
    "firewall.ufw_status": {
      "title": "حالة UFW"
    },
    "firewall.fail2ban_status": {
      "title": "حالة fail2ban (السجون)"
    },
    "hosting.list_accounts": {
      "title": "قائمة حسابات الاستضافة"
    },
    "hosting.list_audit": {
      "title": "عرض سجل تدقيق حساب الاستضافة"
    },
    "hosting.account_stats": {
      "title": "إحصاءات استخدام حساب الاستضافة"
    },
    "mail.list_domains": {
      "title": "النطاقات المتاحة"
    },
    "mail.list_messages": {
      "title": "قائمة رسائل صندوق البريد"
    },
    "mail.fetch_message": {
      "title": "قراءة الرسالة كاملة"
    },
    "mail.move_messages": {
      "title": "نقل الرسائل إلى الحجر الصحي"
    },
    "mail.flag_messages": {
      "title": "وضع علامة على الرسائل"
    },
    "mail.delete_messages": {
      "title": "حذف الرسائل (نهائي)"
    },
    "module-dev.validate_manifest": {
      "title": "التحقق من صحة الملف التعريفي"
    },
    "module-dev.run_checks": {
      "title": "فحوصات الوحدة الثابتة"
    },
    "module-dev.run_tests": {
      "title": "تشغيل اختبارات الوحدة"
    },
    "module-dev.list_modules": {
      "title": "وحداتي في السوق"
    },
    "module-dev.module_status": {
      "title": "حالة الوحدة"
    },
    "module-dev.submit_module": {
      "title": "إرسال الوحدة للمراجعة"
    },
    "module-dev.resubmit_module": {
      "title": "إعادة إرسال الوحدة المُصحَّحة"
    },
    "module-dev.unpublish_module": {
      "title": "إلغاء نشر الوحدة"
    },
    "module-dev.republish_module": {
      "title": "إعادة نشر الوحدة"
    },
    "module-dev.preview_install": {
      "title": "تثبيت المعاينة (Mode B)"
    },
    "module-dev.preview_uninstall": {
      "title": "إلغاء تثبيت المعاينة"
    },
    "module-dev.link_project": {
      "title": "ربط المشروع ↔ الوحدة"
    },
    "monitor.cpu_top": {
      "title": "أعلى عمليات CPU"
    },
    "monitor.watchdog_status": {
      "title": "حالة إعادة التشغيل التلقائي"
    },
    "monitor.watchdog_configure": {
      "title": "إعداد إعادة التشغيل التلقائي"
    },
    "nginx.list_sites": {
      "title": "قائمة مواقع nginx"
    },
    "nginx.tail_access_log": {
      "title": "متابعة access.log"
    },
    "obsidian.list_vaults": {
      "title": "قائمة الخزائن"
    },
    "obsidian.list_notes": {
      "title": "قائمة الملاحظات"
    },
    "obsidian.read_note": {
      "title": "قراءة ملاحظة"
    },
    "obsidian.search_notes": {
      "title": "البحث في الملاحظات"
    },
    "obsidian.backlinks": {
      "title": "روابط خلفية للملاحظة"
    },
    "obsidian.write_note": {
      "title": "كتابة ملاحظة"
    },
    "obsidian.append_note": {
      "title": "إضافة إلى ملاحظة"
    },
    "obsidian.daily_note": {
      "title": "الملاحظة اليومية"
    },
    "obsidian.delete_note": {
      "title": "حذف ملاحظة"
    },
    "obsidian.list_containers": {
      "title": "قائمة حاويات السياق"
    },
    "obsidian.sync_containers": {
      "title": "مزامنة حاويات السياق"
    },
    "openclaw.config": {
      "title": "إعداد OpenClaw"
    },
    "openclaw.test_connection": {
      "title": "اختبار اتصال OpenClaw"
    },
    "security-audit.last_report": {
      "title": "آخر تقرير تدقيق"
    },
    "security-audit.ssh_posture": {
      "title": "وضع SSH للخادم"
    },
    "server-alerts.send": {
      "title": "إرسال إشعار إلى الخادم"
    },
    "server-alerts.list_rules": {
      "title": "قائمة قواعد التنبيهات"
    },
    "server-alerts.create_rule": {
      "title": "إنشاء قاعدة تنبيه"
    },
    "users.list": {
      "title": "قائمة مستخدمي اللوحة"
    },
    "users.create": {
      "title": "إنشاء مستخدم"
    },
    "users.update": {
      "title": "تعديل مستخدم"
    },
    "users.delete": {
      "title": "حذف مستخدم"
    },
    "users.groups_list": {
      "title": "قائمة المجموعات مع الأذونات"
    },
    "users.group_create": {
      "title": "إنشاء مجموعة"
    },
    "users.group_update": {
      "title": "تعديل مجموعة"
    },
    "users.group_delete": {
      "title": "حذف مجموعة"
    },
    "webhooks.list": {
      "title": "قائمة webhooks المُهيأة"
    }
  },
  "dataPanelCatalog": {
    "admin.health": {
      "title": "صحة الخادم",
      "description": "فحص سريع للإمكانية والحِمل للهدف المتصل — مفيد كسياق للطلب النظامي قبل الإجابة على الأسئلة التشغيلية."
    },
    "dashboard.snapshot": {
      "title": "نظرة عامة مضغوطة",
      "description": "ملخص طلب أولي مضغوط للهدف المتصل: الحِمل، RAM%، مساحة القرص الجذر%، وعدد الخدمات الرئيسية الجارية."
    },
    "monitor.snapshot": {
      "title": "لقطة النظام",
      "description": "ملخص الموارد الحالية للهدف المتصل: استخدام CPU%، متوسط الحِمل، الذاكرة المستخدمة/الكلية، استخدام نظام الملفات الجذر."
    },
    "obsidian.vaults_summary": {
      "title": "ملخص الخزائن",
      "description": "خزائن Obsidian المسجّلة على الخادم المتصل مع مسارها ووجودها وعدد ملاحظات markdown."
    }
  },
  "structurePanel": {
    "editorLoading": "جارٍ تحميل المحرر...",
    "loading": "جارٍ التحميل...",
    "createdNotice": "تم إنشاء {count} عنصر(عناصر).",
    "nothingToCreate": "لا شيء لإنشائه (موجود بالفعل).",
    "savedNotice": "تم الحفظ {rel}.",
    "noActiveProviders": "لا يوجد مزود AI نشط. فعّل أحدهم في Providers.",
    "improvedNotice": "تم التحسين بالذكاء الاصطناعي. راجع الفروق وانقر حفظ إذا أعجبك.",
    "noAiChanges": "لم يقترح الذكاء الاصطناعي أي تغييرات.",
    "structureLoading": "جارٍ تحليل البنية...",
    "retry": "إعادة المحاولة",
    "copyAllContent": "نسخ كل المحتوى",
    "copied": "تم النسخ",
    "copy": "نسخ",
    "downloadFile": "تنزيل الملف",
    "download": "تنزيل",
    "diff": "Diff",
    "originalDiffTitle": "عرض الفروق مقارنةً بالمحتوى الأصلي",
    "back": "رجوع",
    "improveContentTitle": "تحسين المحتوى بالذكاء الاصطناعي باستخدام سياق المشروع",
    "improving": "جارٍ التحسين...",
    "improveWithAi": "تحسين بالذكاء الاصطناعي",
    "cancel": "إلغاء",
    "saving": "جارٍ الحفظ...",
    "save": "حفظ",
    "chooseProvider": "اختر مزود الذكاء الاصطناعي",
    "close": "إغلاق",
    "noModel": "(لا يوجد نموذج)",
    "directory": "مجلد",
    "structureCount": "البنية · {count} للإنشاء",
    "markMissing": "تحديد المفقودات",
    "creating": "جارٍ الإنشاء...",
    "create": "إنشاء ({count})",
    "expand": "توسيع",
    "collapse": "طي",
    "edit": "تعديل",
    "exists": "موجود",
    "createLabel": "إنشاء",
    "fallbackFilename": "file.txt",
    "structureHints": {
      "claude": "تعليمات وإعدادات وقواعد وأوامر ومهارات ووكلاء وخطافات يقرأها Claude Code من دليل المشروع.",
      "codex": "يقرأ Codex CLI ملف AGENTS.md كدليل للمشروع و.codex/ للإعدادات والمطالبات.",
      "gemini": "يقرأ Gemini CLI ملف GEMINI.md كسياق للمشروع و.gemini/ للإعدادات والأوامر."
    },
    "structureNodes": {
      "CLAUDE.md": "تعليمات المشروع (السياق، الأوامر، الاصطلاحات)",
      "CLAUDE.local.md": "تعليمات محلية (لا تُرفع؛ تفضيلات شخصية)",
      ".mcp.json": "خوادم MCP الخاصة بالمشروع",
      ".claude/settings.json": "إعدادات المشروع (خاضعة لإدارة الإصدارات)",
      ".claude/settings.local.json": "إعدادات محلية (غير خاضعة لإدارة الإصدارات)",
      ".claude/rules": "قواعد قابلة لإعادة الاستخدام",
      ".claude/rules/code-style.md": "قاعدة: نمط الكود",
      ".claude/rules/testing.md": "قاعدة: الاختبار",
      ".claude/rules/api-conventions.md": "قاعدة: اصطلاحات API",
      ".claude/commands": "أوامر شرطة مائلة مخصصة",
      ".claude/commands/review.md": "أمر /review",
      ".claude/commands/fix-issue.md": "أمر /fix-issue",
      ".claude/skills": "مهارات المشروع",
      ".claude/skills/deploy": "مهارة: النشر",
      ".claude/skills/deploy/SKILL.md": "تعريف مهارة النشر",
      ".claude/skills/deploy/deploy-config.md": "إعدادات مهارة النشر",
      ".claude/agents": "وكلاء فرعيون متخصصون",
      ".claude/agents/code-reviewer.md": "وكيل: مراجع الكود",
      ".claude/agents/security-auditor.md": "وكيل: مدقق الأمان",
      ".claude/hooks": "خطافات (سكربتات دورة الحياة)",
      ".claude/hooks/validate-bash.sh": "خطاف: التحقق من أوامر bash",
      "AGENTS.md": "دليل المشروع لـ Codex/الوكلاء",
      ".codex": "إعدادات Codex",
      ".codex/config.toml": "إعدادات مشروع Codex",
      ".codex/prompts": "مطالبات/قوالب قابلة لإعادة الاستخدام",
      ".codex/prompts/review.md": "مطالبة: مراجعة الكود",
      "GEMINI.md": "سياق المشروع لـ Gemini",
      ".gemini": "إعدادات Gemini",
      ".gemini/settings.json": "إعدادات مشروع Gemini",
      ".gemini/commands": "أوامر مخصصة",
      ".gemini/commands/review.toml": "أمر: review",
      "modules/*": "جذر وحدة السوق",
      "modules/*/module.manifest.json": "بيان مسودة (حقول AUTO تحددها المنصة)",
      "modules/*/backend/index.js": "الخلفية للوحدة — هيكل SDK defineModule()",
      "modules/*/frontend": "واجهة الوحدة الأمامية (Astro، اختياري)",
      "modules/*/README.md": "ملف README للوحدة",
      ".claude/rules/marketplace.md": "قاعدة: بنية السوق (البيان، SDK، القدرات)",
      "MARKETPLACE.md": "قواعد بنية السوق (البيان، SDK، القدرات)"
    }
  },
  "mcpConfigPanel": {
    "noInstallResponse": "لا توجد استجابة تثبيت",
    "summaryTitle": "كشف قدرات اللوحة لـ CLI (MCP)",
    "optional": "اختياري",
    "description": "ربط CLI الخاص بـ {providerId} بأدوات اللوحة. تكتب اللوحة الإعداد مباشرةً على الخادم الهدف؛ لا تحتاج إلى نسخ أي شيء.",
    "configuredTitle": "مُعدَّد على الهدف",
    "tokenValidUntil": "الرمز صالح حتى {date}.",
    "restartCli": "أعد تشغيل CLI في الطرفية لتحميل خادم MCP الجديد.",
    "configuring": "جارٍ الإعداد...",
    "configureAutomatically": "إعداد تلقائي",
    "regenerate": "إعادة توليد الرمز وإعادة الإعداد",
    "manualTitle": "الإعداد اليدوي (متقدم)",
    "generating": "جارٍ التوليد...",
    "generateManualSnippet": "توليد مقطع يدوي",
    "fileLabel": "ملف",
    "snippetLabel": "مقطع ({format})",
    "copy": "نسخ",
    "mcpUrlLabel": "MCP URL"
  },
  "conversationMedia": {
    "download": "تنزيل",
    "close": "إغلاق",
    "previous": "السابق",
    "next": "التالي",
    "all": "الكل",
    "images": "صور",
    "documents": "مستندات",
    "attachmentsTitle": "مرفقات المحادثة",
    "emptyConversation": "لا توجد مرفقات في هذه المحادثة.",
    "imagesSection": "صور",
    "documentsSection": "مستندات",
    "clickToExpand": "انقر للتوسيع",
    "emptyImages": "لا توجد صور.",
    "emptyDocuments": "لا توجد مستندات.",
    "mediaTitle": "الوسائط",
    "attachToChat": "إرفاق بالمحادثة",
    "uploadToChat": "رفع ملفات إلى المحادثة",
    "attachFailed": "تعذّر إرفاق الملف بالمحادثة."
  },
  "teamBoard": {
    "showMoreTasks": "عرض المزيد من المهام ({count})",
    "showFewerTasks": "عرض مهام أقل",
    "title": "الفريق يعمل",
    "progressOf": "اكتملت {done} من {total} مهام",
    "statusPending": "قيد الانتظار",
    "statusRunning": "قيد التنفيذ",
    "statusDone": "منجزة",
    "statusFailed": "فشلت",
    "statusCanceled": "ملغاة",
    "pendingPermission": "بانتظار موافقتك",
    "openChat": "فتح المحادثة",
    "cancel": "إلغاء المهمة",
    "cancelConfirm": "هل تريد إلغاء هذه المهمة؟ سيتوقف الوكيل عن العمل عليها.",
    "assignedTo": "مسندة إلى {agent}",
    "autoTurn": "إشعار تلقائي من الفريق",
    "dashboardTitle": "فرق تعمل",
    "tokensSummary": "الرموز: {total} (القائد {leader} · الفريق {workers})",
    "lessThan1s": "أقل من ثانية",
    "insertions": "+{count}",
    "deletions": "-{count}",
    "viewDiff": "عرض الفرق",
    "close": "إغلاق",
    "loading": "جارٍ التحميل…",
    "statusQueued": "في قائمة الانتظار",
    "verifyRunning": "جارٍ التحقق…",
    "addTaskSubmit": "تعيين",
    "verifyPassed": "تم التحقق",
    "verifyFailed": "فشل التحقق ({attempts})",
    "filesChanged": "{count} ملف",
    "diffTitle": "تغييرات المهمة",
    "diffUnavailable": "لا توجد فروق متاحة لهذه المهمة (لا توجد شجرة عمل أو تغييرات).",
    "diffTruncated": "تم اقتطاع الفروق: غيّرت المهمة محتوى أكثر مما يظهر.",
    "branchIntegrated": "تم دمج الفرع",
    "cancelAll": "إلغاء الكل",
    "cancelAllConfirm": "هل تريد إلغاء جميع المهام الجارية؟ ستُعلّم الخطة النشطة على أنها فاشلة.",
    "addTask": "إضافة مهمة",
    "addTaskTitle": "إسناد مهمة إلى وكيل تابع",
    "addTaskWorker": "الوكيل التابع",
    "addTaskWorkerPlaceholder": "— اختر وكيلاً —",
    "addTaskNoWorkers": "ليس لهذا القائد وكلاء تابعون مباشرة.",
    "addTaskInstruction": "التعليمات",
    "addTaskInstructionHint": "لا يرى الوكيل هذه المحادثة؛ أدرج كل السياق اللازم.",
    "addTaskTitleField": "العنوان (اختياري)",
    "addTaskProject": "المشروع (اختياري)",
    "addTaskProjectNone": "— بلا مشروع —",
    "addTaskSubmitting": "جارٍ الإسناد…",
    "feedbackUp": "نتيجة جيدة",
    "feedbackDown": "نتيجة سيئة",
    "orgChart": "المخطط التنظيمي",
    "tokensChipTitle": "الرموز المستخدمة في هذه المهمة"
  },
  "agentInfo": {
    "roleLabel": "الدور",
    "roleTooltip": "دور الوكيل: {role}",
    "providerLabel": "المزوّد",
    "providerModelTooltip": "المزوّد {provider} · النموذج {model}",
    "projectLabel": "المشروع",
    "projectTooltip": "المشروع: {project}"
  },
  "mermaidDiagram": {
    "zoomOut": "تصغير",
    "zoomIn": "تكبير",
    "zoomReset": "إعادة تعيين التكبير"
  },
  "assistantErrorBoundary": {
    "errorMessage": "حدث خطأ في المساعد أثناء التحميل.",
    "retry": "إعادة المحاولة"
  }
} as const;

export default assistantPart3;
