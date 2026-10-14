import type { LocaleCode } from "../../locales";
import type { Widen } from "../_shared";

// Spanish is the source of truth; every other locale is checked against
// its widened shape, so missing/extra keys per screen surface as TS errors.
const es = {
  "eyebrow": "Sin conexión",
  "title": "Te has quedado sin internet",
  "message": "No detectamos conexión a la red. Volveremos automáticamente a donde estabas en cuanto se restablezca.",
  "retry": "Reintentar",
  "checking": "Comprobando conexión…",
  "waiting": "Esperando reconexión…"
} as const;

export type OfflineMessages = Widen<typeof es>;

export const offline: Record<LocaleCode, OfflineMessages> = {
  es,
  en: {
    "eyebrow": "No connection",
    "title": "You're offline",
    "message": "We can't detect a network connection. We'll bring you back to where you left off as soon as it's restored.",
    "retry": "Retry",
    "checking": "Checking connection…",
    "waiting": "Waiting for reconnection…"
  },
  fr: {
    "eyebrow": "Hors ligne",
    "title": "Vous êtes hors ligne",
    "message": "Aucune connexion réseau détectée. Nous vous ramènerons automatiquement à l'endroit où vous étiez dès qu'elle sera rétablie.",
    "retry": "Réessayer",
    "checking": "Vérification de la connexion…",
    "waiting": "En attente de reconnexion…"
  },
  pt: {
    "eyebrow": "Sem conexão",
    "title": "Você está sem internet",
    "message": "Não detectamos conexão com a rede. Assim que ela for restabelecida, voltaremos automaticamente para onde você estava.",
    "retry": "Tentar novamente",
    "checking": "Verificando conexão…",
    "waiting": "Aguardando reconexão…"
  },
  it: {
    "eyebrow": "Nessuna connessione",
    "title": "Sei offline",
    "message": "Non rileviamo una connessione di rete. Non appena sarà ripristinata, ti riporteremo automaticamente al punto in cui eri.",
    "retry": "Riprova",
    "checking": "Verifica connessione…",
    "waiting": "In attesa di riconnessione…"
  },
  ru: {
    "eyebrow": "Нет подключения",
    "title": "Соединение с интернетом потеряно",
    "message": "Подключение к сети не обнаружено. Как только связь восстановится, вы автоматически вернётесь туда, где остановились.",
    "retry": "Повторить",
    "checking": "Проверка подключения…",
    "waiting": "Ожидание переподключения…"
  },
  zh: {
    "eyebrow": "无连接",
    "title": "网络连接已断开",
    "message": "未检测到网络连接。连接恢复后将自动返回到您之前的位置。",
    "retry": "重试",
    "checking": "正在检查连接…",
    "waiting": "等待重新连接…"
  },
  ko: {
    "eyebrow": "연결 없음",
    "title": "인터넷 연결이 끊어졌습니다",
    "message": "네트워크 연결이 감지되지 않습니다. 연결이 복구되면 자동으로 이전 화면으로 돌아갑니다.",
    "retry": "다시 시도",
    "checking": "연결 확인 중…",
    "waiting": "재연결 대기 중…"
  },
  ja: {
    "eyebrow": "オフライン",
    "title": "インターネット接続が切断されました",
    "message": "ネットワーク接続を検出できません。接続が復旧次第、自動的に元の画面に戻ります。",
    "retry": "再試行",
    "checking": "接続を確認中…",
    "waiting": "再接続を待機中…"
  },
  hi: {
    "eyebrow": "ऑफ़लाइन",
    "title": "इंटरनेट कनेक्शन नहीं है",
    "message": "नेटवर्क कनेक्शन नहीं मिला। कनेक्शन वापस आते ही हम आपको वहीं ले जाएँगे जहाँ आप थे।",
    "retry": "पुनः प्रयास करें",
    "checking": "कनेक्शन जाँचा जा रहा है…",
    "waiting": "पुनः कनेक्शन की प्रतीक्षा में…"
  },
  ar: {
    "eyebrow": "غير متصل",
    "title": "لا يوجد اتصال بالإنترنت",
    "message": "لم نتمكن من اكتشاف اتصال بالشبكة. سنعيدك تلقائياً إلى حيث كنت بمجرد عودة الاتصال.",
    "retry": "إعادة المحاولة",
    "checking": "جارٍ التحقق من الاتصال…",
    "waiting": "في انتظار إعادة الاتصال…"
  },
};
