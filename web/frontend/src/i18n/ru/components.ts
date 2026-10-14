const components = {
  "setupWizardFooter": {
    "rights": "Все права защищены.",
    "madeBy": "Сделано LUXISOFT",
    "termsAndConditions": "Условия использования",
    "privacyPolicy": "Политика конфиденциальности",
    "documentation": "Документация",
    "refundPolicy": "Политика возврата средств"
  },
  "dataTable": {
    "boolTrue": "Да",
    "boolFalse": "Нет",
    "selectPage": "Выбрать страницу",
    "selectRow": "Выбрать строку",
    "actions": "Действия",
    "configure": "Настроить таблицу",
    "empty": "Нет результатов для {title}.",
    "total": "Всего",
    "selectedSummary": "Выбрано {selected} • показано {shown} из {pageSize} результатов, всего результатов: {total}",
    "summary": "показано {shown} из {pageSize} результатов, всего результатов: {total}",
    "prev": "Назад",
    "next": "Далее",
    "pageOf": "Страница {currentPage} из {totalPages}",
    "configureTitle": "Настроить таблицу",
    "columnsAndOrder": "Видимые столбцы и порядок",
    "resultsPerPage": "Результатов на странице",
    "moveUp": "Переместить {col} вверх",
    "moveDown": "Переместить {col} вниз",
    "defaultTitle": "таблица",
    "dragHandle": "Перетащите для изменения порядка",
    "moveUpAria": "Переместить {col} вверх",
    "moveDownAria": "Переместить {col} вниз",
    "emptyCell": "-"
  },
  "confirmModal": {
    "title": "Подтвердить",
    "cancel": "Отмена",
    "confirm": "Подтвердить",
    "alertTitle": "Уведомление",
    "alertOk": "Понятно",
    "promptTitle": "Введите значение",
    "promptCancel": "Отмена",
    "promptOk": "ОК"
  },
  "modalNavbar": {
    "back": "Назад",
    "close": "Закрыть"
  },
  "viewSettingsModal": {
    "buttonLabel": "Настройки",
    "description": "Настройки, специфичные для этого модуля",
    "close": "Закрыть"
  },
  "floatingTerminal": {
    "newSnippet": "Новый сниппет",
    "close": "Закрыть",
    "name": "Имя",
    "namePlaceholder": "напр. Перезапустить Postfix",
    "category": "Категория",
    "tags": "Теги",
    "tagsHelp": "Теги зависят от выбранной категории",
    "command": "Команда",
    "monacoHelp": "Monaco для синтаксиса shell. Используйте Ctrl+Enter для сохранения из редактора.",
    "cancel": "Отмена",
    "save": "Сохранить"
  },
  "installModal": {
    "running": "Установка… может занять несколько минут.",
    "success": "Установка завершена.",
    "failed": "Установка не удалась. Проверьте журнал."
  },
  "enterPage": {
    "pageTitle": "Войти с кодом",
    "heading": "Войти с кодом доступа",
    "subtitle": "Введите полученный код для входа в панель.",
    "codeLabel": "Код доступа",
    "codePlaceholder": "напр. a1b2c3d4e5f6g7",
    "continue": "Продолжить",
    "useAnotherCode": "Использовать другой код",
    "codeShort": "Код",
    "terminalAi": "Терминал / ИИ",
    "enter": "Войти",
    "willBeRedirected": "Вы будете перенаправлены на страницу входа в панель.",
    "featuresAvailable": "Доступно",
    "featuresUnavailable": "Недоступно",
    "invalidCode": "Недействительный код доступа.",
    "verifyError": "Не удалось проверить код. Попробуйте ещё раз.",
    "networkError": "Ошибка сети. Попробуйте ещё раз.",
    "guestSessionError": "Не удалось начать гостевой сеанс."
  },
  "dragHandle": "Перетащите для изменения порядка",
  "logoAlt": "LUXIPANEL",
  "default": " (по умолчанию)",
  "emptyCell": "-",
  "loginEffects": {
    "defaultSuffix": " (по умолчанию)",
    "webGpuHint": "Требуется WebGPU. Без поддержки появится фон по умолчанию."
  },
  "tableSettings": {
    "pagination": "Разбиение на страницы",
    "rowsPerPage": "Строк на странице в этой таблице.",
    "visibleActions": "Отображаемые действия",
    "actionsHint": "Выберите действия для меню «···» в каждой строке."
  }
} as const;

export default components;
