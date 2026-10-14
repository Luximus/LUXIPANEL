// Aggregator for the mail namespace — split into ./mail/part*.ts to keep each
// file <1000 lines. The merged object is byte-identical to the pre-split literal
// (contiguous key slices spread in order), so the generated i18n JSON is unchanged.
import mailPart1 from "./mail/part1";
import mailPart2 from "./mail/part2";

const mail = { ...mailPart1, ...mailPart2, serverConnection: {
  "title": "SMTP / IMAP সার্ভার",
  "intro": "অন্য সংরক্ষিত সার্ভারের মেইলবক্স ব্যবহার করুন। এই নির্বাচন এই ট্যাবের মেইলে প্রযোজ্য; অন্য মডিউলগুলো তাদের সক্রিয় সার্ভার রাখবে।",
  "serverLabel": "মেইল সার্ভার",
  "hint": "সার্ভারে উপযুক্ত Postfix/Dovecot এবং ব্যবহারযোগ্য মেইল পোর্ট থাকতে হবে। নির্বাচিত সার্ভারের মেইলবক্স ও প্রবেশের তথ্য ব্যবহার করা হয়।",
  "apply": "সার্ভার প্রয়োগ করুন",
  "current": "বর্তমান সার্ভার",
  "currentHint": "মেইল প্যানেলের সক্রিয় সার্ভার ব্যবহার করে।",
  "loading": "সার্ভার লোড হচ্ছে…",
  "loadError": "সার্ভার লোড করা যায়নি।",
  "unavailable": "নির্বাচিত সার্ভার অনুপলব্ধ",
  "unavailableHint": "নির্বাচিত সার্ভার আর উপলব্ধ নেই। অন্য একটি বেছে নিন অথবা বর্তমান সার্ভারে ফিরুন।",
  "empty": "অনুমোদিত SSH ফিঙ্গারপ্রিন্টসহ অন্য কোনো সক্রিয় সার্ভারে আপনার প্রবেশাধিকার নেই।",
  "connecting": "সংযোগ যাচাই হচ্ছে…",
  "connectError": "সংযোগ করা বা নির্বাচন সংরক্ষণ করা যায়নি।",
  "active": "মেইল: {server}"
} } as const;

export default mail;
