// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { API_LOCALES, apiLocale } from "../../../shared/i18n/errors.js";

type Translations = readonly [string, string, string, string, string, string, string, string, string, string, string, string];

const messages = {
  invalidExtensionId: ["El ID de la extensión tiene un formato no válido", "Invalid extension ID format", "Format d’identifiant d’extension invalide", "Ungültiges Format der Erweiterungs-ID", "Formato dell’ID estensione non valido", "Formato de ID da extensão inválido", "تنسيق معرّف الامتداد غير صالح", "এক্সটেনশন আইডির বিন্যাস সঠিক নয়", "एक्सटेंशन ID का प्रारूप अमान्य है", "拡張機能 ID の形式が無効です", "확장 기능 ID 형식이 올바르지 않습니다", "Недопустимый формат ID расширения"],
  invalidToolName: ["El nombre de la herramienta tiene un formato no válido", "Invalid tool name format", "Format de nom d’outil invalide", "Ungültiges Format des Werkzeugnamens", "Formato del nome dello strumento non valido", "Formato do nome da ferramenta inválido", "تنسيق اسم الأداة غير صالح", "টুলের নামের বিন্যাস সঠিক নয়", "टूल नाम का प्रारूप अमान्य है", "ツール名の形式が無効です", "도구 이름 형식이 올바르지 않습니다", "Недопустимый формат имени инструмента"],
  extensionNotFound: ["Extensión no encontrada", "Extension not found", "Extension introuvable", "Erweiterung nicht gefunden", "Estensione non trovata", "Extensão não encontrada", "لم يُعثر على الامتداد", "এক্সটেনশন পাওয়া যায়নি", "एक्सटेंशन नहीं मिला", "拡張機能が見つかりません", "확장 기능을 찾을 수 없습니다", "Расширение не найдено"],
  mcpOnly: ["Esta operación solo está disponible para extensiones MCP", "This operation is only available for MCP extensions", "Cette opération est réservée aux extensions MCP", "Dieser Vorgang ist nur für MCP-Erweiterungen verfügbar", "Questa operazione è disponibile solo per le estensioni MCP", "Esta operação só está disponível para extensões MCP", "هذه العملية متاحة لامتدادات MCP فقط", "এই কাজটি শুধু MCP এক্সটেনশনের জন্য উপলব্ধ", "यह क्रिया केवल MCP एक्सटेंशन के लिए उपलब्ध है", "この操作は MCP 拡張機能でのみ利用できます", "이 작업은 MCP 확장 기능에서만 사용할 수 있습니다", "Эта операция доступна только для расширений MCP"],
  accessDenied: ["No tienes permiso para realizar esta operación con la extensión MCP", "You are not authorized to perform this operation on the MCP extension", "Vous n’êtes pas autorisé à effectuer cette opération sur l’extension MCP", "Du darfst diesen Vorgang mit der MCP-Erweiterung nicht ausführen", "Non sei autorizzato a eseguire questa operazione sull’estensione MCP", "Não tem permissão para efetuar esta operação na extensão MCP", "ليس لديك إذن لتنفيذ هذه العملية على امتداد MCP", "MCP এক্সটেনশনে এই কাজটি করার অনুমতি আপনার নেই", "MCP एक्सटेंशन पर यह कार्य करने की अनुमति नहीं है", "この MCP 拡張機能でこの操作を行う権限がありません", "이 MCP 확장 기능에서 이 작업을 수행할 권한이 없습니다", "У вас нет прав на эту операцию с расширением MCP"],
  missingField: ["Falta el campo obligatorio: {field}", "Missing required field: {field}", "Champ obligatoire manquant : {field}", "Erforderliches Feld fehlt: {field}", "Campo obbligatorio mancante: {field}", "Campo obrigatório em falta: {field}", "الحقل المطلوب غير موجود: {field}", "আবশ্যক ক্ষেত্র অনুপস্থিত: {field}", "आवश्यक फ़ील्ड मौजूद नहीं है: {field}", "必須項目がありません: {field}", "필수 필드가 없습니다: {field}", "Отсутствует обязательное поле: {field}"],
  configTooLarge: ["La configuración supera el límite de 10 KB", "Configuration exceeds the 10 KB limit", "La configuration dépasse la limite de 10 Ko", "Die Konfiguration überschreitet das Limit von 10 KB", "La configurazione supera il limite di 10 KB", "A configuração excede o limite de 10 KB", "يتجاوز الإعداد الحد الأقصى البالغ 10 كيلوبايت", "কনফিগারেশন ১০ কেবির সীমা অতিক্রম করেছে", "कॉन्फ़िगरेशन 10 KB की सीमा से अधिक है", "設定が 10 KB の上限を超えています", "설정이 10 KB 제한을 초과합니다", "Размер конфигурации превышает 10 КБ"],
  credentialsMissing: ["No hay credenciales configuradas. Configura primero la extensión.", "No credentials are configured. Configure the extension first.", "Aucun identifiant n’est configuré. Configurez d’abord l’extension.", "Es sind keine Zugangsdaten eingerichtet. Konfiguriere zuerst die Erweiterung.", "Non sono configurate credenziali. Configura prima l’estensione.", "Não há credenciais configuradas. Configure primeiro a extensão.", "لم تُضبط بيانات الاعتماد. أعدّ الامتداد أولًا.", "কোনো পরিচয়পত্র সেট করা নেই। আগে এক্সটেনশনটি কনফিগার করুন।", "कोई क्रेडेंशियल कॉन्फ़िगर नहीं है। पहले एक्सटेंशन कॉन्फ़िगर करें।", "認証情報が設定されていません。先に拡張機能を設定してください。", "인증 정보가 설정되지 않았습니다. 먼저 확장 기능을 설정하세요.", "Учётные данные не настроены. Сначала настройте расширение."],
  connected: ["{name} está conectado y listo para usar", "{name} is connected and ready to use", "{name} est connecté et prêt à être utilisé", "{name} ist verbunden und einsatzbereit", "{name} è connesso e pronto all’uso", "{name} está ligado e pronto a usar", "‏{name} متصل وجاهز للاستخدام", "{name} সংযুক্ত এবং ব্যবহারের জন্য প্রস্তুত", "{name} कनेक्ट हो गया है और उपयोग के लिए तैयार है", "{name} に接続しました。使用できます", "{name}에 연결되었으며 사용할 준비가 되었습니다", "{name} подключён и готов к работе"],
  uninstalled: ["{name} se desinstaló correctamente", "{name} was uninstalled successfully", "{name} a été désinstallé", "{name} wurde deinstalliert", "{name} è stato disinstallato", "{name} foi desinstalado", "أُزيل تثبيت {name} بنجاح", "{name} সফলভাবে আনইনস্টল করা হয়েছে", "{name} सफलतापूर्वक अनइंस्टॉल किया गया", "{name} をアンインストールしました", "{name}을(를) 제거했습니다", "{name} удалён"],
  configMissing: ["No se encontró la configuración o el archivo MCP", "MCP configuration or file not found", "Configuration ou fichier MCP introuvable", "MCP-Konfiguration oder Datei nicht gefunden", "Configurazione o file MCP non trovato", "Configuração ou ficheiro MCP não encontrado", "لم يُعثر على إعدادات MCP أو ملفها", "MCP কনফিগারেশন বা ফাইল পাওয়া যায়নি", "MCP कॉन्फ़िगरेशन या फ़ाइल नहीं मिली", "MCP の設定またはファイルが見つかりません", "MCP 설정 또는 파일을 찾을 수 없습니다", "Конфигурация или файл MCP не найдены"],
  connectionFailed: ["No se pudo conectar con el servidor MCP", "Cannot connect to MCP server", "Impossible de se connecter au serveur MCP", "Verbindung zum MCP-Server fehlgeschlagen", "Impossibile connettersi al server MCP", "Não foi possível ligar ao servidor MCP", "تعذّر الاتصال بخادم MCP", "MCP সার্ভারে সংযোগ করা যায়নি", "MCP सर्वर से कनेक्ट नहीं हो सका", "MCP サーバーに接続できません", "MCP 서버에 연결할 수 없습니다", "Не удалось подключиться к серверу MCP"],
  connectionTimeout: ["Se agotó el tiempo de conexión con el servidor MCP", "MCP server connection timed out", "Délai de connexion au serveur MCP dépassé", "Zeitüberschreitung bei der Verbindung zum MCP-Server", "Tempo di connessione al server MCP scaduto", "A ligação ao servidor MCP excedeu o tempo limite", "انتهت مهلة الاتصال بخادم MCP", "MCP সার্ভারের সংযোগের সময়সীমা শেষ হয়েছে", "MCP सर्वर से कनेक्शन का समय समाप्त हो गया", "MCP サーバーへの接続がタイムアウトしました", "MCP 서버 연결 시간이 초과되었습니다", "Превышено время ожидания подключения к серверу MCP"],
  permissionDenied: ["Se denegó el acceso a MCP", "Permission denied accessing MCP", "Accès à MCP refusé", "Zugriff auf MCP verweigert", "Accesso a MCP negato", "Acesso ao MCP negado", "رُفض الوصول إلى MCP", "MCP অ্যাক্সেসের অনুমতি নেই", "MCP तक पहुँच की अनुमति नहीं है", "MCP へのアクセスが拒否されました", "MCP 접근 권한이 거부되었습니다", "Доступ к MCP запрещён"],
  processFailed: ["No se pudo iniciar el proceso MCP", "Failed to start MCP process", "Impossible de démarrer le processus MCP", "MCP-Prozess konnte nicht gestartet werden", "Impossibile avviare il processo MCP", "Não foi possível iniciar o processo MCP", "تعذّر بدء عملية MCP", "MCP প্রক্রিয়া চালু করা যায়নি", "MCP प्रक्रिया शुरू नहीं हो सकी", "MCP プロセスを起動できませんでした", "MCP 프로세스를 시작하지 못했습니다", "Не удалось запустить процесс MCP"],
  serverNotFound: ["No se encontró el servidor MCP", "MCP server not found", "Serveur MCP introuvable", "MCP-Server nicht gefunden", "Server MCP non trovato", "Servidor MCP não encontrado", "لم يُعثر على خادم MCP", "MCP সার্ভার পাওয়া যায়নি", "MCP सर्वर नहीं मिला", "MCP サーバーが見つかりません", "MCP 서버를 찾을 수 없습니다", "Сервер MCP не найден"],
  operationFailed: ["Falló la operación MCP", "MCP operation failed", "Échec de l’opération MCP", "MCP-Vorgang fehlgeschlagen", "Operazione MCP non riuscita", "A operação MCP falhou", "فشلت عملية MCP", "MCP কাজটি ব্যর্থ হয়েছে", "MCP कार्य विफल हुआ", "MCP 操作に失敗しました", "MCP 작업에 실패했습니다", "Ошибка операции MCP"],
} as const satisfies Record<string, Translations>;

export type McpMessageKey = keyof typeof messages;
export const MCP_MESSAGE_KEYS = Object.keys(messages) as McpMessageKey[];

export function mcpMessage(locale: unknown, key: McpMessageKey, values: Record<string, string> = {}): string {
  const template = messages[key][API_LOCALES.indexOf(apiLocale(locale))] ?? messages[key][1];
  return template.replace(/\{(\w+)\}/g, (token, name: string) => values[name] ?? token);
}

/** Match only known system error codes; never echo raw process errors to clients. */
export function safeMcpErrorMessage(locale: unknown, raw: string): string {
  const patterns: readonly [string, McpMessageKey][] = [
    ["ENOENT", "configMissing"],
    ["ECONNREFUSED", "connectionFailed"],
    ["ETIMEDOUT", "connectionTimeout"],
    ["EACCES", "permissionDenied"],
    ["spawn", "processFailed"],
    ["ENOTFOUND", "serverNotFound"],
  ];
  const key = patterns.find(([signature]) => raw.includes(signature))?.[1] ?? "operationFailed";
  return mcpMessage(locale, key);
}
