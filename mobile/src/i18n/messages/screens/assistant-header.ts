import type { LocaleCode } from "../../locales";
import type { Widen } from "../_shared";

// Header del asistente IA (navbar SUPERIOR de la app, contexto chat). Réplica
// nativa del cluster de estado del header de LUXIPANEL `ChatPane.tsx`: contador
// de tokens Σ + turnos, medidor de ventana de contexto + botón Compactar, conteo
// de adjuntos, estado de stream / "en background" y el ID de sesión copiable (CLI).
const es = {
  // ── Tokens acumulados ──
  "tokensUnit": "tok",
  "tokensA11yReal": "Tokens acumulados de este chat: {total} · {turns} turno(s) (recuento real)",
  "tokensA11yEstimated": "Tokens acumulados de este chat: {total} · {turns} turno(s) (incluye estimaciones de CLI)",

  // ── Ventana de contexto ──
  "ctxLabel": "ctx",
  "ctxA11y": "Contexto estimado: {pct}% de la ventana del modelo. Al llenarse, el modelo empieza a olvidar mensajes recientes; compacta para resumir lo antiguo.",

  // ── Compactar ──
  "compact": "Compactar",
  "compacting": "Compactando…",
  "compactA11y": "Compactar la conversación: resume los mensajes antiguos y conserva los recientes para no exceder la ventana de contexto.",

  // ── Adjuntos ──
  "attachmentsA11y": "{count} adjunto(s) en la conversación",

  // ── Estado de stream ──
  "responding": "respondiendo…",
  "inBackground": "en background",
  "inBackgroundA11y": "La tarea sigue ejecutándose en el servidor; volverá a transmitirse al reabrir el chat.",

  // ── ID de sesión (CLI) ──
  "sessionCopy": "Copiar ID de sesión",
  "sessionCopied": "ID de sesión copiado",
} as const;

export type AssistantHeaderMessages = Widen<typeof es>;

const en: AssistantHeaderMessages = {
  "tokensUnit": "tok",
  "tokensA11yReal": "Tokens accumulated in this chat: {total} · {turns} turn(s) (real count)",
  "tokensA11yEstimated": "Tokens accumulated in this chat: {total} · {turns} turn(s) (includes CLI estimates)",
  "ctxLabel": "ctx",
  "ctxA11y": "Estimated context: {pct}% of the model window. As it fills, the model starts forgetting recent messages; compact to summarize older ones.",
  "compact": "Compact",
  "compacting": "Compacting…",
  "compactA11y": "Compact the conversation: summarizes older messages and keeps recent ones to avoid exceeding the context window.",
  "attachmentsA11y": "{count} attachment(s) in the conversation",
  "responding": "responding…",
  "inBackground": "in background",
  "inBackgroundA11y": "The task is still running on the server; it will stream again when you reopen the chat.",
  "sessionCopy": "Copy session ID",
  "sessionCopied": "Session ID copied",
};

const fr: AssistantHeaderMessages = {
  "tokensUnit": "tok",
  "tokensA11yReal": "Tokens accumulés dans ce chat : {total} · {turns} tour(s) (compte réel)",
  "tokensA11yEstimated": "Tokens accumulés dans ce chat : {total} · {turns} tour(s) (inclut les estimations CLI)",
  "ctxLabel": "ctx",
  "ctxA11y": "Contexte estimé : {pct} % de la fenêtre du modèle. En se remplissant, le modèle commence à oublier les messages récents ; compactez pour résumer les anciens.",
  "compact": "Compacter",
  "compacting": "Compactage…",
  "compactA11y": "Compacter la conversation : résume les anciens messages et conserve les récents pour ne pas dépasser la fenêtre de contexte.",
  "attachmentsA11y": "{count} pièce(s) jointe(s) dans la conversation",
  "responding": "réponse en cours…",
  "inBackground": "en arrière-plan",
  "inBackgroundA11y": "La tâche s'exécute toujours sur le serveur ; elle reprendra sa diffusion à la réouverture du chat.",
  "sessionCopy": "Copier l'ID de session",
  "sessionCopied": "ID de session copié",
};

const pt: AssistantHeaderMessages = {
  "tokensUnit": "tok",
  "tokensA11yReal": "Tokens acumulados neste chat: {total} · {turns} turno(s) (contagem real)",
  "tokensA11yEstimated": "Tokens acumulados neste chat: {total} · {turns} turno(s) (inclui estimativas de CLI)",
  "ctxLabel": "ctx",
  "ctxA11y": "Contexto estimado: {pct}% da janela do modelo. Ao encher, o modelo começa a esquecer mensagens recentes; compacte para resumir as antigas.",
  "compact": "Compactar",
  "compacting": "Compactando…",
  "compactA11y": "Compactar a conversa: resume as mensagens antigas e mantém as recentes para não exceder a janela de contexto.",
  "attachmentsA11y": "{count} anexo(s) na conversa",
  "responding": "respondendo…",
  "inBackground": "em segundo plano",
  "inBackgroundA11y": "A tarefa continua em execução no servidor; voltará a transmitir ao reabrir o chat.",
  "sessionCopy": "Copiar ID da sessão",
  "sessionCopied": "ID da sessão copiado",
};

const it: AssistantHeaderMessages = {
  "tokensUnit": "tok",
  "tokensA11yReal": "Token accumulati in questa chat: {total} · {turns} turno/i (conteggio reale)",
  "tokensA11yEstimated": "Token accumulati in questa chat: {total} · {turns} turno/i (incluse le stime CLI)",
  "ctxLabel": "ctx",
  "ctxA11y": "Contesto stimato: {pct}% della finestra del modello. Riempiendosi, il modello inizia a dimenticare i messaggi recenti; compatta per riassumere quelli vecchi.",
  "compact": "Compatta",
  "compacting": "Compattazione…",
  "compactA11y": "Compatta la conversazione: riassume i messaggi vecchi e conserva quelli recenti per non superare la finestra di contesto.",
  "attachmentsA11y": "{count} allegato/i nella conversazione",
  "responding": "sta rispondendo…",
  "inBackground": "in background",
  "inBackgroundA11y": "L'attività è ancora in esecuzione sul server; riprenderà a trasmettere alla riapertura della chat.",
  "sessionCopy": "Copia ID sessione",
  "sessionCopied": "ID sessione copiato",
};

const ru: AssistantHeaderMessages = {
  "tokensUnit": "ток",
  "tokensA11yReal": "Накоплено токенов в этом чате: {total} · {turns} ход(ов) (точный подсчёт)",
  "tokensA11yEstimated": "Накоплено токенов в этом чате: {total} · {turns} ход(ов) (включая оценки CLI)",
  "ctxLabel": "конт",
  "ctxA11y": "Оценочный контекст: {pct}% окна модели. По мере заполнения модель начинает забывать недавние сообщения; выполните уплотнение, чтобы свести старые.",
  "compact": "Уплотнить",
  "compacting": "Уплотнение…",
  "compactA11y": "Уплотнить разговор: подытоживает старые сообщения и сохраняет недавние, чтобы не превысить окно контекста.",
  "attachmentsA11y": "{count} вложение(й) в разговоре",
  "responding": "отвечает…",
  "inBackground": "в фоне",
  "inBackgroundA11y": "Задача всё ещё выполняется на сервере; трансляция возобновится при повторном открытии чата.",
  "sessionCopy": "Копировать ID сессии",
  "sessionCopied": "ID сессии скопирован",
};

const zh: AssistantHeaderMessages = {
  "tokensUnit": "tok",
  "tokensA11yReal": "本次聊天累计 token：{total} · {turns} 轮（真实计数）",
  "tokensA11yEstimated": "本次聊天累计 token：{total} · {turns} 轮（含 CLI 估算）",
  "ctxLabel": "上下文",
  "ctxA11y": "估算上下文：占模型窗口的 {pct}%。窗口填满时，模型会开始遗忘较新的消息；进行压缩可概括旧内容。",
  "compact": "压缩",
  "compacting": "压缩中…",
  "compactA11y": "压缩对话：概括旧消息并保留近期消息，以免超出上下文窗口。",
  "attachmentsA11y": "对话中有 {count} 个附件",
  "responding": "正在回复…",
  "inBackground": "后台运行",
  "inBackgroundA11y": "任务仍在服务器上运行；重新打开聊天时将继续传输。",
  "sessionCopy": "复制会话 ID",
  "sessionCopied": "已复制会话 ID",
};

const ko: AssistantHeaderMessages = {
  "tokensUnit": "tok",
  "tokensA11yReal": "이 채팅의 누적 토큰: {total} · {turns}턴 (실제 집계)",
  "tokensA11yEstimated": "이 채팅의 누적 토큰: {total} · {turns}턴 (CLI 추정 포함)",
  "ctxLabel": "컨텍스트",
  "ctxA11y": "예상 컨텍스트: 모델 창의 {pct}%. 가득 차면 모델이 최근 메시지를 잊기 시작하므로, 압축하여 오래된 내용을 요약하세요.",
  "compact": "압축",
  "compacting": "압축 중…",
  "compactA11y": "대화 압축: 오래된 메시지를 요약하고 최근 메시지를 유지하여 컨텍스트 창을 초과하지 않도록 합니다.",
  "attachmentsA11y": "대화의 첨부 파일 {count}개",
  "responding": "응답 중…",
  "inBackground": "백그라운드",
  "inBackgroundA11y": "작업이 서버에서 계속 실행 중이며, 채팅을 다시 열면 다시 스트리밍됩니다.",
  "sessionCopy": "세션 ID 복사",
  "sessionCopied": "세션 ID 복사됨",
};

const ja: AssistantHeaderMessages = {
  "tokensUnit": "tok",
  "tokensA11yReal": "このチャットの累計トークン: {total} · {turns} ターン（実カウント）",
  "tokensA11yEstimated": "このチャットの累計トークン: {total} · {turns} ターン（CLI の推定を含む）",
  "ctxLabel": "コンテキスト",
  "ctxA11y": "推定コンテキスト: モデルウィンドウの {pct}%。満杯になるとモデルは最近のメッセージを忘れ始めます。コンパクト化で古い内容を要約してください。",
  "compact": "コンパクト化",
  "compacting": "コンパクト化中…",
  "compactA11y": "会話をコンパクト化: 古いメッセージを要約し、最近のものを残してコンテキストウィンドウを超えないようにします。",
  "attachmentsA11y": "会話内の添付ファイル {count} 件",
  "responding": "応答中…",
  "inBackground": "バックグラウンド",
  "inBackgroundA11y": "タスクはサーバーで実行中です。チャットを再度開くと再びストリーミングされます。",
  "sessionCopy": "セッションIDをコピー",
  "sessionCopied": "セッションIDをコピーしました",
};

const hi: AssistantHeaderMessages = {
  "tokensUnit": "tok",
  "tokensA11yReal": "इस चैट में संचित टोकन: {total} · {turns} टर्न (वास्तविक गणना)",
  "tokensA11yEstimated": "इस चैट में संचित टोकन: {total} · {turns} टर्न (CLI अनुमान सहित)",
  "ctxLabel": "ctx",
  "ctxA11y": "अनुमानित संदर्भ: मॉडल विंडो का {pct}%. भर जाने पर मॉडल हाल के संदेश भूलने लगता है; पुराने को संक्षेप करने के लिए कॉम्पैक्ट करें.",
  "compact": "कॉम्पैक्ट करें",
  "compacting": "कॉम्पैक्ट हो रहा है…",
  "compactA11y": "बातचीत कॉम्पैक्ट करें: पुराने संदेशों का सारांश बनाता है और हाल के रखता है ताकि संदर्भ विंडो पार न हो.",
  "attachmentsA11y": "बातचीत में {count} अनुलग्नक",
  "responding": "उत्तर दे रहा है…",
  "inBackground": "पृष्ठभूमि में",
  "inBackgroundA11y": "कार्य अभी भी सर्वर पर चल रहा है; चैट फिर से खोलने पर यह दोबारा स्ट्रीम होगा.",
  "sessionCopy": "सत्र ID कॉपी करें",
  "sessionCopied": "सत्र ID कॉपी किया गया",
};

const ar: AssistantHeaderMessages = {
  "tokensUnit": "رمز",
  "tokensA11yReal": "الرموز المتراكمة في هذه المحادثة: {total} · {turns} دور (عدّ فعلي)",
  "tokensA11yEstimated": "الرموز المتراكمة في هذه المحادثة: {total} · {turns} دور (يشمل تقديرات CLI)",
  "ctxLabel": "سياق",
  "ctxA11y": "السياق المقدَّر: {pct}% من نافذة النموذج. عند امتلائها يبدأ النموذج بنسيان الرسائل الحديثة؛ اضغط للتلخيص لتلخيص القديم.",
  "compact": "ضغط",
  "compacting": "جارٍ الضغط…",
  "compactA11y": "ضغط المحادثة: يلخّص الرسائل القديمة ويحتفظ بالحديثة لتجنّب تجاوز نافذة السياق.",
  "attachmentsA11y": "{count} مرفق في المحادثة",
  "responding": "يردّ…",
  "inBackground": "في الخلفية",
  "inBackgroundA11y": "لا تزال المهمة قيد التشغيل على الخادم؛ ستُبثّ من جديد عند إعادة فتح المحادثة.",
  "sessionCopy": "نسخ معرّف الجلسة",
  "sessionCopied": "تم نسخ معرّف الجلسة",
};

export const assistantHeader: Record<LocaleCode, AssistantHeaderMessages> = {
  es,
  en,
  fr,
  pt,
  it,
  ru,
  zh,
  ko,
  ja,
  hi,
  ar,
};
