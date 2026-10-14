/** A visible page never changes when another two pages become available. */
export const PAGE_WINDOW_BATCH = 2;

export function initialWindow(pageSize: number): number {
  return Math.max(1, pageSize) * PAGE_WINDOW_BATCH;
}

export function windowAtPage(pageIndex: number, pageSize: number, available: number): number {
  const size = Math.max(1, pageSize);
  return pageIndex >= Math.max(0, Math.ceil(available / size) - 1)
    ? available + initialWindow(size)
    : available;
}

export type PageWindowSource = {
  total: number;
  version?: number;
  totals?: Record<string,number>;
  hasMore: boolean;
  loading: boolean;
  error?: string | null;
  onLoadMore: (pageSize?: number) => void;
};

const windowLabels: Record<string, readonly [string,string,string,string]> = {
  es:["Anterior","Siguiente","Página","Reintentar"],en:["Previous","Next","Page","Retry"],
  pt:["Anterior","Seguinte","Página","Tentar novamente"],fr:["Précédent","Suivant","Page","Réessayer"],
  de:["Zurück","Weiter","Seite","Erneut versuchen"],it:["Precedente","Successivo","Pagina","Riprova"],
  ru:["Назад","Далее","Страница","Повторить"],ar:["السابق","التالي","صفحة","إعادة المحاولة"],
  hi:["पिछला","अगला","पृष्ठ","फिर से कोशिश करें"],bn:["পূর্ববর্তী","পরবর্তী","পৃষ্ঠা","আবার চেষ্টা করুন"],
  ja:["前へ","次へ","ページ","再試行"],ko:["이전","다음","페이지","다시 시도"],
};
export function pageWindowLabels(language: string) {
  const [previous,next,page,retry] = windowLabels[language.split(/[-_]/)[0]!] ?? windowLabels.en!;
  return {previous,next,page,retry};
}
