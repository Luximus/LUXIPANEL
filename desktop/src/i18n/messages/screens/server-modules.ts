import type { LocaleCode } from "../../locales";
import type { Widen } from "../_shared";

/** Vista Módulos (mostrar/ocultar + reordenar en el menú). `es` fuente + `en`; resto fallback. */
const es = {
  "pageTitle": "Módulos",
  "subtitle": "Muestra, oculta y reordena los módulos del menú lateral",
  "search": "Buscar módulo...",
  "statusVisible": "Visible en el menú",
  "statusHidden": "Oculto",
  "empty": "No hay módulos.",
  "moveUp": "Subir",
  "moveDown": "Bajar",
  "orderSave": "Guardar orden",
  "orderUnsaved": "Tienes cambios de orden sin guardar",
  "reorderSearchHint": "Borra la búsqueda para reordenar los módulos",
  "loadError": "No se pudieron cargar los módulos",
  "toasts": { "saved": "Actualizado", "error": "No se pudo actualizar", "orderSaved": "Orden actualizado", "orderError": "No se pudo guardar el orden" },
} as const;

export type ServerModulesViewMessages = Widen<typeof es>;

const en: ServerModulesViewMessages = {
  "pageTitle": "Modules",
  "subtitle": "Show, hide and reorder modules in the sidebar",
  "search": "Search module...",
  "statusVisible": "Visible in menu",
  "statusHidden": "Hidden",
  "empty": "No modules.",
  "moveUp": "Move up",
  "moveDown": "Move down",
  "orderSave": "Save order",
  "orderUnsaved": "You have unsaved order changes",
  "reorderSearchHint": "Clear the search to reorder modules",
  "loadError": "Could not load modules",
  "toasts": { "saved": "Updated", "error": "Could not update", "orderSaved": "Order updated", "orderError": "Could not save order" },
};

const fr: ServerModulesViewMessages = {
  "pageTitle": "Modules",
  "subtitle": "Affichez, masquez et réorganisez les modules de la barre latérale",
  "search": "Rechercher un module...",
  "statusVisible": "Visible dans le menu",
  "statusHidden": "Masqué",
  "empty": "Aucun module.",
  "moveUp": "Monter",
  "moveDown": "Descendre",
  "orderSave": "Enregistrer l'ordre",
  "orderUnsaved": "Vous avez des modifications d'ordre non enregistrées",
  "reorderSearchHint": "Effacez la recherche pour réorganiser les modules",
  "loadError": "Impossible de charger les modules",
  "toasts": { "saved": "Mis à jour", "error": "Impossible de mettre à jour", "orderSaved": "Ordre mis à jour", "orderError": "Impossible d'enregistrer l'ordre" },
};

const pt: ServerModulesViewMessages = {
  "pageTitle": "Módulos",
  "subtitle": "Mostre, oculte e reordene os módulos da barra lateral",
  "search": "Buscar módulo...",
  "statusVisible": "Visível no menu",
  "statusHidden": "Oculto",
  "empty": "Nenhum módulo.",
  "moveUp": "Subir",
  "moveDown": "Descer",
  "orderSave": "Salvar ordem",
  "orderUnsaved": "Você tem alterações de ordem não salvas",
  "reorderSearchHint": "Limpe a busca para reordenar os módulos",
  "loadError": "Não foi possível carregar os módulos",
  "toasts": { "saved": "Atualizado", "error": "Não foi possível atualizar", "orderSaved": "Ordem atualizada", "orderError": "Não foi possível salvar a ordem" },
};

const it: ServerModulesViewMessages = {
  "pageTitle": "Moduli",
  "subtitle": "Mostra, nascondi e riordina i moduli nella barra laterale",
  "search": "Cerca modulo...",
  "statusVisible": "Visibile nel menu",
  "statusHidden": "Nascosto",
  "empty": "Nessun modulo.",
  "moveUp": "Sposta su",
  "moveDown": "Sposta giù",
  "orderSave": "Salva ordine",
  "orderUnsaved": "Hai modifiche all'ordine non salvate",
  "reorderSearchHint": "Cancella la ricerca per riordinare i moduli",
  "loadError": "Impossibile caricare i moduli",
  "toasts": { "saved": "Aggiornato", "error": "Impossibile aggiornare", "orderSaved": "Ordine aggiornato", "orderError": "Impossibile salvare l'ordine" },
};

const ru: ServerModulesViewMessages = {
  "pageTitle": "Модули",
  "subtitle": "Показывайте, скрывайте и меняйте порядок модулей в боковой панели",
  "search": "Поиск модуля...",
  "statusVisible": "Виден в меню",
  "statusHidden": "Скрыт",
  "empty": "Нет модулей.",
  "moveUp": "Вверх",
  "moveDown": "Вниз",
  "orderSave": "Сохранить порядок",
  "orderUnsaved": "У вас есть несохранённые изменения порядка",
  "reorderSearchHint": "Очистите поиск, чтобы изменить порядок модулей",
  "loadError": "Не удалось загрузить модули",
  "toasts": { "saved": "Обновлено", "error": "Не удалось обновить", "orderSaved": "Порядок обновлён", "orderError": "Не удалось сохранить порядок" },
};

const zh: ServerModulesViewMessages = {
  "pageTitle": "模块",
  "subtitle": "在侧边栏中显示、隐藏和重新排序模块",
  "search": "搜索模块...",
  "statusVisible": "在菜单中可见",
  "statusHidden": "已隐藏",
  "empty": "没有模块。",
  "moveUp": "上移",
  "moveDown": "下移",
  "orderSave": "保存顺序",
  "orderUnsaved": "您有未保存的顺序更改",
  "reorderSearchHint": "清除搜索以重新排序模块",
  "loadError": "无法加载模块",
  "toasts": { "saved": "已更新", "error": "无法更新", "orderSaved": "顺序已更新", "orderError": "无法保存顺序" },
};

const ko: ServerModulesViewMessages = {
  "pageTitle": "모듈",
  "subtitle": "사이드바에서 모듈을 표시, 숨기기 및 순서 변경",
  "search": "모듈 검색...",
  "statusVisible": "메뉴에 표시됨",
  "statusHidden": "숨김",
  "empty": "모듈이 없습니다.",
  "moveUp": "위로",
  "moveDown": "아래로",
  "orderSave": "순서 저장",
  "orderUnsaved": "저장되지 않은 순서 변경 사항이 있습니다",
  "reorderSearchHint": "검색을 지워 모듈 순서를 변경하세요",
  "loadError": "모듈을 불러올 수 없습니다",
  "toasts": { "saved": "업데이트됨", "error": "업데이트할 수 없습니다", "orderSaved": "순서가 업데이트됨", "orderError": "순서를 저장할 수 없습니다" },
};

const ja: ServerModulesViewMessages = {
  "pageTitle": "モジュール",
  "subtitle": "サイドバーのモジュールを表示、非表示、並べ替えます",
  "search": "モジュールを検索...",
  "statusVisible": "メニューに表示",
  "statusHidden": "非表示",
  "empty": "モジュールがありません。",
  "moveUp": "上へ",
  "moveDown": "下へ",
  "orderSave": "順序を保存",
  "orderUnsaved": "保存されていない順序の変更があります",
  "reorderSearchHint": "検索をクリアしてモジュールを並べ替えます",
  "loadError": "モジュールを読み込めませんでした",
  "toasts": { "saved": "更新しました", "error": "更新できませんでした", "orderSaved": "順序を更新しました", "orderError": "順序を保存できませんでした" },
};

const hi: ServerModulesViewMessages = {
  "pageTitle": "मॉड्यूल",
  "subtitle": "साइडबार में मॉड्यूल दिखाएं, छिपाएं और पुनः क्रमबद्ध करें",
  "search": "मॉड्यूल खोजें...",
  "statusVisible": "मेनू में दृश्यमान",
  "statusHidden": "छिपा हुआ",
  "empty": "कोई मॉड्यूल नहीं।",
  "moveUp": "ऊपर ले जाएं",
  "moveDown": "नीचे ले जाएं",
  "orderSave": "क्रम सहेजें",
  "orderUnsaved": "आपके पास बिना सहेजे क्रम परिवर्तन हैं",
  "reorderSearchHint": "मॉड्यूल को पुनः क्रमबद्ध करने के लिए खोज साफ़ करें",
  "loadError": "मॉड्यूल लोड नहीं हो सके",
  "toasts": { "saved": "अपडेट किया गया", "error": "अपडेट नहीं किया जा सका", "orderSaved": "क्रम अपडेट किया गया", "orderError": "क्रम सहेजा नहीं जा सका" },
};

const ar: ServerModulesViewMessages = {
  "pageTitle": "الوحدات",
  "subtitle": "إظهار الوحدات وإخفاؤها وإعادة ترتيبها في الشريط الجانبي",
  "search": "البحث عن وحدة...",
  "statusVisible": "ظاهر في القائمة",
  "statusHidden": "مخفي",
  "empty": "لا توجد وحدات.",
  "moveUp": "تحريك لأعلى",
  "moveDown": "تحريك لأسفل",
  "orderSave": "حفظ الترتيب",
  "orderUnsaved": "لديك تغييرات في الترتيب غير محفوظة",
  "reorderSearchHint": "امسح البحث لإعادة ترتيب الوحدات",
  "loadError": "تعذّر تحميل الوحدات",
  "toasts": { "saved": "تم التحديث", "error": "تعذّر التحديث", "orderSaved": "تم تحديث الترتيب", "orderError": "تعذّر حفظ الترتيب" },
};

export const serverModulesView: Record<LocaleCode, ServerModulesViewMessages> = {
  es, en, fr, pt, it, ru, zh, ko, ja, hi, ar,
};
