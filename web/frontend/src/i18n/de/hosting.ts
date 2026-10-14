const hosting = {
  "pageTitle": "Shared Hosting",
  "pageSubtitle": "Verwalte die Hosting-Konten deiner Kunden · WHM-artiger Multi-Tenant",
  "btnNewAccount": "Neues Konto",
  "options": {
    "planBasic": "Basis",
    "planPro": "Pro",
    "planBusiness": "Business",
    "planCustom": "Benutzerdefiniert"
  },
  "stats": {
    "total": "Gesamtkonten",
    "active": "Aktiv",
    "suspended": "Ausgesetzt",
    "terminated": "Beendet",
    "title": "Nutzung von {username}",
    "disk": "Festplatte (MB)",
    "domains": "Domains",
    "emails": "E-Mail-Konten",
    "databases": "Datenbanken",
    "subusers": "Unterbenutzer",
    "bandwidth": "Bandbreite (MB)",
    "percentUsed": "% genutzt",
    "method": "Messmethode",
    "methodDu": "du-Schätzung (best-effort)",
    "methodQuotaTools": "Systemkontingent (quota-tools)"
  },
  "tableTitle": "konten",
  "modal": {
    "titleNew": "Neues Hosting-Konto",
    "tabs": {
      "account": "Konto",
      "resources": "Ressourcen",
      "security": "Module und Sicherheit"
    },
    "labelUsername": "Benutzer *",
    "labelPassword": "Passwort *",
    "labelName": "Name",
    "labelEmail": "E-Mail",
    "labelPlan": "Plan",
    "resourcesTitle": "Ressourcenlimits",
    "labelDisk": "Festplatte (MB)",
    "labelBandwidth": "Bandbreite (MB)",
    "labelDomains": "Domains",
    "labelEmails": "E-Mail-Konten",
    "labelNotes": "Interne Notizen",
    "btnCancel": "Abbrechen",
    "btnCreate": "Konto erstellen",
    "hintUsername": "Nur Kleinbuchstaben, Zahlen, - und _",
    "phUsername": "kundebeispiel",
    "phPassword": "mindestens 8 Zeichen",
    "phName": "Unternehmen S.A.",
    "phEmail": "admin@unternehmen.com",
    "phNotes": "Optionale Anmerkungen…",
    "labelStatus": "Status",
    "labelTenantGroup": "Tenant-Gruppe",
    "labelHomeRoot": "Stammverzeichnis (home)",
    "hintTenantGroup": "Dedizierte Linux-Gruppe des Kontos (schreibgeschützt).",
    "hintHomeRoot": "Stamm des Tenants auf dem VPS (schreibgeschützt).",
    "labelDiskQuotaMb": "Festplattenkontingent (MB)",
    "labelBandwidthQuotaMb": "Bandbreitenkontingent (MB)",
    "labelMaxDomains": "Max. Domains",
    "labelMaxEmailAccounts": "Max. E-Mail-Konten",
    "labelMaxDatabases": "Max. Datenbanken",
    "labelMaxSubUsers": "Max. Unterbenutzer",
    "labelAllowedModules": "Erlaubte Module",
    "labelJailEnabled": "Shell isolieren (chroot)",
    "hintJailEnabled": "Beschränkt Terminal/SSH dieses Kontos auf seinen Ordner (chroot-Jail).",
    "modulesLoading": "Module werden geladen…",
    "labelExpiresAt": "Ablaufdatum",
    "hintExpiresAt": "Leer lassen für kein Ablaufdatum",
    "labelModules": "Zulässige Module",
    "hintModules": "Definiert, auf welche Panel-Module dieser Client zugreifen kann.",
    "labelDatabases": "Datenbanken",
    "labelSubUsers": "Subbenutzer",
    "labelJail": "Shell isolieren (chroot)",
    "hintJail": "Begrenzt Terminal/SSH dieses Kontos auf seinen Ordner (chroot-Jail).",
    "titleEdit": "Bearbeiten: {username}"
  },
  "pwdModal": {
    "title": "Passwort ändern",
    "labelNew": "Neues Passwort",
    "phPassword": "mindestens 8 Zeichen",
    "btnCancel": "Abbrechen",
    "btnChange": "Ändern"
  },
  "apiPageTitle": "Hosting-API-Dokumentation",
  "apiSubtitle": "Automatisierte Verwaltung gemeinsamer Hosting-Konten",
  "apiIntro": "Die Reseller API ermöglicht die Automatisierung von Erstellung, Aktualisierung, Sperrung und Löschung von Hosting-Konten aus jedem externen System — deiner eigenen Abrechnungsplattform, WHMCS, Bash-Skripten, Zapier-Integrationen usw. Sie ist mit jeder Sprache oder jedem Tool kompatibel, das HTTP-Anfragen stellen kann.",
  "toc": {
    "label": "Inhalte",
    "items": [
      "1. Authentifizierung",
      "2. Isolierung und Sicherheit",
      "3. Verfügbare Endpoints",
      "4. Konto erstellen",
      "5. Konten auflisten",
      "6. Konto abrufen",
      "7. Konto aktualisieren",
      "8. Aussetzen / Reaktivieren",
      "9. Passwort ändern",
      "10. Kontostatistiken",
      "11. Konto löschen",
      "12. Hosting-Konto-Login",
      "13. Fehlercodes",
      "14. Vollständige Beispiele"
    ]
  },
  "auth": {
    "title": "Authentifizierung",
    "intro": "Alle Reseller-API-Endpoints akzeptieren zwei Authentifizierungsmethoden:",
    "apiKeyTitle": "API Key (empfohlen für die Automatisierung)",
    "apiKeyDesc": "Erstelle einen API Key unter Panel → Webhooks → API Keys. Sende ihn im Authorization-Header:",
    "sessionTitle": "Admin-Sitzung (vom Panel)",
    "sessionDesc": "Wenn du Anfragen vom LUXIPANEL-Panel selbst stellst (z. B. von JavaScript im Browser), wird dein Admin-Sitzungs-Cookie automatisch akzeptiert.",
    "warningTitle": "Wichtig:",
    "warningText": "Gib deinen API Key niemals in clientseitigem Code preis (JavaScript im Browser, mobile Apps usw.). Verwende ihn ausschließlich auf Servern oder in privaten Umgebungen."
  },
  "isolation": {
    "title": "Isolation und Sicherheit",
    "intro": "Jedes Hosting-Konto ist eine vollständig isolierte Umgebung. Dies stellt sicher, dass kein Kunde die Ressourcen eines anderen einsehen oder ändern kann, unabhängig davon, ob er dies über das Web-Panel, die API, die SSH-Konsole oder einen anderen Weg versucht.",
    "features": [
      {
        "title": "Isolierte Daten",
        "desc": "Postfächer, Domains, DNS, SSL und Backups sind an die tenant_id jedes Kontos gebunden. SQL-Abfragen überschreiten niemals Mandantengrenzen."
      },
      {
        "title": "Dateisystem",
        "desc": "Jedes Konto hat sein eigenes Home-Verzeichnis (/home/username). Der Dateiexplorer und die Konsole sind auf dieses Verzeichnis beschränkt."
      },
      {
        "title": "Unabhängige Sitzungen",
        "desc": "Das JWT eines Hosting-Kontos enthält seine tenantId. Das Backend lehnt jede Anfrage ab, die versucht, auf Ressourcen außerhalb dieses Bereichs zuzugreifen."
      }
    ]
  },
  "endpoints": {
    "title": "Verfügbare Endpunkte",
    "colMethod": "Methode",
    "colPath": "Route",
    "colDesc": "Beschreibung",
    "colAuth": "Auth",
    "rows": [
      [
        "POST",
        "/api/hosting/accounts",
        "Hosting-Konto erstellen",
        "Admin / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts",
        "Konten auflisten (paginiert)",
        "Admin / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts/:id",
        "Einzelnes Konto abrufen",
        "Admin / API Key"
      ],
      [
        "PUT",
        "/api/hosting/accounts/:id",
        "Konto aktualisieren",
        "Admin / API Key"
      ],
      [
        "DELETE",
        "/api/hosting/accounts/:id",
        "Konto und alle zugehörigen Daten löschen",
        "Admin / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/suspend",
        "Konto sperren",
        "Admin / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/unsuspend",
        "Gesperrtes Konto reaktivieren",
        "Admin / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/change-password",
        "Passwort ändern",
        "Admin / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts/:id/stats",
        "Nutzungsstatistiken",
        "Admin / API Key"
      ],
      [
        "POST",
        "/api/hosting/auth/login",
        "Anmeldung am Hosting-Konto",
        "Öffentlich"
      ],
      [
        "POST",
        "/api/hosting/auth/logout",
        "Hosting-Abmeldung",
        "Hosting-Sitzung"
      ]
    ]
  },
  "create": {
    "title": "Konto erstellen",
    "labelBody": "Body (JSON)",
    "labelResp": "Antwort 201"
  },
  "list": {
    "title": "Konten auflisten",
    "labelParams": "Abfrageparameter",
    "colParam": "Parameter",
    "colType": "Typ",
    "colDefault": "Standard",
    "colDesc": "Beschreibung",
    "labelResp": "Antwort 200",
    "params": [
      [
        "page",
        "integer",
        "1",
        "Aktuelle Seite"
      ],
      [
        "limit",
        "integer",
        "20",
        "Ergebnisse pro Seite (max. 100)"
      ],
      [
        "search",
        "string",
        "—",
        "Suche in username, displayName, email"
      ],
      [
        "status",
        "string",
        "—",
        "active | suspended | terminated"
      ]
    ]
  },
  "compactEndpoints": [
    {
      "id": "get",
      "num": "6",
      "title": "Konto abrufen",
      "method": "GET",
      "path": "/api/hosting/accounts/:id",
      "note": "Gibt das Konto-Objekt ohne das Feld passwordHash zurück."
    },
    {
      "id": "update",
      "num": "7",
      "title": "Konto aktualisieren",
      "method": "PUT",
      "path": "/api/hosting/accounts/:id",
      "note": "Akzeptiert die gleichen Felder wie beim Erstellen (außer username und password). Nur die gesendeten Felder werden aktualisiert."
    },
    {
      "id": "suspend",
      "num": "8",
      "title": "Sperren / Reaktivieren",
      "method": "POST",
      "path": "/api/hosting/accounts/:id/suspend  |  /unsuspend",
      "note": "Das Sperren blockiert den Zugriff des Kunden sofort. Das Aufheben der Sperre setzt den Status auf 'active' zurück. Kein Body erforderlich."
    },
    {
      "id": "password",
      "num": "9",
      "title": "Passwort ändern",
      "method": "POST",
      "path": "/api/hosting/accounts/:id/change-password",
      "note": "Body: {\"password\": \"NewPass123!\"} — mindestens 8 Zeichen."
    },
    {
      "id": "stats",
      "num": "10",
      "title": "Nutzungsstatistiken",
      "method": "GET",
      "path": "/api/hosting/accounts/:id/stats",
      "note": "Gibt die konfigurierten Kontingente und die aktuelle Nutzung von Speicherplatz, Bandbreite, aktiven Domains und E-Mail-Konten zurück."
    },
    {
      "id": "delete",
      "num": "11",
      "title": "Konto löschen",
      "method": "DELETE",
      "path": "/api/hosting/accounts/:id",
      "note": "⚠️ Unwiderruflich. Löscht das Konto und über ON DELETE CASCADE alle zugehörigen Ressourcen: Postfächer, Domains, DNS, SSL und Backups."
    }
  ],
  "login": {
    "title": "Hosting-Konto-Login",
    "badgePublic": "· Öffentlich",
    "desc": "Der Kunde gibt seine Zugangsdaten im Login-Panel ein. Wenn sie gültig sind, wird eine Sitzung vom Typ kind: \"hosting\" erstellt, die den Zugriff ausschließlich auf die Ressourcen seines Kontos beschränkt.",
    "labelBody": "Body",
    "labelResp": "Antwort 200"
  },
  "errors": {
    "title": "Fehlercodes",
    "intro": "Alle Fehler folgen demselben Envelope:",
    "colHttp": "HTTP",
    "colCode": "Code",
    "colDesc": "Beschreibung",
    "rows": [
      [
        "400",
        "VALIDATION_ERROR",
        "Ungültige oder fehlende Felder"
      ],
      [
        "401",
        "AUTH_ERROR",
        "Ungültiger, abgelaufener oder fehlender API key"
      ],
      [
        "403",
        "FORBIDDEN",
        "Sie haben keine Berechtigung für diesen Vorgang"
      ],
      [
        "404",
        "NOT_FOUND",
        "Das angeforderte Konto existiert nicht"
      ],
      [
        "409",
        "CONFLICT",
        "Der Benutzername ist bereits vergeben"
      ],
      [
        "429",
        "RATE_LIMIT",
        "Zu viele Anfragen — warten Sie, bevor Sie es erneut versuchen"
      ],
      [
        "500",
        "INTERNAL_ERROR",
        "Interner Serverfehler"
      ]
    ],
    "generic": "Fehler",
    "unknown": "Unbekannter Fehler"
  },
  "examples": {
    "title": "Vollständige Beispiele",
    "labelCurl": "Konto erstellen",
    "labelSuspend": "Konto sperren",
    "labelList": "Mit Filtern auflisten",
    "labelNodeClient": "Wiederverwendbarer Client",
    "labelPhpHelper": "Helper-Klasse in PHP"
  },
  "table": {
    "columnStatus": "Status",
    "columnPlan": "Plan",
    "columnModules": "Module",
    "columnCreated": "Erstellt",
    "columnUpdated": "Aktualisiert",
    "columnTenantGroup": "Gruppe",
    "columnHomeRoot": "Home",
    "modulesCount": "{count} Module"
  },
  "audit": {
    "title": "Audit von {username}",
    "eventType": "Ereignis",
    "actor": "Akteur",
    "date": "Datum",
    "empty": "Keine Ereignisse aufgezeichnet."
  },
  "actions": {
    "editModules": "Module bearbeiten",
    "viewStats": "Nutzung ansehen",
    "viewAudit": "Audit ansehen",
    "enableJail": "Jail aktivieren",
    "disableJail": "Jail deaktivieren",
    "save": "Speichern",
    "saveChanges": "Änderungen speichern",
    "saving": "Speichern…"
  },
  "confirm": {
    "enableJailBody": "Chroot-Jail für dieses Konto aktivieren? Sein Terminal/SSH wird auf seinen Ordner beschränkt.",
    "disableJailBody": "Chroot-Jail deaktivieren? Das Konto kehrt zu einer normalen Shell (/bin/bash) zurück.",
    "suspendBody": "Dieses Konto sperren? Der Kunde verliert den Zugriff.",
    "suspendTitle": "Konto sperren",
    "suspendOk": "Ja, Sperrung bestätigen",
    "deleteBody": "Das Konto \"{username}\" und ALLE zugehörigen Daten (E-Mails, Domains, Dateien) löschen? Diese Aktion kann nicht rückgängig gemacht werden.",
    "deleteTitle": "Konto löschen"
  },
  "jail": {
    "degraded": "jailkit ist auf dem Server nicht installiert; das Jail wurde nicht aktiviert. Installiere jailkit und versuche es erneut.",
    "degradedTitle": "Jail nicht angewendet",
    "enabledOk": "Jail erfolgreich aktiviert."
  },
  "toasts": {
    "jailAlready": "Das Jail ist bereits aktiv",
    "jailNotActive": "Das Jail ist nicht aktiv",
    "notActive": "Das Konto ist nicht aktiv",
    "notSuspended": "Das Konto ist nicht gesperrt"
  },
  "labels": {
    "statusActive": "Aktiv",
    "statusSuspended": "Ausgesetzt",
    "statusTerminated": "Beendet"
  },
  "dataTable": {
    "columns": {
      "username": "Benutzer",
      "plan": "Plan",
      "estado": "Status",
      "modulos": "Module",
      "tenantGroup": "Gruppe",
      "homeRoot": "Home",
      "creado": "Erstellt",
      "actualizado": "Aktualisiert"
    },
    "filters": {
      "searchUser": "Nach Benutzer suchen…",
      "estado": "Status",
      "plan": "Plan",
      "statusActive": "Aktiv",
      "statusSuspended": "Gesperrt",
      "statusTerminated": "Beendet"
    },
    "rowActions": {
      "edit": "Bearbeiten",
      "viewStats": "Nutzung ansehen",
      "viewAudit": "Audit ansehen",
      "password": "Passwort ändern",
      "suspend": "Sperren",
      "unsuspend": "Reaktivieren",
      "enableJail": "Jail aktivieren",
      "disableJail": "Jail deaktivieren",
      "delete": "Löschen"
    }
  },
  "runtime": {
    "defaultsLoadError": "Standardwerte konnten nicht geladen werden.",
    "defaultsSaveError": "Werte konnten nicht gespeichert werden.",
    "defaultsSaved": "Werte auf dem aktiven Server gespeichert."
  },
  "settingsUi": {
    "title": "Hosting-Einstellungen",
    "description": "Einstellungen der Hosting-Kontentabelle",
    "table": "Tabelle",
    "apiProviders": "API-Anbieter",
    "rowsPerPage": "Zeilen pro Seite in der Kontentabelle.",
    "newAccountDefaults": "Standardwerte für neue Konten",
    "defaultsHint": "Werden auf dem aktiven Server gespeichert. Bestehende Konten bleiben unverändert.",
    "emailAccounts": "E-Mails",
    "subusers": "Unterbenutzer",
    "defaultJail": "Isolation standardmäßig aktivieren",
    "defaultModules": "Standardmodule (durch Kommas getrennte IDs)",
    "saveDefaults": "Standardwerte speichern",
    "relatedModules": "Verwandte Module",
    "users": "Benutzer",
    "domainsSsl": "Domains und SSL",
    "showAll": "Alle anzeigen",
    "hideAll": "Alle ausblenden",
    "providerConnections": "Verbindungen von Hosting-Verwaltungen",
    "providerConnectionsHint": "LUXIPANEL stellt die API bereit. Jede Verwaltung erhält einen Schlüssel und auf einen Server, Module und Vorgänge begrenzten Zugriff.",
    "newProvider": "Neuer Anbieter",
    "managedServer": "Verwalteter Server",
    "localServer": "Lokaler Server",
    "panelHttpsOrigin": "LUXIPANEL-HTTPS-Ursprung",
    "siteEngine": "Website-Dienst auf dem Server",
    "accountModules": "Module für Konten",
    "modulesHint": "Durch Kommas getrennte IDs; HOSTING prüft den Katalog.",
    "apiOperations": "API-Vorgänge",
    "readAccounts": "Konten lesen",
    "createAccounts": "Konten erstellen",
    "accountStatus": "Kontostatus und -daten",
    "viewUsage": "Nutzung anzeigen",
    "linkSites": "Websites verknüpfen",
    "panelAccess": "Panelzugriff",
    "deleteAccounts": "Konten löschen",
    "createProviderKey": "Anbieter und Schlüssel erstellen",
    "copyKeyNow": "Kopieren Sie den Schlüssel jetzt: Er wird nur einmal angezeigt.",
    "groupPolicy": {
      "editProvider": "Anbieter bearbeiten",
      "saveProvider": "Anbieter speichern",
      "templateTitle": "Berechtigungen der neuen Gruppe",
      "templateHint": "Jedes neue Konto erhält diese Berechtigungen in seiner eigenen Gruppe. Bestehende Gruppen können unter Benutzer bearbeitet werden.",
      "permissions": "Detaillierte Berechtigungen",
      "sidebar": "Menüs",
      "views": "Ansichten",
      "actions": "Aktionen",
      "filesScope": "Dateizugriff",
      "relativeHint": "Ein Pfad pro Zeile, relativ zum Ordner des Kontos. . steht für den gesamten Ordner.",
      "allowPaths": "Erlaubte Ordner",
      "denyPaths": "Gesperrte Ordner",
      "readOnlyPaths": "Schreibgeschützte Ordner",
      "defaultPath": "Startordner",
      "commands": "Terminalbefehle",
      "allowAllCommands": "Alle Benutzerbefehle erlauben",
      "commandGroups": "Befehlsgruppen",
      "allowedCommands": "Erlaubte Befehle, einer pro Zeile",
      "deniedCommands": "Gesperrte Befehle, einer pro Zeile",
      "saving": "Wird gespeichert…",
      "saved": "Anbieter gespeichert. Gilt für neue Konten.",
      "created": "Anbieter erstellt.",
      "loading": "Anbieter und Berechtigungen werden geladen…",
      "loadError": "Einstellungen konnten nicht geladen werden.",
      "active": "Aktiv",
      "revoked": "Widerrufen",
      "rotateKey": "Schlüssel erneuern",
      "rotateSuccess": "Schlüssel erneuert. Kopieren Sie den neuen Schlüssel.",
      "revoke": "Zugriff widerrufen",
      "reactivate": "Reaktivieren",
      "accessUpdated": "Zugriff aktualisiert.",
      "emptyProviders": "Noch keine Anbieter eingerichtet."
},
    "apiGuide": "API-Anleitung",
    "retry": "Erneut versuchen"
  },
  "apiDocs": {
    "pageTitle": "API für Hosting-Anbieter",
    "backToHosting": "Zurück zu HOSTING",
    "contractVersion": "HTTP-Vertrag · Version 1",
    "heading": "Verbinden Sie Ihre Hosting-Verwaltung",
    "intro": "LUXIPANEL stellt diese API bereit, damit Ihre Verwaltung Konten anlegt, Websites verknüpft und Zugriff gemäß den in HOSTING festgelegten Rechten gewährt.",
    "guideContents": "Inhalt der Anleitung",
    "preparation": "Vorbereitung",
    "authentication": "Authentifizierung",
    "operations": "Operationen",
    "example": "Beispiel",
    "panelAccess": "Panelzugriff",
    "limitsErrors": "Grenzen und Fehler",
    "preparationHeading": "Einrichtung in HOSTING",
    "administrator": "Administrator",
    "scope": "Geltungsbereich",
    "key": "Schlüssel",
    "adminStep": "Öffnen Sie HOSTING → Einstellungen → API-Anbieter und erstellen Sie einen Anbieter.",
    "scopeStep": "Legen Sie Server, Website-Engine, Module, Kontingente und erlaubte Vorgänge fest.",
    "keyStep": "Kopieren Sie den Schlüssel lhp_… einmal und speichern Sie ihn nur im Backend der Verwaltung.",
    "providerScopeNote": "Jeder Anbieter ist einem Server zugeordnet. Konten erhalten einen eigenen Linux-Benutzer und Ordner; die Verwaltung wählt und erhält das Passwort nicht.",
    "anyProvider": "Jeder Anbieter",
    "endpointCapabilities": "Zeigt Version, Vorgänge, Module und zugewiesenen Server.",
    "endpointPutAccount": "Erstellt oder findet ein Konto mit optionalem displayName und email.",
    "endpointGetAccount": "Ruft ein Konto ohne Offenlegung des Passworts ab.",
    "endpointPatchAccount": "Ändert Name, E-Mail oder Status active/suspended.",
    "endpointDeleteAccount": "Löscht ein Konto ohne verknüpfte Websites. Standardmäßig deaktiviert.",
    "endpointUsage": "Zeigt Kontingente, verfügbare Nutzungsdaten und Messwarnungen.",
    "endpointPutSite": "Verknüpft eine Domain mit der in HOSTING konfigurierten Website-Engine.",
    "endpointDeleteSite": "Entfernt nur die Website dieses Anbieters.",
    "endpointTicket": "Stellt ein einmaliges Panel-Ticket aus, das 60 Sekunden gültig ist.",
    "method": "Methode",
    "pathFromBase": "Pfad ab Basis-URL",
    "permission": "Berechtigung",
    "result": "Ergebnis",
    "operationsHeading": "Vorgänge der Verwaltung",
    "authNote": "Senden Sie Anfragen per HTTPS an das Panel. Admin-Cookies und lxp_…-Schlüssel gelten für diese API nicht. Geben Sie den lhp_…-Schlüssel niemals an den Browser weiter.",
    "baseNote": "Basis-URL: https://<panel>/api/hosting/v1. Externe IDs dürfen 1–128 Zeichen enthalten: Buchstaben, Ziffern, _ . : -.",
    "idempotencyNote": "PUT-Anfragen für Konten und Websites sind bei gleicher Referenz und gleichem Inhalt idempotent. Anbieter können nicht auf Konten anderer Anbieter zugreifen.",
    "createAccount": "Konto erstellen oder abrufen",
    "accountResponseNote": "Die Antwort enthält { \"ok\": true, \"data\": … } mit Benutzer, Home-Verzeichnis, Status und Kontingenten. Der Passwort-Hash fehlt.",
    "siteExampleNote": "Senden Sie für eine Website PUT /accounts/account-42/sites/site-1 mit { \"domain\": \"example.com\" }. LUXIPANEL erstellt einen NGINX-Proxy zur konfigurierten Engine; die Verwaltung veröffentlicht Inhalte und leitet TLS-Verkehr zum Server.",
    "clientAccessHeading": "Kundenzugriff auf LUXIPANEL",
    "clientAccessNote": "Das Backend prüft den Kontoinhaber und ruft POST /accounts/{accountId}/access-ticket auf. Es gibt URL und Ticket an den Browser, der per POST an /api/auth/sso/handoff sendet. Das Ticket ist einmalig und verfällt nach 60 Sekunden. Bei erforderlichem zweiten Faktor lautet die Antwort 403, bis ein kompatibler Ablauf verfügbar ist.",
    "limitsHeading": "Grenzen und Fehlerantworten",
    "limitsNote": "Die API akzeptiert nur Referenzen, grundlegende Kontodaten und Domains. Die Verwaltung kann keine Befehle, Dateipfade, Zielserver oder NGINX-Konfiguration senden. Websites zeigen nur auf die vom Administrator festgelegte Engine und den Port.",
    "errorCodes": "400: ungültige Eingabe · 401: fehlender oder ungültiger Schlüssel · 403: Vorgang nicht erlaubt · 404: unbekannte Referenz · 409: Konflikt oder gleichzeitiger Vorgang · 5xx: Serverfehler.",
    "bandwidthNote": "Die Bandbreitenmessung ist noch nicht zuverlässig. Prüfen Sie warnings in der usage-Antwort."
  }
} as const;

export default hosting;
