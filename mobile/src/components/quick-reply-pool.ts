/**
 * Pool de "respuestas rápidas" (chips de primer mensaje sugerido) del asistente
 * del servidor. 100 ideas de proyecto por idioma; el pane muestra 6 al azar y las
 * re-baraja por conversación. Cada entrada se compone como "<verbo> <idea>".
 *
 * El verbo NO es único: se elige al azar de un conjunto de aperturas por idioma
 * (`VERBS`) para que los chips NO empiecen todos igual ("Empezar un…") y la
 * sugerencia varíe. Todas las aperturas piden un objeto directo (encajan con las
 * ideas, que son sintagmas "un/una <idea>").
 *
 * Los idiomas siguen a los de `ServerAssistantPane` (es/en/pt/fr/it); idioma
 * desconocido cae a `es`.
 */

const VERBS: Record<string, string[]> = {
  es: ["Crear", "Quiero", "Necesito", "Construir", "Desarrollar", "Diseñar", "Montar", "Hazme", "Programar", "Lanzar"],
  en: ["Build", "Create", "I want", "I need", "Make", "Design", "Develop", "Set up", "Code", "Launch"],
  pt: ["Criar", "Quero", "Preciso de", "Construir", "Desenvolver", "Projetar", "Montar", "Faça", "Programar", "Lançar"],
  fr: ["Créer", "Je veux", "Construire", "Développer", "Concevoir", "Mettre en place", "Réaliser", "Coder", "Lancer", "Fais-moi"],
  it: ["Creare", "Voglio", "Costruire", "Sviluppare", "Progettare", "Realizzare", "Avviare", "Fammi", "Programmare", "Lanciare"],
};

// 100 ideas (mismo orden en los 5 idiomas) SIN el verbo; se antepone en runtime.
const IDEAS: Record<string, string[]> = {
  es: [
    "un sitio web para videojuego", "una app tipo Uber", "una tienda online", "una app de delivery de comida",
    "una red social para gamers", "un bot de Telegram", "una API REST con autenticación", "un blog con panel de administración",
    "un dashboard de analíticas", "un chat en tiempo real", "un sistema de reservas para restaurante", "una plataforma de cursos online",
    "una app de finanzas personales", "un marketplace de productos", "un clon de Twitter", "un sistema de tickets de soporte",
    "una app de tareas colaborativa", "una galería de fotos con login", "un foro de comunidad", "un servicio de streaming de música",
    "una plataforma de e-learning con videos", "un sistema de inventario", "un CRM de ventas", "una app de citas",
    "un portal inmobiliario", "un comparador de precios", "un creador de encuestas y formularios", "una wiki interna para empresa",
    "un sistema de facturación", "una app de reservas de hotel", "una plataforma de crowdfunding", "un generador de currículums",
    "un acortador de URLs", "un lector de RSS", "un panel de control IoT", "un bot de Discord con música",
    "una tienda de NFTs", "una billetera de criptomonedas", "un rastreador de hábitos", "una app de recetas de cocina",
    "un sistema de gestión escolar", "un reproductor de podcasts", "un editor de imágenes online", "un conversor de archivos",
    "un servicio de envío de emails", "un generador de códigos QR", "una página de portafolio profesional", "una plataforma de freelancers",
    "una app de fitness y rutinas", "un calendario de eventos", "un sistema de votaciones", "un catálogo de productos",
    "un buscador de empleos", "una red social de fotos", "una app de notas con sincronización", "un tablero Kanban",
    "un sistema de membresías", "un comparador de vuelos", "una app de mapa con marcadores", "una plataforma de subastas",
    "un generador de facturas PDF", "un servicio de almacenamiento de archivos", "un panel de monitoreo de servidores", "una app de meditación",
    "un juego multijugador en navegador", "un quiz interactivo", "un sistema de reseñas y valoraciones", "una tienda de suscripciones",
    "una app de seguimiento de gastos", "una plataforma de mentorías", "un generador de paletas de colores", "un asistente de IA personalizado",
    "un sistema de gestión de proyectos", "una app del clima", "un buscador de películas", "una lista de deseos compartida",
    "un servidor de juegos Minecraft", "un e-commerce con control de stock", "una app de transporte público", "un sistema de citas médicas",
    "una plataforma de blogs multiusuario", "un editor de markdown colaborativo", "una app de control parental", "un servicio de hosting de imágenes",
    "un generador de memes", "un sistema de afiliados", "una app de descuentos y cupones", "una plataforma de eventos en vivo",
    "un tablero de anuncios clasificados", "una app de seguimiento de paquetes", "un sistema de reservas de canchas", "un generador de contratos",
    "una app para aprender idiomas", "un buscador de restaurantes cercanos", "una plataforma de donaciones", "un sistema de control de acceso",
    "una app de lista de compras", "un panel de redes sociales", "un servicio de backup automático", "una tienda de plantillas digitales",
  ],
  en: [
    "a website for a videogame", "an Uber-like app", "an online store", "a food delivery app",
    "a social network for gamers", "a Telegram bot", "a REST API with authentication", "a blog with an admin panel",
    "an analytics dashboard", "a real-time chat", "a restaurant booking system", "an online courses platform",
    "a personal finance app", "a products marketplace", "a Twitter clone", "a support ticket system",
    "a collaborative to-do app", "a photo gallery with login", "a community forum", "a music streaming service",
    "an e-learning platform with videos", "an inventory system", "a sales CRM", "a dating app",
    "a real estate portal", "a price comparator", "a surveys and forms builder", "an internal company wiki",
    "an invoicing system", "a hotel booking app", "a crowdfunding platform", "a resume generator",
    "a URL shortener", "an RSS reader", "an IoT control panel", "a Discord music bot",
    "an NFT store", "a crypto wallet", "a habit tracker", "a cooking recipes app",
    "a school management system", "a podcast player", "an online image editor", "a file converter",
    "an email sending service", "a QR code generator", "a professional portfolio page", "a freelancers platform",
    "a fitness and routines app", "an events calendar", "a voting system", "a product catalog",
    "a job search site", "a photo social network", "a notes app with sync", "a Kanban board",
    "a membership system", "a flight comparator", "a map app with markers", "an auction platform",
    "a PDF invoice generator", "a file storage service", "a server monitoring panel", "a meditation app",
    "a multiplayer browser game", "an interactive quiz", "a reviews and ratings system", "a subscription store",
    "an expense tracker app", "a mentorship platform", "a color palette generator", "a custom AI assistant",
    "a project management system", "a weather app", "a movie finder", "a shared wishlist",
    "a Minecraft game server", "an e-commerce with stock control", "a public transport app", "a medical appointment system",
    "a multi-user blog platform", "a collaborative markdown editor", "a parental control app", "an image hosting service",
    "a meme generator", "an affiliate system", "a discounts and coupons app", "a live events platform",
    "a classified ads board", "a package tracking app", "a court booking system", "a contract generator",
    "a language learning app", "a nearby restaurants finder", "a donations platform", "an access control system",
    "a shopping list app", "a social media dashboard", "an automatic backup service", "a digital templates store",
  ],
  pt: [
    "um site para videogame", "um app tipo Uber", "uma loja online", "um app de delivery de comida",
    "uma rede social para gamers", "um bot de Telegram", "uma API REST com autenticação", "um blog com painel de administração",
    "um dashboard de analytics", "um chat em tempo real", "um sistema de reservas para restaurante", "uma plataforma de cursos online",
    "um app de finanças pessoais", "um marketplace de produtos", "um clone do Twitter", "um sistema de tickets de suporte",
    "um app de tarefas colaborativo", "uma galeria de fotos com login", "um fórum de comunidade", "um serviço de streaming de música",
    "uma plataforma de e-learning com vídeos", "um sistema de inventário", "um CRM de vendas", "um app de namoro",
    "um portal imobiliário", "um comparador de preços", "um criador de pesquisas e formulários", "uma wiki interna para empresa",
    "um sistema de faturamento", "um app de reservas de hotel", "uma plataforma de crowdfunding", "um gerador de currículos",
    "um encurtador de URLs", "um leitor de RSS", "um painel de controle IoT", "um bot de Discord com música",
    "uma loja de NFTs", "uma carteira de criptomoedas", "um rastreador de hábitos", "um app de receitas de cozinha",
    "um sistema de gestão escolar", "um player de podcasts", "um editor de imagens online", "um conversor de arquivos",
    "um serviço de envio de e-mails", "um gerador de códigos QR", "uma página de portfólio profissional", "uma plataforma de freelancers",
    "um app de fitness e treinos", "um calendário de eventos", "um sistema de votação", "um catálogo de produtos",
    "um buscador de empregos", "uma rede social de fotos", "um app de notas com sincronização", "um quadro Kanban",
    "um sistema de assinaturas", "um comparador de voos", "um app de mapa com marcadores", "uma plataforma de leilões",
    "um gerador de faturas em PDF", "um serviço de armazenamento de arquivos", "um painel de monitoramento de servidores", "um app de meditação",
    "um jogo multiplayer no navegador", "um quiz interativo", "um sistema de avaliações", "uma loja de assinaturas",
    "um app de controle de gastos", "uma plataforma de mentorias", "um gerador de paletas de cores", "um assistente de IA personalizado",
    "um sistema de gestão de projetos", "um app de clima", "um buscador de filmes", "uma lista de desejos compartilhada",
    "um servidor de jogos Minecraft", "um e-commerce com controle de estoque", "um app de transporte público", "um sistema de consultas médicas",
    "uma plataforma de blogs multiusuário", "um editor de markdown colaborativo", "um app de controle parental", "um serviço de hospedagem de imagens",
    "um gerador de memes", "um sistema de afiliados", "um app de descontos e cupons", "uma plataforma de eventos ao vivo",
    "um quadro de classificados", "um app de rastreamento de encomendas", "um sistema de reservas de quadras", "um gerador de contratos",
    "um app para aprender idiomas", "um buscador de restaurantes próximos", "uma plataforma de doações", "um sistema de controle de acesso",
    "um app de lista de compras", "um painel de redes sociais", "um serviço de backup automático", "uma loja de templates digitais",
  ],
  fr: [
    "un site web pour un jeu vidéo", "une app type Uber", "une boutique en ligne", "une app de livraison de repas",
    "un réseau social pour gamers", "un bot Telegram", "une API REST avec authentification", "un blog avec panneau d'administration",
    "un tableau de bord d'analytique", "un chat en temps réel", "un système de réservation pour restaurant", "une plateforme de cours en ligne",
    "une app de finances personnelles", "une marketplace de produits", "un clone de Twitter", "un système de tickets de support",
    "une app de tâches collaborative", "une galerie de photos avec connexion", "un forum communautaire", "un service de streaming musical",
    "une plateforme e-learning avec vidéos", "un système d'inventaire", "un CRM de ventes", "une app de rencontres",
    "un portail immobilier", "un comparateur de prix", "un créateur de sondages et formulaires", "un wiki interne d'entreprise",
    "un système de facturation", "une app de réservation d'hôtel", "une plateforme de crowdfunding", "un générateur de CV",
    "un raccourcisseur d'URL", "un lecteur RSS", "un panneau de contrôle IoT", "un bot Discord avec musique",
    "une boutique de NFT", "un portefeuille crypto", "un suivi d'habitudes", "une app de recettes de cuisine",
    "un système de gestion scolaire", "un lecteur de podcasts", "un éditeur d'images en ligne", "un convertisseur de fichiers",
    "un service d'envoi d'e-mails", "un générateur de codes QR", "une page de portfolio professionnel", "une plateforme de freelances",
    "une app de fitness et routines", "un calendrier d'événements", "un système de vote", "un catalogue de produits",
    "un moteur de recherche d'emploi", "un réseau social de photos", "une app de notes avec synchro", "un tableau Kanban",
    "un système d'abonnements", "un comparateur de vols", "une app de carte avec marqueurs", "une plateforme d'enchères",
    "un générateur de factures PDF", "un service de stockage de fichiers", "un panneau de surveillance de serveurs", "une app de méditation",
    "un jeu multijoueur dans le navigateur", "un quiz interactif", "un système d'avis et de notes", "une boutique par abonnement",
    "une app de suivi des dépenses", "une plateforme de mentorat", "un générateur de palettes de couleurs", "un assistant IA personnalisé",
    "un système de gestion de projets", "une app météo", "un moteur de recherche de films", "une liste de souhaits partagée",
    "un serveur de jeu Minecraft", "un e-commerce avec gestion de stock", "une app de transport public", "un système de rendez-vous médicaux",
    "une plateforme de blogs multi-utilisateurs", "un éditeur markdown collaboratif", "une app de contrôle parental", "un service d'hébergement d'images",
    "un générateur de mèmes", "un système d'affiliation", "une app de réductions et coupons", "une plateforme d'événements en direct",
    "un tableau de petites annonces", "une app de suivi de colis", "un système de réservation de terrains", "un générateur de contrats",
    "une app pour apprendre les langues", "un moteur de recherche de restaurants proches", "une plateforme de dons", "un système de contrôle d'accès",
    "une app de liste de courses", "un tableau de bord de réseaux sociaux", "un service de sauvegarde automatique", "une boutique de modèles numériques",
  ],
  it: [
    "un sito web per un videogioco", "un'app tipo Uber", "un negozio online", "un'app di consegna cibo",
    "un social network per gamer", "un bot Telegram", "una API REST con autenticazione", "un blog con pannello di amministrazione",
    "una dashboard di analytics", "una chat in tempo reale", "un sistema di prenotazioni per ristorante", "una piattaforma di corsi online",
    "un'app di finanze personali", "un marketplace di prodotti", "un clone di Twitter", "un sistema di ticket di supporto",
    "un'app di attività collaborativa", "una galleria foto con login", "un forum della community", "un servizio di streaming musicale",
    "una piattaforma e-learning con video", "un sistema di inventario", "un CRM di vendite", "un'app di incontri",
    "un portale immobiliare", "un comparatore di prezzi", "un creatore di sondaggi e moduli", "una wiki interna aziendale",
    "un sistema di fatturazione", "un'app di prenotazione hotel", "una piattaforma di crowdfunding", "un generatore di curriculum",
    "un accorciatore di URL", "un lettore RSS", "un pannello di controllo IoT", "un bot Discord con musica",
    "un negozio di NFT", "un wallet di criptovalute", "un tracker di abitudini", "un'app di ricette di cucina",
    "un sistema di gestione scolastica", "un lettore di podcast", "un editor di immagini online", "un convertitore di file",
    "un servizio di invio email", "un generatore di codici QR", "una pagina di portfolio professionale", "una piattaforma di freelance",
    "un'app di fitness e allenamenti", "un calendario di eventi", "un sistema di votazione", "un catalogo di prodotti",
    "un motore di ricerca lavoro", "un social network di foto", "un'app di note con sincronizzazione", "una board Kanban",
    "un sistema di abbonamenti", "un comparatore di voli", "un'app mappa con marcatori", "una piattaforma di aste",
    "un generatore di fatture PDF", "un servizio di archiviazione file", "un pannello di monitoraggio server", "un'app di meditazione",
    "un gioco multiplayer nel browser", "un quiz interattivo", "un sistema di recensioni e valutazioni", "un negozio in abbonamento",
    "un'app di monitoraggio delle spese", "una piattaforma di mentorship", "un generatore di palette di colori", "un assistente IA personalizzato",
    "un sistema di gestione progetti", "un'app meteo", "un motore di ricerca film", "una lista dei desideri condivisa",
    "un server di gioco Minecraft", "un e-commerce con gestione magazzino", "un'app di trasporto pubblico", "un sistema di appuntamenti medici",
    "una piattaforma di blog multiutente", "un editor markdown collaborativo", "un'app di controllo parentale", "un servizio di hosting immagini",
    "un generatore di meme", "un sistema di affiliazione", "un'app di sconti e coupon", "una piattaforma di eventi dal vivo",
    "una bacheca di annunci", "un'app di tracciamento pacchi", "un sistema di prenotazione campi", "un generatore di contratti",
    "un'app per imparare le lingue", "un motore di ricerca di ristoranti vicini", "una piattaforma di donazioni", "un sistema di controllo accessi",
    "un'app di lista della spesa", "una dashboard di social media", "un servizio di backup automatico", "un negozio di template digitali",
  ],
};

/** Pool completo ("<verbo> <idea>") para un idioma (fallback `es`). El verbo de
 *  cada idea se elige al azar del set del idioma → los chips NO empiezan todos
 *  igual. Se recompone en cada llamada (el pane memoiza por conversación). */
export function quickReplyPool(language?: string): string[] {
  const lang = (language ?? "es").slice(0, 2);
  const verbs = VERBS[lang] ?? VERBS.es;
  const ideas = IDEAS[lang] ?? IDEAS.es;
  return ideas.map((idea) => `${verbs[Math.floor(Math.random() * verbs.length)]} ${idea}`);
}

/**
 * `count` respuestas rápidas al azar (sin repetir) del pool del idioma. Usa
 * `Math.random` (runtime RN), así cada conversación nueva ve un set distinto.
 */
export function sampleQuickReplies(language: string | undefined, count = 6): string[] {
  const pool = quickReplyPool(language);
  const arr = pool.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr.slice(0, Math.min(count, arr.length));
}
