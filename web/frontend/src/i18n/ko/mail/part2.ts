// Auto-split fragment of mail.ts (part 2/2) — data only, keeps <1000 lines.
// Do not reorder keys: the aggregator merges parts by spread in original order.
const mailPart2 = {
  "routing": {
    "labels": {
      "autoRemote": "구성 자동 감지: 원격",
      "local": "로컬 메일 교환기",
      "backup": "백업 메일 교환기",
      "remote": "원격 메일 교환기"
    },
    "currentMode": "현재: {mode}"
  },
  "tracking": {
    "statuses": {
      "success": "성공",
      "deferred": "지연됨",
      "failure": "실패",
      "inProgress": "진행 중",
      "unknown": "알 수 없음"
    },
    "columns": {
      "event": "이벤트",
      "fromAddress": "발신 주소",
      "sentTime": "발송 시간",
      "spamScore": "스팸 점수",
      "recipient": "수신자",
      "domain": "도메인",
      "id": "ID",
      "result": "결과",
      "actions": "작업"
    },
    "noRecordsFound": "레코드가 없습니다.",
    "zeroRecords": "0개 레코드",
    "matchesZeroRecords": "검색 결과가 0개입니다.",
    "recordsCount": "{count}개 레코드",
    "matchesRecords": "검색 결과 {count}개",
    "detailMeta": "이벤트: {event} | ID: {id} | 수신자: {recipient}"
  },
  "filters": {
    "ruleParts": {
      "from": "발신자",
      "subject": "제목",
      "to": "수신자",
      "anyRecipient": "모든 수신자",
      "reply": "회신",
      "body": "본문",
      "anyHeader": "모든 헤더",
      "notDelivered": "이전에 전달되지 않음",
      "errorMessage": "오류 메시지",
      "listId": "목록 ID",
      "spamStatus": "스팸 상태",
      "spamBar": "스팸 바",
      "spamScore": "스팸 점수"
    },
    "matches": {
      "contains": "포함",
      "matchesRegex": "regex 일치",
      "doesNotContain": "포함하지 않음",
      "equals": "일치",
      "beginsWith": "시작하는",
      "endsWith": "끝나는",
      "doesNotBegin": "시작하지 않는",
      "doesNotEnd": "끝나지 않는",
      "doesNotMatch": "일치하지 않음",
      "isAbove": "초과 (숫자만)",
      "isNotAbove": "초과하지 않음 (숫자만)",
      "isBelow": "미만 (숫자만)",
      "isNotBelow": "미만이 아님 (숫자만)"
    },
    "actions": {
      "discard": "메시지 삭제",
      "redirect": "이메일로 리디렉션",
      "fail": "오류 메시지 반환",
      "stop": "규칙 처리 중단",
      "deliverToFolder": "폴더로 전달",
      "pipe": "프로그램으로 파이프"
    },
    "joinOp": {
      "and": "그리고",
      "or": "또는"
    },
    "removeBtn": "-"
  },
  "defaultAddress": {
    "currentSetting": {
      "none": "현재 설정: (없음)",
      "forward": "현재 설정: {destination}",
      "forwardDefault": "(전달)",
      "fail": "현재 설정: :fail: {message}"
    },
    "defaultFailMessage": "해당 사용자가 없습니다"
  },
  "archive": {
    "retentionOptions": {
      "oneMonth": "1개월",
      "threeMonths": "3개월",
      "sixMonths": "6개월",
      "oneYear": "1년",
      "twoYears": "2년",
      "fiveYears": "5년",
      "tenYears": "10년",
      "forever": "영구",
      "custom": "사용자 지정"
    },
    "fields": {
      "incomingEmail": "수신 이메일",
      "outgoingMailingList": "발신 메일링 리스트 이메일",
      "outgoingEmail": "발신 이메일"
    }
  },
  "encryption": {
    "neverExpires": "만료 없음"
  },
  "actions": {
    "view": "보기",
    "save": "저장",
    "clone": "복제",
    "copy": "복사",
    "delete": "삭제",
    "edit": "편집",
    "remove": "제거"
  },
  "outbound": {
    "cardTitle": "패널 이메일 발송 (SMTP)",
    "cardDesc": "패널이 보고서 및 시스템 이메일을 보내는 데 사용하는 기본 계정 또는 외부 SMTP.",
    "back": "뒤로",
    "intro": "LUXIPANEL이 시스템 이메일(cron 에이전트 보고서, 승인 링크, 테스트)을 보낼 때 사용하는 신원입니다. 이 서버의 이메일 계정이거나 서버에 속하지 않은 외부 SMTP일 수 있습니다.",
    "modeLabel": "발송 모드",
    "modeDisabled": "비활성화",
    "modeAccount": "서버 이메일 계정 (기본값)",
    "modeExternal": "외부 SMTP",
    "accountLabel": "기본 발송 계정",
    "accountHint": "해당 계정에 저장된 SMTP 자격 증명을 사용합니다.",
    "hostLabel": "SMTP 서버",
    "portLabel": "포트",
    "userLabel": "사용자",
    "passLabel": "비밀번호",
    "passPlaceholder": "(변경 없음)",
    "fromLabel": "보낸 사람 (이메일)",
    "fromNameLabel": "보낸 사람 이름",
    "secureLabel": "직접 TLS (포트 465)",
    "save": "저장",
    "testPlaceholder": "to@example.com",
    "test": "테스트 전송",
    "hostPlaceholder": "smtp.example.com",
    "fromPlaceholder": "sender@example.com",
    "fromNamePlaceholder": "내 회사"
  },
  "table": {
    "status": {
      "active": "활성",
      "inactive": "비활성",
      "disabled": "비활성화됨"
    },
    "redirect": {
      "columns": {
        "domain": "도메인",
        "destinos": "대상"
      },
      "filters": {
        "searchDomain": "도메인 검색…"
      },
      "rowActions": {
        "edit": "편집",
        "delete": "삭제"
      }
    },
    "encryption": {
      "columns": {
        "keyId": "키 ID",
        "label": "신원",
        "keySize": "키 크기",
        "created": "생성됨",
        "expires": "만료"
      },
      "filters": {
        "searchKey": "키 검색…"
      },
      "rowActions": {
        "view": "보기",
        "delete": "삭제"
      }
    },
    "accounts": {
      "columns": {
        "address": "주소",
        "domain": "도메인",
        "uso": "할당량 / 사용량",
        "reenvios": "전달",
        "estado": "상태"
      },
      "filters": {
        "search": "주소 또는 도메인 검색…",
        "domain": "도메인",
        "estado": "상태"
      },
      "rowActions": {
        "edit": "계정 편집",
        "depurarIa": "AI로 정리",
        "password": "비밀번호 변경",
        "toggle": "활성화 / 비활성화",
        "inbox": "메일함 열기",
        "signatures": "서명 관리",
        "default": "기본값으로 사용",
        "contacts": "연락처 관리",
        "calendars": "캘린더 관리",
        "autoresponder": "자동응답 관리",
        "filters": "필터 관리",
        "forwards": "전달 관리",
        "diskusage": "디스크 사용량 관리",
        "clone": "메일 복제",
        "delete": "계정 삭제"
      },
      "quickActions": {
        "bulkForward": "전달 추가",
        "bulkQuota": "할당량 변경",
        "bulkDelete": "계정 삭제"
      }
    },
    "globalFilters": {
      "columns": {
        "name": "필터",
        "estado": "상태",
        "rules": "규칙",
        "actionsCount": "작업"
      },
      "filters": {
        "search": "필터 검색…"
      },
      "rowActions": {
        "edit": "편집",
        "delete": "삭제"
      }
    },
    "contacts": {
      "columns": {
        "email": "이메일",
        "name": "이름"
      },
      "filters": {
        "searchEmail": "이메일 검색…"
      },
      "rowActions": {
        "edit": "편집",
        "delete": "삭제"
      }
    },
    "calendars": {
      "columns": {
        "name": "이름",
        "timezone": "시간대",
        "estado": "상태"
      },
      "filters": {
        "search": "캘린더 검색…"
      },
      "rowActions": {
        "edit": "편집",
        "delete": "삭제"
      }
    },
    "signatures": {
      "columns": {
        "sender": "발신자",
        "preview": "서명"
      },
      "filters": {
        "search": "필터 및 검색…"
      },
      "rowActions": {
        "edit": "편집",
        "delete": "삭제"
      }
    },
    "filters": {
      "columns": {
        "name": "이름",
        "estado": "상태"
      },
      "filters": {
        "search": "필터 검색…"
      },
      "rowActions": {
        "edit": "편집",
        "delete": "삭제"
      }
    }
  },
  "confirm": {
    "bulkDeleteAccounts": "{count}개의 메일 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
    "deleteAccount": "{address} 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
    "deleteAccountTitle": "계정 삭제",
    "deleteAutoresponder": "이 계정의 자동응답을 삭제하시겠습니까?",
    "deleteByDate": "{from}부터 {to}까지의 {folder} 메일이 삭제됩니다. 계속하시겠습니까?",
    "deleteByDateTitle": "날짜별 메일 삭제",
    "deleteCalendar": "\"{label}\" 캘린더를 삭제하시겠습니까?",
    "deleteCalendarTitle": "캘린더 삭제",
    "deleteContact": "\"{label}\" 연락처를 삭제하시겠습니까?",
    "deleteContactTitle": "연락처 삭제",
    "deleteDomainForward": "@{domain}의 전역 리디렉션을 삭제하시겠습니까?",
    "deleteDomainForwardTitle": "전역 리디렉션 삭제",
    "deleteEncryptionKey": "이 암호화 키를 삭제하시겠습니까?",
    "deleteFilter": "\"{name}\" 필터를 삭제하시겠습니까?",
    "deleteFilterTitle": "필터 삭제",
    "deleteForward": "{destination}(으)로의 전달을 삭제하시겠습니까?",
    "deleteGlobalFilter": "전역 필터 \"{label}\"을(를) 삭제하시겠습니까?",
    "deleteGlobalFilterTitle": "전역 필터 삭제",
    "yesDelete": "예, 삭제합니다"
  },
  "empty": {
    "noDomains": "도메인 없음",
    "noFolders": "이 계정에 대한 폴더를 찾을 수 없습니다.",
    "noOtherAccount": "사용 가능한 다른 계정이 없습니다"
  },
  "errors": {
    "accountCreateFailed": "계정 생성에 실패했습니다",
    "accountNotFound": "계정을 찾을 수 없습니다",
    "accountUpdateFailed": "계정 업데이트에 실패했습니다",
    "accountUpdatedForwardsFailed": "계정은 업데이트되었으나 리디렉션 업데이트에 실패했습니다",
    "accountsLoadFailed": "계정을 불러오지 못했습니다",
    "autoDeleteThresholdInvalid": "자동 삭제 임계값이 유효하지 않습니다.",
    "autoresponderDeleteFailed": "자동응답을 삭제하지 못했습니다",
    "autoresponderSaveFailed": "자동응답을 저장하지 못했습니다.",
    "calendarDeleteFailed": "캘린더를 삭제하지 못했습니다",
    "calendarNotFound": "캘린더를 찾을 수 없습니다",
    "calendarSaveFailed": "캘린더를 저장하지 못했습니다.",
    "cloneCreateFailed": "새 계정을 생성하지 못했습니다.",
    "cloneFailed": "메일을 복제하지 못했습니다.",
    "cloneIdResolveFailed": "계정은 생성되었으나 ID를 확인하지 못했습니다. '기존'으로 다시 시도하세요.",
    "cloneLocalAndDomainRequired": "로컬 부분과 도메인을 입력하세요.",
    "clonePasswordTooShort": "비밀번호는 6자 이상이어야 합니다.",
    "contactDeleteFailed": "연락처를 삭제하지 못했습니다",
    "contactNotFound": "연락처를 찾을 수 없습니다",
    "contactSaveFailed": "연락처를 저장하지 못했습니다.",
    "copyByRangeFailed": "범위별로 복사하지 못했습니다",
    "customScoreInvalid": "사용자 지정 점수가 유효하지 않습니다.",
    "dateRangeRequired": "시작 날짜와 종료 날짜를 선택해야 합니다",
    "defaultAddressLoadFailed": "기본 주소를 불러오지 못했습니다.",
    "defaultAddressSaveFailed": "기본 주소를 저장하지 못했습니다.",
    "deleteByRangeFailed": "범위별로 삭제하지 못했습니다",
    "deleteFailed": "삭제에 실패했습니다",
    "destEmailInvalid": "대상 이메일이 유효하지 않습니다",
    "destinationsInvalidFormat": "하나 이상의 대상 형식이 유효하지 않습니다.",
    "diskUsageLoadFailed": "디스크 사용량을 불러오지 못했습니다",
    "domainForwardDeleteFailed": "전역 리디렉션을 삭제하지 못했습니다.",
    "domainForwardsLoadFailed": "전역 리디렉션을 불러오지 못했습니다.",
    "domainRedirectSaveFailed": "전역 리디렉션을 저장하지 못했습니다.",
    "domainsLoadFailed": "DNS 도메인을 불러오지 못했습니다",
    "filterDeleteFailed": "필터를 삭제하지 못했습니다",
    "filterNotFound": "필터를 찾을 수 없습니다",
    "filterSaveFailed": "필터를 저장하지 못했습니다.",
    "forwardAlreadyExists": "{destination}(으)로의 전달이 이미 존재합니다",
    "forwardsSaveFailed": "서버에 전달을 저장하지 못했습니다",
    "globalFilterDeleteFailed": "전역 필터를 삭제하지 못했습니다.",
    "globalFilterSaveFailed": "전역 필터를 저장하지 못했습니다.",
    "globalFilterTestFailed": "테스트를 실행하지 못했습니다.",
    "globalFiltersLoadFailed": "전역 필터를 불러오지 못했습니다.",
    "indicateTestDestEmail": "테스트 대상 이메일을 입력하세요.",
    "localPartInvalid": "@ 앞의 사용자 형식이 유효하지 않습니다.",
    "localPartInvalidNoPoint": "@ 앞의 사용자 형식이 유효하지 않습니다",
    "mustAddAtLeastOneAction": "최소 하나의 작업을 추가해야 합니다.",
    "mustAddAtLeastOneDestEmail": "최소 하나의 대상 이메일을 추가해야 합니다.",
    "mustAddAtLeastOneRule": "최소 하나의 규칙을 추가해야 합니다.",
    "mustEnterBody": "메시지 내용을 입력해야 합니다.",
    "mustEnterSubject": "제목을 입력해야 합니다.",
    "mustEnterTestMessage": "테스트 메시지를 입력해야 합니다.",
    "mustEnterValidDestEmail": "유효한 대상 이메일을 입력해야 합니다.",
    "mustIndicateCalendarName": "캘린더 이름을 입력해야 합니다.",
    "mustIndicateContactEmail": "연락처 이메일을 입력해야 합니다.",
    "mustIndicateFilterName": "필터 이름을 입력해야 합니다.",
    "mustIndicateName": "이름을 입력해야 합니다.",
    "mustSelectDomain": "도메인을 선택해야 합니다.",
    "mustSelectDomainNoPoint": "도메인을 선택해야 합니다",
    "noAutoresponderToDelete": "삭제할 자동응답이 없습니다",
    "passwordChangeFailed": "비밀번호 변경에 실패했습니다",
    "quotaInvalid": "쿼터가 유효하지 않습니다",
    "routingLoadFailed": "이메일 라우팅 설정을 불러오지 못했습니다.",
    "routingSaveFailed": "이메일 라우팅 설정을 저장하지 못했습니다.",
    "saveFailed": "저장에 실패했습니다",
    "scoreTypesLoadFailed": "점수 유형 카탈로그를 불러오지 못했습니다.",
    "selectDestAccount": "대상 계정을 선택하세요",
    "selectValidDomain": "유효한 도메인을 선택하세요.",
    "spamFiltersLoadFailed": "스팸 필터를 불러오지 못했습니다.",
    "spamFiltersSaveFailed": "스팸 필터 설정을 저장하지 못했습니다.",
    "testEmailFailed": "테스트 전송에 실패했습니다",
    "toggleFailed": "상태 변경에 실패했습니다",
    "trackDeliveryLoadFailed": "전송 추적을 불러오지 못했습니다."
  },
  "labels": {
    "accountColon": "계정: {address}",
    "activating": "활성화 중",
    "cloneStartedBg": "백그라운드에서 복제가 시작되었습니다. 완료되면 알림으로 알려드립니다.",
    "cloning": "복제 중…",
    "currentAccountColon": "현재 계정: {address}",
    "deactivating": "비활성화 중",
    "destEmailForCount": "{count}개 계정에 추가할 전달 대상 이메일:",
    "loading": "불러오는 중...",
    "newQuotaFor": "{count}개 계정의 새 쿼터(MB). 무제한은 0을 사용하세요.",
    "no": "아니요",
    "noGlobalLimit": "전역 제한 없음",
    "originColon": "원본: {addr}",
    "sendingTest": "테스트 전송 중…",
    "sudoPromptMessage": "서버에서 권한 없이 메일박스 사용량을 읽을 수 없습니다. SSH 사용자의 sudo 비밀번호를 입력하세요(서버에 암호화되어 저장됩니다).",
    "to": "→",
    "total": "합계",
    "unlimited": "무제한",
    "yes": "예",
    "keepCopy": "사본 저장"
  },
  "placeholders": {
    "passwordNoChanges": "•••••••• (변경 없음)",
    "selectDomain": "도메인 선택...",
    "value": "값",
    "valueIfApplicable": "값 (해당하는 경우)"
  },
  "status": {
    "active": "활성",
    "deactivated": "비활성화됨",
    "inactive": "비활성"
  },
  "titles": {
    "addForward": "전달 추가",
    "changeQuota": "쿼터 변경",
    "deleteAccounts": "계정 삭제",
    "deleteAutoresponder": "자동응답 삭제",
    "deleteEncryptionKey": "키 삭제",
    "deleteForward": "전달 삭제"
  },
  "toasts": {
    "accountActivated": "계정이 활성화되었습니다",
    "accountCreated": "계정이 성공적으로 생성되었습니다",
    "accountDeactivated": "계정이 비활성화되었습니다",
    "accountDeleted": "계정이 삭제되었습니다",
    "accountUpdated": "계정이 업데이트되었습니다 ({localPart}@{domain})",
    "archiveDefaultUpdated": "기본 보관 설정이 업데이트되었습니다.",
    "archiveDomainUpdated": "{domain}의 보관이 업데이트되었습니다.",
    "autoDeleteDisabled": "자동 삭제가 비활성화되었습니다",
    "autoDeleteEnabled": "자동 삭제가 활성화되었습니다",
    "autoDeleteUpdated": "자동 삭제가 업데이트되었습니다",
    "autoresponderDeleted": "자동응답이 삭제되었습니다",
    "autoresponderSaved": "자동응답이 저장되었습니다",
    "blacklistUpdated": "블랙리스트가 업데이트되었습니다",
    "bulkDeletedCount": "{ok}/{count}개 계정이 삭제되었습니다",
    "bulkUpdatedCount": "{ok}/{count}개 계정이 업데이트되었습니다",
    "calculatedScoresUpdated": "계산된 점수가 업데이트되었습니다",
    "calendarCreated": "캘린더가 생성되었습니다",
    "calendarDeleted": "캘린더가 삭제되었습니다",
    "calendarUpdated": "캘린더가 업데이트되었습니다",
    "cloneStarted": "복제가 시작되었습니다 — 완료되면 알려드립니다",
    "contactCreated": "연락처가 생성되었습니다",
    "contactDeleted": "연락처가 삭제되었습니다",
    "contactUpdated": "연락처가 업데이트되었습니다",
    "defaultAddressUpdated": "@{domain}의 기본 주소가 업데이트되었습니다",
    "defaultInboxSet": "이제 {address}이(가) 기본 메일입니다",
    "domainForwardDeleted": "@{domain}의 전역 리디렉션이 삭제되었습니다",
    "emailRoutingUpdated": "@{domain}의 이메일 라우팅이 업데이트되었습니다",
    "emailsCopied": "{folder}에서 {count}개의 메일을 복사했습니다",
    "emailsDeleted": "{folder}에서 {count}개의 메일을 삭제했습니다",
    "filterCreated": "필터가 생성되었습니다",
    "filterDeleted": "필터가 삭제되었습니다",
    "filterUpdated": "필터가 업데이트되었습니다",
    "forwardAddedCount": "{ok}/{count}개 계정에 전달이 추가되었습니다",
    "forwardDeleted": "전달이 삭제되었습니다",
    "forwardsUpdated": "전달이 업데이트되었습니다",
    "globalFilterCreated": "전역 필터가 생성되었습니다",
    "globalFilterDeleted": "전역 필터가 삭제되었습니다",
    "globalFilterUpdated": "전역 필터가 업데이트되었습니다",
    "globalRedirectSaved": "@{domain}의 전역 리디렉션이 저장되었습니다",
    "keyDeleted": "키가 삭제되었습니다.",
    "keyGenerated": "키가 생성되었습니다.",
    "passwordUpdated": "비밀번호가 업데이트되었습니다",
    "publicKeyImported": "공개 키를 가져왔습니다.",
    "settingsSaved": "설정이 저장되었습니다 ✓",
    "spamBoxDisabled": "스팸 보관함이 비활성화되었습니다",
    "spamBoxEnabled": "스팸 보관함이 활성화되었습니다",
    "spamBoxUpdated": "스팸 보관함이 업데이트되었습니다",
    "spamFiltersDisabled": "스팸 필터가 비활성화되었습니다",
    "spamFiltersEnabled": "스팸 필터가 활성화되었습니다",
    "spamThresholdUpdated": "스팸 임계값이 업데이트되었습니다",
    "testEmailSent": "테스트 메일이 전송되었습니다 ✓",
    "whitelistUpdated": "화이트리스트가 업데이트되었습니다"
  },
  "signaturesDrawer": {
    "title": "서명",
    "addSignature": "서명 추가",
    "close": "닫기",
    "tableTitle": "서명"
  },
  "dataTableTitles": {
    "rules": "규칙",
    "publicKeys": "공개 키",
    "privateKeys": "개인 키",
    "accounts": "계정",
    "globalFilters": "전역 필터",
    "contacts": "연락처",
    "calendars": "캘린더",
    "filters": "필터"
  },
  "trackColumns": {
    "event": "이벤트",
    "fromAddress": "보낸 주소",
    "sentTime": "발송 시간",
    "spamScore": "스팸 점수",
    "recipient": "수신자",
    "domain": "도메인",
    "queueId": "ID",
    "result": "결과",
    "actions": "작업"
  }
} as const;

export default mailPart2;
