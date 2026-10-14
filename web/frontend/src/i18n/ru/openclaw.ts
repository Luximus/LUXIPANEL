const openclaw = {
  "pageTitle": "OpenClaw",
  "header": {
    "subtitle": "Подключите панель к",
    "subtitleSuffix": "для использования её моделей и инструментов."
  },
  "statusCard": {
    "title": "Состояние подключения",
    "descKeySet": "API-ключ настроен. Нажмите «Проверить подключение» для верификации.",
    "descNoKey": "API-ключ ещё не настроен.",
    "btnTest": "Проверить подключение"
  },
  "form": {
    "sectionTitle": "Учётные данные и endpoint",
    "sectionDesc": "API key хранится в зашифрованном виде в базе данных панели.",
    "labelEndpoint": "Endpoint",
    "placeholderEndpoint": "https://openclaw.ai",
    "hintEndpoint": "Базовый URL API. По умолчанию",
    "labelApiKey": "ключ API",
    "placeholderApiKeySet": "Настроен · {preview}",
    "placeholderApiKeyUnset": "sk-...",
    "ariaToggleKey": "Показать или скрыть",
    "btnClearKey": "Удалить",
    "hintApiKey": "Оставьте пустым, чтобы сохранить текущий API key.",
    "labelDefaultModel": "Модель по умолчанию",
    "placeholderDefaultModel": "claw-default",
    "hintDefaultModel": "Идентификатор модели, которую будут использовать внутренние вызовы, не указывающие конкретную модель.",
    "btnSave": "Сохранить изменения"
  },
  "help": {
    "title": "Как получить мой API-ключ?",
    "step1": "Войдите в",
    "step2": "Откройте настройки своей учётной записи и создайте новый API key.",
    "step3": "Вставьте его выше и сохраните — панель больше не покажет его в открытом виде."
  }
} as const;

export default openclaw;
