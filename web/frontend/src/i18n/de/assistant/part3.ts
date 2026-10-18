const assistantPart3 = {
  "skillOptions": {
    "ponytail": {
      "mode": {
        "label": "Intensität",
        "choices": {
          "off": "Aus",
          "lite": "Lite — schlägt die einfachste Alternative vor",
          "full": "Full — wendet die Leiter an",
          "ultra": "Ultra — YAGNI-Extremist"
        }
      }
    },
    "ui-ux-pro-max": {
      "detalle": {
        "label": "Detail",
        "choices": {
          "breve": "Kurz (minimale Tokens)",
          "completo": "Vollständig (mehr Detail)"
        }
      }
    }
  },
  "toolCatalog": {
    "admin.bash": {
      "title": "Bash-Befehl ausführen"
    },
    "admin.restart_service": {
      "title": "Systemd-Service neustarten"
    },
    "backup.list_jobs": {
      "title": "Konfigurierte Backups auflisten"
    },
    "bitninja.status": {
      "title": "BitNinja-Status"
    },
    "cloudflare.status": {
      "title": "Cloudflare-Status"
    },
    "cloudflare.list_zones": {
      "title": "Cloudflare-Zonen auflisten"
    },
    "cloudflare.list_dns_records": {
      "title": "DNS-Records auflisten"
    },
    "cloudflare.create_dns_record": {
      "title": "DNS-Record erstellen"
    },
    "cloudflare.update_dns_record": {
      "title": "DNS-Record aktualisieren"
    },
    "cloudflare.delete_dns_record": {
      "title": "DNS-Record löschen"
    },
    "cloudflare.purge_cache": {
      "title": "Cloudflare-Cache leeren"
    },
    "cloudflare.get_zone_settings": {
      "title": "Zoneneinstellungen anzeigen"
    },
    "cloudflare.set_zone_setting": {
      "title": "Zoneneinstellung ändern"
    },
    "cloudflare.list_access_rules": {
      "title": "IP-Zugriff Regeln auflisten"
    },
    "cloudflare.block_ip": {
      "title": "IP in Cloudflare blockieren"
    },
    "cron.list": {
      "title": "Cron-Jobs auflisten"
    },
    "cron.add": {
      "title": "Cron-Job erstellen"
    },
    "cron.update": {
      "title": "Cron-Job bearbeiten"
    },
    "cron.toggle": {
      "title": "Cron-Job pausieren/fortsetzen"
    },
    "cron.remove": {
      "title": "Cron-Job löschen"
    },
    "cron.ai_list": {
      "title": "Geplante KI-Agenten auflisten"
    },
    "cron.ai_logs": {
      "title": "Ausführungen eines KI-Agenten auflisten"
    },
    "cron.ai_read_log": {
      "title": "Ausführung eines KI-Agenten lesen"
    },
    "cron.ai_run": {
      "title": "Einen geplanten KI-Agenten jetzt ausführen"
    },
    "cron.ai_toggle": {
      "title": "Einen geplanten KI-Agenten pausieren/fortsetzen"
    },
    "cron.ai_add": {
      "title": "Einen geplanten KI-Agenten erstellen"
    },
    "cron.ai_update": {
      "title": "Einen geplanten KI-Agenten bearbeiten"
    },
    "cron.ai_remove": {
      "title": "Einen geplanten KI-Agenten löschen"
    },
    "cron.presets_get": {
      "title": "Agent-Konfiguration lesen (Presets)"
    },
    "cron.presets_set": {
      "title": "Agent-Konfiguration speichern (Presets)"
    },
    "dashboard.overview": {
      "title": "Server-Übersicht"
    },
    "databases.list_engines": {
      "title": "Datenbank-Engines erkennen"
    },
    "databases.list_databases": {
      "title": "Datenbanken auflisten"
    },
    "databases.list_tables": {
      "title": "Tabellen auflisten"
    },
    "databases.run_query": {
      "title": "SQL-Abfrage ausführen"
    },
    "expo.status": {
      "title": "Expo-Status"
    },
    "expo.account": {
      "title": "Expo-Konto"
    },
    "expo.list_projects": {
      "title": "Expo-Projekte auflisten"
    },
    "expo.project_info": {
      "title": "Projektinfo"
    },
    "expo.init_project": {
      "title": "Expo-Projekt erstellen"
    },
    "expo.link_project": {
      "title": "Projekt mit EAS verknüpfen"
    },
    "expo.build": {
      "title": "EAS-Build starten"
    },
    "expo.build_list": {
      "title": "Build-Verlauf"
    },
    "expo.build_view": {
      "title": "Build-Status"
    },
    "expo.build_cancel": {
      "title": "Build abbrechen"
    },
    "expo.submit": {
      "title": "Zum Store übermitteln"
    },
    "expo.dev_client": {
      "title": "Dev-Client starten (QR)"
    },
    "expo.quota": {
      "title": "Build-Kontingent"
    },
    "expo.update": {
      "title": "OTA-Update veröffentlichen"
    },
    "expo.env_list": {
      "title": "EAS-Variablen auflisten"
    },
    "expo.env_set": {
      "title": "EAS-Variable erstellen"
    },
    "expo.set_google_credential": {
      "title": "Play Store-Anmeldedaten"
    },
    "expo.set_apple_credential": {
      "title": "App Store-Anmeldedaten"
    },
    "expo.webhook_create": {
      "title": "EAS-Webhook registrieren"
    },
    "expo.device_create": {
      "title": "iOS-Gerät registrieren"
    },
    "files.read": {
      "title": "Datei lesen"
    },
    "files.list_dir": {
      "title": "Verzeichnis auflisten"
    },
    "files.grep": {
      "title": "In Dateien suchen"
    },
    "files.project_info": {
      "title": "Projekttyp erkennen"
    },
    "files.security_scan": {
      "title": "Heuristische Sicherheitsprüfung"
    },
    "files.write": {
      "title": "Datei schreiben"
    },
    "files.mkdir": {
      "title": "Ordner erstellen"
    },
    "files.delete": {
      "title": "Datei oder Ordner löschen"
    },
    "files.rename": {
      "title": "Umbenennen oder verschieben"
    },
    "files.copy": {
      "title": "Datei kopieren"
    },
    "files.chmod": {
      "title": "Berechtigungen ändern (chmod)"
    },
    "files.chown": {
      "title": "Besitzer ändern (chown)"
    },
    "firewall.ufw_status": {
      "title": "UFW-Status"
    },
    "firewall.fail2ban_status": {
      "title": "fail2ban-Status (Jails)"
    },
    "hosting.list_accounts": {
      "title": "Hosting-Konten auflisten"
    },
    "hosting.list_audit": {
      "title": "Audit-Log eines Hosting-Kontos anzeigen"
    },
    "hosting.account_stats": {
      "title": "Nutzungsstatistiken eines Hosting-Kontos"
    },
    "mail.list_domains": {
      "title": "Verfügbare Domänen"
    },
    "mail.list_messages": {
      "title": "Postfach-Nachrichten auflisten"
    },
    "mail.fetch_message": {
      "title": "Vollständige Nachricht lesen"
    },
    "mail.move_messages": {
      "title": "Nachrichten in Quarantäne verschieben"
    },
    "mail.flag_messages": {
      "title": "Nachrichten kennzeichnen"
    },
    "mail.delete_messages": {
      "title": "Nachrichten löschen (permanent)"
    },
    "module-dev.validate_manifest": {
      "title": "Manifest validieren"
    },
    "module-dev.run_checks": {
      "title": "Modul-Statische Prüfungen"
    },
    "module-dev.run_tests": {
      "title": "Modul-Tests ausführen"
    },
    "module-dev.list_modules": {
      "title": "Meine Marketplace-Module"
    },
    "module-dev.module_status": {
      "title": "Modul-Status"
    },
    "module-dev.submit_module": {
      "title": "Modul zur Überprüfung einreichen"
    },
    "module-dev.resubmit_module": {
      "title": "Korrigiertes Modul erneut einreichen"
    },
    "module-dev.unpublish_module": {
      "title": "Modul zurückziehen"
    },
    "module-dev.republish_module": {
      "title": "Modul erneut veröffentlichen"
    },
    "module-dev.preview_install": {
      "title": "Vorschau installieren (Modus B)"
    },
    "module-dev.preview_uninstall": {
      "title": "Vorschau deinstallieren"
    },
    "module-dev.link_project": {
      "title": "Projekt ↔ Modul verknüpfen"
    },
    "monitor.cpu_top": {
      "title": "Top-CPU-Prozesse"
    },
    "monitor.watchdog_status": {
      "title": "Auto-Reboot-Status"
    },
    "monitor.watchdog_configure": {
      "title": "Auto-Reboot konfigurieren"
    },
    "nginx.list_sites": {
      "title": "Nginx-Sites auflisten"
    },
    "nginx.tail_access_log": {
      "title": "access.log ausgeben"
    },
    "obsidian.list_vaults": {
      "title": "Vaults auflisten"
    },
    "obsidian.list_notes": {
      "title": "Notizen auflisten"
    },
    "obsidian.read_note": {
      "title": "Notiz lesen"
    },
    "obsidian.search_notes": {
      "title": "In Notizen suchen"
    },
    "obsidian.backlinks": {
      "title": "Notiz-Backlinks"
    },
    "obsidian.write_note": {
      "title": "Notiz schreiben"
    },
    "obsidian.append_note": {
      "title": "Zu Notiz anhängen"
    },
    "obsidian.daily_note": {
      "title": "Tagesnotiz"
    },
    "obsidian.delete_note": {
      "title": "Notiz löschen"
    },
    "obsidian.list_containers": {
      "title": "Kontext-Container auflisten"
    },
    "obsidian.sync_containers": {
      "title": "Kontext-Container synchronisieren"
    },
    "openclaw.config": {
      "title": "OpenClaw-Konfiguration"
    },
    "openclaw.test_connection": {
      "title": "OpenClaw-Verbindung testen"
    },
    "security-audit.last_report": {
      "title": "Letzter Audit-Bericht"
    },
    "security-audit.ssh_posture": {
      "title": "Server-SSH-Postur"
    },
    "server-alerts.send": {
      "title": "Benachrichtigung zum Server senden"
    },
    "server-alerts.list_rules": {
      "title": "Alarm-Regeln auflisten"
    },
    "server-alerts.create_rule": {
      "title": "Alarm-Regel erstellen"
    },
    "users.list": {
      "title": "Panel-Benutzer auflisten"
    },
    "users.create": {
      "title": "Benutzer erstellen"
    },
    "users.update": {
      "title": "Benutzer bearbeiten"
    },
    "users.delete": {
      "title": "Benutzer löschen"
    },
    "users.groups_list": {
      "title": "Gruppen mit Berechtigungen auflisten"
    },
    "users.group_create": {
      "title": "Gruppe erstellen"
    },
    "users.group_update": {
      "title": "Gruppe bearbeiten"
    },
    "users.group_delete": {
      "title": "Gruppe löschen"
    },
    "webhooks.list": {
      "title": "Konfigurierte Webhooks auflisten"
    }
  },
  "dataPanelCatalog": {
    "admin.health": {
      "title": "Server-Gesundheit",
      "description": "Schnelle Erreichbarkeitsprüfung und Lastmessung des verbundenen Ziels — hilfreich als System-Prompt-Kontext, bevor operationale Fragen beantwortet werden."
    },
    "dashboard.snapshot": {
      "title": "Kompakte Übersicht",
      "description": "Kompakte Pre-Prompt-Zusammenfassung des verbundenen Ziels: Last, RAM%, Root-Disk%, und wie viele wichtige Services laufen."
    },
    "monitor.snapshot": {
      "title": "System-Snapshot",
      "description": "Aktuelle Ressourcenzusammenfassung für das verbundene Ziel: CPU-Auslastung %, Durchschnittslast, Speichernutzung / Gesamt, Root-Dateisystem-Auslastung."
    },
    "obsidian.vaults_summary": {
      "title": "Vaults-Zusammenfassung",
      "description": "Registrierte Obsidian-Vaults auf dem verbundenen Server mit ihrer Pfad, Existenz und Markdown-Notizenanzahl."
    }
  },
  "structurePanel": {
    "editorLoading": "Editor wird geladen...",
    "loading": "Wird geladen...",
    "createdNotice": "{count} Element(e) erstellt.",
    "nothingToCreate": "Nichts zu erstellen (existierte bereits).",
    "savedNotice": "{rel} gespeichert.",
    "noActiveProviders": "Kein KI-Anbieter ist aktiv. Aktivieren Sie einen in Providern.",
    "improvedNotice": "Mit KI verbessert. Überprüfen Sie das Diff und klicken Sie Speichern, wenn es Ihnen gefällt.",
    "noAiChanges": "Die KI schlug keine Änderungen vor.",
    "structureLoading": "Struktur wird analysiert...",
    "retry": "Erneut versuchen",
    "copyAllContent": "Gesamten Inhalt kopieren",
    "copied": "Kopiert",
    "copy": "Kopieren",
    "downloadFile": "Datei herunterladen",
    "download": "Herunterladen",
    "diff": "Diff",
    "originalDiffTitle": "Unterschiede zum ursprünglichen Inhalt anzeigen",
    "back": "Zurück",
    "improveContentTitle": "Verbesser Sie den Inhalt mit KI mit dem Projektkontext",
    "improving": "Wird verbessert...",
    "improveWithAi": "Mit KI verbessern",
    "cancel": "Abbrechen",
    "saving": "Wird gespeichert...",
    "save": "Speichern",
    "chooseProvider": "Wählen Sie den KI-Anbieter",
    "close": "Schließen",
    "noModel": "(kein Modell)",
    "directory": "Verzeichnis",
    "structureCount": "Struktur · {count} zu erstellen",
    "markMissing": "Fehlend kennzeichnen",
    "creating": "Wird erstellt...",
    "create": "Erstellen ({count})",
    "expand": "Erweitern",
    "collapse": "Zuklappen",
    "edit": "Bearbeiten",
    "exists": "Existiert",
    "createLabel": "erstellen",
    "fallbackFilename": "datei.txt",
    "structureHints": {
      "claude": "Anweisungen, Konfiguration, Regeln, Befehle, Skills, Agents und Hooks, die Claude Code aus dem Projektverzeichnis liest.",
      "codex": "Codex CLI liest AGENTS.md als Projektleitfaden und .codex/ für Konfiguration und Prompts.",
      "gemini": "Gemini CLI liest GEMINI.md als Projektkontext und .gemini/ für Konfiguration und Befehle."
    },
    "structureNodes": {
      "CLAUDE.md": "Projektanweisungen (Kontext, Befehle, Konventionen)",
      "CLAUDE.local.md": "Lokale Anweisungen (nicht committen; persönliche Einstellungen)",
      ".mcp.json": "MCP-Server des Projekts",
      ".claude/settings.json": "Projektkonfiguration (versioniert)",
      ".claude/settings.local.json": "Lokale Konfiguration (nicht versioniert)",
      ".claude/rules": "Wiederverwendbare Regeln",
      ".claude/rules/code-style.md": "Regel: Code-Stil",
      ".claude/rules/testing.md": "Regel: Testen",
      ".claude/rules/api-conventions.md": "Regel: API-Konventionen",
      ".claude/commands": "Benutzerdefinierte Slash-Befehle",
      ".claude/commands/review.md": "/review-Befehl",
      ".claude/commands/fix-issue.md": "/fix-issue-Befehl",
      ".claude/skills": "Projekt-Skills",
      ".claude/skills/deploy": "Skill: Deploy",
      ".claude/skills/deploy/SKILL.md": "Deploy-Skill-Definition",
      ".claude/skills/deploy/deploy-config.md": "Deploy-Skill-Konfiguration",
      ".claude/agents": "Spezialisierte Subagents",
      ".claude/agents/code-reviewer.md": "Agent: Code-Reviewer",
      ".claude/agents/security-auditor.md": "Agent: Security-Auditor",
      ".claude/hooks": "Hooks (Lebenszyklus-Skripte)",
      ".claude/hooks/validate-bash.sh": "Hook: Bash-Befehle validieren",
      "AGENTS.md": "Projektleitfaden für Codex/Agents",
      ".codex": "Codex-Konfiguration",
      ".codex/config.toml": "Codex-Projektkonfiguration",
      ".codex/prompts": "Wiederverwendbare Prompts/Vorlagen",
      ".codex/prompts/review.md": "Prompt: Code-Review",
      "GEMINI.md": "Projektkontext für Gemini",
      ".gemini": "Gemini-Konfiguration",
      ".gemini/settings.json": "Gemini-Projektkonfiguration",
      ".gemini/commands": "Benutzerdefinierte Befehle",
      ".gemini/commands/review.toml": "Befehl: review",
      "modules/*": "Stammverzeichnis des Marketplace-Moduls",
      "modules/*/module.manifest.json": "Entwurfs-Manifest (AUTO-Felder werden von der Plattform gesetzt)",
      "modules/*/backend/index.js": "Modul-Backend — SDK defineModule()-Gerüst",
      "modules/*/frontend": "Modul-Frontend (Astro, optional)",
      "modules/*/README.md": "Modul-README",
      ".claude/rules/marketplace.md": "Regel: Marketplace-Architektur (Manifest, SDK, Capabilities)",
      "MARKETPLACE.md": "Marketplace-Architekturregeln (Manifest, SDK, Capabilities)"
    }
  },
  "mcpConfigPanel": {
    "noInstallResponse": "Keine Installationsantwort",
    "summaryTitle": "Exponieren Sie Panel-Funktionen über MCP zur CLI",
    "optional": "optional",
    "description": "Verbinden Sie die {providerId} CLI mit den Panel-Tools. Das Panel schreibt die Konfiguration direkt auf den Zielserver; Sie müssen nichts kopieren.",
    "configuredTitle": "Auf dem Ziel konfiguriert",
    "tokenValidUntil": "Token gültig bis {date}.",
    "restartCli": "Starten Sie die CLI im Terminal neu, damit sie den neuen MCP-Server lädt.",
    "configuring": "Wird konfiguriert...",
    "configureAutomatically": "Automatisch konfigurieren",
    "regenerate": "Token neu generieren und erneut konfigurieren",
    "manualTitle": "Manuelle Konfiguration (erweitert)",
    "generating": "Wird generiert...",
    "generateManualSnippet": "Manuelles Snippet generieren",
    "fileLabel": "Datei",
    "snippetLabel": "Snippet ({format})",
    "copy": "Kopieren",
    "mcpUrlLabel": "MCP-URL"
  },
  "conversationMedia": {
    "download": "Herunterladen",
    "close": "Schließen",
    "previous": "Zurück",
    "next": "Weiter",
    "all": "Alle",
    "images": "Bilder",
    "documents": "Dokumente",
    "attachmentsTitle": "Konversations-Anhänge",
    "emptyConversation": "Keine Anhänge in dieser Konversation.",
    "imagesSection": "Bilder",
    "documentsSection": "Dokumente",
    "clickToExpand": "klicken zum Erweitern",
    "emptyImages": "Keine Bilder.",
    "emptyDocuments": "Keine Dokumente.",
    "mediaTitle": "Medien",
    "attachToChat": "An Chat anhängen",
    "uploadToChat": "Dateien in den Chat hochladen",
    "attachFailed": "Die Datei konnte nicht an den Chat angehängt werden."
  },
  "teamBoard": {
    "showMoreTasks": "{count} weitere Aufgaben anzeigen",
    "showFewerTasks": "Weniger Aufgaben anzeigen",
    "title": "Team bei der Arbeit",
    "progressOf": "{done} von {total} Aufgaben erledigt",
    "statusPending": "Ausstehend",
    "statusRunning": "In Arbeit",
    "statusDone": "Erledigt",
    "statusFailed": "Fehlgeschlagen",
    "statusCanceled": "Abgebrochen",
    "pendingPermission": "Wartet auf deine Freigabe",
    "openChat": "Chat öffnen",
    "cancel": "Aufgabe abbrechen",
    "cancelConfirm": "Diese Aufgabe abbrechen? Der Agent hört auf, daran zu arbeiten.",
    "assignedTo": "Zugewiesen an {agent}",
    "autoTurn": "Automatische Team-Meldung",
    "dashboardTitle": "Teams bei der Arbeit",
    "tokensSummary": "Tokens: {total} (Leiter {leader} · Team {workers})",
    "lessThan1s": "<1 s",
    "insertions": "+{count}",
    "deletions": "-{count}",
    "viewDiff": "Diff anzeigen",
    "close": "Schließen",
    "verifyPassed": "Überprüft",
    "verifyFailed": "Überprüfung fehlgeschlagen ({attempts})",
    "filesChanged": "{count} Datei(en)",
    "diffTitle": "Änderungen der Aufgabe",
    "diffUnavailable": "Für diese Aufgabe ist kein Diff verfügbar (kein Worktree oder keine Änderungen).",
    "diffTruncated": "Diff gekürzt: Die Aufgabe hat mehr Inhalt geändert, als angezeigt wird.",
    "branchIntegrated": "Branch integriert",
    "cancelAll": "Alle abbrechen",
    "cancelAllConfirm": "ALLE laufenden Aufgaben abbrechen? Der aktive Plan wird als fehlgeschlagen markiert.",
    "addTask": "Aufgabe hinzufügen",
    "addTaskTitle": "Einem untergeordneten Agenten eine Aufgabe zuweisen",
    "addTaskWorker": "Untergeordneter Agent",
    "addTaskWorkerPlaceholder": "— Agent auswählen —",
    "addTaskNoWorkers": "Dieser Leiter hat keine direkt untergeordneten Agenten.",
    "addTaskInstruction": "Anweisung",
    "addTaskInstructionHint": "Der Agent sieht diese Unterhaltung nicht; gib den GESAMTEN nötigen Kontext an.",
    "addTaskTitleField": "Titel (optional)",
    "addTaskProject": "Projekt (optional)",
    "addTaskProjectNone": "— Kein Projekt —",
    "addTaskSubmitting": "Wird zugewiesen…",
    "feedbackUp": "Gutes Ergebnis",
    "feedbackDown": "Schlechtes Ergebnis",
    "orgChart": "Organigramm",
    "tokensChipTitle": "Von dieser Aufgabe verwendete Tokens",
    "statusQueued": "In der Warteschlange",
    "verifyRunning": "Wird überprüft…",
    "addTaskSubmit": "Zuweisen",
    "loading": "Lädt…"
  },
  "agentInfo": {
    "roleLabel": "Rolle",
    "roleTooltip": "Rolle des Agenten: {role}",
    "providerLabel": "Anbieter",
    "providerModelTooltip": "Anbieter {provider} · Modell {model}",
    "projectLabel": "Projekt",
    "projectTooltip": "Projekt: {project}"
  },
  "mermaidDiagram": {
    "zoomOut": "Verkleinern",
    "zoomIn": "Vergrößern",
    "zoomReset": "Zoom zurücksetzen"
  },
  "assistantErrorBoundary": {
    "errorMessage": "Der Assistent hatte einen Fehler beim Laden.",
    "retry": "Wiederholen"
  }
} as const;

export default assistantPart3;
