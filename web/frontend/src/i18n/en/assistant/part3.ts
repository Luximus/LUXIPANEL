// Auto-split fragment of assistant.ts (part 3/3) — data only, keeps <1000 lines.
// Do not reorder keys: the aggregator merges parts by spread in original order.
const assistantPart3 = {
  "skillOptions": {
    "ponytail": {
      "mode": {
        "label": "Intensity",
        "choices": {
          "off": "Off",
          "lite": "Lite — suggest the simplest alternative",
          "full": "Full — apply the ladder",
          "ultra": "Ultra — YAGNI extremist"
        }
      }
    },
    "ui-ux-pro-max": {
      "detalle": {
        "label": "Detail",
        "choices": {
          "breve": "Brief (minimal tokens)",
          "completo": "Full (more detail)"
        }
      }
    }
  },
  "toolCatalog": {
    "admin.bash": {
      "title": "Run bash command"
    },
    "admin.restart_service": {
      "title": "Restart systemd service"
    },
    "backup.list_jobs": {
      "title": "List configured backups"
    },
    "bitninja.status": {
      "title": "BitNinja status"
    },
    "cloudflare.status": {
      "title": "Cloudflare status"
    },
    "cloudflare.list_zones": {
      "title": "List Cloudflare zones"
    },
    "cloudflare.list_dns_records": {
      "title": "List DNS records"
    },
    "cloudflare.create_dns_record": {
      "title": "Create DNS record"
    },
    "cloudflare.update_dns_record": {
      "title": "Update DNS record"
    },
    "cloudflare.delete_dns_record": {
      "title": "Delete DNS record"
    },
    "cloudflare.purge_cache": {
      "title": "Purge Cloudflare cache"
    },
    "cloudflare.get_zone_settings": {
      "title": "View zone settings"
    },
    "cloudflare.set_zone_setting": {
      "title": "Change zone setting"
    },
    "cloudflare.list_access_rules": {
      "title": "List IP access rules"
    },
    "cloudflare.block_ip": {
      "title": "Block IP in Cloudflare"
    },
    "cron.list": {
      "title": "List cron jobs"
    },
    "cron.add": {
      "title": "Create cron job"
    },
    "cron.update": {
      "title": "Edit cron job"
    },
    "cron.toggle": {
      "title": "Pause/resume cron job"
    },
    "cron.remove": {
      "title": "Delete cron job"
    },
    "cron.ai_list": {
      "title": "List scheduled AI agents"
    },
    "cron.ai_logs": {
      "title": "List an AI agent's runs"
    },
    "cron.ai_read_log": {
      "title": "Read an AI agent's run"
    },
    "cron.ai_run": {
      "title": "Run a scheduled AI agent now"
    },
    "cron.ai_toggle": {
      "title": "Pause/resume a scheduled AI agent"
    },
    "cron.ai_add": {
      "title": "Create scheduled AI agent"
    },
    "cron.ai_update": {
      "title": "Edit scheduled AI agent"
    },
    "cron.ai_remove": {
      "title": "Delete scheduled AI agent"
    },
    "cron.presets_get": {
      "title": "Read agent configuration (presets)"
    },
    "cron.presets_set": {
      "title": "Save agent configuration (presets)"
    },
    "dashboard.overview": {
      "title": "Server overview"
    },
    "databases.list_engines": {
      "title": "Detect database engines"
    },
    "databases.list_databases": {
      "title": "List databases"
    },
    "databases.list_tables": {
      "title": "List tables"
    },
    "databases.run_query": {
      "title": "Run SQL query"
    },
    "expo.status": {
      "title": "Expo status"
    },
    "expo.account": {
      "title": "Expo account"
    },
    "expo.list_projects": {
      "title": "List Expo projects"
    },
    "expo.project_info": {
      "title": "Project info"
    },
    "expo.init_project": {
      "title": "Create Expo project"
    },
    "expo.link_project": {
      "title": "Link project to EAS"
    },
    "expo.build": {
      "title": "Start EAS build"
    },
    "expo.build_list": {
      "title": "Build history"
    },
    "expo.build_view": {
      "title": "Build status"
    },
    "expo.build_cancel": {
      "title": "Cancel build"
    },
    "expo.submit": {
      "title": "Submit to store"
    },
    "expo.dev_client": {
      "title": "Start dev-client (QR)"
    },
    "expo.quota": {
      "title": "Build quota"
    },
    "expo.update": {
      "title": "Publish OTA update"
    },
    "expo.env_list": {
      "title": "List EAS variables"
    },
    "expo.env_set": {
      "title": "Create EAS variable"
    },
    "expo.set_google_credential": {
      "title": "Play Store credential"
    },
    "expo.set_apple_credential": {
      "title": "App Store credential"
    },
    "expo.webhook_create": {
      "title": "Register EAS webhook"
    },
    "expo.device_create": {
      "title": "Register iOS device"
    },
    "files.read": {
      "title": "Read file"
    },
    "files.list_dir": {
      "title": "List directory"
    },
    "files.grep": {
      "title": "Search in files"
    },
    "files.project_info": {
      "title": "Detect project type"
    },
    "files.security_scan": {
      "title": "Heuristic security scan"
    },
    "files.write": {
      "title": "Write file"
    },
    "files.mkdir": {
      "title": "Create folder"
    },
    "files.delete": {
      "title": "Delete file or folder"
    },
    "files.rename": {
      "title": "Rename or move"
    },
    "files.copy": {
      "title": "Copy file"
    },
    "files.chmod": {
      "title": "Change permissions (chmod)"
    },
    "files.chown": {
      "title": "Change owner (chown)"
    },
    "firewall.ufw_status": {
      "title": "UFW status"
    },
    "firewall.fail2ban_status": {
      "title": "fail2ban status (jails)"
    },
    "hosting.list_accounts": {
      "title": "List hosting accounts"
    },
    "hosting.list_audit": {
      "title": "View a hosting account's audit log"
    },
    "hosting.account_stats": {
      "title": "Hosting account usage stats"
    },
    "mail.list_domains": {
      "title": "Available domains"
    },
    "mail.list_messages": {
      "title": "List mailbox messages"
    },
    "mail.fetch_message": {
      "title": "Read full message"
    },
    "mail.move_messages": {
      "title": "Move messages to quarantine"
    },
    "mail.flag_messages": {
      "title": "Flag messages"
    },
    "mail.delete_messages": {
      "title": "Delete messages (permanent)"
    },
    "module-dev.validate_manifest": {
      "title": "Validate manifest"
    },
    "module-dev.run_checks": {
      "title": "Module static checks"
    },
    "module-dev.run_tests": {
      "title": "Run module tests"
    },
    "module-dev.list_modules": {
      "title": "My marketplace modules"
    },
    "module-dev.module_status": {
      "title": "Module status"
    },
    "module-dev.submit_module": {
      "title": "Submit module for review"
    },
    "module-dev.resubmit_module": {
      "title": "Resubmit corrected module"
    },
    "module-dev.unpublish_module": {
      "title": "Unpublish module"
    },
    "module-dev.republish_module": {
      "title": "Republish module"
    },
    "module-dev.preview_install": {
      "title": "Install preview (Mode B)"
    },
    "module-dev.preview_uninstall": {
      "title": "Uninstall preview"
    },
    "module-dev.link_project": {
      "title": "Link project ↔ module"
    },
    "monitor.cpu_top": {
      "title": "Top CPU processes"
    },
    "monitor.watchdog_status": {
      "title": "Auto-reboot status"
    },
    "monitor.watchdog_configure": {
      "title": "Configure auto-reboot"
    },
    "nginx.list_sites": {
      "title": "List nginx sites"
    },
    "nginx.tail_access_log": {
      "title": "Tail access.log"
    },
    "obsidian.list_vaults": {
      "title": "List vaults"
    },
    "obsidian.list_notes": {
      "title": "List notes"
    },
    "obsidian.read_note": {
      "title": "Read note"
    },
    "obsidian.search_notes": {
      "title": "Search in notes"
    },
    "obsidian.backlinks": {
      "title": "Note backlinks"
    },
    "obsidian.write_note": {
      "title": "Write note"
    },
    "obsidian.append_note": {
      "title": "Append to note"
    },
    "obsidian.daily_note": {
      "title": "Daily note"
    },
    "obsidian.delete_note": {
      "title": "Delete note"
    },
    "obsidian.list_containers": {
      "title": "List context containers"
    },
    "obsidian.sync_containers": {
      "title": "Sync context containers"
    },
    "openclaw.config": {
      "title": "OpenClaw configuration"
    },
    "openclaw.test_connection": {
      "title": "Test OpenClaw connection"
    },
    "security-audit.last_report": {
      "title": "Latest audit report"
    },
    "security-audit.ssh_posture": {
      "title": "Server SSH posture"
    },
    "server-alerts.send": {
      "title": "Send notification to server"
    },
    "server-alerts.list_rules": {
      "title": "List alert rules"
    },
    "server-alerts.create_rule": {
      "title": "Create alert rule"
    },
    "users.list": {
      "title": "List panel users"
    },
    "users.create": {
      "title": "Create user"
    },
    "users.update": {
      "title": "Edit user"
    },
    "users.delete": {
      "title": "Delete user"
    },
    "users.groups_list": {
      "title": "List groups with permissions"
    },
    "users.group_create": {
      "title": "Create group"
    },
    "users.group_update": {
      "title": "Edit group"
    },
    "users.group_delete": {
      "title": "Delete group"
    },
    "webhooks.list": {
      "title": "List configured webhooks"
    }
  },
  "dataPanelCatalog": {
    "admin.health": {
      "title": "Server health",
      "description": "Quick reachability / load probe of the connected target — useful as system-prompt context before answering operational questions."
    },
    "dashboard.snapshot": {
      "title": "Compact overview",
      "description": "Compact pre-prompt summary of the connected target: load, RAM%, root disk%, and how many key services are running."
    },
    "monitor.snapshot": {
      "title": "System snapshot",
      "description": "Current resource summary for the connected target: CPU usage %, load average, memory used / total, root filesystem usage."
    },
    "obsidian.vaults_summary": {
      "title": "Vaults summary",
      "description": "Registered Obsidian vaults on the connected server with their path, existence and markdown note count."
    }
  },
  "structurePanel": {
    "editorLoading": "Loading editor...",
    "loading": "Loading...",
    "createdNotice": "Created {count} item(s).",
    "nothingToCreate": "Nothing to create (already existed).",
    "savedNotice": "Saved {rel}.",
    "noActiveProviders": "No AI provider is active. Enable one in Providers.",
    "improvedNotice": "Improved with AI. Review the diff and click Save if you like it.",
    "noAiChanges": "The AI proposed no changes.",
    "structureLoading": "Analyzing structure...",
    "retry": "Retry",
    "copyAllContent": "Copy all content",
    "copied": "Copied",
    "copy": "Copy",
    "downloadFile": "Download file",
    "download": "Download",
    "diff": "Diff",
    "originalDiffTitle": "View differences against the original content",
    "back": "Back",
    "improveContentTitle": "Improve the content with AI using the project context",
    "improving": "Improving...",
    "improveWithAi": "Improve with AI",
    "cancel": "Cancel",
    "saving": "Saving...",
    "save": "Save",
    "chooseProvider": "Choose the AI provider",
    "close": "Close",
    "noModel": "(no model)",
    "directory": "Directory",
    "structureCount": "Structure · {count} to create",
    "markMissing": "Mark missing",
    "creating": "Creating...",
    "create": "Create ({count})",
    "expand": "Expand",
    "collapse": "Collapse",
    "edit": "Edit",
    "exists": "Exists",
    "createLabel": "create",
    "fallbackFilename": "file.txt",
    "structureHints": {
      "claude": "Instructions, configuration, rules, commands, skills, agents and hooks that Claude Code reads from the project directory.",
      "codex": "Codex CLI reads AGENTS.md as the project guide and .codex/ for configuration and prompts.",
      "gemini": "Gemini CLI reads GEMINI.md as project context and .gemini/ for configuration and commands."
    },
    "structureNodes": {
      "CLAUDE.md": "Project instructions (context, commands, conventions)",
      "CLAUDE.local.md": "Local instructions (do not commit; personal preferences)",
      ".mcp.json": "Project MCP servers",
      ".claude/settings.json": "Project configuration (versioned)",
      ".claude/settings.local.json": "Local configuration (not versioned)",
      ".claude/rules": "Reusable rules",
      ".claude/rules/code-style.md": "Rule: code style",
      ".claude/rules/testing.md": "Rule: testing",
      ".claude/rules/api-conventions.md": "Rule: API conventions",
      ".claude/commands": "Custom slash commands",
      ".claude/commands/review.md": "/review command",
      ".claude/commands/fix-issue.md": "/fix-issue command",
      ".claude/skills": "Project skills",
      ".claude/skills/deploy": "Skill: deploy",
      ".claude/skills/deploy/SKILL.md": "Deploy skill definition",
      ".claude/skills/deploy/deploy-config.md": "Deploy skill configuration",
      ".claude/agents": "Specialized subagents",
      ".claude/agents/code-reviewer.md": "Agent: code reviewer",
      ".claude/agents/security-auditor.md": "Agent: security auditor",
      ".claude/hooks": "Hooks (lifecycle scripts)",
      ".claude/hooks/validate-bash.sh": "Hook: validate bash commands",
      "AGENTS.md": "Project guide for Codex/agents",
      ".codex": "Codex configuration",
      ".codex/config.toml": "Codex project configuration",
      ".codex/prompts": "Reusable prompts/templates",
      ".codex/prompts/review.md": "Prompt: code review",
      "GEMINI.md": "Project context for Gemini",
      ".gemini": "Gemini configuration",
      ".gemini/settings.json": "Gemini project configuration",
      ".gemini/commands": "Custom commands",
      ".gemini/commands/review.toml": "Command: review",
      "modules/*": "Marketplace module root",
      "modules/*/module.manifest.json": "Draft manifest (AUTO fields are set by the platform)",
      "modules/*/backend/index.js": "Module backend — SDK defineModule() skeleton",
      "modules/*/frontend": "Module frontend (Astro, optional)",
      "modules/*/README.md": "Module README",
      ".claude/rules/marketplace.md": "Rule: marketplace architecture (manifest, SDK, capabilities)",
      "MARKETPLACE.md": "Marketplace architecture rules (manifest, SDK, capabilities)"
    }
  },
  "mcpConfigPanel": {
    "noInstallResponse": "No install response",
    "summaryTitle": "Expose panel capabilities to the CLI (MCP)",
    "optional": "optional",
    "description": "Connect the {providerId} CLI with the panel's tools. The panel writes the configuration directly on the target server; you don't have to copy anything.",
    "configuredTitle": "Configured on the target",
    "tokenValidUntil": "Token valid until {date}.",
    "restartCli": "Restart the CLI in the terminal so it loads the new MCP server.",
    "configuring": "Configuring...",
    "configureAutomatically": "Configure automatically",
    "regenerate": "Regenerate token and reconfigure",
    "manualTitle": "Manual configuration (advanced)",
    "generating": "Generating...",
    "generateManualSnippet": "Generate manual snippet",
    "fileLabel": "File",
    "snippetLabel": "Snippet ({format})",
    "copy": "Copy",
    "mcpUrlLabel": "MCP URL"
  },
  "conversationMedia": {
    "download": "Download",
    "close": "Close",
    "previous": "Previous",
    "next": "Next",
    "all": "All",
    "images": "Images",
    "documents": "Documents",
    "attachmentsTitle": "Conversation attachments",
    "mediaTitle": "Media",
    "emptyConversation": "No attachments in this conversation.",
    "imagesSection": "Images",
    "documentsSection": "Documents",
    "clickToExpand": "click to expand",
    "emptyImages": "No images.",
    "emptyDocuments": "No documents.",
    "uploadToChat": "Upload files to chat",
    "attachToChat": "Attach to chat",
    "attachFailed": "Could not attach the file to the chat."
  },
  "teamBoard": {
    "showMoreTasks": "Show more tasks ({count})",
    "showFewerTasks": "Show fewer tasks",
    "title": "Team at work",
    "progressOf": "{done} of {total} tasks completed",
    "statusPending": "Pending",
    "statusRunning": "In progress",
    "statusDone": "Done",
    "statusFailed": "Failed",
    "statusCanceled": "Canceled",
    "pendingPermission": "Waiting for your approval",
    "openChat": "Open chat",
    "cancel": "Cancel task",
    "cancelConfirm": "Cancel this task? The agent will stop working on it.",
    "assignedTo": "Assigned to {agent}",
    "autoTurn": "Automatic team update",
    "dashboardTitle": "Teams at work",
    "tokensSummary": "Tokens: {total} (leader {leader} · team {workers})",
    "statusQueued": "Queued",
    "verifyRunning": "Verifying…",
    "verifyPassed": "Verified",
    "verifyFailed": "Verification failed ({attempts})",
    "filesChanged": "{count} file(s)",
    "viewDiff": "View diff",
    "diffTitle": "Task changes",
    "diffUnavailable": "No diff is available for this task (no worktree or no changes).",
    "diffTruncated": "Diff truncated: the task changed more content than shown.",
    "branchIntegrated": "Branch integrated",
    "cancelAll": "Cancel all",
    "cancelAllConfirm": "Cancel ALL ongoing tasks? The active plan will be marked as failed.",
    "addTask": "Add task",
    "addTaskTitle": "Assign a task to a subordinate",
    "addTaskWorker": "Subordinate",
    "addTaskWorkerPlaceholder": "— Choose agent —",
    "addTaskNoWorkers": "This leader has no direct subordinates.",
    "addTaskInstruction": "Instruction",
    "addTaskInstructionHint": "The worker cannot see this conversation; include ALL necessary context.",
    "addTaskTitleField": "Title (optional)",
    "addTaskProject": "Project (optional)",
    "addTaskProjectNone": "— No project —",
    "addTaskSubmit": "Assign",
    "addTaskSubmitting": "Assigning…",
    "feedbackUp": "Good result",
    "feedbackDown": "Poor result",
    "orgChart": "Organization chart",
    "close": "Close",
    "loading": "Loading…",
    "tokensChipTitle": "Tokens used by this task",
    "lessThan1s": "<1s",
    "insertions": "+{count}",
    "deletions": "-{count}"
  },
  "agentInfo": {
    "roleLabel": "Role",
    "roleTooltip": "Agent role: {role}",
    "providerLabel": "Provider",
    "providerModelTooltip": "Provider {provider} · Model {model}",
    "projectLabel": "Project",
    "projectTooltip": "Project: {project}"
  },
  "mermaidDiagram": {
    "zoomOut": "Zoom out",
    "zoomIn": "Zoom in",
    "zoomReset": "Reset zoom"
  },
  "assistantErrorBoundary": {
    "errorMessage": "The assistant had an error while loading.",
    "retry": "Retry"
  },
} as const;

export default assistantPart3;
