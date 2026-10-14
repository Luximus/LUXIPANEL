const errors = {
  "networkError": {
    "serverError": "Le serveur a renvoyé une erreur {status} (l'opération a peut-être expiré).",
    "invalidResponse": "Réponse non valide du serveur.",
    "connectionFailed": "Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.",
    "targetScopeChanged": "Le serveur sélectionné a changé ; rechargez la page.",
    "bridgeSessionRequired": "Sélectionnez ou reconnectez un serveur pour continuer."
  },
  "error400": {
    "code": "400",
    "title": "Requête invalide",
    "description": "La requête envoyée contient des paramètres invalides. Vérifiez les données et réessayez."
  },
  "error401": {
    "code": "401",
    "title": "Non autorisé",
    "description": "Vous devez vous connecter pour accéder à cette ressource. Veuillez vous connecter."
  },
  "error403": {
    "code": "403",
    "title": "Accès interdit",
    "description": "Vous n'avez pas les permissions pour accéder à cette ressource."
  },
  "error404": {
    "code": "404",
    "title": "Page introuvable",
    "description": "Le chemin recherché n'existe pas ou a été déplacé. Vérifiez l'URL ou retournez à l'accueil."
  },
  "error500": {
    "code": "500",
    "title": "Erreur interne du serveur",
    "description": "Une erreur s'est produite sur notre serveur. Nous travaillons à la résoudre. Réessayez plus tard."
  },
  "error503": {
    "code": "503",
    "title": "Service indisponible",
    "description": "Le serveur est en maintenance ou surchargé. Veuillez réessayer plus tard."
  },
  "home": "Aller à l'accueil",
  "back": "Retour",
  "backToServers": "Retour aux serveurs"
} as const;

export default errors;
