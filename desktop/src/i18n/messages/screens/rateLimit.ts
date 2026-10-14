import type { LocaleCode } from "../../locales";
import type { Widen } from "../_shared";

// Modal global de límite de peticiones (HTTP 429). `{time}` se sustituye en
// runtime por una cuenta atrás m:ss (p. ej. "14:59"), así que no necesita
// unidades traducidas. Spanish es la fuente de verdad. El modal NO se puede
// cerrar durante la cuenta atrás; al terminar aparece el botón `reload` que
// recarga la pantalla/SPA para refrescar los datos.
const es = {
  "title": "Demasiadas solicitudes",
  "description": "El servidor está limitando temporalmente las solicitudes para protegerse. Espera un momento antes de volver a intentarlo.",
  "retryIn": "Podrás reintentar en {time}.",
  "ready": "Ya puedes reintentar.",
  "closeAria": "Cerrar",
  "reload": "Recargar"
} as const;

export type RateLimitMessages = Widen<typeof es>;

export const rateLimit: Record<LocaleCode, RateLimitMessages> = {
  es,
  en: {
    "title": "Too many requests",
    "description": "The server is temporarily limiting requests to protect itself. Please wait a moment before trying again.",
    "retryIn": "You can retry in {time}.",
    "ready": "You can retry now.",
    "closeAria": "Close",
    "reload": "Reload"
  },
  fr: {
    "title": "Trop de requêtes",
    "description": "Le serveur limite temporairement les requêtes pour se protéger. Patientez un instant avant de réessayer.",
    "retryIn": "Vous pourrez réessayer dans {time}.",
    "ready": "Vous pouvez réessayer.",
    "closeAria": "Fermer",
    "reload": "Recharger"
  },
  pt: {
    "title": "Muitas solicitações",
    "description": "O servidor está limitando temporariamente as solicitações para se proteger. Aguarde um momento antes de tentar novamente.",
    "retryIn": "Você poderá tentar novamente em {time}.",
    "ready": "Já pode tentar novamente.",
    "closeAria": "Fechar",
    "reload": "Recarregar"
  },
  it: {
    "title": "Troppe richieste",
    "description": "Il server sta limitando temporaneamente le richieste per proteggersi. Attendi un momento prima di riprovare.",
    "retryIn": "Potrai riprovare tra {time}.",
    "ready": "Ora puoi riprovare.",
    "closeAria": "Chiudi",
    "reload": "Ricarica"
  },
  ru: {
    "title": "Слишком много запросов",
    "description": "Сервер временно ограничивает запросы для защиты. Подождите немного, прежде чем повторить попытку.",
    "retryIn": "Повторить можно через {time}.",
    "ready": "Теперь можно повторить.",
    "closeAria": "Закрыть",
    "reload": "Обновить"
  },
  zh: {
    "title": "请求过多",
    "description": "服务器正在临时限制请求以保护自身。请稍候片刻再重试。",
    "retryIn": "{time} 后可重试。",
    "ready": "现在可以重试了。",
    "closeAria": "关闭",
    "reload": "重新加载"
  },
  ko: {
    "title": "요청이 너무 많습니다",
    "description": "서버가 보호를 위해 일시적으로 요청을 제한하고 있습니다. 잠시 후 다시 시도해 주세요.",
    "retryIn": "{time} 후에 다시 시도할 수 있습니다.",
    "ready": "이제 다시 시도할 수 있습니다.",
    "closeAria": "닫기",
    "reload": "새로고침"
  },
  ja: {
    "title": "リクエストが多すぎます",
    "description": "サーバーが保護のため一時的にリクエストを制限しています。少し待ってから再試行してください。",
    "retryIn": "{time} 後に再試行できます。",
    "ready": "再試行できます。",
    "closeAria": "閉じる",
    "reload": "再読み込み"
  },
  hi: {
    "title": "बहुत अधिक अनुरोध",
    "description": "सर्वर स्वयं की सुरक्षा के लिए अस्थायी रूप से अनुरोध सीमित कर रहा है। दोबारा कोशिश करने से पहले कुछ देर प्रतीक्षा करें।",
    "retryIn": "आप {time} में दोबारा कोशिश कर सकते हैं।",
    "ready": "अब आप दोबारा कोशिश कर सकते हैं।",
    "closeAria": "बंद करें",
    "reload": "रीलोड करें"
  },
  ar: {
    "title": "طلبات كثيرة جدًا",
    "description": "يقوم الخادم بتقييد الطلبات مؤقتًا لحماية نفسه. انتظر لحظة قبل المحاولة مرة أخرى.",
    "retryIn": "يمكنك إعادة المحاولة خلال {time}.",
    "ready": "يمكنك إعادة المحاولة الآن.",
    "closeAria": "إغلاق",
    "reload": "إعادة التحميل"
  },
};
