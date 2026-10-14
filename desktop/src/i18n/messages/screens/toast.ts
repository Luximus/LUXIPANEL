import type { LocaleCode } from "../../locales";
import type { Widen } from "../_shared";

// Spanish is the source of truth; every other locale is checked against
// its widened shape, so missing/extra keys per screen surface as TS errors.
//
// `success/error/info/warning` are the default per-variant titles used by the
// toast system (ToastProvider). `saved/created/deleted` are generic, reusable
// success messages for form/auth responses so callers don't each invent a
// "guardado correctamente" string.
const es = {
  "success": "Éxito",
  "error": "Error",
  "info": "Información",
  "warning": "Advertencia",
  "close": "Cerrar",
  "saved": "Cambios guardados correctamente",
  "created": "Creado correctamente",
  "deleted": "Eliminado correctamente",
  "sent": "Enviado correctamente",
  "copied": "Código de acceso copiado"
} as const;

export type ToastMessages = Widen<typeof es>;

export const toast: Record<LocaleCode, ToastMessages> = {
  es,
  en: {
    "success": "Success",
    "error": "Error",
    "info": "Info",
    "warning": "Warning",
    "close": "Close",
    "saved": "Changes saved successfully",
    "created": "Created successfully",
    "deleted": "Deleted successfully",
    "sent": "Sent successfully",
    "copied": "Access code copied"
  },
  fr: {
    "success": "Succès",
    "error": "Erreur",
    "info": "Information",
    "warning": "Avertissement",
    "close": "Fermer",
    "saved": "Modifications enregistrées",
    "created": "Créé avec succès",
    "deleted": "Supprimé avec succès",
    "sent": "Envoyé avec succès",
    "copied": "Code d'accès copié"
  },
  pt: {
    "success": "Sucesso",
    "error": "Erro",
    "info": "Informação",
    "warning": "Aviso",
    "close": "Fechar",
    "saved": "Alterações salvas com sucesso",
    "created": "Criado com sucesso",
    "deleted": "Excluído com sucesso",
    "sent": "Enviado com sucesso",
    "copied": "Código de acesso copiado"
  },
  it: {
    "success": "Successo",
    "error": "Errore",
    "info": "Informazione",
    "warning": "Avviso",
    "close": "Chiudi",
    "saved": "Modifiche salvate correttamente",
    "created": "Creato con successo",
    "deleted": "Eliminato con successo",
    "sent": "Inviato con successo",
    "copied": "Codice di accesso copiato"
  },
  ru: {
    "success": "Успешно",
    "error": "Ошибка",
    "info": "Информация",
    "warning": "Предупреждение",
    "close": "Закрыть",
    "saved": "Изменения сохранены",
    "created": "Успешно создано",
    "deleted": "Успешно удалено",
    "sent": "Успешно отправлено",
    "copied": "Код доступа скопирован"
  },
  zh: {
    "success": "成功",
    "error": "错误",
    "info": "提示",
    "warning": "警告",
    "close": "关闭",
    "saved": "更改已成功保存",
    "created": "创建成功",
    "deleted": "删除成功",
    "sent": "发送成功",
    "copied": "访问码已复制"
  },
  ko: {
    "success": "성공",
    "error": "오류",
    "info": "정보",
    "warning": "경고",
    "close": "닫기",
    "saved": "변경 사항이 저장되었습니다",
    "created": "성공적으로 생성됨",
    "deleted": "성공적으로 삭제됨",
    "sent": "성공적으로 전송됨",
    "copied": "액세스 코드가 복사되었습니다"
  },
  ja: {
    "success": "成功",
    "error": "エラー",
    "info": "情報",
    "warning": "警告",
    "close": "閉じる",
    "saved": "変更を保存しました",
    "created": "作成しました",
    "deleted": "削除しました",
    "sent": "送信しました",
    "copied": "アクセスコードをコピーしました"
  },
  hi: {
    "success": "सफल",
    "error": "त्रुटि",
    "info": "जानकारी",
    "warning": "चेतावनी",
    "close": "बंद करें",
    "saved": "परिवर्तन सहेजे गए",
    "created": "सफलतापूर्वक बनाया गया",
    "deleted": "सफलतापूर्वक हटाया गया",
    "sent": "सफलतापूर्वक भेजा गया",
    "copied": "एक्सेस कोड कॉपी किया गया"
  },
  ar: {
    "success": "نجاح",
    "error": "خطأ",
    "info": "معلومة",
    "warning": "تحذير",
    "close": "إغلاق",
    "saved": "تم حفظ التغييرات بنجاح",
    "created": "تم الإنشاء بنجاح",
    "deleted": "تم الحذف بنجاح",
    "sent": "تم الإرسال بنجاح",
    "copied": "تم نسخ رمز الوصول"
  },
};
