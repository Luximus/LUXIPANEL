const login = {
  "pageTitle": "Вход в систему",
  "panelSubtitle": "Панель администрирования",
  "authError": "Ошибка аутентификации",
  "forgotPassword": "Я забыл пароль",
  "forgotHint": "Введите свою электронную почту, и мы отправим вам ссылку для смены пароля.",
  "backToLogin": "Вернуться к входу",
  "recoverLinkSent": "Если такая почта существует, мы отправили ссылку для восстановления.",
  "recoverLinkError": "Не удалось отправить ссылку для восстановления.",
  "languageLabel": "Язык",
  "hostLabelFallback": "эта панель",
  "tabs": {
    "password": "Пароль",
    "passkey": "Passkey",
    "recovery": "Восстановление"
  },
  "labels": {
    "user": "Пользователь",
    "password": "Пароль",
    "sshPassphrase": "Кодовая фраза SSH-ключа",
    "remember": "Запомнить меня",
    "email": "Электронная почта",
    "recoveryCode": "Код восстановления",
    "code6Digits": "6-значный код"
  },
  "placeholders": {
    "user": "admin",
    "email": "user@example.com",
    "password": "********",
    "sshPassphrase": "Кодовая фраза вашего SSH-ключа",
    "recoveryCode": "XXXX-XXXX-XXXX",
    "totp": "000000"
  },
  "text": {
    "biometricAuth": "Биометрическая аутентификация",
    "biometricHelp": "Используйте Face ID, отпечаток пальца или ключ безопасности",
    "usePasskey": "Использовать Passkey",
    "signIn": "Вход в систему",
    "sendRecoveryLink": "Отправить ссылку для восстановления",
    "recoveryWarning": "Используйте одноразовый код восстановления, если вы потеряли доступ к своему устройству.",
    "verifyCode": "Проверить код",
    "twoFactorTitle": "Двухэтапная проверка",
    "twoFactorHelp": "Введите код из вашего приложения аутентификации",
    "verify": "Проверить",
    "footer": "LuxiPanel v2.0 - Безопасное администрирование почты"
  },
  "errors": {
    "captchaRequired": "Пройдите проверку hCaptcha.",
    "enterEmail": "Введите адрес электронной почты",
    "browserNoPasskey": "Ваш браузер не поддерживает Passkey. Используйте свежую версию Chrome, Firefox, Safari или Edge.",
    "passkeyOptionsFailed": "Не удалось получить параметры аутентификации",
    "passkeyCanceled": "Аутентификация отменена",
    "passkeyCanceledByUser": "Аутентификация отменена пользователем",
    "passkeyError": "Ошибка Passkey",
    "enterUserRecoveryCode": "Введите пользователя и код восстановления",
    "enterTotp6Digits": "Введите 6 цифр кода",
    "invalidTotpCode": "Неверный код 2FA"
  },
  "status": {
    "passkeyInit": "Запуск аутентификации...",
    "passkeyWaiting": "Ожидание вашего Passkey...",
    "passkeyVerifying": "Проверка..."
  },
  "authErrors": {
    "AUTH_ERROR": "Ошибка аутентификации.",
    "NO_SSH_KEY": "К этому пользователю в этой панели не привязан SSH-ключ.",
    "PANEL_UNRESOLVED": "Не удалось определить панель доступа.",
    "PANEL_NO_IP": "Для панели не настроен IP-адрес.",
    "USER_PROVISION_FAILED": "Не удалось подготовить пользователя в панели.",
    "ACCOUNT_DISABLED": "Учётная запись отключена.",
    "ACCOUNT_NOT_FOUND": "Учётная запись не найдена или отключена.",
    "USER_NOT_FOUND": "Пользователь не найден.",
    "TWO_FA_REQUIRED": "Для этой учётной записи требуется 2FA. Настройте её в разделе Настройки › Безопасность перед входом.",
    "INVALID_PASSPHRASE": "Неверная кодовая фраза.",
    "PASSPHRASE_REQUIRED": "Необходимо ввести кодовую фразу пользователя.",
    "PASSPHRASE_VERIFY_FAILED": "Не удалось проверить пароль на сервере.",
    "SERVER_SSH_KEY_MISSING": "SSH-ключ сервера не настроен.",
    "PANEL_SSH_KEY_REJECTED": "SSH-ключ панели не принят сервером.",
    "SSH_CONNECT_FAILED": "Не удалось подключиться к SSH-серверу.",
    "SSH_CONNECTION_CLOSED": "SSH-соединение неожиданно закрылось.",
    "PASSWORD_LOGIN_DISABLED": "Вход по паролю отключён.",
    "PASSKEY_LOGIN_DISABLED": "Вход по Passkey отключён.",
    "RECOVERY_LOGIN_DISABLED": "Вход по коду восстановления отключён.",
    "PASSKEY_INVALID": "Недействительный Passkey.",
    "INVALID_AUTH_RESPONSE": "Недействительный ответ аутентификации.",
    "INVALID_TOTP": "Неверный код TOTP.",
    "CAPTCHA_REQUIRED": "Требуется проверка captcha.",
    "CAPTCHA_FAILED": "Проверка captcha не пройдена."
  }
} as const;

export default login;
