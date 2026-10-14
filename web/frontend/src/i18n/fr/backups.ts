const backups = {
  "pageTitle": "Sauvegardes",
  "settings": {
    "title": "Paramètres de sauvegarde",
    "description": "Destination et préférences du serveur connecté.",
    "sections": "Sections des paramètres",
    "localHelp": "Les sauvegardes locales de ce serveur sont stockées ici.",
    "changeDirWarning": "Changer de dossier supprimera les anciennes sauvegardes locales après confirmation.",
    "retentionHelp": "Pour les sauvegardes manuelles et les nouvelles planifications. Les planifications existantes conservent leur propre limite.",
    "save": "Enregistrer les modifications",
    "lastSuccess": "Dernière sauvegarde réussie",
    "localCopies": "Sauvegardes locales",
    "activeSchedules": "Planifications actives",
    "advancedCron": "Expression Cron personnalisée",
    "loading": "Chargement des paramètres…",
    "loadError": "Impossible de charger les paramètres de ce serveur.",
    "pending": "Modifications non enregistrées.",
    "countError": "Choisissez entre 1 et 365 sauvegardes.",
    "saving": "Enregistrement…",
    "saved": "Paramètres enregistrés.",
    "previewError": "Impossible d'inspecter le dossier.",
    "destinationNotEmpty": "Le nouveau dossier contient déjà des sauvegardes LUXIPANEL.",
    "changeConfirm": "{count} sauvegardes locales dans {path} seront supprimées. Les sauvegardes S3/R2 seront conservées. Changer de dossier ?",
    "changeTitle": "Changer le dossier de sauvegarde",
    "changeError": "Impossible de changer de dossier.",
    "tables": "Tableaux",
    "localHeading": "Destination locale",
    "overview": "État des sauvegardes",
    "targetChanged": "Le serveur a changé ; vérifiez de nouveau sa configuration."
  },
  "status": {
    "completed": "Terminée",
    "failed": "Échouée",
    "running": "En cours"
  },
  "header": {
    "heading": "Sauvegardes",
    "subheading": "Protégez les fichiers, bases de données, courriels et paramètres du serveur.",
    "btnBackupNow": "Sauvegarder maintenant"
  },
  "configCard": {
    "title": "Configuration des sauvegardes",
    "subtitle": "Répertoire local et stockage distant.",
    "labelLocalDir": "Répertoire local des sauvegardes",
    "placeholderLocalDir": "/var/backups/luxipanel",
    "labelRetentionDefault": "Sauvegardes locales à conserver par défaut",
    "s3Section": "S3 / Cloudflare R2",
    "labelEndpoint": "Endpoint",
    "labelBucket": "Bucket",
    "labelAccessKeyId": "ID de clé d'accès",
    "labelSecretAccessKey": "Clé d'accès secrète",
    "btnBrowse": "Parcourir",
    "tabLocal": "Local",
    "tabCloud": "Cloud"
  },
  "pathBrowserDialog": {
    "title": "Sélectionner un dossier",
    "btnUp": "Remonter",
    "btnCancel": "Annuler",
    "btnSelect": "Utiliser ce dossier"
  },
  "backupSources": {
    "title": "Que sauvegarder",
    "scopeFull": "Serveur complet (sélection optimisée)",
    "scopeFullHint": "Bases de données, courrier, configuration du panneau et /etc /home /var/www /root",
    "scopeCustom": "Personnalisé",
    "labelDatabases": "Bases de données",
    "dbAll": "Toutes",
    "dbPick": "Choisir…",
    "dbChoose": "Choisir les bases de données",
    "dbNone": "Aucune sélectionnée",
    "labelMail": "Courrier (vmail + Postfix/Dovecot)",
    "labelPanelConfig": "Configuration du panneau",
    "foldersTitle": "Dossiers",
    "addFolder": "Ajouter un dossier",
    "noFolders": "Aucun dossier sélectionné"
  },
  "dbPickerDialog": {
    "title": "Sélectionner les bases de données",
    "loading": "Chargement…",
    "btnCancel": "Annuler",
    "btnSelect": "Utiliser la sélection",
    "btnRetry": "Réessayer",
    "unavailableSelection": "Une base de données sélectionnée n’est plus disponible. Vérifiez la sélection."
  },
  "storagesSection": {
    "subtitle": "Destinations cloud pour vos sauvegardes (S3 / Cloudflare R2).",
    "tableTitle": "stockages",
    "btnNew": "Nouveau stockage"
  },
  "storageDialog": {
    "titleNew": "Nouveau stockage cloud",
    "titleEdit": "Modifier le stockage cloud",
    "labelName": "Nom",
    "placeholderName": "Mon bucket R2",
    "labelProvider": "Fournisseur",
    "optS3": "Amazon S3",
    "optR2": "Cloudflare R2",
    "labelBucket": "Bucket",
    "labelPrefix": "Préfixe (dossier)",
    "placeholderPrefix": "backups/",
    "labelEndpoint": "Endpoint",
    "labelRegion": "Région",
    "labelAccessKey": "ID de clé d'accès",
    "labelSecret": "Clé secrète",
    "secretKeepHint": "Laissez vide pour conserver le secret actuel.",
    "btnCancel": "Annuler",
    "btnSave": "Enregistrer",
    "usingCentralCred": "Utilisation de la credential centrale de Paramètres → Credentials (définissez uniquement le bucket)",
    "credRequired": "Aucune credential {provider} configurée. Enregistrez-la dans Paramètres → Credentials pour utiliser cette destination.",
    "credRequiredCta": "Aller à Paramètres → Credentials"
  },
  "progress": {
    "creating": "Création de la sauvegarde… Cela peut prendre plusieurs minutes."
  },
  "historySection": {
    "title": "Historique des sauvegardes",
    "tableTitle": "sauvegardes",
    "count": "{count} sauvegardes",
    "countPartial": "{shown} sauvegardes affichées sur {total}"
  },
  "schedulesSection": {
    "title": "Planifications",
    "btnNew": "Nouvelle",
    "loading": "Chargement...",
    "active": "Active",
    "paused": "En pause",
    "copies": "copies",
    "pause": "Suspendre",
    "enable": "Activer",
    "edit": "Modifier",
    "delete": "Supprimer"
  },
  "backupDialog": {
    "title": "Créer une sauvegarde manuelle",
    "labelName": "Étiquette",
    "placeholderName": "pré-mise-à-jour",
    "labelStorage": "Stockage",
    "optionLocal": "Local",
    "optionS3": "AWS S3",
    "optionR2": "Cloudflare R2",
    "labelIncludeDb": "Inclure le dump PostgreSQL",
    "sourcesTitle": "Que sauvegarder",
    "labelIncludeDatabases": "Bases de données (MySQL/MariaDB + PostgreSQL)",
    "labelIncludeMail": "Comptes e-mail (stockage des e-mails + config)",
    "labelIncludePanelConfig": "Configuration LuxiPanel",
    "btnCancel": "Annuler",
    "btnStart": "Démarrer la sauvegarde"
  },
  "scheduleDialog": {
    "title": "Planifier une sauvegarde",
    "labelName": "Nom",
    "placeholderName": "Sauvegarde hebdomadaire",
    "labelSchedule": "Horaire (cron)",
    "placeholderSchedule": "0 3 * * 0",
    "labelStorage": "Stockage",
    "optionLocal": "Local",
    "optionS3": "S3",
    "optionR2": "R2",
    "labelRetention": "Sauvegardes locales à conserver",
    "labelFrequency": "Fréquence",
    "optHourly": "Toutes les heures",
    "optDaily": "Quotidien",
    "optWeekly": "Hebdomadaire",
    "optMonthly": "Mensuel",
    "labelTime": "Heure",
    "labelWeekday": "Jour de la semaine",
    "labelMonthday": "Jour du mois",
    "cronPreview": "Équivaut à",
    "cronExample": "0 3 * * *",
    "weekdays": [
      "Dimanche",
      "Lundi",
      "Mardi",
      "Mercredi",
      "Jeudi",
      "Vendredi",
      "Samedi"
    ],
    "btnCancel": "Annuler",
    "btnSave": "Enregistrer",
    "localRetentionHint": "Les sauvegardes locales les plus récentes de cette planification seront conservées.",
    "cloudRetentionHint": "Configurez la rétention S3/R2 auprès du fournisseur cloud.",
    "editTitle": "Modifier la planification"
  },
  "toasts": {
    "errorSaveSettings": "Erreur lors de l'enregistrement des paramètres de sauvegarde",
    "preparingDownload": "Préparation du téléchargement…",
    "backupDeleted": "Sauvegarde supprimée",
    "backupsDeleted": "Sauvegardes supprimées",
    "scheduleDeleted": "Programmation supprimée",
    "errorDelete": "Erreur lors de la suppression",
    "errorCreateBackup": "Erreur lors de la création de la sauvegarde",
    "backupStarted": "Sauvegarde lancée",
    "backupCompleted": "Sauvegarde terminée",
    "backupStillRunning": "La sauvegarde est toujours en cours…",
    "scheduleCreated": "Programmation créée",
    "errorCreateSchedule": "Erreur lors de la création de la programmation",
    "storageDeleted": "Stockage supprimé",
    "storageUpdated": "Stockage mis à jour",
    "storageCreated": "Stockage créé",
    "errorSaveStorage": "Erreur lors de l'enregistrement du stockage",
    "recordRemoved": "Entrée retirée de l'historique"
  },
  "errors": {
    "listPathFailed": "Impossible de lister ce chemin (permissions ?)",
    "listDbFailed": "Impossible de lister les bases de données",
    "downloadFailed": "Impossible de télécharger la sauvegarde",
    "backupErrorDetail": "Erreur : {error}"
  },
  "empty": {
    "noSubfolders": "(pas de sous-dossiers)",
    "noDbEngines": "Aucun moteur de base de données actif détecté.",
    "noDatabases": "(pas de bases de données)",
    "noneSelected": "Aucune sélectionnée",
    "noSchedules": "Pas de programmations"
  },
  "labels": {
    "loading": "Chargement…",
    "fullServer": "serveur complet",
    "editStorage": "Modifier le stockage",
    "newStorage": "Nouveau stockage"
  },
  "confirm": {
    "deleteBackup": "Supprimer la sauvegarde « {label} » ?",
    "deleteBackupTitle": "Supprimer la sauvegarde",
    "deleteBulkBackup": "Supprimer {count} sauvegarde(s) sélectionnée(s) ?",
    "deleteBulkBackupTitle": "Supprimer les sauvegardes",
    "deleteSchedule": "Supprimer cette programmation ?",
    "deleteScheduleTitle": "Supprimer la programmation",
    "deleteStorage": "Supprimer le stockage « {name} » ?",
    "deleteStorageTitle": "Supprimer le stockage",
    "removeRecord": "Retirer « {label} » de l'historique ? L'objet dans le cloud sera conservé.",
    "removeRecordTitle": "Retirer l'entrée",
    "cloudBulkNote": "Les objets S3/R2 seront conservés."
  },
  "table": {
    "columns": {
      "label": "Étiquette",
      "status": "État",
      "size": "Taille",
      "storage": "Stockage",
      "fecha": "Date"
    },
    "storagesColumns": {
      "name": "Nom",
      "provider": "Fournisseur",
      "bucket": "Bucket",
      "endpoint": "Endpoint"
    },
    "filters": {
      "searchBackupLabel": "Rechercher un label...",
      "filterBackupStorage": "Stockage",
      "searchStorageName": "Rechercher un nom...",
      "filterStorageProvider": "Fournisseur"
    },
    "rowActions": {
      "download": "Télécharger",
      "removeRecord": "Retirer de l’historique",
      "details": "Voir l’erreur",
      "delete": "Supprimer",
      "refresh": "Actualiser l'état"
    },
    "quickActions": {
      "deleteSelected": "Supprimer la sélection"
    },
    "storagesRowActions": {
      "edit": "Modifier",
      "delete": "Supprimer"
    }
  }
} as const;

export default backups;
