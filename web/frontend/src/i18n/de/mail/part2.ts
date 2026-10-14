// Auto-split fragment of mail.ts (part 2/2) — data only, keeps <1000 lines.
// Do not reorder keys: the aggregator merges parts by spread in original order.
const mailPart2 = {
  "routing": {
    "labels": {
      "autoRemote": "Konfiguration automatisch erkennen: Remote",
      "local": "Lokaler Mail-Exchanger",
      "backup": "Backup-Mail-Exchanger",
      "remote": "Entfernter Mail-Exchanger"
    },
    "currentMode": "Aktuell: {mode}"
  },
  "tracking": {
    "statuses": {
      "success": "Erfolgreich",
      "deferred": "Aufgeschoben",
      "failure": "Fehlgeschlagen",
      "inProgress": "In Bearbeitung",
      "unknown": "Unbekannt"
    },
    "columns": {
      "event": "Ereignis",
      "fromAddress": "Absenderadresse",
      "sentTime": "Sendezeitpunkt",
      "spamScore": "Spam-Punktzahl",
      "recipient": "Empfänger",
      "domain": "Domain",
      "id": "ID",
      "result": "Ergebnis",
      "actions": "Aktionen"
    },
    "noRecordsFound": "Keine Datensätze gefunden.",
    "zeroRecords": "0 Datensätze",
    "matchesZeroRecords": "Die Suche entspricht 0 Datensätzen.",
    "recordsCount": "{count} Datensätze",
    "matchesRecords": "Die Suche entspricht {count} Datensätzen.",
    "detailMeta": "Ereignis: {event} | ID: {id} | Empfänger: {recipient}"
  },
  "filters": {
    "ruleParts": {
      "from": "Von",
      "subject": "Betreff",
      "to": "An",
      "anyRecipient": "Beliebiger Empfänger",
      "reply": "Antwort",
      "body": "Nachrichtentext",
      "anyHeader": "Beliebiger Header",
      "notDelivered": "Bisher nicht zugestellt",
      "errorMessage": "Ist eine Fehlermeldung",
      "listId": "List-ID",
      "spamStatus": "Spam-Status",
      "spamBar": "Spam-Balken",
      "spamScore": "Spam-Punktzahl"
    },
    "matches": {
      "contains": "enthält",
      "matchesRegex": "entspricht regex",
      "doesNotContain": "enthält nicht",
      "equals": "gleich",
      "beginsWith": "beginnt mit",
      "endsWith": "endet mit",
      "doesNotBegin": "beginnt nicht mit",
      "doesNotEnd": "endet nicht mit",
      "doesNotMatch": "entspricht nicht",
      "isAbove": "ist größer als (nur Zahlen)",
      "isNotAbove": "ist nicht größer als (nur Zahlen)",
      "isBelow": "ist kleiner als (nur Zahlen)",
      "isNotBelow": "ist nicht kleiner als (nur Zahlen)"
    },
    "actions": {
      "discard": "Nachricht verwerfen",
      "redirect": "An E-Mail weiterleiten",
      "fail": "Mit Nachricht fehlschlagen",
      "stop": "Verarbeitung von Regeln beenden",
      "deliverToFolder": "In Ordner zustellen",
      "pipe": "An Programm weiterleiten"
    },
    "joinOp": {
      "and": "und",
      "or": "oder"
    },
    "removeBtn": "-"
  },
  "defaultAddress": {
    "currentSetting": {
      "none": "Aktuelle Einstellung: (keine)",
      "forward": "Aktuelle Einstellung: {destination}",
      "forwardDefault": "(weiterleiten)",
      "fail": "Aktuelle Einstellung: :fail: {message}"
    },
    "defaultFailMessage": "Benutzer nicht vorhanden"
  },
  "archive": {
    "retentionOptions": {
      "oneMonth": "1 Monat",
      "threeMonths": "3 Monate",
      "sixMonths": "6 Monate",
      "oneYear": "1 Jahr",
      "twoYears": "2 Jahre",
      "fiveYears": "5 Jahre",
      "tenYears": "10 Jahre",
      "forever": "Unbegrenzt",
      "custom": "Benutzerdefiniert"
    },
    "fields": {
      "incomingEmail": "Eingehende E-Mail-Nachrichten",
      "outgoingMailingList": "Ausgehende Mailing-List-E-Mails",
      "outgoingEmail": "Ausgehende E-Mails"
    }
  },
  "encryption": {
    "neverExpires": "Läuft nie ab"
  },
  "actions": {
    "view": "Anzeigen",
    "save": "Speichern",
    "clone": "Klonen",
    "copy": "Kopieren",
    "delete": "Löschen",
    "edit": "Bearbeiten",
    "remove": "Entfernen"
  },
  "outbound": {
    "cardTitle": "E-Mail-Versand des Panels (SMTP)",
    "cardDesc": "Standardkonto oder externes SMTP, mit dem das Panel Berichte und System-E-Mails versendet.",
    "back": "Zurück",
    "intro": "Identität, mit der LUXIPANEL System-E-Mails versendet (Berichte von Cron-Agenten, Freigabelinks, Tests). Dies kann ein E-Mail-Konto auf diesem Server oder ein externes SMTP sein, das nicht zum Server gehört.",
    "modeLabel": "Versandmodus",
    "modeDisabled": "Deaktiviert",
    "modeAccount": "E-Mail-Konto des Servers (Standard)",
    "modeExternal": "Externes SMTP",
    "accountLabel": "Standard-Versandkonto",
    "accountHint": "Verwendet die gespeicherten SMTP-Anmeldedaten dieses Kontos.",
    "hostLabel": "SMTP-Server",
    "portLabel": "Port",
    "userLabel": "Benutzer",
    "passLabel": "Passwort",
    "passPlaceholder": "(unverändert)",
    "fromLabel": "Absender (E-Mail)",
    "fromNameLabel": "Absendername",
    "secureLabel": "Direktes TLS (Port 465)",
    "save": "Speichern",
    "testPlaceholder": "ziel@beispiel.com",
    "test": "Test senden",
    "hostPlaceholder": "smtp.example.com",
    "fromPlaceholder": "sender@example.com",
    "fromNamePlaceholder": "Mein Unternehmen"
  },
  "table": {
    "status": {
      "active": "Aktiv",
      "inactive": "Inaktiv",
      "disabled": "Deaktiviert"
    },
    "redirect": {
      "columns": {
        "domain": "Domain",
        "destinos": "Ziele"
      },
      "filters": {
        "searchDomain": "Domain suchen…"
      },
      "rowActions": {
        "edit": "Bearbeiten",
        "delete": "Löschen"
      }
    },
    "encryption": {
      "columns": {
        "keyId": "Key ID",
        "label": "Identität",
        "keySize": "Schlüsselgröße",
        "created": "Erstellt",
        "expires": "Läuft ab"
      },
      "filters": {
        "searchKey": "Schlüssel suchen…"
      },
      "rowActions": {
        "view": "Ansicht",
        "delete": "Löschen"
      }
    },
    "accounts": {
      "columns": {
        "address": "Adresse",
        "domain": "Domain",
        "uso": "Kontingent / Nutzung",
        "reenvios": "Weiterleitungen",
        "estado": "Status"
      },
      "filters": {
        "search": "Adresse oder Domain suchen…",
        "domain": "Domain",
        "estado": "Status"
      },
      "rowActions": {
        "edit": "Konto bearbeiten",
        "depurarIa": "Mit KI bereinigen",
        "password": "Passwort ändern",
        "toggle": "Aktivieren / Deaktivieren",
        "inbox": "Postfach öffnen",
        "signatures": "Signaturen verwalten",
        "default": "Als Standard verwenden",
        "contacts": "Kontakte verwalten",
        "calendars": "Kalender verwalten",
        "autoresponder": "Autoresponder verwalten",
        "filters": "Filter verwalten",
        "forwards": "Weiterleitungen verwalten",
        "diskusage": "Speichernutzung verwalten",
        "clone": "E-Mail klonen",
        "delete": "Konto löschen"
      },
      "quickActions": {
        "bulkForward": "Weiterleitung hinzufügen",
        "bulkQuota": "Kontingent ändern",
        "bulkDelete": "Konten löschen"
      }
    },
    "globalFilters": {
      "columns": {
        "name": "Filter",
        "estado": "Status",
        "rules": "Regeln",
        "actionsCount": "Aktionen"
      },
      "filters": {
        "search": "Filter suchen…"
      },
      "rowActions": {
        "edit": "Bearbeiten",
        "delete": "Löschen"
      }
    },
    "contacts": {
      "columns": {
        "email": "E-Mail",
        "name": "Name"
      },
      "filters": {
        "searchEmail": "E-Mail suchen…"
      },
      "rowActions": {
        "edit": "Bearbeiten",
        "delete": "Löschen"
      }
    },
    "calendars": {
      "columns": {
        "name": "Name",
        "timezone": "Zeitzone",
        "estado": "Status"
      },
      "filters": {
        "search": "Kalender suchen…"
      },
      "rowActions": {
        "edit": "Bearbeiten",
        "delete": "Löschen"
      }
    },
    "signatures": {
      "columns": {
        "sender": "Absender",
        "preview": "Signatur"
      },
      "filters": {
        "search": "Filtern und suchen…"
      },
      "rowActions": {
        "edit": "Bearbeiten",
        "delete": "Löschen"
      }
    },
    "filters": {
      "columns": {
        "name": "Name",
        "estado": "Status"
      },
      "filters": {
        "search": "Filter suchen…"
      },
      "rowActions": {
        "edit": "Bearbeiten",
        "delete": "Löschen"
      }
    }
  },
  "confirm": {
    "bulkDeleteAccounts": "{count} E-Mail-Konto/-Konten löschen? Diese Aktion kann nicht rückgängig gemacht werden.",
    "deleteAccount": "Konto {address} löschen? Diese Aktion kann nicht rückgängig gemacht werden.",
    "deleteAccountTitle": "Konto löschen",
    "deleteAutoresponder": "Autoresponder dieses Kontos löschen?",
    "deleteByDate": "E-Mails aus {folder} zwischen {from} und {to} werden gelöscht. Fortfahren?",
    "deleteByDateTitle": "E-Mails nach Datum löschen",
    "deleteCalendar": "Kalender \"{label}\" löschen?",
    "deleteCalendarTitle": "Kalender löschen",
    "deleteContact": "Kontakt \"{label}\" löschen?",
    "deleteContactTitle": "Kontakt löschen",
    "deleteDomainForward": "Globale Weiterleitung von @{domain} löschen?",
    "deleteDomainForwardTitle": "Globale Weiterleitung löschen",
    "deleteEncryptionKey": "Diesen Verschlüsselungs-Schlüssel löschen?",
    "deleteFilter": "Filter \"{name}\" löschen?",
    "deleteFilterTitle": "Filter löschen",
    "deleteForward": "Weiterleitung an {destination} löschen?",
    "deleteGlobalFilter": "Globalen Filter \"{label}\" löschen?",
    "deleteGlobalFilterTitle": "Globalen Filter löschen",
    "yesDelete": "Ja, löschen"
  },
  "empty": {
    "noDomains": "Keine Domains",
    "noFolders": "Für dieses Konto wurden keine Ordner gefunden.",
    "noOtherAccount": "Kein weiteres Konto verfügbar"
  },
  "errors": {
    "accountCreateFailed": "Fehler beim Erstellen des Kontos",
    "accountNotFound": "Konto nicht gefunden",
    "accountUpdateFailed": "Fehler beim Aktualisieren des Kontos",
    "accountUpdatedForwardsFailed": "Das Konto wurde aktualisiert, aber die Aktualisierung der Weiterleitungen ist fehlgeschlagen",
    "accountsLoadFailed": "Fehler beim Laden der Konten",
    "autoDeleteThresholdInvalid": "Ungültiger Schwellenwert für das automatische Löschen.",
    "autoresponderDeleteFailed": "Autoresponder konnte nicht gelöscht werden",
    "autoresponderSaveFailed": "Autoresponder konnte nicht gespeichert werden.",
    "calendarDeleteFailed": "Kalender konnte nicht gelöscht werden",
    "calendarNotFound": "Kalender nicht gefunden",
    "calendarSaveFailed": "Kalender konnte nicht gespeichert werden.",
    "cloneCreateFailed": "Das neue Konto konnte nicht erstellt werden.",
    "cloneFailed": "Die E-Mail konnte nicht geklont werden.",
    "cloneIdResolveFailed": "Konto erstellt, aber dessen ID konnte nicht aufgelöst werden. Erneut als 'bestehend' versuchen.",
    "cloneLocalAndDomainRequired": "Lokalen Teil und Domain angeben.",
    "clonePasswordTooShort": "Das Passwort muss mindestens 6 Zeichen lang sein.",
    "contactDeleteFailed": "Kontakt konnte nicht gelöscht werden",
    "contactNotFound": "Kontakt nicht gefunden",
    "contactSaveFailed": "Kontakt konnte nicht gespeichert werden.",
    "copyByRangeFailed": "Kopieren nach Bereich fehlgeschlagen",
    "customScoreInvalid": "Ungültige benutzerdefinierte Bewertung.",
    "dateRangeRequired": "Sie müssen ein Start- und Enddatum auswählen",
    "defaultAddressLoadFailed": "Die Standardadresse konnte nicht geladen werden.",
    "defaultAddressSaveFailed": "Die Standardadresse konnte nicht gespeichert werden.",
    "deleteByRangeFailed": "Löschen nach Bereich fehlgeschlagen",
    "deleteFailed": "Fehler beim Löschen",
    "destEmailInvalid": "Ungültige Ziel-E-Mail",
    "destinationsInvalidFormat": "Eines oder mehrere Ziele haben ein ungültiges Format.",
    "diskUsageLoadFailed": "Die Speichernutzung konnte nicht geladen werden",
    "domainForwardDeleteFailed": "Die globale Weiterleitung konnte nicht gelöscht werden.",
    "domainForwardsLoadFailed": "Die globalen Weiterleitungen konnten nicht geladen werden.",
    "domainRedirectSaveFailed": "Die globale Weiterleitung konnte nicht gespeichert werden.",
    "domainsLoadFailed": "DNS-Domains konnten nicht geladen werden",
    "filterDeleteFailed": "Der Filter konnte nicht gelöscht werden",
    "filterNotFound": "Filter nicht gefunden",
    "filterSaveFailed": "Der Filter konnte nicht gespeichert werden.",
    "forwardAlreadyExists": "Es existiert bereits eine Weiterleitung an {destination}",
    "forwardsSaveFailed": "Die Weiterleitungen konnten nicht auf dem Server gespeichert werden",
    "globalFilterDeleteFailed": "Der globale Filter konnte nicht gelöscht werden.",
    "globalFilterSaveFailed": "Der globale Filter konnte nicht gespeichert werden.",
    "globalFilterTestFailed": "Der Test konnte nicht ausgeführt werden.",
    "globalFiltersLoadFailed": "Die globalen Filter konnten nicht geladen werden.",
    "indicateTestDestEmail": "Geben Sie die Ziel-E-Mail des Tests an.",
    "localPartInvalid": "Der Benutzer vor dem @ hat ein ungültiges Format.",
    "localPartInvalidNoPoint": "Der Benutzer vor dem @ hat ein ungültiges Format",
    "mustAddAtLeastOneAction": "Sie müssen mindestens eine Aktion hinzufügen.",
    "mustAddAtLeastOneDestEmail": "Sie müssen mindestens eine Ziel-E-Mail hinzufügen.",
    "mustAddAtLeastOneRule": "Sie müssen mindestens eine Regel hinzufügen.",
    "mustEnterBody": "Sie müssen den Inhalt der Nachricht eingeben.",
    "mustEnterSubject": "Sie müssen einen Betreff eingeben.",
    "mustEnterTestMessage": "Sie müssen eine Testnachricht eingeben.",
    "mustEnterValidDestEmail": "Sie müssen eine gültige Ziel-E-Mail eingeben.",
    "mustIndicateCalendarName": "Sie müssen einen Kalendernamen angeben.",
    "mustIndicateContactEmail": "Sie müssen die E-Mail des Kontakts angeben.",
    "mustIndicateFilterName": "Sie müssen einen Filternamen angeben.",
    "mustIndicateName": "Sie müssen einen Namen angeben.",
    "mustSelectDomain": "Sie müssen eine Domain auswählen.",
    "mustSelectDomainNoPoint": "Sie müssen eine Domain auswählen",
    "noAutoresponderToDelete": "Kein Autoresponder zum Löschen vorhanden",
    "passwordChangeFailed": "Fehler beim Ändern des Passworts",
    "quotaInvalid": "Ungültige Quota",
    "routingLoadFailed": "Die E-Mail-Routing-Konfiguration konnte nicht geladen werden.",
    "routingSaveFailed": "Die E-Mail-Routing-Konfiguration konnte nicht gespeichert werden.",
    "saveFailed": "Fehler beim Speichern",
    "scoreTypesLoadFailed": "Der Katalog der Bewertungstypen konnte nicht geladen werden.",
    "selectDestAccount": "Wählen Sie ein Zielkonto aus",
    "selectValidDomain": "Wählen Sie eine gültige Domain aus.",
    "spamFiltersLoadFailed": "Die Spam-Filter konnten nicht geladen werden.",
    "spamFiltersSaveFailed": "Die Spam-Filter-Konfiguration konnte nicht gespeichert werden.",
    "testEmailFailed": "Testversand fehlgeschlagen",
    "toggleFailed": "Fehler beim Ändern des Status",
    "trackDeliveryLoadFailed": "Die Zustellungsverfolgung konnte nicht geladen werden."
  },
  "labels": {
    "accountColon": "Konto: {address}",
    "activating": "Wird aktiviert",
    "cloneStartedBg": "Klonen im Hintergrund gestartet. Wir benachrichtigen Sie, sobald es abgeschlossen ist.",
    "cloning": "Wird geklont…",
    "currentAccountColon": "Aktuelles Konto: {address}",
    "deactivating": "Wird deaktiviert",
    "destEmailForCount": "Ziel-E-Mail der Weiterleitung, die in {count} Konto/Konten hinzugefügt werden soll:",
    "loading": "Wird geladen...",
    "newQuotaFor": "Neue Quota in MB für {count} Konto/Konten. Verwenden Sie 0 für unbegrenzt.",
    "no": "Nein",
    "noGlobalLimit": "Kein globales Limit",
    "originColon": "Quelle: {addr}",
    "sendingTest": "Test wird gesendet…",
    "sudoPromptMessage": "Die Nutzung der Postfächer kann ohne Berechtigungen auf dem Server nicht gelesen werden. Geben Sie das sudo-Passwort des SSH-Benutzers ein (es wird verschlüsselt auf dem Server gespeichert).",
    "to": "an",
    "total": "Gesamt",
    "unlimited": "Unbegrenzt",
    "yes": "Ja",
    "keepCopy": "Kopie speichern"
  },
  "placeholders": {
    "passwordNoChanges": "•••••••• (keine Änderungen)",
    "selectDomain": "Domain auswählen...",
    "value": "Wert",
    "valueIfApplicable": "Wert (falls zutreffend)"
  },
  "status": {
    "active": "Aktiv",
    "deactivated": "Deaktiviert",
    "inactive": "Inaktiv"
  },
  "titles": {
    "addForward": "Weiterleitung hinzufügen",
    "changeQuota": "Quota ändern",
    "deleteAccounts": "Konten löschen",
    "deleteAutoresponder": "Autoresponder löschen",
    "deleteEncryptionKey": "Schlüssel löschen",
    "deleteForward": "Weiterleitung löschen"
  },
  "toasts": {
    "accountActivated": "Konto aktiviert",
    "accountCreated": "Konto erfolgreich erstellt",
    "accountDeactivated": "Konto deaktiviert",
    "accountDeleted": "Konto gelöscht",
    "accountUpdated": "Konto aktualisiert ({localPart}@{domain})",
    "archiveDefaultUpdated": "Standard-Archivkonfiguration aktualisiert.",
    "archiveDomainUpdated": "Archiv für {domain} aktualisiert.",
    "autoDeleteDisabled": "Automatisches Löschen deaktiviert",
    "autoDeleteEnabled": "Automatisches Löschen aktiviert",
    "autoDeleteUpdated": "Automatisches Löschen aktualisiert",
    "autoresponderDeleted": "Autoresponder gelöscht",
    "autoresponderSaved": "Autoresponder gespeichert",
    "blacklistUpdated": "Blacklist aktualisiert",
    "bulkDeletedCount": "{ok}/{count} Konto/Konten gelöscht",
    "bulkUpdatedCount": "{ok}/{count} Konto/Konten aktualisiert",
    "calculatedScoresUpdated": "Berechnete Bewertungen aktualisiert",
    "calendarCreated": "Kalender erstellt",
    "calendarDeleted": "Kalender gelöscht",
    "calendarUpdated": "Kalender aktualisiert",
    "cloneStarted": "Klonen gestartet — wir benachrichtigen Sie nach Abschluss",
    "contactCreated": "Kontakt erstellt",
    "contactDeleted": "Kontakt gelöscht",
    "contactUpdated": "Kontakt aktualisiert",
    "defaultAddressUpdated": "Standardadresse für @{domain} aktualisiert",
    "defaultInboxSet": "{address} ist jetzt die Standard-E-Mail",
    "domainForwardDeleted": "Globale Weiterleitung von @{domain} gelöscht",
    "emailRoutingUpdated": "E-Mail-Routing für @{domain} aktualisiert",
    "emailsCopied": "{count} E-Mails aus {folder} kopiert",
    "emailsDeleted": "{count} E-Mails aus {folder} gelöscht",
    "filterCreated": "Filter erstellt",
    "filterDeleted": "Filter gelöscht",
    "filterUpdated": "Filter aktualisiert",
    "forwardAddedCount": "Weiterleitung in {ok}/{count} Konto/Konten hinzugefügt",
    "forwardDeleted": "Weiterleitung gelöscht",
    "forwardsUpdated": "Weiterleitungen aktualisiert",
    "globalFilterCreated": "Globaler Filter erstellt",
    "globalFilterDeleted": "Globaler Filter gelöscht",
    "globalFilterUpdated": "Globaler Filter aktualisiert",
    "globalRedirectSaved": "Globale Weiterleitung für @{domain} gespeichert",
    "keyDeleted": "Schlüssel gelöscht.",
    "keyGenerated": "Schlüssel generiert.",
    "passwordUpdated": "Passwort aktualisiert",
    "publicKeyImported": "Öffentlicher Schlüssel importiert.",
    "settingsSaved": "Konfiguration gespeichert ✓",
    "spamBoxDisabled": "Spam-Ordner deaktiviert",
    "spamBoxEnabled": "Spam-Ordner aktiviert",
    "spamBoxUpdated": "Spam-Ordner aktualisiert",
    "spamFiltersDisabled": "Spam-Filter deaktiviert",
    "spamFiltersEnabled": "Spam-Filter aktiviert",
    "spamThresholdUpdated": "Spam-Schwellenwert aktualisiert",
    "testEmailSent": "Test-E-Mail gesendet ✓",
    "whitelistUpdated": "Whitelist aktualisiert"
  },
  "signaturesDrawer": {
    "title": "Signaturen",
    "addSignature": "Signatur hinzufügen",
    "close": "Schließen",
    "tableTitle": "Signaturen"
  },
  "dataTableTitles": {
    "rules": "Regeln",
    "publicKeys": "öffentliche Schlüssel",
    "privateKeys": "private Schlüssel",
    "accounts": "Konten",
    "globalFilters": "globale Filter",
    "contacts": "Kontakte",
    "calendars": "Kalender",
    "filters": "Filter"
  },
  "trackColumns": {
    "event": "Ereignis",
    "fromAddress": "Absenderadresse",
    "sentTime": "Sendezeit",
    "spamScore": "Spam-Bewertung",
    "recipient": "Empfänger",
    "domain": "Domain",
    "queueId": "ID",
    "result": "Ergebnis",
    "actions": "Aktionen"
  }
} as const;

export default mailPart2;
