import type { LocaleCode } from "../../locales";
import type { Widen } from "../_shared";

// Spanish is the source of truth; every other locale is checked against
// its widened shape, so missing/extra keys per screen surface as TS errors.
const es = {
  "goToServers": "Ir a Servidores",
  "newTab": "Nueva pestaña",
  "minimize": "Minimizar",
  "maximize": "Maximizar / Restaurar",
  "close": "Cerrar",
  "logoAlt": "Luxipanel",
  "fabHome": "Inicio",
  "fabServers": "Servidores",
  "fabSupport": "Soporte",
  "fabSecurity": "Seguridad",
  "fabPayments": "Pagos",
  "fabConfig": "Configuración"
} as const;

export type TitleBarMessages = Widen<typeof es>;

export const titleBar: Record<LocaleCode, TitleBarMessages> = {
  es,
  en: {
    "goToServers": "Go to Servers",
    "newTab": "New tab",
    "minimize": "Minimize",
    "maximize": "Maximize / Restore",
    "close": "Close",
    "logoAlt": "Luxipanel",
    "fabHome": "Home",
    "fabServers": "Servers",
    "fabSupport": "Support",
    "fabSecurity": "Security",
    "fabPayments": "Payments",
    "fabConfig": "Configuration"
  },
  fr: {
    "goToServers": "Aller aux Serveurs",
    "newTab": "Nouvel onglet",
    "minimize": "Réduire",
    "maximize": "Agrandir / Restaurer",
    "close": "Fermer",
    "logoAlt": "Luxipanel",
    "fabHome": "Accueil",
    "fabServers": "Serveurs",
    "fabSupport": "Support",
    "fabSecurity": "Sécurité",
    "fabPayments": "Paiements",
    "fabConfig": "Configuration"
  },
  pt: {
    "goToServers": "Ir para Servidores",
    "newTab": "Nova aba",
    "minimize": "Minimizar",
    "maximize": "Maximizar / Restaurar",
    "close": "Fechar",
    "logoAlt": "Luxipanel",
    "fabHome": "Início",
    "fabServers": "Servidores",
    "fabSupport": "Suporte",
    "fabSecurity": "Segurança",
    "fabPayments": "Pagamentos",
    "fabConfig": "Configuração"
  },
  it: {
    "goToServers": "Vai a Server",
    "newTab": "Nuova scheda",
    "minimize": "Riduci a icona",
    "maximize": "Ingrandisci / Ripristina",
    "close": "Chiudi",
    "logoAlt": "Luxipanel",
    "fabHome": "Home",
    "fabServers": "Server",
    "fabSupport": "Supporto",
    "fabSecurity": "Sicurezza",
    "fabPayments": "Pagamenti",
    "fabConfig": "Configurazione"
  },
  ru: {
    "goToServers": "Перейти к серверам",
    "newTab": "Новая вкладка",
    "minimize": "Свернуть",
    "maximize": "Развернуть / Восстановить",
    "close": "Закрыть",
    "logoAlt": "Luxipanel",
    "fabHome": "Главная",
    "fabServers": "Серверы",
    "fabSupport": "Поддержка",
    "fabSecurity": "Безопасность",
    "fabPayments": "Платежи",
    "fabConfig": "Настройки"
  },
  zh: {
    "goToServers": "前往服务器",
    "newTab": "新标签页",
    "minimize": "最小化",
    "maximize": "最大化 / 还原",
    "close": "关闭",
    "logoAlt": "Luxipanel",
    "fabHome": "首页",
    "fabServers": "服务器",
    "fabSupport": "支持",
    "fabSecurity": "安全",
    "fabPayments": "支付",
    "fabConfig": "配置"
  },
  ko: {
    "goToServers": "서버로 이동",
    "newTab": "새 탭",
    "minimize": "최소화",
    "maximize": "최대화 / 복원",
    "close": "닫기",
    "logoAlt": "Luxipanel",
    "fabHome": "홈",
    "fabServers": "서버",
    "fabSupport": "지원",
    "fabSecurity": "보안",
    "fabPayments": "결제",
    "fabConfig": "구성"
  },
  ja: {
    "goToServers": "サーバーへ移動",
    "newTab": "新しいタブ",
    "minimize": "最小化",
    "maximize": "最大化 / 復元",
    "close": "閉じる",
    "logoAlt": "Luxipanel",
    "fabHome": "ホーム",
    "fabServers": "サーバー",
    "fabSupport": "サポート",
    "fabSecurity": "セキュリティ",
    "fabPayments": "支払い",
    "fabConfig": "設定"
  },
  hi: {
    "goToServers": "सर्वर पर जाएं",
    "newTab": "नया टैब",
    "minimize": "मिनिमाइज़ करें",
    "maximize": "मैक्सिमाइज़ / रिस्टोर करें",
    "close": "बंद करें",
    "logoAlt": "Luxipanel",
    "fabHome": "होम",
    "fabServers": "सर्वर",
    "fabSupport": "सहायता",
    "fabSecurity": "सुरक्षा",
    "fabPayments": "भुगतान",
    "fabConfig": "कॉन्फ़िगरेशन"
  },
  ar: {
    "goToServers": "الانتقال إلى الخوادم",
    "newTab": "علامة تبويب جديدة",
    "minimize": "تصغير",
    "maximize": "تكبير / استعادة",
    "close": "إغلاق",
    "logoAlt": "Luxipanel",
    "fabHome": "الرئيسية",
    "fabServers": "الخوادم",
    "fabSupport": "الدعم",
    "fabSecurity": "الأمان",
    "fabPayments": "المدفوعات",
    "fabConfig": "الإعدادات"
  },
};
