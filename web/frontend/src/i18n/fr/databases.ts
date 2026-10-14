const databases = {
  "pageTitle": "Bases de données",
  "header": {
    "heading": "Gestionnaire de bases de données",
    "subheading": "Explorez et interrogez les bases de données du serveur (MySQL/MariaDB, PostgreSQL)."
  },
  "databases": {
    "title": "Bases de données"
  },
  "tables": {
    "title": "Tables"
  },
  "tabs": {
    "rows": "Lignes",
    "structure": "Structure",
    "console": "Console SQL"
  },
  "rows": {
    "prev": "Précédent",
    "next": "Suivant"
  },
  "console": {
    "placeholder": "SELECT * FROM ...",
    "run": "Exécuter",
    "allowWrite": "Autoriser l'écriture",
    "hint": "Ctrl/⌘ + Entrée pour exécuter. Les instructions d'écriture/DDL nécessitent de cocher « Autoriser l'écriture »."
  },
  "common": {
    "selectEngine": "Sélectionnez un moteur.",
    "selectDb": "Sélectionnez une base de données.",
    "selectTable": "Sélectionnez une table."
  },
  "actions": {
    "export": "Exporter",
    "addRecord": "Insérer un enregistrement",
    "cancel": "Annuler",
    "save": "Enregistrer",
    "edit": "Modifier",
    "downloadSql": "Télécharger SQL",
    "install": "Installer {label}"
  },
  "titles": {
    "record": "Enregistrement",
    "exportDb": "Exporter la base de données",
    "editRecord": "Modifier l'enregistrement · {table}",
    "newRecord": "Nouvel enregistrement · {table}"
  },
  "labels": {
    "tablesLabel": "Tables",
    "allTables": "Toutes",
    "includeData": "Inclure les données",
    "active": "Actif",
    "actions": "Actions",
    "colName": "Colonne",
    "colType": "Type",
    "colNullable": "Null",
    "colKey": "Clé",
    "colDefault": "Par défaut",
    "yes": "Oui",
    "no": "Non",
    "primaryKey": "Clé primaire",
    "tbl": "tbl"
  },
  "install": {
    "title": "Installer le moteur de base de données",
    "description": "Installez MariaDB ou PostgreSQL sur le serveur connecté pour commencer à gérer les bases de données.",
    "mariadb": "MariaDB",
    "postgresql": "PostgreSQL"
  },
  "empty": {
    "noResults": "Aucun résultat.",
    "noEngines": "Aucun moteur de base de données actif sur le serveur. Installez-en un pour commencer.",
    "noDatabases": "Pas de bases de données.",
    "noTables": "Pas de tables."
  },
  "errors": {
    "detectEngines": "Erreur lors de la détection des moteurs",
    "loadRows": "Erreur lors du chargement des lignes",
    "saveRecord": "Impossible d'enregistrer l'enregistrement",
    "deleteRecord": "Impossible de supprimer l'enregistrement",
    "networkError": "Erreur réseau",
    "runQuery": "Erreur lors de l'exécution de la requête"
  },
  "loading": {
    "generic": "Chargement…",
    "rows": "Chargement des lignes…",
    "structure": "Chargement de la structure…",
    "tablesExport": "Chargement des tables…",
    "running": "Exécution…"
  },
  "toasts": {
    "engineInstalled": "{label} installé",
    "noColumnsMetadata": "Pas de métadonnées de colonnes pour cette table",
    "recordUpdated": "Enregistrement mis à jour",
    "recordCreated": "Enregistrement créé",
    "recordDeleted": "Enregistrement supprimé",
    "noTableSelect": "Sélectionnez au moins une table",
    "exportDownloaded": "Exportation téléchargée",
    "selectEngineFirst": "Sélectionnez d'abord un moteur",
    "statementExecuted": "Requête exécutée"
  },
  "confirm": {
    "deleteRecord": "Supprimer cet enregistrement ? Cette action est irréversible.",
    "deleteTitle": "Supprimer l'enregistrement",
    "deleteConfirmText": "Supprimer"
  },
  "info": {
    "installing": "Installation de {label}… cela peut prendre quelques minutes.",
    "installed": "{label} installé. Détection du moteur…",
    "pager": "Lignes {from}–{to} (page {limit})",
    "statementExecuted": "Requête exécutée",
    "rowCount": "{count} ligne(s)",
    "truncated": "· résultat tronqué à {count} lignes"
  },
  "runtime": {
    "createPromptWithPrefix": "Le nom doit commencer par {prefix} et respecter votre quota.",
    "createPrompt": "Nom de la nouvelle base de données sur le serveur actif.",
    "invalidPrefix": "Le nom doit commencer par {prefix}",
    "createError": "Impossible de créer la base de données.",
    "created": "Base de données créée."
  },
  "settings": {
    "title": "Paramètres des bases de données",
    "description": "Préférences du module de bases de données.",
    "table": "Tableau",
    "pagination": "Pagination",
    "rowsPerPage": "Lignes par page dans les résultats de Structure et Console.",
    "serverPagination": "Le tableau Enregistrements utilise la pagination côté serveur et ne peut pas être réglé ici.",
    "relatedModules": "Modules associés",
    "hostingQuotas": "Hébergement et quotas",
    "databaseBackups": "Sauvegardes des bases de données",
    "sqlFiles": "Fichiers SQL",
    "allowWriteDefault": "Autoriser les écritures par défaut à l’ouverture de la console",
    "allowWriteHelp": "Ce réglage s’applique au chargement du module ; vous pouvez le modifier dans la console à tout moment.",
    "createDatabase": "Créer une base de données",
    "create": "Créer"
  }
} as const;

export default databases;
