import type { LocaleCode } from "../../locales";
import type { Widen } from "../_shared";

// Spanish is the source of truth; every other locale is checked against
// its widened shape, so missing/extra keys per screen surface as TS errors.
const es = {
  "statusActive": "Activo",
  "statusNoResponse": "Sin respuesta",
  "statusChecking": "Verificando…",
  "providerLabel": "Proveedor",
  "directSsh": "SSH directo",
  "columns": {
    "ip": "IP",
    "domain": "Subdominio / Dominio",
    "category": "Categoría",
    "tags": "Tags",
    "license": "Estado",
    "ssh": "Estado SSH"
  },
  "filters": {
    "search": "Buscar panel...",
    "allCategories": "Todas las categorías",
    "allTags": "Todos los tags",
    "licenseState": "Estado",
    "sshState": "Estado SSH",
    "allProviders": "Todos los proveedores"
  },
  "badges": {
    "active": "ACTIVO",
    "inactive": "INACTIVO",
    "noData": "SIN DATOS",
    "grace": "EN GRACIA"
  },
  "graceWarning": "Vence en {days} días — renueva el plan para evitar que se cancele.",
  "actions": {
    "connect": "Entrar a panel de control",
    "toggleIp": "Mostrar/Ocultar IP",
    "edit": "Editar",
    "assignKey": "Asignar Licencia",
    "delete": "Eliminar",
    "favoriteAdd": "Marcar como favorito",
    "favoriteRemove": "Quitar de favoritos",
    "favorite": "Favorito"
  },
  "fallbacks": {
    "panelName": "Panel",
    "noCategory": "Sin categoría",
    "thisPanel": "este panel"
  },
  "metrics": {
    "cpu": "CPU",
    "ram": "RAM",
    "disk": "Disco",
    "traffic": "Datos",
    "dataConsumed": "consumidos este mes",
    "cores": "{count} núcleos",
    "unavailable": "No disponible",
    "loading": "Cargando…",
    "prevAria": "Servidor anterior",
    "nextAria": "Servidor siguiente",
    "position": "{current} de {total}"
  },
} as const;

export type PanelTableMessages = Widen<typeof es>;

export const panelTable: Record<LocaleCode, PanelTableMessages> = {
  es,
  en: {
    "statusActive": "Active",
    "statusNoResponse": "No response",
    "statusChecking": "Checking…",
    "providerLabel": "Provider",
    "directSsh": "Direct SSH",
    "columns": {
      "ip": "IP",
      "domain": "Subdomain / Domain",
      "category": "Category",
      "tags": "Tags",
      "license": "Status",
      "ssh": "SSH status"
    },
    "filters": {
      "search": "Search panels...",
      "allCategories": "All categories",
      "allTags": "All tags",
      "licenseState": "Status",
      "sshState": "SSH status",
      "allProviders": "All providers"
    },
    "badges": {
      "active": "ACTIVE",
      "inactive": "INACTIVE",
      "noData": "NO DATA",
      "grace": "GRACE"
    },
    "graceWarning": "Expires in {days} days — renew your plan to avoid cancellation.",
    "actions": {
      "connect": "Enter control panel",
      "toggleIp": "Show/Hide IP",
      "edit": "Edit",
      "assignKey": "Assign license",
      "delete": "Delete",
      "favoriteAdd": "Mark as favorite",
      "favoriteRemove": "Remove from favorites",
      "favorite": "Favorite"
    },
    "fallbacks": {
      "panelName": "Panel",
      "noCategory": "No category",
      "thisPanel": "this panel"
    },
    "metrics": {
      "cpu": "CPU",
      "ram": "RAM",
      "disk": "Disk",
      "traffic": "Data",
      "dataConsumed": "used this month",
      "cores": "{count} cores",
      "unavailable": "Unavailable",
      "loading": "Loading…",
      "prevAria": "Previous server",
      "nextAria": "Next server",
      "position": "{current} of {total}"
    },
  },
  fr: {
    "statusActive": "Active",
    "statusNoResponse": "Sans réponse",
    "statusChecking": "Vérification…",
    "providerLabel": "Fournisseur",
    "directSsh": "SSH direct",
    "columns": {
      "ip": "IP",
      "domain": "Sous-domaine / Domaine",
      "category": "Catégorie",
      "tags": "Tags",
      "license": "État",
      "ssh": "État SSH"
    },
    "filters": {
      "search": "Rechercher un panneau…",
      "allCategories": "Toutes les catégories",
      "allTags": "Tous les tags",
      "licenseState": "État",
      "sshState": "État SSH",
      "allProviders": "Tous les fournisseurs"
    },
    "badges": {
      "active": "ACTIF",
      "inactive": "INACTIF",
      "noData": "SANS DONNÉES",
      "grace": "EN SURSIS"
    },
    "graceWarning": "Expire dans {days} jours — renouvelez votre plan pour éviter l'annulation.",
    "actions": {
      "connect": "Entrer au panneau de contrôle",
      "toggleIp": "Afficher/Masquer l'IP",
      "edit": "Modifier",
      "assignKey": "Attribuer une licence",
      "delete": "Supprimer",
      "favoriteAdd": "Marquer comme favori",
      "favoriteRemove": "Retirer des favoris",
      "favorite": "Favori"
    },
    "fallbacks": {
      "panelName": "Panneau",
      "noCategory": "Sans catégorie",
      "thisPanel": "ce panneau"
    },
    "metrics": {
      "cpu": "CPU",
      "ram": "RAM",
      "disk": "Disque",
      "traffic": "Données",
      "dataConsumed": "utilisées ce mois",
      "cores": "{count} cœurs",
      "unavailable": "Indisponible",
      "loading": "Chargement…",
      "prevAria": "Serveur précédent",
      "nextAria": "Serveur suivant",
      "position": "{current} sur {total}"
    },
  },
  pt: {
    "statusActive": "Ativo",
    "statusNoResponse": "Sem resposta",
    "statusChecking": "Verificando…",
    "providerLabel": "Provedor",
    "directSsh": "SSH direto",
    "columns": {
      "ip": "IP",
      "domain": "Subdomínio / Domínio",
      "category": "Categoria",
      "tags": "Tags",
      "license": "Estado",
      "ssh": "Status SSH"
    },
    "filters": {
      "search": "Buscar painel...",
      "allCategories": "Todas as categorias",
      "allTags": "Todas as tags",
      "licenseState": "Estado",
      "sshState": "Status SSH",
      "allProviders": "Todos os provedores"
    },
    "badges": {
      "active": "ATIVO",
      "inactive": "INATIVO",
      "noData": "SEM DADOS",
      "grace": "EM CARÊNCIA"
    },
    "graceWarning": "Expira em {days} dias — renove seu plano para evitar o cancelamento.",
    "actions": {
      "connect": "Entrar ao painel de controle",
      "toggleIp": "Mostrar/Ocultar IP",
      "edit": "Editar",
      "assignKey": "Atribuir licença",
      "delete": "Excluir",
      "favoriteAdd": "Marcar como favorito",
      "favoriteRemove": "Remover dos favoritos",
      "favorite": "Favorito"
    },
    "fallbacks": {
      "panelName": "Painel",
      "noCategory": "Sem categoria",
      "thisPanel": "este painel"
    },
    "metrics": {
      "cpu": "CPU",
      "ram": "RAM",
      "disk": "Disco",
      "traffic": "Dados",
      "dataConsumed": "consumidos este mês",
      "cores": "{count} núcleos",
      "unavailable": "Indisponível",
      "loading": "Carregando…",
      "prevAria": "Servidor anterior",
      "nextAria": "Próximo servidor",
      "position": "{current} de {total}"
    },
  },
  it: {
    "statusActive": "Attivo",
    "statusNoResponse": "Nessuna risposta",
    "statusChecking": "Verifica in corso…",
    "providerLabel": "Provider",
    "directSsh": "SSH diretto",
    "columns": {
      "ip": "IP",
      "domain": "Sottodominio / Dominio",
      "category": "Categoria",
      "tags": "Tag",
      "license": "Stato",
      "ssh": "Stato SSH"
    },
    "filters": {
      "search": "Cerca pannello...",
      "allCategories": "Tutte le categorie",
      "allTags": "Tutti i tag",
      "licenseState": "Stato",
      "sshState": "Stato SSH",
      "allProviders": "Tutti i provider"
    },
    "badges": {
      "active": "ATTIVO",
      "inactive": "INATTIVO",
      "noData": "SENZA DATI",
      "grace": "IN GRAZIA"
    },
    "graceWarning": "Scade tra {days} giorni — rinnova il piano per evitare la cancellazione.",
    "actions": {
      "connect": "Entra nel pannello di controllo",
      "toggleIp": "Mostra/Nascondi IP",
      "edit": "Modifica",
      "assignKey": "Assegna licenza",
      "delete": "Elimina",
      "favoriteAdd": "Aggiungi ai preferiti",
      "favoriteRemove": "Rimuovi dai preferiti",
      "favorite": "Preferito"
    },
    "fallbacks": {
      "panelName": "Pannello",
      "noCategory": "Nessuna categoria",
      "thisPanel": "questo pannello"
    },
    "metrics": {
      "cpu": "CPU",
      "ram": "RAM",
      "disk": "Disco",
      "traffic": "Dati",
      "dataConsumed": "consumati questo mese",
      "cores": "{count} core",
      "unavailable": "Non disponibile",
      "loading": "Caricamento…",
      "prevAria": "Server precedente",
      "nextAria": "Server successivo",
      "position": "{current} di {total}"
    },
  },
  ru: {
    "statusActive": "Активен",
    "statusNoResponse": "Нет ответа",
    "statusChecking": "Проверка…",
    "providerLabel": "Провайдер",
    "directSsh": "Прямой SSH",
    "columns": {
      "ip": "IP",
      "domain": "Поддомен / Домен",
      "category": "Категория",
      "tags": "Теги",
      "license": "Статус",
      "ssh": "Статус SSH"
    },
    "filters": {
      "search": "Поиск панели...",
      "allCategories": "Все категории",
      "allTags": "Все теги",
      "licenseState": "Статус",
      "sshState": "Статус SSH",
      "allProviders": "Все провайдеры"
    },
    "badges": {
      "active": "АКТИВЕН",
      "inactive": "НЕАКТИВЕН",
      "noData": "НЕТ ДАННЫХ",
      "grace": "ОТСРОЧКА"
    },
    "graceWarning": "Истекает через {days} дней — продлите план, чтобы избежать отмены.",
    "actions": {
      "connect": "Войти в панель управления",
      "toggleIp": "Показать/Скрыть IP",
      "edit": "Редактировать",
      "assignKey": "Назначить лицензию",
      "delete": "Удалить",
      "favoriteAdd": "Добавить в избранное",
      "favoriteRemove": "Убрать из избранного",
      "favorite": "Избранное"
    },
    "fallbacks": {
      "panelName": "Панель",
      "noCategory": "Без категории",
      "thisPanel": "эта панель"
    },
    "metrics": {
      "cpu": "CPU",
      "ram": "RAM",
      "disk": "Диск",
      "traffic": "Данные",
      "dataConsumed": "использовано в этом месяце",
      "cores": "{count} ядер",
      "unavailable": "Недоступно",
      "loading": "Загрузка…",
      "prevAria": "Предыдущий сервер",
      "nextAria": "Следующий сервер",
      "position": "{current} из {total}"
    },
  },
  zh: {
    "statusActive": "活跃",
    "statusNoResponse": "无响应",
    "statusChecking": "正在检查…",
    "providerLabel": "提供商",
    "directSsh": "直连 SSH",
    "columns": {
      "ip": "IP",
      "domain": "子域 / 域名",
      "category": "类别",
      "tags": "标签",
      "license": "状态",
      "ssh": "SSH 状态"
    },
    "filters": {
      "search": "搜索面板...",
      "allCategories": "所有类别",
      "allTags": "所有标签",
      "licenseState": "状态",
      "sshState": "SSH 状态",
      "allProviders": "所有提供商"
    },
    "badges": {
      "active": "有效",
      "inactive": "无效",
      "noData": "无数据",
      "grace": "宽限期"
    },
    "graceWarning": "将在 {days} 天后过期 — 请续订以避免取消。",
    "actions": {
      "connect": "进入控制面板",
      "toggleIp": "显示/隐藏 IP",
      "edit": "编辑",
      "assignKey": "分配许可证",
      "delete": "删除",
      "favoriteAdd": "添加到收藏",
      "favoriteRemove": "从收藏中移除",
      "favorite": "收藏"
    },
    "fallbacks": {
      "panelName": "面板",
      "noCategory": "无类别",
      "thisPanel": "此面板"
    },
    "metrics": {
      "cpu": "CPU",
      "ram": "RAM",
      "disk": "磁盘",
      "traffic": "数据",
      "dataConsumed": "本月已用",
      "cores": "{count} 核",
      "unavailable": "不可用",
      "loading": "加载中…",
      "prevAria": "上一个服务器",
      "nextAria": "下一个服务器",
      "position": "{current} / {total}"
    },
  },
  ko: {
    "statusActive": "활성",
    "statusNoResponse": "응답 없음",
    "statusChecking": "확인 중…",
    "providerLabel": "공급자",
    "directSsh": "직접 SSH",
    "columns": {
      "ip": "IP",
      "domain": "서브도메인 / 도메인",
      "category": "카테고리",
      "tags": "태그",
      "license": "상태",
      "ssh": "SSH 상태"
    },
    "filters": {
      "search": "패널 검색...",
      "allCategories": "모든 카테고리",
      "allTags": "모든 태그",
      "licenseState": "상태",
      "sshState": "SSH 상태",
      "allProviders": "모든 공급자"
    },
    "badges": {
      "active": "활성",
      "inactive": "비활성",
      "noData": "데이터 없음",
      "grace": "유예 기간"
    },
    "graceWarning": "{days}일 후 만료 — 취소를 방지하려면 플랜을 갱신하세요.",
    "actions": {
      "connect": "제어판 들어가기",
      "toggleIp": "IP 표시/숨기기",
      "edit": "편집",
      "assignKey": "라이선스 할당",
      "delete": "삭제",
      "favoriteAdd": "즐겨찾기에 추가",
      "favoriteRemove": "즐겨찾기에서 제거",
      "favorite": "즐겨찾기"
    },
    "fallbacks": {
      "panelName": "패널",
      "noCategory": "카테고리 없음",
      "thisPanel": "이 패널"
    },
    "metrics": {
      "cpu": "CPU",
      "ram": "RAM",
      "disk": "디스크",
      "traffic": "데이터",
      "dataConsumed": "이번 달 사용됨",
      "cores": "{count} 코어",
      "unavailable": "사용 불가",
      "loading": "불러오는 중…",
      "prevAria": "이전 서버",
      "nextAria": "다음 서버",
      "position": "{current} / {total}"
    },
  },
  ja: {
    "statusActive": "アクティブ",
    "statusNoResponse": "応答なし",
    "statusChecking": "確認中…",
    "providerLabel": "プロバイダー",
    "directSsh": "直接 SSH",
    "columns": {
      "ip": "IP",
      "domain": "サブドメイン / ドメイン",
      "category": "カテゴリ",
      "tags": "タグ",
      "license": "状態",
      "ssh": "SSH 状態"
    },
    "filters": {
      "search": "パネルを検索...",
      "allCategories": "すべてのカテゴリ",
      "allTags": "すべてのタグ",
      "licenseState": "状態",
      "sshState": "SSH 状態",
      "allProviders": "すべてのプロバイダー"
    },
    "badges": {
      "active": "アクティブ",
      "inactive": "非アクティブ",
      "noData": "データなし",
      "grace": "猶予期間"
    },
    "graceWarning": "{days}日で期限切れ — プランを更新してキャンセルを回避してください。",
    "actions": {
      "connect": "コントロールパネルに入る",
      "toggleIp": "IP を表示/非表示",
      "edit": "編集",
      "assignKey": "ライセンスを割り当て",
      "delete": "削除",
      "favoriteAdd": "お気に入りに追加",
      "favoriteRemove": "お気に入りから削除",
      "favorite": "お気に入り"
    },
    "fallbacks": {
      "panelName": "パネル",
      "noCategory": "カテゴリなし",
      "thisPanel": "このパネル"
    },
    "metrics": {
      "cpu": "CPU",
      "ram": "RAM",
      "disk": "ディスク",
      "traffic": "データ",
      "dataConsumed": "今月の使用量",
      "cores": "{count} コア",
      "unavailable": "利用不可",
      "loading": "読み込み中…",
      "prevAria": "前のサーバー",
      "nextAria": "次のサーバー",
      "position": "{current} / {total}"
    },
  },
  hi: {
    "statusActive": "सक्रिय",
    "statusNoResponse": "कोई जवाब नहीं",
    "statusChecking": "जाँच हो रही है…",
    "providerLabel": "प्रोवाइडर",
    "directSsh": "डायरेक्ट SSH",
    "columns": {
      "ip": "IP",
      "domain": "सबडोमेन / डोमेन",
      "category": "कैटेगरी",
      "tags": "टैग",
      "license": "स्थिति",
      "ssh": "SSH स्टेटस"
    },
    "filters": {
      "search": "पैनल खोजें...",
      "allCategories": "सभी कैटेगरीज़",
      "allTags": "सभी टैग",
      "licenseState": "स्थिति",
      "sshState": "SSH स्टेटस",
      "allProviders": "सभी प्रदाता"
    },
    "badges": {
      "active": "सक्रिय",
      "inactive": "निष्क्रिय",
      "noData": "कोई डेटा नहीं",
      "grace": "अनुग्रह अवधि"
    },
    "graceWarning": "{days} दिनों में समाप्त — रद्दीकरण से बचने के लिए नवीनीकरण करें।",
    "actions": {
      "connect": "कंट्रोल पैनल में जाएं",
      "toggleIp": "IP दिखाएं/छिपाएं",
      "edit": "एडिट करें",
      "assignKey": "लाइसेंस असाइन करें",
      "delete": "हटाएं",
      "favoriteAdd": "पसंदीदा में जोड़ें",
      "favoriteRemove": "पसंदीदा से हटाएं",
      "favorite": "पसंदीदा"
    },
    "fallbacks": {
      "panelName": "पैनल",
      "noCategory": "कोई कैटेगरी नहीं",
      "thisPanel": "यह पैनल"
    },
    "metrics": {
      "cpu": "CPU",
      "ram": "RAM",
      "disk": "डिस्क",
      "traffic": "डेटा",
      "dataConsumed": "इस माह उपयोग",
      "cores": "{count} कोर",
      "unavailable": "उपलब्ध नहीं",
      "loading": "लोड हो रहा है…",
      "prevAria": "पिछला सर्वर",
      "nextAria": "अगला सर्वर",
      "position": "{current} / {total}"
    },
  },
  ar: {
    "statusActive": "نشط",
    "statusNoResponse": "لا يوجد رد",
    "statusChecking": "جارٍ التحقق…",
    "providerLabel": "المزوّد",
    "directSsh": "SSH مباشر",
    "columns": {
      "ip": "IP",
      "domain": "النطاق الفرعي / النطاق",
      "category": "الفئة",
      "tags": "الوسوم",
      "license": "الحالة",
      "ssh": "حالة SSH"
    },
    "filters": {
      "search": "البحث عن لوحة...",
      "allCategories": "جميع الفئات",
      "allTags": "جميع الوسوم",
      "licenseState": "الحالة",
      "sshState": "حالة SSH",
      "allProviders": "كل المزوّدين"
    },
    "badges": {
      "active": "نشط",
      "inactive": "غير نشط",
      "noData": "لا توجد بيانات",
      "grace": "فترة سماح"
    },
    "graceWarning": "ينتهي خلال {days} أيام — جدد خطتك لتجنب الإلغاء.",
    "actions": {
      "connect": "الدخول إلى لوحة التحكم",
      "toggleIp": "إظهار/إخفاء IP",
      "edit": "تعديل",
      "assignKey": "تعيين الترخيص",
      "delete": "حذف",
      "favoriteAdd": "إضافة إلى المفضلة",
      "favoriteRemove": "إزالة من المفضلة",
      "favorite": "المفضلة"
    },
    "fallbacks": {
      "panelName": "لوحة",
      "noCategory": "بدون فئة",
      "thisPanel": "هذه اللوحة"
    },
    "metrics": {
      "cpu": "CPU",
      "ram": "RAM",
      "disk": "القرص",
      "traffic": "البيانات",
      "dataConsumed": "المستهلكة هذا الشهر",
      "cores": "{count} نواة",
      "unavailable": "غير متاح",
      "loading": "جارٍ التحميل…",
      "prevAria": "الخادم السابق",
      "nextAria": "الخادم التالي",
      "position": "{current} من {total}"
    },
  },
};
