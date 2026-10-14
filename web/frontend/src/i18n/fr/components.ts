const components = {
  "setupWizardFooter": {
    "rights": "Tous droits réservés.",
    "madeBy": "Réalisé par LUXISOFT",
    "termsAndConditions": "Conditions générales",
    "privacyPolicy": "Politique de confidentialité",
    "documentation": "Documentation",
    "refundPolicy": "Politique de remboursement"
  },
  "dataTable": {
    "boolTrue": "Oui",
    "boolFalse": "Non",
    "selectPage": "Sélectionner la page",
    "selectRow": "Sélectionner la ligne",
    "actions": "Actions",
    "configure": "Configurer le tableau",
    "empty": "Aucun résultat pour {title}.",
    "total": "Total",
    "selectedSummary": "{selected} sélectionnés • affichage de {shown} sur {pageSize} résultats, total des résultats : {total}",
    "summary": "affichage de {shown} sur {pageSize} résultats, total des résultats : {total}",
    "prev": "Précédent",
    "next": "Suivant",
    "pageOf": "Page {currentPage} sur {totalPages}",
    "configureTitle": "Configurer le tableau",
    "columnsAndOrder": "Colonnes visibles et ordre",
    "resultsPerPage": "Résultats par page",
    "moveUp": "Déplacer {col} vers le haut",
    "moveDown": "Déplacer {col} vers le bas",
    "defaultTitle": "tableau",
    "dragHandle": "Glisser pour réorganiser",
    "moveUpAria": "Déplacer {col} vers le haut",
    "moveDownAria": "Déplacer {col} vers le bas",
    "emptyCell": "-"
  },
  "confirmModal": {
    "title": "Confirmer",
    "cancel": "Annuler",
    "confirm": "Confirmer",
    "alertTitle": "Avis",
    "alertOk": "Compris",
    "promptTitle": "Saisissez une valeur",
    "promptCancel": "Annuler",
    "promptOk": "Valider"
  },
  "modalNavbar": {
    "back": "Retour",
    "close": "Fermer"
  },
  "viewSettingsModal": {
    "buttonLabel": "Paramètres",
    "description": "Paramètres spécifiques à ce module",
    "close": "Fermer"
  },
  "floatingTerminal": {
    "newSnippet": "Nouvel extrait",
    "close": "Fermer",
    "name": "Nom",
    "namePlaceholder": "ex. Redémarrer Postfix",
    "category": "Catégorie",
    "tags": "Étiquettes",
    "tagsHelp": "Les tags dépendent de la catégorie sélectionnée",
    "command": "Commande",
    "monacoHelp": "Monaco pour la syntaxe shell. Utilisez Ctrl+Enter pour enregistrer depuis l'éditeur.",
    "cancel": "Annuler",
    "save": "Enregistrer"
  },
  "installModal": {
    "running": "Installation… cela peut prendre quelques minutes.",
    "success": "Installation terminée.",
    "failed": "L'installation a échoué. Vérifiez le journal."
  },
  "enterPage": {
    "pageTitle": "Accès par code",
    "heading": "Accès par code de déverrouillage",
    "subtitle": "Saisissez le code que vous avez reçu pour accéder au panneau.",
    "codeLabel": "Code d'accès",
    "codePlaceholder": "p. ex. a1b2c3d4e5f6g7",
    "continue": "Continuer",
    "useAnotherCode": "Utiliser un autre code",
    "codeShort": "Code",
    "terminalAi": "Terminal / IA",
    "enter": "Entrer",
    "willBeRedirected": "Vous serez redirigé vers la connexion du panneau.",
    "featuresAvailable": "Disponibles",
    "featuresUnavailable": "Non disponibles",
    "invalidCode": "Code d'accès invalide.",
    "verifyError": "Impossible de vérifier le code. Réessayez.",
    "networkError": "Erreur réseau. Réessayez.",
    "guestSessionError": "Impossible de démarrer la session invité."
  },
  "dragHandle": "Glisser pour réorganiser",
  "logoAlt": "LUXIPANEL",
  "default": " (par défaut)",
  "emptyCell": "-",
  "loginEffects": {
    "defaultSuffix": " (par défaut)",
    "webGpuHint": "Nécessite WebGPU. Sans prise en charge, le fond par défaut apparaît."
  },
  "tableSettings": {
    "pagination": "Pagination",
    "rowsPerPage": "Lignes par page dans ce tableau.",
    "visibleActions": "Actions à afficher",
    "actionsHint": "Choisissez les actions du menu «···» de chaque ligne."
  }
} as const;

export default components;
