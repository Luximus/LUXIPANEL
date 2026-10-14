import type { LocaleCode } from "../../locales";
import type { Widen } from "../_shared";

// Spanish is the source of truth; every other locale is checked against
// its widened shape, so missing/extra keys per screen surface as TS errors.
const es = {
  "configure": "Configurar",
  "actions": "Acciones",
  "selectPageAria": "Seleccionar página",
  "selectRowAria": "Seleccionar fila",
  "prevPageAria": "Página anterior",
  "nextPageAria": "Página siguiente",
  "noResultsFor": "No hay resultados para {title}.",
  "selectedAndShowing": "{selected} seleccionados | Mostrando {from}-{to} de {total} resultados",
  "showing": "Mostrando {from}-{to} de {total} resultados",
  "noTags": "sin tags",
  "total": "Total"
} as const;

export type DataTableMessages = Widen<typeof es>;

export const dataTable: Record<LocaleCode, DataTableMessages> = {
  es,
  en: {
    "configure": "Configure",
    "actions": "Actions",
    "selectPageAria": "Select page",
    "selectRowAria": "Select row",
    "prevPageAria": "Previous page",
    "nextPageAria": "Next page",
    "noResultsFor": "No results for {title}.",
    "selectedAndShowing": "{selected} selected · Showing {from}-{to} of {total} results",
    "showing": "Showing {from}-{to} of {total} results",
    "noTags": "no tags",
    "total": "Total"
  },
  fr: {
    "configure": "Configurer",
    "actions": "Actions",
    "selectPageAria": "Sélectionner la page",
    "selectRowAria": "Sélectionner la ligne",
    "prevPageAria": "Page précédente",
    "nextPageAria": "Page suivante",
    "noResultsFor": "Aucun résultat pour {title}.",
    "selectedAndShowing": "{selected} sélectionné(s) · Affichage de {from}-{to} sur {total} résultats",
    "showing": "Affichage de {from}-{to} sur {total} résultats",
    "noTags": "sans tags",
    "total": "Total"
  },
  pt: {
    "configure": "Configurar",
    "actions": "Ações",
    "selectPageAria": "Selecionar página",
    "selectRowAria": "Selecionar linha",
    "prevPageAria": "Página anterior",
    "nextPageAria": "Próxima página",
    "noResultsFor": "Sem resultados para {title}.",
    "selectedAndShowing": "{selected} selecionados | Exibindo {from}-{to} de {total} resultados",
    "showing": "Exibindo {from}-{to} de {total} resultados",
    "noTags": "sem tags",
    "total": "Total"
  },
  it: {
    "configure": "Configura",
    "actions": "Azioni",
    "selectPageAria": "Seleziona pagina",
    "selectRowAria": "Seleziona riga",
    "prevPageAria": "Pagina precedente",
    "nextPageAria": "Pagina successiva",
    "noResultsFor": "Nessun risultato per {title}.",
    "selectedAndShowing": "{selected} selezionati | Mostrando {from}-{to} di {total} risultati",
    "showing": "Mostrando {from}-{to} di {total} risultati",
    "noTags": "senza tag",
    "total": "Totale"
  },
  ru: {
    "configure": "Настроить",
    "actions": "Действия",
    "selectPageAria": "Выбрать страницу",
    "selectRowAria": "Выбрать строку",
    "prevPageAria": "Предыдущая страница",
    "nextPageAria": "Следующая страница",
    "noResultsFor": "Нет результатов для {title}.",
    "selectedAndShowing": "Выбрано: {selected} | Показано {from}–{to} из {total}",
    "showing": "Показано {from}–{to} из {total}",
    "noTags": "без тегов",
    "total": "Итого"
  },
  zh: {
    "configure": "配置",
    "actions": "操作",
    "selectPageAria": "选择页面",
    "selectRowAria": "选择行",
    "prevPageAria": "上一页",
    "nextPageAria": "下一页",
    "noResultsFor": "未找到 {title} 的结果。",
    "selectedAndShowing": "已选择 {selected} 项 | 显示第 {from}-{to} 项,共 {total} 项",
    "showing": "显示第 {from}-{to} 项,共 {total} 项",
    "noTags": "无标签",
    "total": "合计"
  },
  ko: {
    "configure": "설정",
    "actions": "작업",
    "selectPageAria": "페이지 선택",
    "selectRowAria": "행 선택",
    "prevPageAria": "이전 페이지",
    "nextPageAria": "다음 페이지",
    "noResultsFor": "{title}에 대한 결과가 없습니다.",
    "selectedAndShowing": "{selected}개 선택됨 | 전체 {total}개 중 {from}–{to} 표시",
    "showing": "전체 {total}개 중 {from}–{to} 표시",
    "noTags": "태그 없음",
    "total": "합계"
  },
  ja: {
    "configure": "設定",
    "actions": "アクション",
    "selectPageAria": "ページを選択",
    "selectRowAria": "行を選択",
    "prevPageAria": "前のページ",
    "nextPageAria": "次のページ",
    "noResultsFor": "{title} に該当する結果はありません。",
    "selectedAndShowing": "{selected} 件選択中 | 全 {total} 件中 {from}–{to} 件を表示",
    "showing": "全 {total} 件中 {from}–{to} 件を表示",
    "noTags": "タグなし",
    "total": "合計"
  },
  hi: {
    "configure": "कॉन्फ़िगर करें",
    "actions": "क्रियाएँ",
    "selectPageAria": "पेज चुनें",
    "selectRowAria": "पंक्ति चुनें",
    "prevPageAria": "पिछला पेज",
    "nextPageAria": "अगला पेज",
    "noResultsFor": "{title} के लिए कोई परिणाम नहीं।",
    "selectedAndShowing": "{selected} चुने गए | कुल {total} में से {from}-{to} दिखाए जा रहे हैं",
    "showing": "कुल {total} में से {from}-{to} दिखाए जा रहे हैं",
    "noTags": "कोई टैग नहीं",
    "total": "कुल"
  },
  ar: {
    "configure": "تكوين",
    "actions": "الإجراءات",
    "selectPageAria": "تحديد الصفحة",
    "selectRowAria": "تحديد الصف",
    "prevPageAria": "الصفحة السابقة",
    "nextPageAria": "الصفحة التالية",
    "noResultsFor": "لا توجد نتائج لـ {title}.",
    "selectedAndShowing": "محدَّد: {selected} | عرض {from}-{to} من أصل {total}",
    "showing": "عرض {from}-{to} من أصل {total}",
    "noTags": "بدون وسوم",
    "total": "الإجمالي"
  },
};
