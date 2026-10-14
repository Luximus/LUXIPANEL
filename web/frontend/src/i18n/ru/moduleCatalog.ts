const moduleCatalog = {
  "users": {
    "name": "Пользователи",
    "description": "Управление пользователями панели, ролями и правами доступа."
  },
  "mail": {
    "name": "Почта",
    "description": "SMTP / IMAP, домены и почтовые ящики пользователей."
  },
  "monitor": {
    "name": "Монитор",
    "description": "Метрики CPU, RAM, диска и процессов в реальном времени."
  },
  "files": {
    "name": "Файлы",
    "description": "Удалённый файловый менеджер со встроенным редактором."
  },
  "firewall": {
    "name": "Брандмауэр",
    "description": "Управление правилами UFW и блокировка IP-адресов."
  },
  "bitninja": {
    "name": "BitNinja",
    "description": "Комплексный агент безопасности: WAF, anti-DoS, обнаружение вредоносного ПО и репутация IP."
  },
  "assistant": {
    "name": "ИИ-агенты",
    "description": "ИИ-ассистент для диагностики и автоматизации."
  },
  "repository-store": {
    "name": "GitHub",
    "description": "Каталог репозиториев и установка с пошаговыми подсказками."
  },
  "dns": {
    "name": "Nginx",
    "description": "Управление Nginx: сайты, обратный прокси, SSL, логи и состояние."
  },
  "backups": {
    "name": "Резервные копии",
    "description": "Резервные копии по расписанию с шифрованием и несколькими назначениями."
  },
  "cron": {
    "name": "Cron",
    "description": "Задачи по расписанию с визуальным редактором."
  },
  "databases": {
    "name": "Базы данных",
    "description": "Менеджер баз данных (MySQL/MariaDB и PostgreSQL): просмотр схем и консоль SQL."
  },
  "obsidian": {
    "name": "Obsidian",
    "description": "Хранилища заметок Obsidian на вашем сервере: редактор markdown, wikilinks и заметки, управляемые ИИ-агентами ассистента."
  },
  "cloudflare": {
    "name": "Cloudflare",
    "description": "Управление Cloudflare для сервера: DNS, кэш, SSL/TLS, режим разработки и правила доступа по IP."
  },
  "server-alerts": {
    "name": "Уведомления",
    "description": "Уведомления сервера для владельца панели: настройки оповещений, мгновенные, запланированные/повторяющиеся уведомления и правила по метрикам (CPU/RAM/диск/нагрузка/сбой службы), доставляемые на устройства через LP."
  },
  "expo": {
    "name": "Expo",
    "description": "Управляйте приложениями Expo/React Native: сборки EAS, отправка в магазины, OTA-обновления, QR для dev-client и квоты с использованием access token клиента."
  },
  "webhooks": {
    "name": "Вебхуки",
    "description": "HTTP-уведомления о событиях панели."
  },
  "openclaw": {
    "name": "OpenClaw",
    "description": "Подключение к OpenClaw AI с выбором модели."
  },
  "hosting": {
    "name": "Хостинг",
    "description": "Сайты, виртуальные хосты и развёртывания с подсказками."
  },
  "terminal": {
    "name": "Терминал",
    "description": "Плавающий терминал, доступный из любого раздела панели. Включает или отключает плавающую кнопку."
  },
  "module-dev": {
    "name": "Мои модули",
    "description": "Жизненный цикл ваших модулей маркетплейса: статус проверки, отправки, тесты и приватный предпросмотр."
  },
  "filesystem-mcp": {
    "name": "Filesystem MCP",
    "description": "MCP для операций с файловой системой."
  },
  "github-mcp": {
    "name": "GitHub MCP",
    "description": "MCP для операций через API GitHub."
  },
  "google-drive": {
    "name": "Google Drive",
    "description": "Ищите и прикрепляйте документы из вашего Google Drive прямо из чата ассистента."
  },
  "onedrive": {
    "name": "OneDrive",
    "description": "Доступ к файлам Microsoft OneDrive / SharePoint из чата."
  },
  "dropbox": {
    "name": "Dropbox",
    "description": "Ищите и прикрепляйте файлы из Dropbox прямо из чата."
  },
  "notion": {
    "name": "Notion",
    "description": "Просматривайте страницы и базы данных Notion из чата."
  }
} as const;

export default moduleCatalog;
