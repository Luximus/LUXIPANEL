const backups = {
  "pageTitle": "Sicherungen",
  "settings": {
    "title": "Backup-Einstellungen",
    "description": "Speicherort und Einstellungen für den verbundenen Server.",
    "sections": "Einstellungsbereiche",
    "localHelp": "Lokale Sicherungen dieses Servers werden hier gespeichert.",
    "changeDirWarning": "Beim Ändern des Ordners werden frühere lokale Sicherungen nach Bestätigung gelöscht.",
    "retentionHelp": "Für manuelle Sicherungen und neue Zeitpläne. Bestehende Zeitpläne behalten ihr eigenes Limit.",
    "save": "Änderungen speichern",
    "lastSuccess": "Letzte erfolgreiche Sicherung",
    "localCopies": "Lokale Sicherungen",
    "activeSchedules": "Aktive Zeitpläne",
    "advancedCron": "Eigener Cron-Ausdruck",
    "loading": "Einstellungen werden geladen…",
    "loadError": "Einstellungen für diesen Server konnten nicht geladen werden.",
    "pending": "Nicht gespeicherte Änderungen.",
    "countError": "Wählen Sie zwischen 1 und 365 Sicherungen.",
    "saving": "Wird gespeichert…",
    "saved": "Einstellungen gespeichert.",
    "previewError": "Ordner konnte nicht geprüft werden.",
    "destinationNotEmpty": "Der neue Ordner enthält bereits LUXIPANEL-Sicherungen.",
    "changeConfirm": "{count} lokale Sicherungen in {path} werden gelöscht. S3/R2-Sicherungen bleiben erhalten. Ordner ändern?",
    "changeTitle": "Sicherungsordner ändern",
    "changeError": "Ordner konnte nicht geändert werden.",
    "tables": "Tabellen",
    "localHeading": "Lokales Ziel",
    "overview": "Backup-Status",
    "targetChanged": "Der Server hat sich geändert; prüfen Sie seine Einstellungen erneut."
  },
  "status": {
    "completed": "Abgeschlossen",
    "failed": "Fehlgeschlagen",
    "running": "Läuft"
  },
  "header": {
    "heading": "Sicherungskopien",
    "subheading": "Dateien, Datenbanken, E-Mail und Konfiguration des Servers sichern.",
    "btnBackupNow": "Jetzt sichern"
  },
  "configCard": {
    "title": "Backup-Konfiguration",
    "subtitle": "Lokales Verzeichnis und Remote-Speicher.",
    "labelLocalDir": "Lokales Backup-Verzeichnis",
    "placeholderLocalDir": "/var/backups/luxipanel",
    "labelRetentionDefault": "Lokale Sicherungen standardmäßig behalten",
    "s3Section": "S3 / Cloudflare R2",
    "labelEndpoint": "Endpoint",
    "labelBucket": "Bucket",
    "labelAccessKeyId": "Zugriffsschlüssel-ID",
    "labelSecretAccessKey": "Geheimer Zugriffsschlüssel",
    "btnBrowse": "Durchsuchen",
    "tabLocal": "Lokal",
    "tabCloud": "Cloud"
  },
  "pathBrowserDialog": {
    "title": "Ordner auswählen",
    "btnUp": "Hochfahren",
    "btnCancel": "Abbrechen",
    "btnSelect": "Diesen Ordner verwenden"
  },
  "backupSources": {
    "title": "Was sichern",
    "scopeFull": "Vollständiger Server (kuratiert)",
    "scopeFullHint": "Datenbanken, E-Mail, Panel-Konfiguration und /etc /home /var/www /root",
    "scopeCustom": "Benutzerdefiniert",
    "labelDatabases": "Datenbanken",
    "dbAll": "Alle",
    "dbPick": "Auswählen…",
    "dbChoose": "Datenbanken auswählen",
    "dbNone": "Keine ausgewählt",
    "labelMail": "E-Mail (vmail + Postfix/Dovecot)",
    "labelPanelConfig": "Panel-Konfiguration",
    "foldersTitle": "Ordner",
    "addFolder": "Ordner hinzufügen",
    "noFolders": "Keine Ordner ausgewählt"
  },
  "dbPickerDialog": {
    "title": "Datenbanken auswählen",
    "loading": "Wird geladen…",
    "btnCancel": "Abbrechen",
    "btnSelect": "Auswahl übernehmen",
    "btnRetry": "Erneut versuchen",
    "unavailableSelection": "Eine ausgewählte Datenbank ist nicht mehr verfügbar. Prüfe die Auswahl."
  },
  "storagesSection": {
    "subtitle": "Cloud-Ziele für deine Backups (S3 / Cloudflare R2).",
    "tableTitle": "Speicher",
    "btnNew": "Neuer Speicher"
  },
  "storageDialog": {
    "titleNew": "Neuer Cloud-Speicher",
    "titleEdit": "Cloud-Speicher bearbeiten",
    "labelName": "Name",
    "placeholderName": "Mein R2-Bucket",
    "labelProvider": "Anbieter",
    "optS3": "Amazon S3",
    "optR2": "Cloudflare R2",
    "labelBucket": "Bucket",
    "labelPrefix": "Präfix (Ordner)",
    "placeholderPrefix": "backups/",
    "labelEndpoint": "Endpoint",
    "labelRegion": "Region",
    "labelAccessKey": "Zugriffsschlüssel-ID",
    "labelSecret": "Geheimer Zugriffsschlüssel",
    "secretKeepHint": "Leer lassen, um das aktuelle Secret beizubehalten.",
    "btnCancel": "Abbrechen",
    "btnSave": "Speichern",
    "usingCentralCred": "Verwendet die zentrale Anmeldeinformation aus Einstellungen → Anmeldeinformationen (nur Bucket definieren).",
    "credRequired": "Für {provider} ist keine Anmeldeinformation konfiguriert. Registrieren Sie sie in Einstellungen → Anmeldeinformationen, um dieses Ziel zu verwenden.",
    "credRequiredCta": "Zu Einstellungen → Anmeldeinformationen gehen"
  },
  "progress": {
    "creating": "Backup wird erstellt… Dies kann mehrere Minuten dauern."
  },
  "historySection": {
    "title": "Backup-Verlauf",
    "tableTitle": "Backups",
    "count": "{count} Sicherungen",
    "countPartial": "{shown} von {total} Sicherungen angezeigt"
  },
  "schedulesSection": {
    "title": "Zeitpläne",
    "btnNew": "Neu",
    "loading": "Wird geladen...",
    "active": "Aktiv",
    "paused": "Pausiert",
    "copies": "Kopien",
    "pause": "Pausieren",
    "enable": "Aktivieren",
    "edit": "Bearbeiten",
    "delete": "Löschen"
  },
  "backupDialog": {
    "title": "Manuelles Backup erstellen",
    "labelName": "Bezeichnung",
    "placeholderName": "vor-upgrade",
    "labelStorage": "Speicher",
    "optionLocal": "Lokal",
    "optionS3": "AWS S3",
    "optionR2": "Cloudflare R2",
    "labelIncludeDb": "PostgreSQL-Dump einschließen",
    "sourcesTitle": "Was sichern",
    "labelIncludeDatabases": "Datenbanken (MySQL/MariaDB + PostgreSQL)",
    "labelIncludeMail": "E-Mail-Konten (Mail-Speicher + Konfiguration)",
    "labelIncludePanelConfig": "LuxiPanel-Konfiguration",
    "btnCancel": "Abbrechen",
    "btnStart": "Backup starten"
  },
  "scheduleDialog": {
    "title": "Backup planen",
    "labelName": "Name",
    "placeholderName": "Wöchentliches Backup",
    "labelSchedule": "Zeitplan (Cron)",
    "placeholderSchedule": "0 3 * * 0",
    "labelStorage": "Speicher",
    "optionLocal": "Lokal",
    "optionS3": "S3",
    "optionR2": "R2",
    "labelRetention": "Lokale Sicherungen behalten",
    "labelFrequency": "Häufigkeit",
    "optHourly": "Stündlich",
    "optDaily": "Täglich",
    "optWeekly": "Wöchentlich",
    "optMonthly": "Monatlich",
    "labelTime": "Uhrzeit",
    "labelWeekday": "Wochentag",
    "labelMonthday": "Tag des Monats",
    "cronPreview": "Entspricht",
    "cronExample": "0 3 * * *",
    "weekdays": [
      "Sonntag",
      "Montag",
      "Dienstag",
      "Mittwoch",
      "Donnerstag",
      "Freitag",
      "Samstag"
    ],
    "btnCancel": "Abbrechen",
    "btnSave": "Speichern",
    "localRetentionHint": "Die neuesten lokalen Sicherungen dieses Zeitplans bleiben erhalten.",
    "cloudRetentionHint": "Konfigurieren Sie die Aufbewahrung für S3/R2 beim Cloud-Anbieter.",
    "editTitle": "Zeitplan bearbeiten"
  },
  "toasts": {
    "errorSaveSettings": "Fehler beim Speichern der Backup-Einstellungen",
    "preparingDownload": "Download wird vorbereitet…",
    "backupDeleted": "Backup gelöscht",
    "backupsDeleted": "Backups gelöscht",
    "scheduleDeleted": "Zeitplan gelöscht",
    "errorDelete": "Fehler beim Löschen",
    "errorCreateBackup": "Fehler beim Erstellen des Backups",
    "backupStarted": "Backup gestartet",
    "backupCompleted": "Backup abgeschlossen",
    "backupStillRunning": "Backup läuft noch…",
    "scheduleCreated": "Zeitplan erstellt",
    "errorCreateSchedule": "Fehler beim Erstellen des Zeitplans",
    "storageDeleted": "Speicher gelöscht",
    "storageUpdated": "Speicher aktualisiert",
    "storageCreated": "Speicher erstellt",
    "errorSaveStorage": "Fehler beim Speichern des Speichers",
    "recordRemoved": "Eintrag aus dem Verlauf entfernt"
  },
  "errors": {
    "listPathFailed": "Diese Route konnte nicht aufgelistet werden (Berechtigungen?).",
    "listDbFailed": "Datenbanken konnten nicht aufgelistet werden.",
    "downloadFailed": "Backup konnte nicht heruntergeladen werden",
    "backupErrorDetail": "Fehler: {error}"
  },
  "empty": {
    "noSubfolders": "(keine Unterordner)",
    "noDbEngines": "Keine aktiven Datenbank-Engines erkannt.",
    "noDatabases": "(keine Datenbanken)",
    "noneSelected": "Keine ausgewählt",
    "noSchedules": "Keine Zeitpläne"
  },
  "labels": {
    "loading": "Wird geladen…",
    "fullServer": "kompletter Server",
    "editStorage": "Speicher bearbeiten",
    "newStorage": "Neuer Speicher"
  },
  "confirm": {
    "deleteBackup": "Backup \"{label}\" löschen?",
    "deleteBackupTitle": "Backup löschen",
    "deleteBulkBackup": "{count} ausgewähltes(e) Backup(s) löschen?",
    "deleteBulkBackupTitle": "Backups löschen",
    "deleteSchedule": "Diesen Zeitplan löschen?",
    "deleteScheduleTitle": "Zeitplan löschen",
    "deleteStorage": "Speicher \"{name}\" löschen?",
    "deleteStorageTitle": "Speicher löschen",
    "removeRecord": "„{label}“ aus dem Verlauf entfernen? Das Objekt in der Cloud bleibt erhalten.",
    "removeRecordTitle": "Eintrag entfernen",
    "cloudBulkNote": "S3/R2-Objekte bleiben erhalten."
  },
  "table": {
    "columns": {
      "label": "Bezeichnung",
      "status": "Status",
      "size": "Größe",
      "storage": "Speicher",
      "fecha": "Datum"
    },
    "storagesColumns": {
      "name": "Name",
      "provider": "Anbieter",
      "bucket": "Bucket",
      "endpoint": "Endpoint"
    },
    "filters": {
      "searchBackupLabel": "Label suchen...",
      "filterBackupStorage": "Speicher",
      "searchStorageName": "Name suchen...",
      "filterStorageProvider": "Anbieter"
    },
    "rowActions": {
      "download": "Herunterladen",
      "removeRecord": "Aus Verlauf entfernen",
      "details": "Fehler anzeigen",
      "delete": "Löschen",
      "refresh": "Status aktualisieren"
    },
    "quickActions": {
      "deleteSelected": "Auswahl löschen"
    },
    "storagesRowActions": {
      "edit": "Bearbeiten",
      "delete": "Löschen"
    }
  }
} as const;

export default backups;
