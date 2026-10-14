import { localizePolicyError } from "./permission-policy-messages.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// User-facing messages emitted by the shared HTTP error handler.
// Module-specific errors retain their code and original detail until each
// module supplies a translated message for that code.

export const API_LOCALES = ["es", "en", "fr", "de", "it", "pt", "ar", "bn", "hi", "ja", "ko", "ru"] as const;
export type ApiLocale = (typeof API_LOCALES)[number];

type ErrorMessages = {
  internal: string;
  payloadTooLarge: string;
  validation: string;
  authentication: string;
  forbidden: string;
  notFound: string;
  conflict: string;
  unavailable: string;
  noExecutor: string;
  bridgeRequired: string;
  required: string;
  invalid: string;
  invalidOption: string;
  minimum: string;
  maximum: string;
  invalidFormat: string;
};

const messages: Record<ApiLocale, ErrorMessages> = {
  es: { internal: "Error interno del servidor", payloadTooLarge: "El contenido enviado es demasiado grande", validation: "La validación falló", authentication: "Debes iniciar sesión", forbidden: "Acceso denegado", notFound: "Recurso no encontrado", conflict: "El recurso ya existe", unavailable: "El servicio no está disponible temporalmente. Inténtalo de nuevo.", noExecutor: "No hay un servidor conectado en contexto.", bridgeRequired: "Selecciona o reconecta un servidor para continuar.", required: "Este campo es obligatorio", invalid: "Valor no válido", invalidOption: "Opción no válida", minimum: "Mínimo: {value}", maximum: "Máximo: {value}", invalidFormat: "Formato no válido" },
  en: { internal: "Internal server error", payloadTooLarge: "Payload too large", validation: "Validation failed", authentication: "Authentication required", forbidden: "Access denied", notFound: "Resource not found", conflict: "Resource already exists", unavailable: "The service is temporarily unavailable. Try again.", noExecutor: "No server is connected in this context.", bridgeRequired: "Select or reconnect a server to continue.", required: "This field is required", invalid: "Invalid value", invalidOption: "Invalid option", minimum: "Minimum: {value}", maximum: "Maximum: {value}", invalidFormat: "Invalid format" },
  fr: { internal: "Erreur interne du serveur", payloadTooLarge: "Contenu envoyé trop volumineux", validation: "Échec de la validation", authentication: "Connexion requise", forbidden: "Accès refusé", notFound: "Ressource introuvable", conflict: "La ressource existe déjà", unavailable: "Le service est temporairement indisponible. Réessayez.", noExecutor: "Aucun serveur n'est connecté dans ce contexte.", bridgeRequired: "Sélectionnez ou reconnectez un serveur pour continuer.", required: "Ce champ est obligatoire", invalid: "Valeur invalide", invalidOption: "Option invalide", minimum: "Minimum : {value}", maximum: "Maximum : {value}", invalidFormat: "Format invalide" },
  de: { internal: "Interner Serverfehler", payloadTooLarge: "Gesendete Daten sind zu groß", validation: "Validierung fehlgeschlagen", authentication: "Anmeldung erforderlich", forbidden: "Zugriff verweigert", notFound: "Ressource nicht gefunden", conflict: "Ressource existiert bereits", unavailable: "Der Dienst ist vorübergehend nicht verfügbar. Versuchen Sie es erneut.", noExecutor: "In diesem Kontext ist kein Server verbunden.", bridgeRequired: "Wählen Sie einen Server aus oder verbinden Sie ihn erneut.", required: "Dieses Feld ist erforderlich", invalid: "Ungültiger Wert", invalidOption: "Ungültige Option", minimum: "Minimum: {value}", maximum: "Maximum: {value}", invalidFormat: "Ungültiges Format" },
  it: { internal: "Errore interno del server", payloadTooLarge: "Contenuto inviato troppo grande", validation: "Convalida non riuscita", authentication: "Accesso richiesto", forbidden: "Accesso negato", notFound: "Risorsa non trovata", conflict: "La risorsa esiste già", unavailable: "Il servizio è temporaneamente non disponibile. Riprova.", noExecutor: "Nessun server è connesso in questo contesto.", bridgeRequired: "Seleziona o riconnetti un server per continuare.", required: "Questo campo è obbligatorio", invalid: "Valore non valido", invalidOption: "Opzione non valida", minimum: "Minimo: {value}", maximum: "Massimo: {value}", invalidFormat: "Formato non valido" },
  pt: { internal: "Erro interno do servidor", payloadTooLarge: "O conteúdo enviado é demasiado grande", validation: "Falha na validação", authentication: "É necessário iniciar sessão", forbidden: "Acesso negado", notFound: "Recurso não encontrado", conflict: "O recurso já existe", unavailable: "O serviço está temporariamente indisponível. Tente novamente.", noExecutor: "Não há nenhum servidor ligado neste contexto.", bridgeRequired: "Selecione ou volte a ligar um servidor para continuar.", required: "Este campo é obrigatório", invalid: "Valor inválido", invalidOption: "Opção inválida", minimum: "Mínimo: {value}", maximum: "Máximo: {value}", invalidFormat: "Formato inválido" },
  ar: { internal: "خطأ داخلي في الخادم", payloadTooLarge: "المحتوى المُرسل كبير جداً", validation: "فشل التحقق من البيانات", authentication: "تسجيل الدخول مطلوب", forbidden: "تم رفض الوصول", notFound: "المورد غير موجود", conflict: "المورد موجود بالفعل", unavailable: "الخدمة غير متاحة مؤقتاً. حاول مجدداً.", noExecutor: "لا يوجد خادم متصل في هذا السياق.", bridgeRequired: "اختر خادماً أو أعد الاتصال به للمتابعة.", required: "هذا الحقل مطلوب", invalid: "قيمة غير صالحة", invalidOption: "خيار غير صالح", minimum: "الحد الأدنى: {value}", maximum: "الحد الأقصى: {value}", invalidFormat: "تنسيق غير صالح" },
  bn: { internal: "সার্ভারের অভ্যন্তরীণ ত্রুটি", payloadTooLarge: "পাঠানো তথ্যের আকার খুব বড়", validation: "যাচাই ব্যর্থ হয়েছে", authentication: "লগইন প্রয়োজন", forbidden: "প্রবেশাধিকার নেই", notFound: "রিসোর্স পাওয়া যায়নি", conflict: "রিসোর্সটি ইতিমধ্যে আছে", unavailable: "পরিষেবা সাময়িকভাবে অনুপলব্ধ। আবার চেষ্টা করুন।", noExecutor: "এই প্রসঙ্গে কোনো সার্ভার সংযুক্ত নেই।", bridgeRequired: "চালিয়ে যেতে সার্ভার বেছে নিন বা আবার সংযোগ করুন।", required: "এই ঘরটি আবশ্যক", invalid: "অবৈধ মান", invalidOption: "অবৈধ বিকল্প", minimum: "সর্বনিম্ন: {value}", maximum: "সর্বোচ্চ: {value}", invalidFormat: "অবৈধ বিন্যাস" },
  hi: { internal: "सर्वर की आंतरिक त्रुटि", payloadTooLarge: "भेजी गई सामग्री बहुत बड़ी है", validation: "सत्यापन विफल रहा", authentication: "लॉगिन आवश्यक है", forbidden: "पहुँच अस्वीकृत", notFound: "संसाधन नहीं मिला", conflict: "संसाधन पहले से मौजूद है", unavailable: "सेवा अस्थायी रूप से उपलब्ध नहीं है। फिर प्रयास करें।", noExecutor: "इस संदर्भ में कोई सर्वर जुड़ा नहीं है।", bridgeRequired: "आगे बढ़ने के लिए सर्वर चुनें या फिर से जोड़ें।", required: "यह फ़ील्ड आवश्यक है", invalid: "अमान्य मान", invalidOption: "अमान्य विकल्प", minimum: "न्यूनतम: {value}", maximum: "अधिकतम: {value}", invalidFormat: "अमान्य प्रारूप" },
  ja: { internal: "サーバー内部エラー", payloadTooLarge: "送信データが大きすぎます", validation: "入力内容の検証に失敗しました", authentication: "ログインが必要です", forbidden: "アクセスが拒否されました", notFound: "リソースが見つかりません", conflict: "リソースは既に存在します", unavailable: "サービスは一時的に利用できません。もう一度お試しください。", noExecutor: "この操作に接続済みサーバーがありません。", bridgeRequired: "続行するにはサーバーを選択するか再接続してください。", required: "この項目は必須です", invalid: "無効な値です", invalidOption: "無効な選択肢です", minimum: "最小値: {value}", maximum: "最大値: {value}", invalidFormat: "無効な形式です" },
  ko: { internal: "서버 내부 오류", payloadTooLarge: "전송한 데이터가 너무 큽니다", validation: "유효성 검사 실패", authentication: "로그인이 필요합니다", forbidden: "접근이 거부되었습니다", notFound: "리소스를 찾을 수 없습니다", conflict: "리소스가 이미 존재합니다", unavailable: "서비스를 일시적으로 사용할 수 없습니다. 다시 시도하세요.", noExecutor: "이 작업에 연결된 서버가 없습니다.", bridgeRequired: "계속하려면 서버를 선택하거나 다시 연결하세요.", required: "필수 항목입니다", invalid: "잘못된 값", invalidOption: "잘못된 옵션", minimum: "최소: {value}", maximum: "최대: {value}", invalidFormat: "잘못된 형식" },
  ru: { internal: "Внутренняя ошибка сервера", payloadTooLarge: "Отправленные данные слишком велики", validation: "Ошибка проверки данных", authentication: "Требуется вход", forbidden: "Доступ запрещён", notFound: "Ресурс не найден", conflict: "Ресурс уже существует", unavailable: "Сервис временно недоступен. Повторите попытку.", noExecutor: "В этом контексте нет подключённого сервера.", bridgeRequired: "Выберите сервер или подключитесь к нему снова.", required: "Это поле обязательно", invalid: "Недопустимое значение", invalidOption: "Недопустимый вариант", minimum: "Минимум: {value}", maximum: "Максимум: {value}", invalidFormat: "Недопустимый формат" },
};

function parseApiLocale(value: unknown): ApiLocale | null {
  const code = typeof value === "string" ? value.trim().split(/[;,\-]/)[0]?.toLowerCase() : "";
  return API_LOCALES.includes(code as ApiLocale) ? code as ApiLocale : null;
}

export function apiLocale(value: unknown): ApiLocale {
  return parseApiLocale(value) ?? "en";
}

/** Error handlers can run before cookie-parser (for example on a large JSON body). */
export function apiLocaleFromRequest(request: {
  query?: Record<string, unknown>;
  cookies?: Record<string, unknown>;
  headers?: Record<string, unknown>;
}): ApiLocale {
  const query = request.query?.lang;
  const queryLocale = parseApiLocale(query);
  if (queryLocale) return queryLocale;
  const cookie = request.cookies?.["lxp-locale"];
  const cookieLocale = parseApiLocale(cookie);
  if (cookieLocale) return cookieLocale;
  const rawCookie = request.headers?.cookie;
  if (typeof rawCookie === "string") {
    const saved = rawCookie.match(/(?:^|;)\s*lxp-locale=([^;]+)/)?.[1];
    if (saved) try { const decoded = parseApiLocale(decodeURIComponent(saved)); if (decoded) return decoded; } catch { /* malformed cookie */ }
  }
  const accept = request.headers?.["accept-language"];
  if (typeof accept === "string") {
    for (const preferred of accept.split(",")) {
      const code = preferred.trim().split(";")[0]?.split("-")[0]?.toLowerCase();
      if (API_LOCALES.includes(code as ApiLocale)) return code as ApiLocale;
    }
  }
  return "en";
}

const rateLimitMessages: Record<ApiLocale, string> = {
  es: "Demasiadas solicitudes. Inténtalo más tarde.",
  en: "Too many requests. Try again later.",
  fr: "Trop de requêtes. Réessayez plus tard.",
  de: "Zu viele Anfragen. Versuchen Sie es später erneut.",
  it: "Troppe richieste. Riprova più tardi.",
  pt: "Demasiados pedidos. Tente mais tarde.",
  ar: "طلبات كثيرة جداً. حاول لاحقاً.",
  bn: "অতিরিক্ত অনুরোধ করা হয়েছে। পরে আবার চেষ্টা করুন।",
  hi: "बहुत अधिक अनुरोध हुए हैं। बाद में फिर प्रयास करें।",
  ja: "リクエストが多すぎます。後でもう一度お試しください。",
  ko: "요청이 너무 많습니다. 나중에 다시 시도하세요.",
  ru: "Слишком много запросов. Повторите попытку позже.",
};

export function apiErrorMessage(locale: unknown, key: keyof ErrorMessages | "rateLimit", value?: string | number): string {
  const code = apiLocale(locale);
  return (key === "rateLimit" ? rateLimitMessages[code] : messages[code][key]).replace("{value}", String(value ?? ""));
}

const defaultMessageKeys: Record<string, keyof ErrorMessages> = {
  "Authorization service unavailable": "unavailable",
  "Authorization target missing": "noExecutor",
  "Account resource creation in progress; retry": "unavailable",
  "Account resource creation lease expired": "unavailable",
  "Quota lease expired": "unavailable",
  "Hosting PHP socket verification failed": "unavailable",
  "Hosting PHP startup failed": "unavailable",
  "Hosting crontab inspection failed": "unavailable",
  "Hosting crontab installation failed": "unavailable",
  "Hosting crontab service unavailable": "unavailable",
  "Hosting group unavailable": "unavailable",
  "Hosting runtime verification failed": "unavailable",
  "PHP socket worker unavailable": "unavailable",
  "Isolated PHP runtime is unavailable for this hosting account": "unavailable",
  "Unsupported hosting PHP runtime": "unavailable",
  "Hosting executor missing": "noExecutor",
  "Tenant identity executor missing": "noExecutor",
  "Tenant identity service unavailable": "unavailable",
  "Tool execution requires an authenticated server": "noExecutor",
  "Hosting account has privileged Linux membership": "forbidden",
  "Hosting owner missing from dedicated group": "forbidden",
  "Hosting user missing its dedicated group": "forbidden",
  "Multiple hosting account memberships": "forbidden",
  "Hosting crontab identity mismatch": "forbidden",
  "Hosting site service identity mismatch": "forbidden",
  "Tenant service identity mismatch": "forbidden",
  "Hosting runtime requires a separate service identity": "forbidden",
  "Hosting sub-user outside account home": "forbidden",
  "Mail server is outside the hosting plan": "forbidden",
  "Preferences belong to another user": "forbidden",
  "Site configuration is outside the hosting account": "forbidden",
  "Site is outside the hosting account": "forbidden",
  "Hosting account has no reusable plan": "validation",
  "Hosting group missing": "validation",
  "Hosting project ID exceeds reserved range": "validation",
  "Invalid MFA account executor": "validation",
  "Invalid PHP socket worker": "validation",
  "Invalid account executor": "validation",
  "Invalid hosting Linux user": "validation",
  "Invalid hosting PHP identity": "validation",
  "Invalid hosting runtime identity": "validation",
  "Invalid preferences account": "validation",
  "Missing hosting runtime limits": "validation",
  "Modules and shell policy are inherited from the hosting plan": "validation",

  "Validation failed": "validation",
  "Invalid body": "validation",
  "Invalid query": "validation",
  "Invalid params": "validation",
  "Bad request": "validation",
  "Authentication required": "authentication",
  "Access denied": "forbidden",
  "Resource not found": "notFound",
  "Resource already exists": "conflict",
  "Internal server error": "internal",
  "Payload too large": "payloadTooLarge",
  "El servicio no está disponible temporalmente. Intenta de nuevo.": "unavailable",
  "No hay un servidor conectado en contexto.": "noExecutor",
  "Selecciona o reconecta un servidor para continuar.": "bridgeRequired",
};

const codedMessages = {
  CLOUDFLARE_TOKEN_MISSING: ["No hay un token de API de Cloudflare configurado. Guárdalo en la configuración del módulo.", "No Cloudflare API token is configured. Save one in the module settings.", "Aucun jeton API Cloudflare n’est configuré. Enregistrez-en un dans les paramètres du module.", "Es ist kein Cloudflare-API-Token konfiguriert. Speichere es in den Moduleinstellungen.", "Non è configurato alcun token API Cloudflare. Salvalo nelle impostazioni del modulo.", "Não está configurado nenhum token de API Cloudflare. Guarde-o nas definições do módulo.", "لم يُضبط رمز API لـ Cloudflare. احفظه في إعدادات الوحدة.", "Cloudflare API টোকেন কনফিগার করা নেই। মডিউল সেটিংসে এটি সংরক্ষণ করুন।", "Cloudflare API टोकन कॉन्फ़िगर नहीं है। इसे मॉड्यूल सेटिंग में सहेजें।", "Cloudflare API トークンが設定されていません。モジュール設定で保存してください。", "Cloudflare API 토큰이 설정되지 않았습니다. 모듈 설정에서 저장하세요.", "Токен API Cloudflare не настроен. Сохраните его в настройках модуля."],
  EXPO_TOKEN_MISSING: ["No hay un token de acceso de Expo configurado. Guárdalo en la configuración del módulo.", "No Expo access token is configured. Save one in the module settings.", "Aucun jeton d’accès Expo n’est configuré. Enregistrez-en un dans les paramètres du module.", "Es ist kein Expo-Zugriffstoken konfiguriert. Speichere es in den Moduleinstellungen.", "Non è configurato alcun token di accesso Expo. Salvalo nelle impostazioni del modulo.", "Não está configurado nenhum token de acesso Expo. Guarde-o nas definições do módulo.", "لم يُضبط رمز وصول Expo. احفظه في إعدادات الوحدة.", "Expo অ্যাক্সেস টোকেন কনফিগার করা নেই। মডিউল সেটিংসে এটি সংরক্ষণ করুন।", "Expo एक्सेस टोकन कॉन्फ़िगर नहीं है। इसे मॉड्यूल सेटिंग में सहेजें।", "Expo アクセストークンが設定されていません。モジュール設定で保存してください。", "Expo 액세스 토큰이 설정되지 않았습니다. 모듈 설정에서 저장하세요.", "Токен доступа Expo не настроен. Сохраните его в настройках модуля."],
} as const satisfies Record<string, readonly [string, string, string, string, string, string, string, string, string, string, string, string]>;

/** Preserve specific operational details; translate only known generic defaults. */
export function localizeDefaultError(locale: unknown, source: string, code?: string): string {
  const coded = codedMessages[code as keyof typeof codedMessages];
  if (coded) return coded[API_LOCALES.indexOf(apiLocale(locale))] ?? coded[1];
  const policy = localizePolicyError(API_LOCALES.indexOf(apiLocale(locale)), source);
  if (policy) return policy;
  const key = defaultMessageKeys[source];
  return key ? apiErrorMessage(locale, key) : source;
}
