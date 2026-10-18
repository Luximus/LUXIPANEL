// Auto-split fragment of assistant.ts (part 3/3) — data only, keeps <1000 lines.
// Do not reorder keys: the aggregator merges parts by spread in original order.
const assistantPart3 = {
  "skillOptions": {
    "ponytail": {
      "mode": {
        "label": "Intensidad",
        "choices": {
          "off": "Apagado",
          "lite": "Lite — sugiere la alternativa más simple",
          "full": "Full — aplica la escalera",
          "ultra": "Ultra — extremista de YAGNI"
        }
      }
    },
    "ui-ux-pro-max": {
      "detalle": {
        "label": "Detalle",
        "choices": {
          "breve": "Breve (mínimos tokens)",
          "completo": "Completo (más detalle)"
        }
      }
    }
  },
  "toolCatalog": {
    "admin.bash": {
      "title": "Ejecutar comando bash"
    },
    "admin.restart_service": {
      "title": "Reiniciar servicio systemd"
    },
    "backup.list_jobs": {
      "title": "Listar backups configurados"
    },
    "bitninja.status": {
      "title": "Estado de BitNinja"
    },
    "cloudflare.status": {
      "title": "Estado de Cloudflare"
    },
    "cloudflare.list_zones": {
      "title": "Listar zonas de Cloudflare"
    },
    "cloudflare.list_dns_records": {
      "title": "Listar registros DNS"
    },
    "cloudflare.create_dns_record": {
      "title": "Crear registro DNS"
    },
    "cloudflare.update_dns_record": {
      "title": "Actualizar registro DNS"
    },
    "cloudflare.delete_dns_record": {
      "title": "Eliminar registro DNS"
    },
    "cloudflare.purge_cache": {
      "title": "Purgar caché de Cloudflare"
    },
    "cloudflare.get_zone_settings": {
      "title": "Ver ajustes de zona"
    },
    "cloudflare.set_zone_setting": {
      "title": "Cambiar ajuste de zona"
    },
    "cloudflare.list_access_rules": {
      "title": "Listar reglas de acceso IP"
    },
    "cloudflare.block_ip": {
      "title": "Bloquear IP en Cloudflare"
    },
    "cron.list": {
      "title": "Listar tareas cron"
    },
    "cron.add": {
      "title": "Crear tarea cron"
    },
    "cron.update": {
      "title": "Editar tarea cron"
    },
    "cron.toggle": {
      "title": "Pausar/activar tarea cron"
    },
    "cron.remove": {
      "title": "Eliminar tarea cron"
    },
    "cron.ai_list": {
      "title": "Listar agentes IA programados"
    },
    "cron.ai_logs": {
      "title": "Listar ejecuciones de un agente IA"
    },
    "cron.ai_read_log": {
      "title": "Leer la ejecución de un agente IA"
    },
    "cron.ai_run": {
      "title": "Ejecutar un agente IA programado ahora"
    },
    "cron.ai_toggle": {
      "title": "Pausar/activar un agente IA programado"
    },
    "cron.ai_add": {
      "title": "Crear agente IA programado"
    },
    "cron.ai_update": {
      "title": "Editar agente IA programado"
    },
    "cron.ai_remove": {
      "title": "Eliminar agente IA programado"
    },
    "cron.presets_get": {
      "title": "Leer configuración de agentes (presets)"
    },
    "cron.presets_set": {
      "title": "Guardar configuración de agentes (presets)"
    },
    "dashboard.overview": {
      "title": "Resumen del servidor"
    },
    "databases.list_engines": {
      "title": "Detectar motores de base de datos"
    },
    "databases.list_databases": {
      "title": "Listar bases de datos"
    },
    "databases.list_tables": {
      "title": "Listar tablas"
    },
    "databases.run_query": {
      "title": "Ejecutar consulta SQL"
    },
    "expo.status": {
      "title": "Estado de Expo"
    },
    "expo.account": {
      "title": "Cuenta de Expo"
    },
    "expo.list_projects": {
      "title": "Listar proyectos Expo"
    },
    "expo.project_info": {
      "title": "Información de proyecto"
    },
    "expo.init_project": {
      "title": "Crear proyecto Expo"
    },
    "expo.link_project": {
      "title": "Enlazar proyecto a EAS"
    },
    "expo.build": {
      "title": "Lanzar build EAS"
    },
    "expo.build_list": {
      "title": "Historial de builds"
    },
    "expo.build_view": {
      "title": "Estado de un build"
    },
    "expo.build_cancel": {
      "title": "Cancelar build"
    },
    "expo.submit": {
      "title": "Enviar a la tienda"
    },
    "expo.dev_client": {
      "title": "Arrancar dev-client (QR)"
    },
    "expo.quota": {
      "title": "Cuota de builds"
    },
    "expo.update": {
      "title": "Publicar OTA update"
    },
    "expo.env_list": {
      "title": "Listar variables EAS"
    },
    "expo.env_set": {
      "title": "Crear variable EAS"
    },
    "expo.set_google_credential": {
      "title": "Credencial de Play Store"
    },
    "expo.set_apple_credential": {
      "title": "Credencial de App Store"
    },
    "expo.webhook_create": {
      "title": "Registrar webhook EAS"
    },
    "expo.device_create": {
      "title": "Registrar dispositivo iOS"
    },
    "files.read": {
      "title": "Leer archivo"
    },
    "files.list_dir": {
      "title": "Listar directorio"
    },
    "files.grep": {
      "title": "Buscar en archivos"
    },
    "files.project_info": {
      "title": "Detectar tipo de proyecto"
    },
    "files.security_scan": {
      "title": "Escaneo heurístico de seguridad"
    },
    "files.write": {
      "title": "Escribir archivo"
    },
    "files.mkdir": {
      "title": "Crear carpeta"
    },
    "files.delete": {
      "title": "Eliminar archivo o carpeta"
    },
    "files.rename": {
      "title": "Renombrar o mover"
    },
    "files.copy": {
      "title": "Copiar archivo"
    },
    "files.chmod": {
      "title": "Cambiar permisos (chmod)"
    },
    "files.chown": {
      "title": "Cambiar propietario (chown)"
    },
    "firewall.ufw_status": {
      "title": "Estado de UFW"
    },
    "firewall.fail2ban_status": {
      "title": "Estado de fail2ban (jails)"
    },
    "hosting.list_accounts": {
      "title": "Listar cuentas de hosting"
    },
    "hosting.list_audit": {
      "title": "Ver auditoría de una cuenta de hosting"
    },
    "hosting.account_stats": {
      "title": "Estadísticas de uso de una cuenta de hosting"
    },
    "mail.list_domains": {
      "title": "Dominios disponibles"
    },
    "mail.list_messages": {
      "title": "Listar mensajes del buzón"
    },
    "mail.fetch_message": {
      "title": "Leer mensaje completo"
    },
    "mail.move_messages": {
      "title": "Mover mensajes a cuarentena"
    },
    "mail.flag_messages": {
      "title": "Marcar mensajes"
    },
    "mail.delete_messages": {
      "title": "Eliminar mensajes (permanente)"
    },
    "module-dev.validate_manifest": {
      "title": "Validar manifest"
    },
    "module-dev.run_checks": {
      "title": "Checks estáticos del módulo"
    },
    "module-dev.run_tests": {
      "title": "Ejecutar tests del módulo"
    },
    "module-dev.list_modules": {
      "title": "Mis módulos del marketplace"
    },
    "module-dev.module_status": {
      "title": "Estado de un módulo"
    },
    "module-dev.submit_module": {
      "title": "Enviar módulo a revisión"
    },
    "module-dev.resubmit_module": {
      "title": "Reenviar módulo corregido"
    },
    "module-dev.unpublish_module": {
      "title": "Despublicar módulo"
    },
    "module-dev.republish_module": {
      "title": "Reactivar módulo"
    },
    "module-dev.preview_install": {
      "title": "Instalar preview (Modo B)"
    },
    "module-dev.preview_uninstall": {
      "title": "Desinstalar preview"
    },
    "module-dev.link_project": {
      "title": "Vincular proyecto ↔ módulo"
    },
    "monitor.cpu_top": {
      "title": "Procesos con mayor CPU"
    },
    "monitor.watchdog_status": {
      "title": "Estado del reinicio automático"
    },
    "monitor.watchdog_configure": {
      "title": "Configurar reinicio automático"
    },
    "nginx.list_sites": {
      "title": "Listar sitios nginx"
    },
    "nginx.tail_access_log": {
      "title": "Cola del access.log"
    },
    "obsidian.list_vaults": {
      "title": "Listar vaults"
    },
    "obsidian.list_notes": {
      "title": "Listar notas"
    },
    "obsidian.read_note": {
      "title": "Leer nota"
    },
    "obsidian.search_notes": {
      "title": "Buscar en notas"
    },
    "obsidian.backlinks": {
      "title": "Backlinks de una nota"
    },
    "obsidian.write_note": {
      "title": "Escribir nota"
    },
    "obsidian.append_note": {
      "title": "Anexar a nota"
    },
    "obsidian.daily_note": {
      "title": "Nota diaria"
    },
    "obsidian.delete_note": {
      "title": "Eliminar nota"
    },
    "obsidian.list_containers": {
      "title": "Listar contenedores de contexto"
    },
    "obsidian.sync_containers": {
      "title": "Sincronizar contenedores de contexto"
    },
    "openclaw.config": {
      "title": "Configuración de OpenClaw"
    },
    "openclaw.test_connection": {
      "title": "Probar conexión OpenClaw"
    },
    "security-audit.last_report": {
      "title": "Último informe de auditoría"
    },
    "security-audit.ssh_posture": {
      "title": "Postura SSH del servidor"
    },
    "server-alerts.send": {
      "title": "Enviar notificación al servidor"
    },
    "server-alerts.list_rules": {
      "title": "Listar reglas de alerta"
    },
    "server-alerts.create_rule": {
      "title": "Crear regla de alerta"
    },
    "users.list": {
      "title": "Listar usuarios del panel"
    },
    "users.create": {
      "title": "Crear usuario"
    },
    "users.update": {
      "title": "Editar usuario"
    },
    "users.delete": {
      "title": "Eliminar usuario"
    },
    "users.groups_list": {
      "title": "Listar grupos con permisos"
    },
    "users.group_create": {
      "title": "Crear grupo"
    },
    "users.group_update": {
      "title": "Editar grupo"
    },
    "users.group_delete": {
      "title": "Eliminar grupo"
    },
    "webhooks.list": {
      "title": "Listar webhooks configurados"
    }
  },
  "dataPanelCatalog": {
    "admin.health": {
      "title": "Salud del servidor",
      "description": "Comprobación rápida de conexión y carga del servidor conectado, útil como contexto antes de responder preguntas operativas."
    },
    "dashboard.snapshot": {
      "title": "Resumen compacto",
      "description": "Resumen breve del servidor conectado antes de responder: carga, RAM usada, disco raíz usado y número de servicios principales activos."
    },
    "monitor.snapshot": {
      "title": "Estado del sistema",
      "description": "Resumen actual de recursos del servidor conectado: uso de CPU, carga media, memoria usada y total, y uso del sistema de archivos raíz."
    },
    "obsidian.vaults_summary": {
      "title": "Resumen de bóvedas",
      "description": "Bóvedas de Obsidian registradas en el servidor conectado, con ruta, disponibilidad y número de notas Markdown."
    }
  },
  "structurePanel": {
    "editorLoading": "Cargando editor...",
    "loading": "Cargando...",
    "createdNotice": "Creados {count} elemento(s).",
    "nothingToCreate": "Nada que crear (ya existian).",
    "savedNotice": "Guardado {rel}.",
    "noActiveProviders": "No hay ningun proveedor de IA activo. Activalo en Proveedores.",
    "improvedNotice": "Mejorado con IA. Revisa el diff y pulsa Guardar si te convence.",
    "noAiChanges": "La IA no propuso cambios.",
    "structureLoading": "Analizando estructura...",
    "retry": "Reintentar",
    "copyAllContent": "Copiar todo el contenido",
    "copied": "Copiado",
    "copy": "Copiar",
    "downloadFile": "Descargar archivo",
    "download": "Descargar",
    "diff": "Diff",
    "originalDiffTitle": "Ver diferencias frente al contenido original",
    "back": "Volver",
    "improveContentTitle": "Mejorar el contenido con IA usando el contexto del proyecto",
    "improving": "Mejorando...",
    "improveWithAi": "Mejorar con IA",
    "cancel": "Cancelar",
    "saving": "Guardando...",
    "save": "Guardar",
    "chooseProvider": "Elige el proveedor de IA",
    "close": "Cerrar",
    "noModel": "(sin modelo)",
    "directory": "Directorio",
    "structureCount": "Estructura · {count} por crear",
    "markMissing": "Marcar faltantes",
    "creating": "Creando...",
    "create": "Crear ({count})",
    "expand": "Expandir",
    "collapse": "Contraer",
    "edit": "Editar",
    "exists": "Existe",
    "createLabel": "crear",
    "fallbackFilename": "archivo.txt",
    "structureHints": {
      "claude": "Instrucciones, configuración, reglas, comandos, skills, agentes y hooks que Claude Code lee desde el directorio del proyecto.",
      "codex": "Codex CLI lee AGENTS.md como guía del proyecto y .codex/ para configuración y prompts.",
      "gemini": "Gemini CLI lee GEMINI.md como contexto del proyecto y .gemini/ para configuración y comandos."
    },
    "structureNodes": {
      "CLAUDE.md": "Instrucciones del proyecto (contexto, comandos, convenciones)",
      "CLAUDE.local.md": "Instrucciones locales (no versionar; preferencias personales)",
      ".mcp.json": "Servidores MCP del proyecto",
      ".claude/settings.json": "Configuración del proyecto (versionable)",
      ".claude/settings.local.json": "Configuración local (no versionar)",
      ".claude/rules": "Reglas reutilizables",
      ".claude/rules/code-style.md": "Regla: estilo de código",
      ".claude/rules/testing.md": "Regla: testing",
      ".claude/rules/api-conventions.md": "Regla: convenciones de API",
      ".claude/commands": "Comandos slash personalizados",
      ".claude/commands/review.md": "Comando /review",
      ".claude/commands/fix-issue.md": "Comando /fix-issue",
      ".claude/skills": "Skills del proyecto",
      ".claude/skills/deploy": "Skill: deploy",
      ".claude/skills/deploy/SKILL.md": "Definición de la skill deploy",
      ".claude/skills/deploy/deploy-config.md": "Configuración de la skill deploy",
      ".claude/agents": "Subagentes especializados",
      ".claude/agents/code-reviewer.md": "Agente: revisor de código",
      ".claude/agents/security-auditor.md": "Agente: auditor de seguridad",
      ".claude/hooks": "Hooks (scripts de ciclo de vida)",
      ".claude/hooks/validate-bash.sh": "Hook: valida comandos bash",
      "AGENTS.md": "Guía del proyecto para Codex/agentes",
      ".codex": "Configuración de Codex",
      ".codex/config.toml": "Configuración del proyecto Codex",
      ".codex/prompts": "Prompts/plantillas reutilizables",
      ".codex/prompts/review.md": "Prompt: revisión de código",
      "GEMINI.md": "Contexto del proyecto para Gemini",
      ".gemini": "Configuración de Gemini",
      ".gemini/settings.json": "Configuración del proyecto Gemini",
      ".gemini/commands": "Comandos personalizados",
      ".gemini/commands/review.toml": "Comando: review",
      "modules/*": "Raíz del módulo del marketplace",
      "modules/*/module.manifest.json": "Manifest borrador (los campos AUTO los fija la plataforma)",
      "modules/*/backend/index.js": "Backend del módulo — esqueleto defineModule() del SDK",
      "modules/*/frontend": "Frontend del módulo (Astro, opcional)",
      "modules/*/README.md": "README del módulo",
      ".claude/rules/marketplace.md": "Regla: arquitectura del marketplace (manifest, SDK, capabilities)",
      "MARKETPLACE.md": "Reglas de arquitectura del marketplace (manifest, SDK, capabilities)"
    }
  },
  "mcpConfigPanel": {
    "noInstallResponse": "Sin respuesta de instalacion",
    "summaryTitle": "Exponer capabilities del panel al CLI (MCP)",
    "optional": "opcional",
    "description": "Conecta el CLI de {providerId} con las herramientas del panel. El panel escribe la configuración directamente en el servidor target; no tienes que copiar nada.",
    "configuredTitle": "Configurado en el target",
    "tokenValidUntil": "Token valido hasta {date}.",
    "restartCli": "Reinicia el CLI en la terminal para que cargue el nuevo servidor MCP.",
    "configuring": "Configurando...",
    "configureAutomatically": "Configurar automaticamente",
    "regenerate": "Regenerar token y reconfigurar",
    "manualTitle": "Configuración manual (avanzado)",
    "generating": "Generando...",
    "generateManualSnippet": "Generar snippet manual",
    "fileLabel": "Archivo",
    "snippetLabel": "Fragmento ({format})",
    "copy": "Copiar",
    "mcpUrlLabel": "URL MCP"
  },
  "conversationMedia": {
    "download": "Descargar",
    "close": "Cerrar",
    "previous": "Anterior",
    "next": "Siguiente",
    "all": "Todos",
    "images": "Imagenes",
    "documents": "Documentos",
    "attachmentsTitle": "Adjuntos de la conversacion",
    "mediaTitle": "Multimedia",
    "emptyConversation": "No hay adjuntos en esta conversacion.",
    "imagesSection": "Imagenes",
    "documentsSection": "Documentos",
    "clickToExpand": "clic para ampliar",
    "emptyImages": "No hay imagenes.",
    "emptyDocuments": "No hay documentos.",
    "uploadToChat": "Subir archivos al chat",
    "attachToChat": "Adjuntar al chat",
    "attachFailed": "No se pudo adjuntar el archivo al chat."
  },
  "teamBoard": {
    "showMoreTasks": "Ver más tareas ({count})",
    "showFewerTasks": "Mostrar menos tareas",
    "title": "Equipo trabajando",
    "progressOf": "{done} de {total} tareas completadas",
    "statusPending": "Pendiente",
    "statusRunning": "En curso",
    "statusDone": "Hecha",
    "statusFailed": "Falló",
    "statusCanceled": "Cancelada",
    "pendingPermission": "Esperando tu aprobación",
    "openChat": "Abrir chat",
    "cancel": "Cancelar tarea",
    "cancelConfirm": "¿Cancelar esta tarea? El agente dejará de trabajar en ella.",
    "assignedTo": "Asignada a {agent}",
    "autoTurn": "Aviso automático del equipo",
    "dashboardTitle": "Equipos trabajando",
    "tokensSummary": "Tokens: {total} (líder {leader} · equipo {workers})",
    "statusQueued": "En cola",
    "verifyRunning": "Verificando…",
    "verifyPassed": "Verificado",
    "verifyFailed": "Verificación falló ({attempts})",
    "filesChanged": "{count} archivo(s)",
    "viewDiff": "Ver diff",
    "diffTitle": "Cambios de la tarea",
    "diffUnavailable": "No hay diff disponible para esta tarea (sin worktree o sin cambios).",
    "diffTruncated": "Diff truncado: la tarea cambió más contenido del que se muestra.",
    "branchIntegrated": "Rama integrada",
    "cancelAll": "Cancelar todo",
    "cancelAllConfirm": "¿Cancelar TODAS las tareas en curso? El plan activo se cerrará como fallido.",
    "addTask": "Añadir tarea",
    "addTaskTitle": "Asignar tarea a un subordinado",
    "addTaskWorker": "Subordinado",
    "addTaskWorkerPlaceholder": "— Elegir agente —",
    "addTaskNoWorkers": "Este líder no tiene subordinados directos.",
    "addTaskInstruction": "Instrucción",
    "addTaskInstructionHint": "El trabajador no ve esta conversación; incluye TODO el contexto necesario.",
    "addTaskTitleField": "Título (opcional)",
    "addTaskProject": "Proyecto (opcional)",
    "addTaskProjectNone": "— Sin proyecto —",
    "addTaskSubmit": "Asignar",
    "addTaskSubmitting": "Asignando…",
    "feedbackUp": "Buen resultado",
    "feedbackDown": "Mal resultado",
    "orgChart": "Organigrama",
    "close": "Cerrar",
    "loading": "Cargando…",
    "tokensChipTitle": "Tokens consumidos por la tarea",
    "lessThan1s": "<1 s",
    "insertions": "+{count}",
    "deletions": "-{count}"
  },
  "agentInfo": {
    "roleLabel": "Rol",
    "roleTooltip": "Rol del agente: {role}",
    "providerLabel": "Proveedor",
    "providerModelTooltip": "Proveedor {provider} · Modelo {model}",
    "projectLabel": "Proyecto",
    "projectTooltip": "Proyecto: {project}"
  },
  "mermaidDiagram": {
    "zoomOut": "Alejar",
    "zoomIn": "Acercar",
    "zoomReset": "Restablecer zoom"
  },
  "assistantErrorBoundary": {
    "errorMessage": "El asistente tuvo un error al cargar.",
    "retry": "Reintentar"
  },
} as const;

export default assistantPart3;
