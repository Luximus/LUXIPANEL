const preferences = {
  "pageTitle": "Настройки",
  "header": {
    "title": "Настройки",
    "subtitle": "Управляйте профилем и безопасностью аккаунта"
  },
  "placeholders": {
    "phone": "+7 900 000-00-00"
  },
  "profile": {
    "sectionTitle": "Профиль",
    "labelDisplayName": "Отображаемое имя",
    "labelPhone": "Телефон",
    "labelUsername": "Имя пользователя",
    "labelRole": "Роль",
    "btnSave": "Сохранить профиль"
  },
  "password": {
    "sectionTitle": "Изменить пароль",
    "disabledNotice": "Изменение пароля отключено в LuxiPanel. Вам необходимо обратиться к администратору сервера."
  },
  "passkeys": {
    "sectionTitle": "Passkeys",
    "sectionSubtitle": "Биометрическая аутентификация / FIDO2",
    "btnAdd": "Добавить passkey",
    "emptyState": "У вас пока нет зарегистрированных passkeys"
  },
  "recoveryCodes": {
    "sectionTitle": "Коды восстановления",
    "sectionSubtitle": "Используйте их, если потеряете доступ к своему устройству",
    "btnRegenerate": "Перегенерировать",
    "loading": "Загрузка...",
    "warning": "Сохраните эти коды в надёжном месте. Они показываются только один раз.",
    "btnCopy": "Копировать всё",
    "btnPrint": "Печать"
  },
  "twoFactor": {
    "sectionTitle": "Двухфакторная аутентификация (2FA)",
    "sectionSubtitle": "Защитите аккаунт дополнительным кодом",
    "badgeDisabled": "Отключено",
    "enabledDescription": "Ваш аккаунт защищён двухэтапной аутентификацией. При каждом входе вам потребуется код из приложения-аутентификатора.",
    "btnEnable": "Включить 2FA",
    "btnDisable": "Отключить 2FA"
  },
  "auditLog": {
    "sectionTitle": "Последняя активность",
    "emptyState": "Активность не зарегистрирована"
  },
  "dialogRegenCodes": {
    "title": "Регенерировать коды?",
    "body": "Предыдущие коды станут недействительными. Это действие невозможно отменить.",
    "btnCancel": "Отмена",
    "btnConfirm": "Перегенерировать"
  },
  "dialogSetup2fa": {
    "title": "Включить двухфакторную аутентификацию",
    "subtitle": "Отсканируйте этот QR-код в приложении аутентификатора (Google Authenticator, Authy и т.д.)",
    "manualEntryLabel": "Если не удаётся отсканировать, введите вручную:",
    "titleCopySecret": "Копировать",
    "verifyCodeLabel": "Введите 6-значный код для подтверждения:",
    "btnCancel": "Отмена",
    "btnConfirm": "Включить 2FA"
  },
  "dialogDisable2fa": {
    "title": "Отключить 2FA?",
    "body": "Ваш аккаунт станет менее защищённым. Вы сможете включить его снова в любой момент.",
    "btnCancel": "Отмена",
    "btnConfirm": "Отключить 2FA"
  },
  "toasts": {
    "profileUpdated": "Профиль обновлён",
    "errorUpdate": "Ошибка обновления",
    "passwordUpdated": "Пароль изменён",
    "passkeyDeleted": "Passkey удалён",
    "error": "Ошибка",
    "registrationCancelled": "Регистрация отменена",
    "passkeyRegistered": "Passkey успешно зарегистрирован",
    "registrationCancelledByUser": "Регистрация отменена пользователем",
    "codesCopied": "Коды скопированы в буфер обмена",
    "secretCopied": "Secret скопирован в буфер обмена",
    "twoFaActivated": "2FA успешно активирован",
    "twoFaDeactivated": "2FA деактивирован"
  },
  "errors": {
    "passwordMismatch": "Пароли не совпадают",
    "passwordTooShort": "Пароль должен содержать не менее 8 символов",
    "passwordChangeError": "Ошибка смены пароля",
    "passkeyNotSupported": "Ваш браузер не поддерживает Passkey. Используйте актуальную версию Chrome, Firefox, Safari или Edge.",
    "passkeyInitFailed": "Не удалось начать регистрацию",
    "passkeyFinishError": "Ошибка завершения регистрации",
    "generateCodesError": "Ошибка генерации кодов",
    "twoFaSetupError": "Ошибка запуска настройки 2FA",
    "enterSixDigits": "Введите 6-значный код",
    "invalidCode": "Неверный код",
    "twoFaDeactivateError": "Ошибка деактивации 2FA",
    "genericWithMessage": "Ошибка: {message}"
  },
  "labels": {
    "passkeyRegistered": "Зарегистрирован {date}",
    "hasActiveCodes": "У вас есть активные коды восстановления.",
    "noActiveCodes": "Активных кодов восстановления нет.",
    "notAvailable": "Недоступно",
    "codesGenerated": "{count} кодов сгенерировано. Сохраните их в надёжном месте.",
    "printTitle": "Коды восстановления — LUXIPANEL",
    "printWarning": "Храните эти коды в надёжном месте. Каждый можно использовать только один раз.",
    "twoFaBadgeEnabled": "Включён",
    "twoFaBadgeDisabled": "Отключён"
  },
  "confirm": {
    "deletePasskey": "Удалить этот passkey?",
    "deletePasskeyTitle": "Удалить passkey"
  },
  "actions": {
    "login": "Вход в систему",
    "logout": "Выход из системы",
    "passwordChange": "Смена пароля",
    "passkeyRegister": "Passkey зарегистрирован",
    "passkeyDelete": "Passkey удалён",
    "recoveryCodeUsed": "Использован код восстановления",
    "profileUpdate": "Профиль обновлён",
    "twoFaEnabled": "2FA включён",
    "twoFaDisabled": "2FA отключён",
    "activateTwoFa": "Активировать 2FA"
  }
} as const;

export default preferences;
