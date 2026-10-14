import type { LocaleCode } from "../../locales";
import type { Widen } from "../_shared";

// Spanish is the source of truth; every other locale is checked against
// its widened shape, so missing/extra keys per screen surface as TS errors.
const es = {
  "loading": "Cargando",
  "loadingPanel": "Cargando panel…",
  "connectingToServer": "Conectando con tu servidor",
  "panelUrlTitle": "Conectando al panel",
  "panelUrlLabel": "Abriendo",
  "panelUrlDismiss": "Entendido",
  "copyright": "© 2026 LUXISOFT. Todos los derechos reservados."
} as const;

export type SplashMessages = Widen<typeof es>;

export const splash: Record<LocaleCode, SplashMessages> = {
  es,
  en: {
    "loading": "Loading",
    "loadingPanel": "Loading panel…",
    "connectingToServer": "Connecting to your server",
    "panelUrlTitle": "Connecting to panel",
    "panelUrlLabel": "Opening",
    "panelUrlDismiss": "Got it",
    "copyright": "© 2026 LUXISOFT. All rights reserved."
  },
  fr: {
    "loading": "Chargement",
    "loadingPanel": "Chargement du panneau…",
    "connectingToServer": "Connexion à votre serveur",
    "panelUrlTitle": "Connexion au panneau",
    "panelUrlLabel": "Ouverture",
    "panelUrlDismiss": "Compris",
    "copyright": "© 2026 LUXISOFT. Tous droits réservés."
  },
  pt: {
    "loading": "Carregando",
    "loadingPanel": "Carregando painel…",
    "connectingToServer": "Conectando ao seu servidor",
    "panelUrlTitle": "Conectando ao painel",
    "panelUrlLabel": "Abrindo",
    "panelUrlDismiss": "Entendi",
    "copyright": "© 2026 LUXISOFT. Todos os direitos reservados."
  },
  it: {
    "loading": "Caricamento",
    "loadingPanel": "Caricamento pannello…",
    "connectingToServer": "Connessione al tuo server",
    "panelUrlTitle": "Connessione al pannello",
    "panelUrlLabel": "Apertura",
    "panelUrlDismiss": "Ho capito",
    "copyright": "© 2026 LUXISOFT. Tutti i diritti riservati."
  },
  ru: {
    "loading": "Загрузка",
    "loadingPanel": "Загрузка панели…",
    "connectingToServer": "Подключение к вашему серверу",
    "panelUrlTitle": "Подключение к панели",
    "panelUrlLabel": "Открытие",
    "panelUrlDismiss": "Понятно",
    "copyright": "© 2026 LUXISOFT. Все права защищены."
  },
  zh: {
    "loading": "加载中",
    "loadingPanel": "正在加载面板…",
    "connectingToServer": "正在连接到您的服务器",
    "panelUrlTitle": "正在连接面板",
    "panelUrlLabel": "正在打开",
    "panelUrlDismiss": "知道了",
    "copyright": "© 2026 LUXISOFT。保留所有权利。"
  },
  ko: {
    "loading": "로딩 중",
    "loadingPanel": "패널 로딩 중…",
    "connectingToServer": "서버에 연결하는 중",
    "panelUrlTitle": "패널에 연결 중",
    "panelUrlLabel": "여는 중",
    "panelUrlDismiss": "확인",
    "copyright": "© 2026 LUXISOFT. 모든 권리 보유."
  },
  ja: {
    "loading": "読み込み中",
    "loadingPanel": "パネルを読み込み中…",
    "connectingToServer": "サーバーに接続中",
    "panelUrlTitle": "パネルに接続中",
    "panelUrlLabel": "開いています",
    "panelUrlDismiss": "了解",
    "copyright": "© 2026 LUXISOFT. 無断複製・転載を禁じます。"
  },
  hi: {
    "loading": "लोड हो रहा है",
    "loadingPanel": "पैनल लोड हो रहा है…",
    "connectingToServer": "आपके सर्वर से कनेक्ट हो रहा है",
    "panelUrlTitle": "पैनल से कनेक्ट हो रहा है",
    "panelUrlLabel": "खोल रहे हैं",
    "panelUrlDismiss": "ठीक है",
    "copyright": "© 2026 LUXISOFT. सर्वाधिकार सुरक्षित।"
  },
  ar: {
    "loading": "جارٍ التحميل",
    "loadingPanel": "جارٍ تحميل اللوحة…",
    "connectingToServer": "جارٍ الاتصال بالخادم الخاص بك",
    "panelUrlTitle": "جارٍ الاتصال باللوحة",
    "panelUrlLabel": "جارٍ الفتح",
    "panelUrlDismiss": "حسناً",
    "copyright": "© 2026 LUXISOFT. جميع الحقوق محفوظة."
  },
};
