# LUXIPANEL

Révisé le 13 octobre 2026

LUXIPANEL fonctionne sur votre serveur Linux et gère les ressources locales et les cibles SSH. LP-LICENSE-SERVER fournit les comptes, paiements, tokens, catalogue de modules et services éditoriaux de luxipanel.com. Créer un compte n’installe aucun panneau et n’enregistre aucun serveur.

[en](../README.md) | [es](../translations/README.es.md) | [fr](../translations/README.fr.md) | [de](../translations/README.de.md) | [it](../translations/README.it.md) | [pt](../translations/README.pt.md) | [ru](../translations/README.ru.md) | [ar](../translations/README.ar.md) | [hi](../translations/README.hi.md) | [bn](../translations/README.bn.md) | [ja](../translations/README.ja.md) | [ko](../translations/README.ko.md)

## Avant l’installation

Prévoyez un hôte Debian/Ubuntu, un accès administrateur, un nom de domaine et un DNS fonctionnel. Les paquets actuels exigent Node.js 22.12 ou ultérieur et déclarent pnpm 11.5.0. Redis, nginx et les services utilisés par les modules activés doivent être disponibles. Examinez install.sh : il installe des dépendances et modifie la configuration système.

## Installer et se connecter

Depuis le dépôt LUXIPANEL, lancez l’installateur avec votre domaine. Utilisez --https pour une origine publique TLS ou --cloudflare si nécessaire. Configurez DNS et certificat, puis ouvrez /login avec un utilisateur Linux existant. Le premier utilisateur admissible sudo/wheel peut devenir administrateur. Le produit possède un seul mode auto-hébergé ; l’ancien mode « managed » n’est plus la procédure actuelle.

```bash
sudo bash install.sh --domain panel.example.com --https
```

## Accès local

Le panneau authentifie l’utilisateur Linux et applique ses rôles et permissions de modules. Identifiants web et clés API de compte ne remplacent pas la connexion Linux. L’exécuteur local agit sur la machine qui héberge LUXIPANEL.

## Choisir la cible avant d’agir

Sélectionnez le serveur local ou une connexion SSH dans le panneau installé. Fichiers, terminal, services et opérations compatibles utilisent cette cible selon les capacités et permissions. Vérifiez son nom avant d’écrire, de redémarrer un service ou de supprimer une ressource.

## Ajouter une cible SSH

Dans le sélecteur du panneau installé, ajoutez hôte, port, utilisateur SSH et identifiant. Ceux-ci sont chiffrés sur ce panneau, pas dans l’ancien inventaire web. Vérifiez la destination, sélectionnez-la et testez une lecture avant toute modification. SSH ne garantit pas la compatibilité de tous les modules avec tous les systèmes.

## Diagnostiquer la connexion

Vérifiez réseau, port SSH, identifiants et privilèges distants. Les adresses privées sont limitées par la politique serveur ; SERVERS_ALLOW_PRIVATE est un réglage administrateur pour les réseaux privés légitimes. Ne désactivez pas la vérification de l’hôte et n’exposez pas de secrets pour contourner un échec. Reconnectez une session expirée.

## Créer une clé API nommée

Dans le compte web, ouvrez Sécurité → API KEY, effectuez les vérifications demandées et donnez un nom descriptif à la clé. Copiez le secret affiché, puis saisissez-le via API KEY dans votre LUXIPANEL installé. Aucun serveur, IP ou identifiant SSH ne doit être sélectionné sur luxipanel.com. La clé identifie votre compte pour les services autorisés.

## Renouveler ou révoquer une clé

Le secret complet n’apparaît qu’à la création ou au renouvellement. Remplacez une clé renouvelée dans toutes les installations qui l’utilisent. La révocation bloque l’autorisation et annule les abonnements actifs aux modules associés à cette clé. N’exposez jamais le secret dans des captures, journaux, dépôts ou messages d’assistance.

## Installer et gérer les modules

Ouvrez Modules dans le panneau pour consulter catalogue, droits, dépendances et disponibilité. Activez ou installez selon votre rôle. Les fonctions intégrées et les modules du marketplace peuvent avoir des exigences différentes. Consultez prix et conditions réels avant de souscrire.

## Configurer les intégrations sur le panneau

Configurez Cloudflare pour DNS et zones, GitHub pour les dépôts, Expo pour EAS et les fournisseurs/connecteurs de l’assistant lorsqu’ils sont activés. Chaque intégration exige ses identifiants et permissions. L’ancien import de serveurs cloud et les sous-domaines gérés depuis le site ne sont plus le parcours de configuration.

## Mobile : accès direct au panneau

Ajoutez l’URL d’un LUXIPANEL installé, sélectionnez la connexion et authentifiez l’utilisateur du panneau/Linux. L’application active utilise des écrans React Native. La mémorisation conserve les données de session dans un stockage sécurisé, pas le mot de passe Linux. Modules et actions dépendent du serveur sélectionné et des permissions.

## Ordinateur : profils et onglets

Enregistrez un profil avec nom et URL du panneau, testez la connexion et ouvrez un onglet. Desktop affiche l’interface web du panneau dans une vue Electron isolée. Les onglets d’un profil partagent la session ; les profils ont des stockages distincts. Modifier l’URL efface l’ancien stockage. Fermer la fenêtre conserve l’icône système ; Quitter termine l’application.

## Mises à jour et récupération

Sauvegardez configuration et identifiants chiffrés. Conservez la clé du coffre : son remplacement rend les identifiants existants illisibles. Compilez un projet à la fois. Pour Astro, nettoyez dist, utilisez NODE_OPTIONS=--max-old-space-size=2560, redémarrez le processus et vérifiez HTTP. Après une modification d’environnement PM2, réévaluez la configuration ecosystem avec --only et --update-env.

## Préparer un signalement utile

Indiquez produit, versions client et panneau, heure, cible, erreur exacte et étapes de reproduction. Expliquez le résultat attendu et joignez une capture ou un extrait de journal expurgé. N’envoyez ni mots de passe, clés privées/API complètes, cookies de session, ni codes de récupération à deux facteurs.

## Guides associés

- [Self-hosting](../SELF-HOSTING.md)
- [Despliegue](../DESPLIEGUE-STANDALONE.md)
- [Module SDK](../MODULE-SDK-SPEC.md)
- [Testing](../TESTING.md)
- [Contributing](../CONTRIBUTING.md)
- [Security](../SECURITY.md)
- [License](../LICENSE)
