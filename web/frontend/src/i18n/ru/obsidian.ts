const obsidian = {
  "workspace": {
    "settingsTitle": "Настройки Obsidian",
    "settingsDescription": "Личный вид и управление vault",
    "appearance": "Внешний вид",
    "shortcuts": "Сочетания клавиш",
    "vaults": "Хранилища",
    "aiIntegration": "Интеграция ИИ",
    "personalHint": "Сохраняется для вашей учётной записи на этом сервере.",
    "defaultView": "Вид Markdown по умолчанию",
    "edit": "Редактировать",
    "preview": "Предпросмотр",
    "split": "Разделить",
    "fontSize": "Размер текста",
    "saved": "Сохранено",
    "shortcutsHint": "Сочетания клавиш для этого рабочего пространства.",
    "saveShortcut": "Сохранить заметку",
    "searchShortcut": "Перейти к поиску",
    "vaultsHint": "Зарегистрируйте vault и управляйте ими на этом сервере.",
    "aiHint": "Подготовьте файлы контекста и синхронизируйте контейнеры.",
    "today": "Заметка за сегодня",
    "quickEntry": "Быстрая запись",
    "quickEntryHint": "Добавьте текст в конец заметки за сегодня.",
    "append": "Добавить запись",
    "editorPane": "Редактор",
    "mobileView": "Вид рабочего пространства",
    "clearSearch": "Очистить",
    "askAdmin": "Попросите администратора зарегистрировать vault на этом сервере.",
    "available": "Доступно",
    "missing": "Недоступно",
    "notesCount": "заметок",
    "noVault": "Нет vault",
    "readOnly": "Только чтение",
    "entryRequired": "Сначала напишите запись.",
    "entryError": "Не удалось добавить запись.",
    "previewError": "Не удалось загрузить предпросмотр.",
    "entryAdded": "Запись добавлена."
  },
  "pageTitle": "Obsidian",
  "header": {
    "heading": "Хранилища Obsidian",
    "subheading": "Управляйте хранилищами, markdown-заметками и связями [[wikilink]] на подключённом сервере."
  },
  "toolbar": {
    "newVault": "Новое хранилище",
    "unregister": "Отвязать",
    "prepareAi": "Подготовить для ИИ-агентов",
    "searchPlaceholder": "Поиск по заметкам...",
    "syncContainers": "Синхронизировать контейнеры"
  },
  "tree": {
    "title": "Заметки",
    "newNote": "Новая заметка",
    "newFolder": "Новая папка"
  },
  "editor": {
    "emptyTitle": "Выберите заметку",
    "emptyDescription": "Содержимое заметки появится здесь для редактирования.",
    "save": "Сохранить",
    "links": "Связи",
    "analyzeAi": "Анализ с ИИ",
    "unsavedChanges": "Несохранённые изменения"
  },
  "vaultDialog": {
    "title": "Новое хранилище",
    "labelName": "Название",
    "placeholderName": "Моё хранилище",
    "labelPath": "Абсолютный путь на сервере",
    "placeholderPath": "/home/usuario/vaults/mi-vault",
    "btnBrowse": "Обзор",
    "modeCreate": "Создать новую папку",
    "modeCreateHint": "Создаёт папку хранилища (и маркер .obsidian) на сервере.",
    "modeRegister": "Зарегистрировать существующую папку",
    "modeRegisterHint": "Использует папку хранилища, которая уже есть на сервере.",
    "btnCancel": "Отмена",
    "btnSave": "Сохранить"
  },
  "pathBrowserDialog": {
    "title": "Выбрать папку",
    "btnUp": "Вверх",
    "btnCancel": "Отмена",
    "btnSelect": "Использовать эту папку"
  },
  "inputDialog": {
    "btnCancel": "Отмена",
    "btnOk": "ОК"
  },
  "search": {
    "title": "Результаты поиска"
  },
  "empty": {
    "noVaultsTitle": "Нет зарегистрированных хранилищ",
    "noVaultsDescription": "Создайте или зарегистрируйте хранилище Obsidian, чтобы работать с заметками на сервере.",
    "noVaultsCta": "Новое хранилище",
    "treeNoNotes": "В хранилище пока нет заметок.",
    "searchNoResults": "Нет результатов для «{q}»."
  },
  "confirm": {
    "discardDirtyBody": "В текущей заметке есть несохранённые изменения. Отменить их?",
    "discardDirtyTitle": "Несохранённые изменения",
    "discardDirtyConfirm": "Отменить",
    "discardDirtyCancel": "Продолжить редактирование",
    "unregisterBody": "Отменить регистрацию хранилища «{name}»? Файлы на сервере удалены НЕ будут.",
    "unregisterTitle": "Отменить регистрацию хранилища",
    "unregisterConfirm": "Отменить регистрацию",
    "overwriteContextBody": "Контекстные файлы уже существуют ({skipped}). Перезаписать их?",
    "overwriteContextTitle": "Перезаписать контекст",
    "overwriteContextConfirm": "Перезаписать",
    "deleteNoteBody": "Удалить заметку «{path}»? Действие необратимо.",
    "deleteNoteTitle": "Удалить заметку",
    "deleteNoteConfirm": "Удалить"
  },
  "actions": {
    "retry": "Повторить",
    "rename": "Переименовать",
    "delete": "Удалить",
    "newNoteInputTitle": "Новая заметка",
    "newFolderInputTitle": "Новая папка",
    "renameInputTitle": "Переименовать заметку",
    "analyzeAiPrompt": "Я работаю в своём хранилище Obsidian «{vaultName}» (путь на сервере: {vaultPath}) через модуль Obsidian в LUXIPANEL и хочу поработать с заметкой «{notePath}».\n\nИспользуй инструменты obsidian.* (читать/искать/создавать/связывать заметки хранилища), чтобы:\n1. Прочитать заметку и кратко изложить ключевые мысли.\n2. Проверить исходящие [[wikilink]]-ссылки и обратные ссылки.\n3. Предложить улучшения содержания, структуры и новые ссылки на связанные заметки хранилища.\n\nСпроси меня перед внесением любых изменений в заметки."
  },
  "errors": {
    "loadVaults": "Не удалось загрузить хранилища",
    "vaultMissing": "Папка хранилища не существует на сервере ({path}). Отмените регистрацию или восстановите папку.",
    "nameAndPathRequired": "Имя и путь обязательны",
    "pathMustBeAbsolute": "Путь должен быть абсолютным (начинаться с /)",
    "createVault": "Не удалось создать хранилище",
    "unregisterVault": "Не удалось отменить регистрацию хранилища",
    "prepareContext": "Не удалось подготовить контекст ИИ",
    "syncContainers": "Не удалось синхронизировать контейнеры",
    "loadTree": "Ошибка загрузки дерева",
    "openNote": "Не удалось открыть заметку",
    "saveNote": "Не удалось сохранить заметку",
    "noVaultSelected": "Сначала выберите хранилище",
    "createNote": "Не удалось создать заметку",
    "createFolder": "Не удалось создать папку",
    "renameNote": "Не удалось переименовать заметку",
    "deleteNote": "Не удалось удалить заметку",
    "loadLinks": "Ошибка загрузки ссылок",
    "wikilinkNotFound": "Заметка «{name}» не найдена в хранилище",
    "search": "Ошибка поиска",
    "listPath": "Не удалось получить список для этого пути (проверьте права доступа)."
  },
  "labels": {
    "noteCount": " · {count} заметок",
    "loading": "Загрузка…",
    "noSubfolders": "(нет подпапок)",
    "loadingLinks": "Загрузка ссылок…",
    "noOutgoingLinks": "Нет исходящих ссылок.",
    "outgoing": "Исходящие",
    "backlinks": "Обратные ссылки",
    "noBacklinks": "Нет обратных ссылок.",
    "searching": "Поиск…",
    "newNoteInputLabel": "Относительный путь в хранилище (например: Ideas/Моя заметка.md)",
    "newFolderInputLabel": "Относительный путь в хранилище (например: Проекты/2026)",
    "renameInputLabel": "Новый относительный путь"
  },
  "toasts": {
    "vaultCreated": "Хранилище создано",
    "vaultRegistered": "Хранилище зарегистрировано",
    "vaultUnregistered": "Регистрация хранилища отменена",
    "contextWritten": "Контекст ИИ записан: {written}",
    "contextNoChanges": "Нет изменений (уже существовали: {skipped})",
    "containersSynced": "Создано {created} · существующих {existing} · репозиториев {repos} · проектов {projects} · чатов {chats}",
    "containersBasic": "Контейнеры синхронизированы",
    "noteSaved": "Заметка сохранена",
    "noteCreated": "Заметка создана",
    "folderCreated": "Папка создана",
    "noteRenamed": "Заметка переименована",
    "noteDeleted": "Заметка удалена"
  }
} as const;

export default obsidian;
