import type { LocaleCode } from "../../locales";
import type { Widen } from "../_shared";

// Spanish is the source of truth; every other locale is checked against
// its widened shape, so missing/extra keys per screen surface as TS errors.
const es = {
  "title": "Eliminar panel",
  "description": "Se eliminará {name} y se liberará su llave si sigue vigente.",
  "processing": "Procesando...",
  "delete": "Eliminar",
  "closeAria": "Cerrar"
} as const;

export type DeletePanelMessages = Widen<typeof es>;

export const deletePanel: Record<LocaleCode, DeletePanelMessages> = {
  es,
  en: {
    "title": "Delete panel",
    "description": "{name} will be deleted and its license key released if still valid.",
    "processing": "Processing...",
    "delete": "Delete",
    "closeAria": "Close"
  },
  fr: {
    "title": "Supprimer le panneau",
    "description": "{name} sera supprimé et sa clé de licence sera libérée si elle est encore valide.",
    "processing": "Traitement...",
    "delete": "Supprimer",
    "closeAria": "Fermer"
  },
  pt: {
    "title": "Excluir painel",
    "description": "{name} será excluído e sua chave será liberada se ainda estiver vigente.",
    "processing": "Processando...",
    "delete": "Excluir",
    "closeAria": "Fechar"
  },
  it: {
    "title": "Elimina pannello",
    "description": "{name} verrà eliminato e la sua chiave verrà liberata se ancora valida.",
    "processing": "Elaborazione...",
    "delete": "Elimina",
    "closeAria": "Chiudi"
  },
  ru: {
    "title": "Удалить панель",
    "description": "Панель {name} будет удалена, а её ключ освобождён, если он ещё действителен.",
    "processing": "Обработка...",
    "delete": "Удалить",
    "closeAria": "Закрыть"
  },
  zh: {
    "title": "删除面板",
    "description": "将删除 {name}，如果密钥仍然有效将被释放。",
    "processing": "处理中...",
    "delete": "删除",
    "closeAria": "关闭"
  },
  ko: {
    "title": "패널 삭제",
    "description": "{name}을(를) 삭제하며, 키가 아직 유효한 경우 해제됩니다.",
    "processing": "처리 중...",
    "delete": "삭제",
    "closeAria": "닫기"
  },
  ja: {
    "title": "パネルを削除",
    "description": "{name} を削除します。キーがまだ有効な場合は解放されます。",
    "processing": "処理中...",
    "delete": "削除",
    "closeAria": "閉じる"
  },
  hi: {
    "title": "पैनल हटाएं",
    "description": "{name} हटा दिया जाएगा और अगर इसकी की अब भी मान्य है तो वह रिलीज़ हो जाएगी।",
    "processing": "प्रोसेस हो रहा है...",
    "delete": "हटाएं",
    "closeAria": "बंद करें"
  },
  ar: {
    "title": "حذف اللوحة",
    "description": "سيتم حذف {name}، وسيُحرَّر مفتاحها إذا كان لا يزال ساري المفعول.",
    "processing": "جارٍ المعالجة...",
    "delete": "حذف",
    "closeAria": "إغلاق"
  },
};
