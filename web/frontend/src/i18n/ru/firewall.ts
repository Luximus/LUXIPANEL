const firewall = {
  "pageTitle": "Firewall",
  "installWarning": {
    "title": "Компоненты firewall не обнаружены",
    "description": "Будет запущен менеджер пакетов (apt/dnf/apk/...) с настройками по умолчанию, а сервисы будут включены после завершения.",
    "btnInstall": "Установить сейчас"
  },
  "statusCard": {
    "label": "Состояние Firewall (UFW)",
    "verifying": "Проверка...",
    "btnDisable": "Отключить",
    "btnEnable": "Включить"
  },
  "securityAudit": {
    "title": "Аудит безопасности (Premium)",
    "btnStartAudit": "Начать анализ",
    "scannerChecking": "проверка…",
    "btnInstallScanner": "Установить",
    "scanProgress": "Прогресс сканирования",
    "scanAi": "Анализ ИИ: 0%",
    "noReports": "Нет завершённых аудитов. Запустите новый, чтобы начать."
  },
  "ufwRules": {
    "title": "Правила UFW",
    "btnNewRule": "Новое правило",
    "loading": "Загрузка правил...",
    "btnAllowCloudflare": "Разрешить Cloudflare",
    "searchLabel": "Поиск правила",
    "searchPlaceholder": "Поиск порта, IP или комментария…"
  },
  "fail2ban": {
    "btnBanIp": "Заблокировать IP",
    "loading": "Загрузка jail-ов..."
  },
  "ruleDialog": {
    "title": "Новое правило UFW",
    "labelAction": "Действие",
    "optionAllow": "Разрешить",
    "optionDeny": "Запретить",
    "optionReject": "Отклонить",
    "labelProtocol": "Протокол",
    "optionAny": "Любой",
    "labelPort": "Порт",
    "placeholderPort": "25 или 8080:8090",
    "labelFromIp": "С IP",
    "placeholderFromIp": "any или 192.168.0.0/24",
    "labelComment": "Комментарий (необязательно)",
    "placeholderComment": "Входящий SMTP",
    "btnCancel": "Отмена",
    "btnAdd": "Добавить правило"
  },
  "banDialog": {
    "title": "Заблокировать IP вручную",
    "labelIp": "IP-адрес",
    "placeholderIp": "192.168.1.100",
    "labelJail": "Группа блокировки Fail2ban",
    "btnCancel": "Отмена",
    "btnBan": "Заблокировать"
  },
  "auditReportDialog": {
    "title": "Отчёт аудита безопасности",
    "btnClose": "Закрыть"
  },
  "aiAssistant": {
    "btnSuggestRules": "Предложить правила (ИИ)",
    "btnSuggestBans": "Предложить блокировки (ИИ)",
    "btnAnalyze": "ИИ-анализ",
    "promptUfw": "Проанализируй UFW-файрвол подключённого сервера: проверь его состояние и текущие правила (используй инструмент firewall.ufw_status) и предложи разумные правила UFW для повышения безопасности без нарушения работающих сервисов. Для каждого предложенного правила объясни почему и приложи точную команду `ufw` для его применения.",
    "promptFail2ban": "Проанализируй Fail2ban на подключённом сервере: проверь настроенные jail-списки и заблокированные IP (используй инструмент firewall.fail2ban_status) и предложи блокировки и улучшения конфигурации для защиты от атак перебором. Укажи jail, IP/диапазон и причину, а также команды для их применения.",
    "promptAnalyze": "Выполни общий анализ безопасности файрвола на подключённом сервере. Проверь состояние UFW и Fail2ban (используй инструменты firewall.ufw_status и firewall.fail2ban_status), выяви риски, открытые порты и слабые конфигурации и предоставь приоритизированные рекомендации с командами для их применения.",
    "analyzeRule": "Анализ с ИИ",
    "promptRule": "Проанализируй это существующее правило UFW на подключённом сервере. Объясни, какой трафик оно разрешает или блокирует, оцени риски и порекомендуй — оставить, скорректировать или заменить. Если предлагаешь изменения, приложи точные команды.\n\nПравило #{number}\nДействие: {action}\nНазначение/порт: {to}\nИсточник: {from}\nПротокол: {proto}\nКомментарий: {comment}"
  },
  "labels": {
    "active": "Активен",
    "inactive": "Неактивен",
    "bannedCount": "{count} заблокировано",
    "moreIps": "+{n} ещё",
    "installingText": "Установка UFW и Fail2ban… это может занять несколько минут.",
    "installSuccessText": "Фаервол успешно установлен.",
    "cfEdgeBlockQuestion": "Заблокировать {ip} также на уровне Cloudflare?",
    "findingsCount": "Найдено {n} результатов",
    "completedAt": "Завершено за {time}",
    "scanAiProgress": "Анализ ИИ: {pct}%",
    "overallRisk": "Общий риск",
    "unknown": "НЕИЗВЕСТНО",
    "keyThreats": "Ключевые угрозы",
    "recommendations": "Рекомендации",
    "findingsTitle": "Результаты ({n})",
    "moreFindingsCount": "+{n} ещё",
    "from": "от",
    "any": "любой",
    "scanBitNinjaProgress": "BitNinja: {pct}%",
    "scanLynisProgress": "Lynis: {pct}%",
    "scanRkhunterProgress": "Rkhunter: {pct}%",
    "scanChkrootkitProgress": "Chkrootkit: {pct}%"
  },
  "empty": {
    "noRules": "Нет правил",
    "noJails": "Нет активных jail"
  },
  "actions": {
    "unban": "Разбанить",
    "blockInCloudflare": "Заблокировать в Cloudflare",
    "dismiss": "Закрыть"
  },
  "confirm": {
    "deleteRuleMsg": "Удалить правило #{number}?",
    "deleteRuleTitle": "Удалить правило",
    "disableFwMsg": "Отключить файрвол? Сервер останется без сетевой защиты.",
    "disableFwTitle": "Отключить файрвол",
    "disableFwBtn": "Да, отключить",
    "cfAllowMsg": "Будут добавлены правила UFW для разрешения 80/443 с официальных диапазонов Cloudflare. Продолжить?",
    "cfAllowTitle": "Разрешить IP Cloudflare",
    "cfAllowBtn": "Продолжить"
  },
  "toasts": {
    "ruleDeleted": "Правило удалено",
    "errorDelete": "Ошибка удаления",
    "ipUnbanned": "{ip} разбанен",
    "errorUnban": "Ошибка разбана",
    "fwEnabled": "Файрвол включён",
    "errorEnable": "Ошибка включения",
    "fwDisabled": "Файрвол отключён",
    "errorDisable": "Ошибка отключения",
    "fwInstalled": "Файрвол установлен",
    "ruleAdded": "Правило добавлено",
    "ipBanned": "{ip} заблокирован в {jail}",
    "errorBan": "Ошибка блокировки",
    "cfRulesApplied": "Правила Cloudflare применены ({applied})",
    "errorCfRules": "Ошибка применения правил Cloudflare",
    "errorStartAudit": "Ошибка запуска аудита",
    "auditCompleted": "Аудит завершён",
    "auditFailed": "Аудит не выполнен",
    "errorLoadReport": "Ошибка загрузки отчёта",
    "reportOf": "Отчёт от {date}"
  },
  "errors": {
    "addRule": "Ошибка добавления правила"
  },
  "runtime": {
    "statusError": "Не удалось проверить состояние",
    "rulesLoadError": "Не удалось загрузить правила.",
    "noMatchingRules": "Нет правил, соответствующих фильтру.",
    "loggingSaved": "Уровень журналирования сохранён.",
    "loggingSaveError": "Не удалось сохранить уровень журналирования."
  },
  "settingsUi": {
    "rulesView": "Просмотр правил",
    "ufwLog": "Журнал UFW",
    "related": "Связанные",
    "title": "Настройки брандмауэра",
    "description": "Личные фильтры и журнал UFW активного сервера.",
    "sectionsLabel": "Разделы настроек брандмауэра",
    "showActions": "Показать действия",
    "all": "Все",
    "limit": "Ограничить",
    "serverSettingHint": "Этот параметр меняет конфигурацию активного сервера.",
    "logLevel": "Уровень журналирования",
    "off": "Выключено",
    "low": "Низкий",
    "medium": "Средний",
    "high": "Высокий",
    "full": "Полный",
    "saveLevel": "Сохранить уровень",
    "relatedModules": "Связанные модули"
  }
} as const;

export default firewall;
