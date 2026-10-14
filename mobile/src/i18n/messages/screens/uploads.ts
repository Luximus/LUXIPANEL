import type { LocaleCode } from "../../locales";
import type { Widen } from "../_shared";

// Spanish is the source of truth; every other locale is checked against
// its widened shape, so missing/extra keys per screen surface as TS errors.
const es = {
  "removeAria": "Eliminar",
  "statuses": {
    "ready": "Listo",
    "errorFallback": "Error al subir",
    "cancelled": "Cancelado"
  },
  "rejections": {
    "sessionExpired": "Sesión expirada",
    "maxFiles": "Máximo {n} archivos",
    "perFileLimit": "Excede {n} MB por archivo",
    "totalLimit": "Supera el total de {n} MB",
    "uploadCancelled": "Carga cancelada"
  }
} as const;

export type UploadsMessages = Widen<typeof es>;

export const uploads: Record<LocaleCode, UploadsMessages> = {
  es,
  en: {
    "removeAria": "Remove",
    "statuses": {
      "ready": "Ready",
      "errorFallback": "Upload failed",
      "cancelled": "Cancelled"
    },
    "rejections": {
      "sessionExpired": "Session expired",
      "maxFiles": "Limit: {n} files",
      "perFileLimit": "Exceeds {n} MB per file",
      "totalLimit": "Exceeds {n} MB total",
      "uploadCancelled": "Upload cancelled"
    }
  },
  fr: {
    "removeAria": "Supprimer",
    "statuses": {
      "ready": "Prêt",
      "errorFallback": "Échec du téléversement",
      "cancelled": "Annulé"
    },
    "rejections": {
      "sessionExpired": "Session expirée",
      "maxFiles": "Limite : {n} fichiers",
      "perFileLimit": "Dépasse {n} Mo par fichier",
      "totalLimit": "Dépasse {n} Mo au total",
      "uploadCancelled": "Téléversement annulé"
    }
  },
  pt: {
    "removeAria": "Remover",
    "statuses": {
      "ready": "Concluído",
      "errorFallback": "Falha no envio",
      "cancelled": "Cancelado"
    },
    "rejections": {
      "sessionExpired": "Sessão expirada",
      "maxFiles": "Máximo de {n} arquivos",
      "perFileLimit": "Excede {n} MB por arquivo",
      "totalLimit": "Excede o limite total de {n} MB",
      "uploadCancelled": "Upload cancelado"
    }
  },
  it: {
    "removeAria": "Rimuovi",
    "statuses": {
      "ready": "Caricato",
      "errorFallback": "Errore di caricamento",
      "cancelled": "Annullato"
    },
    "rejections": {
      "sessionExpired": "Sessione scaduta",
      "maxFiles": "Massimo {n} file",
      "perFileLimit": "Supera i {n} MB per file",
      "totalLimit": "Supera il totale di {n} MB",
      "uploadCancelled": "Caricamento annullato"
    }
  },
  ru: {
    "removeAria": "Удалить",
    "statuses": {
      "ready": "Готово",
      "errorFallback": "Ошибка загрузки",
      "cancelled": "Отменено"
    },
    "rejections": {
      "sessionExpired": "Сессия истекла",
      "maxFiles": "Не более {n} файлов",
      "perFileLimit": "Превышен лимит {n} МБ на файл",
      "totalLimit": "Превышен общий лимит {n} МБ",
      "uploadCancelled": "Загрузка отменена"
    }
  },
  zh: {
    "removeAria": "删除",
    "statuses": {
      "ready": "就绪",
      "errorFallback": "上传失败",
      "cancelled": "已取消"
    },
    "rejections": {
      "sessionExpired": "会话已过期",
      "maxFiles": "最多 {n} 个文件",
      "perFileLimit": "单个文件超过 {n} MB",
      "totalLimit": "总大小超过 {n} MB",
      "uploadCancelled": "上传已取消"
    }
  },
  ko: {
    "removeAria": "제거",
    "statuses": {
      "ready": "준비됨",
      "errorFallback": "업로드 오류",
      "cancelled": "취소됨"
    },
    "rejections": {
      "sessionExpired": "세션이 만료되었습니다",
      "maxFiles": "최대 {n}개 파일",
      "perFileLimit": "파일당 {n}MB를 초과했습니다",
      "totalLimit": "전체 {n}MB를 초과했습니다",
      "uploadCancelled": "업로드가 취소되었습니다"
    }
  },
  ja: {
    "removeAria": "削除",
    "statuses": {
      "ready": "準備完了",
      "errorFallback": "アップロードエラー",
      "cancelled": "キャンセル済み"
    },
    "rejections": {
      "sessionExpired": "セッションの有効期限が切れました",
      "maxFiles": "ファイルは最大 {n} 件までです",
      "perFileLimit": "1 ファイルあたり {n} MB を超えています",
      "totalLimit": "合計 {n} MB を超えています",
      "uploadCancelled": "アップロードをキャンセルしました"
    }
  },
  hi: {
    "removeAria": "हटाएं",
    "statuses": {
      "ready": "तैयार",
      "errorFallback": "अपलोड में त्रुटि",
      "cancelled": "रद्द किया गया"
    },
    "rejections": {
      "sessionExpired": "सेशन एक्सपायर हो गया",
      "maxFiles": "फ़ाइलों की अधिकतम सीमा: {n}",
      "perFileLimit": "प्रति फ़ाइल {n} MB से अधिक",
      "totalLimit": "कुल {n} MB से अधिक",
      "uploadCancelled": "अपलोड रद्द किया गया"
    }
  },
  ar: {
    "removeAria": "إزالة",
    "statuses": {
      "ready": "جاهز",
      "errorFallback": "خطأ في التحميل",
      "cancelled": "ملغى"
    },
    "rejections": {
      "sessionExpired": "انتهت الجلسة",
      "maxFiles": "الحد الأقصى للملفات: {n}",
      "perFileLimit": "يتجاوز {n} MB لكل ملف",
      "totalLimit": "يتجاوز الإجمالي {n} MB",
      "uploadCancelled": "تم إلغاء التحميل"
    }
  },
};
