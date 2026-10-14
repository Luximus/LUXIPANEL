// Aggregator for the mail namespace — split into ./mail/part*.ts to keep each
// file <1000 lines. The merged object is byte-identical to the pre-split literal
// (contiguous key slices spread in order), so the generated i18n JSON is unchanged.
import mailPart1 from "./mail/part1";
import mailPart2 from "./mail/part2";

const mail = { ...mailPart1, ...mailPart2, serverConnection: {
  "title": "SMTP / IMAP 서버",
  "intro": "저장된 다른 서버의 메일함을 사용합니다. 이 선택은 이 탭의 메일에 적용되며, 다른 모듈은 현재 서버를 유지합니다.",
  "serverLabel": "메일 서버",
  "hint": "서버에 호환되는 Postfix/Dovecot과 접근 가능한 메일 포트가 필요합니다. 선택한 서버의 메일함과 인증 정보를 사용합니다.",
  "apply": "서버 적용",
  "current": "현재 서버",
  "currentHint": "메일은 패널의 현재 서버를 사용합니다.",
  "loading": "서버를 불러오는 중…",
  "loadError": "서버를 불러오지 못했습니다.",
  "unavailable": "선택한 서버를 사용할 수 없음",
  "unavailableHint": "선택한 서버를 더 이상 사용할 수 없습니다. 다른 서버를 선택하거나 현재 서버로 돌아가세요.",
  "empty": "승인된 SSH 지문이 있는 다른 활성 서버에 대한 접근 권한이 없습니다.",
  "connecting": "연결 확인 중…",
  "connectError": "연결하거나 선택을 저장하지 못했습니다.",
  "active": "메일: {server}"
} } as const;

export default mail;
