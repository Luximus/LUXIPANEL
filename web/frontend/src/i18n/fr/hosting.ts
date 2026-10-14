const hosting = {
  "pageTitle": "Hébergement mutualisé",
  "pageSubtitle": "Gérez les comptes d'hébergement de vos clients · multi-tenant style WHM",
  "btnNewAccount": "Nouveau compte",
  "options": {
    "planBasic": "Basique",
    "planPro": "Pro",
    "planBusiness": "Entreprise",
    "planCustom": "Personnalisé"
  },
  "stats": {
    "total": "Total comptes",
    "active": "Actifs",
    "suspended": "Suspendus",
    "terminated": "Résiliés",
    "title": "Utilisation de {username}",
    "disk": "Disque (Mo)",
    "domains": "Domaines",
    "emails": "Comptes e-mail",
    "databases": "Bases de données",
    "subusers": "Sous-utilisateurs",
    "bandwidth": "Bande passante (Mo)",
    "percentUsed": "% utilisé",
    "method": "Méthode de mesure",
    "methodDu": "Estimation par du (best-effort)",
    "methodQuotaTools": "Quota système (quota-tools)"
  },
  "tableTitle": "comptes",
  "modal": {
    "titleNew": "Nouveau compte d'hébergement",
    "tabs": {
      "account": "Compte",
      "resources": "Ressources",
      "security": "Modules et sécurité"
    },
    "labelUsername": "Utilisateur *",
    "labelPassword": "Mot de passe *",
    "labelName": "Nom",
    "labelEmail": "Email",
    "labelPlan": "Plan",
    "resourcesTitle": "Limites des ressources",
    "labelDisk": "Disque (MB)",
    "labelBandwidth": "Bande passante (MB)",
    "labelDomains": "Domaines",
    "labelEmails": "Comptes email",
    "labelNotes": "Notes internes",
    "btnCancel": "Annuler",
    "btnCreate": "Créer le compte",
    "hintUsername": "Minuscules, chiffres, - et _ uniquement",
    "phUsername": "clientexemple",
    "phPassword": "minimum 8 caractères",
    "phName": "Entreprise S.A.",
    "phEmail": "admin@entreprise.com",
    "phNotes": "Observations facultatives…",
    "labelStatus": "Statut",
    "labelTenantGroup": "Groupe du locataire",
    "labelHomeRoot": "Dossier racine (home)",
    "hintTenantGroup": "Groupe Linux dédié du compte (lecture seule).",
    "hintHomeRoot": "Racine du locataire sur le VPS (lecture seule).",
    "labelDiskQuotaMb": "Quota disque (Mo)",
    "labelBandwidthQuotaMb": "Quota bande passante (Mo)",
    "labelMaxDomains": "Max. domaines",
    "labelMaxEmailAccounts": "Max. comptes e-mail",
    "labelMaxDatabases": "Max. bases de données",
    "labelMaxSubUsers": "Max. sous-utilisateurs",
    "labelAllowedModules": "Modules autorisés",
    "labelJailEnabled": "Isoler le shell (chroot)",
    "hintJailEnabled": "Confine le terminal/SSH de ce compte à son dossier (cage chroot).",
    "modulesLoading": "Chargement des modules…",
    "labelExpiresAt": "Date d'expiration",
    "hintExpiresAt": "Laissez vide pour pas d'expiration",
    "labelModules": "Modules autorisés",
    "hintModules": "Définit les modules du panneau auxquels ce client aura accès.",
    "labelDatabases": "Bases de données",
    "labelSubUsers": "Sous-utilisateurs",
    "labelJail": "Isoler le shell (chroot)",
    "hintJail": "Confine le terminal/SSH de ce compte à son dossier (prison chroot).",
    "titleEdit": "Modifier: {username}"
  },
  "pwdModal": {
    "title": "Changer le mot de passe",
    "labelNew": "Nouveau mot de passe",
    "phPassword": "minimum 8 caractères",
    "btnCancel": "Annuler",
    "btnChange": "Modifier"
  },
  "apiPageTitle": "Documentation API d'hébergement",
  "apiSubtitle": "Gestion automatisée des comptes d'hébergement mutualisé",
  "apiIntro": "L'API Revendeur vous permet d'automatiser la création, la mise à jour, la suspension et la suppression de comptes d'hébergement depuis n'importe quel système externe — votre propre plateforme de facturation, WHMCS, scripts Bash, intégrations Zapier, etc. Elle est compatible avec tout langage ou outil capable d'effectuer des requêtes HTTP.",
  "toc": {
    "label": "Contenu",
    "items": [
      "1. Authentification",
      "2. Isolation et sécurité",
      "3. Points de terminaison disponibles",
      "4. Créer un compte",
      "5. Lister les comptes",
      "6. Obtenir un compte",
      "7. Mettre à jour un compte",
      "8. Suspendre / Réactiver",
      "9. Changer le mot de passe",
      "10. Statistiques du compte",
      "11. Supprimer un compte",
      "12. Connexion du compte d'hébergement",
      "13. Codes d'erreur",
      "14. Exemples complets"
    ]
  },
  "auth": {
    "title": "Authentification",
    "intro": "Tous les endpoints de l'API Revendeur acceptent deux méthodes d'authentification :",
    "apiKeyTitle": "Clé API (recommandée pour l'automatisation)",
    "apiKeyDesc": "Générez une clé API depuis Panneau → Webhooks → Clés API. Envoyez-la dans le header Authorization :",
    "sessionTitle": "Session administrateur (depuis le panneau)",
    "sessionDesc": "Si vous effectuez des requêtes depuis le panneau LuxiPanel lui-même (par exemple, depuis JavaScript dans le navigateur), votre cookie de session administrateur est accepté automatiquement.",
    "warningTitle": "Important :",
    "warningText": "N'exposez jamais votre clé API dans du code côté client (JavaScript dans le navigateur, applications mobiles, etc.). Utilisez-la exclusivement depuis des serveurs ou des environnements privés."
  },
  "isolation": {
    "title": "Isolation et sécurité",
    "intro": "Chaque compte d'hébergement est un environnement complètement isolé. Cela garantit qu'aucun client ne peut voir ni modifier les ressources d'un autre, qu'il tente de le faire via le panneau web, l'API, la console SSH ou tout autre vecteur.",
    "features": [
      {
        "title": "Données isolées",
        "desc": "Les boîtes mail, domaines, DNS, SSL et sauvegardes sont liés au tenant_id de chaque compte. Les requêtes SQL ne franchissent jamais les frontières entre locataires."
      },
      {
        "title": "Système de fichiers",
        "desc": "Chaque compte dispose de son propre répertoire personnel (/home/username). L'explorateur de fichiers et la console sont limités à ce répertoire."
      },
      {
        "title": "Sessions indépendantes",
        "desc": "Le JWT d'un compte d'hébergement inclut son tenantId. Le backend rejette toute requête qui tente d'accéder à des ressources en dehors de cette portée."
      }
    ]
  },
  "endpoints": {
    "title": "Points de terminaison disponibles",
    "colMethod": "Méthode",
    "colPath": "Chemin",
    "colDesc": "Description",
    "colAuth": "Auth",
    "rows": [
      [
        "POST",
        "/api/hosting/accounts",
        "Créer un compte d'hébergement",
        "Admin / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts",
        "Lister les comptes (paginé)",
        "Admin / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts/:id",
        "Obtenir un compte",
        "Admin / API Key"
      ],
      [
        "PUT",
        "/api/hosting/accounts/:id",
        "Mettre à jour le compte",
        "Admin / API Key"
      ],
      [
        "DELETE",
        "/api/hosting/accounts/:id",
        "Supprimer le compte et toutes ses données",
        "Admin / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/suspend",
        "Suspendre le compte",
        "Admin / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/unsuspend",
        "Réactiver un compte suspendu",
        "Admin / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/change-password",
        "Changer le mot de passe",
        "Admin / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts/:id/stats",
        "Statistiques d'utilisation",
        "Admin / API Key"
      ],
      [
        "POST",
        "/api/hosting/auth/login",
        "Connexion d'un compte d'hébergement",
        "Public"
      ],
      [
        "POST",
        "/api/hosting/auth/logout",
        "Déconnexion de l'hébergement",
        "Session d'hébergement"
      ]
    ]
  },
  "create": {
    "title": "Créer un compte",
    "labelBody": "Body (JSON)",
    "labelResp": "Réponse 201"
  },
  "list": {
    "title": "Lister les comptes",
    "labelParams": "Paramètres de requête",
    "colParam": "Paramètre",
    "colType": "Type",
    "colDefault": "Défaut",
    "colDesc": "Description",
    "labelResp": "Réponse 200",
    "params": [
      [
        "page",
        "integer",
        "1",
        "Page actuelle"
      ],
      [
        "limit",
        "integer",
        "20",
        "Résultats par page (max. 100)"
      ],
      [
        "search",
        "string",
        "—",
        "Recherche dans username, displayName, email"
      ],
      [
        "status",
        "string",
        "—",
        "active | suspended | terminated"
      ]
    ]
  },
  "compactEndpoints": [
    {
      "id": "get",
      "num": "6",
      "title": "Obtenir un compte",
      "method": "GET",
      "path": "/api/hosting/accounts/:id",
      "note": "Renvoie l'objet du compte sans le champ passwordHash."
    },
    {
      "id": "update",
      "num": "7",
      "title": "Mettre à jour le compte",
      "method": "PUT",
      "path": "/api/hosting/accounts/:id",
      "note": "Accepte les mêmes champs que la création (sauf username et password). Seuls les champs envoyés sont mis à jour."
    },
    {
      "id": "suspend",
      "num": "8",
      "title": "Suspendre / Réactiver",
      "method": "POST",
      "path": "/api/hosting/accounts/:id/suspend  |  /unsuspend",
      "note": "La suspension bloque immédiatement l'accès du client. La réactivation restaure le statut à 'active'. Aucun corps requis."
    },
    {
      "id": "password",
      "num": "9",
      "title": "Changer le mot de passe",
      "method": "POST",
      "path": "/api/hosting/accounts/:id/change-password",
      "note": "Body: {\"password\": \"NewPass123!\"} — minimum 8 caractères."
    },
    {
      "id": "stats",
      "num": "10",
      "title": "Statistiques d'utilisation",
      "method": "GET",
      "path": "/api/hosting/accounts/:id/stats",
      "note": "Renvoie les quotas configurés et l'utilisation actuelle du disque, de la bande passante, des domaines actifs et des comptes mail."
    },
    {
      "id": "delete",
      "num": "11",
      "title": "Supprimer le compte",
      "method": "DELETE",
      "path": "/api/hosting/accounts/:id",
      "note": "⚠️ Irréversible. Supprime le compte et, via ON DELETE CASCADE, toutes ses ressources : boîtes mail, domaines, DNS, SSL et sauvegardes."
    }
  ],
  "login": {
    "title": "Connexion au compte d'hébergement",
    "badgePublic": "· Public",
    "desc": "Le client saisit ses identifiants dans le panneau de connexion. S'ils sont valides, une session de type kind: \"hosting\" est créée, restreignant l'accès exclusivement aux ressources de son compte.",
    "labelBody": "Body",
    "labelResp": "Réponse 200"
  },
  "errors": {
    "title": "Codes d'erreur",
    "intro": "Toutes les erreurs suivent la même enveloppe :",
    "colHttp": "HTTP",
    "colCode": "Code",
    "colDesc": "Description",
    "rows": [
      [
        "400",
        "VALIDATION_ERROR",
        "Champs invalides ou manquants"
      ],
      [
        "401",
        "AUTH_ERROR",
        "API key invalide, expirée ou manquante"
      ],
      [
        "403",
        "FORBIDDEN",
        "Vous n'avez pas la permission pour cette opération"
      ],
      [
        "404",
        "NOT_FOUND",
        "Le compte demandé n'existe pas"
      ],
      [
        "409",
        "CONFLICT",
        "Le nom d'utilisateur est déjà utilisé"
      ],
      [
        "429",
        "RATE_LIMIT",
        "Trop de requêtes — patientez avant de réessayer"
      ],
      [
        "500",
        "INTERNAL_ERROR",
        "Erreur interne du serveur"
      ]
    ],
    "generic": "Erreur",
    "unknown": "Erreur inconnue"
  },
  "examples": {
    "title": "Exemples complets",
    "labelCurl": "Créer un compte",
    "labelSuspend": "Suspendre un compte",
    "labelList": "Lister avec filtres",
    "labelNodeClient": "Client réutilisable",
    "labelPhpHelper": "Classe helper en PHP"
  },
  "table": {
    "columnStatus": "Statut",
    "columnPlan": "Forfait",
    "columnModules": "Modules",
    "columnCreated": "Créé",
    "columnUpdated": "Mis à jour",
    "columnTenantGroup": "Groupe",
    "columnHomeRoot": "Accueil",
    "modulesCount": "{count} modules"
  },
  "audit": {
    "title": "Audit de {username}",
    "eventType": "Événement",
    "actor": "Acteur",
    "date": "Date",
    "empty": "Aucun événement enregistré."
  },
  "actions": {
    "editModules": "Modifier les modules",
    "viewStats": "Voir l'utilisation",
    "viewAudit": "Voir l'audit",
    "enableJail": "Activer la cage",
    "disableJail": "Désactiver la cage",
    "save": "Enregistrer",
    "saveChanges": "Enregistrer les modifications",
    "saving": "Enregistrement…"
  },
  "confirm": {
    "enableJailBody": "Activer la cage chroot pour ce compte ? Son terminal/SSH sera confiné à son dossier.",
    "disableJailBody": "Désactiver la cage chroot ? Le compte reviendra à un shell normal (/bin/bash).",
    "suspendBody": "Suspendre ce compte? Le client perdra l'accès.",
    "suspendTitle": "Suspendre le compte",
    "suspendOk": "Oui, suspendre",
    "deleteBody": "Supprimer le compte \"{username}\" et TOUTES ses données (e-mails, domaines, fichiers)? Cette action ne peut pas être annulée.",
    "deleteTitle": "Supprimer le compte"
  },
  "jail": {
    "degraded": "jailkit n'est pas installé sur le serveur ; la cage n'a pas été activée. Installez jailkit et réessayez.",
    "degradedTitle": "Cage non appliquée",
    "enabledOk": "Cage activée avec succès."
  },
  "toasts": {
    "jailAlready": "La cage est déjà active",
    "jailNotActive": "La cage n'est pas active",
    "notActive": "Le compte n'est pas actif",
    "notSuspended": "Le compte n'est pas suspendu"
  },
  "labels": {
    "statusActive": "Actif",
    "statusSuspended": "Suspendu",
    "statusTerminated": "Terminé"
  },
  "dataTable": {
    "columns": {
      "username": "Utilisateur",
      "plan": "Forfait",
      "estado": "Statut",
      "modulos": "Modules",
      "tenantGroup": "Groupe",
      "homeRoot": "Accueil",
      "creado": "Créé",
      "actualizado": "Mis à jour"
    },
    "filters": {
      "searchUser": "Rechercher par utilisateur…",
      "estado": "Statut",
      "plan": "Forfait",
      "statusActive": "Active",
      "statusSuspended": "Suspendue",
      "statusTerminated": "Résiliée"
    },
    "rowActions": {
      "edit": "Modifier",
      "viewStats": "Voir l'utilisation",
      "viewAudit": "Voir l'audit",
      "password": "Changer le mot de passe",
      "suspend": "Suspendre",
      "unsuspend": "Réactiver",
      "enableJail": "Activer la cage",
      "disableJail": "Désactiver la cage",
      "delete": "Supprimer"
    }
  },
  "runtime": {
    "defaultsLoadError": "Impossible de charger les valeurs par défaut.",
    "defaultsSaveError": "Impossible d’enregistrer les valeurs.",
    "defaultsSaved": "Valeurs enregistrées sur le serveur actif."
  },
  "settingsUi": {
    "title": "Paramètres de l’hébergement",
    "description": "Préférences du tableau des comptes d’hébergement",
    "table": "Tableau",
    "apiProviders": "Fournisseurs API",
    "rowsPerPage": "Lignes par page dans le tableau des comptes.",
    "newAccountDefaults": "Valeurs par défaut des nouveaux comptes",
    "defaultsHint": "Enregistrées sur le serveur actif. Les comptes existants ne sont pas modifiés.",
    "emailAccounts": "E-mails",
    "subusers": "Sous-utilisateurs",
    "defaultJail": "Activer l’isolation par défaut",
    "defaultModules": "Modules par défaut (ID séparés par des virgules)",
    "saveDefaults": "Enregistrer les valeurs",
    "relatedModules": "Modules associés",
    "users": "Utilisateurs",
    "domainsSsl": "Domaines et SSL",
    "showAll": "Tout afficher",
    "hideAll": "Tout masquer",
    "providerConnections": "Connexions des gestionnaires d’hébergement",
    "providerConnectionsHint": "LUXIPANEL fournit l’API. Chaque gestionnaire reçoit une clé et un accès limité à un serveur, à des modules et à des opérations.",
    "newProvider": "Nouveau fournisseur",
    "managedServer": "Serveur géré",
    "localServer": "Serveur local",
    "panelHttpsOrigin": "Origine HTTPS de LUXIPANEL",
    "siteEngine": "Moteur du site sur le serveur",
    "accountModules": "Modules des comptes",
    "modulesHint": "ID séparés par des virgules ; HOSTING vérifie le catalogue.",
    "apiOperations": "Opérations de l’API",
    "readAccounts": "Lire les comptes",
    "createAccounts": "Créer des comptes",
    "accountStatus": "État et données des comptes",
    "viewUsage": "Consulter l’utilisation",
    "linkSites": "Associer des sites",
    "panelAccess": "Accès au panneau",
    "deleteAccounts": "Supprimer les comptes",
    "createProviderKey": "Créer le fournisseur et la clé",
    "copyKeyNow": "Copiez la clé maintenant : elle ne sera affichée qu’une fois.",
    "groupPolicy": {
      "editProvider": "Modifier le fournisseur",
      "saveProvider": "Enregistrer le fournisseur",
      "templateTitle": "Autorisations du groupe initial",
      "templateHint": "Chaque nouveau compte reçoit ces autorisations dans son propre groupe. Pour les comptes existants, modifiez le groupe dans Utilisateurs.",
      "permissions": "Autorisations détaillées",
      "sidebar": "Menus",
      "views": "Vues",
      "actions": "Actions",
      "filesScope": "Accès aux fichiers",
      "relativeHint": "Un chemin par ligne, relatif au dossier du compte. Utilisez . pour tout le dossier.",
      "allowPaths": "Dossiers autorisés",
      "denyPaths": "Dossiers bloqués",
      "readOnlyPaths": "Dossiers en lecture seule",
      "defaultPath": "Dossier initial",
      "commands": "Commandes du terminal",
      "allowAllCommands": "Autoriser toutes les commandes de l’utilisateur",
      "commandGroups": "Groupes de commandes",
      "allowedCommands": "Commandes autorisées, une par ligne",
      "deniedCommands": "Commandes bloquées, une par ligne",
      "saving": "Enregistrement…",
      "saved": "Fournisseur enregistré. S’applique aux nouveaux comptes.",
      "created": "Fournisseur créé.",
      "loading": "Chargement des fournisseurs et autorisations…",
      "loadError": "Impossible de charger les paramètres.",
      "active": "Actif",
      "revoked": "Révoqué",
      "rotateKey": "Renouveler la clé",
      "rotateSuccess": "Clé renouvelée. Copiez la nouvelle clé.",
      "revoke": "Révoquer l’accès",
      "reactivate": "Réactiver",
      "accessUpdated": "Accès mis à jour.",
      "emptyProviders": "Aucun fournisseur configuré."
},
    "apiGuide": "Guide de l’API",
    "retry": "Réessayer"
  },
  "apiDocs": {
    "pageTitle": "API des fournisseurs d’hébergement",
    "backToHosting": "Retour à HOSTING",
    "contractVersion": "Contrat HTTP · version 1",
    "heading": "Connectez votre gestionnaire d’hébergement",
    "intro": "LUXIPANEL expose cette API pour que votre gestionnaire crée des comptes, lie des sites et accorde l’accès selon les droits définis dans HOSTING.",
    "guideContents": "Sommaire du guide",
    "preparation": "Préparation",
    "authentication": "Authentification",
    "operations": "Opérations",
    "example": "Exemple",
    "panelAccess": "Accès au panneau",
    "limitsErrors": "Limites et erreurs",
    "preparationHeading": "Préparation dans HOSTING",
    "administrator": "Administrateur",
    "scope": "Périmètre",
    "key": "Clé",
    "adminStep": "Ouvrez HOSTING → Paramètres → Fournisseurs API et créez un fournisseur.",
    "scopeStep": "Définissez le serveur, le moteur de sites, les modules, les quotas et les opérations autorisées.",
    "keyStep": "Copiez la clé lhp_… une seule fois et conservez-la uniquement dans le backend du gestionnaire.",
    "providerScopeNote": "Chaque fournisseur est lié à un serveur. Chaque compte reçoit un utilisateur Linux et un dossier propres ; le gestionnaire ne choisit ni ne reçoit le mot de passe.",
    "anyProvider": "Tout fournisseur",
    "endpointCapabilities": "Consulte la version, les opérations, les modules et le serveur attribué.",
    "endpointPutAccount": "Crée ou retrouve un compte avec displayName et email facultatifs.",
    "endpointGetAccount": "Consulte le compte sans révéler son mot de passe.",
    "endpointPatchAccount": "Modifie le nom, l’adresse e-mail ou l’état active/suspended.",
    "endpointDeleteAccount": "Supprime un compte sans site lié. Désactivé par défaut.",
    "endpointUsage": "Consulte les quotas, l’utilisation disponible et les avertissements de mesure.",
    "endpointPutSite": "Associe un domaine au moteur de sites configuré dans HOSTING.",
    "endpointDeleteSite": "Supprime uniquement le site appartenant à ce fournisseur.",
    "endpointTicket": "Émet un accès unique au panneau, valable 60 secondes.",
    "method": "Méthode",
    "pathFromBase": "Chemin depuis l’URL de base",
    "permission": "Droit",
    "result": "Résultat",
    "operationsHeading": "Opérations du gestionnaire",
    "authNote": "Envoyez les requêtes au panneau via HTTPS. Les cookies administrateur et les clés lxp_… ne fonctionnent pas pour cette API. Ne transmettez jamais la clé lhp_… au navigateur.",
    "baseNote": "URL de base : https://<panel>/api/hosting/v1. Les identifiants externes acceptent 1 à 128 caractères : lettres, chiffres, _ . : -.",
    "idempotencyNote": "Les requêtes PUT de compte et de site sont idempotentes avec la même référence et le même contenu. Un fournisseur ne peut accéder aux comptes d’un autre.",
    "createAccount": "Créer ou retrouver un compte",
    "accountResponseNote": "La réponse contient { \"ok\": true, \"data\": … } avec l’utilisateur, le dossier personnel, l’état et les quotas. Le hash du mot de passe est exclu.",
    "siteExampleNote": "Pour un site, envoyez PUT /accounts/account-42/sites/site-1 avec { \"domain\": \"example.com\" }. LUXIPANEL crée un proxy NGINX vers le moteur configuré ; le gestionnaire publie le contenu et achemine le trafic TLS.",
    "clientAccessHeading": "Accès client à LUXIPANEL",
    "clientAccessNote": "Le backend vérifie que le client possède le compte et appelle POST /accounts/{accountId}/access-ticket. Il transmet l’URL et le ticket au navigateur, qui envoie un POST à /api/auth/sso/handoff. Le ticket est à usage unique et expire après 60 secondes. Si un second facteur est requis, l’accès renvoie 403 jusqu’à la mise en place d’un flux compatible.",
    "limitsHeading": "Limites et réponses d’erreur",
    "limitsNote": "L’API accepte seulement des références, des données de compte de base et des domaines. Le gestionnaire ne peut envoyer ni commandes, chemins, serveurs cibles ni configuration NGINX. Un site pointe uniquement vers le moteur et le port définis par l’administrateur.",
    "errorCodes": "400 : entrée invalide · 401 : clé absente ou invalide · 403 : opération interdite · 404 : référence inconnue · 409 : conflit ou opération simultanée · 5xx : erreur serveur.",
    "bandwidthNote": "La mesure de la bande passante n’est pas encore fiable. Consultez warnings dans la réponse usage."
  }
} as const;

export default hosting;
