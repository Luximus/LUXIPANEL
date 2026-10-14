const webhooks = {
  "pageTitle": "Webhooks и API Keys",
  "tabs": {
    "webhooks": "Webhooks",
    "apiKeys": "ключи API",
    "discovered": "Обнаруженные"
  },
  "webhooksPanel": {
    "description": "Исходящие HTTP-уведомления с HMAC-подписью",
    "btnNew": "Новый webhook"
  },
  "apiKeysPanel": {
    "description": "Программный доступ с помощью постоянных токенов",
    "btnNew": "Новая API key"
  },
  "newKeyReveal": {
    "message": "API Key создан — скопируйте его сейчас, он больше не будет показан",
    "btnCopy": "Скопировать"
  },
  "webhookDialog": {
    "placeholderUrl": "https://example.com/webhook",
    "title": "Новый webhook",
    "labelUrl": "URL endpoint'а",
    "labelEvents": "Отслеживаемые события",
    "labelEnabled": "Webhook активен",
    "btnCancel": "Отмена",
    "btnSave": "Сохранить"
  },
  "apiKeyDialog": {
    "placeholderName": "Моя интеграция",
    "title": "Новая API Key",
    "labelName": "Описательное название",
    "labelExpires": "Истекает (необязательно)",
    "btnCancel": "Отмена",
    "btnCreate": "Создать ключ"
  },
  "discovered": {
    "description": "Webhooks, обнаруженные на сервере (Git, nginx, cron, systemd, файлы конфигурации и проекты)",
    "btnRescan": "Пересканировать",
    "scanning": "Сканирование сервера…",
    "empty": "На сервере не обнаружено webhooks",
    "cols": {
      "source": "Источник",
      "name": "Название",
      "target": "Назначение",
      "location": "Расположение",
      "estado": "Статус"
    },
    "filters": {
      "searchTarget": "Поиск назначения…",
      "source": "Источник"
    },
    "sources": {
      "sidecar": "Панель",
      "git-hook": "Git hook",
      "nginx": "Nginx",
      "cron": "Cron",
      "systemd": "systemd",
      "config": "Конфигурация",
      "project": "Проект"
    },
    "status": {
      "enabled": "Активен",
      "disabled": "Неактивен",
      "unknown": "—"
    },
    "actions": {
      "detail": "Подробнее",
      "delete": "Удалить"
    },
    "detail": {
      "title": "Сведения об обнаруженном webhook",
      "source": "Источник",
      "target": "Назначение",
      "location": "Расположение",
      "info": "Информация",
      "raw": "Конфигурация",
      "managedNote": "Этим webhook управляет панель",
      "readonlyNote": "Только чтение: управляйте им из соответствующего модуля",
      "btnClose": "Закрыть"
    },
    "confirm": {
      "deleteTitle": "Удалить обнаруженный webhook",
      "deleteBody": "Удалить «{name}»? Это изменит файл на сервере.",
      "deleteBtn": "Да, удалить"
    },
    "toasts": {
      "deleted": "Удалено",
      "errorDeleting": "Не удалось удалить",
      "scanComplete": "Сканирование завершено: {count}",
      "notManageable": "Управляйте им из соответствующего модуля"
    }
  },
  "labels": {
    "statusFailing": "Ошибки",
    "statusActive": "Активен",
    "statusPaused": "Приостановлен",
    "newWebhookTitle": "Новый webhook",
    "noExpiry": "Без срока действия"
  },
  "confirm": {
    "rotateSecretBody": "Ротировать secret этого webhook? Нужно будет обновить получателя.",
    "rotateSecretTitle": "Ротировать secret",
    "rotateSecretBtn": "Да, ротировать",
    "deleteWebhookBody": "Удалить этот webhook?",
    "deleteWebhookTitle": "Удалить webhook",
    "revokeKeyBody": "Отозвать API key \"{name}\"?",
    "revokeKeyTitle": "Отозвать API key",
    "revokeKeyBtn": "Да, отозвать"
  },
  "toasts": {
    "secretRotated": "Secret ротирован",
    "errorRotating": "Ошибка ротации",
    "webhookDeleted": "Webhook удалён",
    "errorDeleting": "Ошибка удаления",
    "webhookUpdated": "Webhook обновлён",
    "webhookCreated": "Webhook создан",
    "errorSaving": "Ошибка сохранения",
    "keyRevoked": "Key отозван",
    "errorRevoking": "Ошибка отзыва",
    "copiedToClipboard": "Скопировано в буфер обмена",
    "errorCreatingKey": "Ошибка создания key"
  },
  "categories": {
    "receiveData": "Приём данных",
    "mailhook": "Mailhook",
    "response": "Ответ на webhook",
    "soon": "Скоро",
    "soonDesc": "Настройка и сканирование этой категории будут определены на следующем этапе."
  },
  "gateway": {
    "description": "Эндпоинты, размещённые панелью для приёма входящих данных (в стиле Make.com). Аутентификация по API key (x-make-apikey), ограничение по IP и валидация структуры данных.",
    "btnNew": "Новый webhook",
    "detectedTitle": "Обнаруженные приёмники на сервере",
    "urlReveal": "URL webhook — отправляйте запросы сюда",
    "cols": {
      "name": "Название",
      "auth": "Аутентификация",
      "recibidos": "Получено",
      "ultima": "Последний",
      "estado": "Статус",
      "estadoActive": "Активен",
      "estadoPaused": "Приостановлен"
    },
    "dialog": {
      "titleNew": "Создать webhook",
      "titleEdit": "Редактировать webhook",
      "name": "Название webhook",
      "namePlaceholder": "Мой webhook gateway",
      "nameHint": "Должно содержать от 1 до 128 символов.",
      "apiAuth": "Аутентификация по API key",
      "apiAuthHint": "Отправляйте API key в заголовке x-make-apikey. Добавьте один или несколько; доступ предоставляется при совпадении любого из них.",
      "apiKeyName": "Название",
      "apiKeyValue": "Значение API key",
      "apiKeyKeep": "(сохранён — оставьте пустым для сохранения)",
      "addApiKey": "Добавить API key",
      "ipTitle": "Ограничения по IP",
      "ipHint": "Список IP-адресов, разделённых запятой. Допускается нотация CIDR. Пусто = без проверки.",
      "dataStructure": "Структура данных",
      "dataStructureHint": "Валидация входящих данных. Пусто = принимать без проверки.",
      "dsValidate": "Проверить структуру данных",
      "dsStrict": "Строгий режим (отклонять неуказанные поля)",
      "dsFieldName": "Название",
      "dsFieldDesc": "Описание",
      "dsFieldType": "Тип",
      "dsFieldDefault": "Значение по умолчанию",
      "dsFieldRequired": "Обязательное",
      "dsFieldMultiline": "Многострочное",
      "addItem": "Добавить поле",
      "getHeaders": "Получить заголовки запроса",
      "getHeadersHint": "Заголовки будут добавлены в тело.",
      "getMethod": "Получить HTTP-метод",
      "getMethodHint": "Метод (глагол) будет добавлен в тело.",
      "jsonPassthrough": "Сохранять JSON как текст",
      "jsonPassthroughHint": "Если включено, JSON-payload сохраняется как строка.",
      "enabled": "Webhook активен",
      "advanced": "Дополнительные настройки",
      "btnCancel": "Отмена",
      "btnSave": "Сохранить"
    },
    "payloads": {
      "title": "Полученные payload-ы",
      "empty": "Payload-ы ещё не получены.",
      "btnClose": "Закрыть"
    },
    "confirm": {
      "deleteTitle": "Удалить webhook",
      "deleteBody": "Удалить webhook «{name}»? Сохранённые payload-ы будут потеряны.",
      "deleteBtn": "Да, удалить"
    },
    "toasts": {
      "created": "Webhook создан",
      "updated": "Webhook обновлён",
      "deleted": "Webhook удалён",
      "copied": "URL скопирован",
      "error": "Ошибка сохранения"
    }
  },
  "table": {
    "gateway": {
      "columns": {
        "name": "Название",
        "auth": "Аутентификация",
        "recibidos": "Получено",
        "ultima": "Последний",
        "estado": "Статус"
      },
      "filters": {
        "searchName": "Поиск по имени…",
        "estado": "Статус"
      },
      "rowActions": {
        "copy": "Копировать URL",
        "payloads": "Просмотр полезной нагрузки",
        "edit": "Редактировать",
        "delete": "Удалить"
      },
      "options": {
        "statusActive": "Активен",
        "statusPaused": "Приостановлен"
      }
    },
    "webhooks": {
      "columns": {
        "url": "URL",
        "eventos": "События",
        "estado": "Статус"
      },
      "filters": {
        "searchUrl": "Поиск URL…",
        "estado": "Статус"
      },
      "rowActions": {
        "regenerate": "Ротировать secret",
        "delete": "Удалить"
      },
      "options": {
        "statusActive": "Активен",
        "statusPaused": "Приостановлен",
        "statusFailing": "Ошибки"
      }
    },
    "apiKeys": {
      "columns": {
        "name": "Название",
        "prefix": "Префикс",
        "creada": "Создано",
        "expira": "Истекает"
      },
      "filters": {
        "searchName": "Поиск по имени…"
      },
      "rowActions": {
        "revoke": "Отозвать"
      }
    },
    "discovered": {
      "columns": {
        "origen": "Источник",
        "name": "Название",
        "target": "Назначение",
        "location": "Расположение",
        "estado": "Статус"
      },
      "filters": {
        "searchTarget": "Поиск назначения…",
        "origen": "Источник"
      },
      "rowActions": {
        "detail": "Подробнее",
        "delete": "Удалить"
      },
      "options": {
        "panel": "Панель",
        "gitHook": "Git hook",
        "nginx": "Nginx",
        "cron": "Cron",
        "systemd": "systemd",
        "config": "Конфигурация",
        "proyecto": "Проект"
      }
    }
  },
  "runtime": {
    "testDelivered": "Тестовая доставка выполнена.",
    "testFailed": "Тестовая доставка не удалась.",
    "loadingDeliveries": "Загрузка доставок…",
    "loadDeliveriesError": "Не удалось загрузить доставки.",
    "noDeliveries": "Доставок пока нет.",
    "delivered": "Доставлено",
    "failed": "Ошибка",
    "attempts": "Попыток: {count}",
    "selectEvent": "Выберите хотя бы одно событие."
  },
  "settingsUi": {
    "title": "Настройки Webhooks",
    "description": "Разбиение на страницы и видимые действия в таблицах Webhooks.",
    "gateway": "Шлюз",
    "webhooks": "Webhooks",
    "signingSecret": "Секрет подписи · скопируйте сейчас",
    "signingSecretHint": "Показывается только один раз. Настройте его у получателя для проверки X-Luxipanel-Signature.",
    "recentDeliveries": "Недавние доставки"
  }
} as const;

export default webhooks;
