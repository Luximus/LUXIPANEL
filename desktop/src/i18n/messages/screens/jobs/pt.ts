import type { JobsMessages } from "./es";

export const pt: JobsMessages = {
  section: "Trabalhos",
  title: "Trabalhos",
  subtitle: "Demandas de software com custódia de tokens",

  tab: {
    buyer: "Minhas demandas",
    professional: "Atribuídos a mim",
    profile: "Meu perfil profissional",
  },

  status: {
    draft: "Rascunho",
    published: "Publicado",
    assigned: "Atribuído",
    in_progress: "Em andamento",
    disputed: "Em disputa",
    released: "Liberado",
    cancelled: "Cancelado",
  },

  field: {
    title: "Título",
    description: "Descrição",
    price: "Preço (tokens)",
    deadline: "Prazo",
    deliverables: "Entregáveis",
    country: "País",
    language: "Idioma",
    workType: "Tipo de trabalho",
  },

  workType: {
    fixed: "Preço fixo",
    hourly: "Por hora",
  },

  action: {
    publish: "Publicar e financiar",
    offer: "Oferecer a profissional",
    release: "Liberar pagamento",
    delete: "Excluir",
    accept: "Aceitar",
    reject: "Recusar",
    detail: "Detalhes",
  },

  confirm: {
    publish: "{price} tokens ficarão retidos em custódia. Continuar?",
    release: "90% serão pagos ao profissional. Confirmar?",
    delete: "95% serão reembolsados (5% de taxa). Excluir?",
  },

  toast: {
    created: "Demanda criada",
    published: "Demanda publicada e financiada",
    released: "Pagamento liberado",
    deleted: "Demanda excluída",
    accepted: "Oferta aceita",
    rejected: "Oferta recusada",
  },

  empty: {
    buyer: "Você ainda não tem demandas",
    professional: "Você não tem trabalhos atribuídos",
  },

  error: {
    generic: "Ocorreu um erro",
    insufficientTokens: "Saldo de tokens insuficiente",
    notCancellable: "Um trabalho em andamento não pode ser excluído",
    offerActive: "Já existe uma oferta ativa",
  },

  ai: {
    moderatePlan: "Moderar e planejar",
    plan: "Plano de trabalho",
    translate: "Traduzir para o meu idioma",
    mustModerate: "Você precisa moderar antes de publicar",
    notModerated: "A demanda não passou na moderação",
    noBalance: "Sem saldo de dados para usar a IA",
    unavailable: "Assistente de IA indisponível",
    estimate: "Estimativa (tokens)",
    professionalShare: "Profissional (90%)",
    platformShare: "Plataforma (10%)",
    milestones: "Marcos",
    risks: "Riscos",
    questions: "Perguntas a completar",
    missing: "Campos faltando",
    draftPlaceholder: "Descreva o que você precisa…",
    assist: "Auxiliar com IA",
    moderation: {
      apto: "Aprovado",
      spam: "Spam",
      malicioso: "Malicioso",
      adulto: "Conteúdo adulto",
      "no-software": "Não é software",
      approved: "Aprovado",
    },
    toast: {
      moderated: "Demanda moderada",
      planned: "Plano gerado",
      translated: "Tradução pronta",
    },
  },

  prof: {
    score: "Afinidade",
    busyCount: "Ocupado: {n}",
    search: {
      empty: "Nenhum profissional encontrado com esse e-mail",
    },
  },

  profile: {
    enroll: "Ativar perfil profissional",
    save: "Salvar perfil",
    saved: "Perfil salvo",
    displayName: "Nome de exibição",
    headline: "Chamada",
    bio: "Sobre mim",
    cvUrl: "URL do currículo",
    country: "País",
    skills: "Habilidades",
    languages: "Idiomas",
    links: "Links de portfólio",
    availability: "Disponibilidade",
    rating: "Avaliação",
    activeJobs: "Trabalhos ativos",
    avail: {
      available: "Disponível",
      busy: "Ocupado",
      away: "Ausente",
    },
  },

  offer: {
    sendMany: "Enviar oferta a {n} profissionais",
    sent: {
      summary: "{sent} ofertas enviadas, {skipped} ignoradas",
    },
    none: {
      selected: "Selecione ao menos um profissional",
    },
    searchPlaceholder: "Buscar profissional por e-mail",
    message: "Mensagem (opcional)",
    onlyAvailable: "Somente disponíveis",
  },

  channel: {
    title: "Acompanhamento",
    empty: "Ainda não há mensagens nesta demanda.",
    loadMore: "Carregar anteriores",
    sendError: "Não foi possível enviar a mensagem.",
    notAssignedYet:
      "O canal é habilitado quando um profissional é atribuído.",
    attachTooLarge: "O arquivo excede o limite permitido.",
    systemRevoked: "Um acesso compartilhado foi revogado",
    input: "Escreva uma mensagem…",
    send: "Enviar",
    attach: "Anexar",
  },

  grants: {
    empty: "Você não compartilhou nenhum acesso.",
    share: "Compartilhar acesso",
    shareError: "Não foi possível compartilhar o acesso.",
    revoke: "Revogar",
    revokeError: "Não foi possível revogar o acesso.",
    revoked: "Revogado",
    refLabel: "Referência (id / link / nota)",
    keyForbidden:
      "Material de chave não pode ser compartilhado. Compartilhe a referência (id) do recurso.",
    label: "Rótulo",
    type: {
      server: "Servidor",
      ssh_key: "Chave SSH",
      group: "Grupo",
      link: "Link",
      note: "Nota",
    },
  },

  progress: {
    title: "Andamento do trabalho",
    meets100: "Cumpre 100%",
    inProgress: "Em andamento",
    report: "Relatório de andamento",
    review: "Revisar andamento (IA)",
    toast: {
      done: "Andamento revisado",
    },
  },

  milestone: {
    title: "Marco de 50%",
    request: "Solicitar 50%",
    requested: "50% solicitado",
    approve: "Aprovar 50%",
    approved: "50% desembolsado",
    note: "Nota (opcional)",
    split: "Profissional {dev} · Plataforma {fee}",
    toast: {
      requested: "Marco solicitado",
      approved: "50% desembolsado ao profissional",
    },
  },

  edit: {
    title: "Editar demanda",
    save: "Salvar alterações",
    propose: "Propor alterações",
    accept: "Aceitar alterações",
    reject: "Recusar alterações",
    pending: "Alterações propostas",
    topup: "Custo adicional (tokens)",
    topupWarn: "Aceitar estas alterações reterá {n} tokens adicionais.",
    remoderate:
      "Editar o título ou a descrição exige nova moderação.",
    toast: {
      saved: "Demanda atualizada",
      proposed: "Alterações propostas ao profissional",
      accepted: "Alterações aceitas",
      rejected: "Alterações recusadas",
    },
  },

  dispute: {
    title: "Disputa / reembolso",
    badge: "Em disputa",
    open: "Abrir disputa",
    request: "Solicitar reembolso",
    reason: "Motivo da disputa",
    notEligible:
      "Você ainda não pode abrir disputa (30% do tempo deve transcorrer).",
    refundPct: "Porcentagem a reembolsar",
    refundPartial: "Reembolso parcial",
    refundFull: "Reembolso total",
    continue: "Continuar o trabalho",
    toast: {
      requested: "Disputa aberta",
      resolved: "Disputa resolvida",
    },
  },

  rating: {
    title: "Avalie o profissional",
    submit: "Enviar avaliação",
    comment: "Comentário (opcional)",
    done: "Você já avaliou este trabalho",
    toast: {
      done: "Obrigado pela sua avaliação",
    },
  },

  test: {
    require: "Exigir teste técnico",
    generate: "Gerar teste (IA)",
    ready: "Teste pronto · {n} perguntas",
    aiUnavailable: "IA indisponível para gerar o teste",
    required: "Teste obrigatório",
    present: "Fazer teste",
    passed: "Aprovado",
    failed: "Não aprovado",
    passedBadge: "Teste ✓",
    noTestBadge: "Sem teste",
    acceptLocked: "Você precisa passar no teste para aceitar",
    oneAttempt: "Você tem apenas 1 tentativa e um tempo limite. Iniciar o teste agora?",
    attemptExists: "Você já fez este teste (1 tentativa)",
    gateRequired: "Este requisito exige a aprovação em um teste técnico",
    notGenerated: "O teste ainda não foi gerado",
    invalid: "O teste não é válido; o comprador deve gerá-lo novamente",
    questionOf: "Pergunta {n} de 12",
    autoAdvance: "Avanço automático: 10 s por pergunta, sem voltar",
    next: "Próxima",
    submit: "Enviar respostas",
    result: {
      passed: "Aprovado! Agora você pode aceitar o trabalho.",
      failed: "Não aprovado. Pontuação: {score}/12.",
      timedOut: "O tempo do teste acabou.",
    },
    toast: {
      required: "Preferência de teste atualizada",
      generated: "Teste gerado",
    },
  },
};
