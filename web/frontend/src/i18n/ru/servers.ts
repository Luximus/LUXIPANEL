const servers = {
  "pageTitle": "Серверы",
  "description": "Локальный список SSH-узлов, к которым может подключаться эта панель. Секреты (ключи и пароли) хранятся в зашифрованном виде и здесь никогда не отображаются.",
  "btnNew": "Добавить сервер",
  "table": {
    "name": "Имя",
    "host": "Хост",
    "username": "Пользователь",
    "authType": "Аутентификация",
    "status": "Статус"
  },
  "authTypes": {
    "key": "SSH-ключ",
    "password": "Пароль"
  },
  "status": {
    "approved": "Подтверждён",
    "pending": "Ожидает",
    "untested": "Не проверен"
  },
  "common": {
    "test": "Проверить",
    "edit": "Изменить",
    "delete": "Удалить",
    "cancel": "Отмена",
    "save": "Сохранить",
    "close": "Закрыть",
    "error": "Ошибка",
    "yes": "Да",
    "no": "Нет"
  },
  "dialog": {
    "titleNew": "Добавить сервер",
    "titleEdit": "Изменить сервер",
    "name": "Имя",
    "namePlaceholder": "Мой рабочий сервер",
    "host": "Хост или IP",
    "hostPlaceholder": "203.0.113.10 или server.example.com",
    "port": "Порт",
    "username": "Пользователь",
    "usernamePlaceholder": "root",
    "authType": "Тип аутентификации",
    "secretKey": "Закрытый SSH-ключ",
    "secretKeyPlaceholder": "-----BEGIN OPENSSH PRIVATE KEY-----",
    "passphrase": "Парольная фраза ключа (необязательно)",
    "passphrasePlaceholder": "Парольная фраза для разблокировки ключа",
    "secretPassword": "Пароль",
    "secretPasswordPlaceholder": "Пароль пользователя SSH",
    "secretKeepHint": "Оставьте поле пустым, чтобы сохранить текущий секрет.",
    "btnCancel": "Отмена",
    "btnSave": "Сохранить"
  },
  "fingerprint": {
    "title": "Подтвердить отпечаток хоста",
    "intro": "Это первое подключение к серверу. Перед подтверждением убедитесь, что отпечаток ключа хоста совпадает с ожидаемым.",
    "approve": "Подтвердить отпечаток",
    "approving": "Подтверждение…",
    "approved": "Отпечаток подтверждён",
    "approveError": "Не удалось подтвердить отпечаток"
  },
  "toasts": {
    "created": "Сервер добавлен",
    "updated": "Сервер обновлён",
    "deleted": "Сервер удалён",
    "testOk": "Подключение успешно",
    "testFailed": "Ошибка подключения"
  },
  "validation": {
    "nameRequired": "Введите имя",
    "hostRequired": "Введите хост",
    "usernameRequired": "Введите пользователя",
    "secretRequired": "Введите секрет для аутентификации"
  },
  "confirmDelete": "Удалить сервер {name}? Это действие нельзя отменить.",
  "confirmDeleteTitle": "Удалить сервер",
  "testing": "Проверка подключения…"
} as const;

export default servers;
