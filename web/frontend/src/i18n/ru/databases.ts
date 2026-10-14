const databases = {
  "pageTitle": "Базы данных",
  "header": {
    "heading": "Менеджер баз данных",
    "subheading": "Просматривайте и выполняйте запросы к базам данных сервера (MySQL/MariaDB, PostgreSQL)."
  },
  "databases": {
    "title": "Базы данных"
  },
  "tables": {
    "title": "Таблицы"
  },
  "tabs": {
    "rows": "Строки",
    "structure": "Структура",
    "console": "SQL-консоль"
  },
  "rows": {
    "prev": "Назад",
    "next": "Вперёд"
  },
  "console": {
    "placeholder": "SELECT * FROM ...",
    "run": "Выполнить",
    "allowWrite": "Разрешить запись",
    "hint": "Ctrl/⌘ + Enter для выполнения. Операции записи/DDL требуют включения «Разрешить запись»."
  },
  "common": {
    "selectEngine": "Выберите движок.",
    "selectDb": "Выберите базу данных.",
    "selectTable": "Выберите таблицу."
  },
  "actions": {
    "export": "Экспортировать",
    "addRecord": "Вставить запись",
    "cancel": "Отмена",
    "save": "Сохранить",
    "edit": "Редактировать",
    "downloadSql": "Скачать SQL",
    "install": "Установить {label}"
  },
  "titles": {
    "record": "Запись",
    "exportDb": "Экспорт базы данных",
    "editRecord": "Редактировать запись · {table}",
    "newRecord": "Новая запись · {table}"
  },
  "labels": {
    "tablesLabel": "Таблицы",
    "allTables": "Все",
    "includeData": "Включить данные",
    "active": "Активен",
    "actions": "Действия",
    "colName": "Столбец",
    "colType": "Тип",
    "colNullable": "Null",
    "colKey": "Ключ",
    "colDefault": "По умолчанию",
    "yes": "Да",
    "no": "Нет",
    "primaryKey": "Первичный ключ",
    "tbl": "табл"
  },
  "install": {
    "title": "Установить движок базы данных",
    "description": "Установите MariaDB или PostgreSQL на подключённом сервере, чтобы начать управление базами данных.",
    "mariadb": "MariaDB",
    "postgresql": "PostgreSQL"
  },
  "empty": {
    "noResults": "Нет результатов.",
    "noEngines": "На сервере нет активных движков баз данных. Установите один, чтобы начать.",
    "noDatabases": "Нет баз данных.",
    "noTables": "Нет таблиц."
  },
  "errors": {
    "detectEngines": "Ошибка определения движков",
    "loadRows": "Ошибка загрузки строк",
    "saveRecord": "Не удалось сохранить запись",
    "deleteRecord": "Не удалось удалить запись",
    "networkError": "Ошибка сети",
    "runQuery": "Ошибка выполнения запроса"
  },
  "loading": {
    "generic": "Загрузка…",
    "rows": "Загрузка строк…",
    "structure": "Загрузка структуры…",
    "tablesExport": "Загрузка таблиц…",
    "running": "Выполнение…"
  },
  "toasts": {
    "engineInstalled": "{label} установлен",
    "noColumnsMetadata": "Нет метаданных столбцов для этой таблицы",
    "recordUpdated": "Запись обновлена",
    "recordCreated": "Запись создана",
    "recordDeleted": "Запись удалена",
    "noTableSelect": "Выберите хотя бы одну таблицу",
    "exportDownloaded": "Экспорт загружен",
    "selectEngineFirst": "Сначала выберите движок",
    "statementExecuted": "Запрос выполнен"
  },
  "confirm": {
    "deleteRecord": "Удалить эту запись? Действие необратимо.",
    "deleteTitle": "Удалить запись",
    "deleteConfirmText": "Удалить"
  },
  "info": {
    "installing": "Установка {label}… это может занять несколько минут.",
    "installed": "{label} установлен. Определение движка…",
    "pager": "Строки {from}–{to} (страница по {limit})",
    "statementExecuted": "Запрос выполнен",
    "rowCount": "{count} строк(а)",
    "truncated": "· результат усечён до {count} строк"
  },
  "runtime": {
    "createPromptWithPrefix": "Имя должно начинаться с {prefix} и укладываться в квоту.",
    "createPrompt": "Имя новой базы данных на активном сервере.",
    "invalidPrefix": "Имя должно начинаться с {prefix}",
    "createError": "Не удалось создать базу данных.",
    "created": "База данных создана."
  },
  "settings": {
    "title": "Настройки баз данных",
    "description": "Параметры модуля баз данных.",
    "table": "Таблица",
    "pagination": "Разбиение на страницы",
    "rowsPerPage": "Строк на странице в результатах разделов «Структура» и «Консоль».",
    "serverPagination": "Таблица «Записи» использует серверное разбиение на страницы; здесь его изменить нельзя.",
    "relatedModules": "Связанные модули",
    "hostingQuotas": "Хостинг и квоты",
    "databaseBackups": "Резервные копии баз данных",
    "sqlFiles": "Файлы SQL",
    "allowWriteDefault": "Разрешать запись по умолчанию при открытии консоли",
    "allowWriteHelp": "Применяется при загрузке модуля; изменить параметр можно в консоли в любое время.",
    "createDatabase": "Создать базу данных",
    "create": "Создать"
  }
} as const;

export default databases;
