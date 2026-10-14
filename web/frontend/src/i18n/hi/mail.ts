// Aggregator for the mail namespace — split into ./mail/part*.ts to keep each
// file <1000 lines. The merged object is byte-identical to the pre-split literal
// (contiguous key slices spread in order), so the generated i18n JSON is unchanged.
import mailPart1 from "./mail/part1";
import mailPart2 from "./mail/part2";

const mail = { ...mailPart1, ...mailPart2, serverConnection: {
  "title": "SMTP / IMAP सर्वर",
  "intro": "किसी अन्य सहेजे गए सर्वर के मेलबॉक्स इस्तेमाल करें। यह चयन इस टैब में मेल पर लागू होगा; दूसरे मॉड्यूल अपने सक्रिय सर्वर पर रहेंगे।",
  "serverLabel": "मेल सर्वर",
  "hint": "सर्वर पर संगत Postfix/Dovecot और सुलभ मेल पोर्ट होने चाहिए। चुने गए सर्वर के मेलबॉक्स और प्रवेश विवरण इस्तेमाल होते हैं।",
  "apply": "सर्वर लागू करें",
  "current": "वर्तमान सर्वर",
  "currentHint": "मेल पैनल के सक्रिय सर्वर का इस्तेमाल करता है।",
  "loading": "सर्वर लोड हो रहे हैं…",
  "loadError": "सर्वर लोड नहीं हो सके।",
  "unavailable": "चुना गया सर्वर उपलब्ध नहीं है",
  "unavailableHint": "चुना गया सर्वर अब उपलब्ध नहीं है। दूसरा चुनें या वर्तमान सर्वर पर लौटें।",
  "empty": "स्वीकृत SSH फ़िंगरप्रिंट वाले किसी अन्य सक्षम सर्वर तक आपकी पहुँच नहीं है।",
  "connecting": "कनेक्शन की जाँच हो रही है…",
  "connectError": "कनेक्ट नहीं हो सका या चयन सहेजा नहीं जा सका।",
  "active": "मेल: {server}"
} } as const;

export default mail;
