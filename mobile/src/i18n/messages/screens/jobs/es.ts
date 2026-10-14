import type { Widen } from "../../_shared";

// Empleos / Jobs (portal). Español es la fuente de verdad; el resto se valida
// contra `Widen<typeof es>`, así faltantes/extra surgen como errores de TS.
// Replica la superficie de portal-jobs.ts (comprador / profesional / perfil,
// requerimientos, ofertas, asistente IA, canal/bitácora con grants, y la Fase 5
// avanzada: hito, propuestas de edición, disputa, avance IA y rating).
//
// Claves con punto (p. ej. "status.draft", "ai.noBalance") son literales planos
// a propósito: la pantalla las resuelve como `t.jobs[key]` con la misma clave
// que devuelve `jobsErrorKey` y la que arma `jobs.status.${s}` tras quitar el
// prefijo de namespace.
//
// Fase 7 entregó es+en COMPLETOS con los otros 9 locales como copia tipada de
// `en` (stubs). Fase 8 traduce con calidad real los 9 restantes (fr, pt, it,
// ru, zh, ko, ja, hi, ar); cada locale es un `JobsMessages` completo y se valida
// contra `Record<LocaleCode, JobsMessages>` (faltantes/extra = error de TS).
export const es = {
  // Navegación / tabs
  "tabTitle": "Trabajos",
  "tabBuyer": "Comprador",
  "tabProfessional": "Profesional",
  "tabProfile": "Mi perfil",

  // Estados del requerimiento (claves planas para `jobs.status.${s}`)
  "status.draft": "Borrador",
  "status.published": "Publicado",
  "status.assigned": "Asignado",
  "status.in_progress": "En progreso",
  "status.disputed": "En disputa",
  "status.released": "Liberado",
  "status.cancelled": "Cancelado",

  // Campos
  "field.title": "Título",
  "field.description": "Descripción",
  "field.price": "Precio (tokens)",
  "field.deadline": "Fecha límite",
  "field.deliverables": "Entregables",
  "field.country": "País",
  "field.language": "Idioma",
  "field.workType": "Tipo de trabajo",
  "field.displayName": "Nombre visible",
  "field.cvUrl": "URL del CV",
  "field.skills": "Habilidades",
  "field.links": "Enlaces (etiqueta|url)",
  "field.email": "correo@…",
  "workType.fixed": "Precio fijo",
  "workType.hourly": "Por hora",
  "workType.milestone": "Por hitos",

  // Acciones
  "action.publish": "Publicar",
  "action.offer": "Enviar oferta",
  "action.delete": "Eliminar",
  "action.release": "Liberar pago",
  "action.accept": "Aceptar",
  "action.reject": "Rechazar",
  "action.detail": "Ver detalle",

  // Vacíos
  "empty.buyer": "Aún no has creado requerimientos. Crea el primero.",
  "empty.professional": "Aún no tienes trabajos asignados.",

  // Confirmaciones
  "confirm.publish": "¿Publicar este requerimiento por {price} tokens? Se retendrán en garantía.",
  "confirm.release": "¿Liberar el pago al profesional? Esta acción no se puede deshacer.",
  "confirm.delete": "¿Eliminar este requerimiento? Esta acción no se puede deshacer.",

  // Toasts
  "toast.created": "Requerimiento creado.",
  "toast.published": "Requerimiento publicado.",
  "toast.released": "Pago liberado.",
  "toast.deleted": "Requerimiento eliminado.",
  "toast.accepted": "Oferta aceptada.",
  "toast.rejected": "Oferta rechazada.",

  // Errores (devueltos por `jobsErrorKey`)
  "error.generic": "Ocurrió un error. Inténtalo de nuevo.",
  "error.insufficientTokens": "No tienes suficientes tokens para el escrow.",
  "error.notCancellable": "Este requerimiento ya no se puede cancelar.",
  "error.offerActive": "Hay una oferta activa; no se puede continuar.",

  // Asistente IA
  "ai.unavailable": "Asistente IA no disponible.",
  "ai.noBalance": "Saldo de datos IA agotado.",
  "ai.notModerated": "El requerimiento aún no pasa la moderación.",
  "ai.mustModerate": "Debes moderar el requerimiento antes de continuar.",
  "ai.moderatePlan": "Moderar y planificar",
  "ai.plan": "Plan de trabajo",
  "ai.estimate": "Estimación de costo",
  "ai.professionalShare": "Parte del profesional",
  "ai.platformShare": "Parte de la plataforma",
  "ai.milestones": "Hitos",
  "ai.risks": "Riesgos",
  "ai.translate": "Traducir",
  "ai.questions": "Preguntas",
  "ai.missing": "Datos faltantes",
  "ai.draftPlaceholder": "Describe lo que necesitas y la IA completará el resto…",
  "ai.toast.moderated": "Requerimiento moderado.",
  "ai.toast.planned": "Plan generado.",
  "ai.toast.translated": "Traducción completada.",
  "ai.moderation.apto": "Apto",
  "ai.moderation.spam": "Spam",
  "ai.moderation.malicioso": "Malicioso",
  "ai.moderation.adulto": "Contenido adulto",
  "ai.moderation.no-software": "No es software",

  // Profesionales
  "prof.score": "Puntuación",
  "prof.busyCount": "{n} trabajos activos",
  "prof.search.empty": "No se encontró ningún profesional con ese correo.",
  "offer.sendMany": "Enviar oferta a {n}",
  "offer.sent.summary": "{sent} enviadas, {skipped} omitidas.",
  "offer.none.selected": "Selecciona al menos un profesional.",
  "offer.message": "Mensaje",
  "profile.save": "Guardar perfil",
  "profile.enroll": "Registrarme como profesional",
  "profile.saved": "Perfil guardado.",
  "profile.avail.available": "Disponible",
  "profile.avail.busy": "Ocupado",
  "profile.avail.away": "Ausente",

  // Canal / bitácora
  "channel.title": "Canal",
  "channel.empty": "Aún no hay mensajes.",
  "channel.loadMore": "Cargar anteriores",
  "channel.notAssignedYet": "El canal se habilita cuando se asigne un profesional.",
  "channel.attachTooLarge": "El adjunto es demasiado grande.",
  "channel.sendError": "No se pudo enviar el mensaje.",
  "channel.systemRevoked": "Acceso revocado.",

  // Grants (siempre por referencia, nunca material de llave)
  "grants.empty": "No hay accesos compartidos.",
  "grants.share": "Compartir acceso",
  "grants.revoke": "Revocar",
  "grants.revoked": "Acceso revocado.",
  "grants.keyForbidden": "Nunca se comparte material de llave por el canal.",
  "grants.refLabel": "Referencia",
  "grants.label": "Etiqueta",
  "grants.shareError": "No se pudo compartir el acceso.",
  "grants.revokeError": "No se pudo revocar el acceso.",
  "grants.type.server": "Servidor",
  "grants.type.ssh_key": "Llave SSH",
  "grants.type.group": "Grupo",
  "grants.type.link": "Enlace",
  "grants.type.note": "Nota",

  // Fase 5 — hito 50%
  "milestone.title": "Hito",
  "milestone.request": "Solicitar hito",
  "milestone.approve": "Aprobar hito",
  "milestone.requested": "Hito solicitado.",
  "milestone.approved": "Hito aprobado.",
  "milestone.note": "Nota del hito",

  // Fase 5 — propuestas de edición
  "edit.title": "Edición",
  "edit.propose": "Proponer edición",
  "edit.save": "Guardar cambios",
  "edit.accept": "Aceptar propuesta",
  "edit.reject": "Rechazar propuesta",
  "edit.pending": "Propuesta pendiente",
  "edit.topup": "Recarga adicional",
  "edit.topupWarn": "Esta edición requiere recargar {n} tokens adicionales.",
  "edit.remoderate": "Volver a moderar",

  // Fase 5 — disputa
  "dispute.title": "Disputa",
  "dispute.badge": "En disputa",
  "dispute.open": "Abrir disputa",
  "dispute.reason": "Motivo",
  "dispute.request": "Solicitar disputa",
  "dispute.notEligible": "Aún no se puede abrir una disputa.",
  "dispute.continue": "Continuar el trabajo",
  "dispute.refundPartial": "Reembolso parcial",
  "dispute.refundFull": "Reembolso total",
  "dispute.refundPct": "Porcentaje de reembolso",

  // Fase 5 — avance IA
  "progress.title": "Avance",
  "progress.review": "Revisar avance (IA)",
  "progress.report": "Informe de avance",
  "progress.meets100": "Cumple al 100%",
  "progress.inProgress": "En progreso",

  // Fase 5 — rating
  "rating.title": "Calificación",
  "rating.submit": "Enviar calificación",
  "rating.comment": "Comentario",
  "rating.done": "Calificación enviada.",

  // Fase 11 — test técnico previo
  "test.require": "Exigir test técnico",
  "test.generate": "Generar test (IA)",
  "test.ready": "Test listo · {n} preguntas",
  "test.aiUnavailable": "IA no disponible para generar el test",
  "test.required": "Test requerido",
  "test.present": "Presentar test",
  "test.passed": "Aprobado",
  "test.failed": "No superado",
  "test.passedBadge": "Test ✓",
  "test.noTestBadge": "Sin test",
  "test.acceptLocked": "Debes aprobar el test para aceptar",
  "test.oneAttempt": "Solo tienes 1 intento y un tiempo límite. ¿Comenzar el test ahora?",
  "test.attemptExists": "Ya presentaste este test (1 intento)",
  "test.gateRequired": "Este requerimiento exige aprobar un test técnico",
  "test.notGenerated": "El test aún no ha sido generado",
  "test.invalid": "El test no es válido; el comprador debe regenerarlo",
  "test.questionOf": "Pregunta {n} de 12",
  "test.autoAdvance": "Avance automático: 10 s por pregunta, sin volver atrás",
  "test.next": "Siguiente",
  "test.submit": "Enviar respuestas",
  "test.result.passed": "¡Aprobado! Ya puedes aceptar el trabajo.",
  "test.result.failed": "No superado. Puntaje: {score}/12.",
  "test.result.timedOut": "Se agotó el tiempo del test.",
  "test.toast.required": "Preferencia de test actualizada",
  "test.toast.generated": "Test generado",

  // Comunes
  "back": "Volver",
  "cancel": "Cancelar",
  "save": "Guardar",
  "close": "Cerrar",
  "retry": "Reintentar",
  "loadError": "No se pudo cargar la información.",
} as const;

export type JobsMessages = Widen<typeof es>;
