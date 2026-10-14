import type { LocaleCode } from "../../locales";
import type { Widen } from "../_shared";

// Spanish is the source of truth; every other locale is checked against
// its widened shape, so missing/extra keys per screen surface as TS errors.
const es = {
  "publicLinkProcessError": "No se pudo procesar el enlace público.",
  "publicLinkAddedTitle": "Enlace público agregado",
  "publicLinkAddedBody": "Se registró {subdomain}. Inicia como invitado desde la pantalla de login.",
  "signInRequiredTitle": "Inicia sesión para continuar",
  "signInRequiredBody": "Este enlace privado requiere autenticación para vincular el panel a tu cuenta.",
  "linkPanelError": "No se pudo vincular el panel compartido a tu cuenta.",
  "panelAddedTitle": "Panel agregado",
  "panelAddedBody": "El panel privado compartido ya está disponible en tu lista.",
  "shareLinkError": "No se pudo generar el enlace para compartir.",
  "privateAccessPrefix": "Ingreso privado a panel",
  "publicAccessPrefix": "Ingreso público (invitado) a panel"
} as const;

export type AccessLinksMessages = Widen<typeof es>;

export const accessLinks: Record<LocaleCode, AccessLinksMessages> = {
  es,
  en: {
    "publicLinkProcessError": "Could not process the public access link.",
    "publicLinkAddedTitle": "Public link added",
    "publicLinkAddedBody": "{subdomain} was saved. Enter as guest from the login screen.",
    "signInRequiredTitle": "Sign in to continue",
    "signInRequiredBody": "This private link requires authentication before linking the panel to your account.",
    "linkPanelError": "Could not link the shared panel to your account.",
    "panelAddedTitle": "Panel added",
    "panelAddedBody": "The private shared panel is now available in your list.",
    "shareLinkError": "Could not generate the share link.",
    "privateAccessPrefix": "Private panel access",
    "publicAccessPrefix": "Public guest panel access"
  },
  fr: {
    "publicLinkProcessError": "Impossible de traiter le lien d'accès public.",
    "publicLinkAddedTitle": "Lien public ajouté",
    "publicLinkAddedBody": "{subdomain} a été enregistré. Connectez-vous en tant qu'invité depuis l'écran de connexion.",
    "signInRequiredTitle": "Connectez-vous pour continuer",
    "signInRequiredBody": "Ce lien privé nécessite une authentification avant de lier le panneau à votre compte.",
    "linkPanelError": "Impossible de lier le panneau partagé à votre compte.",
    "panelAddedTitle": "Panneau ajouté",
    "panelAddedBody": "Le panneau privé partagé est désormais disponible dans votre liste.",
    "shareLinkError": "Impossible de générer le lien de partage.",
    "privateAccessPrefix": "Accès au panneau privé",
    "publicAccessPrefix": "Accès au panneau invité public"
  },
  pt: {
    "publicLinkProcessError": "Não foi possível processar o link de acesso público.",
    "publicLinkAddedTitle": "Link público adicionado",
    "publicLinkAddedBody": "{subdomain} foi salvo. Entre como convidado na tela de login.",
    "signInRequiredTitle": "Faça login para continuar",
    "signInRequiredBody": "Este link privado exige autenticação antes de vincular o painel à sua conta.",
    "linkPanelError": "Não foi possível vincular o painel compartilhado à sua conta.",
    "panelAddedTitle": "Painel adicionado",
    "panelAddedBody": "O painel privado compartilhado já está disponível na sua lista.",
    "shareLinkError": "Não foi possível gerar o link de compartilhamento.",
    "privateAccessPrefix": "Acesso ao painel privado",
    "publicAccessPrefix": "Acesso ao painel de convidado público"
  },
  it: {
    "publicLinkProcessError": "Impossibile elaborare il link di accesso pubblico.",
    "publicLinkAddedTitle": "Link pubblico aggiunto",
    "publicLinkAddedBody": "{subdomain} è stato salvato. Accedi come ospite dalla schermata di login.",
    "signInRequiredTitle": "Accedi per continuare",
    "signInRequiredBody": "Questo link privato richiede l'autenticazione prima di collegare il pannello al tuo account.",
    "linkPanelError": "Impossibile collegare il pannello condiviso al tuo account.",
    "panelAddedTitle": "Pannello aggiunto",
    "panelAddedBody": "Il pannello condiviso privato è ora disponibile nel tuo elenco.",
    "shareLinkError": "Impossibile generare il link di condivisione.",
    "privateAccessPrefix": "Accesso al pannello privato",
    "publicAccessPrefix": "Accesso al pannello ospite pubblico"
  },
  ru: {
    "publicLinkProcessError": "Не удалось обработать публичную ссылку доступа.",
    "publicLinkAddedTitle": "Публичная ссылка добавлена",
    "publicLinkAddedBody": "{subdomain} сохранён. Войдите как гость на экране входа.",
    "signInRequiredTitle": "Войдите, чтобы продолжить",
    "signInRequiredBody": "Эта приватная ссылка требует аутентификации перед привязкой панели к вашей учётной записи.",
    "linkPanelError": "Не удалось привязать общую панель к вашей учётной записи.",
    "panelAddedTitle": "Панель добавлена",
    "panelAddedBody": "Приватная общая панель теперь доступна в вашем списке.",
    "shareLinkError": "Не удалось создать ссылку для общего доступа.",
    "privateAccessPrefix": "Доступ к приватной панели",
    "publicAccessPrefix": "Гостевой доступ к публичной панели"
  },
  zh: {
    "publicLinkProcessError": "无法处理公开访问链接。",
    "publicLinkAddedTitle": "已添加公开链接",
    "publicLinkAddedBody": "{subdomain} 已保存。请在登录界面以访客身份进入。",
    "signInRequiredTitle": "请登录以继续",
    "signInRequiredBody": "此私有链接需要先进行身份验证，才能将面板关联到您的账户。",
    "linkPanelError": "无法将共享面板关联到您的账户。",
    "panelAddedTitle": "已添加面板",
    "panelAddedBody": "私有共享面板现已显示在您的列表中。",
    "shareLinkError": "无法生成共享链接。",
    "privateAccessPrefix": "私有面板访问",
    "publicAccessPrefix": "公开访客面板访问"
  },
  ko: {
    "publicLinkProcessError": "공개 액세스 링크를 처리할 수 없습니다.",
    "publicLinkAddedTitle": "공개 링크가 추가되었습니다",
    "publicLinkAddedBody": "{subdomain}이(가) 저장되었습니다. 로그인 화면에서 게스트로 입장하세요.",
    "signInRequiredTitle": "계속하려면 로그인하세요",
    "signInRequiredBody": "이 비공개 링크는 패널을 계정에 연결하기 전에 인증이 필요합니다.",
    "linkPanelError": "공유된 패널을 계정에 연결할 수 없습니다.",
    "panelAddedTitle": "패널이 추가되었습니다",
    "panelAddedBody": "비공개 공유 패널을 이제 목록에서 사용할 수 있습니다.",
    "shareLinkError": "공유 링크를 생성할 수 없습니다.",
    "privateAccessPrefix": "비공개 패널 액세스",
    "publicAccessPrefix": "공개 게스트 패널 액세스"
  },
  ja: {
    "publicLinkProcessError": "公開アクセスリンクを処理できませんでした。",
    "publicLinkAddedTitle": "公開リンクを追加しました",
    "publicLinkAddedBody": "{subdomain} を保存しました。ログイン画面からゲストとして入室してください。",
    "signInRequiredTitle": "続行するにはサインインしてください",
    "signInRequiredBody": "このプライベートリンクでは、パネルをアカウントにリンクする前に認証が必要です。",
    "linkPanelError": "共有パネルをアカウントにリンクできませんでした。",
    "panelAddedTitle": "パネルを追加しました",
    "panelAddedBody": "プライベート共有パネルがリストで利用可能になりました。",
    "shareLinkError": "共有リンクを生成できませんでした。",
    "privateAccessPrefix": "プライベートパネルアクセス",
    "publicAccessPrefix": "公開ゲストパネルアクセス"
  },
  hi: {
    "publicLinkProcessError": "सार्वजनिक पहुँच लिंक संसाधित नहीं किया जा सका।",
    "publicLinkAddedTitle": "सार्वजनिक लिंक जोड़ा गया",
    "publicLinkAddedBody": "{subdomain} सहेजा गया। लॉगिन स्क्रीन से अतिथि के रूप में प्रवेश करें।",
    "signInRequiredTitle": "जारी रखने के लिए साइन इन करें",
    "signInRequiredBody": "इस निजी लिंक के लिए पैनल को आपके खाते से जोड़ने से पहले प्रमाणीकरण आवश्यक है।",
    "linkPanelError": "साझा किए गए पैनल को आपके खाते से नहीं जोड़ा जा सका।",
    "panelAddedTitle": "पैनल जोड़ा गया",
    "panelAddedBody": "निजी साझा पैनल अब आपकी सूची में उपलब्ध है।",
    "shareLinkError": "साझाकरण लिंक उत्पन्न नहीं किया जा सका।",
    "privateAccessPrefix": "निजी पैनल पहुँच",
    "publicAccessPrefix": "सार्वजनिक अतिथि पैनल पहुँच"
  },
  ar: {
    "publicLinkProcessError": "تعذّر معالجة رابط الوصول العام.",
    "publicLinkAddedTitle": "تمت إضافة الرابط العام",
    "publicLinkAddedBody": "تم حفظ {subdomain}. ادخل كضيف من شاشة تسجيل الدخول.",
    "signInRequiredTitle": "سجّل الدخول للمتابعة",
    "signInRequiredBody": "يتطلب هذا الرابط الخاص المصادقة قبل ربط اللوحة بحسابك.",
    "linkPanelError": "تعذّر ربط اللوحة المشتركة بحسابك.",
    "panelAddedTitle": "تمت إضافة اللوحة",
    "panelAddedBody": "أصبحت اللوحة الخاصة المشتركة متاحة الآن في قائمتك.",
    "shareLinkError": "تعذّر إنشاء رابط المشاركة.",
    "privateAccessPrefix": "وصول إلى لوحة خاصة",
    "publicAccessPrefix": "وصول إلى لوحة عامة كضيف"
  },
};
