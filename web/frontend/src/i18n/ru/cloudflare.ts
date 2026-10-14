const cloudflare = {
  "options": {
    "essentiallyOff": "Практически отключено",
    "low": "Низкий",
    "medium": "Средний",
    "high": "Высокий"
  },
  "pageTitle": "Cloudflare",
  "header": {
    "heading": "Cloudflare",
    "subheading": "Управляйте DNS, кэшем, SSL/TLS и безопасностью зон Cloudflare для этого сервера."
  },
  "config": {
    "title": "Подключение к Cloudflare",
    "tokenLabel": "Токен API",
    "tokenPlaceholder": "API Token Cloudflare",
    "tokenHint": "Создайте токен на dash.cloudflare.com → My Profile → API Tokens с правами для зоны: DNS, Cache Purge, Zone Settings и Firewall Services.",
    "save": "Сохранить",
    "test": "Проверить подключение",
    "clear": "Удалить токен",
    "tokenSet": "Токен настроен",
    "tokenMissing": "Настройте API Token, чтобы начать",
    "saved": "Токен сохранён",
    "cleared": "Токен удалён",
    "confirmClear": "Удалить токен Cloudflare?",
    "confirmClearBtn": "Удалить"
  },
  "zones": {
    "title": "Зона",
    "select": "Выберите зону",
    "empty": "С этим токеном нет видимых зон.",
    "status": "Статус",
    "plan": "Тариф",
    "nameServers": "Серверы имён",
    "domainNotFound": "Домен {domain} не принадлежит ни одной зоне токена"
  },
  "runtime": {
    "active": "Активна",
    "pending": "Ожидание",
    "initializing": "Инициализация",
    "moved": "Перенесена",
    "paused": "приостановлена",
    "pausedHint": "Зона приостановлена: проверьте настройки перед изменением DNS.",
    "inactiveHint": "Зона {status}: проверьте серверы имён у регистратора.",
    "activeHint": "Активная зона · настроено серверов имён: {count}."
  },
  "tabs": {
    "dns": "DNS",
    "cache": "Кэш",
    "security": "SSL / Безопасность",
    "access": "Правила доступа",
    "config": "Настройки"
  },
  "dns": {
    "title": "DNS-записи",
    "add": "Добавить запись",
    "type": "Тип",
    "name": "Имя",
    "content": "Содержимое",
    "ttl": "TTL",
    "proxied": "Прокси",
    "pointsToServer": "Указывает на этот сервер",
    "edit": "Изменить",
    "delete": "Удалить",
    "confirmDelete": "Удалить запись {name}?",
    "saved": "Запись сохранена",
    "deleted": "Запись удалена",
    "useServerIp": "Использовать IP сервера",
    "priority": "Приоритет",
    "confirmDeleteTitle": "Удалить запись",
    "typeA": "A",
    "typeAAAA": "AAAA",
    "typeCNAME": "CNAME",
    "typeTXT": "TXT",
    "typeMX": "MX",
    "typeNS": "NS",
    "ttlAuto": "Auto",
    "ttl60": "60",
    "ttl300": "300",
    "ttl1800": "1800",
    "ttl3600": "3600",
    "ttl86400": "86400"
  },
  "cache": {
    "title": "Кэш",
    "purgeAll": "Очистить всё",
    "purgeAllHint": "Удаляет весь кэшированный контент зоны в Cloudflare.",
    "confirmPurgeAll": "Очистить ВЕСЬ кэш зоны?",
    "purgeUrls": "Очистить URL",
    "purgeUrlsPlaceholder": "https://ejemplo.com/estilos.css (один URL в строке)",
    "purged": "Кэш очищен",
    "devMode": "Режим разработки",
    "devModeHint": "Временно отключает кэш Cloudflare (автоматически выключается через 3 часа).",
    "confirmPurgeTitle": "Очистить кэш",
    "confirmPurgeBtn": "Очистить"
  },
  "security": {
    "title": "SSL / Безопасность",
    "sslMode": "Режим SSL/TLS",
    "alwaysHttps": "Всегда HTTPS",
    "securityLevel": "Уровень безопасности",
    "underAttack": "Режим «под атакой»",
    "updated": "Настройка обновлена",
    "sslOff": "Выключено",
    "sslFlexible": "Гибкий",
    "sslFull": "Полный",
    "sslFullStrict": "Полный (строгий)"
  },
  "access": {
    "title": "Правила доступа по IP",
    "add": "Добавить правило",
    "mode": "Действие",
    "block": "Блокировать",
    "allow": "Разрешить",
    "challenge": "Проверка",
    "ip": "IP / диапазон",
    "notes": "Заметки",
    "empty": "В этой зоне нет правил доступа.",
    "confirmDelete": "Удалить правило для {ip}?",
    "created": "Правило создано",
    "deleted": "Правило удалено",
    "ipHeader": "IP",
    "confirmDeleteTitle": "Удалить правило"
  },
  "common": {
    "loading": "Загрузка...",
    "error": "Ошибка",
    "save": "Сохранить",
    "cancel": "Отмена",
    "delete": "Удалить",
    "refresh": "Обновить",
    "serverIp": "IP сервера",
    "noToken": "Настройте API Token Cloudflare на вкладке «Настройки»."
  },
  "settingsUi": {
    "title": "Настройки Cloudflare",
    "description": "Параметры таблиц модуля Cloudflare.",
    "access": "Доступ",
    "credentialsConnections": "Учётные данные и подключения",
    "cloudflareToken": "Токен Cloudflare",
    "serverFirewall": "Брандмауэр сервера",
    "dnsWebhooks": "События DNS в Webhooks"
  }
} as const;

export default cloudflare;
