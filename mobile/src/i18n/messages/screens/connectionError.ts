import type { LocaleCode } from "../../locales";
import type { Widen } from "../_shared";

// Spanish is the source of truth; every other locale is checked against
// its widened shape, so missing/extra keys per screen surface as TS errors.
const es = {
  "title": "Conexión interrumpida",
  "description": "No se pudo conectar a {name}. Verifica que el servidor esté disponible e inténtalo de nuevo.",
  "descriptionNoName": "No se pudo conectar al servidor. Verifica que esté disponible e inténtalo de nuevo.",
  "closeAria": "Cerrar",
  "accept": "Entendido",
  "reconnect": "Reconectar",
  "reconnecting": "Reconectando…",
  "close": "Cerrar",
  "sessionTitle": "Sesión expirada",
  "sessionDescription": "Tu sesión con {name} expiró. Reconéctate para seguir donde estabas.",
  "sessionDescriptionNoName": "Tu sesión expiró. Reconéctate para continuar donde estabas."
} as const;

export type ConnectionErrorMessages = Widen<typeof es>;

export const connectionError: Record<LocaleCode, ConnectionErrorMessages> = {
  es,
  en: {
    "title": "Connection lost",
    "description": "Could not connect to {name}. Make sure the server is reachable and try again.",
    "descriptionNoName": "Could not connect to the server. Make sure it's reachable and try again.",
    "closeAria": "Close",
    "accept": "Got it",
    "reconnect": "Reconnect",
    "reconnecting": "Reconnecting…",
    "close": "Close",
    "sessionTitle": "Session expired",
    "sessionDescription": "Your session with {name} expired. Reconnect to pick up where you left off.",
    "sessionDescriptionNoName": "Your session expired. Reconnect to continue where you left off."
  },
  fr: {
    "title": "Connexion perdue",
    "description": "Impossible de se connecter à {name}. Vérifiez que le serveur est accessible, puis réessayez.",
    "descriptionNoName": "Impossible de se connecter au serveur. Vérifiez qu'il est accessible, puis réessayez.",
    "closeAria": "Fermer",
    "accept": "Compris",
    "reconnect": "Reconnecter",
    "reconnecting": "Reconnexion…",
    "close": "Fermer",
    "sessionTitle": "Session expirée",
    "sessionDescription": "Votre session avec {name} a expiré. Reconnectez-vous pour reprendre où vous en étiez.",
    "sessionDescriptionNoName": "Votre session a expiré. Reconnectez-vous pour continuer où vous en étiez."
  },
  pt: {
    "title": "Conexão interrompida",
    "description": "Não foi possível conectar a {name}. Verifique se o servidor está disponível e tente novamente.",
    "descriptionNoName": "Não foi possível conectar ao servidor. Verifique se está disponível e tente novamente.",
    "closeAria": "Fechar",
    "accept": "Entendi",
    "reconnect": "Reconectar",
    "reconnecting": "Reconectando…",
    "close": "Fechar",
    "sessionTitle": "Sessão expirada",
    "sessionDescription": "Sua sessão com {name} expirou. Reconecte para continuar de onde parou.",
    "sessionDescriptionNoName": "Sua sessão expirou. Reconecte para continuar de onde parou."
  },
  it: {
    "title": "Connessione interrotta",
    "description": "Impossibile connettersi a {name}. Verifica che il server sia disponibile e riprova.",
    "descriptionNoName": "Impossibile connettersi al server. Verifica che sia disponibile e riprova.",
    "closeAria": "Chiudi",
    "accept": "Ho capito",
    "reconnect": "Riconnetti",
    "reconnecting": "Riconnessione…",
    "close": "Chiudi",
    "sessionTitle": "Sessione scaduta",
    "sessionDescription": "La tua sessione con {name} è scaduta. Riconnettiti per riprendere da dove eri.",
    "sessionDescriptionNoName": "La tua sessione è scaduta. Riconnettiti per continuare da dove eri."
  },
  ru: {
    "title": "Соединение прервано",
    "description": "Не удалось подключиться к {name}. Убедитесь, что сервер доступен, и попробуйте снова.",
    "descriptionNoName": "Не удалось подключиться к серверу. Убедитесь, что он доступен, и попробуйте снова.",
    "closeAria": "Закрыть",
    "accept": "Понятно",
    "reconnect": "Переподключить",
    "reconnecting": "Переподключение…",
    "close": "Закрыть",
    "sessionTitle": "Сессия истекла",
    "sessionDescription": "Сессия с {name} истекла. Переподключитесь, чтобы продолжить с того же места.",
    "sessionDescriptionNoName": "Сессия истекла. Переподключитесь, чтобы продолжить с того же места."
  },
  zh: {
    "title": "连接已中断",
    "description": "无法连接到 {name}。请确认服务器可用后重试。",
    "descriptionNoName": "无法连接到服务器。请确认服务器可用后重试。",
    "closeAria": "关闭",
    "accept": "知道了",
    "reconnect": "重新连接",
    "reconnecting": "正在重新连接…",
    "close": "关闭",
    "sessionTitle": "会话已过期",
    "sessionDescription": "与 {name} 的会话已过期。重新连接以从上次的位置继续。",
    "sessionDescriptionNoName": "会话已过期。重新连接以从上次的位置继续。"
  },
  ko: {
    "title": "연결이 끊어졌습니다",
    "description": "{name}에 연결하지 못했습니다. 서버 상태를 확인한 뒤 다시 시도해 주세요.",
    "descriptionNoName": "서버에 연결하지 못했습니다. 서버 상태를 확인한 뒤 다시 시도해 주세요.",
    "closeAria": "닫기",
    "accept": "확인",
    "reconnect": "다시 연결",
    "reconnecting": "다시 연결 중…",
    "close": "닫기",
    "sessionTitle": "세션이 만료되었습니다",
    "sessionDescription": "{name}와의 세션이 만료되었습니다. 다시 연결하여 이어서 진행하세요.",
    "sessionDescriptionNoName": "세션이 만료되었습니다. 다시 연결하여 이어서 진행하세요."
  },
  ja: {
    "title": "接続が切断されました",
    "description": "{name} に接続できませんでした。サーバーが利用可能か確認のうえ、もう一度お試しください。",
    "descriptionNoName": "サーバーに接続できませんでした。利用可能か確認のうえ、もう一度お試しください。",
    "closeAria": "閉じる",
    "accept": "OK",
    "reconnect": "再接続",
    "reconnecting": "再接続中…",
    "close": "閉じる",
    "sessionTitle": "セッションの有効期限切れ",
    "sessionDescription": "{name} とのセッションが切れました。再接続して続きから操作してください。",
    "sessionDescriptionNoName": "セッションが切れました。再接続して続きから操作してください。"
  },
  hi: {
    "title": "कनेक्शन टूट गया",
    "description": "{name} से कनेक्ट नहीं हो सका। जाँच लें कि सर्वर उपलब्ध है और दोबारा कोशिश करें।",
    "descriptionNoName": "सर्वर से कनेक्ट नहीं हो सका। जाँच लें कि यह उपलब्ध है और दोबारा कोशिश करें।",
    "closeAria": "बंद करें",
    "accept": "समझ गया",
    "reconnect": "फिर से कनेक्ट करें",
    "reconnecting": "फिर से कनेक्ट हो रहा है…",
    "close": "बंद करें",
    "sessionTitle": "सत्र समाप्त हो गया",
    "sessionDescription": "{name} के साथ आपका सत्र समाप्त हो गया। जहाँ छोड़ा था वहीं से जारी रखने के लिए फिर से कनेक्ट करें।",
    "sessionDescriptionNoName": "आपका सत्र समाप्त हो गया। जहाँ छोड़ा था वहीं से जारी रखने के लिए फिर से कनेक्ट करें।"
  },
  ar: {
    "title": "انقطع الاتصال",
    "description": "تعذر الاتصال بـ {name}. تأكد من توفر الخادم وحاول مرة أخرى.",
    "descriptionNoName": "تعذر الاتصال بالخادم. تأكد من توفره وحاول مرة أخرى.",
    "closeAria": "إغلاق",
    "accept": "فهمت",
    "reconnect": "إعادة الاتصال",
    "reconnecting": "جارٍ إعادة الاتصال…",
    "close": "إغلاق",
    "sessionTitle": "انتهت الجلسة",
    "sessionDescription": "انتهت جلستك مع {name}. أعد الاتصال للمتابعة من حيث توقفت.",
    "sessionDescriptionNoName": "انتهت جلستك. أعد الاتصال للمتابعة من حيث توقفت."
  },
};
