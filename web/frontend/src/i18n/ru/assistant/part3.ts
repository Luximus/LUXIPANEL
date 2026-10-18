const assistantPart3 = {
  "skillOptions": {
    "ponytail": {
      "mode": {
        "label": "Интенсивность",
        "choices": {
          "off": "Выкл",
          "lite": "Lite — предложить простейшую альтернативу",
          "full": "Full — применить лестницу",
          "ultra": "Ultra — YAGNI-экстремизм"
        }
      }
    },
    "ui-ux-pro-max": {
      "detalle": {
        "label": "Детализация",
        "choices": {
          "breve": "Краткий (минимум токенов)",
          "completo": "Полный (больше деталей)"
        }
      }
    }
  },
  "toolCatalog": {
    "admin.bash": {
      "title": "Выполнить bash-команду"
    },
    "admin.restart_service": {
      "title": "Перезапустить службу systemd"
    },
    "backup.list_jobs": {
      "title": "Список настроенных резервных копий"
    },
    "bitninja.status": {
      "title": "Статус BitNinja"
    },
    "cloudflare.status": {
      "title": "Статус Cloudflare"
    },
    "cloudflare.list_zones": {
      "title": "Список зон Cloudflare"
    },
    "cloudflare.list_dns_records": {
      "title": "Список DNS-записей"
    },
    "cloudflare.create_dns_record": {
      "title": "Создать DNS-запись"
    },
    "cloudflare.update_dns_record": {
      "title": "Обновить DNS-запись"
    },
    "cloudflare.delete_dns_record": {
      "title": "Удалить DNS-запись"
    },
    "cloudflare.purge_cache": {
      "title": "Очистить кэш Cloudflare"
    },
    "cloudflare.get_zone_settings": {
      "title": "Просмотр настроек зоны"
    },
    "cloudflare.set_zone_setting": {
      "title": "Изменить настройку зоны"
    },
    "cloudflare.list_access_rules": {
      "title": "Список правил доступа по IP"
    },
    "cloudflare.block_ip": {
      "title": "Заблокировать IP в Cloudflare"
    },
    "cron.list": {
      "title": "Список cron-задач"
    },
    "cron.add": {
      "title": "Создать cron-задачу"
    },
    "cron.update": {
      "title": "Редактировать cron-задачу"
    },
    "cron.toggle": {
      "title": "Приостановить/возобновить cron-задачу"
    },
    "cron.remove": {
      "title": "Удалить cron-задачу"
    },
    "cron.ai_list": {
      "title": "Список запланированных AI-агентов"
    },
    "cron.ai_logs": {
      "title": "Список запусков AI-агента"
    },
    "cron.ai_read_log": {
      "title": "Просмотр запуска AI-агента"
    },
    "cron.ai_run": {
      "title": "Запустить запланированный AI-агент сейчас"
    },
    "cron.ai_toggle": {
      "title": "Приостановить/возобновить запланированный AI-агент"
    },
    "cron.ai_add": {
      "title": "Создать запланированный AI-агент"
    },
    "cron.ai_update": {
      "title": "Редактировать запланированный AI-агент"
    },
    "cron.ai_remove": {
      "title": "Удалить запланированный AI-агент"
    },
    "cron.presets_get": {
      "title": "Прочитать конфигурацию агентов (presets)"
    },
    "cron.presets_set": {
      "title": "Сохранить конфигурацию агентов (presets)"
    },
    "dashboard.overview": {
      "title": "Обзор сервера"
    },
    "databases.list_engines": {
      "title": "Определить движки баз данных"
    },
    "databases.list_databases": {
      "title": "Список баз данных"
    },
    "databases.list_tables": {
      "title": "Список таблиц"
    },
    "databases.run_query": {
      "title": "Выполнить SQL-запрос"
    },
    "expo.status": {
      "title": "Статус Expo"
    },
    "expo.account": {
      "title": "Аккаунт Expo"
    },
    "expo.list_projects": {
      "title": "Список проектов Expo"
    },
    "expo.project_info": {
      "title": "Информация о проекте"
    },
    "expo.init_project": {
      "title": "Создать проект Expo"
    },
    "expo.link_project": {
      "title": "Привязать проект к EAS"
    },
    "expo.build": {
      "title": "Запустить EAS-сборку"
    },
    "expo.build_list": {
      "title": "История сборок"
    },
    "expo.build_view": {
      "title": "Статус сборки"
    },
    "expo.build_cancel": {
      "title": "Отменить сборку"
    },
    "expo.submit": {
      "title": "Отправить в магазин"
    },
    "expo.dev_client": {
      "title": "Запустить dev-client (QR)"
    },
    "expo.quota": {
      "title": "Квота сборок"
    },
    "expo.update": {
      "title": "Опубликовать OTA-обновление"
    },
    "expo.env_list": {
      "title": "Список переменных EAS"
    },
    "expo.env_set": {
      "title": "Создать переменную EAS"
    },
    "expo.set_google_credential": {
      "title": "Учётные данные Play Store"
    },
    "expo.set_apple_credential": {
      "title": "Учётные данные App Store"
    },
    "expo.webhook_create": {
      "title": "Зарегистрировать EAS webhook"
    },
    "expo.device_create": {
      "title": "Зарегистрировать iOS-устройство"
    },
    "files.read": {
      "title": "Прочитать файл"
    },
    "files.list_dir": {
      "title": "Список каталога"
    },
    "files.grep": {
      "title": "Поиск в файлах"
    },
    "files.project_info": {
      "title": "Определить тип проекта"
    },
    "files.security_scan": {
      "title": "Эвристическое сканирование безопасности"
    },
    "files.write": {
      "title": "Записать файл"
    },
    "files.mkdir": {
      "title": "Создать папку"
    },
    "files.delete": {
      "title": "Удалить файл или папку"
    },
    "files.rename": {
      "title": "Переименовать или переместить"
    },
    "files.copy": {
      "title": "Скопировать файл"
    },
    "files.chmod": {
      "title": "Изменить права доступа (chmod)"
    },
    "files.chown": {
      "title": "Изменить владельца (chown)"
    },
    "firewall.ufw_status": {
      "title": "Статус UFW"
    },
    "firewall.fail2ban_status": {
      "title": "Статус fail2ban (jails)"
    },
    "hosting.list_accounts": {
      "title": "Список хостинг-аккаунтов"
    },
    "hosting.list_audit": {
      "title": "Просмотр журнала аудита хостинг-аккаунта"
    },
    "hosting.account_stats": {
      "title": "Статистика использования хостинг-аккаунта"
    },
    "mail.list_domains": {
      "title": "Доступные домены"
    },
    "mail.list_messages": {
      "title": "Список сообщений почтового ящика"
    },
    "mail.fetch_message": {
      "title": "Прочитать сообщение полностью"
    },
    "mail.move_messages": {
      "title": "Переместить сообщения в карантин"
    },
    "mail.flag_messages": {
      "title": "Отметить сообщения"
    },
    "mail.delete_messages": {
      "title": "Удалить сообщения (безвозвратно)"
    },
    "module-dev.validate_manifest": {
      "title": "Проверить manifest"
    },
    "module-dev.run_checks": {
      "title": "Статическая проверка модуля"
    },
    "module-dev.run_tests": {
      "title": "Запустить тесты модуля"
    },
    "module-dev.list_modules": {
      "title": "Мои модули в маркетплейсе"
    },
    "module-dev.module_status": {
      "title": "Статус модуля"
    },
    "module-dev.submit_module": {
      "title": "Отправить модуль на проверку"
    },
    "module-dev.resubmit_module": {
      "title": "Повторно отправить исправленный модуль"
    },
    "module-dev.unpublish_module": {
      "title": "Снять модуль с публикации"
    },
    "module-dev.republish_module": {
      "title": "Повторно опубликовать модуль"
    },
    "module-dev.preview_install": {
      "title": "Установить превью (Режим B)"
    },
    "module-dev.preview_uninstall": {
      "title": "Удалить превью"
    },
    "module-dev.link_project": {
      "title": "Привязать проект ↔ модуль"
    },
    "monitor.cpu_top": {
      "title": "Топ процессов по CPU"
    },
    "monitor.watchdog_status": {
      "title": "Статус автоперезапуска"
    },
    "monitor.watchdog_configure": {
      "title": "Настроить автоперезапуск"
    },
    "nginx.list_sites": {
      "title": "Список сайтов nginx"
    },
    "nginx.tail_access_log": {
      "title": "Хвост access.log"
    },
    "obsidian.list_vaults": {
      "title": "Список хранилищ"
    },
    "obsidian.list_notes": {
      "title": "Список заметок"
    },
    "obsidian.read_note": {
      "title": "Прочитать заметку"
    },
    "obsidian.search_notes": {
      "title": "Поиск в заметках"
    },
    "obsidian.backlinks": {
      "title": "Обратные ссылки заметки"
    },
    "obsidian.write_note": {
      "title": "Записать заметку"
    },
    "obsidian.append_note": {
      "title": "Дополнить заметку"
    },
    "obsidian.daily_note": {
      "title": "Ежедневная заметка"
    },
    "obsidian.delete_note": {
      "title": "Удалить заметку"
    },
    "obsidian.list_containers": {
      "title": "Список контейнеров контекста"
    },
    "obsidian.sync_containers": {
      "title": "Синхронизировать контейнеры контекста"
    },
    "openclaw.config": {
      "title": "Конфигурация OpenClaw"
    },
    "openclaw.test_connection": {
      "title": "Проверить подключение OpenClaw"
    },
    "security-audit.last_report": {
      "title": "Последний отчёт аудита"
    },
    "security-audit.ssh_posture": {
      "title": "SSH-позиция сервера"
    },
    "server-alerts.send": {
      "title": "Отправить уведомление на сервер"
    },
    "server-alerts.list_rules": {
      "title": "Список правил оповещений"
    },
    "server-alerts.create_rule": {
      "title": "Создать правило оповещения"
    },
    "users.list": {
      "title": "Список пользователей панели"
    },
    "users.create": {
      "title": "Создать пользователя"
    },
    "users.update": {
      "title": "Редактировать пользователя"
    },
    "users.delete": {
      "title": "Удалить пользователя"
    },
    "users.groups_list": {
      "title": "Список групп с правами"
    },
    "users.group_create": {
      "title": "Создать группу"
    },
    "users.group_update": {
      "title": "Редактировать группу"
    },
    "users.group_delete": {
      "title": "Удалить группу"
    },
    "webhooks.list": {
      "title": "Список настроенных webhooks"
    }
  },
  "dataPanelCatalog": {
    "admin.health": {
      "title": "Состояние сервера",
      "description": "Быстрая проверка доступности и нагрузки подключённой цели — полезна как контекст системного промпта перед ответом на операционные вопросы."
    },
    "dashboard.snapshot": {
      "title": "Компактный обзор",
      "description": "Компактное пре-промпт-резюме подключённой цели: нагрузка, RAM%, использование корневого диска% и количество работающих ключевых служб."
    },
    "monitor.snapshot": {
      "title": "Снимок системы",
      "description": "Текущая сводка ресурсов подключённой цели: использование CPU%, средняя нагрузка, используемая/общая память, использование корневой файловой системы."
    },
    "obsidian.vaults_summary": {
      "title": "Сводка хранилищ",
      "description": "Зарегистрированные хранилища Obsidian на подключённом сервере с их путём, статусом существования и количеством markdown-заметок."
    }
  },
  "structurePanel": {
    "editorLoading": "Загрузка редактора...",
    "loading": "Загрузка...",
    "createdNotice": "Создано {count} элем.",
    "nothingToCreate": "Нечего создавать (уже существует).",
    "savedNotice": "Сохранено {rel}.",
    "noActiveProviders": "Нет активного AI-провайдера. Включите его в разделе Провайдеры.",
    "improvedNotice": "Улучшено с AI. Проверьте diff и нажмите Сохранить, если устраивает.",
    "noAiChanges": "AI не предложил изменений.",
    "structureLoading": "Анализ структуры...",
    "retry": "Повторить",
    "copyAllContent": "Копировать всё содержимое",
    "copied": "Скопировано",
    "copy": "Копировать",
    "downloadFile": "Скачать файл",
    "download": "Скачать",
    "diff": "Diff",
    "originalDiffTitle": "Просмотр различий с исходным содержимым",
    "back": "Назад",
    "improveContentTitle": "Улучшить содержимое с AI, используя контекст проекта",
    "improving": "Улучшение...",
    "improveWithAi": "Улучшить с AI",
    "cancel": "Отмена",
    "saving": "Сохранение...",
    "save": "Сохранить",
    "chooseProvider": "Выберите AI-провайдера",
    "close": "Закрыть",
    "noModel": "(нет модели)",
    "directory": "Каталог",
    "structureCount": "Структура · {count} к созданию",
    "markMissing": "Отметить отсутствующие",
    "creating": "Создание...",
    "create": "Создать ({count})",
    "expand": "Развернуть",
    "collapse": "Свернуть",
    "edit": "Редактировать",
    "exists": "Существует",
    "createLabel": "создать",
    "fallbackFilename": "file.txt",
    "structureHints": {
      "claude": "Инструкции, конфигурация, правила, команды, навыки, агенты и хуки, которые Claude Code читает из каталога проекта.",
      "codex": "Codex CLI читает AGENTS.md как руководство проекта и .codex/ для конфигурации и промптов.",
      "gemini": "Gemini CLI читает GEMINI.md как контекст проекта и .gemini/ для конфигурации и команд."
    },
    "structureNodes": {
      "CLAUDE.md": "Инструкции проекта (контекст, команды, соглашения)",
      "CLAUDE.local.md": "Локальные инструкции (не коммитить; личные предпочтения)",
      ".mcp.json": "MCP-серверы проекта",
      ".claude/settings.json": "Конфигурация проекта (версионируется)",
      ".claude/settings.local.json": "Локальная конфигурация (не версионируется)",
      ".claude/rules": "Переиспользуемые правила",
      ".claude/rules/code-style.md": "Правило: стиль кода",
      ".claude/rules/testing.md": "Правило: тестирование",
      ".claude/rules/api-conventions.md": "Правило: соглашения API",
      ".claude/commands": "Пользовательские slash-команды",
      ".claude/commands/review.md": "Команда /review",
      ".claude/commands/fix-issue.md": "Команда /fix-issue",
      ".claude/skills": "Навыки проекта",
      ".claude/skills/deploy": "Навык: deploy",
      ".claude/skills/deploy/SKILL.md": "Определение навыка deploy",
      ".claude/skills/deploy/deploy-config.md": "Конфигурация навыка deploy",
      ".claude/agents": "Специализированные субагенты",
      ".claude/agents/code-reviewer.md": "Агент: ревьюер кода",
      ".claude/agents/security-auditor.md": "Агент: аудитор безопасности",
      ".claude/hooks": "Хуки (скрипты жизненного цикла)",
      ".claude/hooks/validate-bash.sh": "Хук: проверка команд bash",
      "AGENTS.md": "Руководство проекта для Codex/агентов",
      ".codex": "Конфигурация Codex",
      ".codex/config.toml": "Конфигурация проекта Codex",
      ".codex/prompts": "Переиспользуемые промпты/шаблоны",
      ".codex/prompts/review.md": "Промпт: ревью кода",
      "GEMINI.md": "Контекст проекта для Gemini",
      ".gemini": "Конфигурация Gemini",
      ".gemini/settings.json": "Конфигурация проекта Gemini",
      ".gemini/commands": "Пользовательские команды",
      ".gemini/commands/review.toml": "Команда: review",
      "modules/*": "Корень модуля маркетплейса",
      "modules/*/module.manifest.json": "Черновик манифеста (поля AUTO задаются платформой)",
      "modules/*/backend/index.js": "Бэкенд модуля — каркас SDK defineModule()",
      "modules/*/frontend": "Фронтенд модуля (Astro, опционально)",
      "modules/*/README.md": "README модуля",
      ".claude/rules/marketplace.md": "Правило: архитектура маркетплейса (манифест, SDK, возможности)",
      "MARKETPLACE.md": "Правила архитектуры маркетплейса (манифест, SDK, возможности)"
    }
  },
  "mcpConfigPanel": {
    "noInstallResponse": "Нет ответа об установке",
    "summaryTitle": "Открыть возможности панели для CLI (MCP)",
    "optional": "необязательно",
    "description": "Подключите CLI {providerId} к инструментам панели. Панель записывает конфигурацию напрямую на целевой сервер — копировать ничего не нужно.",
    "configuredTitle": "Настроено на целевом сервере",
    "tokenValidUntil": "Токен действителен до {date}.",
    "restartCli": "Перезапустите CLI в терминале, чтобы загрузить новый MCP-сервер.",
    "configuring": "Настройка...",
    "configureAutomatically": "Настроить автоматически",
    "regenerate": "Regenerate токен и перенастроить",
    "manualTitle": "Ручная настройка (расширенная)",
    "generating": "Генерация...",
    "generateManualSnippet": "Создать ручной сниппет",
    "fileLabel": "Файл",
    "snippetLabel": "Фрагмент ({format})",
    "copy": "Копировать",
    "mcpUrlLabel": "MCP URL"
  },
  "conversationMedia": {
    "download": "Скачать",
    "close": "Закрыть",
    "previous": "Предыдущий",
    "next": "Следующий",
    "all": "Все",
    "images": "Изображения",
    "documents": "Документы",
    "attachmentsTitle": "Вложения разговора",
    "emptyConversation": "В этом разговоре нет вложений.",
    "imagesSection": "Изображения",
    "documentsSection": "Документы",
    "clickToExpand": "нажмите для раскрытия",
    "emptyImages": "Нет изображений.",
    "emptyDocuments": "Нет документов.",
    "mediaTitle": "Медиа",
    "attachToChat": "Прикрепить к чату",
    "uploadToChat": "Загрузить файлы в чат",
    "attachFailed": "Не удалось прикрепить файл к чату."
  },
  "teamBoard": {
    "showMoreTasks": "Показать ещё {count} задач",
    "showFewerTasks": "Показать меньше задач",
    "title": "Команда за работой",
    "progressOf": "{done} из {total} задач выполнено",
    "statusPending": "Ожидает",
    "statusRunning": "Выполняется",
    "statusDone": "Готово",
    "statusFailed": "Ошибка",
    "statusCanceled": "Отменена",
    "pendingPermission": "Ожидает вашего одобрения",
    "openChat": "Открыть чат",
    "cancel": "Отменить задачу",
    "cancelConfirm": "Отменить эту задачу? Агент прекратит работу над ней.",
    "assignedTo": "Назначена: {agent}",
    "autoTurn": "Автоматическое уведомление команды",
    "dashboardTitle": "Команды за работой",
    "tokensSummary": "Токены: {total} (лидер {leader} · команда {workers})",
    "lessThan1s": "<1 с",
    "insertions": "+{count}",
    "deletions": "-{count}",
    "viewDiff": "Просмотр diff",
    "close": "Закрыть",
    "loading": "Загрузка…",
    "statusQueued": "В очереди",
    "verifyRunning": "Проверка…",
    "addTaskSubmit": "Назначить",
    "verifyPassed": "Проверено",
    "verifyFailed": "Проверка не пройдена ({attempts})",
    "filesChanged": "{count} файл(ов)",
    "diffTitle": "Изменения задачи",
    "diffUnavailable": "Для этой задачи нет доступных изменений (нет рабочего дерева или изменений).",
    "diffTruncated": "Список изменений сокращён: задача изменила больше данных, чем показано.",
    "branchIntegrated": "Ветка интегрирована",
    "cancelAll": "Отменить всё",
    "cancelAllConfirm": "Отменить ВСЕ текущие задачи? Активный план будет отмечен как неудачный.",
    "addTask": "Добавить задачу",
    "addTaskTitle": "Назначить задачу подчинённому агенту",
    "addTaskWorker": "Подчинённый агент",
    "addTaskWorkerPlaceholder": "— Выберите агента —",
    "addTaskNoWorkers": "У этого руководителя нет прямых подчинённых агентов.",
    "addTaskInstruction": "Инструкция",
    "addTaskInstructionHint": "Агент не видит эту беседу; укажите ВЕСЬ необходимый контекст.",
    "addTaskTitleField": "Заголовок (необязательно)",
    "addTaskProject": "Проект (необязательно)",
    "addTaskProjectNone": "— Без проекта —",
    "addTaskSubmitting": "Назначение…",
    "feedbackUp": "Хороший результат",
    "feedbackDown": "Плохой результат",
    "orgChart": "Организационная схема",
    "tokensChipTitle": "Токены, использованные этой задачей"
  },
  "agentInfo": {
    "roleLabel": "Роль",
    "roleTooltip": "Роль агента: {role}",
    "providerLabel": "Провайдер",
    "providerModelTooltip": "Провайдер {provider} · Модель {model}",
    "projectLabel": "Проект",
    "projectTooltip": "Проект: {project}"
  },
  "mermaidDiagram": {
    "zoomOut": "Уменьшить",
    "zoomIn": "Увеличить",
    "zoomReset": "Сбросить масштаб"
  },
  "assistantErrorBoundary": {
    "errorMessage": "При загрузке помощника произошла ошибка.",
    "retry": "Повторить"
  }
} as const;

export default assistantPart3;
