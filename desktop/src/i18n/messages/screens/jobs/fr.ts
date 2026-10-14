import type { JobsMessages } from "./es";

export const fr: JobsMessages = {
  section: "Missions",
  title: "Missions",
  subtitle: "Besoins logiciels avec séquestre de jetons",

  tab: {
    buyer: "Mes besoins",
    professional: "Qui me sont assignés",
    profile: "Mon profil professionnel",
  },

  status: {
    draft: "Brouillon",
    published: "Publié",
    assigned: "Assigné",
    in_progress: "En cours",
    disputed: "En litige",
    released: "Libéré",
    cancelled: "Annulé",
  },

  field: {
    title: "Titre",
    description: "Description",
    price: "Prix (jetons)",
    deadline: "Date limite",
    deliverables: "Livrables",
    country: "Pays",
    language: "Langue",
    workType: "Type de travail",
  },

  workType: {
    fixed: "Prix fixe",
    hourly: "À l'heure",
  },

  action: {
    publish: "Publier et financer",
    offer: "Proposer à un professionnel",
    release: "Libérer le paiement",
    delete: "Supprimer",
    accept: "Accepter",
    reject: "Refuser",
    detail: "Détails",
  },

  confirm: {
    publish: "{price} jetons seront placés sous séquestre. Continuer ?",
    release: "90 % seront versés au professionnel. Confirmer ?",
    delete: "95 % seront remboursés (5 % de commission). Supprimer ?",
  },

  toast: {
    created: "Besoin créé",
    published: "Besoin publié et financé",
    released: "Paiement libéré",
    deleted: "Besoin supprimé",
    accepted: "Offre acceptée",
    rejected: "Offre refusée",
  },

  empty: {
    buyer: "Vous n'avez encore aucun besoin",
    professional: "Vous n'avez aucune mission assignée",
  },

  error: {
    generic: "Une erreur est survenue",
    insufficientTokens: "Solde de jetons insuffisant",
    notCancellable: "Une mission en cours ne peut pas être supprimée",
    offerActive: "Une offre active existe déjà",
  },

  ai: {
    moderatePlan: "Modérer et planifier",
    plan: "Plan de travail",
    translate: "Traduire dans ma langue",
    mustModerate: "Vous devez modérer avant de publier",
    notModerated: "Le besoin n'a pas passé la modération",
    noBalance: "Pas de solde de données pour utiliser l'IA",
    unavailable: "Assistant IA indisponible",
    estimate: "Estimation (jetons)",
    professionalShare: "Professionnel (90 %)",
    platformShare: "Plateforme (10 %)",
    milestones: "Jalons",
    risks: "Risques",
    questions: "Questions à compléter",
    missing: "Champs manquants",
    draftPlaceholder: "Décrivez ce dont vous avez besoin…",
    assist: "Assister avec l'IA",
    moderation: {
      apto: "Approuvé",
      spam: "Spam",
      malicioso: "Malveillant",
      adulto: "Contenu pour adultes",
      "no-software": "Hors logiciel",
      approved: "Approuvé",
    },
    toast: {
      moderated: "Besoin modéré",
      planned: "Plan généré",
      translated: "Traduction prête",
    },
  },

  prof: {
    score: "Affinité",
    busyCount: "Occupé : {n}",
    search: {
      empty: "Aucun professionnel trouvé avec cet e-mail",
    },
  },

  profile: {
    enroll: "Activer le profil professionnel",
    save: "Enregistrer le profil",
    saved: "Profil enregistré",
    displayName: "Nom affiché",
    headline: "Accroche",
    bio: "À propos de moi",
    cvUrl: "URL du CV",
    country: "Pays",
    skills: "Compétences",
    languages: "Langues",
    links: "Liens de portfolio",
    availability: "Disponibilité",
    rating: "Évaluation",
    activeJobs: "Missions actives",
    avail: {
      available: "Disponible",
      busy: "Occupé",
      away: "Absent",
    },
  },

  offer: {
    sendMany: "Envoyer une offre à {n} professionnels",
    sent: {
      summary: "{sent} offres envoyées, {skipped} ignorées",
    },
    none: {
      selected: "Sélectionnez au moins un professionnel",
    },
    searchPlaceholder: "Rechercher un professionnel par e-mail",
    message: "Message (facultatif)",
    onlyAvailable: "Disponibles uniquement",
  },

  channel: {
    title: "Suivi",
    empty: "Aucun message pour ce besoin pour l'instant.",
    loadMore: "Charger les précédents",
    sendError: "Impossible d'envoyer le message.",
    notAssignedYet:
      "Le canal s'ouvre dès qu'un professionnel est assigné.",
    attachTooLarge: "Le fichier dépasse la taille autorisée.",
    systemRevoked: "Un accès partagé a été révoqué",
    input: "Écrivez un message…",
    send: "Envoyer",
    attach: "Joindre",
  },

  grants: {
    empty: "Vous n'avez partagé aucun accès.",
    share: "Partager l'accès",
    shareError: "Impossible de partager l'accès.",
    revoke: "Révoquer",
    revokeError: "Impossible de révoquer l'accès.",
    revoked: "Révoqué",
    refLabel: "Référence (id / lien / note)",
    keyForbidden:
      "Le matériel de clé ne peut pas être partagé. Partagez plutôt la référence (id) de la ressource.",
    label: "Étiquette",
    type: {
      server: "Serveur",
      ssh_key: "Clé SSH",
      group: "Groupe",
      link: "Lien",
      note: "Note",
    },
  },

  progress: {
    title: "Avancement du travail",
    meets100: "Atteint 100 %",
    inProgress: "En cours",
    report: "Rapport d'avancement",
    review: "Examiner l'avancement (IA)",
    toast: {
      done: "Avancement examiné",
    },
  },

  milestone: {
    title: "Jalon 50 %",
    request: "Demander 50 %",
    requested: "50 % demandés",
    approve: "Approuver 50 %",
    approved: "50 % versés",
    note: "Note (facultative)",
    split: "Professionnel {dev} · Plateforme {fee}",
    toast: {
      requested: "Jalon demandé",
      approved: "50 % versés au professionnel",
    },
  },

  edit: {
    title: "Modifier le besoin",
    save: "Enregistrer les modifications",
    propose: "Proposer des modifications",
    accept: "Accepter les modifications",
    reject: "Refuser les modifications",
    pending: "Modifications proposées",
    topup: "Coût supplémentaire (jetons)",
    topupWarn:
      "Accepter ces modifications retiendra {n} jetons supplémentaires.",
    remoderate:
      "Modifier le titre ou la description nécessite une nouvelle modération.",
    toast: {
      saved: "Besoin mis à jour",
      proposed: "Modifications proposées au professionnel",
      accepted: "Modifications acceptées",
      rejected: "Modifications refusées",
    },
  },

  dispute: {
    title: "Litige / remboursement",
    badge: "En litige",
    open: "Ouvrir un litige",
    request: "Demander un remboursement",
    reason: "Motif du litige",
    notEligible:
      "Vous ne pouvez pas encore contester (30 % du temps doit s'écouler).",
    refundPct: "Pourcentage à rembourser",
    refundPartial: "Remboursement partiel",
    refundFull: "Remboursement total",
    continue: "Poursuivre le travail",
    toast: {
      requested: "Litige ouvert",
      resolved: "Litige résolu",
    },
  },

  rating: {
    title: "Évaluez le professionnel",
    submit: "Envoyer l'évaluation",
    comment: "Commentaire (facultatif)",
    done: "Vous avez déjà évalué cette mission",
    toast: {
      done: "Merci pour votre évaluation",
    },
  },

  test: {
    require: "Exiger un test technique",
    generate: "Générer le test (IA)",
    ready: "Test prêt · {n} questions",
    aiUnavailable: "IA indisponible pour générer le test",
    required: "Test requis",
    present: "Passer le test",
    passed: "Réussi",
    failed: "Échec",
    passedBadge: "Test ✓",
    noTestBadge: "Sans test",
    acceptLocked: "Vous devez réussir le test pour accepter",
    oneAttempt: "Vous n'avez qu'1 tentative et un temps limité. Commencer le test maintenant ?",
    attemptExists: "Vous avez déjà passé ce test (1 tentative)",
    gateRequired: "Ce besoin exige la réussite d'un test technique",
    notGenerated: "Le test n'a pas encore été généré",
    invalid: "Le test n'est pas valide ; l'acheteur doit le régénérer",
    questionOf: "Question {n} sur 12",
    autoAdvance: "Avance automatique : 10 s par question, sans retour en arrière",
    next: "Suivant",
    submit: "Envoyer les réponses",
    result: {
      passed: "Réussi ! Vous pouvez maintenant accepter le travail.",
      failed: "Échec. Score : {score}/12.",
      timedOut: "Le temps du test est écoulé.",
    },
    toast: {
      required: "Préférence de test mise à jour",
      generated: "Test généré",
    },
  },
};
