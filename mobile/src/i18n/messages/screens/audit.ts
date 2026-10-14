import type { LocaleCode } from "../../locales";
import type { Widen } from "../_shared";

// Spanish is the source of truth; every other locale is checked against
// its widened shape, so missing/extra keys per screen surface as TS errors.
const es = {
  "title": "Auditoría del servidor",
  "subtitle": "Historial de eventos del servidor.",
  "loading": "Cargando historial…",
  "empty": "Sin eventos de auditoría todavía.",
  "error": "No se pudo cargar la auditoría.",
  "colDate": "Fecha",
  "colAction": "Acción",
  "colActor": "Actor",
  "colIp": "IP",
  "colMeta": "Detalle",
  "action": "Auditoría"
} as const;

export type AuditMessages = Widen<typeof es>;

export const audit: Record<LocaleCode, AuditMessages> = {
  es,
  en: {
    "title": "Server audit",
    "subtitle": "Server event history.",
    "loading": "Loading history…",
    "empty": "No audit events yet.",
    "error": "Could not load the audit log.",
    "colDate": "Date",
    "colAction": "Action",
    "colActor": "Actor",
    "colIp": "IP",
    "colMeta": "Detail",
    "action": "Audit"
  },
  fr: {
    "title": "Audit du serveur",
    "subtitle": "Historique des événements du serveur.",
    "loading": "Chargement de l'historique…",
    "empty": "Aucun événement d'audit pour le moment.",
    "error": "Impossible de charger l'audit.",
    "colDate": "Date",
    "colAction": "Action",
    "colActor": "Acteur",
    "colIp": "IP",
    "colMeta": "Détail",
    "action": "Audit"
  },
  pt: {
    "title": "Auditoria do servidor",
    "subtitle": "Histórico de eventos do servidor.",
    "loading": "Carregando histórico…",
    "empty": "Ainda não há eventos de auditoria.",
    "error": "Não foi possível carregar a auditoria.",
    "colDate": "Data",
    "colAction": "Ação",
    "colActor": "Ator",
    "colIp": "IP",
    "colMeta": "Detalhe",
    "action": "Auditoria"
  },
  it: {
    "title": "Audit del server",
    "subtitle": "Cronologia eventi del server.",
    "loading": "Caricamento cronologia…",
    "empty": "Nessun evento di audit per ora.",
    "error": "Impossibile caricare l'audit.",
    "colDate": "Data",
    "colAction": "Azione",
    "colActor": "Attore",
    "colIp": "IP",
    "colMeta": "Dettaglio",
    "action": "Audit"
  },
  ru: {
    "title": "Аудит сервера",
    "subtitle": "История событий сервера.",
    "loading": "Загрузка истории…",
    "empty": "Событий аудита пока нет.",
    "error": "Не удалось загрузить аудит.",
    "colDate": "Дата",
    "colAction": "Действие",
    "colActor": "Субъект",
    "colIp": "IP",
    "colMeta": "Детали",
    "action": "Аудит"
  },
  zh: {
    "title": "服务器审计",
    "subtitle": "服务器事件历史记录。",
    "loading": "正在加载历史记录…",
    "empty": "暂无审计事件。",
    "error": "无法加载审计日志。",
    "colDate": "日期",
    "colAction": "操作",
    "colActor": "操作者",
    "colIp": "IP",
    "colMeta": "详情",
    "action": "审计"
  },
  ko: {
    "title": "서버 감사",
    "subtitle": "서버 이벤트 기록.",
    "loading": "기록을 불러오는 중…",
    "empty": "아직 감사 이벤트가 없습니다.",
    "error": "감사 기록을 불러올 수 없습니다.",
    "colDate": "날짜",
    "colAction": "작업",
    "colActor": "행위자",
    "colIp": "IP",
    "colMeta": "상세",
    "action": "감사"
  },
  ja: {
    "title": "サーバー監査",
    "subtitle": "サーバーイベントの履歴。",
    "loading": "履歴を読み込み中…",
    "empty": "監査イベントはまだありません。",
    "error": "監査を読み込めませんでした。",
    "colDate": "日付",
    "colAction": "アクション",
    "colActor": "実行者",
    "colIp": "IP",
    "colMeta": "詳細",
    "action": "監査"
  },
  hi: {
    "title": "सर्वर ऑडिट",
    "subtitle": "सर्वर इवेंट का इतिहास।",
    "loading": "इतिहास लोड हो रहा है…",
    "empty": "अभी तक कोई ऑडिट इवेंट नहीं।",
    "error": "ऑडिट लोड नहीं हो सका।",
    "colDate": "तारीख",
    "colAction": "क्रिया",
    "colActor": "कर्ता",
    "colIp": "IP",
    "colMeta": "विवरण",
    "action": "ऑडिट"
  },
  ar: {
    "title": "تدقيق الخادم",
    "subtitle": "سجل أحداث الخادم.",
    "loading": "جارٍ تحميل السجل…",
    "empty": "لا توجد أحداث تدقيق بعد.",
    "error": "تعذّر تحميل سجل التدقيق.",
    "colDate": "التاريخ",
    "colAction": "الإجراء",
    "colActor": "الفاعل",
    "colIp": "IP",
    "colMeta": "التفاصيل",
    "action": "التدقيق"
  },
};
