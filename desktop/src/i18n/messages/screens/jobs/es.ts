import type { Widen } from "../../_shared";

// El español es la fuente de verdad; cada otro locale se valida contra su forma
// widened (`Widen<typeof es>`), de modo que claves faltantes/sobrantes por
// pantalla afloran como errores TS.
//
// Namespace de la superficie de EMPLEOS/JOBS del escritorio (espejo del portal
// web `frontend/src/lib/portal-jobs.ts` y del data island `#lxp-jobs-i18n` de
// `frontend/src/pages/portal/jobs.astro`). El web usa claves planas con prefijo
// `jobs.*`; aquí el namespace YA es `jobs`, así que las claves van anidadas y
// sin el prefijo `jobs.` (p.ej. web `jobs.status.draft` → `t.jobs.status.draft`).
//
// F8 hecho: los 11 locales (es/en/fr/pt/it/ru/zh/ko/ja/hi/ar) están traducidos
// con calidad real; cada uno tipado contra `Widen<typeof es>` para garantizar
// que ninguna clave falte ni sobre por pantalla.
export const es = {
  // Encabezado
  section: "Trabajos",
  title: "Trabajos",
  subtitle: "Requerimientos de software con escrow de tokens",

  // Pestañas (lista por rol + perfil)
  tab: {
    buyer: "Mis requerimientos",
    professional: "Asignados a mí",
    profile: "Mi perfil profesional",
  },

  // Estados del requerimiento
  status: {
    draft: "Borrador",
    published: "Publicado",
    assigned: "Asignado",
    in_progress: "En curso",
    disputed: "En disputa",
    released: "Liberado",
    cancelled: "Cancelado",
  },

  // Campos del formulario
  field: {
    title: "Título",
    description: "Descripción",
    price: "Precio (tokens)",
    deadline: "Fecha límite",
    deliverables: "Entregables",
    country: "País",
    language: "Idioma",
    workType: "Tipo de trabajo",
  },

  // Tipo de trabajo
  workType: {
    fixed: "Precio fijo",
    hourly: "Por hora",
  },

  // Acciones por estado/rol
  action: {
    publish: "Publicar y fondear",
    offer: "Ofertar a profesional",
    release: "Liberar pago",
    delete: "Eliminar",
    accept: "Aceptar",
    reject: "Rechazar",
    detail: "Detalle",
  },

  // Confirmaciones (interpolan {price})
  confirm: {
    publish: "Se retendrán {price} tokens en escrow. ¿Continuar?",
    release: "Se pagará el 90% al profesional. ¿Confirmas?",
    delete: "Se reembolsará el 95% (5% de comisión). ¿Eliminar?",
  },

  // Toasts de éxito
  toast: {
    created: "Requerimiento creado",
    published: "Requerimiento publicado y fondeado",
    released: "Pago liberado",
    deleted: "Requerimiento eliminado",
    accepted: "Oferta aceptada",
    rejected: "Oferta rechazada",
  },

  // Estado vacío de la lista
  empty: {
    buyer: "Aún no tienes requerimientos",
    professional: "No tienes trabajos asignados",
  },

  // Errores (claves a las que mapea `jobsErrorKey`)
  error: {
    generic: "Ocurrió un error",
    insufficientTokens: "Saldo de tokens insuficiente",
    notCancellable: "No se puede eliminar un trabajo en curso",
    offerActive: "Ya existe una oferta activa",
  },

  // Asistente IA (moderación / plan / estimación / traducción)
  ai: {
    moderatePlan: "Moderar y planear",
    plan: "Plan de trabajo",
    translate: "Traducir a mi idioma",
    mustModerate: "Debes moderar antes de publicar",
    notModerated: "El requerimiento no superó la moderación",
    noBalance: "Sin saldo de datos para usar la IA",
    unavailable: "Asistente IA no disponible",
    estimate: "Estimación (tokens)",
    professionalShare: "Profesional (90%)",
    platformShare: "Plataforma (10%)",
    milestones: "Hitos",
    risks: "Riesgos",
    questions: "Preguntas para completar",
    missing: "Faltan datos",
    draftPlaceholder: "Describe qué necesitas…",
    assist: "Asistir con IA",
    moderation: {
      apto: "Apto",
      spam: "Spam",
      malicioso: "Malicioso",
      adulto: "Contenido adulto",
      "no-software": "No es software",
      approved: "Aprobado",
    },
    toast: {
      moderated: "Requerimiento moderado",
      planned: "Plan generado",
      translated: "Traducción lista",
    },
  },

  // Profesionales + ranking
  prof: {
    score: "Afinidad",
    busyCount: "Ocupado: {n}",
    search: {
      empty: "No se encontró un profesional con ese email",
    },
  },

  // Mi perfil profesional
  profile: {
    enroll: "Activar perfil profesional",
    save: "Guardar perfil",
    saved: "Perfil guardado",
    displayName: "Nombre visible",
    headline: "Titular",
    bio: "Sobre mí",
    cvUrl: "URL del CV",
    country: "País",
    skills: "Habilidades",
    languages: "Idiomas",
    links: "Enlaces de portafolio",
    availability: "Disponibilidad",
    rating: "Valoración",
    activeJobs: "Trabajos activos",
    avail: {
      available: "Disponible",
      busy: "Ocupado",
      away: "Ausente",
    },
  },

  // Ofertas múltiples
  offer: {
    sendMany: "Enviar oferta a {n} profesionales",
    sent: {
      summary: "{sent} ofertas enviadas, {skipped} omitidas",
    },
    none: {
      selected: "Selecciona al menos un profesional",
    },
    searchPlaceholder: "Buscar profesional por email",
    message: "Mensaje (opcional)",
    onlyAvailable: "Solo disponibles",
  },

  // Canal / bitácora del requerimiento
  channel: {
    title: "Seguimiento",
    empty: "Aún no hay mensajes en este requerimiento.",
    loadMore: "Cargar anteriores",
    sendError: "No se pudo enviar el mensaje.",
    notAssignedYet: "El canal se habilita cuando se asigna un profesional.",
    attachTooLarge: "El archivo supera el límite permitido.",
    systemRevoked: "Se revocó un acceso compartido",
    input: "Escribe un mensaje…",
    send: "Enviar",
    attach: "Adjuntar",
  },

  // Accesos compartidos (siempre por referencia, jamás material de llave)
  grants: {
    empty: "No has compartido ningún acceso.",
    share: "Compartir acceso",
    shareError: "No se pudo compartir el acceso.",
    revoke: "Revocar",
    revokeError: "No se pudo revocar el acceso.",
    revoked: "Revocado",
    refLabel: "Referencia (id / enlace / nota)",
    keyForbidden:
      "No se puede compartir material de llave. Comparte la referencia (id) del recurso.",
    label: "Etiqueta",
    type: {
      server: "Servidor",
      ssh_key: "Llave SSH",
      group: "Grupo",
      link: "Enlace",
      note: "Nota",
    },
  },

  // Avance del trabajo (revisión IA)
  progress: {
    title: "Avance del trabajo",
    meets100: "Cumple el 100%",
    inProgress: "En progreso",
    report: "Informe de avance",
    review: "Revisar avance (IA)",
    toast: {
      done: "Avance revisado",
    },
  },

  // Hito 50%
  milestone: {
    title: "Hito 50%",
    request: "Solicitar 50%",
    requested: "50% solicitado",
    approve: "Aprobar 50%",
    approved: "50% desembolsado",
    note: "Nota (opcional)",
    split: "Profesional {dev} · Plataforma {fee}",
    toast: {
      requested: "Hito solicitado",
      approved: "50% desembolsado al profesional",
    },
  },

  // Edición / propuesta de cambios
  edit: {
    title: "Editar requerimiento",
    save: "Guardar cambios",
    propose: "Proponer cambios",
    accept: "Aceptar cambios",
    reject: "Rechazar cambios",
    pending: "Cambios propuestos",
    topup: "Costo adicional (tokens)",
    topupWarn: "Aceptar estos cambios retendrá {n} tokens adicionales.",
    remoderate: "Editar el título o la descripción requiere volver a moderar.",
    toast: {
      saved: "Requerimiento actualizado",
      proposed: "Cambios propuestos al profesional",
      accepted: "Cambios aceptados",
      rejected: "Cambios rechazados",
    },
  },

  // Disputa / reembolso
  dispute: {
    title: "Disputa / reembolso",
    badge: "En disputa",
    open: "Disputa abierta",
    request: "Solicitar reembolso",
    reason: "Motivo de la disputa",
    notEligible: "Aún no puedes disputar (debe pasar el 30% del tiempo).",
    refundPct: "Porcentaje a reembolsar",
    refundPartial: "Reembolso parcial",
    refundFull: "Reembolso total",
    continue: "Continuar el trabajo",
    toast: {
      requested: "Disputa abierta",
      resolved: "Disputa resuelta",
    },
  },

  // Calificación
  rating: {
    title: "Califica al profesional",
    submit: "Enviar calificación",
    comment: "Comentario (opcional)",
    done: "Ya calificaste este trabajo",
    toast: {
      done: "Gracias por tu calificación",
    },
  },

  // Fase 11: test técnico previo
  test: {
    require: "Exigir test técnico",
    generate: "Generar test (IA)",
    ready: "Test listo · {n} preguntas",
    aiUnavailable: "IA no disponible para generar el test",
    required: "Test requerido",
    present: "Presentar test",
    passed: "Aprobado",
    failed: "No superado",
    passedBadge: "Test ✓",
    noTestBadge: "Sin test",
    acceptLocked: "Debes aprobar el test para aceptar",
    oneAttempt: "Solo tienes 1 intento y un tiempo límite. ¿Comenzar el test ahora?",
    attemptExists: "Ya presentaste este test (1 intento)",
    gateRequired: "Este requerimiento exige aprobar un test técnico",
    notGenerated: "El test aún no ha sido generado",
    invalid: "El test no es válido; el comprador debe regenerarlo",
    questionOf: "Pregunta {n} de 12",
    autoAdvance: "Avance automático: 10 s por pregunta, sin volver atrás",
    next: "Siguiente",
    submit: "Enviar respuestas",
    result: {
      passed: "¡Aprobado! Ya puedes aceptar el trabajo.",
      failed: "No superado. Puntaje: {score}/12.",
      timedOut: "Se agotó el tiempo del test.",
    },
    toast: {
      required: "Preferencia de test actualizada",
      generated: "Test generado",
    },
  },
} as const;

export type JobsMessages = Widen<typeof es>;
