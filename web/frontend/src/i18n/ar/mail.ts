// Aggregator for the mail namespace — split into ./mail/part*.ts to keep each
// file <1000 lines. The merged object is byte-identical to the pre-split literal
// (contiguous key slices spread in order), so the generated i18n JSON is unchanged.
import mailPart1 from "./mail/part1";
import mailPart2 from "./mail/part2";

const mail = { ...mailPart1, ...mailPart2, serverConnection: {
  "title": "خادم SMTP / IMAP",
  "intro": "استخدم صناديق البريد من خادم آخر محفوظ. ينطبق الاختيار على البريد في علامة التبويب هذه؛ وتحتفظ الوحدات الأخرى بخادمها النشط.",
  "serverLabel": "خادم البريد",
  "hint": "يحتاج الخادم إلى Postfix/Dovecot متوافقين ومنافذ بريد يمكن الوصول إليها. تُستخدم صناديق البريد وبيانات الدخول الخاصة بالخادم المختار.",
  "apply": "تطبيق الخادم",
  "current": "الخادم الحالي",
  "currentHint": "يستخدم البريد الخادم النشط في اللوحة.",
  "loading": "جارٍ تحميل الخوادم…",
  "loadError": "تعذّر تحميل الخوادم.",
  "unavailable": "الخادم المختار غير متاح",
  "unavailableHint": "لم يعد الخادم المختار متاحًا. اختر خادمًا آخر أو عد إلى الخادم الحالي.",
  "empty": "لا توجد خوادم أخرى مفعّلة ببصمة SSH معتمدة يمكنك الوصول إليها.",
  "connecting": "جارٍ التحقق من الاتصال…",
  "connectError": "تعذّر الاتصال أو حفظ الاختيار.",
  "active": "البريد: {server}"
} } as const;

export default mail;
