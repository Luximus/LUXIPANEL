// Auto-split fragment of mail.ts (part 2/2) — data only, keeps <1000 lines.
// Do not reorder keys: the aggregator merges parts by spread in original order.
const mailPart2 = {
  "routing": {
    "labels": {
      "autoRemote": "Автоопределение конфигурации: удалённый",
      "local": "Локальный почтовый сервер",
      "backup": "Резервный почтовый сервер",
      "remote": "Удалённый почтовый сервер"
    },
    "currentMode": "Текущий: {mode}"
  },
  "tracking": {
    "statuses": {
      "success": "Успешно",
      "deferred": "Отложено",
      "failure": "Ошибка",
      "inProgress": "В процессе",
      "unknown": "Неизвестно"
    },
    "columns": {
      "event": "Событие",
      "fromAddress": "Отправитель",
      "sentTime": "Время отправки",
      "spamScore": "Оценка спама",
      "recipient": "Получатель",
      "domain": "Домен",
      "id": "ID",
      "result": "Результат",
      "actions": "Действия"
    },
    "noRecordsFound": "Записи не найдены.",
    "zeroRecords": "0 записей",
    "matchesZeroRecords": "Поиск не дал результатов.",
    "recordsCount": "{count} записей",
    "matchesRecords": "Найдено записей: {count}.",
    "detailMeta": "Событие: {event} | ID: {id} | Получатель: {recipient}"
  },
  "filters": {
    "ruleParts": {
      "from": "От",
      "subject": "Тема",
      "to": "Кому",
      "anyRecipient": "Любой получатель",
      "reply": "Ответить",
      "body": "Тело",
      "anyHeader": "Любой заголовок",
      "notDelivered": "Ранее не доставлялось",
      "errorMessage": "Сообщение об ошибке",
      "listId": "ID списка",
      "spamStatus": "Статус спама",
      "spamBar": "Индикатор спама",
      "spamScore": "Оценка спама"
    },
    "matches": {
      "contains": "содержит",
      "matchesRegex": "соответствует regex",
      "doesNotContain": "не содержит",
      "equals": "равно",
      "beginsWith": "начинается с",
      "endsWith": "заканчивается на",
      "doesNotBegin": "не начинается с",
      "doesNotEnd": "не заканчивается на",
      "doesNotMatch": "не совпадает",
      "isAbove": "больше (только числа)",
      "isNotAbove": "не больше (только числа)",
      "isBelow": "меньше (только числа)",
      "isNotBelow": "не меньше (только числа)"
    },
    "actions": {
      "discard": "Удалить сообщение",
      "redirect": "Перенаправить на адрес",
      "fail": "Отклонить с сообщением",
      "stop": "Остановить обработку правил",
      "deliverToFolder": "Доставить в папку",
      "pipe": "Передать программе"
    },
    "joinOp": {
      "and": "и",
      "or": "или"
    },
    "removeBtn": "-"
  },
  "defaultAddress": {
    "currentSetting": {
      "none": "Текущая настройка: (нет)",
      "forward": "Текущая настройка: {destination}",
      "forwardDefault": "(переадресация)",
      "fail": "Текущая настройка: :fail: {message}"
    },
    "defaultFailMessage": "Такой пользователь не существует"
  },
  "archive": {
    "retentionOptions": {
      "oneMonth": "1 месяц",
      "threeMonths": "3 месяца",
      "sixMonths": "6 месяцев",
      "oneYear": "1 год",
      "twoYears": "2 года",
      "fiveYears": "5 лет",
      "tenYears": "10 лет",
      "forever": "Бессрочно",
      "custom": "Произвольно"
    },
    "fields": {
      "incomingEmail": "Входящие письма",
      "outgoingMailingList": "Исходящие письма рассылки",
      "outgoingEmail": "Исходящие письма"
    }
  },
  "encryption": {
    "neverExpires": "Бессрочно"
  },
  "actions": {
    "view": "Просмотр",
    "save": "Сохранить",
    "clone": "Клонировать",
    "copy": "Копировать",
    "delete": "Удалить",
    "edit": "Изменить",
    "remove": "Удалить"
  },
  "outbound": {
    "cardTitle": "Отправка писем панели (SMTP)",
    "cardDesc": "Учётная запись по умолчанию или внешний SMTP, через который панель отправляет отчёты и системные письма.",
    "back": "Назад",
    "intro": "Идентификатор, от имени которого LUXIPANEL отправляет системные письма (отчёты cron-агентов, ссылки подтверждения, тесты). Это может быть почтовый аккаунт на этом сервере или внешний SMTP, не принадлежащий серверу.",
    "modeLabel": "Режим отправки",
    "modeDisabled": "Отключено",
    "modeAccount": "Почтовый аккаунт сервера (по умолчанию)",
    "modeExternal": "Внешний SMTP",
    "accountLabel": "Учётная запись отправки по умолчанию",
    "accountHint": "Использует сохранённые учётные данные SMTP этого аккаунта.",
    "hostLabel": "SMTP-сервер",
    "portLabel": "Порт",
    "userLabel": "Пользователь",
    "passLabel": "Пароль",
    "passPlaceholder": "(без изменений)",
    "fromLabel": "Отправитель (email)",
    "fromNameLabel": "Имя отправителя",
    "secureLabel": "Прямой TLS (порт 465)",
    "save": "Сохранить",
    "testPlaceholder": "to@example.com",
    "test": "Отправить тест",
    "hostPlaceholder": "smtp.example.com",
    "fromPlaceholder": "sender@example.com",
    "fromNamePlaceholder": "Моя компания"
  },
  "table": {
    "status": {
      "active": "Активен",
      "inactive": "Неактивен",
      "disabled": "Отключено"
    },
    "redirect": {
      "columns": {
        "domain": "Домен",
        "destinos": "Назначения"
      },
      "filters": {
        "searchDomain": "Поиск домена…"
      },
      "rowActions": {
        "edit": "Редактировать",
        "delete": "Удалить"
      }
    },
    "encryption": {
      "columns": {
        "keyId": "ID ключа",
        "label": "Идентификация",
        "keySize": "Размер ключа",
        "created": "Создано",
        "expires": "Истекает"
      },
      "filters": {
        "searchKey": "Поиск ключа…"
      },
      "rowActions": {
        "view": "Просмотр",
        "delete": "Удалить"
      }
    },
    "accounts": {
      "columns": {
        "address": "Адрес",
        "domain": "Домен",
        "uso": "Квота / Использование",
        "reenvios": "Пересылки",
        "estado": "Статус"
      },
      "filters": {
        "search": "Поиск адреса или домена…",
        "domain": "Домен",
        "estado": "Статус"
      },
      "rowActions": {
        "edit": "Изменить аккаунт",
        "depurarIa": "Очистить с помощью ИИ",
        "password": "Изменить пароль",
        "toggle": "Включить / Отключить",
        "inbox": "Открыть почту",
        "signatures": "Управление подписями",
        "default": "Использовать по умолчанию",
        "contacts": "Управление контактами",
        "calendars": "Управление календарями",
        "autoresponder": "Управление автоответчиком",
        "filters": "Управление фильтрами",
        "forwards": "Управление пересылкой",
        "diskusage": "Управление использованием диска",
        "clone": "Клонировать почтовый ящик",
        "delete": "Удалить учётную запись"
      },
      "quickActions": {
        "bulkForward": "Добавить пересылку",
        "bulkQuota": "Изменить квоту",
        "bulkDelete": "Удалить аккаунты"
      }
    },
    "globalFilters": {
      "columns": {
        "name": "Фильтр",
        "estado": "Статус",
        "rules": "Правила",
        "actionsCount": "Действия"
      },
      "filters": {
        "search": "Поиск фильтра…"
      },
      "rowActions": {
        "edit": "Редактировать",
        "delete": "Удалить"
      }
    },
    "contacts": {
      "columns": {
        "email": "Email",
        "name": "Название"
      },
      "filters": {
        "searchEmail": "Поиск email…"
      },
      "rowActions": {
        "edit": "Редактировать",
        "delete": "Удалить"
      }
    },
    "calendars": {
      "columns": {
        "name": "Название",
        "timezone": "Часовой пояс",
        "estado": "Статус"
      },
      "filters": {
        "search": "Поиск календаря…"
      },
      "rowActions": {
        "edit": "Редактировать",
        "delete": "Удалить"
      }
    },
    "signatures": {
      "columns": {
        "sender": "Отправитель",
        "preview": "Подпись"
      },
      "filters": {
        "search": "Фильтровать и искать…"
      },
      "rowActions": {
        "edit": "Редактировать",
        "delete": "Удалить"
      }
    },
    "filters": {
      "columns": {
        "name": "Название",
        "estado": "Статус"
      },
      "filters": {
        "search": "Поиск фильтра…"
      },
      "rowActions": {
        "edit": "Редактировать",
        "delete": "Удалить"
      }
    }
  },
  "confirm": {
    "bulkDeleteAccounts": "Удалить {count} почтовых аккаунтов? Это действие нельзя отменить.",
    "deleteAccount": "Удалить аккаунт {address}? Это действие нельзя отменить.",
    "deleteAccountTitle": "Удалить аккаунт",
    "deleteAutoresponder": "Удалить автоответчик этого аккаунта?",
    "deleteByDate": "Будут удалены письма из {folder} в период с {from} по {to}. Продолжить?",
    "deleteByDateTitle": "Удалить письма по дате",
    "deleteCalendar": "Удалить календарь \"{label}\"?",
    "deleteCalendarTitle": "Удалить календарь",
    "deleteContact": "Удалить контакт \"{label}\"?",
    "deleteContactTitle": "Удалить контакт",
    "deleteDomainForward": "Удалить глобальную переадресацию для @{domain}?",
    "deleteDomainForwardTitle": "Удалить глобальную переадресацию",
    "deleteEncryptionKey": "Удалить этот ключ шифрования?",
    "deleteFilter": "Удалить фильтр \"{name}\"?",
    "deleteFilterTitle": "Удалить фильтр",
    "deleteForward": "Удалить пересылку на {destination}?",
    "deleteGlobalFilter": "Удалить глобальный фильтр \"{label}\"?",
    "deleteGlobalFilterTitle": "Удалить глобальный фильтр",
    "yesDelete": "Да, удалить"
  },
  "empty": {
    "noDomains": "Нет доменов",
    "noFolders": "Папки для этого аккаунта не найдены.",
    "noOtherAccount": "Нет другой доступной учётной записи"
  },
  "errors": {
    "accountCreateFailed": "Не удалось создать аккаунт",
    "accountNotFound": "Аккаунт не найден",
    "accountUpdateFailed": "Не удалось обновить аккаунт",
    "accountUpdatedForwardsFailed": "Аккаунт обновлён, но не удалось обновить переадресации",
    "accountsLoadFailed": "Не удалось загрузить аккаунты",
    "autoDeleteThresholdInvalid": "Недопустимый порог автоудаления.",
    "autoresponderDeleteFailed": "Не удалось удалить автоответчик",
    "autoresponderSaveFailed": "Не удалось сохранить автоответчик.",
    "calendarDeleteFailed": "Не удалось удалить календарь",
    "calendarNotFound": "Календарь не найден",
    "calendarSaveFailed": "Не удалось сохранить календарь.",
    "cloneCreateFailed": "Не удалось создать новый аккаунт.",
    "cloneFailed": "Не удалось клонировать почту.",
    "cloneIdResolveFailed": "Аккаунт создан, но не удалось определить его ID. Повторите как «существующий».",
    "cloneLocalAndDomainRequired": "Укажите локальную часть и домен.",
    "clonePasswordTooShort": "Пароль должен содержать не менее 6 символов.",
    "contactDeleteFailed": "Не удалось удалить контакт",
    "contactNotFound": "Контакт не найден",
    "contactSaveFailed": "Не удалось сохранить контакт.",
    "copyByRangeFailed": "Не удалось скопировать по диапазону",
    "customScoreInvalid": "Недопустимая пользовательская оценка.",
    "dateRangeRequired": "Необходимо выбрать начальную и конечную дату",
    "defaultAddressLoadFailed": "Не удалось загрузить адрес по умолчанию.",
    "defaultAddressSaveFailed": "Не удалось сохранить адрес по умолчанию.",
    "deleteByRangeFailed": "Не удалось удалить по диапазону",
    "deleteFailed": "Ошибка при удалении",
    "destEmailInvalid": "Недопустимый адрес назначения",
    "destinationsInvalidFormat": "Один или несколько адресов назначения имеют недопустимый формат.",
    "diskUsageLoadFailed": "Не удалось загрузить использование диска",
    "domainForwardDeleteFailed": "Не удалось удалить глобальную переадресацию.",
    "domainForwardsLoadFailed": "Не удалось загрузить глобальные переадресации.",
    "domainRedirectSaveFailed": "Не удалось сохранить глобальную переадресацию.",
    "domainsLoadFailed": "Не удалось загрузить DNS-домены",
    "filterDeleteFailed": "Не удалось удалить фильтр",
    "filterNotFound": "Фильтр не найден",
    "filterSaveFailed": "Не удалось сохранить фильтр.",
    "forwardAlreadyExists": "Пересылка на {destination} уже существует",
    "forwardsSaveFailed": "Не удалось сохранить пересылки на сервере",
    "globalFilterDeleteFailed": "Не удалось удалить глобальный фильтр.",
    "globalFilterSaveFailed": "Не удалось сохранить глобальный фильтр.",
    "globalFilterTestFailed": "Не удалось выполнить тест.",
    "globalFiltersLoadFailed": "Не удалось загрузить глобальные фильтры.",
    "indicateTestDestEmail": "Укажите адрес назначения для теста.",
    "localPartInvalid": "Имя пользователя перед @ имеет недопустимый формат.",
    "localPartInvalidNoPoint": "Имя пользователя перед @ имеет недопустимый формат",
    "mustAddAtLeastOneAction": "Необходимо добавить хотя бы одно действие.",
    "mustAddAtLeastOneDestEmail": "Необходимо добавить хотя бы один адрес назначения.",
    "mustAddAtLeastOneRule": "Необходимо добавить хотя бы одно правило.",
    "mustEnterBody": "Необходимо ввести содержимое сообщения.",
    "mustEnterSubject": "Необходимо ввести тему.",
    "mustEnterTestMessage": "Необходимо ввести тестовое сообщение.",
    "mustEnterValidDestEmail": "Необходимо ввести корректный адрес назначения.",
    "mustIndicateCalendarName": "Необходимо указать название календаря.",
    "mustIndicateContactEmail": "Необходимо указать адрес контакта.",
    "mustIndicateFilterName": "Необходимо указать название фильтра.",
    "mustIndicateName": "Необходимо указать название.",
    "mustSelectDomain": "Необходимо выбрать домен.",
    "mustSelectDomainNoPoint": "Необходимо выбрать домен",
    "noAutoresponderToDelete": "Нет автоответчика для удаления",
    "passwordChangeFailed": "Ошибка при смене пароля",
    "quotaInvalid": "Недопустимая квота",
    "routingLoadFailed": "Не удалось загрузить настройки маршрутизации почты.",
    "routingSaveFailed": "Не удалось сохранить настройки маршрутизации почты.",
    "saveFailed": "Ошибка при сохранении",
    "scoreTypesLoadFailed": "Не удалось загрузить каталог типов оценок.",
    "selectDestAccount": "Выберите аккаунт назначения",
    "selectValidDomain": "Выберите корректный домен.",
    "spamFiltersLoadFailed": "Не удалось загрузить фильтры спама.",
    "spamFiltersSaveFailed": "Не удалось сохранить настройки фильтров спама.",
    "testEmailFailed": "Ошибка при отправке тестового письма",
    "toggleFailed": "Ошибка при смене состояния",
    "trackDeliveryLoadFailed": "Не удалось загрузить отслеживание доставки."
  },
  "labels": {
    "accountColon": "Аккаунт: {address}",
    "activating": "Активация",
    "cloneStartedBg": "Клонирование запущено в фоновом режиме. Мы уведомим вас по завершении.",
    "cloning": "Клонирование…",
    "currentAccountColon": "Текущий аккаунт: {address}",
    "deactivating": "Деактивация",
    "destEmailForCount": "Адрес назначения пересылки для добавления в {count} аккаунтов:",
    "loading": "Загрузка...",
    "newQuotaFor": "Новая квота в МБ для {count} аккаунтов. Используйте 0 для безлимита.",
    "no": "Нет",
    "noGlobalLimit": "Без глобального лимита",
    "originColon": "Источник: {addr}",
    "sendingTest": "Отправка теста…",
    "sudoPromptMessage": "Невозможно прочитать использование почтовых ящиков без привилегий на сервере. Введите пароль sudo пользователя SSH (хранится зашифрованным на сервере).",
    "to": "на",
    "total": "Всего",
    "unlimited": "Безлимитно",
    "yes": "Да",
    "keepCopy": "Сохранить копию"
  },
  "placeholders": {
    "passwordNoChanges": "•••••••• (без изменений)",
    "selectDomain": "Выберите домен...",
    "value": "Значение",
    "valueIfApplicable": "Значение (если применимо)"
  },
  "status": {
    "active": "Активен",
    "deactivated": "Деактивирован",
    "inactive": "Неактивен"
  },
  "titles": {
    "addForward": "Добавить пересылку",
    "changeQuota": "Изменить квоту",
    "deleteAccounts": "Удалить аккаунты",
    "deleteAutoresponder": "Удалить автоответчик",
    "deleteEncryptionKey": "Удалить ключ",
    "deleteForward": "Удалить пересылку"
  },
  "toasts": {
    "accountActivated": "Аккаунт активирован",
    "accountCreated": "Аккаунт успешно создан",
    "accountDeactivated": "Аккаунт деактивирован",
    "accountDeleted": "Аккаунт удалён",
    "accountUpdated": "Аккаунт обновлён ({localPart}@{domain})",
    "archiveDefaultUpdated": "Настройки архивации по умолчанию обновлены.",
    "archiveDomainUpdated": "Архивация обновлена для {domain}.",
    "autoDeleteDisabled": "Автоудаление отключено",
    "autoDeleteEnabled": "Автоудаление включено",
    "autoDeleteUpdated": "Автоудаление обновлено",
    "autoresponderDeleted": "Автоответчик удалён",
    "autoresponderSaved": "Автоответчик сохранён",
    "blacklistUpdated": "Чёрный список обновлён",
    "bulkDeletedCount": "Удалено {ok}/{count} аккаунтов",
    "bulkUpdatedCount": "Обновлено {ok}/{count} аккаунтов",
    "calculatedScoresUpdated": "Расчётные оценки обновлены",
    "calendarCreated": "Календарь создан",
    "calendarDeleted": "Календарь удалён",
    "calendarUpdated": "Календарь обновлён",
    "cloneStarted": "Клонирование запущено — мы уведомим вас по завершении",
    "contactCreated": "Контакт создан",
    "contactDeleted": "Контакт удалён",
    "contactUpdated": "Контакт обновлён",
    "defaultAddressUpdated": "Адрес по умолчанию обновлён для @{domain}",
    "defaultInboxSet": "{address} теперь является адресом по умолчанию",
    "domainForwardDeleted": "Глобальная переадресация для @{domain} удалена",
    "emailRoutingUpdated": "Маршрутизация почты обновлена для @{domain}",
    "emailsCopied": "Скопировано {count} писем из {folder}",
    "emailsDeleted": "Удалено {count} писем из {folder}",
    "filterCreated": "Фильтр создан",
    "filterDeleted": "Фильтр удалён",
    "filterUpdated": "Фильтр обновлён",
    "forwardAddedCount": "Пересылка добавлена в {ok}/{count} аккаунтов",
    "forwardDeleted": "Пересылка удалена",
    "forwardsUpdated": "Пересылки обновлены",
    "globalFilterCreated": "Глобальный фильтр создан",
    "globalFilterDeleted": "Глобальный фильтр удалён",
    "globalFilterUpdated": "Глобальный фильтр обновлён",
    "globalRedirectSaved": "Глобальная переадресация сохранена для @{domain}",
    "keyDeleted": "Ключ удалён.",
    "keyGenerated": "Ключ сгенерирован.",
    "passwordUpdated": "Пароль обновлён",
    "publicKeyImported": "Публичный ключ импортирован.",
    "settingsSaved": "Настройки сохранены ✓",
    "spamBoxDisabled": "Папка спама отключена",
    "spamBoxEnabled": "Папка спама включена",
    "spamBoxUpdated": "Папка спама обновлена",
    "spamFiltersDisabled": "Фильтры спама отключены",
    "spamFiltersEnabled": "Фильтры спама включены",
    "spamThresholdUpdated": "Порог спама обновлён",
    "testEmailSent": "Тестовое письмо отправлено ✓",
    "whitelistUpdated": "Белый список обновлён"
  },
  "signaturesDrawer": {
    "title": "Подписи",
    "addSignature": "Добавить подпись",
    "close": "Закрыть",
    "tableTitle": "подписи"
  },
  "dataTableTitles": {
    "rules": "правила",
    "publicKeys": "открытые ключи",
    "privateKeys": "закрытые ключи",
    "accounts": "учётные записи",
    "globalFilters": "глобальные фильтры",
    "contacts": "контакты",
    "calendars": "календари",
    "filters": "фильтры"
  },
  "trackColumns": {
    "event": "Событие",
    "fromAddress": "Адрес отправителя",
    "sentTime": "Время отправки",
    "spamScore": "Оценка спама",
    "recipient": "Получатель",
    "domain": "Домен",
    "queueId": "ID",
    "result": "Результат",
    "actions": "Действия"
  }
} as const;

export default mailPart2;
