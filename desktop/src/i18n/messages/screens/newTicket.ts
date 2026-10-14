import type { LocaleCode } from "../../locales";
import type { Widen } from "../_shared";

// Spanish is the source of truth; every other locale is checked against
// its widened shape, so missing/extra keys per screen surface as TS errors.
const es = {
  "title": "Nuevo ticket",
  "titleField": "Título",
  "titlePlaceholder": "Resumen breve del problema",
  "priorityField": "Prioridad",
  "descriptionField": "Descripción",
  "descriptionPlaceholder": "Describe tu problema o consulta...",
  "attachFiles": "Adjuntar archivos",
  "attachButton": "Adjuntar archivos",
  "create": "Crear ticket",
  "creating": "Creando...",
  "awaitUploads": "Espera a que terminen las cargas en curso.",
  "priorities": {
    "critical": "Crítica",
    "high": "Alta",
    "medium": "Media",
    "low": "Baja"
  }
} as const;

export type NewTicketMessages = Widen<typeof es>;

export const newTicket: Record<LocaleCode, NewTicketMessages> = {
  es,
  en: {
    "title": "New ticket",
    "titleField": "Title",
    "titlePlaceholder": "Brief summary of the issue",
    "priorityField": "Priority",
    "descriptionField": "Description",
    "descriptionPlaceholder": "Describe your issue or question...",
    "attachFiles": "Attach files",
    "attachButton": "Attach files",
    "create": "Create ticket",
    "creating": "Creating...",
    "awaitUploads": "Wait for uploads in progress to finish.",
    "priorities": {
      "critical": "Critical",
      "high": "High",
      "medium": "Medium",
      "low": "Low"
    }
  },
  fr: {
    "title": "Nouveau ticket",
    "titleField": "Titre",
    "titlePlaceholder": "Bref résumé du problème",
    "priorityField": "Priorité",
    "descriptionField": "Description",
    "descriptionPlaceholder": "Décrivez votre problème ou votre question...",
    "attachFiles": "Joindre des fichiers",
    "attachButton": "Joindre des fichiers",
    "create": "Créer le ticket",
    "creating": "Création...",
    "awaitUploads": "Veuillez attendre la fin des téléversements en cours.",
    "priorities": {
      "critical": "Critique",
      "high": "Haute",
      "medium": "Moyenne",
      "low": "Basse"
    }
  },
  pt: {
    "title": "Novo ticket",
    "titleField": "Título",
    "titlePlaceholder": "Resumo breve do problema",
    "priorityField": "Prioridade",
    "descriptionField": "Descrição",
    "descriptionPlaceholder": "Descreva seu problema ou dúvida...",
    "attachFiles": "Anexar arquivos",
    "attachButton": "Anexar arquivos",
    "create": "Criar ticket",
    "creating": "Criando...",
    "awaitUploads": "Aguarde a conclusão dos uploads em andamento.",
    "priorities": {
      "critical": "Crítica",
      "high": "Alta",
      "medium": "Média",
      "low": "Baixa"
    }
  },
  it: {
    "title": "Nuovo ticket",
    "titleField": "Titolo",
    "titlePlaceholder": "Breve riepilogo del problema",
    "priorityField": "Priorità",
    "descriptionField": "Descrizione",
    "descriptionPlaceholder": "Descrivi il problema o la richiesta...",
    "attachFiles": "Allega file",
    "attachButton": "Allega file",
    "create": "Crea ticket",
    "creating": "Creazione...",
    "awaitUploads": "Attendi il completamento dei caricamenti in corso.",
    "priorities": {
      "critical": "Critica",
      "high": "Alta",
      "medium": "Media",
      "low": "Bassa"
    }
  },
  ru: {
    "title": "Новый тикет",
    "titleField": "Заголовок",
    "titlePlaceholder": "Краткое описание проблемы",
    "priorityField": "Приоритет",
    "descriptionField": "Описание",
    "descriptionPlaceholder": "Опишите проблему или вопрос...",
    "attachFiles": "Прикрепить файлы",
    "attachButton": "Прикрепить файлы",
    "create": "Создать тикет",
    "creating": "Создание...",
    "awaitUploads": "Дождитесь завершения текущих загрузок.",
    "priorities": {
      "critical": "Критический",
      "high": "Высокий",
      "medium": "Средний",
      "low": "Низкий"
    }
  },
  zh: {
    "title": "新建工单",
    "titleField": "标题",
    "titlePlaceholder": "简要描述问题",
    "priorityField": "优先级",
    "descriptionField": "描述",
    "descriptionPlaceholder": "请描述您的问题或咨询...",
    "attachFiles": "添加附件",
    "attachButton": "添加附件",
    "create": "创建工单",
    "creating": "创建中...",
    "awaitUploads": "请等待正在进行的上传完成。",
    "priorities": {
      "critical": "严重",
      "high": "高",
      "medium": "中",
      "low": "低"
    }
  },
  ko: {
    "title": "새 티켓",
    "titleField": "제목",
    "titlePlaceholder": "문제를 간단히 요약하세요",
    "priorityField": "우선순위",
    "descriptionField": "설명",
    "descriptionPlaceholder": "문제나 문의 내용을 자세히 설명해 주세요...",
    "attachFiles": "파일 첨부",
    "attachButton": "파일 첨부",
    "create": "티켓 생성",
    "creating": "생성 중...",
    "awaitUploads": "진행 중인 업로드가 완료될 때까지 기다려 주세요.",
    "priorities": {
      "critical": "긴급",
      "high": "높음",
      "medium": "보통",
      "low": "낮음"
    }
  },
  ja: {
    "title": "新しいチケット",
    "titleField": "タイトル",
    "titlePlaceholder": "問題を簡潔にまとめてください",
    "priorityField": "優先度",
    "descriptionField": "説明",
    "descriptionPlaceholder": "問題やご質問の内容を詳しくご記入ください...",
    "attachFiles": "ファイルを添付",
    "attachButton": "ファイルを添付",
    "create": "チケットを作成",
    "creating": "作成中...",
    "awaitUploads": "進行中のアップロードが完了するまでお待ちください。",
    "priorities": {
      "critical": "緊急",
      "high": "高",
      "medium": "中",
      "low": "低"
    }
  },
  hi: {
    "title": "नया टिकट",
    "titleField": "शीर्षक",
    "titlePlaceholder": "समस्या का संक्षिप्त सारांश",
    "priorityField": "प्राथमिकता",
    "descriptionField": "विवरण",
    "descriptionPlaceholder": "अपनी समस्या या सवाल बताएँ...",
    "attachFiles": "फ़ाइलें अटैच करें",
    "attachButton": "फ़ाइलें अटैच करें",
    "create": "टिकट बनाएं",
    "creating": "बनाया जा रहा है...",
    "awaitUploads": "जारी अपलोड पूरे होने तक प्रतीक्षा करें।",
    "priorities": {
      "critical": "गंभीर",
      "high": "उच्च",
      "medium": "मध्यम",
      "low": "निम्न"
    }
  },
  ar: {
    "title": "تذكرة جديدة",
    "titleField": "العنوان",
    "titlePlaceholder": "ملخص قصير للمشكلة",
    "priorityField": "الأولوية",
    "descriptionField": "الوصف",
    "descriptionPlaceholder": "صف مشكلتك أو استفسارك...",
    "attachFiles": "إرفاق ملفات",
    "attachButton": "إرفاق ملفات",
    "create": "إنشاء التذكرة",
    "creating": "جارٍ الإنشاء...",
    "awaitUploads": "انتظر حتى تنتهي عمليات التحميل الجارية.",
    "priorities": {
      "critical": "حرجة",
      "high": "عالية",
      "medium": "متوسطة",
      "low": "منخفضة"
    }
  },
};
