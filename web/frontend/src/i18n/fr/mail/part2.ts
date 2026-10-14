// Auto-split fragment of mail.ts (part 2/2) — data only, keeps <1000 lines.
// Do not reorder keys: the aggregator merges parts by spread in original order.
const mailPart2 = {
  "routing": {
    "labels": {
      "autoRemote": "Détection automatique de la configuration : Distant",
      "local": "Serveur d'échange courrier local",
      "backup": "Serveur d'échange courrier de secours",
      "remote": "Serveur d'échange courrier distant"
    },
    "currentMode": "Actuel : {mode}"
  },
  "tracking": {
    "statuses": {
      "success": "Succès",
      "deferred": "Différé",
      "failure": "Échec",
      "inProgress": "En cours",
      "unknown": "Inconnu"
    },
    "columns": {
      "event": "Événement",
      "fromAddress": "Adresse d'envoi",
      "sentTime": "Heure d'envoi",
      "spamScore": "Score de spam",
      "recipient": "Destinataire",
      "domain": "Domaine",
      "id": "ID",
      "result": "Résultat",
      "actions": "Actions"
    },
    "noRecordsFound": "Aucun enregistrement trouvé.",
    "zeroRecords": "0 enregistrement",
    "matchesZeroRecords": "La recherche correspond à 0 enregistrement.",
    "recordsCount": "{count} enregistrements",
    "matchesRecords": "La recherche correspond à {count} enregistrements.",
    "detailMeta": "Événement : {event} | ID : {id} | Destinataire : {recipient}"
  },
  "filters": {
    "ruleParts": {
      "from": "De",
      "subject": "Objet",
      "to": "À",
      "anyRecipient": "N'importe quel destinataire",
      "reply": "Réponse",
      "body": "Corps du message",
      "anyHeader": "N'importe quel en-tête",
      "notDelivered": "N'a pas été livré précédemment",
      "errorMessage": "Est un message d'erreur",
      "listId": "ID de liste",
      "spamStatus": "État du spam",
      "spamBar": "Barre de spam",
      "spamScore": "Score de spam"
    },
    "matches": {
      "contains": "contient",
      "matchesRegex": "correspond au regex",
      "doesNotContain": "ne contient pas",
      "equals": "est égal à",
      "beginsWith": "commence par",
      "endsWith": "se termine par",
      "doesNotBegin": "ne commence pas par",
      "doesNotEnd": "ne se termine pas par",
      "doesNotMatch": "ne correspond pas",
      "isAbove": "est supérieur à (nombres uniquement)",
      "isNotAbove": "n'est pas supérieur à (nombres uniquement)",
      "isBelow": "est inférieur à (nombres uniquement)",
      "isNotBelow": "n'est pas inférieur à (nombres uniquement)"
    },
    "actions": {
      "discard": "Supprimer le message",
      "redirect": "Rediriger vers l'email",
      "fail": "Échouer avec message",
      "stop": "Arrêter le traitement des règles",
      "deliverToFolder": "Livrer dans un dossier",
      "pipe": "Diriger vers un programme"
    },
    "joinOp": {
      "and": "et",
      "or": "ou"
    },
    "removeBtn": "-"
  },
  "defaultAddress": {
    "currentSetting": {
      "none": "Paramètre actuel : (aucun)",
      "forward": "Paramètre actuel : {destination}",
      "forwardDefault": "(redirection)",
      "fail": "Paramètre actuel : :fail: {message}"
    },
    "defaultFailMessage": "Pas d'utilisateur ici"
  },
  "archive": {
    "retentionOptions": {
      "oneMonth": "1 mois",
      "threeMonths": "3 mois",
      "sixMonths": "6 mois",
      "oneYear": "1 an",
      "twoYears": "2 ans",
      "fiveYears": "5 ans",
      "tenYears": "10 ans",
      "forever": "Indéfiniment",
      "custom": "Personnalisé"
    },
    "fields": {
      "incomingEmail": "Messages email entrants",
      "outgoingMailingList": "Messages email de liste de diffusion sortants",
      "outgoingEmail": "Messages email sortants"
    }
  },
  "encryption": {
    "neverExpires": "N'expire jamais"
  },
  "actions": {
    "view": "Afficher",
    "save": "Enregistrer",
    "clone": "Cloner",
    "copy": "Copier",
    "delete": "Supprimer",
    "edit": "Modifier",
    "remove": "Retirer"
  },
  "outbound": {
    "cardTitle": "Envoi d'e-mails du panneau (SMTP)",
    "cardDesc": "Compte par défaut ou SMTP externe utilisé par le panneau pour envoyer les rapports et les e-mails système.",
    "back": "Retour",
    "intro": "Identité avec laquelle LUXIPANEL envoie les e-mails système (rapports des agents cron, liens d'approbation, tests). Il peut s'agir d'un compte e-mail de ce serveur ou d'un SMTP externe n'appartenant pas au serveur.",
    "modeLabel": "Mode d'envoi",
    "modeDisabled": "Désactivé",
    "modeAccount": "Compte e-mail du serveur (par défaut)",
    "modeExternal": "SMTP externe",
    "accountLabel": "Compte d'envoi par défaut",
    "accountHint": "Utilise les identifiants SMTP enregistrés de ce compte.",
    "hostLabel": "Serveur SMTP",
    "portLabel": "Port",
    "userLabel": "Utilisateur",
    "passLabel": "Mot de passe",
    "passPlaceholder": "(inchangé)",
    "fromLabel": "Expéditeur (e-mail)",
    "fromNameLabel": "Nom de l'expéditeur",
    "secureLabel": "TLS direct (port 465)",
    "save": "Enregistrer",
    "testPlaceholder": "destinataire@exemple.com",
    "test": "Envoyer un test",
    "hostPlaceholder": "smtp.example.com",
    "fromPlaceholder": "sender@example.com",
    "fromNamePlaceholder": "Mon Entreprise"
  },
  "table": {
    "status": {
      "active": "Actif",
      "inactive": "Inactif",
      "disabled": "Désactivé"
    },
    "redirect": {
      "columns": {
        "domain": "Domaine",
        "destinos": "Destinations"
      },
      "filters": {
        "searchDomain": "Rechercher un domaine…"
      },
      "rowActions": {
        "edit": "Modifier",
        "delete": "Supprimer"
      }
    },
    "encryption": {
      "columns": {
        "keyId": "Key ID",
        "label": "Identité",
        "keySize": "Taille de clé",
        "created": "Créé",
        "expires": "Expire"
      },
      "filters": {
        "searchKey": "Rechercher une clé…"
      },
      "rowActions": {
        "view": "Afficher",
        "delete": "Supprimer"
      }
    },
    "accounts": {
      "columns": {
        "address": "Adresse",
        "domain": "Domaine",
        "uso": "Quota / Utilisation",
        "reenvios": "Transferts",
        "estado": "Statut"
      },
      "filters": {
        "search": "Rechercher une adresse ou un domaine…",
        "domain": "Domaine",
        "estado": "Statut"
      },
      "rowActions": {
        "edit": "Modifier le compte",
        "depurarIa": "Nettoyer avec l'IA",
        "password": "Changer le mot de passe",
        "toggle": "Activer / Désactiver",
        "inbox": "Ouvrir la boîte mail",
        "signatures": "Gérer les signatures",
        "default": "Définir par défaut",
        "contacts": "Gérer les contacts",
        "calendars": "Gérer les calendriers",
        "autoresponder": "Gérer le répondeur automatique",
        "filters": "Gérer les filtres",
        "forwards": "Gérer les redirections",
        "diskusage": "Gérer l'utilisation du disque",
        "clone": "Cloner la messagerie",
        "delete": "Supprimer le compte"
      },
      "quickActions": {
        "bulkForward": "Ajouter un transfert",
        "bulkQuota": "Modifier le quota",
        "bulkDelete": "Supprimer les comptes"
      }
    },
    "globalFilters": {
      "columns": {
        "name": "Filtre",
        "estado": "Statut",
        "rules": "Règles",
        "actionsCount": "Actions"
      },
      "filters": {
        "search": "Rechercher un filtre…"
      },
      "rowActions": {
        "edit": "Modifier",
        "delete": "Supprimer"
      }
    },
    "contacts": {
      "columns": {
        "email": "Email",
        "name": "Nom"
      },
      "filters": {
        "searchEmail": "Rechercher un e-mail…"
      },
      "rowActions": {
        "edit": "Modifier",
        "delete": "Supprimer"
      }
    },
    "calendars": {
      "columns": {
        "name": "Nom",
        "timezone": "Fuseau horaire",
        "estado": "Statut"
      },
      "filters": {
        "search": "Rechercher un calendrier…"
      },
      "rowActions": {
        "edit": "Modifier",
        "delete": "Supprimer"
      }
    },
    "signatures": {
      "columns": {
        "sender": "Expéditeur",
        "preview": "Signature"
      },
      "filters": {
        "search": "Filtrer et rechercher…"
      },
      "rowActions": {
        "edit": "Modifier",
        "delete": "Supprimer"
      }
    },
    "filters": {
      "columns": {
        "name": "Nom",
        "estado": "Statut"
      },
      "filters": {
        "search": "Rechercher un filtre…"
      },
      "rowActions": {
        "edit": "Modifier",
        "delete": "Supprimer"
      }
    }
  },
  "confirm": {
    "bulkDeleteAccounts": "Supprimer {count} compte(s) de messagerie ? Cette action est irréversible.",
    "deleteAccount": "Supprimer le compte {address} ? Cette action est irréversible.",
    "deleteAccountTitle": "Supprimer le compte",
    "deleteAutoresponder": "Supprimer l'autorépondeur de ce compte ?",
    "deleteByDate": "Les e-mails de {folder} entre {from} et {to} seront supprimés. Continuer ?",
    "deleteByDateTitle": "Supprimer les e-mails par date",
    "deleteCalendar": "Supprimer le calendrier \"{label}\" ?",
    "deleteCalendarTitle": "Supprimer le calendrier",
    "deleteContact": "Supprimer le contact \"{label}\" ?",
    "deleteContactTitle": "Supprimer le contact",
    "deleteDomainForward": "Supprimer la redirection globale de @{domain} ?",
    "deleteDomainForwardTitle": "Supprimer la redirection globale",
    "deleteEncryptionKey": "Supprimer cette clé de chiffrement ?",
    "deleteFilter": "Supprimer le filtre \"{name}\" ?",
    "deleteFilterTitle": "Supprimer le filtre",
    "deleteForward": "Supprimer la redirection vers {destination} ?",
    "deleteGlobalFilter": "Supprimer le filtre global \"{label}\" ?",
    "deleteGlobalFilterTitle": "Supprimer le filtre global",
    "yesDelete": "Oui, supprimer"
  },
  "empty": {
    "noDomains": "Aucun domaine",
    "noFolders": "Aucun dossier trouvé pour ce compte.",
    "noOtherAccount": "Aucun autre compte disponible"
  },
  "errors": {
    "accountCreateFailed": "Échec de la création du compte",
    "accountNotFound": "Compte introuvable",
    "accountUpdateFailed": "Échec de la mise à jour du compte",
    "accountUpdatedForwardsFailed": "Le compte a été mis à jour, mais la mise à jour des redirections a échoué",
    "accountsLoadFailed": "Échec du chargement des comptes",
    "autoDeleteThresholdInvalid": "Seuil de suppression automatique invalide.",
    "autoresponderDeleteFailed": "Impossible de supprimer l'autorépondeur",
    "autoresponderSaveFailed": "Impossible d'enregistrer l'autorépondeur.",
    "calendarDeleteFailed": "Impossible de supprimer le calendrier",
    "calendarNotFound": "Calendrier introuvable",
    "calendarSaveFailed": "Impossible d'enregistrer le calendrier.",
    "cloneCreateFailed": "Impossible de créer le nouveau compte.",
    "cloneFailed": "Impossible de cloner la messagerie.",
    "cloneIdResolveFailed": "Compte créé, mais impossible de résoudre son ID. Réessayez en mode « existant ».",
    "cloneLocalAndDomainRequired": "Indiquez la partie locale et le domaine.",
    "clonePasswordTooShort": "Le mot de passe doit comporter au moins 6 caractères.",
    "contactDeleteFailed": "Impossible de supprimer le contact",
    "contactNotFound": "Contact introuvable",
    "contactSaveFailed": "Impossible d'enregistrer le contact.",
    "copyByRangeFailed": "Impossible de copier par plage",
    "customScoreInvalid": "Score personnalisé invalide.",
    "dateRangeRequired": "Vous devez sélectionner une date de début et de fin",
    "defaultAddressLoadFailed": "Impossible de charger l'adresse par défaut.",
    "defaultAddressSaveFailed": "Impossible d'enregistrer l'adresse par défaut.",
    "deleteByRangeFailed": "Impossible de supprimer par plage",
    "deleteFailed": "Échec de la suppression",
    "destEmailInvalid": "E-mail de destination invalide",
    "destinationsInvalidFormat": "Une ou plusieurs destinations ont un format invalide.",
    "diskUsageLoadFailed": "Impossible de charger l'utilisation du disque",
    "domainForwardDeleteFailed": "Impossible de supprimer la redirection globale.",
    "domainForwardsLoadFailed": "Impossible de charger les redirections globales.",
    "domainRedirectSaveFailed": "Impossible d'enregistrer la redirection globale.",
    "domainsLoadFailed": "Impossible de charger les domaines DNS",
    "filterDeleteFailed": "Impossible de supprimer le filtre",
    "filterNotFound": "Filtre introuvable",
    "filterSaveFailed": "Impossible d'enregistrer le filtre.",
    "forwardAlreadyExists": "Une redirection vers {destination} existe déjà",
    "forwardsSaveFailed": "Impossible d'enregistrer les redirections sur le serveur",
    "globalFilterDeleteFailed": "Impossible de supprimer le filtre global.",
    "globalFilterSaveFailed": "Impossible d'enregistrer le filtre global.",
    "globalFilterTestFailed": "Impossible d'exécuter le test.",
    "globalFiltersLoadFailed": "Impossible de charger les filtres globaux.",
    "indicateTestDestEmail": "Indiquez l'e-mail de destination du test.",
    "localPartInvalid": "L'utilisateur avant @ a un format invalide.",
    "localPartInvalidNoPoint": "L'utilisateur avant @ a un format invalide",
    "mustAddAtLeastOneAction": "Vous devez ajouter au moins une action.",
    "mustAddAtLeastOneDestEmail": "Vous devez ajouter au moins un e-mail de destination.",
    "mustAddAtLeastOneRule": "Vous devez ajouter au moins une règle.",
    "mustEnterBody": "Vous devez saisir le contenu du message.",
    "mustEnterSubject": "Vous devez saisir un objet.",
    "mustEnterTestMessage": "Vous devez saisir un message de test.",
    "mustEnterValidDestEmail": "Vous devez saisir un e-mail de destination valide.",
    "mustIndicateCalendarName": "Vous devez indiquer un nom de calendrier.",
    "mustIndicateContactEmail": "Vous devez indiquer l'e-mail du contact.",
    "mustIndicateFilterName": "Vous devez indiquer un nom de filtre.",
    "mustIndicateName": "Vous devez indiquer un nom.",
    "mustSelectDomain": "Vous devez sélectionner un domaine.",
    "mustSelectDomainNoPoint": "Vous devez sélectionner un domaine",
    "noAutoresponderToDelete": "Aucun autorépondeur à supprimer",
    "passwordChangeFailed": "Échec du changement de mot de passe",
    "quotaInvalid": "Quota invalide",
    "routingLoadFailed": "Impossible de charger la configuration du routage des e-mails.",
    "routingSaveFailed": "Impossible d'enregistrer la configuration du routage des e-mails.",
    "saveFailed": "Échec de l'enregistrement",
    "scoreTypesLoadFailed": "Impossible de charger le catalogue des types de score.",
    "selectDestAccount": "Sélectionnez un compte de destination",
    "selectValidDomain": "Sélectionnez un domaine valide.",
    "spamFiltersLoadFailed": "Impossible de charger les filtres anti-spam.",
    "spamFiltersSaveFailed": "Impossible d'enregistrer la configuration des filtres anti-spam.",
    "testEmailFailed": "Échec de l'envoi de test",
    "toggleFailed": "Échec du changement d'état",
    "trackDeliveryLoadFailed": "Impossible de charger le suivi de la livraison."
  },
  "labels": {
    "accountColon": "Compte : {address}",
    "activating": "Activation",
    "cloneStartedBg": "Clonage lancé en arrière-plan. Vous serez prévenu par notification une fois terminé.",
    "cloning": "Clonage…",
    "currentAccountColon": "Compte actuel : {address}",
    "deactivating": "Désactivation",
    "destEmailForCount": "E-mail de destination de la redirection à ajouter sur {count} compte(s) :",
    "loading": "Chargement…",
    "newQuotaFor": "Nouveau quota en Mo pour {count} compte(s). Utilisez 0 pour illimité.",
    "no": "Non",
    "noGlobalLimit": "Aucune limite globale",
    "originColon": "Origine : {addr}",
    "sendingTest": "Envoi du test…",
    "sudoPromptMessage": "Impossible de lire l'utilisation des boîtes mail sans privilèges sur le serveur. Saisissez le mot de passe sudo de l'utilisateur SSH (enregistré chiffré sur le serveur).",
    "to": "vers",
    "total": "Total",
    "unlimited": "Illimité",
    "yes": "Oui",
    "keepCopy": "Conserver une copie"
  },
  "placeholders": {
    "passwordNoChanges": "•••••••• (inchangé)",
    "selectDomain": "Sélectionnez un domaine…",
    "value": "Valeur",
    "valueIfApplicable": "Valeur (le cas échéant)"
  },
  "status": {
    "active": "Actif",
    "deactivated": "Désactivé",
    "inactive": "Inactif"
  },
  "titles": {
    "addForward": "Ajouter une redirection",
    "changeQuota": "Modifier le quota",
    "deleteAccounts": "Supprimer les comptes",
    "deleteAutoresponder": "Supprimer l'autorépondeur",
    "deleteEncryptionKey": "Supprimer la clé",
    "deleteForward": "Supprimer la redirection"
  },
  "toasts": {
    "accountActivated": "Compte activé",
    "accountCreated": "Compte créé avec succès",
    "accountDeactivated": "Compte désactivé",
    "accountDeleted": "Compte supprimé",
    "accountUpdated": "Compte mis à jour ({localPart}@{domain})",
    "archiveDefaultUpdated": "Configuration d'archivage par défaut mise à jour.",
    "archiveDomainUpdated": "Archivage mis à jour pour {domain}.",
    "autoDeleteDisabled": "Suppression automatique désactivée",
    "autoDeleteEnabled": "Suppression automatique activée",
    "autoDeleteUpdated": "Suppression automatique mise à jour",
    "autoresponderDeleted": "Autorépondeur supprimé",
    "autoresponderSaved": "Autorépondeur enregistré",
    "blacklistUpdated": "Liste noire mise à jour",
    "bulkDeletedCount": "{ok}/{count} compte(s) supprimé(s)",
    "bulkUpdatedCount": "{ok}/{count} compte(s) mis à jour",
    "calculatedScoresUpdated": "Scores calculés mis à jour",
    "calendarCreated": "Calendrier créé",
    "calendarDeleted": "Calendrier supprimé",
    "calendarUpdated": "Calendrier mis à jour",
    "cloneStarted": "Clonage lancé — vous serez notifié une fois terminé",
    "contactCreated": "Contact créé",
    "contactDeleted": "Contact supprimé",
    "contactUpdated": "Contact mis à jour",
    "defaultAddressUpdated": "Adresse par défaut mise à jour pour @{domain}",
    "defaultInboxSet": "{address} est désormais l'adresse par défaut",
    "domainForwardDeleted": "Redirection globale de @{domain} supprimée",
    "emailRoutingUpdated": "Routage des e-mails mis à jour pour @{domain}",
    "emailsCopied": "{count} e-mails copiés de {folder}",
    "emailsDeleted": "{count} e-mails supprimés de {folder}",
    "filterCreated": "Filtre créé",
    "filterDeleted": "Filtre supprimé",
    "filterUpdated": "Filtre mis à jour",
    "forwardAddedCount": "Redirection ajoutée sur {ok}/{count} compte(s)",
    "forwardDeleted": "Redirection supprimée",
    "forwardsUpdated": "Redirections mises à jour",
    "globalFilterCreated": "Filtre global créé",
    "globalFilterDeleted": "Filtre global supprimé",
    "globalFilterUpdated": "Filtre global mis à jour",
    "globalRedirectSaved": "Redirection globale enregistrée pour @{domain}",
    "keyDeleted": "Clé supprimée.",
    "keyGenerated": "Clé générée.",
    "passwordUpdated": "Mot de passe mis à jour",
    "publicKeyImported": "Clé publique importée.",
    "settingsSaved": "Configuration enregistrée ✓",
    "spamBoxDisabled": "Boîte spam désactivée",
    "spamBoxEnabled": "Boîte spam activée",
    "spamBoxUpdated": "Boîte spam mise à jour",
    "spamFiltersDisabled": "Filtres anti-spam désactivés",
    "spamFiltersEnabled": "Filtres anti-spam activés",
    "spamThresholdUpdated": "Seuil de spam mis à jour",
    "testEmailSent": "E-mail de test envoyé ✓",
    "whitelistUpdated": "Liste blanche mise à jour"
  },
  "signaturesDrawer": {
    "title": "Signatures",
    "addSignature": "Ajouter une signature",
    "close": "Fermer",
    "tableTitle": "signatures"
  },
  "dataTableTitles": {
    "rules": "règles",
    "publicKeys": "clés publiques",
    "privateKeys": "clés privées",
    "accounts": "comptes",
    "globalFilters": "filtres globaux",
    "contacts": "contacts",
    "calendars": "calendriers",
    "filters": "filtres"
  },
  "trackColumns": {
    "event": "Événement",
    "fromAddress": "Adresse d'origine",
    "sentTime": "Heure d'envoi",
    "spamScore": "Score de spam",
    "recipient": "Destinataire",
    "domain": "Domaine",
    "queueId": "ID",
    "result": "Résultat",
    "actions": "Actions"
  }
} as const;

export default mailPart2;
