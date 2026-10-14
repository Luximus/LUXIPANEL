const settings = {
  "passkeyName": {
    "title": "Название ключа доступа",
    "hint": "Укажите название, по которому легко узнать устройство.",
    "placeholder": "Например, личный ноутбук",
    "save": "Сохранить название",
    "edit": "Изменить название",
    "invalid": "Введите название длиной от 1 до 128 символов.",
    "saved": "Название обновлено",
    "error": "Не удалось сохранить название.",
    "cancel": "Отмена"
},
  "placeholders": {
    "logoUrl": "https://example.com/logo.png",
    "imageUrl": "https://…/image.jpg"
  },
  "pageTitle": "Настройки",
  "loadFailure": {
    "title": "Не удалось загрузить настройки",
    "sessionMessage": "Не удалось загрузить настройки: сессия с сервером недоступна. Выберите сервер заново в селекторе или выйдите и войдите снова.",
    "genericMessage": "Не удалось загрузить настройки. Проверьте подключение и повторите попытку.",
    "retry": "Повторить"
  },
  "header": {
    "title": "Настройки панели",
    "subtitle": "Глобальные настройки LuxiPanel",
    "autosave": "Автосохранение"
  },
  "tabs": {
    "general": "Общие",
    "layoutUi": "Интерфейс / Layout",
    "security": "Безопасность",
    "modules": "Модули",
    "system": "Система",
    "credentials": "Учётные данные"
  },
  "credentials": {
    "hcaptcha": {
      "title": "hCaptcha",
      "desc": "Защитите вход в панель проверкой hCaptcha. Введите ключи из вашей панели hCaptcha.",
      "sitekeyLabel": "Site key",
      "sitekeyPlaceholder": "Ваш site key hCaptcha",
      "secretLabel": "Secret key",
      "secretPlaceholder": "Введите новый secret key",
      "secretConfigured": "Secret key уже задан. Оставьте поле пустым, чтобы сохранить его.",
      "statusConfigured": "Настроено",
      "statusMissing": "Не настроено",
      "saved": "Настройки hCaptcha сохранены"
    },
    "tolqia": {
      "label": "Tolqia",
      "help": "API-токен вашей учётной записи Tolqia (тариф Plus или Premium) — включает звонки с переводом для пользователей этого сервера",
      "guide": {
        "steps": [
          "Откройте tolqia.com и войдите в свою учётную запись (тариф Plus или Premium).",
          "Перейдите в «Настройки» › «API» и создайте новый токен.",
          "Скопируйте токен (начинается с tq_live_) и вставьте его в «Настроить»."
        ],
        "docUrl": "https://tolqia.com/settings/api",
        "docLabel": "Создать токен на tolqia.com → Настройки › API",
        "docUrl2": "https://tolqia.com/docs",
        "docLabel2": "Документация"
      }
    },
    "elevenlabs": {
      "label": "ElevenLabs",
      "help": "Используется для перевода аудиозвонков в реальном времени",
      "voiceIdLabel": "Voice ID по умолчанию",
      "voiceIdPlaceholder": "напр. 21m00Tcm4TlvDq8ikWAM",
      "guide": {
        "steps": [
          "Откройте elevenlabs.io и войдите в аккаунт.",
          "Перейдите в «My Account» → «API Keys» и создайте новый ключ.",
          "Скопируйте ключ (начинается с sk_) и вставьте его во вкладке «Настроить»."
        ],
        "docUrl": "https://elevenlabs.io/app/settings/api-keys",
        "docLabel": "API-ключи ElevenLabs"
      }
    },
    "title": "Учётные данные модулей",
    "subtitle": "Управляйте маркерами доступа и ключами API, которые необходимы модулям для работы.",
    "empty": "На этом сервере не включены модули, требующие учётных данных.",
    "statusSet": "Настроено",
    "statusMissing": "Не настроено",
    "tokenLabel": "Маркер доступа / Ключ API",
    "tokenPlaceholder": "Вставьте маркер…",
    "save": "Сохранить",
    "test": "Тест",
    "clear": "Удалить",
    "manage": "Управлять",
    "show": "Показать",
    "hide": "Скрыть",
    "saved": "Учётные данные сохранены",
    "cleared": "Учётные данные удалены",
    "testOk": "Соединение действительно",
    "testFail": "Не удалось проверить учётные данные",
    "confirmClear": "Удалить эти учётные данные?",
    "confirmClearTitle": "Удалить учётные данные",
    "error": "Произошла ошибка",
    "getDoc": "Получить маркер",
    "managedLabel": {
      "assistant": "ИИ-агенты"
    },
    "managedHint": {
      "assistant": "Ключи API поставщика помощника управляются в его панели.",
      "backups": "Ключи хранилища (S3 / R2) управляются в модуле резервного копирования."
    },
    "managedSummary": {
      "assistant": "Поставщики ИИ (Claude, OpenAI, Gemini, …)",
      "backups": "Учётные данные хранилища S3 / R2"
    },
    "storage": {
      "accountId": "ID учётной записи (Cloudflare)",
      "accessKeyId": "Идентификатор ключа доступа",
      "secret": "Секретный ключ доступа",
      "endpoint": "Endpoint (необязательно)",
      "region": "Регион (необязательно)",
      "r2Hint": "Учётные данные R2 уровня учётной записи используются резервным копированием: установите ключи один раз здесь и просто выберите бакет в резервном копировании.",
      "s3Hint": "Учётные данные S3, используемые резервным копированием: установите ключи один раз здесь и просто выберите бакет в резервном копировании."
    },
    "connector": {
      "connect": "Сохранить и подключиться",
      "disconnect": "Отключиться",
      "connected": "Подключено",
      "configured": "Настроено",
      "notConnected": "Не подключено",
      "unavailable": "Требуется включение модуля ИИ-агенты",
      "setupGuide": "Руководство по настройке"
    },
    "help": {
      "tabConfig": "Настройка",
      "tabHelp": "Помощь",
      "openLink": "Открыть ссылку",
      "guides": {
        "cloudflare": {
          "steps": [
            "Перейдите на dash.cloudflare.com → «Мой профиль» → «API-токены».",
            "Нажмите «Создать токен»: используйте шаблон «Редактировать зону DNS» или создайте собственный с нужными разрешениями (Зона:Чтение, DNS:Редактирование и т. д.).",
            "Выберите зоны, к которым будет предоставлен доступ, и создайте токен.",
            "Скопируйте токен (отображается только один раз) и вставьте его на вкладке «Настройка»."
          ],
          "docUrl": "https://dash.cloudflare.com/profile/api-tokens",
          "docLabel": "API токены Cloudflare"
        },
        "expo": {
          "steps": [
            "Перейдите на expo.dev, войдите → «Account settings» → «Access tokens».",
            "Нажмите «Create token», задайте имя и скопируйте сгенерированное значение.",
            "Вставьте его на вкладке «Настройка»."
          ],
          "docUrl": "https://expo.dev/settings/access-tokens",
          "docLabel": "Токены доступа Expo"
        },
        "openclaw": {
          "steps": [
            "Перейдите на openclaw.ai и войдите в систему.",
            "Сгенерируйте или скопируйте API key из панели OpenClaw.",
            "Вставьте его в поле «Настройка» (при необходимости скорректируйте endpoint и модель по умолчанию)."
          ],
          "docUrl": "https://openclaw.ai",
          "docLabel": "OpenClaw"
        },
        "repository-store": {
          "steps": [
            "Перейдите на github.com → «Settings» → «Developer settings» → «Personal access tokens».",
            "Сгенерируйте токен (classic или fine-grained) с правом чтения репозиториев (public_repo или Contents: Read).",
            "Скопируйте токен (начинается с ghp_ или github_pat_) и вставьте его в поле «Настройка»."
          ],
          "docUrl": "https://github.com/settings/tokens",
          "docLabel": "Токены GitHub"
        },
        "bitninja": {
          "steps": [
            "Перейдите в панель BitNinja (admin.bitninja.io) и войдите в систему.",
            "Скопируйте License Key из раздела лицензий/серверов.",
            "Вставьте его в поле «Настройка»."
          ],
          "docUrl": "https://bitninja.io",
          "docLabel": "BitNinja"
        },
        "r2": {
          "steps": [
            "Перейдите на dash.cloudflare.com → «R2» → «Manage R2 API Tokens».",
            "Создайте «R2 API Token» (совместимый с S3) с правом чтения/записи объектов.",
            "Скопируйте отображаемые Access Key ID и Secret Access Key.",
            "Ваш Account ID отображается на странице R2 / в сводке аккаунта.",
            "Вставьте Account ID + Access Key ID + Secret в поле «Настройка» (endpoint определяется автоматически по Account ID)."
          ],
          "docUrl": "https://dash.cloudflare.com/?to=/:account/r2/api-tokens",
          "docLabel": "API токены R2"
        },
        "s3": {
          "steps": [
            "В консоли AWS: «IAM» → «Users» → ваш пользователь → «Security credentials» → «Create access key».",
            "Скопируйте Access Key ID и Secret Access Key.",
            "Если используете S3-совместимый сервис (Wasabi, MinIO и т. д.), запишите его Endpoint и регион.",
            "Вставьте ключи (и Endpoint/регион, если применимо) в поле «Настройка»."
          ],
          "docUrl": "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html",
          "docLabel": "Ключи доступа AWS"
        }
      }
    }
  },
  "general": {
    "hcaptchaEnabled": "Требовать hCaptcha при входе",
    "hcaptchaEnabledHint": "Показывать проверку hCaptcha в форме входа в панель.",
    "sectionTitle": "Общие",
    "labelPanelName": "Название панели",
    "labelTimezone": "Часовой пояс",
    "labelLanguage": "Язык",
    "languageOptions": {
      "en": "English",
      "es": "Español"
    },
    "labelSessionTtl": "Длительность сессии (часы)",
    "labelMaxLoginAttempts": "Неудачных попыток входа (блокировка)",
    "labelRequire2fa": "Требовать 2FA для всех пользователей",
    "btnViewLog": "Просмотреть лог",
    "labelAuditLog": "Включить журнал аудита",
    "labelSwitchNewTab": "Открывать сервер в новой вкладке при переключении"
  },
  "imageList": {
    "labelJson": "(JSON)",
    "labelUrls": "(URL изображений)",
    "addButton": "Добавить изображение"
  },
  "layout": {
    "sectionTitle": "Layout, брендинг и UI",
    "sectionSubtitle": "Настройте логотипы, радиусы, тени и базовые цвета интерфейса.",
    "branding": {
      "groupTitle": "Брендинг и логотипы",
      "groupDesc": "Единый логотип для боковой панели, входа, шапки, подвала и фавикона.",
      "labelLogoUrl": "URL логотипа",
      "logoUrlHelp": "Единый логотип для всех мест: боковая панель, вход, заголовок панели, подвал и публичные экраны.",
      "btnUpload": "Загрузить",
      "btnPick": "Выбрать",
      "btnDefault": "По умолчанию",
      "restoreLogos": "Сбросить логотипы",
      "loginLogoOpacity": "Непрозрачность контейнера логотипа (вход)",
      "loginLogoOpacityHelp": "Прозрачность фона круга логотипа на /login (0 = прозрачный, 100 = непрозрачный)."
    },
    "loginBg": {
      "groupTitle": "Фон страницы входа",
      "groupDesc": "Анимированный фон на /login и его резервный цвет.",
      "enableLabel": "Показывать анимированный фон на /login",
      "labelFallbackColor": "Цвет фона, когда отключено",
      "labelActiveEffect": "Активный эффект на /login",
      "previewTitle": "Предпросмотр входа"
    },
    "shape": {
      "groupTitle": "Форма и тени",
      "groupDesc": "Глобальный радиус, тени карточек и модальных окон.",
      "labelRadius": "Глобальный радиус",
      "radiusHelp": "Например: 0.5rem, 12px.",
      "labelShadow": "Базовая тень",
      "labelModalShadow": "Тень модального окна",
      "labelModalBackdrop": "Наложение модального окна",
      "backdropHelp": "Фон диалоговых окон.",
      "layer1": "Слой 1",
      "layer2": "Слой 2",
      "labelColor": "Цвет",
      "labelShadowSingle": "Тень"
    },
    "palettes": {
      "title": "Цветовая тема",
      "subtitle": "Выберите готовую палитру — применяется ко всей панели (светлая и тёмная).",
      "light": "Светлая тема",
      "dark": "Тёмная тема",
      "intensity": "Интенсивность"
    },
    "resetButton": "Сбросить стили по умолчанию",
    "panelBg": {
      "groupTitle": "Фон панели",
      "groupDesc": "Анимированный фон внутри панели и его резервный цвет.",
      "enableLabel": "Показывать анимированный фон в панели",
      "labelFallbackColor": "Цвет фона при отключённом эффекте",
      "labelActiveEffect": "Активный эффект панели"
    }
  },
  "security": {
    "sectionTitle": "Безопасность",
    "loginMethodsTitle": "Разрешённые методы входа",
    "loginMethodsDesc": "Хотя бы один метод должен оставаться активным. Отключённые методы не будут отображаться на экране входа.",
    "loginMethodsWarning": "Должен оставаться активным хотя бы один метод.",
    "passkey": {
      "name": "Passkey",
      "desc": "Биометрическая аутентификация / FIDO2. Пользователи должны зарегистрировать своё устройство.",
      "verifying": "Проверка...",
      "btnManage": "Управление"
    },
    "password": {
      "name": "Пароль",
      "desc": "Вход с логином и паролем. Всегда доступен без предварительной настройки.",
      "configured": "Настроен"
    },
    "recovery": {
      "name": "Восстановление",
      "desc": "Одноразовые коды в качестве экстренного резерва.",
      "verifying": "Проверка...",
      "btnManage": "Управление"
    },
    "twoFaStatus": {
      "groupTitle": "Статус 2FA для этого аккаунта",
      "badgeDisabled": "Отключено",
      "promptText": "Включите 2FA для защиты этого административного аккаунта.",
      "btnSetup": "Настроить",
      "btnDelete": "Удалить",
      "btnDisable": "Отключить"
    }
  },
  "modules": {
    "sectionTitle": "Движки кэша по модулям",
    "sectionDesc1": "Состояние и настройка планового сбора данных на сервере клиента.",
    "sectionDescBold": "Активен/Неактивен зависит от родительского модуля",
    "modulesLink": "Модули",
    "sectionDesc2": ": при отключении модуля его сбор данных останавливается; при повторном включении — возобновляется. Здесь регулируется только частота. DataTables считывают предобработанные данные из выделенного Redis на этом сервере; если он отключён или данные устарели — происходит откат к обычному JSON.",
    "loading": "Загрузка…",
    "tableHeaders": {
      "module": "Модуль / коллекция",
      "source": "Источник",
      "active": "Активен",
      "interval": "Интервал (с)",
      "lastRefresh": "Последнее обновление",
      "duration": "Длительность",
      "size": "Размер",
      "hitRatio": "Доля попаданий"
    },
    "managedInPre": " (управляется в ",
    "managedInPost": ")"
  },
  "system": {
    "factoryReset": {
      "sectionTitle": "Сброс настроек",
      "sectionSubtitle": "Восстанавливает настройки панели до заводских значений.",
      "warningTitle": "Предупреждение",
      "warningBefore": "Это действие сбрасывает ",
      "warningAllSettings": "все параметры конфигурации",
      "warningMiddle": " панели (общие, макет/интерфейс, SMTP, безопасность и настройки, сохранённые модулями) до значений по умолчанию. Пользователи и установленные модули ",
      "warningNotDeleted": "не удаляются",
      "warningAfter": ".",
      "btnReset": "Сбросить до заводских настроек"
    },
    "backupRestore": {
      "sectionTitle": "Восстановить из резервной копии",
      "sectionSubtitle": "Восстанавливает панель из предыдущей резервной копии (требуется модуль Резервных копий).",
      "loading": "Загрузка резервных копий...",
      "btnRestore": "Восстановить выбранную резервную копию"
    },
    "noBackup": {
      "title": "Восстановление из резервной копии недоступно",
      "descBefore": "Установите модуль ",
      "backupsModule": "Резервные копии",
      "descAfter": " из панели модулей, чтобы включить эту функцию."
    }
  },
  "imagePicker": {
    "title": "Выбрать изображение",
    "subtitle": "Изображения, доступные в публичной папке фронтенда.",
    "empty": "В публичной папке нет изображений.",
    "btnUpload": "Загрузить новое изображение",
    "btnCancel": "Отмена"
  },
  "smtpTest": {
    "dialogTitle": "Отправить тестовое письмо",
    "labelRecipient": "Получатель",
    "placeholderRecipient": "вы@пример.com",
    "btnCancel": "Отмена",
    "btnSend": "Отправить"
  },
  "passkeysDialog": {
    "title": "Управление Passkeys",
    "btnAdd": "Добавить passkey",
    "empty": "Нет зарегистрированных passkeys"
  },
  "recoveryDialog": {
    "title": "Коды восстановления",
    "btnGenerate": "Создать / перегенерировать",
    "loading": "Загрузка...",
    "warningText": "Сохраните эти коды в надёжном месте. Они показываются только один раз.",
    "btnCopy": "Копировать всё",
    "btnPrint": "Печать"
  },
  "setup2faDialog": {
    "title": "Настроить 2FA",
    "subtitle": "Отсканируйте этот QR-код в приложении аутентификатора.",
    "secretLabel": "Секрет (ручной ввод):",
    "copyTitle": "Копировать",
    "verifyLabel": "Введите 6-значный код:",
    "btnCancel": "Отмена",
    "btnActivate": "Включить 2FA"
  },
  "disable2faDialog": {
    "title": "Отключить 2FA?",
    "body": "2FA будет отключён, но секрет сохранится, чтобы можно было включить его снова позже.",
    "btnCancel": "Отмена",
    "btnConfirm": "Отключить 2FA"
  },
  "delete2faDialog": {
    "title": "Удалить 2FA?",
    "body": "Сохранённый секрет будет удалён, и вам придётся настроить его заново для повторного использования 2FA.",
    "btnCancel": "Отмена",
    "btnConfirm": "Удалить 2FA"
  },
  "auditLogDialog": {
    "title": "Журнал аудита",
    "empty": "Активность не зарегистрирована"
  },
  "modulesCache": {
    "agoSeconds": "{n}с назад",
    "agoMinutes": "{n}м назад",
    "agoHours": "{n}ч назад",
    "agoDays": "{n}д назад",
    "collectionSingular": "коллекция",
    "collectionPlural": "коллекций",
    "activeSingular": "активна",
    "activePlural": "активны",
    "enabledTitle": "Плановый сбор данных через диспетчер клиентского сервера",
    "badgeEnabled": "Активен",
    "disabledTitle": "Родительский модуль отключён в /panel/modules — сбор приостановлен",
    "badgeDisabled": "Неактивен",
    "buttonSave": "Сохранить",
    "saving": "Сохранение…",
    "savedStatus": "{module}/{collection} обновлён",
    "saveError": "Ошибка сохранения {module}/{collection}: {message}",
    "loadedSummary": "{count} кэшируемых коллекций в {modules} модулях. Изменения вступят в силу при следующем запуске сборщика (≤60с).",
    "loadError": "Ошибка: {message}"
  },
  "labels": {
    "auditLogin": "Вход в систему",
    "auditLoginFailed": "Неудачная попытка входа",
    "auditLogout": "Выход из системы",
    "auditPasswordChange": "Смена пароля",
    "auditPasskeyRegister": "Passkey зарегистрирован",
    "auditPasskeyDelete": "Passkey удалён",
    "auditRecoveryCodeUsed": "Использован код восстановления",
    "auditProfileUpdate": "Профиль обновлён",
    "auditSettingsUpdate": "Настройки обновлены",
    "audit2faEnabled": "2FA включён",
    "audit2faDisabled": "2FA отключён",
    "auditEventDefault": "Событие",
    "aiHintAnthropic": "Рекомендуемые модели: claude-fable-5 (новейшая), claude-sonnet-4-6 (сбалансированная), claude-opus-4-6 (наиболее мощная)",
    "aiKeyHintAnthropic": "Получите API ключ на console.anthropic.com",
    "aiHintOpenai": "gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna",
    "aiKeyHintOpenai": "Получите API ключ на platform.openai.com",
    "aiHintOllama": "Название модели, установленной в локальном Ollama. Инструменты не поддерживаются.",
    "aiKeyHintOllama": "API ключ не требуется для локального Ollama",
    "managedByLp": "Управляется через LP-LICENSE-SERVER",
    "notAvailable": "Недоступно",
    "managedExternally": "Управляется внешним сервисом",
    "twoFaManagedByLp": "Аутентификация управляется через LP-LICENSE-SERVER в этом режиме.",
    "licenseNoStatus": "Нет статуса",
    "licenseActive": "Активна",
    "licenseExpires": "истекает {date}",
    "licenseActiveDesc": "Лицензия активна",
    "licenseDegraded": "Деградирована",
    "licensePending": "Ожидает",
    "licenseDegradedDesc": "Не удалось проверить лицензию, панель работает в деградированном режиме.",
    "licenseNotActivated": "Лицензия ещё не активирована.",
    "passkeyCount": "{count} passkey(s) зарегистрировано",
    "noPasskeys": "Нет зарегистрированных passkeys",
    "recoveryCodesGenerated": "Коды восстановления сгенерированы",
    "noRecoveryCodes": "Коды не сгенерированы",
    "passkeyRegistered": "Зарегистрирован {date}",
    "recoveryCodesActive": "У вас есть активные коды восстановления.",
    "recoveryCodesNone": "У вас нет активных кодов восстановления.",
    "recoveryCodesDisplayed": "{count} кодов сгенерировано. Сохраните их в надёжном месте.",
    "twoFaEnabled": "Включён",
    "twoFaEnabledDesc": "Этот 2FA будет запрошен при следующем входе. Вы можете отключить его без удаления секрета.",
    "twoFaDisabled": "Отключён",
    "twoFaDisabledDesc": "Секрет сохранён, но не будет запрашиваться при входе, пока вы снова не активируете его.",
    "twoFaSetupPrompt": "Активируйте 2FA для защиты этой административной учётной записи.",
    "printRecoveryCodesTitle": "Коды восстановления — LUXIPANEL",
    "printRecoveryCodesDesc": "Храните эти коды в надёжном месте. Каждый можно использовать только один раз."
  },
  "toasts": {
    "errorSaving": "Ошибка сохранения настроек",
    "errorSavingAppearance": "Не удалось сохранить оформление на сервере лицензий. Попробуйте снова через несколько секунд.",
    "licenseKeyAndRefRequired": "Введите ключ и ссылку на платёж",
    "licenseActivated": "Лицензия успешно активирована",
    "licenseActivateError": "Не удалось активировать лицензию",
    "timezoneApplyError": "Не удалось применить часовой пояс к системе",
    "timezoneSavedNotApplied": "Часовой пояс сохранён в панели, но не удалось применить его к системе (проверьте права sudo).",
    "passkeysInLp": "Passkeys управляются в LP-LICENSE-SERVER",
    "passkeyDeleted": "Passkey удалён",
    "passkeyDeleteError": "Ошибка удаления passkey",
    "passkeyBrowserUnsupported": "Ваш браузер не поддерживает Passkey",
    "passkeyRegisterInitError": "Не удалось начать регистрацию",
    "passkeyRegisterCancelled": "Регистрация отменена",
    "passkeyRegisterFinishError": "Ошибка завершения регистрации",
    "passkeyRegistered": "Passkey успешно зарегистрирован",
    "passkeyRegisterUserCancelled": "Регистрация отменена пользователем",
    "passkeyRegisterError": "Ошибка регистрации passkey",
    "recoveryCodesInLp": "Коды восстановления управляются в LP-LICENSE-SERVER",
    "recoveryCodesGenerateError": "Ошибка генерации кодов",
    "twoFaInLp": "2FA управляется в LP-LICENSE-SERVER",
    "twoFaSetupInitError": "Ошибка инициализации настройки 2FA",
    "twoFaQrError": "Не удалось создать QR-код",
    "twoFaActivated": "2FA успешно активирован",
    "twoFaDisabled": "2FA отключён для входа в систему",
    "twoFaDisableError": "Ошибка отключения 2FA",
    "twoFaReactivated": "2FA активирован для входа в систему",
    "twoFaActivateError": "Ошибка активации 2FA",
    "twoFaDeleted": "2FA удалён",
    "twoFaDeleteError": "Ошибка удаления 2FA",
    "backupRestoreUnavailable": "Восстановление из резервных копий пока недоступно из этой панели.",
    "imageExceeds5mb": "Изображение превышает 5 МБ",
    "uploadingImage": "Загрузка изображения...",
    "imageUploadError": "Ошибка загрузки изображения",
    "imageUploadInvalidResponse": "Некорректный ответ сервера",
    "imageUploaded": "Изображение успешно загружено",
    "logosRestored": "Логотипы восстановлены до значений по умолчанию",
    "codesCopied": "Коды скопированы",
    "secretCopied": "Секрет скопирован",
    "smtpTestSent": "Тестовое письмо отправлено на {to}",
    "smtpTestError": "Ошибка отправки",
    "layoutReset": "Стили сброшены до значений по умолчанию",
    "settingsReset": "Настройки сброшены",
    "settingsResetError": "Ошибка сброса",
    "licenseRevalidated": "Лицензия повторно проверена",
    "licenseRevalidateError": "Не удалось повторно проверить лицензию"
  },
  "actions": {
    "activating": "Активация...",
    "activateOrUpdate": "Активировать / обновить",
    "manage": "Управлять",
    "configure": "Настроить",
    "viewOrRegenerate": "Просмотр / перегенерировать",
    "generate": "Сгенерировать",
    "generating": "Генерация...",
    "generateOrRegenerate": "Сгенерировать / перегенерировать",
    "disable": "Отключить",
    "activate": "Активировать",
    "activate2fa": "Активировать 2FA",
    "continue": "Продолжить",
    "sending": "Отправка...",
    "send": "Отправить",
    "resetting": "Сброс...",
    "factoryReset": "Сброс до заводских настроек"
  },
  "errors": {
    "twoFaEnter6Digits": "Введите 6 цифр кода",
    "twoFaInvalidCode": "Неверный код"
  },
  "confirm": {
    "deletePasskeyTitle": "Удалить passkey",
    "deletePasskeyBody": "Удалить этот passkey?",
    "restoreBackupBody": "Восстановить резервную копию «{id}»?",
    "restoreBackupTitle": "Восстановить резервную копию",
    "restoreLogosBody": "Восстановить логотип до значений по умолчанию LUXIPANEL?",
    "restoreLogosTitle": "Восстановить логотипы",
    "restoreLogosConfirm": "Да, восстановить",
    "resetLayoutBody": "Сбросить стили интерфейса до значений по умолчанию LUXIPANEL? Будут потеряны логотипы, цвета, тени и пользовательские фоны.",
    "resetLayoutTitle": "Сбросить стили",
    "resetLayoutConfirm": "Да, сбросить",
    "factoryResetBody": "Вы уверены? Это сбросит все настройки панели.",
    "factoryResetTitle": "Сбросить настройки",
    "factoryResetConfirm": "Да, сбросить"
  },
  "empty": {
    "noBackups": "Резервных копий нет."
  },
  "palettes": {
    "violet": {
      "name": "Фиолетовый",
      "description": "Палитра по умолчанию LUXIPANEL."
    },
    "ocean": {
      "name": "Океан",
      "description": "Профессиональные и спокойные синие тона."
    },
    "emerald": {
      "name": "Изумруд",
      "description": "Свежие и природные зелёные тона."
    },
    "sunset": {
      "name": "Закат",
      "description": "Тёплые оранжевые и янтарные тона."
    },
    "rose": {
      "name": "Роза",
      "description": "Яркие розовые и пурпурные тона."
    },
    "indigo": {
      "name": "Индиго",
      "description": "Элегантные и современные оттенки индиго."
    },
    "aqua": {
      "name": "Аква",
      "description": "Яркие бирюзовые и циановые тона."
    },
    "graphite": {
      "name": "Графит",
      "description": "Нейтральный монохромный и сдержанный."
    },
    "amber": {
      "name": "Янтарь",
      "description": "Тёплые золотистые и медовые тона."
    },
    "fuchsia": {
      "name": "Фуксия",
      "description": "Насыщенные маджента и пурпурные тона."
    },
    "lime": {
      "name": "Лайм",
      "description": "Энергичные лаймово-зелёные тона."
    },
    "slate": {
      "name": "Сланец",
      "description": "Профессиональный серо-синий."
    },
    "prisma": {
      "name": "Призма",
      "description": "Смешивает цвета всех палитр в непрерывный бесконечный переход.",
      "colors": "Цвета",
      "addColorButton": "Добавить цвет",
      "addColorAria": "Выбрать и добавить цвет к эффекту Призма",
      "addColorInputAria": "Цвет для добавления к эффекту Призма",
      "editColorAria": "Изменить цвет",
      "editColorInputAria": "Изменить значение цвета",
      "editColorHexAria": "Шестнадцатеричное значение цвета",
      "removeColorAria": "Удалить цвет",
      "moveUpAria": "Переместить цвет вверх",
      "moveDownAria": "Переместить цвет вниз",
      "helpText": "Изменяйте порядок списка стрелками. Каждый цвет задаёт последовательность эффекта."
    },
    "custom": {
      "name": "Пользовательский",
      "description": "Выберите базовый цвет и настройте его интенсивность.",
      "baseColor": "Базовый цвет",
      "baseColorAria": "Пользовательский базовый цвет",
      "hexAria": "Шестнадцатеричное значение пользовательского базового цвета"
    },
    "luxisoft": {
      "description": "Тёмно-синий и мятный в светлом режиме; графитовый и мятный в тёмном.",
      "name": "Luxisoft"
    }
  },
  "managers": {
    "default": "Менеджер 1"
  },
  "git": {
    "errorFallback": "Ошибка"
  }
} as const;

export default settings;
