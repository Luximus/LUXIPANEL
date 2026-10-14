const backups = {
  "pageTitle": "Backups",
  "settings": {
    "title": "Backup settings",
    "description": "Destination and preferences for the connected server.",
    "sections": "Settings sections",
    "tables": "Tables",
    "localHeading": "Local destination",
    "localHelp": "Local backups for this server are stored here.",
    "changeDirWarning": "Changing the folder will delete previous local backups after confirmation.",
    "retentionHelp": "For manual backups and new schedules. Existing schedules keep their own limit.",
    "save": "Save changes",
    "overview": "Backup status",
    "lastSuccess": "Last successful backup",
    "localCopies": "Local backups",
    "activeSchedules": "Active schedules",
    "advancedCron": "Custom cron expression",
    "loading": "Loading settings…",
    "loadError": "Could not load settings for this server.",
    "pending": "Unsaved changes.",
    "countError": "Choose between 1 and 365 backups.",
    "saving": "Saving…",
    "saved": "Settings saved.",
    "previewError": "Could not inspect the folder.",
    "destinationNotEmpty": "The new folder already contains LUXIPANEL backups.",
    "changeConfirm": "{count} local backups in {path} will be deleted. S3/R2 backups will remain. Change the folder?",
    "changeTitle": "Change backup folder",
    "changeError": "Could not change the folder.",
    "targetChanged": "The server changed; review its settings again."
  },
  "status": {
    "completed": "Completed",
    "failed": "Failed",
    "running": "Running"
  },
  "header": {
    "heading": "Backups",
    "subheading": "Protect server files, databases, mail, and configuration.",
    "btnBackupNow": "Back up now"
  },
  "configCard": {
    "title": "Backup configuration",
    "subtitle": "Local directory and remote storage.",
    "labelLocalDir": "Local backups directory",
    "placeholderLocalDir": "/var/backups/luxipanel",
    "labelRetentionDefault": "Local backups to keep by default",
    "s3Section": "S3 / Cloudflare R2",
    "labelEndpoint": "Endpoint",
    "labelBucket": "Bucket",
    "labelAccessKeyId": "Access Key ID",
    "labelSecretAccessKey": "Secret Access Key",
    "btnBrowse": "Browse",
    "tabLocal": "Local",
    "tabCloud": "Cloud"
  },
  "pathBrowserDialog": {
    "title": "Select folder",
    "btnUp": "Up",
    "btnCancel": "Cancel",
    "btnSelect": "Use this folder"
  },
  "backupSources": {
    "title": "What to back up",
    "scopeFull": "Full server (curated)",
    "scopeFullHint": "Databases, mail, panel configuration and /etc /home /var/www /root",
    "scopeCustom": "Custom",
    "labelDatabases": "Databases",
    "dbAll": "All",
    "dbPick": "Choose…",
    "dbChoose": "Choose databases",
    "dbNone": "None selected",
    "labelMail": "Mail (vmail + Postfix/Dovecot)",
    "labelPanelConfig": "Panel configuration",
    "foldersTitle": "Folders",
    "addFolder": "Add folder",
    "noFolders": "No folders selected"
  },
  "dbPickerDialog": {
    "title": "Select databases",
    "loading": "Loading…",
    "btnCancel": "Cancel",
    "btnSelect": "Use selection",
    "btnRetry": "Retry",
    "unavailableSelection": "A selected database is no longer available. Review the selection."
  },
  "storagesSection": {
    "subtitle": "Cloud destinations for your backups (S3 / Cloudflare R2).",
    "tableTitle": "storages",
    "btnNew": "New storage"
  },
  "storageDialog": {
    "titleNew": "New cloud storage",
    "titleEdit": "Edit cloud storage",
    "labelName": "Name",
    "placeholderName": "My R2 bucket",
    "labelProvider": "Provider",
    "optS3": "Amazon S3",
    "optR2": "Cloudflare R2",
    "labelBucket": "Bucket",
    "labelPrefix": "Prefix (folder)",
    "placeholderPrefix": "backups/",
    "labelEndpoint": "Endpoint",
    "labelRegion": "Region",
    "labelAccessKey": "Access Key ID",
    "labelSecret": "Secret Access Key",
    "secretKeepHint": "Leave empty to keep the current secret.",
    "btnCancel": "Cancel",
    "btnSave": "Save",
    "usingCentralCred": "Using the central credential from Settings → Credentials (you only define the bucket).",
    "credRequired": "No {provider} credential configured. Register it in Settings → Credentials to use this destination.",
    "credRequiredCta": "Go to Settings → Credentials"
  },
  "progress": {
    "creating": "Creating backup… This may take several minutes."
  },
  "historySection": {
    "title": "Backup history",
    "tableTitle": "Backups",
    "count": "{count} backups",
    "countPartial": "Showing {shown} of {total} backups"
  },
  "schedulesSection": {
    "title": "Schedules",
    "btnNew": "New",
    "loading": "Loading...",
    "active": "Active",
    "paused": "Paused",
    "copies": "backups",
    "pause": "Pause",
    "enable": "Enable",
    "edit": "Edit",
    "delete": "Delete"
  },
  "backupDialog": {
    "title": "Create manual backup",
    "labelName": "Label",
    "placeholderName": "pre-upgrade",
    "labelStorage": "Storage",
    "optionLocal": "Local",
    "optionS3": "AWS S3",
    "optionR2": "Cloudflare R2",
    "labelIncludeDb": "Include PostgreSQL dump",
    "sourcesTitle": "What to back up",
    "labelIncludeDatabases": "Databases (MySQL/MariaDB + PostgreSQL)",
    "labelIncludeMail": "Email accounts (mail store + config)",
    "labelIncludePanelConfig": "LuxiPanel configuration",
    "btnCancel": "Cancel",
    "btnStart": "Start backup"
  },
  "scheduleDialog": {
    "title": "Schedule backup",
    "labelName": "Name",
    "placeholderName": "Weekly backup",
    "labelSchedule": "Schedule (cron)",
    "placeholderSchedule": "0 3 * * 0",
    "labelStorage": "Storage",
    "optionLocal": "Local",
    "optionS3": "S3",
    "optionR2": "R2",
    "labelRetention": "Local backups to keep",
    "localRetentionHint": "The latest local backups from this schedule will be kept.",
    "cloudRetentionHint": "Configure S3/R2 retention with the cloud provider.",
    "editTitle": "Edit schedule",
    "labelFrequency": "Frequency",
    "optHourly": "Hourly",
    "optDaily": "Daily",
    "optWeekly": "Weekly",
    "optMonthly": "Monthly",
    "labelTime": "Time",
    "labelWeekday": "Day of the week",
    "labelMonthday": "Day of the month",
    "cronPreview": "Equivalent to",
    "cronExample": "0 3 * * *",
    "weekdays": [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday"
    ],
    "btnCancel": "Cancel",
    "btnSave": "Save"
  },
  "toasts": {
    "errorSaveSettings": "Error saving backup settings",
    "preparingDownload": "Preparing download…",
    "backupDeleted": "Backup deleted",
    "recordRemoved": "Record removed from history",
    "backupsDeleted": "Backups deleted",
    "scheduleDeleted": "Schedule deleted",
    "errorDelete": "Error deleting",
    "errorCreateBackup": "Error creating backup",
    "backupStarted": "Backup started",
    "backupCompleted": "Backup completed",
    "backupStillRunning": "Backup still running…",
    "scheduleCreated": "Schedule created",
    "errorCreateSchedule": "Error creating schedule",
    "storageDeleted": "Storage deleted",
    "storageUpdated": "Storage updated",
    "storageCreated": "Storage created",
    "errorSaveStorage": "Error saving storage"
  },
  "errors": {
    "listPathFailed": "Could not list this path (permissions?).",
    "listDbFailed": "Could not list databases.",
    "downloadFailed": "Could not download backup",
    "backupErrorDetail": "Error: {error}"
  },
  "empty": {
    "noSubfolders": "(no subfolders)",
    "noDbEngines": "No active database engines detected.",
    "noDatabases": "(no databases)",
    "noneSelected": "None selected",
    "noSchedules": "No schedules"
  },
  "labels": {
    "loading": "Loading…",
    "fullServer": "full server",
    "editStorage": "Edit storage",
    "newStorage": "New storage"
  },
  "confirm": {
    "deleteBackup": "Delete backup \"{label}\"?",
    "deleteBackupTitle": "Delete backup",
    "removeRecord": "Remove “{label}” from history? The cloud object will remain.",
    "removeRecordTitle": "Remove record",
    "cloudBulkNote": "S3/R2 objects will remain.",
    "deleteBulkBackup": "Delete {count} selected backup(s)?",
    "deleteBulkBackupTitle": "Delete backups",
    "deleteSchedule": "Delete this schedule?",
    "deleteScheduleTitle": "Delete schedule",
    "deleteStorage": "Delete storage \"{name}\"?",
    "deleteStorageTitle": "Delete storage"
  },
  "table": {
    "columns": {
      "label": "Name",
      "status": "Status",
      "size": "Size",
      "storage": "Destination",
      "fecha": "Date"
    },
    "storagesColumns": {
      "name": "Name",
      "provider": "Provider",
      "bucket": "Bucket",
      "endpoint": "Endpoint"
    },
    "filters": {
      "searchBackupLabel": "Search backup...",
      "filterBackupStorage": "Destination",
      "searchStorageName": "Search name...",
      "filterStorageProvider": "Provider"
    },
    "rowActions": {
      "download": "Download",
      "delete": "Delete backup",
      "removeRecord": "Remove from history",
      "details": "View error",
      "refresh": "Refresh status"
    },
    "quickActions": {
      "deleteSelected": "Delete selected"
    },
    "storagesRowActions": {
      "edit": "Edit",
      "delete": "Delete"
    }
  }
} as const;

export default backups;
