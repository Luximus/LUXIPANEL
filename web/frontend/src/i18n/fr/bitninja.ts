const bitninja = {
  "header": {
    "description": "Agent de sécurité complet (WAF, anti-DoS, détection de malware et réputation IP) sur le serveur connecté.",
    "statusChecking": "vérification…"
  },
  "sudo": {
    "label": "Mot de passe sudo (phrase secrète de votre session)",
    "placeholder": "Uniquement si le serveur le demande pour sudo",
    "hint": "Utilisé uniquement pour cette action et jamais sauvegardé dans le navigateur."
  },
  "installCard": {
    "title": "BitNinja n'est pas installé",
    "description": "Saisissez la clé de licence de votre compte BitNinja pour installer l'agent sur ce serveur. Le programme d'installation officiel (get.bitninja.io) est téléchargé et exécuté avec sudo.",
    "licensePlaceholder": "License key (ex : ab12cd34-…)",
    "installButton": "Installer BitNinja"
  },
  "stats": {
    "service": "Service",
    "license": "Licence",
    "version": "Version"
  },
  "serviceControl": {
    "title": "Contrôle du service",
    "start": "Démarrer",
    "restart": "Redémarrer",
    "stop": "Arrêter"
  },
  "components": {
    "title": "Composants de protection",
    "checking": "vérification…",
    "noReported": "L'agent n'a signalé aucun composant.",
    "active": "Actif",
    "inactive": "Inactif"
  },
  "updateLicense": {
    "title": "Mettre à jour la clé de licence",
    "placeholder": "Nouvelle clé de licence",
    "applyButton": "Appliquer"
  },
  "toasts": {
    "sudoRequired": "Entrez votre mot de passe sudo et réessayez.",
    "sudoInvalid": "Mot de passe sudo invalide.",
    "actionFailed": "L'action a échoué. Vérifiez la sortie.",
    "installing": "Installation de BitNinja en cours… cela peut prendre quelques minutes.",
    "installed": "BitNinja installé.",
    "serviceAction": "Service : {action} OK.",
    "componentToggleEnabled": "{component} : activé.",
    "componentToggleDisabled": "{component} : désactivé.",
    "licenseApplied": "Clé de licence appliquée."
  },
  "errors": {
    "unknown": "Erreur inconnue"
  },
  "status": {
    "notInstalled": "Non installé",
    "running": "Actif",
    "installedStopped": "Installé (arrêté)",
    "serviceRunning": "En cours d'exécution",
    "serviceStopped": "Arrêté",
    "licenseValid": "Valide",
    "licenseReview": "À réviser"
  },
  "validation": {
    "licenseKeyRequired": "Entrez la clé de licence.",
    "newLicenseKeyRequired": "Entrez la nouvelle clé de licence."
  },
  "settingsUi": {
    "settingsTitle": "Paramètres BitNinja",
    "settingsButton": "Paramètres",
    "settingsDescription": "Préférences de diagnostic du serveur actif.",
    "settingsSections": "Sections des paramètres BitNinja",
    "diagnostics": "Diagnostic",
    "related": "Associés",
    "logSource": "Le journal est lu depuis le service BitNinja du serveur sélectionné.",
    "autoRefresh": "Actualiser l'état toutes les 30 secondes",
    "logLines": "Lignes du journal",
    "relatedModules": "Modules associés",
    "firewallAudit": "Pare-feu et audit",
    "credentials": "Identifiants BitNinja"
  },
  "logsUi": {
    "loading": "Chargement du journal…",
    "empty": "Aucun événement récent.",
    "loadError": "Impossible de charger le journal.",
    "logsTitle": "Journal récent",
    "logsDescription": "Événements du service sur le serveur actif.",
    "refreshLogs": "Actualiser le journal",
    "logsHint": "Sélectionnez « Actualiser le journal » pour charger les événements."
  }
} as const;

export default bitninja;
