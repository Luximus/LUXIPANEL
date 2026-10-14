const moduleCatalog = {
  "users": {
    "name": "Utilisateurs",
    "description": "Gestion des utilisateurs du panneau, des rôles et des permissions."
  },
  "mail": {
    "name": "Email",
    "description": "SMTP / IMAP, domaines et boîtes aux lettres des utilisateurs."
  },
  "monitor": {
    "name": "Moniteur",
    "description": "Métriques en direct du CPU, de la RAM, du disque et des processus."
  },
  "files": {
    "name": "Fichiers",
    "description": "Explorateur de fichiers distant avec éditeur intégré."
  },
  "firewall": {
    "name": "Pare-feu",
    "description": "Gestion des règles UFW et blocage d'adresses IP."
  },
  "bitninja": {
    "name": "BitNinja",
    "description": "Agent de sécurité complet : WAF, anti-DoS, détection de malware et réputation d'IP."
  },
  "assistant": {
    "name": "Agents IA",
    "description": "Assistant IA pour le diagnostic et l'automatisation."
  },
  "repository-store": {
    "name": "GitHub",
    "description": "Catalogue de dépôts et installation guidée."
  },
  "dns": {
    "name": "Nginx",
    "description": "Gestion de Nginx : sites, reverse proxy, SSL, logs et état."
  },
  "backups": {
    "name": "Sauvegardes",
    "description": "Sauvegardes planifiées avec chiffrement et destinations multiples."
  },
  "cron": {
    "name": "Cron",
    "description": "Tâches planifiées avec éditeur visuel."
  },
  "databases": {
    "name": "Bases de données",
    "description": "Gestionnaire de bases de données (MySQL/MariaDB et PostgreSQL) : exploration des schémas et console SQL."
  },
  "obsidian": {
    "name": "Obsidian",
    "description": "Coffres de notes Obsidian sur votre serveur : éditeur markdown, wikilinks et notes pilotées par les agents IA de l'assistant."
  },
  "cloudflare": {
    "name": "Cloudflare",
    "description": "Gestion de Cloudflare pour le serveur : DNS, cache, SSL/TLS, mode développement et règles d'accès IP."
  },
  "server-alerts": {
    "name": "Notifications",
    "description": "Notifications du serveur pour le propriétaire du panneau : préférences d'alertes, avis immédiats, planifiés/récurrents et règles par métriques (CPU/RAM/disque/charge/service tombé en panne), envoyés à ses appareils via LP."
  },
  "expo": {
    "name": "Expo",
    "description": "Gérez les applications Expo/React Native : builds EAS, soumissions aux stores, mises à jour OTA, QR du dev-client et quotas, avec un access token du client."
  },
  "webhooks": {
    "name": "Webhooks",
    "description": "Notifications HTTP des événements du panneau."
  },
  "openclaw": {
    "name": "OpenClaw",
    "description": "Connexion à OpenClaw AI avec sélecteur de modèle."
  },
  "hosting": {
    "name": "Hébergement",
    "description": "Sites, vhosts et déploiements assistés."
  },
  "terminal": {
    "name": "Terminal",
    "description": "Terminal flottant accessible depuis n'importe quelle vue du panneau. Activez ou désactivez le bouton flottant."
  },
  "module-dev": {
    "name": "Mes modules",
    "description": "Cycle de vie de vos modules du marketplace : état de révision, soumissions, tests et aperçu privé."
  },
  "filesystem-mcp": {
    "name": "MCP Système de fichiers",
    "description": "MCP pour les opérations sur le système de fichiers."
  },
  "github-mcp": {
    "name": "GitHub MCP",
    "description": "MCP pour les opérations sur l'API de GitHub."
  },
  "google-drive": {
    "name": "Google Drive",
    "description": "Recherchez et joignez des documents de votre Google Drive depuis le chat de l'assistant."
  },
  "onedrive": {
    "name": "OneDrive",
    "description": "Accédez aux fichiers de Microsoft OneDrive / SharePoint depuis le chat."
  },
  "dropbox": {
    "name": "Dropbox",
    "description": "Recherchez et joignez des fichiers de Dropbox depuis le chat."
  },
  "notion": {
    "name": "Notion",
    "description": "Consultez des pages et des bases de données de Notion depuis le chat."
  }
} as const;

export default moduleCatalog;
