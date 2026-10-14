const settings = {
  "passkeyName": {
    "title": "Nom de la clé d’accès",
    "hint": "Choisissez un nom pour reconnaître facilement l’appareil.",
    "placeholder": "Ex. Ordinateur personnel",
    "save": "Enregistrer le nom",
    "edit": "Modifier le nom",
    "invalid": "Saisissez un nom de 1 à 128 caractères.",
    "saved": "Nom mis à jour",
    "error": "Impossible d’enregistrer le nom.",
    "cancel": "Annuler"
},
  "placeholders": {
    "logoUrl": "https://exemple.com/logo.png",
    "imageUrl": "https://…/image.jpg"
  },
  "pageTitle": "Paramètres",
  "loadFailure": {
    "title": "Impossible de charger les paramètres",
    "sessionMessage": "Impossible de charger les paramètres : votre session avec le serveur n'est pas disponible. Resélectionnez le serveur dans le sélecteur, ou déconnectez-vous puis reconnectez-vous.",
    "genericMessage": "Impossible de charger les paramètres. Vérifiez votre connexion et réessayez.",
    "retry": "Réessayer"
  },
  "header": {
    "title": "Paramètres du panneau",
    "subtitle": "Configuration globale de LuxiPanel",
    "autosave": "Sauvegarde automatique"
  },
  "tabs": {
    "general": "Général",
    "layoutUi": "Mise en page/Interface",
    "security": "Sécurité",
    "modules": "Modules",
    "system": "Système",
    "credentials": "Identifiants"
  },
  "credentials": {
    "hcaptcha": {
      "title": "hCaptcha",
      "desc": "Protégez la connexion du panneau avec un défi hCaptcha. Saisissez les clés depuis votre tableau de bord hCaptcha.",
      "sitekeyLabel": "Clé de site",
      "sitekeyPlaceholder": "Votre clé de site hCaptcha",
      "secretLabel": "Clé secrète",
      "secretPlaceholder": "Saisir une nouvelle clé secrète",
      "secretConfigured": "Une clé secrète est déjà définie. Laissez ce champ vide pour la conserver.",
      "statusConfigured": "Configuré",
      "statusMissing": "Non configuré",
      "saved": "Paramètres hCaptcha enregistrés"
    },
    "tolqia": {
      "label": "Tolqia",
      "help": "Jeton d’API de votre compte Tolqia (offre Plus ou Premium) — active les appels traduits pour les utilisateurs de ce serveur",
      "guide": {
        "steps": [
          "Rendez-vous sur tolqia.com et connectez-vous à votre compte (offre Plus ou Premium).",
          "Ouvrez « Paramètres » › « API » et créez un nouveau jeton.",
          "Copiez le jeton (il commence par tq_live_) et collez-le dans « Configurer »."
        ],
        "docUrl": "https://tolqia.com/settings/api",
        "docLabel": "Créer un jeton sur tolqia.com → Paramètres › API",
        "docUrl2": "https://tolqia.com/docs",
        "docLabel2": "Documentation"
      }
    },
    "elevenlabs": {
      "label": "ElevenLabs",
      "help": "Utilisé pour la traduction en temps réel des appels audio",
      "voiceIdLabel": "Voice ID par défaut",
      "voiceIdPlaceholder": "p. ex. 21m00Tcm4TlvDq8ikWAM",
      "guide": {
        "steps": [
          "Rendez-vous sur elevenlabs.io et connectez-vous.",
          "Ouvrez «My Account» → «API Keys» et créez une nouvelle clé.",
          "Copiez la clé (elle commence par sk_) et collez-la dans «Configurer»."
        ],
        "docUrl": "https://elevenlabs.io/app/settings/api-keys",
        "docLabel": "Clés d'API ElevenLabs"
      }
    },
    "title": "Identifiants des modules",
    "subtitle": "Gérez les jetons d'accès et clés API que les modules nécessitent pour fonctionner.",
    "empty": "Aucun module nécessitant des identifiants n'est activé sur ce serveur.",
    "statusSet": "Configuré",
    "statusMissing": "Non configuré",
    "tokenLabel": "Jeton d'accès / clé API",
    "tokenPlaceholder": "Collez le jeton…",
    "save": "Enregistrer",
    "test": "Tester",
    "clear": "Supprimer",
    "manage": "Gérer",
    "show": "Afficher",
    "hide": "Masquer",
    "saved": "Identifiant enregistré",
    "cleared": "Identifiant supprimé",
    "testOk": "Connexion valide",
    "testFail": "Impossible de valider l'identifiant",
    "confirmClear": "Supprimer cet identifiant ?",
    "confirmClearTitle": "Supprimer l'identifiant",
    "error": "Une erreur s'est produite",
    "getDoc": "Obtenir un jeton",
    "managedLabel": {
      "assistant": "Agents IA"
    },
    "managedHint": {
      "assistant": "Les clés API des fournisseurs d'assistants sont gérées dans leur panneau.",
      "backups": "Les clés de stockage (S3 / R2) sont gérées dans le module Sauvegardes."
    },
    "managedSummary": {
      "assistant": "Fournisseurs d'IA (Claude, OpenAI, Gemini, …)",
      "backups": "Identifiants de stockage S3 / R2"
    },
    "storage": {
      "accountId": "ID du compte (Cloudflare)",
      "accessKeyId": "Identifiant de clé d’accès",
      "secret": "Clé d’accès secrète",
      "endpoint": "Endpoint (optionnel)",
      "region": "Région (optionnel)",
      "r2Hint": "Identifiant R2 au niveau du compte réutilisable par Sauvegardes : définissez les clés une seule fois ici et choisissez simplement un bucket dans Sauvegardes.",
      "s3Hint": "Identifiant S3 réutilisable par Sauvegardes : définissez les clés une seule fois ici et choisissez simplement un bucket dans Sauvegardes."
    },
    "connector": {
      "connect": "Enregistrer et connecter",
      "disconnect": "Déconnecter",
      "connected": "Connecté",
      "configured": "Configuré",
      "notConnected": "Non connecté",
      "unavailable": "Nécessite l'activation du module Agents IA",
      "setupGuide": "Guide de configuration"
    },
    "help": {
      "tabConfig": "Configurer",
      "tabHelp": "Aide",
      "openLink": "Ouvrir le lien",
      "guides": {
        "cloudflare": {
          "steps": [
            "Accédez à dash.cloudflare.com → « Mon profil » → « Tokens API ».",
            "Cliquez sur « Créer un token » : utilisez le modèle « Modifier une zone DNS » ou créez un token personnalisé avec les permissions dont vous avez besoin (Zone:Lecture, DNS:Modifier, etc.).",
            "Sélectionnez les zones auxquelles il aura accès et créez le token.",
            "Copiez le token (affiché une seule fois) et collez-le dans l'onglet « Configurer »."
          ],
          "docUrl": "https://dash.cloudflare.com/profile/api-tokens",
          "docLabel": "Jetons API Cloudflare"
        },
        "expo": {
          "steps": [
            "Accédez à expo.dev et connectez-vous → « Paramètres du compte » → « Tokens d'accès ».",
            "Cliquez sur « Créer un token », donnez-lui un nom et copiez la valeur générée.",
            "Collez-le dans l'onglet « Configurer »."
          ],
          "docUrl": "https://expo.dev/settings/access-tokens",
          "docLabel": "Jetons d'accès Expo"
        },
        "openclaw": {
          "steps": [
            "Accédez à openclaw.ai et connectez-vous.",
            "Générez ou copiez votre clé API depuis le tableau de bord OpenClaw.",
            "Collez-la dans « Configurer » (ajustez le point de terminaison et le modèle par défaut s'ils diffèrent)."
          ],
          "docUrl": "https://openclaw.ai",
          "docLabel": "OpenClaw"
        },
        "repository-store": {
          "steps": [
            "Accédez à github.com → « Paramètres » → « Paramètres des développeurs » → « Tokens d'accès personnels ».",
            "Générez un token (classique ou à permissions réduites) avec permission de lecture des dépôts (public_repo ou Contents: Read).",
            "Copiez le token (commence par ghp_ ou github_pat_) et collez-le dans « Configurer »."
          ],
          "docUrl": "https://github.com/settings/tokens",
          "docLabel": "Jetons GitHub"
        },
        "bitninja": {
          "steps": [
            "Accédez au tableau de bord BitNinja (admin.bitninja.io) et connectez-vous.",
            "Copiez votre License Key depuis la section licences/serveurs.",
            "Collez-la dans « Configurer »."
          ],
          "docUrl": "https://bitninja.io",
          "docLabel": "BitNinja"
        },
        "r2": {
          "steps": [
            "Accédez à dash.cloudflare.com → « R2 » → « Gérer les tokens API R2 ».",
            "Créez un « R2 API Token » (compatible S3) avec permission de lecture/écriture d'objets.",
            "Copiez l'Access Key ID et la Secret Access Key affichés.",
            "Votre Account ID apparaît sur la page R2 / résumé du compte.",
            "Collez Account ID + Access Key ID + Secret dans « Configurer » (le point de terminaison se déduit de l'Account ID)."
          ],
          "docUrl": "https://dash.cloudflare.com/?to=/:account/r2/api-tokens",
          "docLabel": "Jetons API R2"
        },
        "s3": {
          "steps": [
            "Dans la console AWS : « IAM » → « Users » → votre utilisateur → « Credentials de sécurité » → « Créer une clé d'accès ».",
            "Copiez l'Access Key ID et la Secret Access Key.",
            "Si vous utilisez un service compatible S3 (Wasabi, MinIO, etc.), notez son Endpoint et sa Région.",
            "Collez les clés (et l'Endpoint/Région le cas échéant) dans « Configurer »."
          ],
          "docUrl": "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html",
          "docLabel": "Clés d'accès AWS"
        }
      }
    }
  },
  "general": {
    "hcaptchaEnabled": "Exiger hCaptcha à la connexion",
    "hcaptchaEnabledHint": "Affiche un défi hCaptcha sur le formulaire de connexion du panneau.",
    "sectionTitle": "Général",
    "labelPanelName": "Nom du panneau",
    "labelTimezone": "Fuseau horaire",
    "labelLanguage": "Langue",
    "languageOptions": {
      "en": "English",
      "es": "Español"
    },
    "labelSessionTtl": "Durée de session (heures)",
    "labelMaxLoginAttempts": "Tentatives de connexion échouées (blocage)",
    "labelRequire2fa": "Exiger 2FA pour tous les utilisateurs",
    "btnViewLog": "Voir le journal",
    "labelAuditLog": "Activer le journal d'audit",
    "labelSwitchNewTab": "Ouvrir le serveur dans un nouvel onglet lors du changement"
  },
  "imageList": {
    "labelJson": "(JSON)",
    "labelUrls": "(URLs d'image)",
    "addButton": "Ajouter une image"
  },
  "layout": {
    "sectionTitle": "Layout, branding et UI",
    "sectionSubtitle": "Personnalisez les logos, rayons, ombres et couleurs de base du frontend.",
    "branding": {
      "groupTitle": "Branding et logos",
      "groupDesc": "Logo unique appliqué à la barre latérale, au login, à l'en-tête, au pied de page et au favicon.",
      "labelLogoUrl": "URL du logo",
      "logoUrlHelp": "Logo unique utilisé partout : barre latérale, connexion, en-tête du panneau, pied de page et écrans publics.",
      "btnUpload": "Téléverser",
      "btnPick": "Choisir",
      "btnDefault": "Par défaut",
      "restoreLogos": "Réinitialiser les logos",
      "loginLogoOpacity": "Opacité du conteneur du logo (connexion)",
      "loginLogoOpacityHelp": "Translucidité du fond du cercle du logo sur /login (0 = transparent, 100 = opaque)."
    },
    "loginBg": {
      "groupTitle": "Arrière-plan de connexion",
      "groupDesc": "Effet d'arrière-plan animé sur /login et sa couleur de repli.",
      "enableLabel": "Afficher l'arrière-plan animé sur /login",
      "labelFallbackColor": "Couleur de fond lorsqu'il est désactivé",
      "labelActiveEffect": "Effet actif sur /login",
      "previewTitle": "Aperçu de la connexion"
    },
    "shape": {
      "groupTitle": "Forme et ombres",
      "groupDesc": "Rayon global, ombres des cartes et des modales du frontend.",
      "labelRadius": "Rayon global",
      "radiusHelp": "Ex : 0.5rem, 12px.",
      "labelShadow": "Ombre de base",
      "labelModalShadow": "Ombre modale",
      "labelModalBackdrop": "Voile modal",
      "backdropHelp": "Fond des boîtes de dialogue.",
      "layer1": "Couche 1",
      "layer2": "Couche 2",
      "labelColor": "Couleur",
      "labelShadowSingle": "Ombre"
    },
    "palettes": {
      "title": "Thème de couleur",
      "subtitle": "Choisissez une palette prédéfinie ; elle s'applique à tout le panneau (clair et sombre).",
      "light": "Thème clair",
      "dark": "Thème sombre",
      "intensity": "Intensité"
    },
    "resetButton": "Réinitialiser les styles par défaut",
    "panelBg": {
      "groupTitle": "Fond du panneau",
      "groupDesc": "Effet d'arrière-plan animé dans le panneau et sa couleur de repli.",
      "enableLabel": "Afficher le fond animé du panneau",
      "labelFallbackColor": "Couleur de fond lorsque c'est désactivé",
      "labelActiveEffect": "Effet actif du panneau"
    }
  },
  "security": {
    "sectionTitle": "Sécurité",
    "loginMethodsTitle": "Méthodes de connexion autorisées",
    "loginMethodsDesc": "Au moins une méthode doit rester active. Les méthodes désactivées n'apparaîtront pas sur l'écran de connexion.",
    "loginMethodsWarning": "Au moins une méthode doit rester active.",
    "passkey": {
      "name": "Passkey",
      "desc": "Authentification biométrique / FIDO2. Les utilisateurs doivent enregistrer leur appareil.",
      "verifying": "Vérification...",
      "btnManage": "Gérer"
    },
    "password": {
      "name": "Mot de passe",
      "desc": "Connexion avec identifiant et mot de passe. Toujours disponible sans configuration préalable.",
      "configured": "Configuré"
    },
    "recovery": {
      "name": "Récupération",
      "desc": "Codes à usage unique comme sauvegarde d'urgence.",
      "verifying": "Vérification...",
      "btnManage": "Gérer"
    },
    "twoFaStatus": {
      "groupTitle": "État 2FA pour ce compte",
      "badgeDisabled": "Désactivé",
      "promptText": "Activez 2FA pour protéger ce compte administratif.",
      "btnSetup": "Configurer",
      "btnDelete": "Supprimer",
      "btnDisable": "Désactiver"
    }
  },
  "modules": {
    "sectionTitle": "Moteurs de cache par module",
    "sectionDesc1": "État et réglage de la collecte planifiée sur le serveur client.",
    "sectionDescBold": "Actif/Inactif découle du module parent",
    "modulesLink": "Modules",
    "sectionDesc2": ": désactiver un module éteint sa collecte ; le réactiver la replanifie. Seule la fréquence est ajustée ici. Les DataTables lisent des données pré-formatées depuis Redis dédié sur ce serveur ; si celui-ci est éteint ou trop ancien, on bascule sur le JSON normal.",
    "loading": "Chargement…",
    "tableHeaders": {
      "module": "Module / collection",
      "source": "Origine",
      "active": "Actif",
      "interval": "Intervalle (s)",
      "lastRefresh": "Dernier rafraîchissement",
      "duration": "Durée",
      "size": "Taille",
      "hitRatio": "Taux de succès"
    },
    "managedInPre": " (géré dans ",
    "managedInPost": ")"
  },
  "system": {
    "factoryReset": {
      "sectionTitle": "Réinitialiser les paramètres",
      "sectionSubtitle": "Restaure les paramètres du panneau aux valeurs d'usine.",
      "warningTitle": "Avertissement",
      "warningBefore": "Cette action réinitialise ",
      "warningAllSettings": "tous les paramètres de configuration",
      "warningMiddle": " du panneau (général, layout/UI, SMTP, sécurité et les préférences enregistrées par les modules) à leurs valeurs par défaut. Les utilisateurs et modules installés ",
      "warningNotDeleted": "ne sont pas supprimés",
      "warningAfter": ".",
      "btnReset": "Rétablir les paramètres d'usine"
    },
    "backupRestore": {
      "sectionTitle": "Restaurer depuis une sauvegarde",
      "sectionSubtitle": "Restaure le panneau depuis une sauvegarde précédente (module Backups requis).",
      "loading": "Chargement des sauvegardes...",
      "btnRestore": "Restaurer la sauvegarde sélectionnée"
    },
    "noBackup": {
      "title": "Restauration depuis une sauvegarde non disponible",
      "descBefore": "Installez le module ",
      "backupsModule": "Sauvegardes",
      "descAfter": " depuis le panneau des modules pour activer cette fonction."
    }
  },
  "imagePicker": {
    "title": "Choisir une image",
    "subtitle": "Images disponibles dans le dossier public du frontend.",
    "empty": "Aucune image dans le dossier public.",
    "btnUpload": "Téléverser une nouvelle image",
    "btnCancel": "Annuler"
  },
  "smtpTest": {
    "dialogTitle": "Envoyer un e-mail de test",
    "labelRecipient": "Destinataire",
    "placeholderRecipient": "vous@exemple.com",
    "btnCancel": "Annuler",
    "btnSend": "Envoyer"
  },
  "passkeysDialog": {
    "title": "Gérer les passkeys",
    "btnAdd": "Ajouter une passkey",
    "empty": "Aucune passkey enregistrée"
  },
  "recoveryDialog": {
    "title": "Codes de récupération",
    "btnGenerate": "Générer / régénérer",
    "loading": "Chargement...",
    "warningText": "Conservez ces codes dans un endroit sûr. Ils ne sont affichés qu'une seule fois.",
    "btnCopy": "Tout copier",
    "btnPrint": "Imprimer"
  },
  "setup2faDialog": {
    "title": "Configurer le 2FA",
    "subtitle": "Scannez ce code QR avec votre application d'authentification.",
    "secretLabel": "Secret manuel :",
    "copyTitle": "Copier",
    "verifyLabel": "Entrez le code à 6 chiffres :",
    "btnCancel": "Annuler",
    "btnActivate": "Activer le 2FA"
  },
  "disable2faDialog": {
    "title": "Désactiver le 2FA ?",
    "body": "Le 2FA sera désactivé, mais le secret sera conservé pour pouvoir le réactiver ultérieurement.",
    "btnCancel": "Annuler",
    "btnConfirm": "Désactiver le 2FA"
  },
  "delete2faDialog": {
    "title": "Supprimer le 2FA ?",
    "body": "Le secret stocké sera supprimé et vous devrez le reconfigurer pour utiliser à nouveau le 2FA.",
    "btnCancel": "Annuler",
    "btnConfirm": "Supprimer le 2FA"
  },
  "auditLogDialog": {
    "title": "Journal d'audit",
    "empty": "Aucune activité enregistrée"
  },
  "modulesCache": {
    "agoSeconds": "il y a {n}s",
    "agoMinutes": "il y a {n}m",
    "agoHours": "il y a {n}h",
    "agoDays": "il y a {n}j",
    "collectionSingular": "collection",
    "collectionPlural": "collections",
    "activeSingular": "active",
    "activePlural": "actives",
    "enabledTitle": "Collecte programmée via le dispatcher du serveur client",
    "badgeEnabled": "Active",
    "disabledTitle": "Module parent désactivé dans /panel/modules — la collecte est en pause",
    "badgeDisabled": "Inactive",
    "buttonSave": "Enregistrer",
    "saving": "Enregistrement…",
    "savedStatus": "{module}/{collection} mis à jour",
    "saveError": "Erreur lors de l'enregistrement de {module}/{collection} : {message}",
    "loadedSummary": "{count} collections cachéables dans {modules} modules. Les modifications s'appliquent au prochain cycle du collecteur (≤60s).",
    "loadError": "Erreur : {message}"
  },
  "labels": {
    "auditLogin": "Connexion",
    "auditLoginFailed": "Tentative de connexion échouée",
    "auditLogout": "Déconnexion",
    "auditPasswordChange": "Changement de mot de passe",
    "auditPasskeyRegister": "Passkey enregistrée",
    "auditPasskeyDelete": "Passkey supprimée",
    "auditRecoveryCodeUsed": "Code de récupération utilisé",
    "auditProfileUpdate": "Profil mis à jour",
    "auditSettingsUpdate": "Paramètres mis à jour",
    "audit2faEnabled": "2FA activé",
    "audit2faDisabled": "2FA désactivé",
    "auditEventDefault": "Événement",
    "aiHintAnthropic": "Modèles recommandés : claude-fable-5 (le plus récent), claude-sonnet-4-6 (équilibre), claude-opus-4-6 (le plus puissant)",
    "aiKeyHintAnthropic": "Obtenez votre clé API sur console.anthropic.com",
    "aiHintOpenai": "gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna",
    "aiKeyHintOpenai": "Obtenez votre clé API sur platform.openai.com",
    "aiHintOllama": "Nom du modèle installé dans Ollama local. Ne supporte pas les outils.",
    "aiKeyHintOllama": "Aucune clé API requise pour Ollama local",
    "managedByLp": "Géré par LP-LICENSE-SERVER",
    "notAvailable": "Non disponible",
    "managedExternally": "Géré en externe",
    "twoFaManagedByLp": "L'authentification est gérée depuis LP-LICENSE-SERVER dans ce mode.",
    "licenseNoStatus": "Sans état",
    "licenseActive": "Active",
    "licenseExpires": "expire le {date}",
    "licenseActiveDesc": "Licence active",
    "licenseDegraded": "Dégradée",
    "licensePending": "En attente",
    "licenseDegradedDesc": "La licence n'a pas pu être validée et le panneau est en mode dégradé.",
    "licenseNotActivated": "La licence n'est pas encore activée.",
    "passkeyCount": "{count} passkey(s) enregistrée(s)",
    "noPasskeys": "Aucune passkey enregistrée",
    "recoveryCodesGenerated": "Codes de récupération générés",
    "noRecoveryCodes": "Aucun code généré",
    "passkeyRegistered": "Enregistrée le {date}",
    "recoveryCodesActive": "Vous avez des codes de récupération actifs.",
    "recoveryCodesNone": "Vous n'avez aucun code de récupération actif.",
    "recoveryCodesDisplayed": "{count} codes générés. Conservez-les dans un endroit sûr.",
    "twoFaEnabled": "Activé",
    "twoFaEnabledDesc": "Ce 2FA sera demandé lors de la prochaine connexion. Vous pouvez le désactiver sans supprimer le secret.",
    "twoFaDisabled": "Désactivé",
    "twoFaDisabledDesc": "Le secret est toujours sauvegardé, mais il ne sera pas demandé à la connexion jusqu'à ce que vous le réactiviez.",
    "twoFaSetupPrompt": "Activez le 2FA pour protéger ce compte administratif.",
    "printRecoveryCodesTitle": "Codes de récupération - LUXIPANEL",
    "printRecoveryCodesDesc": "Conservez ces codes dans un endroit sûr. Chacun ne peut être utilisé qu'une seule fois."
  },
  "toasts": {
    "errorSaving": "Erreur lors de l'enregistrement des paramètres",
    "errorSavingAppearance": "Impossible d'enregistrer l'apparence sur le serveur de licences. Réessayez dans quelques secondes.",
    "licenseKeyAndRefRequired": "Saisissez la clé et la référence de paiement",
    "licenseActivated": "Licence activée avec succès",
    "licenseActivateError": "Impossible d'activer la licence",
    "timezoneApplyError": "Impossible d'appliquer le fuseau horaire au système",
    "timezoneSavedNotApplied": "Fuseau horaire enregistré dans le panneau, mais impossible de l'appliquer au système (vérifiez les permissions sudo).",
    "passkeysInLp": "Les passkeys sont gérées dans LP-LICENSE-SERVER",
    "passkeyDeleted": "Passkey supprimée",
    "passkeyDeleteError": "Erreur lors de la suppression de la passkey",
    "passkeyBrowserUnsupported": "Votre navigateur ne supporte pas les Passkeys",
    "passkeyRegisterInitError": "Impossible de démarrer l'enregistrement",
    "passkeyRegisterCancelled": "Enregistrement annulé",
    "passkeyRegisterFinishError": "Erreur lors de la finalisation de l'enregistrement",
    "passkeyRegistered": "Passkey enregistrée avec succès",
    "passkeyRegisterUserCancelled": "Enregistrement annulé par l'utilisateur",
    "passkeyRegisterError": "Erreur lors de l'enregistrement de la passkey",
    "recoveryCodesInLp": "Les codes de récupération sont gérés dans LP-LICENSE-SERVER",
    "recoveryCodesGenerateError": "Erreur lors de la génération des codes",
    "twoFaInLp": "Le 2FA est géré dans LP-LICENSE-SERVER",
    "twoFaSetupInitError": "Erreur lors de l'initialisation de la configuration 2FA",
    "twoFaQrError": "Impossible de générer le QR",
    "twoFaActivated": "2FA activé avec succès",
    "twoFaDisabled": "2FA désactivé pour la connexion",
    "twoFaDisableError": "Erreur lors de la désactivation du 2FA",
    "twoFaReactivated": "2FA réactivé pour la connexion",
    "twoFaActivateError": "Erreur lors de l'activation du 2FA",
    "twoFaDeleted": "2FA supprimé",
    "twoFaDeleteError": "Erreur lors de la suppression du 2FA",
    "backupRestoreUnavailable": "La restauration des backups n'est pas encore disponible depuis ce panneau.",
    "imageExceeds5mb": "L'image dépasse 5 Mo",
    "uploadingImage": "Téléchargement de l'image...",
    "imageUploadError": "Erreur lors du téléchargement de l'image",
    "imageUploadInvalidResponse": "Réponse invalide du serveur",
    "imageUploaded": "Image téléchargée avec succès",
    "logosRestored": "Logos restaurés aux valeurs par défaut",
    "codesCopied": "Codes copiés",
    "secretCopied": "Secret copié",
    "smtpTestSent": "E-mail de test envoyé à {to}",
    "smtpTestError": "Erreur lors de l'envoi",
    "layoutReset": "Styles réinitialisés aux valeurs par défaut",
    "settingsReset": "Paramètres réinitialisés",
    "settingsResetError": "Erreur lors de la réinitialisation",
    "licenseRevalidated": "Licence revalidée",
    "licenseRevalidateError": "Impossible de revalider la licence"
  },
  "actions": {
    "activating": "Activation...",
    "activateOrUpdate": "Activer / mettre à jour",
    "manage": "Gérer",
    "configure": "Configurer",
    "viewOrRegenerate": "Voir / régénérer",
    "generate": "Générer",
    "generating": "Génération...",
    "generateOrRegenerate": "Générer / régénérer",
    "disable": "Désactiver",
    "activate": "Activer",
    "activate2fa": "Activer le 2FA",
    "continue": "Continuer",
    "sending": "Envoi...",
    "send": "Envoyer",
    "resetting": "Réinitialisation...",
    "factoryReset": "Réinitialiser les paramètres d'usine"
  },
  "errors": {
    "twoFaEnter6Digits": "Saisissez les 6 chiffres du code",
    "twoFaInvalidCode": "Code invalide"
  },
  "confirm": {
    "deletePasskeyTitle": "Supprimer la passkey",
    "deletePasskeyBody": "Supprimer cette passkey ?",
    "restoreBackupBody": "Restaurer le backup \"{id}\" ?",
    "restoreBackupTitle": "Restaurer le backup",
    "restoreLogosBody": "Restaurer le logo aux valeurs par défaut de LUXIPANEL ?",
    "restoreLogosTitle": "Restaurer les logos",
    "restoreLogosConfirm": "Oui, restaurer",
    "resetLayoutBody": "Réinitialiser les styles de l'interface aux valeurs par défaut de LUXIPANEL ? Les logos, couleurs, ombres et arrière-plans personnalisés seront perdus.",
    "resetLayoutTitle": "Réinitialiser les styles",
    "resetLayoutConfirm": "Oui, réinitialiser",
    "factoryResetBody": "Êtes-vous sûr ? Cela réinitialisera tous les paramètres du panneau.",
    "factoryResetTitle": "Réinitialiser les paramètres",
    "factoryResetConfirm": "Oui, réinitialiser"
  },
  "empty": {
    "noBackups": "Aucun backup disponible."
  },
  "palettes": {
    "violet": {
      "name": "Violet",
      "description": "Palette par défaut de LUXIPANEL."
    },
    "ocean": {
      "name": "Océan",
      "description": "Bleus professionnels et sereins."
    },
    "emerald": {
      "name": "Émeraude",
      "description": "Verts frais et naturels."
    },
    "sunset": {
      "name": "Coucher de soleil",
      "description": "Oranges et ambrés chaleureux."
    },
    "rose": {
      "name": "Rose",
      "description": "Roses et magentas vibrants."
    },
    "indigo": {
      "name": "Indigo",
      "description": "Indigos élégants et modernes."
    },
    "aqua": {
      "name": "Aqua",
      "description": "Turquoises et cyan lumineux."
    },
    "graphite": {
      "name": "Graphite",
      "description": "Neutre monochromatique et sobre."
    },
    "amber": {
      "name": "Ambre",
      "description": "Dorés et miel chaleureux."
    },
    "fuchsia": {
      "name": "Fuchsia",
      "description": "Magentas et pourpres intenses."
    },
    "lime": {
      "name": "Citron vert",
      "description": "Verts citron énergiques."
    },
    "slate": {
      "name": "Ardoise",
      "description": "Gris bleuté professionnel."
    },
    "prisma": {
      "name": "Prisme",
      "description": "Mélange les couleurs de toutes les palettes en une transition continue et infinie.",
      "colors": "Couleurs",
      "addColorButton": "Ajouter une couleur",
      "addColorAria": "Choisir et ajouter une couleur à l'effet Prisma",
      "addColorInputAria": "Couleur à ajouter à l'effet Prisma",
      "editColorAria": "Modifier la couleur",
      "editColorInputAria": "Modifier la valeur de la couleur",
      "editColorHexAria": "Valeur hexadécimale de la couleur",
      "removeColorAria": "Supprimer la couleur",
      "moveUpAria": "Monter la couleur",
      "moveDownAria": "Descendre la couleur",
      "helpText": "Réorganisez la liste avec les flèches. Chaque couleur définit la séquence de l'effet."
    },
    "custom": {
      "name": "Personnalisé",
      "description": "Choisissez votre couleur de base et ajustez son intensité.",
      "baseColor": "Couleur de base",
      "baseColorAria": "Couleur de base personnalisée",
      "hexAria": "Valeur hexadécimale de la couleur de base personnalisée"
    },
    "luxisoft": {
      "description": "Bleu marine et menthe en mode clair ; graphite et menthe en mode sombre.",
      "name": "Luxisoft"
    }
  },
  "managers": {
    "default": "Gestionnaire 1"
  },
  "git": {
    "errorFallback": "Erreur"
  }
} as const;

export default settings;
