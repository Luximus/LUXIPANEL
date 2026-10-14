const webhooks = {
  "pageTitle": "Webhooks und API Keys",
  "tabs": {
    "webhooks": "Webhooks",
    "apiKeys": "API-Schlüssel",
    "discovered": "Erkannt"
  },
  "webhooksPanel": {
    "description": "Ausgehende HTTP-Benachrichtigungen mit HMAC-Signatur",
    "btnNew": "Neuer Webhook"
  },
  "apiKeysPanel": {
    "description": "Programmgesteuerter Zugriff mit permanenten Token",
    "btnNew": "Neuer API Key"
  },
  "newKeyReveal": {
    "message": "API Key erstellt — jetzt kopieren, er wird nicht erneut angezeigt",
    "btnCopy": "Kopieren"
  },
  "webhookDialog": {
    "placeholderUrl": "https://beispiel.de/webhook",
    "title": "Neuer Webhook",
    "labelUrl": "Endpoint-URL",
    "labelEvents": "Zu überwachende Ereignisse",
    "labelEnabled": "Webhook aktiv",
    "btnCancel": "Abbrechen",
    "btnSave": "Speichern"
  },
  "apiKeyDialog": {
    "placeholderName": "Meine Integration",
    "title": "Neuer API Key",
    "labelName": "Beschreibender Name",
    "labelExpires": "Läuft ab (optional)",
    "btnCancel": "Abbrechen",
    "btnCreate": "Key erstellen"
  },
  "discovered": {
    "description": "Auf dem Server erkannte Webhooks (Git, nginx, cron, systemd, Konfigurationsdateien und Projekte)",
    "btnRescan": "Erneut scannen",
    "scanning": "Server wird gescannt…",
    "empty": "Keine Webhooks auf dem Server erkannt",
    "cols": {
      "source": "Quelle",
      "name": "Name",
      "target": "Ziel",
      "location": "Speicherort",
      "estado": "Status"
    },
    "filters": {
      "searchTarget": "Ziel suchen…",
      "source": "Quelle"
    },
    "sources": {
      "sidecar": "Panel",
      "git-hook": "Git Hook",
      "nginx": "Nginx",
      "cron": "Cron",
      "systemd": "systemd",
      "config": "Konfiguration",
      "project": "Projekt"
    },
    "status": {
      "enabled": "Aktiv",
      "disabled": "Inaktiv",
      "unknown": "—"
    },
    "actions": {
      "detail": "Details anzeigen",
      "delete": "Löschen"
    },
    "detail": {
      "title": "Details des erkannten Webhooks",
      "source": "Quelle",
      "target": "Ziel",
      "location": "Speicherort",
      "info": "Informationen",
      "raw": "Konfiguration",
      "managedNote": "Dieser Webhook wird vom Panel verwaltet",
      "readonlyNote": "Schreibgeschützt: Verwalte ihn über das entsprechende Modul",
      "btnClose": "Schließen"
    },
    "confirm": {
      "deleteTitle": "Erkannten Webhook löschen",
      "deleteBody": "\"{name}\" löschen? Dies ändert die Datei auf dem Server.",
      "deleteBtn": "Ja, löschen"
    },
    "toasts": {
      "deleted": "Gelöscht",
      "errorDeleting": "Konnte nicht gelöscht werden",
      "scanComplete": "Scan abgeschlossen: {count}",
      "notManageable": "Verwalte ihn über das entsprechende Modul"
    }
  },
  "labels": {
    "statusFailing": "Fehlgeschlagen",
    "statusActive": "Aktiv",
    "statusPaused": "Pausiert",
    "newWebhookTitle": "Neuer Webhook",
    "noExpiry": "Kein Ablaufdatum"
  },
  "confirm": {
    "rotateSecretBody": "Secret dieses Webhooks rotieren? Sie müssen den Empfänger aktualisieren.",
    "rotateSecretTitle": "Secret rotieren",
    "rotateSecretBtn": "Ja, rotieren",
    "deleteWebhookBody": "Diesen Webhook löschen?",
    "deleteWebhookTitle": "Webhook löschen",
    "revokeKeyBody": "API-Schlüssel \"{name}\" widerrufen?",
    "revokeKeyTitle": "API-Schlüssel widerrufen",
    "revokeKeyBtn": "Ja, widerrufen"
  },
  "toasts": {
    "secretRotated": "Secret rotiert",
    "errorRotating": "Fehler beim Rotieren",
    "webhookDeleted": "Webhook gelöscht",
    "errorDeleting": "Fehler beim Löschen",
    "webhookUpdated": "Webhook aktualisiert",
    "webhookCreated": "Webhook erstellt",
    "errorSaving": "Fehler beim Speichern",
    "keyRevoked": "Schlüssel widerrufen",
    "errorRevoking": "Fehler beim Widerrufen",
    "copiedToClipboard": "In die Zwischenablage kopiert",
    "errorCreatingKey": "Fehler beim Erstellen des Schlüssels"
  },
  "categories": {
    "receiveData": "Daten empfangen",
    "mailhook": "Mailhook",
    "response": "Webhook-Antwort",
    "soon": "Demnächst",
    "soonDesc": "Die Konfiguration und das Scannen dieser Kategorie werden in einer späteren Phase definiert."
  },
  "gateway": {
    "description": "Endpunkte, die das Panel bereitstellt, um eingehende Daten zu empfangen (Make.com-Stil). Authentifizierung per API key (x-make-apikey), IP-Beschränkung und Datenstruktur-Validierung.",
    "btnNew": "Neuer Webhook",
    "detectedTitle": "Erkannte Empfänger auf dem Server",
    "urlReveal": "Webhook-URL – Anfragen hier senden",
    "cols": {
      "name": "Name",
      "auth": "Auth",
      "recibidos": "Empfangen",
      "ultima": "Zuletzt",
      "estado": "Status",
      "estadoActive": "Aktiv",
      "estadoPaused": "Pausiert"
    },
    "dialog": {
      "titleNew": "Webhook erstellen",
      "titleEdit": "Webhook bearbeiten",
      "name": "Webhook-Name",
      "namePlaceholder": "Mein Gateway-Webhook",
      "nameHint": "Muss zwischen 1 und 128 Zeichen lang sein.",
      "apiAuth": "Authentifizierung per API key",
      "apiAuthHint": "API key im Header x-make-apikey senden. Einen oder mehrere hinzufügen; stimmt einer überein, wird der Zugriff gewährt.",
      "apiKeyName": "Name",
      "apiKeyValue": "API-Key-Wert",
      "apiKeyKeep": "(gespeichert – leer lassen, um beizubehalten)",
      "addApiKey": "API key hinzufügen",
      "ipTitle": "IP-Beschränkungen",
      "ipHint": "Kommagetrennte IP-Liste. CIDR-Notation möglich. Leer = keine Prüfung.",
      "dataStructure": "Datenstruktur",
      "dataStructureHint": "Validierung der eingehenden Daten. Leer = ohne Validierung akzeptiert.",
      "dsValidate": "Datenstruktur validieren",
      "dsStrict": "Strikt (nicht angegebene Felder ablehnen)",
      "dsFieldName": "Name",
      "dsFieldDesc": "Beschreibung",
      "dsFieldType": "Typ",
      "dsFieldDefault": "Standardwert",
      "dsFieldRequired": "Erforderlich",
      "dsFieldMultiline": "Mehrzeilig",
      "addItem": "Feld hinzufügen",
      "getHeaders": "Anfrage-Header abrufen",
      "getHeadersHint": "Die Header werden dem Body hinzugefügt.",
      "getMethod": "HTTP-Methode abrufen",
      "getMethodHint": "Die Methode (Verb) wird dem Body hinzugefügt.",
      "jsonPassthrough": "JSON als Text speichern",
      "jsonPassthroughHint": "Wenn aktiviert, wird der JSON-Payload als String gespeichert.",
      "enabled": "Webhook aktiv",
      "advanced": "Erweiterte Einstellungen",
      "btnCancel": "Abbrechen",
      "btnSave": "Speichern"
    },
    "payloads": {
      "title": "Empfangene Payloads",
      "empty": "Noch keine Payloads empfangen.",
      "btnClose": "Schließen"
    },
    "confirm": {
      "deleteTitle": "Webhook löschen",
      "deleteBody": "Webhook \"{name}\" löschen? Gespeicherte Payloads gehen verloren.",
      "deleteBtn": "Ja, löschen"
    },
    "toasts": {
      "created": "Webhook erstellt",
      "updated": "Webhook aktualisiert",
      "deleted": "Webhook gelöscht",
      "copied": "URL kopiert",
      "error": "Fehler beim Speichern"
    }
  },
  "table": {
    "gateway": {
      "columns": {
        "name": "Name",
        "auth": "Auth",
        "recibidos": "Empfangen",
        "ultima": "Letzte",
        "estado": "Status"
      },
      "filters": {
        "searchName": "Name suchen…",
        "estado": "Status"
      },
      "rowActions": {
        "copy": "URL kopieren",
        "payloads": "Payloads anzeigen",
        "edit": "Bearbeiten",
        "delete": "Löschen"
      },
      "options": {
        "statusActive": "Aktiv",
        "statusPaused": "Pausiert"
      }
    },
    "webhooks": {
      "columns": {
        "url": "URL",
        "eventos": "Ereignisse",
        "estado": "Status"
      },
      "filters": {
        "searchUrl": "URL suchen…",
        "estado": "Status"
      },
      "rowActions": {
        "regenerate": "Secret rotieren",
        "delete": "Löschen"
      },
      "options": {
        "statusActive": "Aktiv",
        "statusPaused": "Pausiert",
        "statusFailing": "Fehlgeschlagen"
      }
    },
    "apiKeys": {
      "columns": {
        "name": "Name",
        "prefix": "Präfix",
        "creada": "Erstellt",
        "expira": "Läuft ab"
      },
      "filters": {
        "searchName": "Name suchen…"
      },
      "rowActions": {
        "revoke": "Widerrufen"
      }
    },
    "discovered": {
      "columns": {
        "origen": "Quelle",
        "name": "Name",
        "target": "Ziel",
        "location": "Speicherort",
        "estado": "Status"
      },
      "filters": {
        "searchTarget": "Ziel suchen…",
        "origen": "Quelle"
      },
      "rowActions": {
        "detail": "Details anzeigen",
        "delete": "Löschen"
      },
      "options": {
        "panel": "Panel",
        "gitHook": "Git Hook",
        "nginx": "Nginx",
        "cron": "Cron",
        "systemd": "systemd",
        "config": "Konfiguration",
        "proyecto": "Projekt"
      }
    }
  },
  "runtime": {
    "testDelivered": "Test erfolgreich zugestellt.",
    "testFailed": "Testzustellung fehlgeschlagen.",
    "loadingDeliveries": "Zustellungen werden geladen…",
    "loadDeliveriesError": "Zustellungen konnten nicht geladen werden.",
    "noDeliveries": "Noch keine Zustellungen erfasst.",
    "delivered": "Zugestellt",
    "failed": "Fehlgeschlagen",
    "attempts": "Versuche: {count}",
    "selectEvent": "Wähle mindestens ein Ereignis aus."
  },
  "settingsUi": {
    "title": "Webhooks-Einstellungen",
    "description": "Seitennummerierung und sichtbare Aktionen der Webhooks-Tabellen.",
    "gateway": "Gateway",
    "webhooks": "Webhooks",
    "signingSecret": "Signaturschlüssel · jetzt kopieren",
    "signingSecretHint": "Wird nur einmal angezeigt. Richten Sie ihn beim Empfänger ein, um X-Luxipanel-Signature zu prüfen.",
    "recentDeliveries": "Letzte Zustellungen"
  }
} as const;

export default webhooks;
