// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Messages returned by the Tolqia credential probe and shown in the panel. */
import { API_LOCALES, apiLocale } from "../../../shared/i18n/errors.js";

type Message = "timeout" | "contact" | "rejected" | "inactive" | "plan" | "http" | "unexpected" | "missing" | "format";
type Translations = readonly [string, string, string, string, string, string, string, string, string, string, string, string];

const messages = {
  timeout: ["Tiempo de espera agotado al contactar con Tolqia", "Timed out contacting Tolqia", "Délai dépassé lors de la connexion à Tolqia", "Zeitüberschreitung bei der Verbindung zu Tolqia", "Tempo scaduto durante la connessione a Tolqia", "Tempo esgotado ao contactar o Tolqia", "انتهت مهلة الاتصال بـ Tolqia", "Tolqia-এর সঙ্গে যোগাযোগের সময় শেষ হয়েছে", "Tolqia से संपर्क का समय समाप्त हो गया", "Tolqia への接続がタイムアウトしました", "Tolqia 연결 시간이 초과되었습니다", "Превышено время ожидания ответа Tolqia"],
  contact: ["No se pudo contactar con Tolqia", "Could not contact Tolqia", "Impossible de contacter Tolqia", "Tolqia konnte nicht erreicht werden", "Impossibile contattare Tolqia", "Não foi possível contactar o Tolqia", "تعذّر الاتصال بـ Tolqia", "Tolqia-এর সঙ্গে যোগাযোগ করা যায়নি", "Tolqia से संपर्क नहीं हो सका", "Tolqia に接続できませんでした", "Tolqia에 연결할 수 없습니다", "Не удалось связаться с Tolqia"],
  rejected: ["Tolqia rechazó el token (no autorizado)", "Tolqia rejected the token (unauthorized)", "Tolqia a refusé le jeton (non autorisé)", "Tolqia hat das Token abgelehnt (nicht autorisiert)", "Tolqia ha rifiutato il token (non autorizzato)", "O Tolqia rejeitou o token (não autorizado)", "رفض Tolqia الرمز (غير مصرح به)", "Tolqia টোকেনটি প্রত্যাখ্যান করেছে (অনুমোদিত নয়)", "Tolqia ने टोकन अस्वीकार कर दिया (अनधिकृत)", "Tolqia がトークンを拒否しました（認証されていません）", "Tolqia가 토큰을 거부했습니다(인증되지 않음)", "Tolqia отклонил токен (нет авторизации)"],
  inactive: ["El plan de Tolqia está inactivo", "The Tolqia plan is inactive", "L’abonnement Tolqia est inactif", "Der Tolqia-Tarif ist inaktiv", "Il piano Tolqia non è attivo", "O plano Tolqia está inativo", "خطة Tolqia غير نشطة", "Tolqia প্ল্যানটি নিষ্ক্রিয়", "Tolqia प्लान निष्क्रिय है", "Tolqia のプランは無効です", "Tolqia 요금제가 비활성 상태입니다", "Тариф Tolqia неактивен"],
  plan: ["La cuenta de Tolqia necesita un plan Plus o Premium", "The Tolqia account needs a Plus or Premium plan", "Le compte Tolqia nécessite un abonnement Plus ou Premium", "Das Tolqia-Konto benötigt einen Plus- oder Premium-Tarif", "L’account Tolqia richiede un piano Plus o Premium", "A conta Tolqia precisa de um plano Plus ou Premium", "يحتاج حساب Tolqia إلى خطة Plus أو Premium", "Tolqia অ্যাকাউন্টের জন্য Plus বা Premium প্ল্যান প্রয়োজন", "Tolqia खाते के लिए Plus या Premium प्लान आवश्यक है", "Tolqia アカウントには Plus または Premium プランが必要です", "Tolqia 계정에 Plus 또는 Premium 요금제가 필요합니다", "Для аккаунта Tolqia нужен тариф Plus или Premium"],
  http: ["Tolqia respondió {status}", "Tolqia responded with {status}", "Tolqia a répondu avec le code {status}", "Tolqia antwortete mit Status {status}", "Tolqia ha risposto con il codice {status}", "O Tolqia respondeu com o código {status}", "استجاب Tolqia بالرمز {status}", "Tolqia {status} কোড দিয়ে সাড়া দিয়েছে", "Tolqia ने {status} कोड के साथ जवाब दिया", "Tolqia はステータス {status} を返しました", "Tolqia가 상태 코드 {status}(으)로 응답했습니다", "Tolqia ответил кодом {status}"],
  unexpected: ["Respuesta inesperada de Tolqia", "Unexpected response from Tolqia", "Réponse inattendue de Tolqia", "Unerwartete Antwort von Tolqia", "Risposta imprevista da Tolqia", "Resposta inesperada do Tolqia", "استجابة غير متوقعة من Tolqia", "Tolqia থেকে অপ্রত্যাশিত উত্তর এসেছে", "Tolqia से अप्रत्याशित उत्तर मिला", "Tolqia から予期しない応答がありました", "Tolqia에서 예상치 못한 응답을 받았습니다", "Неожиданный ответ Tolqia"],
  missing: ["No hay ningún token de Tolqia configurado", "No Tolqia token is configured", "Aucun jeton Tolqia n’est configuré", "Es ist kein Tolqia-Token konfiguriert", "Non è configurato alcun token Tolqia", "Não está configurado nenhum token Tolqia", "لم يُضبط رمز Tolqia", "কোনো Tolqia টোকেন কনফিগার করা নেই", "Tolqia टोकन कॉन्फ़िगर नहीं किया गया है", "Tolqia トークンが設定されていません", "Tolqia 토큰이 설정되지 않았습니다", "Токен Tolqia не настроен"],
  format: ["Formato de token inválido: debe ser tq_live_ seguido de 40 caracteres", "Invalid token format: tq_live_ must be followed by 40 characters", "Format de jeton invalide : tq_live_ doit être suivi de 40 caractères", "Ungültiges Tokenformat: Auf tq_live_ müssen 40 Zeichen folgen", "Formato del token non valido: tq_live_ deve essere seguito da 40 caratteri", "Formato de token inválido: tq_live_ deve ser seguido de 40 caracteres", "تنسيق الرمز غير صالح: يجب أن يتبع tq_live_ أربعون حرفًا", "টোকেনের বিন্যাস ভুল: tq_live_-এর পরে ৪০টি অক্ষর থাকতে হবে", "टोकन का प्रारूप अमान्य है: tq_live_ के बाद 40 वर्ण होने चाहिए", "トークンの形式が無効です。tq_live_ の後に 40 文字必要です", "토큰 형식이 잘못되었습니다. tq_live_ 뒤에 40자가 와야 합니다", "Неверный формат токена: после tq_live_ должно быть 40 символов"],
} as const satisfies Record<Message, Translations>;

export function localizeTolqiaMessage(locale: unknown, source: string): string {
  const key = (Object.keys(messages) as Message[]).find((candidate) => messages[candidate][0] === source);
  const status = /^Tolqia respondió (\d{3})$/.exec(source)?.[1];
  const selected = key ?? (status ? "http" : null);
  if (!selected) return source;
  return (messages[selected][API_LOCALES.indexOf(apiLocale(locale))] ?? messages[selected][1]).replace("{status}", status ?? "");
}

type SummaryKey = "plan" | "active" | "pending" | "unlimited" | "upTo" | "groups" | "members";
const summary = {
  plan: ["Plan {plan}", "{plan} plan", "Offre {plan}", "Tarif {plan}", "Piano {plan}", "Plano {plan}", "خطة {plan}", "{plan} প্ল্যান", "{plan} प्लान", "{plan} プラン", "{plan} 요금제", "Тариф {plan}"],
  active: ["activo", "active", "actif", "aktiv", "attivo", "ativo", "نشط", "সক্রিয়", "सक्रिय", "有効", "활성", "активен"],
  pending: ["pago pendiente", "payment pending", "paiement en attente", "Zahlung ausstehend", "pagamento in sospeso", "pagamento pendente", "الدفع معلّق", "পেমেন্ট অপেক্ষমাণ", "भुगतान लंबित", "支払い待ち", "결제 대기 중", "ожидает оплаты"],
  unlimited: ["traducción sin límite de participantes", "translation with no participant limit", "traduction sans limite de participants", "Übersetzung ohne Teilnehmerlimit", "traduzione senza limite di partecipanti", "tradução sem limite de participantes", "ترجمة دون حد للمشاركين", "অংশগ্রহণকারীর সীমা ছাড়াই অনুবাদ", "प्रतिभागियों की सीमा के बिना अनुवाद", "参加者数の制限なく翻訳", "참가자 제한 없이 번역", "перевод без ограничения числа участников"],
  upTo: ["traducción hasta {count} participantes", "translation for up to {count} participants", "traduction pour jusqu’à {count} participants", "Übersetzung für bis zu {count} Teilnehmer", "traduzione fino a {count} partecipanti", "tradução para até {count} participantes", "ترجمة لما يصل إلى {count} مشاركًا", "সর্বোচ্চ {count} জনের জন্য অনুবাদ", "अधिकतम {count} प्रतिभागियों के लिए अनुवाद", "最大 {count} 人まで翻訳", "최대 {count}명까지 번역", "перевод для {count} участников"],
  groups: ["{count} grupos", "{count} groups", "{count} groupes", "{count} Gruppen", "{count} gruppi", "{count} grupos", "{count} مجموعات", "{count}টি গ্রুপ", "{count} समूह", "{count} グループ", "그룹 {count}개", "{count} групп"],
  members: ["{count} miembros", "{count} members", "{count} membres", "{count} Mitglieder", "{count} membri", "{count} membros", "{count} أعضاء", "{count} জন সদস্য", "{count} सदस्य", "{count} 人のメンバー", "멤버 {count}명", "{count} участников"],
} as const satisfies Record<SummaryKey, Translations>;

export function summarizeTolqiaAccount(locale: unknown, account: {
  plan: string;
  status: string;
  displayName: string;
  limits: { translationParticipants: number | null; maxGroups: number | null; maxMembers: number | null };
}): string {
  const index = API_LOCALES.indexOf(apiLocale(locale));
  const phrase = (key: SummaryKey, value?: string | number) => (summary[key][index] ?? summary[key][1]).replace(/\{(?:plan|count)\}/g, String(value ?? ""));
  const plan = account.plan ? account.plan[0]!.toUpperCase() + account.plan.slice(1) : "—";
  const parts = [phrase("plan", plan), phrase(account.status === "active" ? "active" : "pending")];
  parts.push(account.limits.translationParticipants === null ? phrase("unlimited") : phrase("upTo", account.limits.translationParticipants));
  if (account.limits.maxGroups !== null) parts.push(phrase("groups", account.limits.maxGroups));
  if (account.limits.maxMembers !== null) parts.push(phrase("members", account.limits.maxMembers));
  if (account.displayName) parts.push(account.displayName);
  return parts.join(" · ");
}
