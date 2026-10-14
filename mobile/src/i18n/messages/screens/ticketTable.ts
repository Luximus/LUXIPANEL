import type { LocaleCode } from "../../locales";
import type { Widen } from "../_shared";

// Spanish is the source of truth; every other locale is checked against
// its widened shape, so missing/extra keys per screen surface as TS errors.
const es = {
  "columns": {
    "title": "Título del ticket",
    "status": "Estado",
    "priority": "Prioridad",
    "date": "Creación",
    "updated": "Actualización",
    "closed": "Finalización",
    "response": "Respuesta"
  },
  "filters": {
    "search": "Buscar ticket...",
    "allStatuses": "Todos los estados",
    "allPriorities": "Todas las prioridades",
    "allResponses": "Todas las respuestas"
  },
  "statusBadges": {
    "open": "ABIERTO",
    "in_progress": "EN PROGRESO",
    "resolved": "RESUELTO",
    "closed": "CERRADO"
  },
  "priorityBadges": {
    "critical": "CRÍTICA",
    "high": "ALTA",
    "medium": "MEDIA",
    "low": "BAJA"
  },
  "responseBadges": {
    "responded": "RESPONDIDO",
    "awaiting_user": "ESPERANDO RESPUESTA",
    "awaiting_admin": "ESPERANDO RESPUESTA",
    "no_response": "SIN RESPUESTA"
  },
  "actions": {
    "view": "Ver"
  }
} as const;

export type TicketTableMessages = Widen<typeof es>;

export const ticketTable: Record<LocaleCode, TicketTableMessages> = {
  es,
  en: {
    "columns": {
      "title": "Ticket title",
      "status": "Status",
      "priority": "Priority",
      "date": "Created",
      "updated": "Updated",
      "closed": "Closed",
      "response": "Response"
    },
    "filters": {
      "search": "Search ticket...",
      "allStatuses": "All statuses",
      "allPriorities": "All priorities",
      "allResponses": "All responses"
    },
    "statusBadges": {
      "open": "OPEN",
      "in_progress": "IN PROGRESS",
      "resolved": "RESOLVED",
      "closed": "CLOSED"
    },
    "priorityBadges": {
      "critical": "CRITICAL",
      "high": "HIGH",
      "medium": "MEDIUM",
      "low": "LOW"
    },
    "responseBadges": {
      "responded": "RESPONDED",
      "awaiting_user": "AWAITING REPLY",
      "awaiting_admin": "AWAITING REPLY",
      "no_response": "NO RESPONSE"
    },
    "actions": {
      "view": "View"
    }
  },
  fr: {
    "columns": {
      "title": "Titre du ticket",
      "status": "État",
      "priority": "Priorité",
      "date": "Création",
      "updated": "Mise à jour",
      "closed": "Clôture",
      "response": "Réponse"
    },
    "filters": {
      "search": "Rechercher ticket...",
      "allStatuses": "Tous les états",
      "allPriorities": "Toutes les priorités",
      "allResponses": "Toutes les réponses"
    },
    "statusBadges": {
      "open": "OUVERT",
      "in_progress": "EN COURS",
      "resolved": "RÉSOLU",
      "closed": "FERMÉ"
    },
    "priorityBadges": {
      "critical": "CRITIQUE",
      "high": "HAUTE",
      "medium": "MOYENNE",
      "low": "BASSE"
    },
    "responseBadges": {
      "responded": "RÉPONDU",
      "awaiting_user": "EN ATTENTE DE RÉPONSE",
      "awaiting_admin": "EN ATTENTE DE RÉPONSE",
      "no_response": "AUCUNE RÉPONSE"
    },
    "actions": {
      "view": "Voir"
    }
  },
  pt: {
    "columns": {
      "title": "Título do ticket",
      "status": "Status",
      "priority": "Prioridade",
      "date": "Criação",
      "updated": "Atualização",
      "closed": "Fechamento",
      "response": "Resposta"
    },
    "filters": {
      "search": "Buscar ticket...",
      "allStatuses": "Todos os status",
      "allPriorities": "Todas as prioridades",
      "allResponses": "Todas as respostas"
    },
    "statusBadges": {
      "open": "ABERTO",
      "in_progress": "EM ANDAMENTO",
      "resolved": "RESOLVIDO",
      "closed": "FECHADO"
    },
    "priorityBadges": {
      "critical": "CRÍTICA",
      "high": "ALTA",
      "medium": "MÉDIA",
      "low": "BAIXA"
    },
    "responseBadges": {
      "responded": "RESPONDIDO",
      "awaiting_user": "AGUARDANDO RESPOSTA",
      "awaiting_admin": "AGUARDANDO RESPOSTA",
      "no_response": "SEM RESPOSTA"
    },
    "actions": {
      "view": "Ver"
    }
  },
  it: {
    "columns": {
      "title": "Titolo del ticket",
      "status": "Stato",
      "priority": "Priorità",
      "date": "Creazione",
      "updated": "Aggiornamento",
      "closed": "Chiusura",
      "response": "Risposta"
    },
    "filters": {
      "search": "Cerca ticket...",
      "allStatuses": "Tutti gli stati",
      "allPriorities": "Tutte le priorità",
      "allResponses": "Tutte le risposte"
    },
    "statusBadges": {
      "open": "APERTO",
      "in_progress": "IN CORSO",
      "resolved": "RISOLTO",
      "closed": "CHIUSO"
    },
    "priorityBadges": {
      "critical": "CRITICA",
      "high": "ALTA",
      "medium": "MEDIA",
      "low": "BASSA"
    },
    "responseBadges": {
      "responded": "RISPOSTO",
      "awaiting_user": "IN ATTESA DI RISPOSTA",
      "awaiting_admin": "IN ATTESA DI RISPOSTA",
      "no_response": "NESSUNA RISPOSTA"
    },
    "actions": {
      "view": "Visualizza"
    }
  },
  ru: {
    "columns": {
      "title": "Заголовок тикета",
      "status": "Статус",
      "priority": "Приоритет",
      "date": "Создан",
      "updated": "Обновлён",
      "closed": "Закрыт",
      "response": "Ответ"
    },
    "filters": {
      "search": "Поиск тикета...",
      "allStatuses": "Все статусы",
      "allPriorities": "Все приоритеты",
      "allResponses": "Все ответы"
    },
    "statusBadges": {
      "open": "ОТКРЫТ",
      "in_progress": "В РАБОТЕ",
      "resolved": "РЕШЁН",
      "closed": "ЗАКРЫТ"
    },
    "priorityBadges": {
      "critical": "КРИТИЧЕСКИЙ",
      "high": "ВЫСОКИЙ",
      "medium": "СРЕДНИЙ",
      "low": "НИЗКИЙ"
    },
    "responseBadges": {
      "responded": "ОТВЕЧЕНО",
      "awaiting_user": "ОЖИДАЕТ ОТВЕТА",
      "awaiting_admin": "ОЖИДАЕТ ОТВЕТА",
      "no_response": "БЕЗ ОТВЕТА"
    },
    "actions": {
      "view": "Просмотр"
    }
  },
  zh: {
    "columns": {
      "title": "工单标题",
      "status": "状态",
      "priority": "优先级",
      "date": "创建时间",
      "updated": "更新时间",
      "closed": "关闭时间",
      "response": "回复"
    },
    "filters": {
      "search": "搜索工单...",
      "allStatuses": "所有状态",
      "allPriorities": "所有优先级",
      "allResponses": "所有回复"
    },
    "statusBadges": {
      "open": "未处理",
      "in_progress": "处理中",
      "resolved": "已解决",
      "closed": "已关闭"
    },
    "priorityBadges": {
      "critical": "严重",
      "high": "高",
      "medium": "中",
      "low": "低"
    },
    "responseBadges": {
      "responded": "已回复",
      "awaiting_user": "等待回复",
      "awaiting_admin": "等待回复",
      "no_response": "无回复"
    },
    "actions": {
      "view": "查看"
    }
  },
  ko: {
    "columns": {
      "title": "티켓 제목",
      "status": "상태",
      "priority": "우선순위",
      "date": "생성일",
      "updated": "업데이트",
      "closed": "종료일",
      "response": "응답"
    },
    "filters": {
      "search": "티켓 검색...",
      "allStatuses": "모든 상태",
      "allPriorities": "모든 우선순위",
      "allResponses": "모든 응답"
    },
    "statusBadges": {
      "open": "열림",
      "in_progress": "진행 중",
      "resolved": "해결됨",
      "closed": "닫힘"
    },
    "priorityBadges": {
      "critical": "긴급",
      "high": "높음",
      "medium": "보통",
      "low": "낮음"
    },
    "responseBadges": {
      "responded": "응답 완료",
      "awaiting_user": "응답 대기 중",
      "awaiting_admin": "응답 대기 중",
      "no_response": "응답 없음"
    },
    "actions": {
      "view": "보기"
    }
  },
  ja: {
    "columns": {
      "title": "チケットタイトル",
      "status": "ステータス",
      "priority": "優先度",
      "date": "作成日",
      "updated": "更新日",
      "closed": "終了日",
      "response": "返信"
    },
    "filters": {
      "search": "チケットを検索...",
      "allStatuses": "すべてのステータス",
      "allPriorities": "すべての優先度",
      "allResponses": "すべての返信"
    },
    "statusBadges": {
      "open": "オープン",
      "in_progress": "進行中",
      "resolved": "解決済み",
      "closed": "クローズ"
    },
    "priorityBadges": {
      "critical": "緊急",
      "high": "高",
      "medium": "中",
      "low": "低"
    },
    "responseBadges": {
      "responded": "返信済み",
      "awaiting_user": "返信待ち",
      "awaiting_admin": "返信待ち",
      "no_response": "返信なし"
    },
    "actions": {
      "view": "表示"
    }
  },
  hi: {
    "columns": {
      "title": "टिकट का शीर्षक",
      "status": "स्टेटस",
      "priority": "प्राथमिकता",
      "date": "बनाया गया",
      "updated": "अपडेट",
      "closed": "समाप्त",
      "response": "जवाब"
    },
    "filters": {
      "search": "टिकट खोजें...",
      "allStatuses": "सभी स्टेटस",
      "allPriorities": "सभी प्राथमिकताएँ",
      "allResponses": "सभी जवाब"
    },
    "statusBadges": {
      "open": "खुला",
      "in_progress": "प्रगति में",
      "resolved": "हल हो गया",
      "closed": "बंद"
    },
    "priorityBadges": {
      "critical": "गंभीर",
      "high": "उच्च",
      "medium": "मध्यम",
      "low": "निम्न"
    },
    "responseBadges": {
      "responded": "जवाब दिया",
      "awaiting_user": "जवाब का इंतजार",
      "awaiting_admin": "जवाब का इंतजार",
      "no_response": "कोई जवाब नहीं"
    },
    "actions": {
      "view": "देखें"
    }
  },
  ar: {
    "columns": {
      "title": "عنوان التذكرة",
      "status": "الحالة",
      "priority": "الأولوية",
      "date": "تاريخ الإنشاء",
      "updated": "آخر تحديث",
      "closed": "تاريخ الإغلاق",
      "response": "الرد"
    },
    "filters": {
      "search": "ابحث عن تذكرة...",
      "allStatuses": "جميع الحالات",
      "allPriorities": "جميع الأولويات",
      "allResponses": "جميع الردود"
    },
    "statusBadges": {
      "open": "مفتوحة",
      "in_progress": "قيد التنفيذ",
      "resolved": "تم الحل",
      "closed": "مغلقة"
    },
    "priorityBadges": {
      "critical": "حرجة",
      "high": "عالية",
      "medium": "متوسطة",
      "low": "منخفضة"
    },
    "responseBadges": {
      "responded": "تم الرد",
      "awaiting_user": "بانتظار الرد",
      "awaiting_admin": "بانتظار الرد",
      "no_response": "لا يوجد رد"
    },
    "actions": {
      "view": "عرض"
    }
  },
};
