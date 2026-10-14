const bitninja = {
  "header": {
    "description": "Комплексный агент безопасности (WAF, защита от DoS, обнаружение вредоносных программ и репутация IP) на подключённом сервере.",
    "statusChecking": "проверка…"
  },
  "sudo": {
    "label": "Пароль sudo (парольная фраза вашей сессии)",
    "placeholder": "Только если сервер запрашивает для sudo",
    "hint": "Используется только для этого действия и никогда не сохраняется в браузере."
  },
  "installCard": {
    "title": "BitNinja не установлен",
    "description": "Введите лицензионный ключ вашей учётной записи BitNinja для установки агента на этот сервер. Официальный установщик (get.bitninja.io) будет загружен и запущен с sudo.",
    "licensePlaceholder": "Лицензионный ключ (напр.: ab12cd34-…)",
    "installButton": "Установить BitNinja"
  },
  "stats": {
    "service": "Сервис",
    "license": "Лицензия",
    "version": "Версия"
  },
  "serviceControl": {
    "title": "Управление службой",
    "start": "Запустить",
    "restart": "Перезапустить",
    "stop": "Остановить"
  },
  "components": {
    "title": "Компоненты защиты",
    "checking": "проверка…",
    "noReported": "Агент не вернул данных о компонентах.",
    "active": "Активен",
    "inactive": "Неактивен"
  },
  "updateLicense": {
    "title": "Обновить license key",
    "placeholder": "Новый license key",
    "applyButton": "Применить"
  },
  "toasts": {
    "sudoRequired": "Введите пароль sudo и повторите попытку.",
    "sudoInvalid": "Неверный пароль sudo.",
    "actionFailed": "Действие не выполнено. Проверьте вывод.",
    "installing": "Установка BitNinja… это может занять несколько минут.",
    "installed": "BitNinja установлен.",
    "serviceAction": "Служба: {action} — ОК.",
    "componentToggleEnabled": "{component}: включён.",
    "componentToggleDisabled": "{component}: отключён.",
    "licenseApplied": "License key применена."
  },
  "errors": {
    "unknown": "Неизвестная ошибка"
  },
  "status": {
    "notInstalled": "Не установлен",
    "running": "Активен",
    "installedStopped": "Установлен (остановлен)",
    "serviceRunning": "Запущен",
    "serviceStopped": "Остановлен",
    "licenseValid": "Действительна",
    "licenseReview": "Проверить"
  },
  "validation": {
    "licenseKeyRequired": "Введите license key.",
    "newLicenseKeyRequired": "Введите новую license key."
  },
  "settingsUi": {
    "settingsTitle": "Настройки BitNinja",
    "settingsButton": "Настройки",
    "settingsDescription": "Параметры диагностики для активного сервера.",
    "settingsSections": "Разделы настроек BitNinja",
    "diagnostics": "Диагностика",
    "related": "Связанные",
    "logSource": "Журнал считывается из службы BitNinja на выбранном сервере.",
    "autoRefresh": "Обновлять состояние каждые 30 секунд",
    "logLines": "Строки журнала",
    "relatedModules": "Связанные модули",
    "firewallAudit": "Файрвол и аудит",
    "credentials": "Учётные данные BitNinja"
  },
  "logsUi": {
    "loading": "Загрузка журнала…",
    "empty": "Недавних событий нет.",
    "loadError": "Не удалось загрузить журнал.",
    "logsTitle": "Последний журнал",
    "logsDescription": "События службы на активном сервере.",
    "refreshLogs": "Обновить журнал",
    "logsHint": "Выберите «Обновить журнал», чтобы загрузить события."
  }
} as const;

export default bitninja;
