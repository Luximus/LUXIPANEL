import type { LocaleCode } from "../../locales";
import type { Widen } from "../_shared";

// Spanish is the source of truth; every other locale is checked against
// its widened shape, so missing/extra keys per screen surface as TS errors.
const es = {
  "statusActive": "Activo",
  "statusNoResponse": "Sin respuesta",
  "statusChecking": "Verificando…",
  "interactionHint": "Toca para conectar · mantén presionado para editar",
  "providerLabel": "Proveedor",
  "directSsh": "SSH directo",
  "filtersTitle": "Filtros",
  "viewCarousel": "Carrusel",
  "viewList": "Lista",
  "connectLocalKey": "Conectar con llave local",
  "sharePrivate": "Compartir ingreso privado",
  "sharePublic": "Compartir ingreso público",
  "columns": {
    "ip": "IP",
    "domain": "Subdominio / Dominio",
    "category": "Categoría",
    "tags": "Tags",
    "license": "Estado",
    "ssh": "Estado SSH"
  },
  "filters": {
    "search": "Buscar servidor...",
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
  "graceWarning": "Vence en {days} días — recarga datos para evitar que se cancele.",
  "actions": {
    "connect": "Conectar",
    "enterPanel": "Entrar a panel",
    "useMoreTools": "Utilizar más herramientas",
    "toggleIp": "Mostrar/Ocultar IP",
    "edit": "Editar",
    "assignKey": "Vincular compra",
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
    "dataConsumed": "consumidos",
    "cores": "{count} núcleos",
    "unavailable": "No disponible",
    "loading": "Cargando…",
    "prevAria": "Servidor anterior",
    "nextAria": "Servidor siguiente",
    "position": "{current} de {total}"
  }
} as const;

export type PanelTableMessages = Widen<typeof es>;

export const panelTable: Record<LocaleCode, PanelTableMessages> = {
  es,
  en: {
    "statusActive": "Active",
    "statusNoResponse": "No response",
    "statusChecking": "Checking…",
    "interactionHint": "Tap to connect · long press to edit",
    "providerLabel": "Provider",
    "directSsh": "Direct SSH",
    "filtersTitle": "Filters",
    "viewCarousel": "Carousel",
    "viewList": "List",
    "connectLocalKey": "Connect with local key",
    "sharePrivate": "Share private access",
    "sharePublic": "Share public access",
    "columns": {
      "ip": "IP",
      "domain": "Subdomain / Domain",
      "category": "Category",
      "tags": "Tags",
      "license": "Status",
      "ssh": "SSH status"
    },
    "filters": {
      "search": "Search servers...",
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
    "graceWarning": "Expires in {days} days — recharge data to avoid cancellation.",
    "actions": {
      "connect": "Connect",
      "enterPanel": "Enter panel",
      "useMoreTools": "Use more tools",
      "toggleIp": "Show/Hide IP",
      "edit": "Edit",
      "assignKey": "Link purchase",
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
      "dataConsumed": "used",
      "cores": "{count} cores",
      "unavailable": "Unavailable",
      "loading": "Loading…",
      "prevAria": "Previous server",
      "nextAria": "Next server",
      "position": "{current} of {total}"
    }
  },
  fr: {
    "statusActive": "Active",
    "statusNoResponse": "Sans réponse",
    "statusChecking": "Vérification…",
    "interactionHint": "Appuyez pour vous connecter · appui long pour modifier",
    "providerLabel": "Fournisseur",
    "directSsh": "SSH direct",
    "filtersTitle": "Filtres",
    "viewCarousel": "Carrousel",
    "viewList": "Liste",
    "connectLocalKey": "Se connecter avec une clé locale",
    "sharePrivate": "Partager l'accès privé",
    "sharePublic": "Partager l'accès public",
    "columns": {
      "ip": "IP",
      "domain": "Sous-domaine / Domaine",
      "category": "Catégorie",
      "tags": "Tags",
      "license": "État",
      "ssh": "État SSH"
    },
    "filters": {
      "search": "Rechercher un serveur…",
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
    "graceWarning": "Expire dans {days} jours — rechargez des données pour éviter l'annulation.",
    "actions": {
      "connect": "Connecter",
      "enterPanel": "Entrer dans le panneau",
      "useMoreTools": "Utiliser plus d'outils",
      "toggleIp": "Afficher/Masquer l'IP",
      "edit": "Modifier",
      "assignKey": "Associer l'achat",
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
      "dataConsumed": "utilisées",
      "cores": "{count} cœurs",
      "unavailable": "Indisponible",
      "loading": "Chargement…",
      "prevAria": "Serveur précédent",
      "nextAria": "Serveur suivant",
      "position": "{current} sur {total}"
    }
  },
  pt: {
    "statusActive": "Ativo",
    "statusNoResponse": "Sem resposta",
    "statusChecking": "Verificando…",
    "interactionHint": "Toque para conectar · pressione e segure para editar",
    "providerLabel": "Provedor",
    "directSsh": "SSH direto",
    "filtersTitle": "Filtros",
    "viewCarousel": "Carrossel",
    "viewList": "Lista",
    "connectLocalKey": "Conectar com chave local",
    "sharePrivate": "Compartilhar acesso privado",
    "sharePublic": "Compartilhar acesso público",
    "columns": {
      "ip": "IP",
      "domain": "Subdomínio / Domínio",
      "category": "Categoria",
      "tags": "Tags",
      "license": "Estado",
      "ssh": "Status SSH"
    },
    "filters": {
      "search": "Buscar servidor...",
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
      "connect": "Conectar",
      "enterPanel": "Entrar no painel",
      "useMoreTools": "Usar mais ferramentas",
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
      "dataConsumed": "consumidos",
      "cores": "{count} núcleos",
      "unavailable": "Indisponível",
      "loading": "Carregando…",
      "prevAria": "Servidor anterior",
      "nextAria": "Próximo servidor",
      "position": "{current} de {total}"
    }
  },
  it: {
    "statusActive": "Attivo",
    "statusNoResponse": "Nessuna risposta",
    "statusChecking": "Verifica in corso…",
    "interactionHint": "Tocca per connettere · tieni premuto per modificare",
    "providerLabel": "Provider",
    "directSsh": "SSH diretto",
    "filtersTitle": "Filtri",
    "viewCarousel": "Carosello",
    "viewList": "Elenco",
    "connectLocalKey": "Connetti con chiave locale",
    "sharePrivate": "Condividi accesso privato",
    "sharePublic": "Condividi accesso pubblico",
    "columns": {
      "ip": "IP",
      "domain": "Sottodominio / Dominio",
      "category": "Categoria",
      "tags": "Tag",
      "license": "Stato",
      "ssh": "Stato SSH"
    },
    "filters": {
      "search": "Cerca server...",
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
      "connect": "Connetti",
      "enterPanel": "Entra nel pannello",
      "useMoreTools": "Usa più strumenti",
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
      "dataConsumed": "consumati",
      "cores": "{count} core",
      "unavailable": "Non disponibile",
      "loading": "Caricamento…",
      "prevAria": "Server precedente",
      "nextAria": "Server successivo",
      "position": "{current} di {total}"
    }
  },
  ru: {
    "statusActive": "Активен",
    "statusNoResponse": "Нет ответа",
    "statusChecking": "Проверка…",
    "interactionHint": "Нажмите для подключения · удерживайте для редактирования",
    "providerLabel": "Провайдер",
    "directSsh": "Прямой SSH",
    "filtersTitle": "Фильтры",
    "viewCarousel": "Карусель",
    "viewList": "Список",
    "connectLocalKey": "Подключиться с локальным ключом",
    "sharePrivate": "Поделиться приватным доступом",
    "sharePublic": "Поделиться публичным доступом",
    "columns": {
      "ip": "IP",
      "domain": "Поддомен / Домен",
      "category": "Категория",
      "tags": "Теги",
      "license": "Статус",
      "ssh": "Статус SSH"
    },
    "filters": {
      "search": "Поиск сервера...",
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
      "connect": "Подключиться",
      "enterPanel": "Войти в панель",
      "useMoreTools": "Больше инструментов",
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
      "dataConsumed": "использовано",
      "cores": "{count} ядер",
      "unavailable": "Недоступно",
      "loading": "Загрузка…",
      "prevAria": "Предыдущий сервер",
      "nextAria": "Следующий сервер",
      "position": "{current} из {total}"
    }
  },
  zh: {
    "statusActive": "活跃",
    "statusNoResponse": "无响应",
    "statusChecking": "正在检查…",
    "interactionHint": "点按连接 · 长按编辑",
    "providerLabel": "提供商",
    "directSsh": "直连 SSH",
    "filtersTitle": "筛选",
    "viewCarousel": "轮播",
    "viewList": "列表",
    "connectLocalKey": "使用本地密钥连接",
    "sharePrivate": "共享私有访问",
    "sharePublic": "共享公共访问",
    "columns": {
      "ip": "IP",
      "domain": "子域 / 域名",
      "category": "类别",
      "tags": "标签",
      "license": "状态",
      "ssh": "SSH 状态"
    },
    "filters": {
      "search": "搜索服务器...",
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
      "connect": "连接",
      "enterPanel": "进入面板",
      "useMoreTools": "使用更多工具",
      "toggleIp": "显示/隐藏 IP",
      "edit": "编辑",
      "assignKey": "关联购买",
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
      "dataConsumed": "已用",
      "cores": "{count} 核",
      "unavailable": "不可用",
      "loading": "加载中…",
      "prevAria": "上一个服务器",
      "nextAria": "下一个服务器",
      "position": "{current} / {total}"
    }
  },
  ko: {
    "statusActive": "활성",
    "statusNoResponse": "응답 없음",
    "statusChecking": "확인 중…",
    "interactionHint": "탭하여 연결 · 길게 눌러 편집",
    "providerLabel": "공급자",
    "directSsh": "직접 SSH",
    "filtersTitle": "필터",
    "viewCarousel": "캐러셀",
    "viewList": "목록",
    "connectLocalKey": "로컬 키로 연결",
    "sharePrivate": "비공개 접근 권한 공유",
    "sharePublic": "공개 접근 권한 공유",
    "columns": {
      "ip": "IP",
      "domain": "서브도메인 / 도메인",
      "category": "카테고리",
      "tags": "태그",
      "license": "상태",
      "ssh": "SSH 상태"
    },
    "filters": {
      "search": "서버 검색...",
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
      "connect": "연결",
      "enterPanel": "패널 입장",
      "useMoreTools": "더 많은 도구 사용",
      "toggleIp": "IP 표시/숨기기",
      "edit": "편집",
      "assignKey": "구매 연결",
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
      "dataConsumed": "사용됨",
      "cores": "{count} 코어",
      "unavailable": "사용 불가",
      "loading": "불러오는 중…",
      "prevAria": "이전 서버",
      "nextAria": "다음 서버",
      "position": "{current} / {total}"
    }
  },
  ja: {
    "statusActive": "アクティブ",
    "statusNoResponse": "応答なし",
    "statusChecking": "確認中…",
    "interactionHint": "タップで接続 · 長押しで編集",
    "providerLabel": "プロバイダー",
    "directSsh": "直接 SSH",
    "filtersTitle": "フィルター",
    "viewCarousel": "カルーセル",
    "viewList": "リスト",
    "connectLocalKey": "ローカルキーで接続",
    "sharePrivate": "プライベートアクセスを共有",
    "sharePublic": "パブリックアクセスを共有",
    "columns": {
      "ip": "IP",
      "domain": "サブドメイン / ドメイン",
      "category": "カテゴリ",
      "tags": "タグ",
      "license": "状態",
      "ssh": "SSH 状態"
    },
    "filters": {
      "search": "サーバーを検索...",
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
      "connect": "接続",
      "enterPanel": "パネルに入る",
      "useMoreTools": "他のツールを使う",
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
      "dataConsumed": "使用済み",
      "cores": "{count} コア",
      "unavailable": "利用不可",
      "loading": "読み込み中…",
      "prevAria": "前のサーバー",
      "nextAria": "次のサーバー",
      "position": "{current} / {total}"
    }
  },
  hi: {
    "statusActive": "सक्रिय",
    "statusNoResponse": "कोई जवाब नहीं",
    "statusChecking": "जाँच हो रही है…",
    "interactionHint": "कनेक्ट करने के लिए टैप करें · एडिट करने के लिए देर तक दबाएँ",
    "providerLabel": "प्रोवाइडर",
    "directSsh": "डायरेक्ट SSH",
    "filtersTitle": "फ़िल्टर",
    "viewCarousel": "कैरोसेल",
    "viewList": "सूची",
    "connectLocalKey": "लोकल की से कनेक्ट करें",
    "sharePrivate": "प्राइवेट एक्सेस शेयर करें",
    "sharePublic": "पब्लिक एक्सेस शेयर करें",
    "columns": {
      "ip": "IP",
      "domain": "सबडोमेन / डोमेन",
      "category": "कैटेगरी",
      "tags": "टैग",
      "license": "स्थिति",
      "ssh": "SSH स्टेटस"
    },
    "filters": {
      "search": "सर्वर खोजें...",
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
      "connect": "कनेक्ट करें",
      "enterPanel": "पैनल में जाएं",
      "useMoreTools": "और टूल का उपयोग करें",
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
      "dataConsumed": "उपयोग किया",
      "cores": "{count} कोर",
      "unavailable": "उपलब्ध नहीं",
      "loading": "लोड हो रहा है…",
      "prevAria": "पिछला सर्वर",
      "nextAria": "अगला सर्वर",
      "position": "{current} / {total}"
    }
  },
  ar: {
    "statusActive": "نشط",
    "statusNoResponse": "لا يوجد رد",
    "statusChecking": "جارٍ التحقق…",
    "interactionHint": "انقر للاتصال · اضغط مطولاً للتعديل",
    "providerLabel": "المزوّد",
    "directSsh": "SSH مباشر",
    "filtersTitle": "عوامل التصفية",
    "viewCarousel": "عرض دائري",
    "viewList": "قائمة",
    "connectLocalKey": "الاتصال بمفتاح محلي",
    "sharePrivate": "مشاركة وصول خاص",
    "sharePublic": "مشاركة وصول عام",
    "columns": {
      "ip": "IP",
      "domain": "النطاق الفرعي / النطاق",
      "category": "الفئة",
      "tags": "الوسوم",
      "license": "الحالة",
      "ssh": "حالة SSH"
    },
    "filters": {
      "search": "البحث عن خادم...",
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
      "connect": "اتصال",
      "enterPanel": "الدخول إلى اللوحة",
      "useMoreTools": "استخدام المزيد من الأدوات",
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
      "dataConsumed": "المستهلكة",
      "cores": "{count} نواة",
      "unavailable": "غير متاح",
      "loading": "جارٍ التحميل…",
      "prevAria": "الخادم السابق",
      "nextAria": "الخادم التالي",
      "position": "{current} من {total}"
    }
  },
};
