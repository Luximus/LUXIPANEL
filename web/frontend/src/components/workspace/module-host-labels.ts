const LABELS: Record<string, { unavailable: string; retry: string }> = {
  es: { unavailable: "No se pudo cargar el módulo.", retry: "Reintentar" },
  en: { unavailable: "The module could not be loaded.", retry: "Retry" },
  fr: { unavailable: "Impossible de charger le module.", retry: "Réessayer" },
  de: {
    unavailable: "Das Modul konnte nicht geladen werden.",
    retry: "Erneut versuchen",
  },
  it: { unavailable: "Impossibile caricare il modulo.", retry: "Riprova" },
  pt: {
    unavailable: "Não foi possível carregar o módulo.",
    retry: "Tentar novamente",
  },
  ar: { unavailable: "تعذر تحميل الوحدة.", retry: "إعادة المحاولة" },
  bn: { unavailable: "মডিউল লোড করা যায়নি।", retry: "আবার চেষ্টা করুন" },
  hi: { unavailable: "मॉड्यूल लोड नहीं हो सका।", retry: "पुनः प्रयास करें" },
  ja: { unavailable: "モジュールを読み込めませんでした。", retry: "再試行" },
  ko: { unavailable: "모듈을 불러올 수 없습니다.", retry: "다시 시도" },
  ru: { unavailable: "Не удалось загрузить модуль.", retry: "Повторить" },
};
export const moduleHostLabels = (locale: string) => LABELS[locale] || LABELS.en;
