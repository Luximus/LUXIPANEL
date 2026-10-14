import type { LocaleCode } from "../../locales";
import type { Widen } from "../_shared";

// Spanish is the source of truth; every other locale is checked against
// its widened shape, so missing/extra keys per screen surface as TS errors.
const es = {
  "panelTabGeneral": "General",
  "tagsSelectCategoryHint": "Selecciona primero una categoría para crear y filtrar tags.",
  "sshKeysListTab": "Lista",
  "sshKeysRegisterTab": "Registrar SSH",
  "sshKeysEditTitle": "Editar llave SSH",
  "apiTokenPlaceholder": "Token visible solo una vez al rotar",
  "apiRotateConfirm": "¿Deseas rotar el token API? El token actual dejará de funcionar."
} as const;

export type SettingsModalsMessages = Widen<typeof es>;

export const settingsModals: Record<LocaleCode, SettingsModalsMessages> = {
  es,
  en: {
    "panelTabGeneral": "General",
    "tagsSelectCategoryHint": "Select a category first to create and filter tags.",
    "sshKeysListTab": "List",
    "sshKeysRegisterTab": "Register SSH",
    "sshKeysEditTitle": "Edit SSH key",
    "apiTokenPlaceholder": "Token shown only once when rotating",
    "apiRotateConfirm": "Do you want to rotate the API token? The current token will stop working."
  },
  fr: {
    "panelTabGeneral": "Général",
    "tagsSelectCategoryHint": "Sélectionnez d'abord une catégorie pour créer et filtrer les tags.",
    "sshKeysListTab": "Liste",
    "sshKeysRegisterTab": "Enregistrer SSH",
    "sshKeysEditTitle": "Modifier la clé SSH",
    "apiTokenPlaceholder": "Token affiché une seule fois lors de la rotation",
    "apiRotateConfirm": "Voulez-vous faire la rotation du token API ? Le token actuel cessera de fonctionner."
  },
  pt: {
    "panelTabGeneral": "Geral",
    "tagsSelectCategoryHint": "Selecione primeiro uma categoria para criar e filtrar tags.",
    "sshKeysListTab": "Lista",
    "sshKeysRegisterTab": "Registrar SSH",
    "sshKeysEditTitle": "Editar chave SSH",
    "apiTokenPlaceholder": "Token visível apenas uma vez ao rotacionar",
    "apiRotateConfirm": "Deseja rotacionar o token da API? O token atual deixará de funcionar."
  },
  it: {
    "panelTabGeneral": "Generale",
    "tagsSelectCategoryHint": "Seleziona prima una categoria per creare e filtrare i tag.",
    "sshKeysListTab": "Elenco",
    "sshKeysRegisterTab": "Registra SSH",
    "sshKeysEditTitle": "Modifica chiave SSH",
    "apiTokenPlaceholder": "Token mostrato una sola volta alla rotazione",
    "apiRotateConfirm": "Vuoi ruotare il token API? Il token attuale smetterà di funzionare."
  },
  ru: {
    "panelTabGeneral": "Общие",
    "tagsSelectCategoryHint": "Сначала выберите категорию, чтобы создавать и фильтровать теги.",
    "sshKeysListTab": "Список",
    "sshKeysRegisterTab": "Добавить SSH",
    "sshKeysEditTitle": "Изменить SSH-ключ",
    "apiTokenPlaceholder": "Токен показывается только один раз при ротации",
    "apiRotateConfirm": "Сменить API-токен? Текущий токен перестанет работать."
  },
  zh: {
    "panelTabGeneral": "常规",
    "tagsSelectCategoryHint": "请先选择一个分类以创建和筛选标签。",
    "sshKeysListTab": "列表",
    "sshKeysRegisterTab": "注册 SSH",
    "sshKeysEditTitle": "编辑 SSH 密钥",
    "apiTokenPlaceholder": "令牌仅在轮换时显示一次",
    "apiRotateConfirm": "要轮换 API 令牌吗？当前令牌将停止工作。"
  },
  ko: {
    "panelTabGeneral": "일반",
    "tagsSelectCategoryHint": "태그를 만들고 필터링하려면 먼저 카테고리를 선택하세요.",
    "sshKeysListTab": "목록",
    "sshKeysRegisterTab": "SSH 등록",
    "sshKeysEditTitle": "SSH 키 편집",
    "apiTokenPlaceholder": "토큰은 교체 시 한 번만 표시됩니다",
    "apiRotateConfirm": "API 토큰을 교체하시겠습니까? 현재 토큰은 작동을 멈춥니다."
  },
  ja: {
    "panelTabGeneral": "一般",
    "tagsSelectCategoryHint": "タグを作成・絞り込むには、まずカテゴリを選択してください。",
    "sshKeysListTab": "一覧",
    "sshKeysRegisterTab": "SSH を登録",
    "sshKeysEditTitle": "SSH キーを編集",
    "apiTokenPlaceholder": "トークンはローテーション時に一度だけ表示されます",
    "apiRotateConfirm": "API トークンをローテーションしますか？現在のトークンは使えなくなります。"
  },
  hi: {
    "panelTabGeneral": "सामान्य",
    "tagsSelectCategoryHint": "टैग बनाने और फ़िल्टर करने के लिए पहले एक श्रेणी चुनें।",
    "sshKeysListTab": "सूची",
    "sshKeysRegisterTab": "SSH पंजीकृत करें",
    "sshKeysEditTitle": "SSH कुंजी संपादित करें",
    "apiTokenPlaceholder": "टोकन रोटेट करते समय केवल एक बार दिखता है",
    "apiRotateConfirm": "क्या आप API टोकन रोटेट करना चाहते हैं? वर्तमान टोकन काम करना बंद कर देगा।"
  },
  ar: {
    "panelTabGeneral": "عام",
    "tagsSelectCategoryHint": "اختر فئة أولاً لإنشاء الوسوم وتصفيتها.",
    "sshKeysListTab": "القائمة",
    "sshKeysRegisterTab": "تسجيل SSH",
    "sshKeysEditTitle": "تعديل مفتاح SSH",
    "apiTokenPlaceholder": "يظهر الرمز مرة واحدة فقط عند التدوير",
    "apiRotateConfirm": "هل تريد تدوير رمز API؟ سيتوقف الرمز الحالي عن العمل."
  },
};
