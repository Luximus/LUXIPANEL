const backups = {
  "pageTitle": "Резервные копии",
  "settings": {
    "title": "Настройки резервного копирования",
    "description": "Место хранения и настройки для подключённого сервера.",
    "sections": "Разделы настроек",
    "localHelp": "Здесь хранятся локальные резервные копии этого сервера.",
    "changeDirWarning": "При смене папки прежние локальные резервные копии будут удалены после подтверждения.",
    "retentionHelp": "Для ручных копий и новых расписаний. Существующие расписания сохраняют собственный лимит.",
    "save": "Сохранить изменения",
    "lastSuccess": "Последняя успешная резервная копия",
    "localCopies": "Локальные резервные копии",
    "activeSchedules": "Активные расписания",
    "advancedCron": "Собственное выражение Cron",
    "loading": "Загрузка настроек…",
    "loadError": "Не удалось загрузить настройки этого сервера.",
    "pending": "Несохранённые изменения.",
    "countError": "Выберите от 1 до 365 резервных копий.",
    "saving": "Сохранение…",
    "saved": "Настройки сохранены.",
    "previewError": "Не удалось проверить папку.",
    "destinationNotEmpty": "В новой папке уже есть резервные копии LUXIPANEL.",
    "changeConfirm": "Будут удалены {count} локальных копий в {path}. Копии S3/R2 сохранятся. Сменить папку?",
    "changeTitle": "Сменить папку резервных копий",
    "changeError": "Не удалось сменить папку.",
    "tables": "Таблицы",
    "localHeading": "Локальное хранилище",
    "overview": "Состояние копий",
    "targetChanged": "Сервер изменился; проверьте его настройки ещё раз."
  },
  "status": {
    "completed": "Завершено",
    "failed": "Ошибка",
    "running": "Выполняется"
  },
  "header": {
    "heading": "Резервные копии",
    "subheading": "Защитите файлы, базы данных, почту и настройки сервера.",
    "btnBackupNow": "Создать копию сейчас"
  },
  "configCard": {
    "title": "Настройки резервного копирования",
    "subtitle": "Локальный каталог и удалённое хранилище.",
    "labelLocalDir": "Локальный каталог резервных копий",
    "placeholderLocalDir": "/var/backups/luxipanel",
    "labelRetentionDefault": "Локальных копий по умолчанию",
    "s3Section": "S3 / Cloudflare R2",
    "labelEndpoint": "Endpoint",
    "labelBucket": "Bucket",
    "labelAccessKeyId": "Идентификатор ключа доступа",
    "labelSecretAccessKey": "Секретный ключ доступа",
    "btnBrowse": "Обзор",
    "tabLocal": "Локально",
    "tabCloud": "Облако"
  },
  "pathBrowserDialog": {
    "title": "Выбрать папку",
    "btnUp": "Вверх",
    "btnCancel": "Отмена",
    "btnSelect": "Использовать эту папку"
  },
  "backupSources": {
    "title": "Что резервировать",
    "scopeFull": "Весь сервер (отобранное)",
    "scopeFullHint": "Базы данных, почта, конфигурация панели и /etc /home /var/www /root",
    "scopeCustom": "Выборочно",
    "labelDatabases": "Базы данных",
    "dbAll": "Все",
    "dbPick": "Выбрать…",
    "dbChoose": "Выбрать базы данных",
    "dbNone": "Ничего не выбрано",
    "labelMail": "Почта (vmail + Postfix/Dovecot)",
    "labelPanelConfig": "Конфигурация панели",
    "foldersTitle": "Папки",
    "addFolder": "Добавить папку",
    "noFolders": "Папки не выбраны"
  },
  "dbPickerDialog": {
    "title": "Выбрать базы данных",
    "loading": "Загрузка…",
    "btnCancel": "Отмена",
    "btnSelect": "Применить выбор",
    "btnRetry": "Повторить",
    "unavailableSelection": "Одна из выбранных баз данных больше недоступна. Проверьте выбор."
  },
  "storagesSection": {
    "subtitle": "Облачные хранилища для резервных копий (S3 / Cloudflare R2).",
    "tableTitle": "хранилища",
    "btnNew": "Новое хранилище"
  },
  "storageDialog": {
    "titleNew": "Новое облачное хранилище",
    "titleEdit": "Редактировать облачное хранилище",
    "labelName": "Название",
    "placeholderName": "Мой bucket R2",
    "labelProvider": "Провайдер",
    "optS3": "Amazon S3",
    "optR2": "Cloudflare R2",
    "labelBucket": "Bucket",
    "labelPrefix": "Префикс (папка)",
    "placeholderPrefix": "backups/",
    "labelEndpoint": "Endpoint",
    "labelRegion": "Регион",
    "labelAccessKey": "Идентификатор ключа доступа",
    "labelSecret": "Секретный ключ доступа",
    "secretKeepHint": "Оставьте пустым, чтобы сохранить текущий секрет.",
    "btnCancel": "Отмена",
    "btnSave": "Сохранить",
    "usingCentralCred": "Используется центральный ключ из Настройки → Учётные данные (укажите только bucket).",
    "credRequired": "Учётные данные {provider} не настроены. Добавьте их в Настройки → Учётные данные, чтобы использовать этот источник.",
    "credRequiredCta": "Перейти в Настройки → Учётные данные"
  },
  "progress": {
    "creating": "Создаётся резервная копия… Это может занять несколько минут."
  },
  "historySection": {
    "title": "История резервных копий",
    "tableTitle": "резервные копии",
    "count": "{count} копий",
    "countPartial": "Показано {shown} из {total} копий"
  },
  "schedulesSection": {
    "title": "Расписания",
    "btnNew": "Новое",
    "loading": "Загрузка...",
    "active": "Активна",
    "paused": "Приостановлена",
    "copies": "копий",
    "pause": "Приостановить",
    "enable": "Включить",
    "edit": "Изменить",
    "delete": "Удалить"
  },
  "backupDialog": {
    "title": "Создать резервную копию вручную",
    "labelName": "Метка",
    "placeholderName": "pre-upgrade",
    "labelStorage": "Хранилище",
    "optionLocal": "Локально",
    "optionS3": "AWS S3",
    "optionR2": "Cloudflare R2",
    "labelIncludeDb": "Включить дамп PostgreSQL",
    "sourcesTitle": "Что резервировать",
    "labelIncludeDatabases": "Базы данных (MySQL/MariaDB + PostgreSQL)",
    "labelIncludeMail": "Почтовые аккаунты (ящики + конфигурация)",
    "labelIncludePanelConfig": "Конфигурация LuxiPanel",
    "btnCancel": "Отмена",
    "btnStart": "Запустить резервное копирование"
  },
  "scheduleDialog": {
    "title": "Запланировать резервное копирование",
    "labelName": "Название",
    "placeholderName": "Еженедельная копия",
    "labelSchedule": "Расписание (cron)",
    "placeholderSchedule": "0 3 * * 0",
    "labelStorage": "Хранилище",
    "optionLocal": "Локально",
    "optionS3": "S3",
    "optionR2": "R2",
    "labelRetention": "Локальных копий для хранения",
    "labelFrequency": "Частота",
    "optHourly": "Каждый час",
    "optDaily": "Ежедневно",
    "optWeekly": "Еженедельно",
    "optMonthly": "Ежемесячно",
    "labelTime": "Время",
    "labelWeekday": "День недели",
    "labelMonthday": "День месяца",
    "cronPreview": "Эквивалентно",
    "cronExample": "0 3 * * *",
    "weekdays": [
      "Воскресенье",
      "Понедельник",
      "Вторник",
      "Среда",
      "Четверг",
      "Пятница",
      "Суббота"
    ],
    "btnCancel": "Отмена",
    "btnSave": "Сохранить",
    "localRetentionHint": "Последние локальные резервные копии этого расписания будут сохранены.",
    "cloudRetentionHint": "Настройте срок хранения S3/R2 у облачного провайдера.",
    "editTitle": "Изменить расписание"
  },
  "toasts": {
    "errorSaveSettings": "Ошибка сохранения настроек резервных копий",
    "preparingDownload": "Подготовка загрузки…",
    "backupDeleted": "Резервная копия удалена",
    "backupsDeleted": "Резервные копии удалены",
    "scheduleDeleted": "Расписание удалено",
    "errorDelete": "Ошибка удаления",
    "errorCreateBackup": "Ошибка создания резервной копии",
    "backupStarted": "Резервное копирование запущено",
    "backupCompleted": "Резервное копирование завершено",
    "backupStillRunning": "Резервное копирование ещё выполняется…",
    "scheduleCreated": "Расписание создано",
    "errorCreateSchedule": "Ошибка создания расписания",
    "storageDeleted": "Хранилище удалено",
    "storageUpdated": "Хранилище обновлено",
    "storageCreated": "Хранилище создано",
    "errorSaveStorage": "Ошибка сохранения хранилища",
    "recordRemoved": "Запись удалена из истории"
  },
  "errors": {
    "listPathFailed": "Не удалось получить список по этому пути (права доступа?).",
    "listDbFailed": "Не удалось получить список баз данных.",
    "downloadFailed": "Не удалось скачать резервную копию",
    "backupErrorDetail": "Ошибка: {error}"
  },
  "empty": {
    "noSubfolders": "(нет подпапок)",
    "noDbEngines": "Активных СУБД не обнаружено.",
    "noDatabases": "(нет баз данных)",
    "noneSelected": "Ничего не выбрано",
    "noSchedules": "Нет расписаний"
  },
  "labels": {
    "loading": "Загрузка…",
    "fullServer": "весь сервер",
    "editStorage": "Изменить хранилище",
    "newStorage": "Новое хранилище"
  },
  "confirm": {
    "deleteBackup": "Удалить резервную копию \"{label}\"?",
    "deleteBackupTitle": "Удалить резервную копию",
    "deleteBulkBackup": "Удалить {count} выбранных резервных копий?",
    "deleteBulkBackupTitle": "Удалить резервные копии",
    "deleteSchedule": "Удалить это расписание?",
    "deleteScheduleTitle": "Удалить расписание",
    "deleteStorage": "Удалить хранилище \"{name}\"?",
    "deleteStorageTitle": "Удалить хранилище",
    "removeRecord": "Удалить «{label}» из истории? Объект в облаке останется.",
    "removeRecordTitle": "Удалить запись",
    "cloudBulkNote": "Объекты S3/R2 останутся."
  },
  "table": {
    "columns": {
      "label": "Метка",
      "status": "Состояние",
      "size": "Размер",
      "storage": "Хранилище",
      "fecha": "Дата"
    },
    "storagesColumns": {
      "name": "Название",
      "provider": "Провайдер",
      "bucket": "Bucket",
      "endpoint": "Endpoint"
    },
    "filters": {
      "searchBackupLabel": "Поиск метки...",
      "filterBackupStorage": "Хранилище",
      "searchStorageName": "Поиск имени...",
      "filterStorageProvider": "Провайдер"
    },
    "rowActions": {
      "download": "Скачать",
      "removeRecord": "Удалить из истории",
      "details": "Посмотреть ошибку",
      "delete": "Удалить",
      "refresh": "Обновить статус"
    },
    "quickActions": {
      "deleteSelected": "Удалить выбранные"
    },
    "storagesRowActions": {
      "edit": "Редактировать",
      "delete": "Удалить"
    }
  }
} as const;

export default backups;
