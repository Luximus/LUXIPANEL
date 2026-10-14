export type HistorySearchStatus = { state: string; indexed: number; total: number };
const labels: Record<string, string> = {
  "ru": "Подготовка поиска: {indexed}/{total}. Результаты пока неполные.",
  "ko": "검색 준비 중: {indexed}/{total}. 결과가 아직 완전하지 않습니다.",
  "hi": "खोज तैयार हो रही है: {indexed}/{total}। परिणाम अभी अधूरे हैं।",
  "pt": "Preparando a pesquisa: {indexed}/{total}. Os resultados ainda estão incompletos.",
  "ar": "جارٍ إعداد البحث: {indexed}/{total}. النتائج غير مكتملة بعد.",
  "es": "Preparando búsqueda: {indexed}/{total}. Los resultados aún están incompletos.",
  "bn": "অনুসন্ধান প্রস্তুত হচ্ছে: {indexed}/{total}। ফলাফল এখনও অসম্পূর্ণ।",
  "fr": "Préparation de la recherche : {indexed}/{total}. Les résultats sont encore incomplets.",
  "en": "Preparing search: {indexed}/{total}. Results are still incomplete.",
  "de": "Suche wird vorbereitet: {indexed}/{total}. Die Ergebnisse sind noch unvollständig.",
  "it": "Preparazione della ricerca: {indexed}/{total}. I risultati sono ancora incompleti.",
  "ja": "検索を準備中：{indexed}/{total}。結果はまだ完全ではありません。"
};
export function historySearchLabel(locale: string, status: HistorySearchStatus) {
  return (labels[locale] ?? labels.en!).replace("{indexed}", String(status.indexed)).replace("{total}", String(status.total));
}
