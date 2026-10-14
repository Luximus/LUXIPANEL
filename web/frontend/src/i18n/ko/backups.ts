const backups = {
  "pageTitle": "백업",
  "settings": {
    "title": "백업 설정",
    "description": "연결된 서버의 저장 위치 및 환경 설정입니다.",
    "sections": "설정 섹션",
    "localHelp": "이 서버의 로컬 백업은 여기에 저장됩니다.",
    "changeDirWarning": "폴더를 변경하면 확인 후 기존 로컬 백업이 삭제됩니다.",
    "retentionHelp": "수동 백업과 새 일정에 적용됩니다. 기존 일정에는 자체 제한이 유지됩니다.",
    "save": "변경 사항 저장",
    "lastSuccess": "마지막 성공한 백업",
    "localCopies": "로컬 백업",
    "activeSchedules": "활성 일정",
    "advancedCron": "사용자 지정 Cron 표현식",
    "loading": "설정 불러오는 중…",
    "loadError": "이 서버의 설정을 불러올 수 없습니다.",
    "pending": "저장되지 않은 변경 사항이 있습니다.",
    "countError": "백업 개수를 1에서 365 사이로 선택하세요.",
    "saving": "저장 중…",
    "saved": "설정이 저장되었습니다.",
    "previewError": "폴더를 확인할 수 없습니다.",
    "destinationNotEmpty": "새 폴더에 이미 LUXIPANEL 백업이 있습니다.",
    "changeConfirm": "{path}의 로컬 백업 {count}개가 삭제됩니다. S3/R2 백업은 유지됩니다. 폴더를 변경하시겠습니까?",
    "changeTitle": "백업 폴더 변경",
    "changeError": "폴더를 변경할 수 없습니다.",
    "tables": "표",
    "localHeading": "로컬 대상",
    "overview": "백업 상태",
    "targetChanged": "서버가 변경되었습니다. 설정을 다시 확인하세요."
  },
  "status": {
    "completed": "완료",
    "failed": "실패",
    "running": "진행 중"
  },
  "header": {
    "heading": "백업",
    "subheading": "서버 파일, 데이터베이스, 메일 및 설정을 보호합니다.",
    "btnBackupNow": "지금 백업"
  },
  "configCard": {
    "title": "백업 설정",
    "subtitle": "로컬 디렉터리 및 원격 스토리지.",
    "labelLocalDir": "로컬 백업 디렉터리",
    "placeholderLocalDir": "/var/backups/luxipanel",
    "labelRetentionDefault": "기본으로 보관할 로컬 백업 수",
    "s3Section": "S3 / Cloudflare R2",
    "labelEndpoint": "엔드포인트",
    "labelBucket": "버킷",
    "labelAccessKeyId": "액세스 키 ID",
    "labelSecretAccessKey": "시크릿 액세스 키",
    "btnBrowse": "찾아보기",
    "tabLocal": "로컬",
    "tabCloud": "클라우드"
  },
  "pathBrowserDialog": {
    "title": "폴더 선택",
    "btnUp": "상위 폴더",
    "btnCancel": "취소",
    "btnSelect": "이 폴더 사용"
  },
  "backupSources": {
    "title": "백업 대상",
    "scopeFull": "전체 서버 (선별)",
    "scopeFullHint": "데이터베이스, 메일, 패널 구성 및 /etc /home /var/www /root",
    "scopeCustom": "사용자 지정",
    "labelDatabases": "데이터베이스",
    "dbAll": "전체",
    "dbPick": "선택…",
    "dbChoose": "데이터베이스 선택",
    "dbNone": "선택 없음",
    "labelMail": "메일 (vmail + Postfix/Dovecot)",
    "labelPanelConfig": "패널 구성",
    "foldersTitle": "폴더",
    "addFolder": "폴더 추가",
    "noFolders": "선택된 폴더 없음"
  },
  "dbPickerDialog": {
    "title": "데이터베이스 선택",
    "loading": "로딩 중…",
    "btnCancel": "취소",
    "btnSelect": "선택 사용",
    "btnRetry": "다시 시도",
    "unavailableSelection": "선택한 데이터베이스 중 하나를 더 이상 사용할 수 없습니다. 선택을 확인하세요."
  },
  "storagesSection": {
    "subtitle": "백업을 위한 클라우드 대상 (S3 / Cloudflare R2).",
    "tableTitle": "스토리지",
    "btnNew": "새 스토리지"
  },
  "storageDialog": {
    "titleNew": "새 클라우드 스토리지",
    "titleEdit": "클라우드 스토리지 편집",
    "labelName": "이름",
    "placeholderName": "내 R2 버킷",
    "labelProvider": "공급자",
    "optS3": "Amazon S3",
    "optR2": "Cloudflare R2",
    "labelBucket": "버킷",
    "labelPrefix": "접두사 (폴더)",
    "placeholderPrefix": "backups/",
    "labelEndpoint": "엔드포인트",
    "labelRegion": "리전",
    "labelAccessKey": "액세스 키 ID",
    "labelSecret": "시크릿 액세스 키",
    "secretKeepHint": "현재 시크릿을 유지하려면 비워두세요.",
    "btnCancel": "취소",
    "btnSave": "저장",
    "usingCentralCred": "설정 → 자격 증명의 중앙 자격 증명을 사용 중입니다 (버킷만 정의).",
    "credRequired": "{provider} 자격 증명이 설정되지 않았습니다. 이 대상을 사용하려면 설정 → 자격 증명에 등록하세요.",
    "credRequiredCta": "설정 → 자격 증명으로 이동"
  },
  "progress": {
    "creating": "백업 생성 중… 몇 분 정도 걸릴 수 있습니다."
  },
  "historySection": {
    "title": "백업 기록",
    "tableTitle": "백업",
    "count": "{count}개",
    "countPartial": "총 {total}개 중 {shown}개 표시"
  },
  "schedulesSection": {
    "title": "예약",
    "btnNew": "새로 만들기",
    "loading": "로딩 중...",
    "active": "활성",
    "paused": "일시 중지",
    "copies": "개",
    "pause": "일시 중지",
    "enable": "활성화",
    "edit": "편집",
    "delete": "삭제"
  },
  "backupDialog": {
    "title": "수동 백업 생성",
    "labelName": "레이블",
    "placeholderName": "업그레이드 전",
    "labelStorage": "스토리지",
    "optionLocal": "로컬",
    "optionS3": "AWS S3",
    "optionR2": "Cloudflare R2",
    "labelIncludeDb": "PostgreSQL 덤프 포함",
    "sourcesTitle": "백업 대상",
    "labelIncludeDatabases": "데이터베이스 (MySQL/MariaDB + PostgreSQL)",
    "labelIncludeMail": "메일 계정 (사서함 + 설정)",
    "labelIncludePanelConfig": "LuxiPanel 설정",
    "btnCancel": "취소",
    "btnStart": "백업 시작"
  },
  "scheduleDialog": {
    "title": "백업 예약",
    "labelName": "이름",
    "placeholderName": "주간 백업",
    "labelSchedule": "일정 (cron)",
    "placeholderSchedule": "0 3 * * 0",
    "labelStorage": "스토리지",
    "optionLocal": "로컬",
    "optionS3": "S3",
    "optionR2": "R2",
    "labelRetention": "보관할 로컬 백업 수",
    "labelFrequency": "빈도",
    "optHourly": "매시간",
    "optDaily": "매일",
    "optWeekly": "매주",
    "optMonthly": "매월",
    "labelTime": "시간",
    "labelWeekday": "요일",
    "labelMonthday": "날짜",
    "cronPreview": "해당 설정은",
    "cronExample": "0 3 * * *",
    "weekdays": [
      "일요일",
      "월요일",
      "화요일",
      "수요일",
      "목요일",
      "금요일",
      "토요일"
    ],
    "btnCancel": "취소",
    "btnSave": "저장",
    "localRetentionHint": "이 일정의 최신 로컬 백업은 보관됩니다.",
    "cloudRetentionHint": "S3/R2 보존 기간은 클라우드 제공업체에서 설정하세요.",
    "editTitle": "일정 편집"
  },
  "toasts": {
    "errorSaveSettings": "백업 설정 저장 오류",
    "preparingDownload": "다운로드 준비 중…",
    "backupDeleted": "백업 삭제됨",
    "backupsDeleted": "백업들 삭제됨",
    "scheduleDeleted": "예약 삭제됨",
    "errorDelete": "삭제 오류",
    "errorCreateBackup": "백업 생성 오류",
    "backupStarted": "백업 시작됨",
    "backupCompleted": "백업 완료됨",
    "backupStillRunning": "백업이 아직 진행 중…",
    "scheduleCreated": "예약 생성됨",
    "errorCreateSchedule": "예약 생성 오류",
    "storageDeleted": "스토리지 삭제됨",
    "storageUpdated": "스토리지 업데이트됨",
    "storageCreated": "스토리지 생성됨",
    "errorSaveStorage": "스토리지 저장 오류",
    "recordRemoved": "기록이 내역에서 제거되었습니다"
  },
  "errors": {
    "listPathFailed": "이 경로를 나열할 수 없습니다 (권한 문제?).",
    "listDbFailed": "데이터베이스 목록을 가져올 수 없습니다.",
    "downloadFailed": "백업을 다운로드할 수 없습니다",
    "backupErrorDetail": "오류: {error}"
  },
  "empty": {
    "noSubfolders": "(하위 폴더 없음)",
    "noDbEngines": "활성 DB 엔진이 감지되지 않았습니다.",
    "noDatabases": "(데이터베이스 없음)",
    "noneSelected": "선택 없음",
    "noSchedules": "예약 없음"
  },
  "labels": {
    "loading": "로딩 중…",
    "fullServer": "전체 서버",
    "editStorage": "스토리지 편집",
    "newStorage": "새 스토리지"
  },
  "confirm": {
    "deleteBackup": "백업 \"{label}\"을(를) 삭제하시겠습니까?",
    "deleteBackupTitle": "백업 삭제",
    "deleteBulkBackup": "선택한 {count}개의 백업을 삭제하시겠습니까?",
    "deleteBulkBackupTitle": "백업 삭제",
    "deleteSchedule": "이 예약을 삭제하시겠습니까?",
    "deleteScheduleTitle": "예약 삭제",
    "deleteStorage": "스토리지 \"{name}\"을(를) 삭제하시겠습니까?",
    "deleteStorageTitle": "스토리지 삭제",
    "removeRecord": "«{label}»을(를) 내역에서 제거할까요? 클라우드 객체는 유지됩니다.",
    "removeRecordTitle": "기록 제거",
    "cloudBulkNote": "S3/R2 객체는 유지됩니다."
  },
  "table": {
    "columns": {
      "label": "레이블",
      "status": "상태",
      "size": "크기",
      "storage": "스토리지",
      "fecha": "날짜"
    },
    "storagesColumns": {
      "name": "이름",
      "provider": "제공자",
      "bucket": "버킷",
      "endpoint": "엔드포인트"
    },
    "filters": {
      "searchBackupLabel": "레이블 검색...",
      "filterBackupStorage": "스토리지",
      "searchStorageName": "이름 검색...",
      "filterStorageProvider": "제공자"
    },
    "rowActions": {
      "download": "다운로드",
      "removeRecord": "기록에서 제거",
      "details": "오류 보기",
      "delete": "삭제",
      "refresh": "상태 새로고침"
    },
    "quickActions": {
      "deleteSelected": "선택 항목 삭제"
    },
    "storagesRowActions": {
      "edit": "편집",
      "delete": "삭제"
    }
  }
} as const;

export default backups;
