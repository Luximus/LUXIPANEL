const servers = {
  "pageTitle": "Serveurs",
  "description": "Registre local des cibles SSH auxquelles ce panneau peut se connecter. Les secrets (clés et mots de passe) sont stockés chiffrés et ne sont jamais affichés ici.",
  "btnNew": "Ajouter un serveur",
  "table": {
    "name": "Nom",
    "host": "Hôte",
    "username": "Utilisateur",
    "authType": "Authentification",
    "status": "État"
  },
  "authTypes": {
    "key": "Clé SSH",
    "password": "Mot de passe"
  },
  "status": {
    "approved": "Approuvé",
    "pending": "En attente",
    "untested": "Non testé"
  },
  "common": {
    "test": "Tester",
    "edit": "Modifier",
    "delete": "Supprimer",
    "cancel": "Annuler",
    "save": "Enregistrer",
    "close": "Fermer",
    "error": "Erreur",
    "yes": "Oui",
    "no": "Non"
  },
  "dialog": {
    "titleNew": "Ajouter un serveur",
    "titleEdit": "Modifier le serveur",
    "name": "Nom",
    "namePlaceholder": "Mon serveur de production",
    "host": "Hôte ou IP",
    "hostPlaceholder": "203.0.113.10 ou serveur.exemple.com",
    "port": "Port",
    "username": "Utilisateur",
    "usernamePlaceholder": "root",
    "authType": "Type d'authentification",
    "secretKey": "Clé privée SSH",
    "secretKeyPlaceholder": "-----BEGIN OPENSSH PRIVATE KEY-----",
    "passphrase": "Phrase secrète de la clé (facultatif)",
    "passphrasePlaceholder": "Phrase secrète pour déverrouiller la clé",
    "secretPassword": "Mot de passe",
    "secretPasswordPlaceholder": "Mot de passe de l'utilisateur SSH",
    "secretKeepHint": "Laissez vide pour conserver le secret actuel.",
    "btnCancel": "Annuler",
    "btnSave": "Enregistrer"
  },
  "fingerprint": {
    "title": "Approuver l'empreinte de l'hôte",
    "intro": "Il s'agit de la première connexion à ce serveur. Vérifiez que l'empreinte de la clé de l'hôte correspond à celle attendue avant de l'approuver.",
    "approve": "Approuver l'empreinte",
    "approving": "Approbation…",
    "approved": "Empreinte approuvée",
    "approveError": "Impossible d'approuver l'empreinte"
  },
  "toasts": {
    "created": "Serveur ajouté",
    "updated": "Serveur mis à jour",
    "deleted": "Serveur supprimé",
    "testOk": "Connexion réussie",
    "testFailed": "Échec de la connexion"
  },
  "validation": {
    "nameRequired": "Saisissez un nom",
    "hostRequired": "Saisissez l'hôte",
    "usernameRequired": "Saisissez l'utilisateur",
    "secretRequired": "Saisissez le secret d'authentification"
  },
  "confirmDelete": "Supprimer le serveur {name} ? Cette action est irréversible.",
  "confirmDeleteTitle": "Supprimer le serveur",
  "testing": "Test de la connexion…"
} as const;

export default servers;
