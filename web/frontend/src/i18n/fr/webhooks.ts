const webhooks = {
  "pageTitle": "Webhooks et API Keys",
  "tabs": {
    "webhooks": "Webhooks",
    "apiKeys": "clés API",
    "discovered": "Détectés"
  },
  "webhooksPanel": {
    "description": "Notifications HTTP sortantes avec signature HMAC",
    "btnNew": "Nouveau webhook"
  },
  "apiKeysPanel": {
    "description": "Accès programmatique avec des jetons permanents",
    "btnNew": "Nouvelle API key"
  },
  "newKeyReveal": {
    "message": "Clé API créée — copiez-la maintenant, elle ne sera plus affichée",
    "btnCopy": "Copier"
  },
  "webhookDialog": {
    "placeholderUrl": "https://exemple.com/webhook",
    "title": "Nouveau webhook",
    "labelUrl": "URL de l'endpoint",
    "labelEvents": "Événements à écouter",
    "labelEnabled": "Webhook actif",
    "btnCancel": "Annuler",
    "btnSave": "Enregistrer"
  },
  "apiKeyDialog": {
    "placeholderName": "Mon intégration",
    "title": "Nouvelle API Key",
    "labelName": "Nom descriptif",
    "labelExpires": "Expire (optionnel)",
    "btnCancel": "Annuler",
    "btnCreate": "Créer la clé"
  },
  "discovered": {
    "description": "Webhooks détectés sur le serveur (Git, nginx, cron, systemd, fichiers de configuration et projets)",
    "btnRescan": "Réanalyser",
    "scanning": "Analyse du serveur…",
    "empty": "Aucun webhook détecté sur le serveur",
    "cols": {
      "source": "Source",
      "name": "Nom",
      "target": "Cible",
      "location": "Emplacement",
      "estado": "Statut"
    },
    "filters": {
      "searchTarget": "Rechercher une cible…",
      "source": "Source"
    },
    "sources": {
      "sidecar": "Panneau",
      "git-hook": "Git hook",
      "nginx": "Nginx",
      "cron": "Cron",
      "systemd": "systemd",
      "config": "Config",
      "project": "Projet"
    },
    "status": {
      "enabled": "Actif",
      "disabled": "Inactif",
      "unknown": "—"
    },
    "actions": {
      "detail": "Voir le détail",
      "delete": "Supprimer"
    },
    "detail": {
      "title": "Détail du webhook détecté",
      "source": "Source",
      "target": "Cible",
      "location": "Emplacement",
      "info": "Informations",
      "raw": "Configuration",
      "managedNote": "Ce webhook est géré par le panneau",
      "readonlyNote": "Lecture seule : gérez-le depuis son module correspondant",
      "btnClose": "Fermer"
    },
    "confirm": {
      "deleteTitle": "Supprimer le webhook détecté",
      "deleteBody": "Supprimer « {name} » ? Cela modifie le fichier sur le serveur.",
      "deleteBtn": "Oui, supprimer"
    },
    "toasts": {
      "deleted": "Supprimé",
      "errorDeleting": "Impossible de supprimer",
      "scanComplete": "Analyse terminée : {count}",
      "notManageable": "Gérez-le depuis son module correspondant"
    }
  },
  "labels": {
    "statusFailing": "Défaillant",
    "statusActive": "Actif",
    "statusPaused": "Suspendu",
    "newWebhookTitle": "Nouveau webhook",
    "noExpiry": "Pas d'expiration"
  },
  "confirm": {
    "rotateSecretBody": "Faire tourner le secret de ce webhook ? Vous devrez mettre à jour le récepteur.",
    "rotateSecretTitle": "Faire tourner le secret",
    "rotateSecretBtn": "Oui, faire tourner",
    "deleteWebhookBody": "Supprimer ce webhook ?",
    "deleteWebhookTitle": "Supprimer le webhook",
    "revokeKeyBody": "Révoquer la clé API « {name} » ?",
    "revokeKeyTitle": "Révoquer la clé API",
    "revokeKeyBtn": "Oui, révoquer"
  },
  "toasts": {
    "secretRotated": "Secret renouvelé",
    "errorRotating": "Erreur lors du renouvellement",
    "webhookDeleted": "Webhook supprimé",
    "errorDeleting": "Erreur lors de la suppression",
    "webhookUpdated": "Webhook mis à jour",
    "webhookCreated": "Webhook créé",
    "errorSaving": "Erreur lors de l'enregistrement",
    "keyRevoked": "Clé révoquée",
    "errorRevoking": "Erreur lors de la révocation",
    "copiedToClipboard": "Copié dans le presse-papiers",
    "errorCreatingKey": "Erreur lors de la création de la clé"
  },
  "categories": {
    "receiveData": "Recevoir les données",
    "mailhook": "Mailhook",
    "response": "Réponse webhook",
    "soon": "Bientôt disponible",
    "soonDesc": "La configuration et l'analyse de cette catégorie seront définies dans une phase ultérieure."
  },
  "gateway": {
    "description": "Points de terminaison que le panel héberge pour recevoir les données entrantes (style Make.com). Authentification par clé API (x-make-apikey), restriction par IP et validation de la structure des données.",
    "btnNew": "Nouveau webhook",
    "detectedTitle": "Récepteurs détectés sur le serveur",
    "urlReveal": "URL du webhook — envoie les requêtes ici",
    "cols": {
      "name": "Nom",
      "auth": "Auth",
      "recibidos": "Reçues",
      "ultima": "Dernier",
      "estado": "État",
      "estadoActive": "Actif",
      "estadoPaused": "Suspendu"
    },
    "dialog": {
      "titleNew": "Créer un webhook",
      "titleEdit": "Modifier le webhook",
      "name": "Nom du webhook",
      "namePlaceholder": "Mon webhook gateway",
      "nameHint": "Doit contenir entre 1 et 128 caractères.",
      "apiAuth": "Authentification par clé API",
      "apiAuthHint": "Envoie la clé API dans l'en-tête x-make-apikey. Ajoute une ou plusieurs; si l'une d'elles correspond, l'accès est accordé.",
      "apiKeyName": "Nom",
      "apiKeyValue": "Valeur de la clé API",
      "apiKeyKeep": "(sauvegardée — laisse vide pour conserver)",
      "addApiKey": "Ajouter une clé API",
      "ipTitle": "Restrictions d'IP",
      "ipHint": "Liste des adresses IP séparées par une virgule. Tu peux utiliser la notation CIDR. Vide = aucune vérification.",
      "dataStructure": "Structure de données",
      "dataStructureHint": "Validation des données entrantes. Vide = acceptées sans validation.",
      "dsValidate": "Valider la structure de données",
      "dsStrict": "Strict (rejeter les champs non spécifiés)",
      "dsFieldName": "Nom",
      "dsFieldDesc": "Description",
      "dsFieldType": "Type",
      "dsFieldDefault": "Valeur par défaut",
      "dsFieldRequired": "Requis",
      "dsFieldMultiline": "Multiligne",
      "addItem": "Ajouter un champ",
      "getHeaders": "Obtenir les en-têtes de la requête",
      "getHeadersHint": "Les en-têtes seront ajoutées au corps.",
      "getMethod": "Obtenir la méthode HTTP",
      "getMethodHint": "La méthode (verbe) sera ajoutée au corps.",
      "jsonPassthrough": "Enregistrer le JSON comme texte",
      "jsonPassthroughHint": "Si activée, la charge utile JSON est enregistrée sous forme de chaîne.",
      "enabled": "Webhook actif",
      "advanced": "Paramètres avancés",
      "btnCancel": "Annuler",
      "btnSave": "Enregistrer"
    },
    "payloads": {
      "title": "Charges utiles reçues",
      "empty": "Aucune charge utile reçue pour le moment.",
      "btnClose": "Fermer"
    },
    "confirm": {
      "deleteTitle": "Supprimer le webhook",
      "deleteBody": "Supprimer le webhook « {name} » ? Les payloads stockés seront perdus.",
      "deleteBtn": "Oui, supprimer"
    },
    "toasts": {
      "created": "Webhook créé",
      "updated": "Webhook mis à jour",
      "deleted": "Webhook supprimé",
      "copied": "URL copiée",
      "error": "Erreur lors de l'enregistrement"
    }
  },
  "table": {
    "gateway": {
      "columns": {
        "name": "Nom",
        "auth": "Auth",
        "recibidos": "Reçus",
        "ultima": "Dernier",
        "estado": "Statut"
      },
      "filters": {
        "searchName": "Rechercher un nom…",
        "estado": "Statut"
      },
      "rowActions": {
        "copy": "Copier l'URL",
        "payloads": "Voir les payloads",
        "edit": "Modifier",
        "delete": "Supprimer"
      },
      "options": {
        "statusActive": "Actif",
        "statusPaused": "Suspendu"
      }
    },
    "webhooks": {
      "columns": {
        "url": "URL",
        "eventos": "Événements",
        "estado": "Statut"
      },
      "filters": {
        "searchUrl": "Rechercher une URL…",
        "estado": "Statut"
      },
      "rowActions": {
        "regenerate": "Faire tourner le secret",
        "delete": "Supprimer"
      },
      "options": {
        "statusActive": "Actif",
        "statusPaused": "Suspendu",
        "statusFailing": "Défaillant"
      }
    },
    "apiKeys": {
      "columns": {
        "name": "Nom",
        "prefix": "Préfixe",
        "creada": "Créée",
        "expira": "Expire"
      },
      "filters": {
        "searchName": "Rechercher un nom…"
      },
      "rowActions": {
        "revoke": "Révoquer"
      }
    },
    "discovered": {
      "columns": {
        "origen": "Source",
        "name": "Nom",
        "target": "Cible",
        "location": "Emplacement",
        "estado": "Statut"
      },
      "filters": {
        "searchTarget": "Rechercher une cible…",
        "origen": "Source"
      },
      "rowActions": {
        "detail": "Voir le détail",
        "delete": "Supprimer"
      },
      "options": {
        "panel": "Panneau",
        "gitHook": "Git hook",
        "nginx": "Nginx",
        "cron": "Cron",
        "systemd": "systemd",
        "config": "Config",
        "proyecto": "Projet"
      }
    }
  },
  "runtime": {
    "testDelivered": "Livraison de test réussie.",
    "testFailed": "La livraison de test a échoué.",
    "loadingDeliveries": "Chargement des livraisons…",
    "loadDeliveriesError": "Impossible de charger les livraisons.",
    "noDeliveries": "Aucune livraison enregistrée pour le moment.",
    "delivered": "Livré",
    "failed": "Échec",
    "attempts": "Tentatives : {count}",
    "selectEvent": "Sélectionnez au moins un événement."
  },
  "settingsUi": {
    "title": "Paramètres Webhooks",
    "description": "Pagination et actions visibles des tableaux Webhooks.",
    "gateway": "Passerelle",
    "webhooks": "Webhooks",
    "signingSecret": "Secret de signature · copiez-le maintenant",
    "signingSecretHint": "Affiché une seule fois. Configurez-le dans le destinataire pour vérifier X-Luxipanel-Signature.",
    "recentDeliveries": "Livraisons récentes"
  }
} as const;

export default webhooks;
