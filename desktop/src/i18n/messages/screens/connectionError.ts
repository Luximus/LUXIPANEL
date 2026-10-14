import type { LocaleCode } from "../../locales";
import type { Widen } from "../_shared";

// Spanish is the source of truth; every other locale is checked against
// its widened shape, so missing/extra keys per screen surface as TS errors.
const es = {
  "title": "Conexión interrumpida",
  "description": "No se pudo conectar a {name}. Verifica que el servidor esté disponible e inténtalo de nuevo.",
  "descriptionNoName": "No se pudo conectar al servidor. Verifica que esté disponible e inténtalo de nuevo.",
  "descriptionShort": "No se pudo conectar a {name}.",
  "closeAria": "Cerrar",
  "accept": "Entendido"
} as const;

export type ConnectionErrorMessages = Widen<typeof es>;

export const connectionError: Record<LocaleCode, ConnectionErrorMessages> = {
  es,
  en: {
    "title": "Connection lost",
    "description": "Could not connect to {name}. Make sure the server is reachable and try again.",
    "descriptionNoName": "Could not connect to the server. Make sure it's reachable and try again.",
    "descriptionShort": "Couldn't connect to {name}.",
    "closeAria": "Close",
    "accept": "Got it"
  },
  fr: {
    "title": "Connexion perdue",
    "description": "Impossible de se connecter à {name}. Vérifiez que le serveur est accessible, puis réessayez.",
    "descriptionNoName": "Impossible de se connecter au serveur. Vérifiez qu'il est accessible, puis réessayez.",
    "descriptionShort": "Impossible de se connecter à {name}.",
    "closeAria": "Fermer",
    "accept": "Compris"
  },
  pt: {
    "title": "Conexão interrompida",
    "description": "Não foi possível conectar a {name}. Verifique se o servidor está disponível e tente novamente.",
    "descriptionNoName": "Não foi possível conectar ao servidor. Verifique se está disponível e tente novamente.",
    "descriptionShort": "Não foi possível conectar a {name}.",
    "closeAria": "Fechar",
    "accept": "Entendi"
  },
  it: {
    "title": "Connessione interrotta",
    "description": "Impossibile connettersi a {name}. Verifica che il server sia disponibile e riprova.",
    "descriptionNoName": "Impossibile connettersi al server. Verifica che sia disponibile e riprova.",
    "descriptionShort": "Impossibile connettersi a {name}.",
    "closeAria": "Chiudi",
    "accept": "Ho capito"
  },
  ru: {
    "title": "Соединение прервано",
    "description": "Не удалось подключиться к {name}. Убедитесь, что сервер доступен, и попробуйте снова.",
    "descriptionNoName": "Не удалось подключиться к серверу. Убедитесь, что он доступен, и попробуйте снова.",
    "descriptionShort": "Не удалось подключиться к {name}.",
    "closeAria": "Закрыть",
    "accept": "Понятно"
  },
  zh: {
    "title": "连接已中断",
    "description": "无法连接到 {name}。请确认服务器可用后重试。",
    "descriptionNoName": "无法连接到服务器。请确认服务器可用后重试。",
    "descriptionShort": "无法连接到 {name}。",
    "closeAria": "关闭",
    "accept": "知道了"
  },
  ko: {
    "title": "연결이 끊어졌습니다",
    "description": "{name}에 연결하지 못했습니다. 서버 상태를 확인한 뒤 다시 시도해 주세요.",
    "descriptionNoName": "서버에 연결하지 못했습니다. 서버 상태를 확인한 뒤 다시 시도해 주세요.",
    "descriptionShort": "{name}에 연결할 수 없습니다.",
    "closeAria": "닫기",
    "accept": "확인"
  },
  ja: {
    "title": "接続が切断されました",
    "description": "{name} に接続できませんでした。サーバーが利用可能か確認のうえ、もう一度お試しください。",
    "descriptionNoName": "サーバーに接続できませんでした。利用可能か確認のうえ、もう一度お試しください。",
    "descriptionShort": "{name} に接続できませんでした。",
    "closeAria": "閉じる",
    "accept": "OK"
  },
  hi: {
    "title": "कनेक्शन टूट गया",
    "description": "{name} से कनेक्ट नहीं हो सका। जाँच लें कि सर्वर उपलब्ध है और दोबारा कोशिश करें।",
    "descriptionNoName": "सर्वर से कनेक्ट नहीं हो सका। जाँच लें कि यह उपलब्ध है और दोबारा कोशिश करें।",
    "descriptionShort": "{name} से कनेक्ट नहीं हो सका।",
    "closeAria": "बंद करें",
    "accept": "समझ गया"
  },
  ar: {
    "title": "انقطع الاتصال",
    "description": "تعذر الاتصال بـ {name}. تأكد من توفر الخادم وحاول مرة أخرى.",
    "descriptionNoName": "تعذر الاتصال بالخادم. تأكد من توفره وحاول مرة أخرى.",
    "descriptionShort": "تعذّر الاتصال بـ {name}.",
    "closeAria": "إغلاق",
    "accept": "فهمت"
  },
};
