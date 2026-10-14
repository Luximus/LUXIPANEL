const settings = {
  "passkeyName": {
    "title": "Name des Passkeys",
    "hint": "Verwende einen Namen, an dem du das Gerät erkennst.",
    "placeholder": "Z. B. Privater Laptop",
    "save": "Namen speichern",
    "edit": "Namen bearbeiten",
    "invalid": "Gib einen Namen mit 1 bis 128 Zeichen ein.",
    "saved": "Name aktualisiert",
    "error": "Der Name konnte nicht gespeichert werden.",
    "cancel": "Abbrechen"
},
  "placeholders": {
    "logoUrl": "https://beispiel.de/logo.png",
    "imageUrl": "https://…/image.jpg"
  },
  "pageTitle": "Einstellungen",
  "loadFailure": {
    "title": "Einstellungen konnten nicht geladen werden",
    "sessionMessage": "Einstellungen konnten nicht geladen werden: Deine Sitzung mit dem Server ist nicht verfügbar. Wähle den Server im Auswahlmenü erneut aus oder melde dich ab und wieder an.",
    "genericMessage": "Einstellungen konnten nicht geladen werden. Prüfe deine Verbindung und versuche es erneut.",
    "retry": "Erneut versuchen"
  },
  "header": {
    "title": "Panel-Einstellungen",
    "subtitle": "Globale LuxiPanel-Konfiguration",
    "autosave": "Automatisches Speichern"
  },
  "tabs": {
    "general": "Allgemein",
    "layoutUi": "Layout/UI",
    "security": "Sicherheit",
    "modules": "Module",
    "system": "System",
    "credentials": "Anmeldedaten"
  },
  "credentials": {
    "hcaptcha": {
      "title": "hCaptcha",
      "desc": "Schützen Sie die Panel-Anmeldung mit einer hCaptcha-Abfrage. Geben Sie die Schlüssel aus Ihrem hCaptcha-Dashboard ein.",
      "sitekeyLabel": "Site Key",
      "sitekeyPlaceholder": "Ihr hCaptcha Site Key",
      "secretLabel": "Secret Key",
      "secretPlaceholder": "Neuen Secret Key eingeben",
      "secretConfigured": "Ein Secret Key ist bereits gesetzt. Leer lassen, um ihn zu behalten.",
      "statusConfigured": "Konfiguriert",
      "statusMissing": "Nicht konfiguriert",
      "saved": "hCaptcha-Einstellungen gespeichert"
    },
    "tolqia": {
      "label": "Tolqia",
      "help": "API-Token deines Tolqia-Kontos (Tarif Plus oder Premium) — aktiviert Anrufe mit Übersetzung für die Nutzer dieses Servers",
      "guide": {
        "steps": [
          "Gehe zu tolqia.com und melde dich mit deinem Konto an (Tarif Plus oder Premium).",
          "Öffne „Einstellungen“ › „API“ und erstelle ein neues Token.",
          "Kopiere das Token (beginnt mit tq_live_) und füge es unter „Konfigurieren“ ein."
        ],
        "docUrl": "https://tolqia.com/settings/api",
        "docLabel": "Token auf tolqia.com erstellen → Einstellungen › API",
        "docUrl2": "https://tolqia.com/docs",
        "docLabel2": "Dokumentation"
      }
    },
    "elevenlabs": {
      "label": "ElevenLabs",
      "help": "Wird für die Echtzeitübersetzung von Audioanrufen verwendet",
      "voiceIdLabel": "Standard-Voice-ID",
      "voiceIdPlaceholder": "z. B. 21m00Tcm4TlvDq8ikWAM",
      "guide": {
        "steps": [
          "Gehe zu elevenlabs.io und melde dich an.",
          "Öffne «My Account» → «API Keys» und erstelle einen neuen Schlüssel.",
          "Kopiere den Schlüssel (beginnt mit sk_) und füge ihn unter «Konfigurieren» ein."
        ],
        "docUrl": "https://elevenlabs.io/app/settings/api-keys",
        "docLabel": "ElevenLabs-API-Schlüssel"
      }
    },
    "title": "Modul-Zugangsdaten",
    "subtitle": "Verwalte die Access Tokens und API-Schlüssel, die Module zum Funktionieren benötigen.",
    "empty": "Keine Module, die Anmeldedaten erfordern, sind auf diesem Server aktiviert.",
    "statusSet": "Konfiguriert",
    "statusMissing": "Nicht konfiguriert",
    "tokenLabel": "Access Token / API-Schlüssel",
    "tokenPlaceholder": "Token einfügen…",
    "save": "Speichern",
    "test": "Testen",
    "clear": "Entfernen",
    "manage": "Verwalten",
    "show": "Anzeigen",
    "hide": "Verbergen",
    "saved": "Anmeldedaten gespeichert",
    "cleared": "Anmeldedaten gelöscht",
    "testOk": "Verbindung gültig",
    "testFail": "Anmeldedaten konnten nicht validiert werden",
    "confirmClear": "Diese Anmeldedaten entfernen?",
    "confirmClearTitle": "Anmeldedaten entfernen",
    "error": "Ein Fehler ist aufgetreten",
    "getDoc": "Token abrufen",
    "managedLabel": {
      "assistant": "KI-Agenten"
    },
    "managedHint": {
      "assistant": "Die API-Schlüssel des Assistenten-Anbieters werden in dessen Panel verwaltet.",
      "backups": "Speicherschlüssel (S3 / R2) werden im Backups-Modul verwaltet."
    },
    "managedSummary": {
      "assistant": "KI-Anbieter (Claude, OpenAI, Gemini, …)",
      "backups": "S3 / R2 Speicher-Anmeldedaten"
    },
    "storage": {
      "accountId": "Konto-ID (Cloudflare)",
      "accessKeyId": "Zugriffsschlüssel-ID",
      "secret": "Geheimer Zugriffsschlüssel",
      "endpoint": "Endpunkt (optional)",
      "region": "Region (optional)",
      "r2Hint": "Kontogültige R2-Anmeldedaten wiederverwendbar durch Backups: Legen Sie die Schlüssel hier einmal fest und wählen Sie in Backups einfach einen Bucket aus.",
      "s3Hint": "S3-Anmeldedaten wiederverwendbar durch Backups: Legen Sie die Schlüssel hier einmal fest und wählen Sie in Backups einfach einen Bucket aus."
    },
    "connector": {
      "connect": "Speichern und verbinden",
      "disconnect": "Trennen",
      "connected": "Verbunden",
      "configured": "Konfiguriert",
      "notConnected": "Nicht verbunden",
      "unavailable": "Erfordert das aktivierte KI-Agenten-Modul",
      "setupGuide": "Einrichtungsanleitung"
    },
    "help": {
      "tabConfig": "Konfigurieren",
      "tabHelp": "Hilfe",
      "openLink": "Link öffnen",
      "guides": {
        "cloudflare": {
          "steps": [
            "Gehe zu dash.cloudflare.com → «Mein Profil» → «API-Tokens».",
            "Klicke auf «Token erstellen»: Verwende die Vorlage «DNS-Zone bearbeiten» oder erstelle einen benutzerdefinierten Token mit den benötigten Berechtigungen (Zone: Lesen, DNS: Bearbeiten usw.).",
            "Wähle die Zonen aus, auf die der Token Zugriff erhalten soll, und erstelle ihn.",
            "Kopiere den Token (wird nur einmal angezeigt) und füge ihn auf der Registerkarte «Konfigurieren» ein."
          ],
          "docUrl": "https://dash.cloudflare.com/profile/api-tokens",
          "docLabel": "Cloudflare API-Token"
        },
        "expo": {
          "steps": [
            "Gehe zu expo.dev und melde dich an → «Account settings» → «Access tokens».",
            "Klicke auf «Create token», vergib einen Namen und kopiere den generierten Wert.",
            "Füge ihn auf der Registerkarte «Konfigurieren» ein."
          ],
          "docUrl": "https://expo.dev/settings/access-tokens",
          "docLabel": "Expo Access Token"
        },
        "openclaw": {
          "steps": [
            "Gehe zu openclaw.ai und melde dich an.",
            "Generiere oder kopiere deinen API-Key aus dem OpenClaw-Dashboard.",
            "Füge ihn unter «Konfigurieren» ein (passe Endpunkt und Standardmodell bei Bedarf an)."
          ],
          "docUrl": "https://openclaw.ai",
          "docLabel": "OpenClaw"
        },
        "repository-store": {
          "steps": [
            "Gehe zu github.com → «Settings» → «Developer settings» → «Personal access tokens».",
            "Erstelle einen Token (classic oder fine-grained) mit Leseberechtigung für Repositories (public_repo oder Contents: Read).",
            "Kopiere den Token (beginnt mit ghp_ oder github_pat_) und füge ihn unter «Konfigurieren» ein."
          ],
          "docUrl": "https://github.com/settings/tokens",
          "docLabel": "GitHub-Token"
        },
        "bitninja": {
          "steps": [
            "Melde dich im BitNinja-Panel an (admin.bitninja.io).",
            "Kopiere deinen License Key aus dem Lizenz-/Serverbereich.",
            "Füge ihn unter «Konfigurieren» ein."
          ],
          "docUrl": "https://bitninja.io",
          "docLabel": "BitNinja"
        },
        "r2": {
          "steps": [
            "Gehe zu dash.cloudflare.com → «R2» → «Manage R2 API Tokens».",
            "Erstelle einen «R2 API Token» (S3-kompatibel) mit Lese-/Schreibzugriff auf Objekte.",
            "Kopiere die angezeigte Access Key ID und den Secret Access Key.",
            "Deine Account ID findest du auf der R2-Seite bzw. in der Kontoübersicht.",
            "Trage Account ID, Access Key ID und Secret unter «Konfigurieren» ein (der Endpunkt wird aus der Account ID abgeleitet)."
          ],
          "docUrl": "https://dash.cloudflare.com/?to=/:account/r2/api-tokens",
          "docLabel": "R2 API-Token"
        },
        "s3": {
          "steps": [
            "In der AWS-Konsole: «IAM» → «Users» → dein Benutzer → «Security credentials» → «Create access key».",
            "Kopiere die Access Key ID und den Secret Access Key.",
            "Bei einem S3-kompatiblen Dienst (Wasabi, MinIO usw.) notiere Endpunkt und Region.",
            "Trage die Schlüssel (und ggf. Endpunkt/Region) unter «Konfigurieren» ein."
          ],
          "docUrl": "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html",
          "docLabel": "AWS-Zugangsschlüssel"
        }
      }
    }
  },
  "general": {
    "hcaptchaEnabled": "hCaptcha bei der Anmeldung verlangen",
    "hcaptchaEnabledHint": "Zeigt eine hCaptcha-Abfrage im Anmeldeformular des Panels an.",
    "sectionTitle": "Allgemein",
    "labelPanelName": "Panel-Name",
    "labelTimezone": "Zeitzone",
    "labelLanguage": "Sprache",
    "languageOptions": {
      "en": "English",
      "es": "Español"
    },
    "labelSessionTtl": "Sitzungsdauer (Stunden)",
    "labelMaxLoginAttempts": "Fehlgeschlagene Login-Versuche (Sperrung)",
    "labelRequire2fa": "2FA für alle Benutzer erforderlich",
    "btnViewLog": "Log anzeigen",
    "labelAuditLog": "Audit-Log aktivieren",
    "labelSwitchNewTab": "Server beim Wechseln in einem neuen Tab öffnen"
  },
  "imageList": {
    "labelJson": "(JSON)",
    "labelUrls": "(Bild-URLs)",
    "addButton": "Bild hinzufügen"
  },
  "layout": {
    "sectionTitle": "Layout, Branding und UI",
    "sectionSubtitle": "Logos, Radien, Schatten und Basisfarben des Frontends anpassen.",
    "branding": {
      "groupTitle": "Branding und Logos",
      "groupDesc": "Einziges Logo für Sidebar, Login, Header, Footer und Favicon.",
      "labelLogoUrl": "Logo-URL",
      "logoUrlHelp": "Ein einzelnes Logo, das überall verwendet wird: Seitenleiste, Login, Panel-Header, Fußzeile und öffentliche Bildschirme.",
      "btnUpload": "Hochladen",
      "btnPick": "Auswählen",
      "btnDefault": "Standard",
      "restoreLogos": "Logos zurücksetzen",
      "loginLogoOpacity": "Deckkraft des Logo-Containers (Login)",
      "loginLogoOpacityHelp": "Transluzenz des Logo-Kreis-Hintergrunds auf /login (0 = transparent, 100 = deckend)."
    },
    "loginBg": {
      "groupTitle": "Login-Hintergrund",
      "groupDesc": "Animierter Hintergrundeffekt auf /login und dessen Ersatzfarbe.",
      "enableLabel": "Animierten Hintergrund auf /login anzeigen",
      "labelFallbackColor": "Hintergrundfarbe wenn deaktiviert",
      "labelActiveEffect": "Aktiver Effekt auf /login",
      "previewTitle": "Anmeldevorschau"
    },
    "shape": {
      "groupTitle": "Form und Schatten",
      "groupDesc": "Globaler Radius, Karten- und Modalschatten des Frontends.",
      "labelRadius": "Globaler Radius",
      "radiusHelp": "Bsp.: 0.5rem, 12px.",
      "labelShadow": "Basisschatten",
      "labelModalShadow": "Modal-Schatten",
      "labelModalBackdrop": "Modal-Overlay",
      "backdropHelp": "Dialoghintergrund.",
      "layer1": "Ebene 1",
      "layer2": "Ebene 2",
      "labelColor": "Farbe",
      "labelShadowSingle": "Schatten"
    },
    "palettes": {
      "title": "Farbschema",
      "subtitle": "Wähle eine vordefinierte Palette; sie gilt für das gesamte Panel (hell und dunkel).",
      "light": "Helles Design",
      "dark": "Dunkles Design",
      "intensity": "Intensität"
    },
    "resetButton": "Stile auf Standard zurücksetzen",
    "panelBg": {
      "groupTitle": "Panel-Hintergrund",
      "groupDesc": "Animierter Hintergrundeffekt im Panel und dessen Ersatzfarbe.",
      "enableLabel": "Animierten Hintergrund im Panel anzeigen",
      "labelFallbackColor": "Hintergrundfarbe wenn deaktiviert",
      "labelActiveEffect": "Aktiver Panel-Effekt"
    }
  },
  "security": {
    "sectionTitle": "Sicherheit",
    "loginMethodsTitle": "Erlaubte Anmeldemethoden",
    "loginMethodsDesc": "Mindestens eine Methode muss aktiv bleiben. Deaktivierte Methoden erscheinen nicht auf dem Login-Bildschirm.",
    "loginMethodsWarning": "Es muss mindestens eine Methode aktiv bleiben.",
    "passkey": {
      "name": "Passkey",
      "desc": "Biometrische Authentifizierung / FIDO2. Benutzer müssen ihr Gerät registrieren.",
      "verifying": "Wird überprüft...",
      "btnManage": "Verwalten"
    },
    "password": {
      "name": "Passwort",
      "desc": "Anmeldung mit Benutzername und Passwort. Immer ohne vorherige Konfiguration verfügbar.",
      "configured": "Konfiguriert"
    },
    "recovery": {
      "name": "Wiederherstellung",
      "desc": "Einmaltcodes als Notfallbackup.",
      "verifying": "Wird überprüft...",
      "btnManage": "Verwalten"
    },
    "twoFaStatus": {
      "groupTitle": "2FA-Status für dieses Konto",
      "badgeDisabled": "Deaktiviert",
      "promptText": "2FA aktivieren, um dieses Administratorkonto zu schützen.",
      "btnSetup": "Einrichten",
      "btnDelete": "Löschen",
      "btnDisable": "Deaktivieren"
    }
  },
  "modules": {
    "sectionTitle": "Cache-Engines pro Modul",
    "sectionDesc1": "Status und Anpassung der geplanten Erfassung auf dem Client-Server.",
    "sectionDescBold": "Aktiv/Inaktiv wird vom übergeordneten Modul abgeleitet",
    "modulesLink": "Module",
    "sectionDesc2": ": Beim Deaktivieren eines Moduls wird die Erfassung gestoppt; beim Reaktivieren wird sie neu geplant. Hier wird nur die Häufigkeit eingestellt. DataTables lesen vorformatierte Daten aus dediziertem Redis auf diesem Server; wenn dieser abgeschaltet oder zu veraltet ist, wird auf normales JSON zurückgegriffen.",
    "loading": "Wird geladen…",
    "tableHeaders": {
      "module": "Modul / Sammlung",
      "source": "Quelle",
      "active": "Aktiv",
      "interval": "Intervall (s)",
      "lastRefresh": "Letzter Refresh",
      "duration": "Dauer",
      "size": "Größe",
      "hitRatio": "Trefferquote"
    },
    "managedInPre": " (verwaltet in ",
    "managedInPost": ")"
  },
  "system": {
    "factoryReset": {
      "sectionTitle": "Einstellungen zurücksetzen",
      "sectionSubtitle": "Setzt die Panel-Einstellungen auf Werkseinstellungen zurück.",
      "warningTitle": "Warnung",
      "warningBefore": "Diese Aktion setzt ",
      "warningAllSettings": "alle Konfigurationseinstellungen",
      "warningMiddle": " des Panels (allgemein, Layout/UI, SMTP, Sicherheit und von Modulen gespeicherte Einstellungen) auf ihre Standardwerte zurück. Benutzer und installierte Module ",
      "warningNotDeleted": "werden nicht gelöscht",
      "warningAfter": ".",
      "btnReset": "Werkseinstellungen wiederherstellen"
    },
    "backupRestore": {
      "sectionTitle": "Aus Backup wiederherstellen",
      "sectionSubtitle": "Panel aus einem früheren Backup wiederherstellen (Backups-Modul erforderlich).",
      "loading": "Backups werden geladen...",
      "btnRestore": "Ausgewähltes Backup wiederherstellen"
    },
    "noBackup": {
      "title": "Wiederherstellung aus Backup nicht verfügbar",
      "descBefore": "Installiere das Modul ",
      "backupsModule": "Backups",
      "descAfter": " im Modulpanel, um diese Funktion zu aktivieren."
    }
  },
  "imagePicker": {
    "title": "Bild auswählen",
    "subtitle": "Im öffentlichen Frontend-Ordner verfügbare Bilder.",
    "empty": "Keine Bilder im öffentlichen Ordner vorhanden.",
    "btnUpload": "Neues Bild hochladen",
    "btnCancel": "Abbrechen"
  },
  "smtpTest": {
    "dialogTitle": "Test-E-Mail senden",
    "labelRecipient": "Empfänger",
    "placeholderRecipient": "du@beispiel.com",
    "btnCancel": "Abbrechen",
    "btnSend": "Senden"
  },
  "passkeysDialog": {
    "title": "Passkeys verwalten",
    "btnAdd": "Passkey hinzufügen",
    "empty": "Keine Passkeys registriert"
  },
  "recoveryDialog": {
    "title": "Wiederherstellungscodes",
    "btnGenerate": "Generieren / neu generieren",
    "loading": "Wird geladen...",
    "warningText": "Bewahre diese Codes an einem sicheren Ort auf. Sie werden nur einmal angezeigt.",
    "btnCopy": "Alles kopieren",
    "btnPrint": "Drucken"
  },
  "setup2faDialog": {
    "title": "2FA einrichten",
    "subtitle": "Scanne diesen QR-Code mit deiner Authentifizierungs-App.",
    "secretLabel": "Manueller Secret:",
    "copyTitle": "Kopieren",
    "verifyLabel": "Gib den 6-stelligen Code ein:",
    "btnCancel": "Abbrechen",
    "btnActivate": "2FA aktivieren"
  },
  "disable2faDialog": {
    "title": "2FA deaktivieren?",
    "body": "2FA wird deaktiviert, aber das Geheimnis wird gespeichert, um es später wieder aktivieren zu können.",
    "btnCancel": "Abbrechen",
    "btnConfirm": "2FA deaktivieren"
  },
  "delete2faDialog": {
    "title": "2FA löschen?",
    "body": "Das gespeicherte Geheimnis wird gelöscht und du musst 2FA neu einrichten, um es wieder zu verwenden.",
    "btnCancel": "Abbrechen",
    "btnConfirm": "2FA löschen"
  },
  "auditLogDialog": {
    "title": "Audit-Log",
    "empty": "Keine Aktivität aufgezeichnet"
  },
  "modulesCache": {
    "agoSeconds": "vor {n}s",
    "agoMinutes": "vor {n}m",
    "agoHours": "vor {n}h",
    "agoDays": "vor {n}d",
    "collectionSingular": "Kollektion",
    "collectionPlural": "Kollektionen",
    "activeSingular": "aktiv",
    "activePlural": "aktiv",
    "enabledTitle": "Programmierte Erfassung über den Dispatcher des Client-Servers",
    "badgeEnabled": "Aktiv",
    "disabledTitle": "Übergeordnetes Modul ist in /panel/modules deaktiviert — die Erfassung ist pausiert",
    "badgeDisabled": "Inaktiv",
    "buttonSave": "Speichern",
    "saving": "Wird gespeichert…",
    "savedStatus": "{module}/{collection} aktualisiert",
    "saveError": "Fehler beim Speichern von {module}/{collection}: {message}",
    "loadedSummary": "{count} Kollektionen cachebar in {modules} Modulen. Änderungen werden in der nächsten Erfassungsrunde angewendet (≤60s).",
    "loadError": "Fehler: {message}"
  },
  "labels": {
    "auditLogin": "Anmeldung",
    "auditLoginFailed": "Fehlgeschlagener Anmeldeversuch",
    "auditLogout": "Abmeldung",
    "auditPasswordChange": "Passwortänderung",
    "auditPasskeyRegister": "Passkey registriert",
    "auditPasskeyDelete": "Passkey gelöscht",
    "auditRecoveryCodeUsed": "Wiederherstellungscode verwendet",
    "auditProfileUpdate": "Profil aktualisiert",
    "auditSettingsUpdate": "Einstellungen aktualisiert",
    "audit2faEnabled": "2FA aktiviert",
    "audit2faDisabled": "2FA deaktiviert",
    "auditEventDefault": "Ereignis",
    "aiHintAnthropic": "Empfohlene Modelle: claude-fable-5 (neuestes), claude-sonnet-4-6 (ausgewogen), claude-opus-4-6 (leistungsstärkstes)",
    "aiKeyHintAnthropic": "API-Schlüssel erhalten unter console.anthropic.com",
    "aiHintOpenai": "gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna",
    "aiKeyHintOpenai": "API-Schlüssel erhalten unter platform.openai.com",
    "aiHintOllama": "Name des lokal in Ollama installierten Modells. Unterstützt keine Tools.",
    "aiKeyHintOllama": "Kein API-Schlüssel für lokales Ollama erforderlich",
    "managedByLp": "Verwaltet von LP-LICENSE-SERVER",
    "notAvailable": "Nicht verfügbar",
    "managedExternally": "Extern verwaltet",
    "twoFaManagedByLp": "Die Authentifizierung wird in diesem Modus von LP-LICENSE-SERVER verwaltet.",
    "licenseNoStatus": "Kein Status",
    "licenseActive": "Aktiv",
    "licenseExpires": "läuft ab {date}",
    "licenseActiveDesc": "Lizenz aktiv",
    "licenseDegraded": "Eingeschränkt",
    "licensePending": "Ausstehend",
    "licenseDegradedDesc": "Die Lizenz konnte nicht validiert werden und das Panel befindet sich im eingeschränkten Modus.",
    "licenseNotActivated": "Die Lizenz ist noch nicht aktiviert.",
    "passkeyCount": "{count} Passkey(s) registriert",
    "noPasskeys": "Keine Passkeys registriert",
    "recoveryCodesGenerated": "Wiederherstellungscodes generiert",
    "noRecoveryCodes": "Keine Codes generiert",
    "passkeyRegistered": "Registriert {date}",
    "recoveryCodesActive": "Sie haben aktive Wiederherstellungscodes.",
    "recoveryCodesNone": "Sie haben keine aktiven Wiederherstellungscodes.",
    "recoveryCodesDisplayed": "{count} Codes generiert. Bewahren Sie diese an einem sicheren Ort auf.",
    "twoFaEnabled": "Aktiviert",
    "twoFaEnabledDesc": "Dieses 2FA wird beim nächsten Anmelden abgefragt. Sie können es deaktivieren, ohne das Secret zu löschen.",
    "twoFaDisabled": "Deaktiviert",
    "twoFaDisabledDesc": "Das Secret ist weiterhin gespeichert, wird beim Anmelden jedoch nicht abgefragt, bis Sie es erneut aktivieren.",
    "twoFaSetupPrompt": "Aktivieren Sie 2FA, um dieses Administratorkonto zu schützen.",
    "printRecoveryCodesTitle": "Wiederherstellungscodes - LUXIPANEL",
    "printRecoveryCodesDesc": "Bewahren Sie diese Codes an einem sicheren Ort auf. Jeder Code kann nur einmal verwendet werden."
  },
  "toasts": {
    "errorSaving": "Fehler beim Speichern der Einstellungen",
    "errorSavingAppearance": "Das Erscheinungsbild konnte nicht auf dem Lizenzserver gespeichert werden. Bitte versuchen Sie es in wenigen Sekunden erneut.",
    "licenseKeyAndRefRequired": "Bitte Schlüssel und Zahlungsreferenz eingeben",
    "licenseActivated": "Lizenz erfolgreich aktiviert",
    "licenseActivateError": "Die Lizenz konnte nicht aktiviert werden",
    "timezoneApplyError": "Die Zeitzone konnte nicht auf das System angewendet werden",
    "timezoneSavedNotApplied": "Zeitzone im Panel gespeichert, konnte aber nicht auf das System angewendet werden (sudo-Berechtigungen prüfen).",
    "passkeysInLp": "Passkeys werden in LP-LICENSE-SERVER verwaltet",
    "passkeyDeleted": "Passkey gelöscht",
    "passkeyDeleteError": "Fehler beim Löschen der Passkey",
    "passkeyBrowserUnsupported": "Ihr Browser unterstützt keine Passkeys",
    "passkeyRegisterInitError": "Die Registrierung konnte nicht gestartet werden",
    "passkeyRegisterCancelled": "Registrierung abgebrochen",
    "passkeyRegisterFinishError": "Fehler beim Abschließen der Registrierung",
    "passkeyRegistered": "Passkey erfolgreich registriert",
    "passkeyRegisterUserCancelled": "Registrierung vom Benutzer abgebrochen",
    "passkeyRegisterError": "Fehler beim Registrieren der Passkey",
    "recoveryCodesInLp": "Wiederherstellungscodes werden in LP-LICENSE-SERVER verwaltet",
    "recoveryCodesGenerateError": "Fehler beim Generieren der Codes",
    "twoFaInLp": "2FA wird in LP-LICENSE-SERVER verwaltet",
    "twoFaSetupInitError": "Fehler beim Starten der 2FA-Konfiguration",
    "twoFaQrError": "Der QR-Code konnte nicht generiert werden",
    "twoFaActivated": "2FA erfolgreich aktiviert",
    "twoFaDisabled": "2FA für die Anmeldung deaktiviert",
    "twoFaDisableError": "Fehler beim Deaktivieren von 2FA",
    "twoFaReactivated": "2FA für die Anmeldung aktiviert",
    "twoFaActivateError": "Fehler beim Aktivieren von 2FA",
    "twoFaDeleted": "2FA gelöscht",
    "twoFaDeleteError": "Fehler beim Löschen von 2FA",
    "backupRestoreUnavailable": "Die Wiederherstellung von Backups ist von diesem Panel aus noch nicht verfügbar.",
    "imageExceeds5mb": "Das Bild überschreitet 5 MB",
    "uploadingImage": "Bild wird hochgeladen...",
    "imageUploadError": "Fehler beim Hochladen des Bildes",
    "imageUploadInvalidResponse": "Ungültige Serverantwort",
    "imageUploaded": "Bild erfolgreich hochgeladen",
    "logosRestored": "Logos auf Standardwerte zurückgesetzt",
    "codesCopied": "Codes kopiert",
    "secretCopied": "Secret kopiert",
    "smtpTestSent": "Test-E-Mail an {to} gesendet",
    "smtpTestError": "Fehler beim Senden",
    "layoutReset": "Stile auf LUXIPANEL-Standardwerte zurückgesetzt",
    "settingsReset": "Einstellungen zurückgesetzt",
    "settingsResetError": "Fehler beim Zurücksetzen",
    "licenseRevalidated": "Lizenz erneut validiert",
    "licenseRevalidateError": "Die Lizenz konnte nicht erneut validiert werden"
  },
  "actions": {
    "activating": "Wird aktiviert...",
    "activateOrUpdate": "Aktivieren / aktualisieren",
    "manage": "Verwalten",
    "configure": "Konfigurieren",
    "viewOrRegenerate": "Anzeigen / neu generieren",
    "generate": "Generieren",
    "generating": "Wird generiert...",
    "generateOrRegenerate": "Generieren / neu generieren",
    "disable": "Deaktivieren",
    "activate": "Aktivieren",
    "activate2fa": "2FA aktivieren",
    "continue": "Weiter",
    "sending": "Wird gesendet...",
    "send": "Senden",
    "resetting": "Wird zurückgesetzt...",
    "factoryReset": "Werkseinstellungen zurücksetzen"
  },
  "errors": {
    "twoFaEnter6Digits": "Bitte die 6-stellige Codezahl eingeben",
    "twoFaInvalidCode": "Ungültiger Code"
  },
  "confirm": {
    "deletePasskeyTitle": "Passkey löschen",
    "deletePasskeyBody": "Diese Passkey löschen?",
    "restoreBackupBody": "Backup \"{id}\" wiederherstellen?",
    "restoreBackupTitle": "Backup wiederherstellen",
    "restoreLogosBody": "Logo auf die LUXIPANEL-Standardwerte zurücksetzen?",
    "restoreLogosTitle": "Logos zurücksetzen",
    "restoreLogosConfirm": "Ja, zurücksetzen",
    "resetLayoutBody": "Benutzeroberflächen-Stile auf die LUXIPANEL-Standardwerte zurücksetzen? Benutzerdefinierte Logos, Farben, Schatten und Hintergründe gehen verloren.",
    "resetLayoutTitle": "Stile zurücksetzen",
    "resetLayoutConfirm": "Ja, zurücksetzen",
    "factoryResetBody": "Sind Sie sicher? Dadurch werden alle Panel-Einstellungen zurückgesetzt.",
    "factoryResetTitle": "Einstellungen zurücksetzen",
    "factoryResetConfirm": "Ja, zurücksetzen"
  },
  "empty": {
    "noBackups": "Keine Backups verfügbar."
  },
  "palettes": {
    "violet": {
      "name": "Violett",
      "description": "Standardpalette von LUXIPANEL."
    },
    "ocean": {
      "name": "Ozean",
      "description": "Professionelle und ruhige Blautöne."
    },
    "emerald": {
      "name": "Smaragd",
      "description": "Frische und natürliche Grüntöne."
    },
    "sunset": {
      "name": "Sonnenuntergang",
      "description": "Warme Orangetöne und Bernstein."
    },
    "rose": {
      "name": "Rosa",
      "description": "Lebhafte Rosa- und Magentatöne."
    },
    "indigo": {
      "name": "Indigo",
      "description": "Elegante und moderne Indigotöne."
    },
    "aqua": {
      "name": "Aqua",
      "description": "Leuchtende Türkis- und Cyantöne."
    },
    "graphite": {
      "name": "Graphit",
      "description": "Neutral, monochromatisch und sachlich."
    },
    "amber": {
      "name": "Bernstein",
      "description": "Warme Gold- und Honigtöne."
    },
    "fuchsia": {
      "name": "Fuchsia",
      "description": "Intensive Magenta- und Purpurtöne."
    },
    "lime": {
      "name": "Limette",
      "description": "Energische Limettengrüntöne."
    },
    "slate": {
      "name": "Schiefer",
      "description": "Professionelles Blaugrau."
    },
    "prisma": {
      "name": "Prisma",
      "description": "Mischt die Farben aller Paletten in einem fortlaufenden, endlosen Übergang.",
      "colors": "Farben",
      "addColorButton": "Farbe hinzufügen",
      "addColorAria": "Farbe für den Prisma-Effekt auswählen und hinzufügen",
      "addColorInputAria": "Farbe zum Prisma-Effekt hinzufügen",
      "editColorAria": "Farbe bearbeiten",
      "editColorInputAria": "Farbwert bearbeiten",
      "editColorHexAria": "Hex-Wert der Farbe",
      "removeColorAria": "Farbe entfernen",
      "moveUpAria": "Farbe nach oben",
      "moveDownAria": "Farbe nach unten",
      "helpText": "Liste mit den Pfeilen neu ordnen. Jede Farbe bestimmt die Reihenfolge des Effekts."
    },
    "custom": {
      "name": "Benutzerdefiniert",
      "description": "Wähle deine Basisfarbe und passe ihre Intensität an.",
      "baseColor": "Basisfarbe",
      "baseColorAria": "Benutzerdefinierte Basisfarbe",
      "hexAria": "Hex-Wert der benutzerdefinierten Basisfarbe"
    },
    "luxisoft": {
      "description": "Marineblau und Mint im hellen Modus; Graphit und Mint im dunklen Modus.",
      "name": "Luxisoft"
    }
  },
  "managers": {
    "default": "Manager 1"
  },
  "git": {
    "errorFallback": "Fehler"
  }
} as const;

export default settings;
