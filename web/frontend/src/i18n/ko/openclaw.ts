const openclaw = {
  "pageTitle": "OpenClaw",
  "header": {
    "subtitle": "패널을",
    "subtitleSuffix": "에 연결하여 모델과 도구를 사용하세요."
  },
  "statusCard": {
    "title": "연결 상태",
    "descKeySet": "API key가 설정되었습니다. \"연결 테스트\"를 눌러 확인하세요.",
    "descNoKey": "아직 API key가 설정되지 않았습니다.",
    "btnTest": "연결 테스트"
  },
  "form": {
    "sectionTitle": "자격 증명 및 엔드포인트",
    "sectionDesc": "API key는 패널 데이터베이스에 암호화되어 저장됩니다.",
    "labelEndpoint": "엔드포인트",
    "placeholderEndpoint": "https://openclaw.ai",
    "hintEndpoint": "API 기본 URL. 기본값",
    "labelApiKey": "API 키",
    "placeholderApiKeySet": "설정됨 · {preview}",
    "placeholderApiKeyUnset": "sk-...",
    "ariaToggleKey": "표시 또는 숨기기",
    "btnClearKey": "지우기",
    "hintApiKey": "현재 API key를 유지하려면 비워 두세요.",
    "labelDefaultModel": "기본 모델",
    "placeholderDefaultModel": "claw-default",
    "hintDefaultModel": "특정 모델을 지정하지 않는 내부 호출에서 사용할 모델 식별자.",
    "btnSave": "변경사항 저장"
  },
  "help": {
    "title": "API key는 어떻게 얻나요?",
    "step1": "로그인하세요",
    "step2": "계정 설정을 열고 새 API key를 생성하세요.",
    "step3": "위에 붙여넣고 저장하세요 — 패널에서 다시 평문으로 표시되지 않습니다."
  }
} as const;

export default openclaw;
