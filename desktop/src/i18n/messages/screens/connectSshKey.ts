import type { LocaleCode } from "../../locales";
import type { Widen } from "../_shared";

// Spanish is the source of truth; every other locale is checked against
// its widened shape, so missing/extra keys per screen surface as TS errors.
const es = {
  "title": "Elegir llave SSH",
  "description": "Este panel tiene varias llaves SSH asignadas. Elige con cuál conectar."
} as const;

export type ConnectSshKeyMessages = Widen<typeof es>;

export const connectSshKey: Record<LocaleCode, ConnectSshKeyMessages> = {
  es,
  en: {
    "title": "Choose SSH key",
    "description": "This panel has several SSH keys assigned. Choose which one to connect with."
  },
  fr: {
    "title": "Choisir une clé SSH",
    "description": "Ce panneau a plusieurs clés SSH attribuées. Choisissez avec laquelle vous connecter."
  },
  pt: {
    "title": "Escolher chave SSH",
    "description": "Este painel tem várias chaves SSH atribuídas. Escolha com qual conectar."
  },
  it: {
    "title": "Scegli chiave SSH",
    "description": "Questo pannello ha diverse chiavi SSH assegnate. Scegli con quale connetterti."
  },
  ru: {
    "title": "Выбрать ключ SSH",
    "description": "Этой панели назначено несколько ключей SSH. Выберите, каким из них подключиться."
  },
  zh: {
    "title": "选择 SSH 密钥",
    "description": "此面板已分配多个 SSH 密钥。请选择用于连接的密钥。"
  },
  ko: {
    "title": "SSH 키 선택",
    "description": "이 패널에는 여러 SSH 키가 할당되어 있습니다. 연결할 키를 선택하세요."
  },
  ja: {
    "title": "SSH キーを選択",
    "description": "このパネルには複数の SSH キーが割り当てられています。接続に使用するキーを選択してください。"
  },
  hi: {
    "title": "SSH की चुनें",
    "description": "इस पैनल को कई SSH कीज़ असाइन की गई हैं। चुनें कि किससे कनेक्ट करना है।"
  },
  ar: {
    "title": "اختيار مفتاح SSH",
    "description": "هذه اللوحة لديها عدة مفاتيح SSH مُسندة. اختر المفتاح الذي تريد الاتصال به."
  },
};
