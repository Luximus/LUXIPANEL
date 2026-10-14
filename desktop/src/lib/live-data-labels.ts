const labels: Record<string, readonly [string, string, string, string, string]> = {
  es: ["Actualizado", "Datos anteriores", "Sin conexión", "Actualizando…", "Actualizar"],
  en: ["Up to date", "Older data", "Offline", "Updating…", "Refresh"],
  fr: ["À jour", "Données anciennes", "Hors ligne", "Actualisation…", "Actualiser"],
  de: ["Aktuell", "Ältere Daten", "Offline", "Wird aktualisiert…", "Aktualisieren"],
  it: ["Aggiornato", "Dati precedenti", "Offline", "Aggiornamento…", "Aggiorna"],
  pt: ["Atualizado", "Dados anteriores", "Sem conexão", "Atualizando…", "Atualizar"],
  ru: ["Обновлено", "Устаревшие данные", "Нет подключения", "Обновление…", "Обновить"],
  bn: ["হালনাগাদ", "পুরোনো তথ্য", "অফলাইন", "হালনাগাদ হচ্ছে…", "রিফ্রেশ"],
  ja: ["最新", "以前のデータ", "オフライン", "更新中…", "更新"],
  ko: ["최신 상태", "이전 데이터", "오프라인", "업데이트 중…", "새로고침"],
  ar: ["محدّث", "بيانات سابقة", "غير متصل", "جارٍ التحديث…", "تحديث"],
  hi: ["अद्यतित", "पुराना डेटा", "ऑफ़लाइन", "अपडेट हो रहा है…", "रीफ़्रेश करें"],
};
export function liveDataLabels(locale: string) {
  const [fresh, stale, offline, updating, refresh] = labels[locale.split(/[-_]/)[0] ?? "en"] ?? labels.en!;
  return {fresh, stale, offline, updating, refresh};
}
