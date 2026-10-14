const cloudflare = {
  "options": {
    "essentiallyOff": "Pratiquement désactivé",
    "low": "Faible",
    "medium": "Moyen",
    "high": "Élevé"
  },
  "pageTitle": "Cloudflare",
  "header": {
    "heading": "Cloudflare",
    "subheading": "Gérez le DNS, le cache, le SSL/TLS et la sécurité de vos zones Cloudflare pour ce serveur."
  },
  "config": {
    "title": "Connexion à Cloudflare",
    "tokenLabel": "API Token",
    "tokenPlaceholder": "API Token Cloudflare",
    "tokenHint": "Créez un token sur dash.cloudflare.com → My Profile → API Tokens avec les permissions de zone : DNS, Cache Purge, Zone Settings et Firewall Services.",
    "save": "Enregistrer",
    "test": "Tester la connexion",
    "clear": "Retirer le token",
    "tokenSet": "Token configuré",
    "tokenMissing": "Configurez un API Token pour commencer",
    "saved": "Token enregistré",
    "cleared": "Token supprimé",
    "confirmClear": "Supprimer le jeton Cloudflare ?",
    "confirmClearBtn": "Supprimer"
  },
  "zones": {
    "title": "Zone",
    "select": "Sélectionnez une zone",
    "empty": "Aucune zone visible avec ce token.",
    "status": "Statut",
    "plan": "Plan",
    "nameServers": "Serveurs de noms",
    "domainNotFound": "Le domaine {domain} n'appartient à aucune zone du jeton"
  },
  "runtime": {
    "active": "Active",
    "pending": "En attente",
    "initializing": "Initialisation",
    "moved": "Déplacée",
    "paused": "en pause",
    "pausedHint": "Zone en pause : vérifiez la configuration avant de modifier le DNS.",
    "inactiveHint": "Zone {status} : vérifiez les serveurs de noms chez votre registraire.",
    "activeHint": "Zone active · {count} serveurs de noms configurés."
  },
  "tabs": {
    "dns": "DNS",
    "cache": "Cache",
    "security": "SSL / Sécurité",
    "access": "Règles d'accès",
    "config": "Configuration"
  },
  "dns": {
    "title": "Enregistrements DNS",
    "add": "Ajouter un enregistrement",
    "type": "Type",
    "name": "Nom",
    "content": "Contenu",
    "ttl": "TTL",
    "proxied": "Proxy",
    "pointsToServer": "Pointe vers ce serveur",
    "edit": "Modifier",
    "delete": "Supprimer",
    "confirmDelete": "Supprimer l'enregistrement {name} ?",
    "saved": "Enregistrement sauvegardé",
    "deleted": "Enregistrement supprimé",
    "useServerIp": "Utiliser l'IP du serveur",
    "priority": "Priorité",
    "confirmDeleteTitle": "Supprimer l'enregistrement",
    "typeA": "A",
    "typeAAAA": "AAAA",
    "typeCNAME": "CNAME",
    "typeTXT": "TXT",
    "typeMX": "MX",
    "typeNS": "NS",
    "ttlAuto": "Auto",
    "ttl60": "60",
    "ttl300": "300",
    "ttl1800": "1800",
    "ttl3600": "3600",
    "ttl86400": "86400"
  },
  "cache": {
    "title": "Cache",
    "purgeAll": "Tout purger",
    "purgeAllHint": "Supprime tout le contenu mis en cache de la zone sur Cloudflare.",
    "confirmPurgeAll": "Purger TOUT le cache de la zone ?",
    "purgeUrls": "Purger des URLs",
    "purgeUrlsPlaceholder": "https://ejemplo.com/estilos.css (une URL par ligne)",
    "purged": "Cache purgé",
    "devMode": "Mode développement",
    "devModeHint": "Désactive temporairement le cache de Cloudflare (se désactive automatiquement au bout de 3 heures).",
    "confirmPurgeTitle": "Purger le cache",
    "confirmPurgeBtn": "Purger"
  },
  "security": {
    "title": "SSL / Sécurité",
    "sslMode": "Mode SSL/TLS",
    "alwaysHttps": "Toujours utiliser HTTPS",
    "securityLevel": "Niveau de sécurité",
    "underAttack": "Mode sous attaque",
    "updated": "Paramètre mis à jour",
    "sslOff": "Désactivé",
    "sslFlexible": "Flexible",
    "sslFull": "Complet",
    "sslFullStrict": "Complet (strict)"
  },
  "access": {
    "title": "Règles d'accès IP",
    "add": "Ajouter une règle",
    "mode": "Action",
    "block": "Bloquer",
    "allow": "Autoriser",
    "challenge": "Défi",
    "ip": "IP / plage",
    "notes": "Notes",
    "empty": "Aucune règle d'accès dans cette zone.",
    "confirmDelete": "Supprimer la règle pour {ip} ?",
    "created": "Règle créée",
    "deleted": "Règle supprimée",
    "ipHeader": "IP",
    "confirmDeleteTitle": "Supprimer la règle"
  },
  "common": {
    "loading": "Chargement...",
    "error": "Erreur",
    "save": "Enregistrer",
    "cancel": "Annuler",
    "delete": "Supprimer",
    "refresh": "Actualiser",
    "serverIp": "IP du serveur",
    "noToken": "Configurez l'API Token de Cloudflare dans l'onglet Configuration."
  },
  "settingsUi": {
    "title": "Paramètres Cloudflare",
    "description": "Préférences des tableaux du module Cloudflare.",
    "access": "Accès",
    "credentialsConnections": "Identifiants et connexions",
    "cloudflareToken": "Jeton Cloudflare",
    "serverFirewall": "Pare-feu du serveur",
    "dnsWebhooks": "Événements DNS dans Webhooks"
  }
} as const;

export default cloudflare;
