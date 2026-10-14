const openclaw = {
  "pageTitle": "OpenClaw",
  "header": {
    "subtitle": "Connecte le panneau avec",
    "subtitleSuffix": "pour utiliser ses modèles et outils."
  },
  "statusCard": {
    "title": "État de la connexion",
    "descKeySet": "Clé API configurée. Cliquez sur \"Tester la connexion\" pour vérifier.",
    "descNoKey": "Aucune clé API configurée pour l'instant.",
    "btnTest": "Tester la connexion"
  },
  "form": {
    "sectionTitle": "Identifiants et endpoint",
    "sectionDesc": "La clé API est enregistrée chiffrée dans la base de données du panneau.",
    "labelEndpoint": "Endpoint",
    "placeholderEndpoint": "https://openclaw.ai",
    "hintEndpoint": "URL de base de l'API. Par défaut",
    "labelApiKey": "Clé API",
    "placeholderApiKeySet": "Configurée · {preview}",
    "placeholderApiKeyUnset": "sk-...",
    "ariaToggleKey": "Afficher ou masquer",
    "btnClearKey": "Effacer",
    "hintApiKey": "Laissez vide pour conserver la clé API actuelle.",
    "labelDefaultModel": "Modèle par défaut",
    "placeholderDefaultModel": "claw-default",
    "hintDefaultModel": "Identifiant du modèle utilisé par les appels internes qui n'en spécifient pas un.",
    "btnSave": "Enregistrer les modifications"
  },
  "help": {
    "title": "Comment obtenir ma clé API ?",
    "step1": "Connectez-vous à",
    "step2": "Ouvrez les paramètres de votre compte et créez une nouvelle clé API.",
    "step3": "Collez-la ci-dessus et enregistrez — le panneau ne l'affichera plus en clair."
  }
} as const;

export default openclaw;
