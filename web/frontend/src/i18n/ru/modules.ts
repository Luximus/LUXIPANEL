const modules = {
  "pageTitle": "Модули",
  "header": {
    "heading": "Модули и интеграции",
    "subheading": "Включайте или скрывайте предустановленные модули, отображаемые в боковом меню"
  },
  "search": {
    "placeholder": "Поиск модуля..."
  },
  "tabs": {
    "all": "Все",
    "modules": "Модули",
    "integrations": "Интеграции",
    "visible": "Видимые"
  },
  "stats": {
    "visible": "Видимые:",
    "hidden": "Скрытые:",
    "systemNote": "Системные модули остаются предустановленными"
  },
  "categories": {
    "label": "Категории",
    "all": "Все",
    "communication": "Коммуникация",
    "infrastructure": "Инфраструктура",
    "security": "Безопасность",
    "developer": "Разработчик"
  },
  "statusFilter": {
    "label": "Статус",
    "all": "Все",
    "visible": "Видимые",
    "hidden": "Скрытые"
  },
  "empty": {
    "title": "Модули не найдены",
    "subtitle": "Попробуйте другой поисковый запрос или категорию"
  },
  "errors": {
    "loadTitle": "Ошибка загрузки модулей",
    "loadSubtitle": "Не удалось получить список модулей"
  },
  "labels": {
    "metaVersion": "Версия",
    "metaInstalls": "Установки",
    "metaRating": "Рейтинг",
    "metaAuthor": "Автор",
    "metaCreatedAt": "Дата создания",
    "metaUpdatedAt": "Последнее обновление",
    "kindIntegration": "ИНТЕГРАЦИЯ",
    "kindModule": "МОДУЛЬ",
    "tagFree": "Бесплатно",
    "tagLicense": "Требуется лицензия",
    "statusVisible": "Отображается в меню",
    "statusHidden": "Скрыт",
    "dragHandle": "Перетащить для сортировки",
    "menuToggle": "Показывать в боковом меню",
    "moduleToggle": "Включить модуль",
    "fabToggle": "Показывать плавающую кнопку"
  },
  "toasts": {
    "moduleVisible": "{name} отображается",
    "moduleHidden": "{name} скрыт",
    "moduleVisibleWithDeps": "{name} отображается (также активировано: {deps})",
    "moduleHiddenWithDeps": "{name} скрыт (также активировано: {deps})",
    "moduleUpdateError": "Не удалось обновить {name}",
    "sidebarShown": "{name} отображается в меню",
    "sidebarHidden": "{name} скрыто из меню",
    "fabShown": "{name}: плавающая кнопка включена",
    "fabHidden": "{name}: плавающая кнопка отключена",
    "orderSaved": "Порядок сохранён",
    "orderError": "Не удалось сохранить порядок",
    "orderHttpError": "Не удалось сохранить порядок ({status})"
  }
} as const;

export default modules;
