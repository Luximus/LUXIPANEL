// Aggregator for the mail namespace — split into ./mail/part*.ts to keep each
// file <1000 lines. The merged object is byte-identical to the pre-split literal
// (contiguous key slices spread in order), so the generated i18n JSON is unchanged.
import mailPart1 from "./mail/part1";
import mailPart2 from "./mail/part2";

const mail = { ...mailPart1, ...mailPart2, serverConnection: {
  "title": "Сервер SMTP / IMAP",
  "intro": "Используйте почтовые ящики другого сохранённого сервера. Выбор действует для Почты в этой вкладке; остальные модули сохраняют свой активный сервер.",
  "serverLabel": "Почтовый сервер",
  "hint": "Серверу нужны совместимые Postfix/Dovecot и доступные почтовые порты. Используются ящики и учётные данные выбранного сервера.",
  "apply": "Применить сервер",
  "current": "Текущий сервер",
  "currentHint": "Почта использует активный сервер панели.",
  "loading": "Загрузка серверов…",
  "loadError": "Не удалось загрузить серверы.",
  "unavailable": "Выбранный сервер недоступен",
  "unavailableHint": "Выбранный сервер больше недоступен. Выберите другой или вернитесь к текущему серверу.",
  "empty": "У вас нет доступа к другим включённым серверам с подтверждённым отпечатком SSH.",
  "connecting": "Проверка соединения…",
  "connectError": "Не удалось подключиться или сохранить выбор.",
  "active": "Почта: {server}"
} } as const;

export default mail;
