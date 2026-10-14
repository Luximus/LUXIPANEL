const backups = {
  "pageTitle": "Backup",
  "settings": {
    "title": "Impostazioni backup",
    "description": "Destinazione e preferenze del server connesso.",
    "sections": "Sezioni delle impostazioni",
    "localHelp": "I backup locali di questo server sono archiviati qui.",
    "changeDirWarning": "Cambiare cartella eliminerà i backup locali precedenti dopo la conferma.",
    "retentionHelp": "Per i backup manuali e le nuove pianificazioni. Quelle esistenti mantengono il proprio limite.",
    "save": "Salva modifiche",
    "lastSuccess": "Ultimo backup riuscito",
    "localCopies": "Backup locali",
    "activeSchedules": "Pianificazioni attive",
    "advancedCron": "Espressione Cron personalizzata",
    "loading": "Caricamento impostazioni…",
    "loadError": "Impossibile caricare le impostazioni per questo server.",
    "pending": "Modifiche non salvate.",
    "countError": "Scegli tra 1 e 365 backup.",
    "saving": "Salvataggio…",
    "saved": "Impostazioni salvate.",
    "previewError": "Impossibile esaminare la cartella.",
    "destinationNotEmpty": "La nuova cartella contiene già backup LUXIPANEL.",
    "changeConfirm": "{count} backup locali in {path} verranno eliminati. I backup S3/R2 rimarranno. Cambiare cartella?",
    "changeTitle": "Cambia cartella dei backup",
    "changeError": "Impossibile cambiare cartella.",
    "tables": "Tabelle",
    "localHeading": "Destinazione locale",
    "overview": "Stato dei backup",
    "targetChanged": "Il server è cambiato; ricontrolla le sue impostazioni."
  },
  "status": {
    "completed": "Completato",
    "failed": "Non riuscito",
    "running": "In corso"
  },
  "header": {
    "heading": "Copie di sicurezza",
    "subheading": "Proteggi file, database, posta e configurazione del server.",
    "btnBackupNow": "Backup ora"
  },
  "configCard": {
    "title": "Configurazione backup",
    "subtitle": "Directory locale e archiviazione remota.",
    "labelLocalDir": "Directory backup locale",
    "placeholderLocalDir": "/var/backups/luxipanel",
    "labelRetentionDefault": "Backup locali da conservare per impostazione predefinita",
    "s3Section": "S3 / Cloudflare R2",
    "labelEndpoint": "Endpoint",
    "labelBucket": "Bucket",
    "labelAccessKeyId": "ID chiave di accesso",
    "labelSecretAccessKey": "Chiave di accesso segreta",
    "btnBrowse": "Sfoglia",
    "tabLocal": "Locale",
    "tabCloud": "Cloud"
  },
  "pathBrowserDialog": {
    "title": "Seleziona cartella",
    "btnUp": "Su",
    "btnCancel": "Annulla",
    "btnSelect": "Usa questa cartella"
  },
  "backupSources": {
    "title": "Cosa includere nel backup",
    "scopeFull": "Server completo (curato)",
    "scopeFullHint": "Database, posta, configurazione del pannello e /etc /home /var/www /root",
    "scopeCustom": "Personalizzato",
    "labelDatabases": "Database",
    "dbAll": "Tutti",
    "dbPick": "Scegli…",
    "dbChoose": "Scegli database",
    "dbNone": "Nessuno selezionato",
    "labelMail": "Posta (vmail + Postfix/Dovecot)",
    "labelPanelConfig": "Configurazione del pannello",
    "foldersTitle": "Cartelle",
    "addFolder": "Aggiungi cartella",
    "noFolders": "Nessuna cartella selezionata"
  },
  "dbPickerDialog": {
    "title": "Seleziona database",
    "loading": "Caricamento…",
    "btnCancel": "Annulla",
    "btnSelect": "Usa selezione",
    "btnRetry": "Riprova",
    "unavailableSelection": "Un database selezionato non è più disponibile. Controlla la selezione."
  },
  "storagesSection": {
    "subtitle": "Destinazioni cloud per i tuoi backup (S3 / Cloudflare R2).",
    "tableTitle": "archivi",
    "btnNew": "Nuovo storage"
  },
  "storageDialog": {
    "titleNew": "Nuovo storage cloud",
    "titleEdit": "Modifica storage cloud",
    "labelName": "Nome",
    "placeholderName": "Il mio bucket R2",
    "labelProvider": "Provider",
    "optS3": "Amazon S3",
    "optR2": "Cloudflare R2",
    "labelBucket": "Bucket",
    "labelPrefix": "Prefisso (cartella)",
    "placeholderPrefix": "backups/",
    "labelEndpoint": "Endpoint",
    "labelRegion": "Regione",
    "labelAccessKey": "ID chiave di accesso",
    "labelSecret": "Chiave di accesso segreta",
    "secretKeepHint": "Lascialo vuoto per conservare il segreto attuale.",
    "btnCancel": "Annulla",
    "btnSave": "Salva",
    "usingCentralCred": "Uso della credenziale centrale da Impostazioni → Credenziali (definisci solo il bucket).",
    "credRequired": "Nessuna credenziale {provider} configurata. Registrala in Impostazioni → Credenziali per usare questa destinazione.",
    "credRequiredCta": "Vai a Impostazioni → Credenziali"
  },
  "progress": {
    "creating": "Creazione del backup… Potrebbero volerci diversi minuti."
  },
  "historySection": {
    "title": "Cronologia backup",
    "tableTitle": "backup",
    "count": "{count} backup",
    "countPartial": "{shown} di {total} backup visualizzati"
  },
  "schedulesSection": {
    "title": "Programmi",
    "btnNew": "Nuovo",
    "loading": "Caricamento...",
    "active": "Attiva",
    "paused": "In pausa",
    "copies": "copie",
    "pause": "Pausa",
    "enable": "Attiva",
    "edit": "Modifica",
    "delete": "Elimina"
  },
  "backupDialog": {
    "title": "Crea backup manuale",
    "labelName": "Etichetta",
    "placeholderName": "pre-aggiornamento",
    "labelStorage": "Archiviazione",
    "optionLocal": "Locale",
    "optionS3": "AWS S3",
    "optionR2": "Cloudflare R2",
    "labelIncludeDb": "Includi dump PostgreSQL",
    "sourcesTitle": "Cosa salvare nel backup",
    "labelIncludeDatabases": "Database (MySQL/MariaDB + PostgreSQL)",
    "labelIncludeMail": "Account email (caselle di posta + configurazione)",
    "labelIncludePanelConfig": "Configurazione di LuxiPanel",
    "btnCancel": "Annulla",
    "btnStart": "Avvia backup"
  },
  "scheduleDialog": {
    "title": "Pianifica backup",
    "labelName": "Nome",
    "placeholderName": "Backup settimanale",
    "labelSchedule": "Orario (cron)",
    "placeholderSchedule": "0 3 * * 0",
    "labelStorage": "Archiviazione",
    "optionLocal": "Locale",
    "optionS3": "S3",
    "optionR2": "R2",
    "labelRetention": "Backup locali da conservare",
    "labelFrequency": "Frequenza",
    "optHourly": "Ogni ora",
    "optDaily": "Giornaliero",
    "optWeekly": "Settimanale",
    "optMonthly": "Mensile",
    "labelTime": "Ora",
    "labelWeekday": "Giorno della settimana",
    "labelMonthday": "Giorno del mese",
    "cronPreview": "Equivale a",
    "cronExample": "0 3 * * *",
    "weekdays": [
      "Domenica",
      "Lunedì",
      "Martedì",
      "Mercoledì",
      "Giovedì",
      "Venerdì",
      "Sabato"
    ],
    "btnCancel": "Annulla",
    "btnSave": "Salva",
    "localRetentionHint": "Verranno conservati i backup locali più recenti di questa pianificazione.",
    "cloudRetentionHint": "Configura la conservazione S3/R2 presso il provider cloud.",
    "editTitle": "Modifica pianificazione"
  },
  "toasts": {
    "errorSaveSettings": "Errore nel salvataggio della configurazione dei backup",
    "preparingDownload": "Preparazione del download…",
    "backupDeleted": "Backup eliminato",
    "backupsDeleted": "Backup eliminati",
    "scheduleDeleted": "Pianificazione eliminata",
    "errorDelete": "Errore nell'eliminazione",
    "errorCreateBackup": "Errore nella creazione del backup",
    "backupStarted": "Backup avviato",
    "backupCompleted": "Backup completato",
    "backupStillRunning": "Il backup è ancora in corso…",
    "scheduleCreated": "Pianificazione creata",
    "errorCreateSchedule": "Errore nella creazione della pianificazione",
    "storageDeleted": "Archivio eliminato",
    "storageUpdated": "Archivio aggiornato",
    "storageCreated": "Archivio creato",
    "errorSaveStorage": "Errore nel salvataggio dell'archivio",
    "recordRemoved": "Voce rimossa dalla cronologia"
  },
  "errors": {
    "listPathFailed": "Impossibile elencare questo percorso (permessi?).",
    "listDbFailed": "Impossibile elencare i database.",
    "downloadFailed": "Impossibile scaricare il backup",
    "backupErrorDetail": "Errore: {error}"
  },
  "empty": {
    "noSubfolders": "(nessuna sottocartella)",
    "noDbEngines": "Nessun motore di database attivo rilevato.",
    "noDatabases": "(nessun database)",
    "noneSelected": "Nessuna selezionata",
    "noSchedules": "Nessuna pianificazione"
  },
  "labels": {
    "loading": "Caricamento…",
    "fullServer": "server completo",
    "editStorage": "Modifica archivio",
    "newStorage": "Nuovo archivio"
  },
  "confirm": {
    "deleteBackup": "Eliminare il backup \"{label}\"?",
    "deleteBackupTitle": "Elimina backup",
    "deleteBulkBackup": "Eliminare {count} backup selezionati?",
    "deleteBulkBackupTitle": "Elimina backup",
    "deleteSchedule": "Eliminare questa pianificazione?",
    "deleteScheduleTitle": "Elimina pianificazione",
    "deleteStorage": "Eliminare l'archivio \"{name}\"?",
    "deleteStorageTitle": "Elimina archivio",
    "removeRecord": "Rimuovere «{label}» dalla cronologia? L'oggetto nel cloud verrà conservato.",
    "removeRecordTitle": "Rimuovi voce",
    "cloudBulkNote": "Gli oggetti S3/R2 verranno conservati."
  },
  "table": {
    "columns": {
      "label": "Etichetta",
      "status": "Stato",
      "size": "Dimensione",
      "storage": "Archiviazione",
      "fecha": "Data"
    },
    "storagesColumns": {
      "name": "Nome",
      "provider": "Provider",
      "bucket": "Bucket",
      "endpoint": "Endpoint"
    },
    "filters": {
      "searchBackupLabel": "Cerca etichetta...",
      "filterBackupStorage": "Archiviazione",
      "searchStorageName": "Cerca nome...",
      "filterStorageProvider": "Provider"
    },
    "rowActions": {
      "download": "Scarica",
      "removeRecord": "Rimuovi dalla cronologia",
      "details": "Vedi errore",
      "delete": "Elimina",
      "refresh": "Aggiorna stato"
    },
    "quickActions": {
      "deleteSelected": "Elimina selezionati"
    },
    "storagesRowActions": {
      "edit": "Modifica",
      "delete": "Elimina"
    }
  }
} as const;

export default backups;
