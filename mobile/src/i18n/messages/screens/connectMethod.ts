import type { LocaleCode } from "../../locales";
import type { Widen } from "../_shared";

// Spanish is the source of truth; every other locale is checked against
// its widened shape, so missing/extra keys per screen surface as TS errors.
const es = {
  "description": "Elige cómo quieres conectarte a este servidor.",
  "savedTitle": "SSH guardada",
  "savedSub": "Usar las credenciales configuradas para este servidor",
  "localTitle": "Llave local",
  "localSub": "Ingresar usuario y llave privada manualmente (no se guarda)"
} as const;

export type ConnectMethodMessages = Widen<typeof es>;

export const connectMethod: Record<LocaleCode, ConnectMethodMessages> = {
  es,
  en: {
    "description": "Choose how you want to connect to this server.",
    "savedTitle": "Saved SSH",
    "savedSub": "Use the credentials configured for this server",
    "localTitle": "Local key",
    "localSub": "Enter username and private key manually (not stored)"
  },
  fr: {
    "description": "Choisissez comment vous souhaitez vous connecter à ce serveur.",
    "savedTitle": "SSH enregistrée",
    "savedSub": "Utiliser les identifiants configurés pour ce serveur",
    "localTitle": "Clé locale",
    "localSub": "Saisir l'utilisateur et la clé privée manuellement (non enregistrée)"
  },
  pt: {
    "description": "Escolha como deseja se conectar a este servidor.",
    "savedTitle": "SSH salva",
    "savedSub": "Usar as credenciais configuradas para este servidor",
    "localTitle": "Chave local",
    "localSub": "Inserir usuário e chave privada manualmente (não é armazenada)"
  },
  it: {
    "description": "Scegli come vuoi connetterti a questo server.",
    "savedTitle": "SSH salvata",
    "savedSub": "Usa le credenziali configurate per questo server",
    "localTitle": "Chiave locale",
    "localSub": "Inserisci manualmente utente e chiave privata (non viene salvata)"
  },
  ru: {
    "description": "Выберите, как вы хотите подключиться к этому серверу.",
    "savedTitle": "Сохранённый SSH",
    "savedSub": "Использовать учётные данные, настроенные для этого сервера",
    "localTitle": "Локальный ключ",
    "localSub": "Ввести пользователя и приватный ключ вручную (не сохраняется)"
  },
  zh: {
    "description": "选择你想如何连接到此服务器。",
    "savedTitle": "已保存的 SSH",
    "savedSub": "使用为此服务器配置的凭据",
    "localTitle": "本地密钥",
    "localSub": "手动输入用户名和私钥（不会保存）"
  },
  ko: {
    "description": "이 서버에 연결할 방법을 선택하세요.",
    "savedTitle": "저장된 SSH",
    "savedSub": "이 서버에 구성된 자격 증명 사용",
    "localTitle": "로컬 키",
    "localSub": "사용자 이름과 개인 키를 수동으로 입력(저장되지 않음)"
  },
  ja: {
    "description": "このサーバーへの接続方法を選択してください。",
    "savedTitle": "保存済み SSH",
    "savedSub": "このサーバー用に設定された認証情報を使用",
    "localTitle": "ローカルキー",
    "localSub": "ユーザー名と秘密鍵を手動で入力（保存されません）"
  },
  hi: {
    "description": "चुनें कि आप इस सर्वर से कैसे कनेक्ट करना चाहते हैं।",
    "savedTitle": "सेव की गई SSH",
    "savedSub": "इस सर्वर के लिए कॉन्फ़िगर किए गए क्रेडेंशियल्स का उपयोग करें",
    "localTitle": "लोकल की",
    "localSub": "यूज़रनेम और प्राइवेट की मैन्युअली दर्ज करें (सेव नहीं होती)"
  },
  ar: {
    "description": "اختر كيف تريد الاتصال بهذا الخادم.",
    "savedTitle": "SSH المحفوظ",
    "savedSub": "استخدام بيانات الاعتماد المُعدّة لهذا الخادم",
    "localTitle": "مفتاح محلي",
    "localSub": "إدخال اسم المستخدم والمفتاح الخاص يدويًا (لا يُحفظ)"
  },
};
