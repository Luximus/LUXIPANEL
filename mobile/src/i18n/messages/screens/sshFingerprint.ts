import type { LocaleCode } from "../../locales";
import type { Widen } from "../_shared";

// Spanish is the source of truth; every other locale is checked against
// its widened shape, so missing/extra keys per screen surface as TS errors.
const es = {
  "title": "Verificar host SSH",
  "body": "Primera conexión a este servidor SSH.\n\nHuella del host:\n{fingerprint}\n\nVerifica que coincide con tu servidor y confirma para continuar.",
  "confirm": "Confirmar"
} as const;

export type SshFingerprintMessages = Widen<typeof es>;

export const sshFingerprint: Record<LocaleCode, SshFingerprintMessages> = {
  es,
  en: {
    "title": "Verify SSH host",
    "body": "First connection to this SSH server.\n\nHost fingerprint:\n{fingerprint}\n\nMake sure it matches your server and confirm to continue.",
    "confirm": "Confirm"
  },
  fr: {
    "title": "Vérifier l'hôte SSH",
    "body": "Première connexion à ce serveur SSH.\n\nEmpreinte de l'hôte :\n{fingerprint}\n\nVérifiez qu'elle correspond à votre serveur et confirmez pour continuer.",
    "confirm": "Confirmer"
  },
  pt: {
    "title": "Verificar host SSH",
    "body": "Primeira conexão a este servidor SSH.\n\nImpressão digital do host:\n{fingerprint}\n\nVerifique se corresponde ao seu servidor e confirme para continuar.",
    "confirm": "Confirmar"
  },
  it: {
    "title": "Verifica host SSH",
    "body": "Prima connessione a questo server SSH.\n\nImpronta dell'host:\n{fingerprint}\n\nVerifica che corrisponda al tuo server e conferma per continuare.",
    "confirm": "Conferma"
  },
  ru: {
    "title": "Проверка SSH-хоста",
    "body": "Первое подключение к этому SSH-серверу.\n\nОтпечаток хоста:\n{fingerprint}\n\nУбедитесь, что он соответствует вашему серверу, и подтвердите для продолжения.",
    "confirm": "Подтвердить"
  },
  zh: {
    "title": "验证 SSH 主机",
    "body": "首次连接到此 SSH 服务器。\n\n主机指纹：\n{fingerprint}\n\n请确认它与你的服务器一致，然后确认以继续。",
    "confirm": "确认"
  },
  ko: {
    "title": "SSH 호스트 확인",
    "body": "이 SSH 서버에 처음 연결합니다.\n\n호스트 지문:\n{fingerprint}\n\n사용 중인 서버와 일치하는지 확인한 후 계속하려면 확인하세요.",
    "confirm": "확인"
  },
  ja: {
    "title": "SSHホストを確認",
    "body": "このSSHサーバーへの初回接続です。\n\nホストのフィンガープリント:\n{fingerprint}\n\nお使いのサーバーと一致することを確認し、続行するには承認してください。",
    "confirm": "確認"
  },
  hi: {
    "title": "SSH होस्ट सत्यापित करें",
    "body": "इस SSH सर्वर से पहला कनेक्शन।\n\nहोस्ट फिंगरप्रिंट:\n{fingerprint}\n\nसुनिश्चित करें कि यह आपके सर्वर से मेल खाता है और जारी रखने के लिए पुष्टि करें।",
    "confirm": "पुष्टि करें"
  },
  ar: {
    "title": "التحقق من مضيف SSH",
    "body": "أول اتصال بخادم SSH هذا.\n\nبصمة المضيف:\n{fingerprint}\n\nتأكد من تطابقها مع خادمك وأكّد للمتابعة.",
    "confirm": "تأكيد"
  },
};
