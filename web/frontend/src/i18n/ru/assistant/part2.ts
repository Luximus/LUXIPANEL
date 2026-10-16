const assistantPart2 = {
  "cliUsageBars": {
    "sourceReal": "остаток квоты аккаунта",
    "sourceEstimated": "расчётный остаток токенов",
    "sourceTokens": "остаток токенов",
    "cliUsage": "Доступно CLI",
    "session5h": "Сессия (5ч)",
    "week": "Неделя",
    "sessionHours": "Сессия ({hours}ч)",
    "resetSameDay": "сброс в {time}",
    "resetOtherDay": "сброс в {day}, {time}",
    "unavailable": "Не удалось загрузить квоту {provider}",
    "retry": "Повторить"
  },
  "notifySettings": {
    "title": "Уведомления ассистента",
    "description": "Уведомлять меня на моих устройствах (веб, приложение и компьютер), когда чат завершится, а я на него не смотрю.",
    "saveError": "Не удалось сохранить."
  },
  "voiceSettings": {
    "title": "Голос (аудио)",
    "description": "Говорите с ассистентом и слушайте ответы через OpenAI.",
    "missingCapabilities": "Чтобы включить аудио, настройте ключ API OpenAI в провайдере Codex.",
    "inputLabel": "Ввод (STT)",
    "outputLabel": "Вывод (TTS)",
    "notAvailable": "недоступно",
    "voiceLabel": "Голос",
    "autoSpeak": "Автоматически озвучивать ответы по завершении",
    "audioProvider": "Аудио-провайдер",
    "providerApi": "API (OpenAI/Gemini)",
    "providerPiper": "Piper (локально)",
    "providerMinimax": "MiniMax",
    "providerApiHint": "Использует уже настроенный API-ключ.",
    "piperReady": "Piper установлен",
    "piperMissing": "Piper не установлен",
    "minimaxReady": "MiniMax готов",
    "minimaxMissing": "MiniMax недоступен",
    "minimaxAuthMissing": "Нет ключа MiniMax",
    "minimaxVoiceHint": "Голос MiniMax."
  },
  "agentsTab": {
    "teams": {
      "newTeamBtn": "Новая команда",
      "newTeamTitle": "Создать команду",
      "editTeamTitle": "Изменить команду",
      "nameLabel": "Название",
      "namePlaceholder": "Напр. Backend, Frontend, Design…",
      "descriptionLabel": "Описание (необязательно)",
      "colorLabel": "Цвет",
      "createBtn": "Создать команду",
      "saveBtn": "Сохранить",
      "cancelBtn": "Отмена",
      "addAgentsBtn": "Добавить агентов",
      "addAgentsTitle": "Добавить агентов в команду",
      "addAgentsEmpty": "Нет агентов для добавления.",
      "addAgentsConfirm": "Добавить",
      "alreadyInTeam": "в другой команде",
      "removeFromTeamBtn": "Убрать из команды",
      "removeFromTeamConfirm": "Убрать этого агента из команды? Агент не удаляется.",
      "deleteTeamBtn": "Удалить команду",
      "deleteTeamConfirm": "Удалить эту команду?",
      "deleteTeamKeepsAgentsNote": "Агенты НЕ удаляются: они лишь исключаются из команды.",
      "teamSelectorLabel": "Команда",
      "groupRequired": "Выберите или создайте группу",
      "teamSelectorPlaceholder": "— Выберите группу —",
      "noTeamOption": "Без команды",
      "emptyTeamHint": "Пустая команда — добавьте агентов кнопкой +.",
      "memberCount": "{count} участник(ов)"
    },
    "cancel": "Отмена",
    "saving": "Сохранение…",
    "saveChanges": "Сохранить изменения",
    "noDescription": "Без описания",
    "allTools": "все инструменты",
    "toolsCount": "{count} инструментов",
    "noActiveModules": "Нет активных модулей с инструментами.",
    "removeAll": "Убрать все",
    "selectAll": "Выбрать все",
    "sensitiveTool": "чувствительное действие",
    "confirmDeleteAgent": "Удалить агента \"{name}\"?",
    "confirmDeleteRole": "Удалить роль \"{name}\"? Она будет удалена у всех агентов, которые её используют.",
    "duplicateName": "{name} (копия)",
    "editBtn": "Редактировать",
    "deleteTitle": "Удалить",
    "errorPrefix": "Ошибка: {message}",
    "backToAgents": "Агенты",
    "createdBy": "Создано: {ownerName}",
    "diagram": {
      "empty": "Нет агентов — создайте одного, чтобы увидеть его здесь",
      "connection": "соединение"
    },
    "archetypes": {
      "devops": "DevOps / SRE",
      "security": "Аудитор безопасности",
      "dba": "Администратор БД",
      "support": "Техническая поддержка",
      "nginx": "Веб-администратор / Nginx",
      "backups": "Специалист по резервным копиям",
      "logs": "Аналитик логов",
      "automation": "Автоматизация / Cron"
    },
    "editor": {
      "titleNew": "Новый агент",
      "titleEdit": "Редактировать агента",
      "headerTitleNew": "Новый агент",
      "headerDescNew": "Настройте нового ИИ-агента",
      "headerTitleEdit": "Редактирование агента",
      "headerDescEdit": "Измените конфигурацию агента",
      "backToList": "Назад к агентам",
      "tabGeneral": "Общее",
      "tabModel": "Модель",
      "tabHierarchy": "Иерархия",
      "tabTools": "Инструменты",
      "tabResources": "Ресурсы",
      "tabAccess": "Доступы",
      "aiHelpTitle": "Помощь AI",
      "aiHelpDesc": "Выберите профиль, и AI профессионально составит имя, описание, промпт и инструменты.",
      "aiHelpSelect": "Выберите профиль…",
      "aiHelpFromDesc": "На основе моего описания",
      "aiHelpFromDescTitle": "Улучшить на основе текущего описания",
      "aiHelpGenerating": "Генерация агента с помощью AI…",
      "fieldName": "Имя",
      "namePlaceholder": "Пр. Аудитор безопасности",
      "fieldDescription": "Описание",
      "descPlaceholder": "Назначение этого агента",
      "fieldSystemPrompt": "Системный промпт",
      "systemPromptPlaceholder": "Инструкции, личность и цели агента…",
      "fieldAvatar": "Аватар",
      "avatarRandomize": "Случайно",
      "avatarAuto": "Авто",
      "avatarAttrs": {
        "top": "Волосы / головной убор",
        "hairColor": "Цвет волос",
        "eyes": "Глаза",
        "eyebrows": "Брови",
        "mouth": "Рот",
        "skinColor": "Цвет кожи",
        "clothing": "Одежда",
        "clothesColor": "Цвет одежды",
        "accessories": "Аксессуар",
        "facialHair": "Борода",
        "facialHairColor": "Цвет бороды"
      },
      "fieldProvider": "Провайдер",
      "fieldModel": "Модель",
      "modelPlaceholder": "(по умолчанию провайдера)",
      "realtimeLabel": "Коммуникация в реальном времени (сеанс с низкой задержкой)",
      "realtimeDesc": "Двунаправленный стриминговый сеанс аудио/текста (в зависимости от провайдера: OpenAI Realtime или Gemini Live).",
      "realtimeUnavailable": "Провайдер \"{providerId}\" не поддерживает сеанс в реальном времени. Доступно только с codex (OpenAI) или gemini.",
      "multiAgentLabel": "Режим мультиагента: запускает несколько копий этого агента параллельно",
      "multiAgentDescPre": "Агент ",
      "multiAgentDescBold": "умножается на X",
      "multiAgentDescPost": ": задача делится на X частей, каждая копия (с одинаковым промптом, инструментами и провайдером) решает свою часть параллельно; затем синтезируется один ответ.",
      "multiAgentCopies": "Количество копий (X)",
      "multiAgentCopiesHint": "копий агента (2–8)",
      "multiAgentProvidersPre": "Опционально — распределить копии между несколькими провайдерами (основной ",
      "multiAgentProvidersPost": " всегда участвует; отметьте другие для распределения):",
      "multiAgentApiHint": "Используются только провайдеры в режиме API с API key. Мультиагент требует режима API.",
      "roleHeading": "Роль и иерархия",
      "roleAssigned": "Назначенная роль",
      "roleNone": "Без роли",
      "roleHint": "Роль предоставляет базовый промпт и инструменты по умолчанию; агент их уточняет. Управляйте ролями из списка агентов.",
      "parentAgent": "Вышестоящий агент (подчинение)",
      "parentNone": "Нет (верхний уровень)",
      "parentHintPre": "Вышестоящий агент сможет ",
      "parentHintBold": "делегировать ему",
      "parentHintPost": " задачи во время выполнения и использовать его ответ.",
      "connectionsLabel": "Связи с другими агентами",
      "connectionsEmpty": "Других агентов нет.",
      "connectionsHint": "Двунаправленный канал: любой из двух может запрашивать или передавать информацию другому во время выполнения (инструмент делегирования).",
      "supervisorLabel": "Супервизор: может создавать чаты для своих подчинённых",
      "supervisorDesc": "Открывает реальные чаты во вкладке «Чат» и запускает работу подчинённых (каждый чат остаётся как журнал этого агента). Также предоставляется через роль.",
      "allowAllTools": "Разрешить все доступные инструменты",
      "toolsDesc": "Выберите подмножество инструментов, которые этот агент может использовать. Список пересекается с тем, что разрешает каждый модуль, поэтому права никогда не расширяются.",
      "associatedServers": "Связанные серверы",
      "serversEmpty": "Нет зарегистрированных серверов.",
      "attachedProjects": "Прикреплённые проекты",
      "attachedProjectsDesc": "Выберите один или несколько проектов из дерева. Отметка родительского проекта выбирает все его вложенные папки; агент использует рабочие пути выбранных проектов.",
      "noParentProjects": "Нет проектов.",
      "graphIndexesTitle": "Индексы графа кода",
      "graphIndexesDesc": "Агент будет использовать эти индексы для изучения кода через граф (символы, вызовы и архитектура) вместо чтения целых файлов — это снижает расход токенов.",
      "graphIndexesEmpty": "Нет доступных индексов графа. Проиндексируйте проект во вкладке «Проекты».",
      "credentialTitle": "Учётные данные доступа",
      "saveObsidian": "Сохранять сводки в vault Obsidian прикреплённого проекта",
      "agentSkills": "Навыки агента",
      "createAgent": "Создать агента",
      "snippetsSection": "Snippets терминала",
      "snippetsCategoryLabel": "Категория snippets",
      "snippetsCategoryNone": "(нет)",
      "snippetsTagsLabel": "Теги категории",
      "snippetsHelp": "Предварительно фильтрует snippets терминала, доступные этому агенту: выберите категорию и, при желании, теги этой категории. Без категории = без фильтра.",
      "snippetsNoAccess": "Не удалось загрузить snippets терминала (требуется доступ к терминалу).",
      "snippetsNoTags": "У этой категории нет тегов."
    },
    "roleEditor": {
      "titleNew": "Новая роль",
      "titleEdit": "Редактировать роль",
      "fieldName": "Имя роли",
      "namePlaceholder": "Пр. Координатор, Аудитор, Специалист БД",
      "fieldDesc": "Описание",
      "descPlaceholder": "Что представляет эта роль",
      "fieldBasePrompt": "Базовый промпт роли",
      "basePromptPlaceholder": "Политики, обязанности и тон, общие для всех агентов с этой ролью…",
      "basePromptHint": "Вставляется как основа, перед собственным промптом агента.",
      "noToolLimit": "Без ограничения инструментов от роли",
      "toolsDesc": "Инструменты роли ограничивают то, что могут использовать её агенты (пересечение, никогда не расширяет).",
      "supervisorLabel": "Роль супервизора: агенты с этой ролью могут создавать чаты для своих подчинённых",
      "supervisorDesc": "Предоставляет разрешение действовать как супервизор (инструмент для открытия чатов и назначения работы) каждому агенту с этой ролью.",
      "createRole": "Создать роль"
    },
    "treeView": {
      "title": "Иерархия агентов",
      "reloadTitle": "Перезагрузить агентов и перегенерировать дерево",
      "regenerating": "Перегенерация…",
      "regenerate": "Перегенерировать",
      "description": "Диаграмма дерева подчинения (сплошная линия = вышестоящий → подчинённый) и связи между равными (пунктирная линия). Назначьте «Вышестоящего агента» в редакторе каждого агента, чтобы построить дерево."
    },
    "rolesList": {
      "newRole": "Новая роль",
      "description": "Многоразовые роли (профиль с базовым промптом и инструментами), которые назначаются одному или нескольким агентам.",
      "emptyTitle": "Ролей пока нет",
      "emptyDesc": "Создайте роль для стандартизации поведения нескольких агентов.",
      "agentsCount": "{count} агент(ов)"
    },
    "list": {
      "description": "Пользовательские AI-агенты: собственный промпт, инструменты и провайдер/модель. Используйте их в чате или планируйте в Cron.",
      "treeBtn": "Дерево",
      "treeBtnTitle": "Просмотреть дерево иерархии агентов",
      "rolesBtn": "Роли",
      "rolesBtnTitle": "Создавать и управлять ролями агентов",
      "newAgent": "Новый агент",
      "loading": "Загрузка агентов…",
      "emptyTitle": "Агентов пока нет",
      "emptyDesc": "Создайте агента для чата с собственным промптом и набором инструментов.",
      "multiAgentTitle": "Мультиагент: {count} копий",
      "roleAssignedTitle": "Назначенная роль",
      "subordinateTitle": "Подчинён",
      "connectionsTitle": "Связи с другими агентами",
      "supervisorTitle": "Супервизор: может создавать чаты для подчинённых",
      "supervisorBadge": "супервизор",
      "realtimeTitle": "Коммуникация в реальном времени",
      "realtimeBadge": "реальное время",
      "startChat": "Начать чат",
      "duplicateTitle": "Дублировать",
      "noRoleGroupTitle": "Без рабочей группы",
      "groupAria": "Рабочая группа: {name}",
      "groupCount": "{count} агентов",
      "noRoleGroupDesc": "Агенты без назначенной роли. Назначьте её из редактора."
    },
    "resync": {
      "applying": "Создание…",
      "close": "Закрыть",
      "btn": "Синхронизировать с шаблоном",
      "btnTitle": "Сравнить эту команду с шаблоном и создать недостающих агентов",
      "modalTitle": "Синхронизировать «{name}» с шаблоном",
      "loading": "Сравнение с шаблоном…",
      "markersMissing": "Эта команда потеряла маркеры происхождения из шаблона, поэтому автоматическое сравнение невозможно. Недостающих агентов можно создать вручную.",
      "missingHeading": "Отсутствуют",
      "presentHeading": "Есть",
      "extraHeading": "Добавлены вручную",
      "extraNote": "Они не будут изменены.",
      "nothingMissing": "Команда укомплектована: все агенты из шаблона присутствуют.",
      "confirm": "Создать выбранных"
    }
  },
  "accessTab": {
    "all": "Все",
    "permissionsTitle": "Доступы и разрешения",
    "permissionsDescription": "Сегодня видимость ассистента определяется разрешением модуля assistant в вашем профиле. Детализация по ролям (assistant.use / assistant.configure / assistant.module.<id>) запланирована на следующую итерацию.",
    "recentInvocations": "Последние вызовы инструментов",
    "refreshAriaLabel": "Обновить доступы",
    "loading": "Загрузка...",
    "emptyRecent": "Нет недавней активности.",
    "emptyProvider": "Нет активности для этого провайдера.",
    "byUser": "пользователем",
    "crossServerTitle": "Доступ к связанному серверу",
    "cmdPrefix": "$ ",
    "passwordLabel": "пароль: ",
    "passphraseLabel": "парольная фраза: ",
    "privateKeyLabel": "закрытый ключ",
    "autoApproveRevoke": "Отозвать",
    "autoApproveTitle": "Автоматическое одобрение",
    "autoApproveDescription": "Инструменты, которые больше не требуют подтверждения (одобрены действием «Одобрить и больше не спрашивать»). Изменения вступят в силу при следующем запуске.",
    "autoApproveEmpty": "Нет инструментов с автоматическим одобрением. Они появятся здесь, если при одобрении действия агента выбрать «Одобрить и больше не спрашивать».",
    "autoApproveModeAuto": "автоматический режим: этот список не применяется"
  },
  "directoryPicker": {
    "title": "Выбрать папку",
    "goUp": "Вверх",
    "loading": "Загрузка…",
    "emptyDirs": "(нет подпапок)",
    "cancel": "Отмена",
    "select": "Использовать эту папку",
    "readError": "Не удалось прочитать каталог"
  },
  "skillsSettings": {
    "title": "Навыки и методы ассистента",
    "helper": "Включайте или отключайте библиотеки, навыки и методы, уточняющие поведение ассистента.",
    "tokenNote": "Инструкции каждого навыка передаются в кешированном промпте (~0.1× в последующих ответах). Ponytail сокращает код и токены вывода; в UI/UX Pro Max используйте уровень «Кратко», чтобы тратить меньше.",
    "search": "Поиск навыка…",
    "allCategories": "Все категории",
    "loading": "Загрузка навыков...",
    "empty": "Нет доступных навыков.",
    "noMatch": "Ни один навык не соответствует фильтру.",
    "sourcePrefix": "Источник:",
    "errorGeneric": "Не удалось обновить навык. Попробуйте снова.",
    "activeShown": "{count} активных · {shown} показано."
  },
  "skillsPicker": {
    "searchPlaceholder": "Поиск навыка…",
    "resetTitle": "Сбросить настройку (использовать глобальные навыки)",
    "reset": "Сбросить ({count})",
    "loading": "Загрузка навыков…",
    "empty": "Нет навыков.",
    "globalNote": "Применяются ТОЛЬКО в ваших чатах, поверх глобальных навыков провайдера."
  },
  "skillCategories": {
    "methods": "Методы ассистента",
    "code-quality": "Качество кода",
    "web-quality": "Качество веб-сайта (Lighthouse / CWV)",
    "ui-ux": "UI / UX / дизайн",
    "web-fullstack": "Веб / full-stack разработка с AI",
    "mobile": "Мобильные приложения",
    "code-agents": "Агенты кода",
    "reusable-skills": "Переиспользуемые AI-навыки",
    "security": "Безопасность AI / веб / приложений",
    "token-savings": "Экономия токенов / затраты AI",
    "ai-prod": "AI-агенты в продакшне",
    "devops": "DevOps / деплой",
    "testing": "Тестирование / качество кода",
    "data-rag": "Базы данных / RAG / поиск",
    "automation": "Автоматизация / рабочие процессы",
    "other": "Прочее"
  },
  "skillCatalog": {
    "ask-protocol": {
      "name": "Спрашивать перед решением",
      "description": "Позволяет ассистенту остановиться и задать ключевой вопрос вместо предположения (инструмент lxp_ask + протокол вопросов)."
    },
    "project-context-vault": {
      "name": "Контекст проекта (Obsidian)",
      "description": "Подгружает заметки контекста проекта (Contexto.md / Errores.md) и позволяет искать дополнительные через obsidian.search_notes."
    },
    "ponytail": {
      "name": "Ponytail (минималистичный код)",
      "description": "Минималистичный режим разработки: пишите минимально необходимый код (лестница решений + guardrails)."
    },
    "ui-ux-pro-max": {
      "name": "UI/UX Pro Max (качество интерфейса)",
      "description": "Профессиональные стандарты UI/UX (доступность, сенсорный ввод, типографика, состояния) добавляются в промпт; краткий или полный уровень."
    },
    "openai-agents-sdk": {
      "name": "OpenAI Agents SDK",
      "description": "Агенты OpenAI с tools, handoffs, guardrails, sessions и tracing."
    },
    "openai-agents-python": {
      "name": "OpenAI Agents Python SDK",
      "description": "Python SDK для агентов: Agent, Runner, @function_tool, handoffs и tracing."
    },
    "openai-agents-js": {
      "name": "OpenAI Agents JS SDK",
      "description": "TypeScript/JS SDK для агентов OpenAI: Agent, run, tools (Zod), handoffs."
    },
    "mcp-docs": {
      "name": "Model Context Protocol",
      "description": "Открытый стандарт («USB-C для AI») для подключения LLM к tools, resources и prompts."
    },
    "mcp-github": {
      "name": "MCP (GitHub)",
      "description": "Организация MCP на GitHub: официальные SDK (10 языков), эталонные серверы и инспектор."
    },
    "anthropic-mcp-intro": {
      "name": "Anthropic MCP Intro",
      "description": "Анонс Anthropic: MCP как открытый стандарт, решающий N×M-интеграции."
    },
    "n8n": {
      "name": "n8n",
      "description": "Fair-code автоматизация рабочих процессов с возможностью self-hosting."
    },
    "make": {
      "name": "Make",
      "description": "Визуальная no-code автоматизация по сценариям (ранее Integromat)."
    },
    "zapier": {
      "name": "Zapier",
      "description": "SaaS-автоматизация через триггеры и действия (Zaps)."
    },
    "temporal": {
      "name": "Temporal",
      "description": "Оркестрация долговременных отказоустойчивых рабочих процессов."
    },
    "bullmq": {
      "name": "BullMQ",
      "description": "Очереди задач на базе Redis для Node.js."
    },
    "langgraph": {
      "name": "LangGraph",
      "description": "Оркестрация LLM-агентов в виде графов с состоянием."
    },
    "codex-cli": {
      "name": "OpenAI Codex CLI",
      "description": "Направляет агента использовать Codex CLI от OpenAI (агент кода в терминале)."
    },
    "codex-cli-features": {
      "name": "Codex CLI Features",
      "description": "Подробно описывает агенту возможности Codex CLI (sandbox, подтверждения, MCP, config)."
    },
    "codex-cloud": {
      "name": "Codex Cloud",
      "description": "Направляет агента делегировать задачи в Codex Cloud (удалённые среды, параллельное выполнение, PRs)."
    },
    "claude-code-skills": {
      "name": "Claude Code Skills",
      "description": "Направляет агента создавать и использовать Claude Code Skills (папка с SKILL.md, стандарт Agent Skills)."
    },
    "copilot-cloud-agent": {
      "name": "GitHub Copilot Cloud Agent",
      "description": "Направляет агента делегировать задачи GitHub Copilot coding agent, который работает в облаке и открывает PRs."
    },
    "cursor": {
      "name": "Cursor",
      "description": "Направляет агента работать в редакторе Cursor (Agent, контекст репозитория, правила)."
    },
    "agents-md": {
      "name": "AGENTS.md",
      "description": "Направляет агента писать и соблюдать AGENTS.md — стандартный файл инструкций для агентов кода."
    },
    "open-design-contribute": {
      "name": "Open Design — вклад (no-code)",
      "description": "Пошаговый no-code процесс для участия в Open Design (nexu-io): добавьте Skill или Design System, переведите документацию, исправьте текст или сообщите об ошибке — PR/issue откроется автоматически."
    },
    "supabase": {
      "name": "Supabase",
      "description": "Управляемый Postgres-бэкенд с auth, storage и realtime."
    },
    "postgresql": {
      "name": "PostgreSQL",
      "description": "Надёжная реляционная база данных с богатыми типами данных."
    },
    "pgvector": {
      "name": "pgvector",
      "description": "Векторный поиск по сходству внутри Postgres."
    },
    "pinecone": {
      "name": "Pinecone",
      "description": "Управляемая векторная база данных для RAG в промышленном масштабе."
    },
    "qdrant": {
      "name": "Qdrant",
      "description": "Open-source векторный движок с фильтрацией по payload."
    },
    "weaviate": {
      "name": "Weaviate",
      "description": "Векторная база данных со схемой и модулями векторизации."
    },
    "github-actions": {
      "name": "GitHub Actions",
      "description": "CI/CD на GitHub с YAML-воркфлоу (.github/workflows), запускаемыми событиями."
    },
    "vercel": {
      "name": "Vercel",
      "description": "Деплой фронтендов и serverless-функций с превью по каждому коммиту/PR."
    },
    "docker": {
      "name": "Docker",
      "description": "Упаковывает приложения в эфемерные контейнеры с лёгкими и воспроизводимыми образами."
    },
    "nginx": {
      "name": "Nginx",
      "description": "Высокопроизводительный веб-сервер и обратный прокси."
    },
    "pm2": {
      "name": "PM2",
      "description": "Менеджер процессов Node с кластером, перезапуском и логами."
    },
    "redis": {
      "name": "Redis",
      "description": "In-memory хранилище для кэша, очередей и структур данных."
    },
    "expo": {
      "name": "Expo",
      "description": "Направляет агента разрабатывать React Native-приложения с Expo (expo-router, модули, config plugins)."
    },
    "eas-build": {
      "name": "EAS Build",
      "description": "Направляет агента собирать iOS/Android-бинарники в облаке с EAS Build и профилями eas.json."
    },
    "eas-services": {
      "name": "EAS Services",
      "description": "Помогает агенту использовать экосистему EAS (Submit, Update/OTA, Workflows) end-to-end."
    },
    "react-native": {
      "name": "React Native",
      "description": "Направляет агента создавать нативные UI с React Native (core-компоненты, стили, платформа)."
    },
    "firebase-auth": {
      "name": "Firebase Auth",
      "description": "Направляет агента реализовать аутентификацию с Firebase Auth (providers, tokens, сессия)."
    },
    "claude-agent-skills": {
      "name": "Claude Agent Skills",
      "description": "Упаковывает переиспользуемые возможности как Agent Skills (SKILL.md), загружаемые по требованию."
    },
    "claude-skills-github": {
      "name": "Claude Skills (GitHub)",
      "description": "Официальный репозиторий anthropics/skills: примеры, спецификация и шаблон как база и паттерн."
    },
    "codex-agents-md-guide": {
      "name": "Codex AGENTS.md Guide",
      "description": "Соглашение AGENTS.md от Codex для передачи инструкций проекта агентам кода."
    },
    "owasp-llm-top10": {
      "name": "OWASP Top 10 LLM",
      "description": "Топ-10 рисков в LLM-приложениях: prompt injection, небезопасный вывод, excessive agency."
    },
    "owasp-asvs": {
      "name": "OWASP ASVS",
      "description": "ASVS v5.0: стандарт проверяемых требований безопасности по уровням."
    },
    "codeql": {
      "name": "CodeQL",
      "description": "CodeQL: запросы к коду как к данным (data-flow/taint) для поиска уязвимостей."
    },
    "semgrep": {
      "name": "Semgrep",
      "description": "Semgrep: SAST по правилам в стиле кода + Supply Chain (SCA) и Secrets, высокий signal."
    },
    "snyk": {
      "name": "Snyk",
      "description": "Snyk: SCA, Code (SAST), Container, IaC и API/Web (DAST) с пошаговым устранением уязвимостей."
    },
    "owasp-zap": {
      "name": "OWASP ZAP",
      "description": "OWASP ZAP: ведущий open-source веб-сканер для DAST (passive/active scan)."
    },
    "skillspector": {
      "name": "SkillSpector (аудит AI Skills)",
      "description": "Выполняет аудит Skills AI-агентов (SKILL.md + scripts) на наличие уязвимостей и вредоносного умысла перед установкой (NVIDIA, Apache-2.0)."
    },
    "playwright": {
      "name": "Playwright",
      "description": "Кросс-браузерное E2E-тестирование с авто-ожиданием и трассировкой."
    },
    "cypress": {
      "name": "Cypress",
      "description": "Тестирование компонентов и E2E в браузере с повторными попытками."
    },
    "vitest": {
      "name": "Vitest",
      "description": "Быстрый тест-раннер, нативный для Vite/ESM."
    },
    "jest": {
      "name": "Jest",
      "description": "Фреймворк тестирования со встроенными моками и снимками."
    },
    "testing-library": {
      "name": "Testing Library",
      "description": "Запросы, ориентированные на пользователя, для тестирования доступного UI."
    },
    "storybook": {
      "name": "Storybook",
      "description": "Изолированная разработка и тестирование UI-компонентов."
    },
    "openai-prompt-caching": {
      "name": "OpenAI Prompt Caching",
      "description": "Автоматически снижает стоимость за счёт повторного использования кэшированного префикса промпта в OpenAI."
    },
    "openai-prompt-engineering": {
      "name": "OpenAI Prompt Engineering",
      "description": "Пишите точные промпты для меньшего числа итераций и меньшего количества токенов."
    },
    "gemini-context-caching": {
      "name": "Gemini Context Caching",
      "description": "Кэшируйте большой повторяющийся контекст в Gemini (явно или неявно) для снижения стоимости ввода."
    },
    "gemini-caching-api": {
      "name": "Gemini Caching API",
      "description": "API cachedContents Gemini: создание, повторное использование, обновление TTL и удаление кэшей."
    },
    "litellm-cost-tracking": {
      "name": "LiteLLM Cost Tracking",
      "description": "Измеряет и атрибутирует затраты по ключу/пользователю/команде через прокси LiteLLM."
    },
    "litellm": {
      "name": "LiteLLM",
      "description": "Единый шлюз к 100+ LLM (формат OpenAI) с кэшированием, fallbacks и маршрутизацией."
    },
    "figma-ai": {
      "name": "Figma AI",
      "description": "Figma AI: агент холста, генерация изображений и design-to-code."
    },
    "figma-make": {
      "name": "Figma Make",
      "description": "Figma Make: от промпта или фрейма к функциональному прототипу/приложению с реальным кодом."
    },
    "figma-ai-tools": {
      "name": "Figma AI Tools",
      "description": "AI-инструменты в Figma Design: First Draft, переименование слоёв, изображения, текст."
    },
    "framer": {
      "name": "Framer",
      "description": "Framer: no-code сайты с визуальным холстом, AI-агентами, CMS и публикацией."
    },
    "relume": {
      "name": "Relume",
      "description": "Relume: от брифа до sitemap, wireframes и style guide с AI + библиотекой."
    },
    "design-md-tokens": {
      "name": "DESIGN.md (система на токенах)",
      "description": "Генерируйте UI, верный бренду, с помощью структурированного DESIGN.md: токены цвета/типографики/отступов, спецификации компонентов и правила do/don't (voltagent, MIT)."
    },
    "nextjs-app-router": {
      "name": "Next.js App Router",
      "description": "Направляет агента создавать Next.js-приложения с App Router (Server Components, route handlers, layouts)."
    },
    "vercel-ai-sdk": {
      "name": "Vercel AI SDK",
      "description": "Помогает агенту интегрировать LLM с AI SDK (generateText, streamText, tools, structured output)."
    },
    "vercel-ai-gateway": {
      "name": "Vercel AI Gateway",
      "description": "Направляет агента маршрутизировать запросы к нескольким моделям через AI Gateway (один endpoint, fallback, наблюдаемость)."
    },
    "openai-sdk-cli": {
      "name": "OpenAI SDKs и CLI",
      "description": "Направляет агента использовать официальные SDK OpenAI (Python/Node) и API идиоматически."
    },
    "v0-vercel": {
      "name": "v0 by Vercel",
      "description": "Помогает агенту генерировать и улучшать React/Tailwind/shadcn UI с v0 по промптам."
    },
    "web-quality-audit": {
      "name": "Аудит качества веб-сайта",
      "description": "Комплексный аудит качества веб-сайта (производительность, доступность, SEO, безопасность) с классификацией по серьёзности."
    },
    "web-performance": {
      "name": "Производительность веб-сайта",
      "description": "Оптимизация скорости загрузки и эффективности во время выполнения (бюджет ресурсов + Lighthouse)."
    },
    "core-web-vitals": {
      "name": "Core Web Vitals (LCP/INP/CLS)",
      "description": "Улучшайте LCP, INP и CLS (пороговые значения на 75-м перцентиле)."
    },
    "web-accessibility": {
      "name": "Доступность веб-сайта (WCAG 2.2)",
      "description": "Аудит и улучшение доступности согласно WCAG 2.2 (целевой уровень AA)."
    },
    "web-seo": {
      "name": "SEO (технический + on-page)",
      "description": "Оптимизация видимости в поисковых системах: технический SEO, on-page и структурированные данные."
    },
    "web-best-practices": {
      "name": "Лучшие практики веб-разработки (безопасность)",
      "description": "Современные паттерны безопасности, совместимости и качества кода."
    }
  }
} as const;

export default assistantPart2;
