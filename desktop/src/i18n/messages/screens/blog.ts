import type { LocaleCode } from "../../locales";
import type { Widen } from "../_shared";

// Spanish is the source of truth; every other locale is checked against its
// widened shape, so missing/extra keys per screen surface as TS errors.
// Namespace de la superficie de BLOG de Administración del escritorio (espejo
// del portal web `frontend/src/lib/portal-blog.ts`).
const es = {
  // Tab / encabezado
  "tab": "Blog",
  "title": "Blog",
  "subtitle": "Crea y gestiona las publicaciones del blog, sus categorías y tags.",
  "loadError": "No se pudieron cargar las publicaciones",
  "saveError": "No se pudo guardar la publicación",
  "deleteError": "No se pudo eliminar la publicación",
  "actionError": "No se pudo ejecutar la acción",

  // Tabla
  "newPost": "Nueva publicación",
  "colTitle": "Título",
  "colCategory": "Categoría",
  "colStatus": "Estado",
  "colTags": "Tags",
  "colAuthor": "Autor",
  "colViews": "Vistas",
  "colDate": "Fecha",
  "statusDraft": "Borrador",
  "statusPublished": "Publicado",
  "scopeMine": "Viendo: las mías",
  "scopeAll": "Viendo: todas",
  "edit": "Editar",
  "delete": "Eliminar",
  "viewPublic": "Ver público",
  "retranslate": "Retraducir",
  "retranslateStarted": "Traducción relanzada. Los idiomas se actualizarán en segundo plano.",
  "retranslateError": "No se pudo relanzar la traducción",
  "refresh": "Actualizar",
  "empty": "Aún no tienes publicaciones. Crea la primera con «Nueva publicación».",

  // Confirmaciones
  "deletePostTitle": "Eliminar publicación",
  "deletePostConfirm": "¿Eliminar la publicación «{title}»? Esta acción no se puede deshacer.",
  "regenConfirmTitle": "Regenerar con IA",
  "regenConfirm": "Esto reemplazará el título, resumen, contenido, tags y portada actuales por una nueva versión generada por IA. ¿Continuar?",
  "deleteCategoryTitle": "Eliminar categoría",
  "deleteCategoryConfirm": "¿Eliminar la categoría «{name}» y todos sus tags?",
  "deleteTagTitle": "Eliminar tag",
  "deleteTagConfirm": "¿Eliminar el tag «{name}»?",

  // Modal: tabs
  "modalNewTitle": "Nueva publicación",
  "modalEditTitle": "Editar publicación",
  "tabPublish": "Publicar",
  "tabCategories": "Categorías",
  "tabTags": "Tags",
  "close": "Cerrar",
  "cancel": "Cancelar",
  "save": "Guardar",
  "saving": "Guardando…",

  // Modal: campos del post
  "fieldTitle": "Título",
  "fieldSlug": "URL pública",
  "fieldSlugHint": "Se autogenera desde el título en inglés si lo dejas vacío.",
  "publicUrlLabel": "URL pública:",
  "fieldCategory": "Categoría",
  "selectCategory": "— Selecciona categoría —",
  "fieldTagsLabel": "Tags",
  "tagsHintNoCategory": "Selecciona una categoría para ver sus tags.",
  "tagsHintNoTags": "Esta categoría no tiene tags. Añádelos en el tab «Tags».",
  "fieldExcerpt": "Extracto",
  "fieldContent": "Contenido (Markdown)",
  "contentHelp": "Escribe en Markdown: **negrita**, _cursiva_, # títulos, - listas, ![alt](url) imágenes.",
  "contentPlaceholder": "Escribe el contenido del artículo…",
  "fieldStatus": "Estado",
  "fieldLocale": "Idioma base",
  "fieldCover": "Portada",
  "fieldCoverUrl": "URL de portada",
  "coverUpload": "Subir imagen",
  "coverUploading": "Subiendo…",
  "coverRemove": "Quitar portada",
  "coverEmpty": "Sin imagen de portada",
  "contentImageUpload": "Insertar imagen",

  // SEO y redes sociales
  "seoSocialTitle": "SEO y redes",
  "seoTitleLabel": "Meta título",
  "seoDescLabel": "Meta descripción",
  "hashtagsLabel": "Hashtags",
  "hashtagsHint": "Separa con espacios o comas; la # es opcional.",
  "socialCaptionLabel": "Caption para redes",
  "seoOptimize": "✨ Optimizar SEO y redes (IA)",
  "seoOptimizing": "Optimizando SEO y redes con IA…",
  "seoDone": "SEO y redes generados. Revisa antes de publicar.",
  "seoError": "No se pudo optimizar SEO y redes con IA.",

  // Validación
  "titleRequired": "El título es obligatorio (mínimo 3 caracteres).",
  "categoryRequired": "Selecciona una categoría.",
  "contentRequired": "El contenido es obligatorio.",
  "uploadError": "Error al subir la imagen",

  // IA
  "aiGenerate": "Generar con IA",
  "aiGenerating": "Generando…",
  "aiDisabled": "Asistente IA no disponible",
  "aiNeedCategory": "Selecciona una categoría primero",
  "aiTooltip": "Generar borrador con IA",
  "aiStatusStart": "Generando texto e imágenes con IA…",
  "aiStatusProgress": "Generando texto e imágenes con IA… ({seconds}s)",
  "aiStatusDone": "Borrador generado. Revisa y ajusta antes de publicar.",
  "aiError": "No se pudo generar el borrador con IA.",
  "aiMinChars": "Longitud mínima (caracteres)",
  "aiImageCount": "Nº de imágenes",
  "aiUsageTitle": "Tokens IA consumidos",
  "aiUsageText": "Texto",
  "aiUsageImage": "Imagen",
  "aiUsageTotal": "Total",
  "aiUsageInput": "Entrada",
  "aiUsageCached": "Caché",
  "aiUsageOutput": "Salida",
  "aiUsageNote": "«Caché» son tokens de entrada servidos desde caché (incluidos en «Entrada»). Las traducciones a otros idiomas se suman al publicar.",

  // Categorías
  "catManagerTitle": "Categorías del blog",
  "catNew": "Nueva categoría",
  "catAdd": "Añadir",
  "catEmpty": "Aún no hay categorías. Crea la primera arriba.",
  "catTagsCount": "{count} tags",
  "rename": "Renombrar",
  "renameCategoryPrompt": "Nuevo nombre de la categoría:",
  "catCreateError": "No se pudo crear la categoría",
  "catRenameError": "No se pudo renombrar la categoría",
  "catDeleteError": "No se pudo eliminar la categoría",

  // Tags
  "tagManagerTitle": "Tags por categoría",
  "tagSelectCategory": "— Elige categoría —",
  "tagPickCategory": "Elige una categoría para gestionar sus tags.",
  "tagNew": "Nuevo tag",
  "tagAdd": "Añadir",
  "tagEmpty": "Esta categoría no tiene tags. Añádelos arriba.",
  "tagNeedCategory": "Elige una categoría primero.",
  "renameTagPrompt": "Nuevo nombre del tag:",
  "tagCreateError": "No se pudo crear el tag",
  "tagRenameError": "No se pudo renombrar el tag",
  "tagDeleteError": "No se pudo eliminar el tag",
} as const;

export type BlogMessages = Widen<typeof es>;

// Las traducciones cubren todos los locales soportados (paridad completa).
const en: BlogMessages = {
  "tab": "Blog", "title": "Blog", "subtitle": "Create and manage blog posts, their categories and tags.", "loadError": "Could not load the posts", "saveError": "Could not save the post", "deleteError": "Could not delete the post", "actionError": "Could not perform the action",
  "newPost": "New post", "colTitle": "Title", "colCategory": "Category", "colStatus": "Status", "colTags": "Tags", "colAuthor": "Author", "colViews": "Views", "colDate": "Date", "statusDraft": "Draft", "statusPublished": "Published", "scopeMine": "Viewing: mine", "scopeAll": "Viewing: all", "edit": "Edit", "delete": "Delete", "viewPublic": "View public", "retranslate": "Retranslate", "retranslateStarted": "Translation restarted. Languages will update in the background.", "retranslateError": "Could not restart the translation", "refresh": "Refresh", "empty": "You have no posts yet. Create the first one with \"New post\".",
  "deletePostTitle": "Delete post", "deletePostConfirm": "Delete the post \"{title}\"? This action cannot be undone.", "regenConfirmTitle": "Regenerate with AI", "regenConfirm": "This will replace the current title, excerpt, content, tags and cover with a new AI-generated version. Continue?", "deleteCategoryTitle": "Delete category", "deleteCategoryConfirm": "Delete the category \"{name}\" and all its tags?", "deleteTagTitle": "Delete tag", "deleteTagConfirm": "Delete the tag \"{name}\"?",
  "modalNewTitle": "New post", "modalEditTitle": "Edit post", "tabPublish": "Publish", "tabCategories": "Categories", "tabTags": "Tags", "close": "Close", "cancel": "Cancel", "save": "Save", "saving": "Saving…",
  "fieldTitle": "Title", "fieldSlug": "Public URL", "fieldSlugHint": "Auto-generated from the English title if left empty.", "publicUrlLabel": "Public URL:", "fieldCategory": "Category", "selectCategory": "— Select category —", "fieldTagsLabel": "Tags", "tagsHintNoCategory": "Select a category to see its tags.", "tagsHintNoTags": "This category has no tags. Add them in the \"Tags\" tab.", "fieldExcerpt": "Excerpt", "fieldContent": "Content (Markdown)", "contentHelp": "Write in Markdown: **bold**, _italic_, # headings, - lists, ![alt](url) images.", "contentPlaceholder": "Write the article content…", "fieldStatus": "Status", "fieldLocale": "Base language", "fieldCover": "Cover", "fieldCoverUrl": "Cover URL", "coverUpload": "Upload image", "coverUploading": "Uploading…", "coverRemove": "Remove cover", "coverEmpty": "No cover image", "contentImageUpload": "Insert image",
  "seoSocialTitle": "SEO & social", "seoTitleLabel": "Meta title", "seoDescLabel": "Meta description", "hashtagsLabel": "Hashtags", "hashtagsHint": "Separate with spaces or commas; the # is optional.", "socialCaptionLabel": "Social caption", "seoOptimize": "✨ Optimize SEO & social (AI)", "seoOptimizing": "Optimizing SEO & social with AI…", "seoDone": "SEO & social generated. Review before publishing.", "seoError": "Could not optimize SEO & social with AI.",
  "titleRequired": "Title is required (minimum 3 characters).", "categoryRequired": "Select a category.", "contentRequired": "Content is required.", "uploadError": "Error uploading the image",
  "aiGenerate": "Generate with AI", "aiGenerating": "Generating…", "aiDisabled": "AI assistant unavailable", "aiNeedCategory": "Select a category first", "aiTooltip": "Generate draft with AI", "aiStatusStart": "Generating text and images with AI…", "aiStatusProgress": "Generating text and images with AI… ({seconds}s)", "aiStatusDone": "Draft generated. Review and adjust before publishing.", "aiError": "Could not generate the draft with AI.", "aiMinChars": "Minimum length (characters)", "aiImageCount": "Number of images", "aiUsageTitle": "AI tokens consumed", "aiUsageText": "Text", "aiUsageImage": "Image", "aiUsageTotal": "Total", "aiUsageInput": "Input", "aiUsageCached": "Cache", "aiUsageOutput": "Output", "aiUsageNote": "\"Cache\" are input tokens served from cache (included in \"Input\"). Translations to other languages are added on publish.",
  "catManagerTitle": "Blog categories", "catNew": "New category", "catAdd": "Add", "catEmpty": "No categories yet. Create the first one above.", "catTagsCount": "{count} tags", "rename": "Rename", "renameCategoryPrompt": "New category name:", "catCreateError": "Could not create the category", "catRenameError": "Could not rename the category", "catDeleteError": "Could not delete the category",
  "tagManagerTitle": "Tags by category", "tagSelectCategory": "— Choose category —", "tagPickCategory": "Choose a category to manage its tags.", "tagNew": "New tag", "tagAdd": "Add", "tagEmpty": "This category has no tags. Add them above.", "tagNeedCategory": "Choose a category first.", "renameTagPrompt": "New tag name:", "tagCreateError": "Could not create the tag", "tagRenameError": "Could not rename the tag", "tagDeleteError": "Could not delete the tag",
};

const fr: BlogMessages = {
  "tab": "Blog", "title": "Blog", "subtitle": "Créez et gérez les articles du blog, leurs catégories et tags.", "loadError": "Impossible de charger les articles", "saveError": "Impossible d'enregistrer l'article", "deleteError": "Impossible de supprimer l'article", "actionError": "Impossible d'exécuter l'action",
  "newPost": "Nouvel article", "colTitle": "Titre", "colCategory": "Catégorie", "colStatus": "Statut", "colTags": "Tags", "colAuthor": "Auteur", "colViews": "Vues", "colDate": "Date", "statusDraft": "Brouillon", "statusPublished": "Publié", "scopeMine": "Affichage : les miens", "scopeAll": "Affichage : tous", "edit": "Modifier", "delete": "Supprimer", "viewPublic": "Voir en public", "retranslate": "Retraduire", "retranslateStarted": "Traduction relancée. Les langues seront mises à jour en arrière-plan.", "retranslateError": "Impossible de relancer la traduction", "refresh": "Actualiser", "empty": "Vous n'avez encore aucun article. Créez le premier avec « Nouvel article ».",
  "deletePostTitle": "Supprimer l'article", "deletePostConfirm": "Supprimer l'article « {title} » ? Cette action est irréversible.", "regenConfirmTitle": "Régénérer avec l'IA", "regenConfirm": "Ceci remplacera le titre, le résumé, le contenu, les tags et la couverture actuels par une nouvelle version générée par l'IA. Continuer ?", "deleteCategoryTitle": "Supprimer la catégorie", "deleteCategoryConfirm": "Supprimer la catégorie « {name} » et tous ses tags ?", "deleteTagTitle": "Supprimer le tag", "deleteTagConfirm": "Supprimer le tag « {name} » ?",
  "modalNewTitle": "Nouvel article", "modalEditTitle": "Modifier l'article", "tabPublish": "Publier", "tabCategories": "Catégories", "tabTags": "Tags", "close": "Fermer", "cancel": "Annuler", "save": "Enregistrer", "saving": "Enregistrement…",
  "fieldTitle": "Titre", "fieldSlug": "URL publique", "fieldSlugHint": "Générée automatiquement à partir du titre anglais si laissée vide.", "publicUrlLabel": "URL publique :", "fieldCategory": "Catégorie", "selectCategory": "— Choisir une catégorie —", "fieldTagsLabel": "Tags", "tagsHintNoCategory": "Choisissez une catégorie pour voir ses tags.", "tagsHintNoTags": "Cette catégorie n'a pas de tags. Ajoutez-en dans l'onglet « Tags ».", "fieldExcerpt": "Extrait", "fieldContent": "Contenu (Markdown)", "contentHelp": "Écrivez en Markdown : **gras**, _italique_, # titres, - listes, ![alt](url) images.", "contentPlaceholder": "Rédigez le contenu de l'article…", "fieldStatus": "Statut", "fieldLocale": "Langue de base", "fieldCover": "Couverture", "fieldCoverUrl": "URL de couverture", "coverUpload": "Téléverser une image", "coverUploading": "Téléversement…", "coverRemove": "Retirer la couverture", "coverEmpty": "Aucune image de couverture", "contentImageUpload": "Insérer une image",
  "seoSocialTitle": "SEO et réseaux", "seoTitleLabel": "Méta-titre", "seoDescLabel": "Méta-description", "hashtagsLabel": "Hashtags", "hashtagsHint": "Séparez par des espaces ou des virgules ; le # est facultatif.", "socialCaptionLabel": "Légende pour les réseaux", "seoOptimize": "✨ Optimiser SEO et réseaux (IA)", "seoOptimizing": "Optimisation du SEO et des réseaux avec l'IA…", "seoDone": "SEO et réseaux générés. Vérifiez avant de publier.", "seoError": "Impossible d'optimiser le SEO et les réseaux avec l'IA.",
  "titleRequired": "Le titre est obligatoire (minimum 3 caractères).", "categoryRequired": "Choisissez une catégorie.", "contentRequired": "Le contenu est obligatoire.", "uploadError": "Erreur lors du téléversement de l'image",
  "aiGenerate": "Générer avec l'IA", "aiGenerating": "Génération…", "aiDisabled": "Assistant IA indisponible", "aiNeedCategory": "Choisissez d'abord une catégorie", "aiTooltip": "Générer un brouillon avec l'IA", "aiStatusStart": "Génération de texte et d'images avec l'IA…", "aiStatusProgress": "Génération de texte et d'images avec l'IA… ({seconds}s)", "aiStatusDone": "Brouillon généré. Vérifiez et ajustez avant de publier.", "aiError": "Impossible de générer le brouillon avec l'IA.", "aiMinChars": "Longueur minimale (caractères)", "aiImageCount": "Nombre d'images", "aiUsageTitle": "Tokens IA consommés", "aiUsageText": "Texte", "aiUsageImage": "Image", "aiUsageTotal": "Total", "aiUsageInput": "Entrée", "aiUsageCached": "Cache", "aiUsageOutput": "Sortie", "aiUsageNote": "« Cache » sont des tokens d'entrée servis depuis le cache (inclus dans « Entrée »). Les traductions vers d'autres langues s'ajoutent à la publication.",
  "catManagerTitle": "Catégories du blog", "catNew": "Nouvelle catégorie", "catAdd": "Ajouter", "catEmpty": "Aucune catégorie. Créez la première ci-dessus.", "catTagsCount": "{count} tags", "rename": "Renommer", "renameCategoryPrompt": "Nouveau nom de la catégorie :", "catCreateError": "Impossible de créer la catégorie", "catRenameError": "Impossible de renommer la catégorie", "catDeleteError": "Impossible de supprimer la catégorie",
  "tagManagerTitle": "Tags par catégorie", "tagSelectCategory": "— Choisir une catégorie —", "tagPickCategory": "Choisissez une catégorie pour gérer ses tags.", "tagNew": "Nouveau tag", "tagAdd": "Ajouter", "tagEmpty": "Cette catégorie n'a pas de tags. Ajoutez-en ci-dessus.", "tagNeedCategory": "Choisissez d'abord une catégorie.", "renameTagPrompt": "Nouveau nom du tag :", "tagCreateError": "Impossible de créer le tag", "tagRenameError": "Impossible de renommer le tag", "tagDeleteError": "Impossible de supprimer le tag",
};

const pt: BlogMessages = {
  "tab": "Blog", "title": "Blog", "subtitle": "Crie e gerencie as publicações do blog, suas categorias e tags.", "loadError": "Não foi possível carregar as publicações", "saveError": "Não foi possível salvar a publicação", "deleteError": "Não foi possível excluir a publicação", "actionError": "Não foi possível executar a ação",
  "newPost": "Nova publicação", "colTitle": "Título", "colCategory": "Categoria", "colStatus": "Status", "colTags": "Tags", "colAuthor": "Autor", "colViews": "Visualizações", "colDate": "Data", "statusDraft": "Rascunho", "statusPublished": "Publicado", "scopeMine": "Vendo: as minhas", "scopeAll": "Vendo: todas", "edit": "Editar", "delete": "Excluir", "viewPublic": "Ver público", "retranslate": "Retraduzir", "retranslateStarted": "Tradução reiniciada. Os idiomas serão atualizados em segundo plano.", "retranslateError": "Não foi possível reiniciar a tradução", "refresh": "Atualizar", "empty": "Você ainda não tem publicações. Crie a primeira com \"Nova publicação\".",
  "deletePostTitle": "Excluir publicação", "deletePostConfirm": "Excluir a publicação \"{title}\"? Esta ação não pode ser desfeita.", "regenConfirmTitle": "Regenerar com IA", "regenConfirm": "Isto substituirá o título, resumo, conteúdo, tags e capa atuais por uma nova versão gerada por IA. Continuar?", "deleteCategoryTitle": "Excluir categoria", "deleteCategoryConfirm": "Excluir a categoria \"{name}\" e todas as suas tags?", "deleteTagTitle": "Excluir tag", "deleteTagConfirm": "Excluir a tag \"{name}\"?",
  "modalNewTitle": "Nova publicação", "modalEditTitle": "Editar publicação", "tabPublish": "Publicar", "tabCategories": "Categorias", "tabTags": "Tags", "close": "Fechar", "cancel": "Cancelar", "save": "Salvar", "saving": "Salvando…",
  "fieldTitle": "Título", "fieldSlug": "URL pública", "fieldSlugHint": "Gerada automaticamente a partir do título em inglês se deixada vazia.", "publicUrlLabel": "URL pública:", "fieldCategory": "Categoria", "selectCategory": "— Selecione a categoria —", "fieldTagsLabel": "Tags", "tagsHintNoCategory": "Selecione uma categoria para ver suas tags.", "tagsHintNoTags": "Esta categoria não tem tags. Adicione-as na aba \"Tags\".", "fieldExcerpt": "Resumo", "fieldContent": "Conteúdo (Markdown)", "contentHelp": "Escreva em Markdown: **negrito**, _itálico_, # títulos, - listas, ![alt](url) imagens.", "contentPlaceholder": "Escreva o conteúdo do artigo…", "fieldStatus": "Status", "fieldLocale": "Idioma base", "fieldCover": "Capa", "fieldCoverUrl": "URL da capa", "coverUpload": "Enviar imagem", "coverUploading": "Enviando…", "coverRemove": "Remover capa", "coverEmpty": "Sem imagem de capa", "contentImageUpload": "Inserir imagem",
  "seoSocialTitle": "SEO e redes", "seoTitleLabel": "Meta título", "seoDescLabel": "Meta descrição", "hashtagsLabel": "Hashtags", "hashtagsHint": "Separe com espaços ou vírgulas; o # é opcional.", "socialCaptionLabel": "Legenda para redes", "seoOptimize": "✨ Otimizar SEO e redes (IA)", "seoOptimizing": "Otimizando SEO e redes com IA…", "seoDone": "SEO e redes gerados. Revise antes de publicar.", "seoError": "Não foi possível otimizar SEO e redes com IA.",
  "titleRequired": "O título é obrigatório (mínimo 3 caracteres).", "categoryRequired": "Selecione uma categoria.", "contentRequired": "O conteúdo é obrigatório.", "uploadError": "Erro ao enviar a imagem",
  "aiGenerate": "Gerar com IA", "aiGenerating": "Gerando…", "aiDisabled": "Assistente de IA indisponível", "aiNeedCategory": "Selecione uma categoria primeiro", "aiTooltip": "Gerar rascunho com IA", "aiStatusStart": "Gerando texto e imagens com IA…", "aiStatusProgress": "Gerando texto e imagens com IA… ({seconds}s)", "aiStatusDone": "Rascunho gerado. Revise e ajuste antes de publicar.", "aiError": "Não foi possível gerar o rascunho com IA.", "aiMinChars": "Comprimento mínimo (caracteres)", "aiImageCount": "Número de imagens", "aiUsageTitle": "Tokens de IA consumidos", "aiUsageText": "Texto", "aiUsageImage": "Imagem", "aiUsageTotal": "Total", "aiUsageInput": "Entrada", "aiUsageCached": "Cache", "aiUsageOutput": "Saída", "aiUsageNote": "\"Cache\" são tokens de entrada servidos do cache (incluídos em \"Entrada\"). As traduções para outros idiomas são somadas ao publicar.",
  "catManagerTitle": "Categorias do blog", "catNew": "Nova categoria", "catAdd": "Adicionar", "catEmpty": "Ainda não há categorias. Crie a primeira acima.", "catTagsCount": "{count} tags", "rename": "Renomear", "renameCategoryPrompt": "Novo nome da categoria:", "catCreateError": "Não foi possível criar a categoria", "catRenameError": "Não foi possível renomear a categoria", "catDeleteError": "Não foi possível excluir a categoria",
  "tagManagerTitle": "Tags por categoria", "tagSelectCategory": "— Escolha a categoria —", "tagPickCategory": "Escolha uma categoria para gerenciar suas tags.", "tagNew": "Nova tag", "tagAdd": "Adicionar", "tagEmpty": "Esta categoria não tem tags. Adicione-as acima.", "tagNeedCategory": "Escolha uma categoria primeiro.", "renameTagPrompt": "Novo nome da tag:", "tagCreateError": "Não foi possível criar a tag", "tagRenameError": "Não foi possível renomear a tag", "tagDeleteError": "Não foi possível excluir a tag",
};

const it: BlogMessages = {
  "tab": "Blog", "title": "Blog", "subtitle": "Crea e gestisci gli articoli del blog, le loro categorie e tag.", "loadError": "Impossibile caricare gli articoli", "saveError": "Impossibile salvare l'articolo", "deleteError": "Impossibile eliminare l'articolo", "actionError": "Impossibile eseguire l'azione",
  "newPost": "Nuovo articolo", "colTitle": "Titolo", "colCategory": "Categoria", "colStatus": "Stato", "colTags": "Tag", "colAuthor": "Autore", "colViews": "Visualizzazioni", "colDate": "Data", "statusDraft": "Bozza", "statusPublished": "Pubblicato", "scopeMine": "Visualizzo: i miei", "scopeAll": "Visualizzo: tutti", "edit": "Modifica", "delete": "Elimina", "viewPublic": "Vedi pubblico", "retranslate": "Ritraduci", "retranslateStarted": "Traduzione riavviata. Le lingue si aggiorneranno in background.", "retranslateError": "Impossibile riavviare la traduzione", "refresh": "Aggiorna", "empty": "Non hai ancora articoli. Crea il primo con \"Nuovo articolo\".",
  "deletePostTitle": "Elimina articolo", "deletePostConfirm": "Eliminare l'articolo \"{title}\"? Questa azione non può essere annullata.", "regenConfirmTitle": "Rigenera con l'IA", "regenConfirm": "Questo sostituirà titolo, estratto, contenuto, tag e copertina attuali con una nuova versione generata dall'IA. Continuare?", "deleteCategoryTitle": "Elimina categoria", "deleteCategoryConfirm": "Eliminare la categoria \"{name}\" e tutti i suoi tag?", "deleteTagTitle": "Elimina tag", "deleteTagConfirm": "Eliminare il tag \"{name}\"?",
  "modalNewTitle": "Nuovo articolo", "modalEditTitle": "Modifica articolo", "tabPublish": "Pubblica", "tabCategories": "Categorie", "tabTags": "Tag", "close": "Chiudi", "cancel": "Annulla", "save": "Salva", "saving": "Salvataggio…",
  "fieldTitle": "Titolo", "fieldSlug": "URL pubblico", "fieldSlugHint": "Generato automaticamente dal titolo in inglese se lasciato vuoto.", "publicUrlLabel": "URL pubblico:", "fieldCategory": "Categoria", "selectCategory": "— Seleziona categoria —", "fieldTagsLabel": "Tag", "tagsHintNoCategory": "Seleziona una categoria per vedere i suoi tag.", "tagsHintNoTags": "Questa categoria non ha tag. Aggiungili nella scheda \"Tag\".", "fieldExcerpt": "Estratto", "fieldContent": "Contenuto (Markdown)", "contentHelp": "Scrivi in Markdown: **grassetto**, _corsivo_, # titoli, - elenchi, ![alt](url) immagini.", "contentPlaceholder": "Scrivi il contenuto dell'articolo…", "fieldStatus": "Stato", "fieldLocale": "Lingua base", "fieldCover": "Copertina", "fieldCoverUrl": "URL copertina", "coverUpload": "Carica immagine", "coverUploading": "Caricamento…", "coverRemove": "Rimuovi copertina", "coverEmpty": "Nessuna immagine di copertina", "contentImageUpload": "Inserisci immagine",
  "seoSocialTitle": "SEO e social", "seoTitleLabel": "Meta titolo", "seoDescLabel": "Meta descrizione", "hashtagsLabel": "Hashtag", "hashtagsHint": "Separa con spazi o virgole; il # è facoltativo.", "socialCaptionLabel": "Didascalia per i social", "seoOptimize": "✨ Ottimizza SEO e social (IA)", "seoOptimizing": "Ottimizzazione di SEO e social con l'IA…", "seoDone": "SEO e social generati. Rivedi prima di pubblicare.", "seoError": "Impossibile ottimizzare SEO e social con l'IA.",
  "titleRequired": "Il titolo è obbligatorio (minimo 3 caratteri).", "categoryRequired": "Seleziona una categoria.", "contentRequired": "Il contenuto è obbligatorio.", "uploadError": "Errore durante il caricamento dell'immagine",
  "aiGenerate": "Genera con l'IA", "aiGenerating": "Generazione…", "aiDisabled": "Assistente IA non disponibile", "aiNeedCategory": "Seleziona prima una categoria", "aiTooltip": "Genera bozza con l'IA", "aiStatusStart": "Generazione di testo e immagini con l'IA…", "aiStatusProgress": "Generazione di testo e immagini con l'IA… ({seconds}s)", "aiStatusDone": "Bozza generata. Rivedi e modifica prima di pubblicare.", "aiError": "Impossibile generare la bozza con l'IA.", "aiMinChars": "Lunghezza minima (caratteri)", "aiImageCount": "Numero di immagini", "aiUsageTitle": "Token IA consumati", "aiUsageText": "Testo", "aiUsageImage": "Immagine", "aiUsageTotal": "Totale", "aiUsageInput": "Input", "aiUsageCached": "Cache", "aiUsageOutput": "Output", "aiUsageNote": "\"Cache\" sono token di input serviti dalla cache (inclusi in \"Input\"). Le traduzioni in altre lingue si sommano alla pubblicazione.",
  "catManagerTitle": "Categorie del blog", "catNew": "Nuova categoria", "catAdd": "Aggiungi", "catEmpty": "Ancora nessuna categoria. Crea la prima qui sopra.", "catTagsCount": "{count} tag", "rename": "Rinomina", "renameCategoryPrompt": "Nuovo nome della categoria:", "catCreateError": "Impossibile creare la categoria", "catRenameError": "Impossibile rinominare la categoria", "catDeleteError": "Impossibile eliminare la categoria",
  "tagManagerTitle": "Tag per categoria", "tagSelectCategory": "— Scegli categoria —", "tagPickCategory": "Scegli una categoria per gestire i suoi tag.", "tagNew": "Nuovo tag", "tagAdd": "Aggiungi", "tagEmpty": "Questa categoria non ha tag. Aggiungili qui sopra.", "tagNeedCategory": "Scegli prima una categoria.", "renameTagPrompt": "Nuovo nome del tag:", "tagCreateError": "Impossibile creare il tag", "tagRenameError": "Impossibile rinominare il tag", "tagDeleteError": "Impossibile eliminare il tag",
};

const ru: BlogMessages = {
  "tab": "Блог", "title": "Блог", "subtitle": "Создавайте и управляйте публикациями блога, их категориями и тегами.", "loadError": "Не удалось загрузить публикации", "saveError": "Не удалось сохранить публикацию", "deleteError": "Не удалось удалить публикацию", "actionError": "Не удалось выполнить действие",
  "newPost": "Новая публикация", "colTitle": "Заголовок", "colCategory": "Категория", "colStatus": "Статус", "colTags": "Теги", "colAuthor": "Автор", "colViews": "Просмотры", "colDate": "Дата", "statusDraft": "Черновик", "statusPublished": "Опубликовано", "scopeMine": "Показаны: мои", "scopeAll": "Показаны: все", "edit": "Изменить", "delete": "Удалить", "viewPublic": "Открыть публично", "retranslate": "Перевести заново", "retranslateStarted": "Перевод перезапущен. Языки обновятся в фоновом режиме.", "retranslateError": "Не удалось перезапустить перевод", "refresh": "Обновить", "empty": "У вас пока нет публикаций. Создайте первую кнопкой «Новая публикация».",
  "deletePostTitle": "Удалить публикацию", "deletePostConfirm": "Удалить публикацию «{title}»? Это действие нельзя отменить.", "regenConfirmTitle": "Перегенерировать с ИИ", "regenConfirm": "Это заменит текущий заголовок, отрывок, содержание, теги и обложку новой версией, созданной ИИ. Продолжить?", "deleteCategoryTitle": "Удалить категорию", "deleteCategoryConfirm": "Удалить категорию «{name}» и все её теги?", "deleteTagTitle": "Удалить тег", "deleteTagConfirm": "Удалить тег «{name}»?",
  "modalNewTitle": "Новая публикация", "modalEditTitle": "Изменить публикацию", "tabPublish": "Публикация", "tabCategories": "Категории", "tabTags": "Теги", "close": "Закрыть", "cancel": "Отмена", "save": "Сохранить", "saving": "Сохранение…",
  "fieldTitle": "Заголовок", "fieldSlug": "Публичный URL", "fieldSlugHint": "Генерируется автоматически из английского заголовка, если оставить пустым.", "publicUrlLabel": "Публичный URL:", "fieldCategory": "Категория", "selectCategory": "— Выберите категорию —", "fieldTagsLabel": "Теги", "tagsHintNoCategory": "Выберите категорию, чтобы увидеть её теги.", "tagsHintNoTags": "В этой категории нет тегов. Добавьте их на вкладке «Теги».", "fieldExcerpt": "Отрывок", "fieldContent": "Содержание (Markdown)", "contentHelp": "Пишите в Markdown: **жирный**, _курсив_, # заголовки, - списки, ![alt](url) изображения.", "contentPlaceholder": "Напишите содержание статьи…", "fieldStatus": "Статус", "fieldLocale": "Базовый язык", "fieldCover": "Обложка", "fieldCoverUrl": "URL обложки", "coverUpload": "Загрузить изображение", "coverUploading": "Загрузка…", "coverRemove": "Убрать обложку", "coverEmpty": "Нет изображения обложки", "contentImageUpload": "Вставить изображение",
  "seoSocialTitle": "SEO и соцсети", "seoTitleLabel": "Мета-заголовок", "seoDescLabel": "Мета-описание", "hashtagsLabel": "Хэштеги", "hashtagsHint": "Разделяйте пробелами или запятыми; символ # необязателен.", "socialCaptionLabel": "Подпись для соцсетей", "seoOptimize": "✨ Оптимизировать SEO и соцсети (ИИ)", "seoOptimizing": "Оптимизация SEO и соцсетей с ИИ…", "seoDone": "SEO и соцсети сгенерированы. Проверьте перед публикацией.", "seoError": "Не удалось оптимизировать SEO и соцсети с ИИ.",
  "titleRequired": "Заголовок обязателен (минимум 3 символа).", "categoryRequired": "Выберите категорию.", "contentRequired": "Содержание обязательно.", "uploadError": "Ошибка при загрузке изображения",
  "aiGenerate": "Сгенерировать с ИИ", "aiGenerating": "Генерация…", "aiDisabled": "ИИ-ассистент недоступен", "aiNeedCategory": "Сначала выберите категорию", "aiTooltip": "Сгенерировать черновик с ИИ", "aiStatusStart": "Генерация текста и изображений с ИИ…", "aiStatusProgress": "Генерация текста и изображений с ИИ… ({seconds}с)", "aiStatusDone": "Черновик создан. Проверьте и отредактируйте перед публикацией.", "aiError": "Не удалось сгенерировать черновик с ИИ.", "aiMinChars": "Минимальная длина (символов)", "aiImageCount": "Количество изображений", "aiUsageTitle": "Потрачено токенов ИИ", "aiUsageText": "Текст", "aiUsageImage": "Изображение", "aiUsageTotal": "Итого", "aiUsageInput": "Вход", "aiUsageCached": "Кэш", "aiUsageOutput": "Выход", "aiUsageNote": "«Кэш» — это входные токены, отданные из кэша (входят в «Вход»). Переводы на другие языки добавляются при публикации.",
  "catManagerTitle": "Категории блога", "catNew": "Новая категория", "catAdd": "Добавить", "catEmpty": "Категорий пока нет. Создайте первую выше.", "catTagsCount": "{count} тегов", "rename": "Переименовать", "renameCategoryPrompt": "Новое имя категории:", "catCreateError": "Не удалось создать категорию", "catRenameError": "Не удалось переименовать категорию", "catDeleteError": "Не удалось удалить категорию",
  "tagManagerTitle": "Теги по категориям", "tagSelectCategory": "— Выберите категорию —", "tagPickCategory": "Выберите категорию для управления её тегами.", "tagNew": "Новый тег", "tagAdd": "Добавить", "tagEmpty": "В этой категории нет тегов. Добавьте их выше.", "tagNeedCategory": "Сначала выберите категорию.", "renameTagPrompt": "Новое имя тега:", "tagCreateError": "Не удалось создать тег", "tagRenameError": "Не удалось переименовать тег", "tagDeleteError": "Не удалось удалить тег",
};

const zh: BlogMessages = {
  "tab": "博客", "title": "博客", "subtitle": "创建和管理博客文章、分类和标签。", "loadError": "无法加载文章", "saveError": "无法保存文章", "deleteError": "无法删除文章", "actionError": "无法执行操作",
  "newPost": "新文章", "colTitle": "标题", "colCategory": "分类", "colStatus": "状态", "colTags": "标签", "colAuthor": "作者", "colViews": "浏览量", "colDate": "日期", "statusDraft": "草稿", "statusPublished": "已发布", "scopeMine": "查看：我的", "scopeAll": "查看：全部", "edit": "编辑", "delete": "删除", "viewPublic": "查看公开页", "retranslate": "重新翻译", "retranslateStarted": "已重新开始翻译。其他语言将在后台更新。", "retranslateError": "无法重新开始翻译", "refresh": "刷新", "empty": "您还没有文章。点击「新文章」创建第一篇。",
  "deletePostTitle": "删除文章", "deletePostConfirm": "删除文章「{title}」？此操作无法撤销。", "regenConfirmTitle": "用 AI 重新生成", "regenConfirm": "这将用 AI 生成的新版本替换当前的标题、摘要、内容、标签和封面。是否继续？", "deleteCategoryTitle": "删除分类", "deleteCategoryConfirm": "删除分类「{name}」及其所有标签？", "deleteTagTitle": "删除标签", "deleteTagConfirm": "删除标签「{name}」？",
  "modalNewTitle": "新文章", "modalEditTitle": "编辑文章", "tabPublish": "发布", "tabCategories": "分类", "tabTags": "标签", "close": "关闭", "cancel": "取消", "save": "保存", "saving": "保存中…",
  "fieldTitle": "标题", "fieldSlug": "公开 URL", "fieldSlugHint": "留空时将根据英文标题自动生成。", "publicUrlLabel": "公开 URL：", "fieldCategory": "分类", "selectCategory": "— 选择分类 —", "fieldTagsLabel": "标签", "tagsHintNoCategory": "选择一个分类以查看其标签。", "tagsHintNoTags": "此分类没有标签。请在「标签」选项卡中添加。", "fieldExcerpt": "摘要", "fieldContent": "内容（Markdown）", "contentHelp": "用 Markdown 书写：**粗体**、_斜体_、# 标题、- 列表、![alt](url) 图片。", "contentPlaceholder": "撰写文章内容…", "fieldStatus": "状态", "fieldLocale": "基础语言", "fieldCover": "封面", "fieldCoverUrl": "封面 URL", "coverUpload": "上传图片", "coverUploading": "上传中…", "coverRemove": "移除封面", "coverEmpty": "无封面图片", "contentImageUpload": "插入图片",
  "seoSocialTitle": "SEO 与社交", "seoTitleLabel": "Meta 标题", "seoDescLabel": "Meta 描述", "hashtagsLabel": "话题标签", "hashtagsHint": "用空格或逗号分隔；# 号可选。", "socialCaptionLabel": "社交文案", "seoOptimize": "✨ 用 AI 优化 SEO 与社交", "seoOptimizing": "正在用 AI 优化 SEO 与社交…", "seoDone": "已生成 SEO 与社交内容。发布前请审阅。", "seoError": "无法用 AI 优化 SEO 与社交。",
  "titleRequired": "标题为必填项（至少 3 个字符）。", "categoryRequired": "请选择一个分类。", "contentRequired": "内容为必填项。", "uploadError": "上传图片出错",
  "aiGenerate": "用 AI 生成", "aiGenerating": "生成中…", "aiDisabled": "AI 助手不可用", "aiNeedCategory": "请先选择分类", "aiTooltip": "用 AI 生成草稿", "aiStatusStart": "正在用 AI 生成文本和图片…", "aiStatusProgress": "正在用 AI 生成文本和图片…（{seconds} 秒）", "aiStatusDone": "草稿已生成。发布前请审阅并调整。", "aiError": "无法用 AI 生成草稿。", "aiMinChars": "最小长度（字符）", "aiImageCount": "图片数量", "aiUsageTitle": "已消耗的 AI 令牌", "aiUsageText": "文本", "aiUsageImage": "图片", "aiUsageTotal": "总计", "aiUsageInput": "输入", "aiUsageCached": "缓存", "aiUsageOutput": "输出", "aiUsageNote": "「缓存」是从缓存提供的输入令牌（已包含在「输入」中）。发布时会加上对其他语言的翻译。",
  "catManagerTitle": "博客分类", "catNew": "新分类", "catAdd": "添加", "catEmpty": "还没有分类。在上方创建第一个。", "catTagsCount": "{count} 个标签", "rename": "重命名", "renameCategoryPrompt": "新分类名称：", "catCreateError": "无法创建分类", "catRenameError": "无法重命名分类", "catDeleteError": "无法删除分类",
  "tagManagerTitle": "按分类的标签", "tagSelectCategory": "— 选择分类 —", "tagPickCategory": "选择一个分类来管理其标签。", "tagNew": "新标签", "tagAdd": "添加", "tagEmpty": "此分类没有标签。在上方添加。", "tagNeedCategory": "请先选择分类。", "renameTagPrompt": "新标签名称：", "tagCreateError": "无法创建标签", "tagRenameError": "无法重命名标签", "tagDeleteError": "无法删除标签",
};

const ko: BlogMessages = {
  "tab": "블로그", "title": "블로그", "subtitle": "블로그 게시물과 카테고리, 태그를 만들고 관리하세요.", "loadError": "게시물을 불러올 수 없습니다", "saveError": "게시물을 저장할 수 없습니다", "deleteError": "게시물을 삭제할 수 없습니다", "actionError": "작업을 실행할 수 없습니다",
  "newPost": "새 게시물", "colTitle": "제목", "colCategory": "카테고리", "colStatus": "상태", "colTags": "태그", "colAuthor": "작성자", "colViews": "조회수", "colDate": "날짜", "statusDraft": "초안", "statusPublished": "게시됨", "scopeMine": "보기: 내 것", "scopeAll": "보기: 전체", "edit": "편집", "delete": "삭제", "viewPublic": "공개 보기", "retranslate": "다시 번역", "retranslateStarted": "번역을 다시 시작했습니다. 다른 언어는 백그라운드에서 업데이트됩니다.", "retranslateError": "번역을 다시 시작할 수 없습니다", "refresh": "새로고침", "empty": "아직 게시물이 없습니다. 「새 게시물」로 첫 게시물을 만드세요.",
  "deletePostTitle": "게시물 삭제", "deletePostConfirm": "「{title}」 게시물을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.", "regenConfirmTitle": "AI로 다시 생성", "regenConfirm": "현재 제목, 요약, 내용, 태그, 표지가 AI가 생성한 새 버전으로 대체됩니다. 계속하시겠습니까?", "deleteCategoryTitle": "카테고리 삭제", "deleteCategoryConfirm": "「{name}」 카테고리와 모든 태그를 삭제하시겠습니까?", "deleteTagTitle": "태그 삭제", "deleteTagConfirm": "「{name}」 태그를 삭제하시겠습니까?",
  "modalNewTitle": "새 게시물", "modalEditTitle": "게시물 편집", "tabPublish": "게시", "tabCategories": "카테고리", "tabTags": "태그", "close": "닫기", "cancel": "취소", "save": "저장", "saving": "저장 중…",
  "fieldTitle": "제목", "fieldSlug": "공개 URL", "fieldSlugHint": "비워 두면 영어 제목을 기준으로 자동 생성됩니다.", "publicUrlLabel": "공개 URL:", "fieldCategory": "카테고리", "selectCategory": "— 카테고리 선택 —", "fieldTagsLabel": "태그", "tagsHintNoCategory": "태그를 보려면 카테고리를 선택하세요.", "tagsHintNoTags": "이 카테고리에는 태그가 없습니다. 「태그」 탭에서 추가하세요.", "fieldExcerpt": "요약", "fieldContent": "내용 (Markdown)", "contentHelp": "Markdown으로 작성: **굵게**, _기울임_, # 제목, - 목록, ![alt](url) 이미지.", "contentPlaceholder": "기사 내용을 작성하세요…", "fieldStatus": "상태", "fieldLocale": "기본 언어", "fieldCover": "표지", "fieldCoverUrl": "표지 URL", "coverUpload": "이미지 업로드", "coverUploading": "업로드 중…", "coverRemove": "표지 제거", "coverEmpty": "표지 이미지 없음", "contentImageUpload": "이미지 삽입",
  "seoSocialTitle": "SEO 및 소셜", "seoTitleLabel": "메타 제목", "seoDescLabel": "메타 설명", "hashtagsLabel": "해시태그", "hashtagsHint": "공백이나 쉼표로 구분하세요. #은 선택 사항입니다.", "socialCaptionLabel": "소셜 캡션", "seoOptimize": "✨ AI로 SEO 및 소셜 최적화", "seoOptimizing": "AI로 SEO 및 소셜 최적화 중…", "seoDone": "SEO 및 소셜이 생성되었습니다. 게시 전에 검토하세요.", "seoError": "AI로 SEO 및 소셜을 최적화할 수 없습니다.",
  "titleRequired": "제목은 필수입니다 (최소 3자).", "categoryRequired": "카테고리를 선택하세요.", "contentRequired": "내용은 필수입니다.", "uploadError": "이미지 업로드 오류",
  "aiGenerate": "AI로 생성", "aiGenerating": "생성 중…", "aiDisabled": "AI 어시스턴트를 사용할 수 없습니다", "aiNeedCategory": "먼저 카테고리를 선택하세요", "aiTooltip": "AI로 초안 생성", "aiStatusStart": "AI로 텍스트와 이미지 생성 중…", "aiStatusProgress": "AI로 텍스트와 이미지 생성 중… ({seconds}초)", "aiStatusDone": "초안이 생성되었습니다. 게시 전에 검토하고 조정하세요.", "aiError": "AI로 초안을 생성할 수 없습니다.", "aiMinChars": "최소 길이 (문자)", "aiImageCount": "이미지 수", "aiUsageTitle": "소비된 AI 토큰", "aiUsageText": "텍스트", "aiUsageImage": "이미지", "aiUsageTotal": "합계", "aiUsageInput": "입력", "aiUsageCached": "캐시", "aiUsageOutput": "출력", "aiUsageNote": "「캐시」는 캐시에서 제공된 입력 토큰입니다 (「입력」에 포함). 다른 언어로의 번역은 게시 시 합산됩니다.",
  "catManagerTitle": "블로그 카테고리", "catNew": "새 카테고리", "catAdd": "추가", "catEmpty": "아직 카테고리가 없습니다. 위에서 첫 카테고리를 만드세요.", "catTagsCount": "태그 {count}개", "rename": "이름 변경", "renameCategoryPrompt": "새 카테고리 이름:", "catCreateError": "카테고리를 만들 수 없습니다", "catRenameError": "카테고리 이름을 변경할 수 없습니다", "catDeleteError": "카테고리를 삭제할 수 없습니다",
  "tagManagerTitle": "카테고리별 태그", "tagSelectCategory": "— 카테고리 선택 —", "tagPickCategory": "태그를 관리할 카테고리를 선택하세요.", "tagNew": "새 태그", "tagAdd": "추가", "tagEmpty": "이 카테고리에는 태그가 없습니다. 위에서 추가하세요.", "tagNeedCategory": "먼저 카테고리를 선택하세요.", "renameTagPrompt": "새 태그 이름:", "tagCreateError": "태그를 만들 수 없습니다", "tagRenameError": "태그 이름을 변경할 수 없습니다", "tagDeleteError": "태그를 삭제할 수 없습니다",
};

const ja: BlogMessages = {
  "tab": "ブログ", "title": "ブログ", "subtitle": "ブログ記事とカテゴリ、タグを作成・管理します。", "loadError": "記事を読み込めませんでした", "saveError": "記事を保存できませんでした", "deleteError": "記事を削除できませんでした", "actionError": "操作を実行できませんでした",
  "newPost": "新規記事", "colTitle": "タイトル", "colCategory": "カテゴリ", "colStatus": "ステータス", "colTags": "タグ", "colAuthor": "著者", "colViews": "閲覧数", "colDate": "日付", "statusDraft": "下書き", "statusPublished": "公開済み", "scopeMine": "表示：自分", "scopeAll": "表示：すべて", "edit": "編集", "delete": "削除", "viewPublic": "公開ページを見る", "retranslate": "再翻訳", "retranslateStarted": "翻訳を再開しました。他の言語はバックグラウンドで更新されます。", "retranslateError": "翻訳を再開できませんでした", "refresh": "更新", "empty": "まだ記事がありません。「新規記事」で最初の記事を作成しましょう。",
  "deletePostTitle": "記事を削除", "deletePostConfirm": "記事「{title}」を削除しますか？この操作は元に戻せません。", "regenConfirmTitle": "AIで再生成", "regenConfirm": "現在のタイトル、要約、本文、タグ、カバーがAIが生成した新しいバージョンに置き換えられます。続行しますか？", "deleteCategoryTitle": "カテゴリを削除", "deleteCategoryConfirm": "カテゴリ「{name}」とそのすべてのタグを削除しますか？", "deleteTagTitle": "タグを削除", "deleteTagConfirm": "タグ「{name}」を削除しますか？",
  "modalNewTitle": "新規記事", "modalEditTitle": "記事を編集", "tabPublish": "公開", "tabCategories": "カテゴリ", "tabTags": "タグ", "close": "閉じる", "cancel": "キャンセル", "save": "保存", "saving": "保存中…",
  "fieldTitle": "タイトル", "fieldSlug": "公開URL", "fieldSlugHint": "空欄の場合は英語タイトルから自動生成されます。", "publicUrlLabel": "公開URL：", "fieldCategory": "カテゴリ", "selectCategory": "— カテゴリを選択 —", "fieldTagsLabel": "タグ", "tagsHintNoCategory": "タグを表示するにはカテゴリを選択してください。", "tagsHintNoTags": "このカテゴリにはタグがありません。「タグ」タブで追加してください。", "fieldExcerpt": "要約", "fieldContent": "本文（Markdown）", "contentHelp": "Markdownで記述：**太字**、_斜体_、# 見出し、- リスト、![alt](url) 画像。", "contentPlaceholder": "記事の本文を書いてください…", "fieldStatus": "ステータス", "fieldLocale": "基準言語", "fieldCover": "カバー", "fieldCoverUrl": "カバーURL", "coverUpload": "画像をアップロード", "coverUploading": "アップロード中…", "coverRemove": "カバーを削除", "coverEmpty": "カバー画像なし", "contentImageUpload": "画像を挿入",
  "seoSocialTitle": "SEOとSNS", "seoTitleLabel": "メタタイトル", "seoDescLabel": "メタディスクリプション", "hashtagsLabel": "ハッシュタグ", "hashtagsHint": "スペースまたはカンマで区切ります。# は任意です。", "socialCaptionLabel": "SNS用キャプション", "seoOptimize": "✨ AIでSEOとSNSを最適化", "seoOptimizing": "AIでSEOとSNSを最適化中…", "seoDone": "SEOとSNSを生成しました。公開前に確認してください。", "seoError": "AIでSEOとSNSを最適化できませんでした。",
  "titleRequired": "タイトルは必須です（3文字以上）。", "categoryRequired": "カテゴリを選択してください。", "contentRequired": "本文は必須です。", "uploadError": "画像のアップロードエラー",
  "aiGenerate": "AIで生成", "aiGenerating": "生成中…", "aiDisabled": "AIアシスタントは利用できません", "aiNeedCategory": "まずカテゴリを選択してください", "aiTooltip": "AIで下書きを生成", "aiStatusStart": "AIでテキストと画像を生成中…", "aiStatusProgress": "AIでテキストと画像を生成中…（{seconds}秒）", "aiStatusDone": "下書きを生成しました。公開前に確認・調整してください。", "aiError": "AIで下書きを生成できませんでした。", "aiMinChars": "最小文字数", "aiImageCount": "画像の数", "aiUsageTitle": "消費したAIトークン", "aiUsageText": "テキスト", "aiUsageImage": "画像", "aiUsageTotal": "合計", "aiUsageInput": "入力", "aiUsageCached": "キャッシュ", "aiUsageOutput": "出力", "aiUsageNote": "「キャッシュ」はキャッシュから提供された入力トークンです（「入力」に含まれます）。他言語への翻訳は公開時に加算されます。",
  "catManagerTitle": "ブログのカテゴリ", "catNew": "新規カテゴリ", "catAdd": "追加", "catEmpty": "まだカテゴリがありません。上で最初のものを作成してください。", "catTagsCount": "タグ {count} 件", "rename": "名前を変更", "renameCategoryPrompt": "新しいカテゴリ名：", "catCreateError": "カテゴリを作成できませんでした", "catRenameError": "カテゴリ名を変更できませんでした", "catDeleteError": "カテゴリを削除できませんでした",
  "tagManagerTitle": "カテゴリ別タグ", "tagSelectCategory": "— カテゴリを選択 —", "tagPickCategory": "タグを管理するカテゴリを選択してください。", "tagNew": "新規タグ", "tagAdd": "追加", "tagEmpty": "このカテゴリにはタグがありません。上で追加してください。", "tagNeedCategory": "まずカテゴリを選択してください。", "renameTagPrompt": "新しいタグ名：", "tagCreateError": "タグを作成できませんでした", "tagRenameError": "タグ名を変更できませんでした", "tagDeleteError": "タグを削除できませんでした",
};

const hi: BlogMessages = {
  "tab": "ब्लॉग", "title": "ब्लॉग", "subtitle": "ब्लॉग पोस्ट, उनकी श्रेणियाँ और टैग बनाएँ और प्रबंधित करें।", "loadError": "पोस्ट लोड नहीं हो सके", "saveError": "पोस्ट सहेजी नहीं जा सकी", "deleteError": "पोस्ट हटाई नहीं जा सकी", "actionError": "क्रिया निष्पादित नहीं हो सकी",
  "newPost": "नई पोस्ट", "colTitle": "शीर्षक", "colCategory": "श्रेणी", "colStatus": "स्थिति", "colTags": "टैग", "colAuthor": "लेखक", "colViews": "दृश्य", "colDate": "तिथि", "statusDraft": "मसौदा", "statusPublished": "प्रकाशित", "scopeMine": "देख रहे: मेरी", "scopeAll": "देख रहे: सभी", "edit": "संपादित करें", "delete": "हटाएँ", "viewPublic": "सार्वजनिक देखें", "retranslate": "पुनः अनुवाद करें", "retranslateStarted": "अनुवाद फिर से शुरू हुआ। अन्य भाषाएँ पृष्ठभूमि में अपडेट होंगी।", "retranslateError": "अनुवाद फिर से शुरू नहीं किया जा सका", "refresh": "ताज़ा करें", "empty": "आपके पास अभी कोई पोस्ट नहीं है। «नई पोस्ट» से पहली बनाएँ।",
  "deletePostTitle": "पोस्ट हटाएँ", "deletePostConfirm": "पोस्ट «{title}» हटाएँ? यह क्रिया पूर्ववत नहीं की जा सकती।", "regenConfirmTitle": "AI से पुनः बनाएँ", "regenConfirm": "इससे वर्तमान शीर्षक, सारांश, सामग्री, टैग और कवर AI द्वारा बनाए गए नए संस्करण से बदल जाएँगे। जारी रखें?", "deleteCategoryTitle": "श्रेणी हटाएँ", "deleteCategoryConfirm": "श्रेणी «{name}» और उसके सभी टैग हटाएँ?", "deleteTagTitle": "टैग हटाएँ", "deleteTagConfirm": "टैग «{name}» हटाएँ?",
  "modalNewTitle": "नई पोस्ट", "modalEditTitle": "पोस्ट संपादित करें", "tabPublish": "प्रकाशित करें", "tabCategories": "श्रेणियाँ", "tabTags": "टैग", "close": "बंद करें", "cancel": "रद्द करें", "save": "सहेजें", "saving": "सहेजा जा रहा है…",
  "fieldTitle": "शीर्षक", "fieldSlug": "सार्वजनिक URL", "fieldSlugHint": "खाली छोड़ने पर अंग्रेज़ी शीर्षक से स्वतः बन जाता है।", "publicUrlLabel": "सार्वजनिक URL:", "fieldCategory": "श्रेणी", "selectCategory": "— श्रेणी चुनें —", "fieldTagsLabel": "टैग", "tagsHintNoCategory": "इसके टैग देखने के लिए एक श्रेणी चुनें।", "tagsHintNoTags": "इस श्रेणी में कोई टैग नहीं है। उन्हें «टैग» टैब में जोड़ें।", "fieldExcerpt": "सारांश", "fieldContent": "सामग्री (Markdown)", "contentHelp": "Markdown में लिखें: **बोल्ड**, _इटैलिक_, # शीर्षक, - सूचियाँ, ![alt](url) छवियाँ।", "contentPlaceholder": "लेख की सामग्री लिखें…", "fieldStatus": "स्थिति", "fieldLocale": "आधार भाषा", "fieldCover": "कवर", "fieldCoverUrl": "कवर URL", "coverUpload": "छवि अपलोड करें", "coverUploading": "अपलोड हो रहा है…", "coverRemove": "कवर हटाएँ", "coverEmpty": "कोई कवर छवि नहीं", "contentImageUpload": "छवि डालें",
  "seoSocialTitle": "SEO और सोशल", "seoTitleLabel": "मेटा शीर्षक", "seoDescLabel": "मेटा विवरण", "hashtagsLabel": "हैशटैग", "hashtagsHint": "स्पेस या कॉमा से अलग करें; # वैकल्पिक है।", "socialCaptionLabel": "सोशल कैप्शन", "seoOptimize": "✨ AI से SEO और सोशल अनुकूलित करें", "seoOptimizing": "AI से SEO और सोशल अनुकूलित किया जा रहा है…", "seoDone": "SEO और सोशल बन गए। प्रकाशित करने से पहले समीक्षा करें।", "seoError": "AI से SEO और सोशल अनुकूलित नहीं किया जा सका।",
  "titleRequired": "शीर्षक आवश्यक है (न्यूनतम 3 अक्षर)।", "categoryRequired": "एक श्रेणी चुनें।", "contentRequired": "सामग्री आवश्यक है।", "uploadError": "छवि अपलोड करने में त्रुटि",
  "aiGenerate": "AI से बनाएँ", "aiGenerating": "बनाया जा रहा है…", "aiDisabled": "AI सहायक उपलब्ध नहीं", "aiNeedCategory": "पहले एक श्रेणी चुनें", "aiTooltip": "AI से मसौदा बनाएँ", "aiStatusStart": "AI से टेक्स्ट और छवियाँ बनाई जा रही हैं…", "aiStatusProgress": "AI से टेक्स्ट और छवियाँ बनाई जा रही हैं… ({seconds}से)", "aiStatusDone": "मसौदा बन गया। प्रकाशित करने से पहले समीक्षा करें और समायोजित करें।", "aiError": "AI से मसौदा नहीं बनाया जा सका।", "aiMinChars": "न्यूनतम लंबाई (अक्षर)", "aiImageCount": "छवियों की संख्या", "aiUsageTitle": "उपयोग किए गए AI टोकन", "aiUsageText": "टेक्स्ट", "aiUsageImage": "छवि", "aiUsageTotal": "कुल", "aiUsageInput": "इनपुट", "aiUsageCached": "कैश", "aiUsageOutput": "आउटपुट", "aiUsageNote": "«कैश» कैश से दिए गए इनपुट टोकन हैं («इनपुट» में शामिल)। अन्य भाषाओं में अनुवाद प्रकाशन पर जोड़े जाते हैं।",
  "catManagerTitle": "ब्लॉग श्रेणियाँ", "catNew": "नई श्रेणी", "catAdd": "जोड़ें", "catEmpty": "अभी कोई श्रेणी नहीं है। ऊपर पहली बनाएँ।", "catTagsCount": "{count} टैग", "rename": "नाम बदलें", "renameCategoryPrompt": "नई श्रेणी का नाम:", "catCreateError": "श्रेणी नहीं बनाई जा सकी", "catRenameError": "श्रेणी का नाम नहीं बदला जा सका", "catDeleteError": "श्रेणी नहीं हटाई जा सकी",
  "tagManagerTitle": "श्रेणी के अनुसार टैग", "tagSelectCategory": "— श्रेणी चुनें —", "tagPickCategory": "इसके टैग प्रबंधित करने के लिए एक श्रेणी चुनें।", "tagNew": "नया टैग", "tagAdd": "जोड़ें", "tagEmpty": "इस श्रेणी में कोई टैग नहीं है। उन्हें ऊपर जोड़ें।", "tagNeedCategory": "पहले एक श्रेणी चुनें।", "renameTagPrompt": "नए टैग का नाम:", "tagCreateError": "टैग नहीं बनाया जा सका", "tagRenameError": "टैग का नाम नहीं बदला जा सका", "tagDeleteError": "टैग नहीं हटाया जा सका",
};

const ar: BlogMessages = {
  "tab": "المدونة", "title": "المدونة", "subtitle": "أنشئ وأدِر منشورات المدونة وفئاتها ووسومها.", "loadError": "تعذّر تحميل المنشورات", "saveError": "تعذّر حفظ المنشور", "deleteError": "تعذّر حذف المنشور", "actionError": "تعذّر تنفيذ الإجراء",
  "newPost": "منشور جديد", "colTitle": "العنوان", "colCategory": "الفئة", "colStatus": "الحالة", "colTags": "الوسوم", "colAuthor": "الكاتب", "colViews": "المشاهدات", "colDate": "التاريخ", "statusDraft": "مسودة", "statusPublished": "منشور", "scopeMine": "العرض: منشوراتي", "scopeAll": "العرض: الكل", "edit": "تعديل", "delete": "حذف", "viewPublic": "عرض عام", "retranslate": "إعادة الترجمة", "retranslateStarted": "أُعيد تشغيل الترجمة. ستُحدَّث اللغات في الخلفية.", "retranslateError": "تعذّر إعادة تشغيل الترجمة", "refresh": "تحديث", "empty": "ليس لديك منشورات بعد. أنشئ الأول عبر «منشور جديد».",
  "deletePostTitle": "حذف المنشور", "deletePostConfirm": "حذف المنشور «{title}»؟ لا يمكن التراجع عن هذا الإجراء.", "regenConfirmTitle": "إعادة التوليد بالذكاء الاصطناعي", "regenConfirm": "سيؤدي هذا إلى استبدال العنوان والمقتطف والمحتوى والوسوم والغلاف الحالية بنسخة جديدة مولّدة بالذكاء الاصطناعي. المتابعة؟", "deleteCategoryTitle": "حذف الفئة", "deleteCategoryConfirm": "حذف الفئة «{name}» وجميع وسومها؟", "deleteTagTitle": "حذف الوسم", "deleteTagConfirm": "حذف الوسم «{name}»؟",
  "modalNewTitle": "منشور جديد", "modalEditTitle": "تعديل المنشور", "tabPublish": "نشر", "tabCategories": "الفئات", "tabTags": "الوسوم", "close": "إغلاق", "cancel": "إلغاء", "save": "حفظ", "saving": "جارٍ الحفظ…",
  "fieldTitle": "العنوان", "fieldSlug": "الرابط العام", "fieldSlugHint": "يُنشأ تلقائيًا من العنوان الإنجليزي إذا تُرك فارغًا.", "publicUrlLabel": "الرابط العام:", "fieldCategory": "الفئة", "selectCategory": "— اختر فئة —", "fieldTagsLabel": "الوسوم", "tagsHintNoCategory": "اختر فئة لعرض وسومها.", "tagsHintNoTags": "لا توجد وسوم لهذه الفئة. أضِفها في علامة التبويب «الوسوم».", "fieldExcerpt": "المقتطف", "fieldContent": "المحتوى (Markdown)", "contentHelp": "اكتب بصيغة Markdown: **غامق**، _مائل_، # عناوين، - قوائم، ![alt](url) صور.", "contentPlaceholder": "اكتب محتوى المقال…", "fieldStatus": "الحالة", "fieldLocale": "اللغة الأساسية", "fieldCover": "الغلاف", "fieldCoverUrl": "رابط الغلاف", "coverUpload": "رفع صورة", "coverUploading": "جارٍ الرفع…", "coverRemove": "إزالة الغلاف", "coverEmpty": "لا توجد صورة غلاف", "contentImageUpload": "إدراج صورة",
  "seoSocialTitle": "SEO والتواصل الاجتماعي", "seoTitleLabel": "عنوان ميتا", "seoDescLabel": "وصف ميتا", "hashtagsLabel": "الوسوم (هاشتاغ)", "hashtagsHint": "افصل بمسافات أو فواصل؛ علامة # اختيارية.", "socialCaptionLabel": "تعليق للتواصل الاجتماعي", "seoOptimize": "✨ تحسين SEO والتواصل (بالذكاء الاصطناعي)", "seoOptimizing": "جارٍ تحسين SEO والتواصل بالذكاء الاصطناعي…", "seoDone": "تم توليد SEO والتواصل. راجِع قبل النشر.", "seoError": "تعذّر تحسين SEO والتواصل بالذكاء الاصطناعي.",
  "titleRequired": "العنوان مطلوب (3 أحرف على الأقل).", "categoryRequired": "اختر فئة.", "contentRequired": "المحتوى مطلوب.", "uploadError": "خطأ في رفع الصورة",
  "aiGenerate": "التوليد بالذكاء الاصطناعي", "aiGenerating": "جارٍ التوليد…", "aiDisabled": "مساعد الذكاء الاصطناعي غير متاح", "aiNeedCategory": "اختر فئة أولاً", "aiTooltip": "توليد مسودة بالذكاء الاصطناعي", "aiStatusStart": "جارٍ توليد النص والصور بالذكاء الاصطناعي…", "aiStatusProgress": "جارٍ توليد النص والصور بالذكاء الاصطناعي… ({seconds}ث)", "aiStatusDone": "تم توليد المسودة. راجِعها وعدِّلها قبل النشر.", "aiError": "تعذّر توليد المسودة بالذكاء الاصطناعي.", "aiMinChars": "الحد الأدنى للطول (أحرف)", "aiImageCount": "عدد الصور", "aiUsageTitle": "رموز الذكاء الاصطناعي المستهلكة", "aiUsageText": "نص", "aiUsageImage": "صورة", "aiUsageTotal": "الإجمالي", "aiUsageInput": "الإدخال", "aiUsageCached": "ذاكرة مؤقتة", "aiUsageOutput": "الإخراج", "aiUsageNote": "«الذاكرة المؤقتة» هي رموز إدخال مُقدّمة من الذاكرة المؤقتة (مضمّنة في «الإدخال»). تُضاف الترجمات إلى اللغات الأخرى عند النشر.",
  "catManagerTitle": "فئات المدونة", "catNew": "فئة جديدة", "catAdd": "إضافة", "catEmpty": "لا توجد فئات بعد. أنشئ الأولى في الأعلى.", "catTagsCount": "{count} وسوم", "rename": "إعادة تسمية", "renameCategoryPrompt": "اسم الفئة الجديد:", "catCreateError": "تعذّر إنشاء الفئة", "catRenameError": "تعذّر إعادة تسمية الفئة", "catDeleteError": "تعذّر حذف الفئة",
  "tagManagerTitle": "الوسوم حسب الفئة", "tagSelectCategory": "— اختر فئة —", "tagPickCategory": "اختر فئة لإدارة وسومها.", "tagNew": "وسم جديد", "tagAdd": "إضافة", "tagEmpty": "لا توجد وسوم لهذه الفئة. أضِفها في الأعلى.", "tagNeedCategory": "اختر فئة أولاً.", "renameTagPrompt": "اسم الوسم الجديد:", "tagCreateError": "تعذّر إنشاء الوسم", "tagRenameError": "تعذّر إعادة تسمية الوسم", "tagDeleteError": "تعذّر حذف الوسم",
};

export const blog: Record<LocaleCode, BlogMessages> = { es, en, fr, pt, it, ru, zh, ko, ja, hi, ar };
