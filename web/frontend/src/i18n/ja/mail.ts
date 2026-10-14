// Aggregator for the mail namespace — split into ./mail/part*.ts to keep each
// file <1000 lines. The merged object is byte-identical to the pre-split literal
// (contiguous key slices spread in order), so the generated i18n JSON is unchanged.
import mailPart1 from "./mail/part1";
import mailPart2 from "./mail/part2";

const mail = { ...mailPart1, ...mailPart2, serverConnection: {
  "title": "SMTP / IMAP サーバー",
  "intro": "保存済みの別のサーバーのメールボックスを使用します。この選択はこのタブのメールに適用され、他のモジュールの使用中のサーバーは維持されます。",
  "serverLabel": "メールサーバー",
  "hint": "サーバーには互換性のある Postfix/Dovecot とアクセス可能なメールポートが必要です。選択したサーバーのメールボックスと認証情報を使用します。",
  "apply": "サーバーを適用",
  "current": "現在のサーバー",
  "currentHint": "パネルで使用中のサーバーのメールを使用します。",
  "loading": "サーバーを読み込み中…",
  "loadError": "サーバーを読み込めませんでした。",
  "unavailable": "選択したサーバーは利用できません",
  "unavailableHint": "選択したサーバーは利用できなくなりました。別のサーバーを選択するか、現在のサーバーに戻ってください。",
  "empty": "承認済みの SSH フィンガープリントを持つ有効な他のサーバーへのアクセス権がありません。",
  "connecting": "接続を確認中…",
  "connectError": "接続または選択の保存に失敗しました。",
  "active": "メール: {server}"
} } as const;

export default mail;
