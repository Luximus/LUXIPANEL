const firewall = {
  "pageTitle": "Pare-feu",
  "installWarning": {
    "title": "Composants du pare-feu non détectés",
    "description": "Le gestionnaire de paquets (apt/dnf/apk/…) sera exécuté avec la configuration par défaut et les services seront activés à la fin.",
    "btnInstall": "Installer maintenant"
  },
  "statusCard": {
    "label": "État du pare-feu (UFW)",
    "verifying": "Vérification...",
    "btnDisable": "Désactiver",
    "btnEnable": "Activer"
  },
  "securityAudit": {
    "title": "Audit de sécurité (Premium)",
    "btnStartAudit": "Lancer l'analyse",
    "scannerChecking": "vérification…",
    "btnInstallScanner": "Installer",
    "scanProgress": "Progression de l'analyse",
    "scanAi": "Analyse IA : 0 %",
    "noReports": "Aucun audit terminé. Lancez-en un nouveau pour commencer."
  },
  "ufwRules": {
    "title": "Règles UFW",
    "btnNewRule": "Nouvelle règle",
    "loading": "Chargement des règles...",
    "btnAllowCloudflare": "Autoriser Cloudflare",
    "searchLabel": "Rechercher une règle",
    "searchPlaceholder": "Rechercher un port, une IP ou un commentaire…"
  },
  "fail2ban": {
    "btnBanIp": "Bannir l'IP",
    "loading": "Chargement des jails..."
  },
  "ruleDialog": {
    "title": "Nouvelle règle UFW",
    "labelAction": "Action",
    "optionAllow": "Autoriser",
    "optionDeny": "Refuser",
    "optionReject": "Rejeter",
    "labelProtocol": "Protocole",
    "optionAny": "Quelconque",
    "labelPort": "Port",
    "placeholderPort": "25 ou 8080:8090",
    "labelFromIp": "Depuis l'IP",
    "placeholderFromIp": "any ou 192.168.0.0/24",
    "labelComment": "Commentaire (optionnel)",
    "placeholderComment": "SMTP entrant",
    "btnCancel": "Annuler",
    "btnAdd": "Ajouter la règle"
  },
  "banDialog": {
    "title": "Bannir une IP manuellement",
    "labelIp": "Adresse IP",
    "placeholderIp": "192.168.1.100",
    "labelJail": "Jail",
    "btnCancel": "Annuler",
    "btnBan": "Bannir"
  },
  "auditReportDialog": {
    "title": "Rapport d'audit de sécurité",
    "btnClose": "Fermer"
  },
  "aiAssistant": {
    "btnSuggestRules": "Suggérer des règles (IA)",
    "btnSuggestBans": "Suggérer des bannissements (IA)",
    "btnAnalyze": "Analyse IA",
    "promptUfw": "Analyse le pare-feu UFW du serveur connecté : examine son état et les règles actuelles (utilise l'outil firewall.ufw_status) et propose des règles UFW judicieuses pour renforcer la sécurité sans casser les services utilisés. Pour chaque règle proposée, explique pourquoi et fournis la commande `ufw` exacte pour l'appliquer.",
    "promptFail2ban": "Analyse Fail2ban sur le serveur connecté : examine les jails configurées et les IP bannies (utilise l'outil firewall.fail2ban_status) et propose des bannissements et des améliorations de configuration pour le protéger des attaques par force brute. Indique la jail, l'IP/plage et la raison, ainsi que les commandes à appliquer.",
    "promptAnalyze": "Effectue une analyse de sécurité générale du pare-feu sur le serveur connecté. Examine l'état d'UFW et de Fail2ban (utilise les outils firewall.ufw_status et firewall.fail2ban_status), identifie les risques, ports exposés et configurations faibles, puis livre des recommandations hiérarchisées avec les commandes pour les appliquer.",
    "analyzeRule": "Analyser avec l'IA",
    "promptRule": "Analyse cette règle UFW existante sur le serveur connecté. Explique quel trafic elle autorise ou bloque, évalue ses risques et recommande de la conserver, l'ajuster ou la remplacer. Si tu proposes des changements, inclus les commandes exactes.\n\nRègle #{number}\nAction : {action}\nDestination/port : {to}\nSource : {from}\nProtocole : {proto}\nCommentaire : {comment}"
  },
  "labels": {
    "active": "Actif",
    "inactive": "Inactif",
    "bannedCount": "{count} bannies",
    "moreIps": "+{n} plus",
    "installingText": "Installation de UFW et Fail2ban… cela peut prendre quelques minutes.",
    "installSuccessText": "Pare-feu installé avec succès.",
    "cfEdgeBlockQuestion": "Bloquer également {ip} au bord de Cloudflare ?",
    "findingsCount": "{n} résultats trouvés",
    "completedAt": "Complété en {time}",
    "scanAiProgress": "Analyse IA : {pct}%",
    "overallRisk": "Risque global",
    "unknown": "INCONNU",
    "keyThreats": "Menaces clés",
    "recommendations": "Recommandations",
    "findingsTitle": "Résultats ({n})",
    "moreFindingsCount": "+{n} résultats supplémentaires",
    "from": "depuis",
    "any": "tous",
    "scanBitNinjaProgress": "BitNinja: {pct}%",
    "scanLynisProgress": "Lynis: {pct}%",
    "scanRkhunterProgress": "Rkhunter: {pct}%",
    "scanChkrootkitProgress": "Chkrootkit: {pct}%"
  },
  "empty": {
    "noRules": "Aucune règle",
    "noJails": "Aucun jail actif"
  },
  "actions": {
    "unban": "débannir",
    "blockInCloudflare": "Bloquer dans Cloudflare",
    "dismiss": "Rejeter"
  },
  "confirm": {
    "deleteRuleMsg": "Supprimer la règle #{number} ?",
    "deleteRuleTitle": "Supprimer la règle",
    "disableFwMsg": "Désactiver le pare-feu ? Le serveur sera sans protection réseau.",
    "disableFwTitle": "Désactiver le pare-feu",
    "disableFwBtn": "Oui, désactiver",
    "cfAllowMsg": "Les règles UFW seront ajoutées pour autoriser 80/443 depuis les plages officielles de Cloudflare. Continuer ?",
    "cfAllowTitle": "Autoriser les IPs de Cloudflare",
    "cfAllowBtn": "Continuer"
  },
  "toasts": {
    "ruleDeleted": "Règle supprimée",
    "errorDelete": "Erreur lors de la suppression",
    "ipUnbanned": "{ip} débannies",
    "errorUnban": "Erreur lors du débannissement",
    "fwEnabled": "Pare-feu activé",
    "errorEnable": "Erreur lors de l'activation",
    "fwDisabled": "Pare-feu désactivé",
    "errorDisable": "Erreur lors de la désactivation",
    "fwInstalled": "Pare-feu installé",
    "ruleAdded": "Règle ajoutée",
    "ipBanned": "{ip} bannie dans {jail}",
    "errorBan": "Erreur lors du bannissement",
    "cfRulesApplied": "Règles Cloudflare appliquées ({applied})",
    "errorCfRules": "Erreur lors de l'application des règles Cloudflare",
    "errorStartAudit": "Erreur lors du démarrage de l'audit",
    "auditCompleted": "Audit terminé",
    "auditFailed": "Audit échoué",
    "errorLoadReport": "Erreur lors du chargement du rapport",
    "reportOf": "Rapport du {date}"
  },
  "errors": {
    "addRule": "Erreur lors de l'ajout de la règle"
  },
  "runtime": {
    "statusError": "Impossible de vérifier l’état",
    "rulesLoadError": "Impossible de charger les règles.",
    "noMatchingRules": "Aucune règle ne correspond au filtre.",
    "loggingSaved": "Niveau de journalisation enregistré.",
    "loggingSaveError": "Impossible d’enregistrer le niveau de journalisation."
  },
  "settingsUi": {
    "rulesView": "Vue des règles",
    "ufwLog": "Journal UFW",
    "related": "Associés",
    "title": "Paramètres du pare-feu",
    "description": "Filtres personnels et journal UFW du serveur actif.",
    "sectionsLabel": "Sections des paramètres du pare-feu",
    "showActions": "Afficher les actions",
    "all": "Toutes",
    "limit": "Limiter",
    "serverSettingHint": "Ce réglage modifie la configuration du serveur actif.",
    "logLevel": "Niveau de journalisation",
    "off": "Désactivé",
    "low": "Faible",
    "medium": "Moyen",
    "high": "Élevé",
    "full": "Complet",
    "saveLevel": "Enregistrer le niveau",
    "relatedModules": "Modules associés"
  }
} as const;

export default firewall;
