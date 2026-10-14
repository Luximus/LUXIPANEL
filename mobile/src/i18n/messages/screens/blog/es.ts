import type { Widen } from "../../_shared";

// Blog del portal (sección de Administración). Español es la fuente de verdad;
// el resto se valida contra `Widen<typeof es>`, así faltantes/extra surgen como
// errores de TS. Replica la superficie de portal-blog.ts (editor + categorías/
// tags + borrador IA + subida de imágenes).
export const es = {
  // Hub / sección
  "sectionBlog": "Blog",
  "blogDesc": "Publicaciones, categorías y tags",
  "blogTitle": "Blog",

  // Comunes
  "back": "Volver",
  "cancel": "Cancelar",
  "save": "Guardar",
  "create": "Crear",
  "edit": "Editar",
  "delete": "Eliminar",
  "close": "Cerrar",
  "retry": "Reintentar",
  "search": "Buscar...",
  "saveError": "No se pudo guardar",
  "loadError": "No se pudo cargar la información",
  "empty": "Aún no tienes publicaciones. Crea la primera.",

  // Scope
  "scopeMine": "Viendo: las mías",
  "scopeAll": "Viendo: todas",

  // Estado / badges
  "statusDraft": "Borrador",
  "statusPublished": "Publicado",
  "statusLabel": "Estado",
  "views": "{count} vistas",

  // Lista
  "newPost": "Nueva publicación",
  "noCover": "Sin portada",
  "byAuthor": "por {name}",

  // Editor: campos
  "editorCreateTitle": "Nueva publicación",
  "editorEditTitle": "Editar publicación",
  "fieldTitle": "Título",
  "fieldSlug": "URL pública",
  "fieldSlugHint": "Déjala vacía para generarla automáticamente desde el título.",
  "slugUrlLabel": "Se verá en",
  "fieldCategory": "Categoría",
  "fieldCategoryPlaceholder": "— Selecciona categoría —",
  "fieldTags": "Tags",
  "fieldExcerpt": "Extracto",
  "fieldContent": "Contenido",
  "fieldContentHelp": "Admite Markdown: **negrita**, _cursiva_, # títulos, listas y enlaces.",
  "fieldLocale": "Idioma base",
  "fieldCover": "Portada",
  "fieldCoverUrl": "URL de la portada",
  "coverUpload": "Subir imagen",
  "coverRemove": "Quitar portada",
  "tagsNoCategory": "Selecciona una categoría para ver sus tags.",
  "tagsEmpty": "Esta categoría no tiene tags. Añádelos en “Tags”.",

  // Validación
  "titleRequired": "El título es muy corto",
  "categoryRequired": "Selecciona una categoría",
  "contentRequired": "El contenido no puede estar vacío",

  // Subida
  "uploadError": "No se pudo subir la imagen",
  "uploading": "Subiendo imagen…",

  // IA
  "aiGenerate": "Generar con IA",
  "aiGenerating": "Generando…",
  "aiProgress": "Generando texto e imágenes con IA… ({seconds}s)",
  "aiDone": "Borrador generado. Revisa y ajusta antes de publicar.",
  "aiError": "No se pudo generar el borrador con IA.",
  "aiNeedCategory": "Selecciona una categoría primero",
  "aiDisabled": "Asistente IA no disponible",
  "aiReplaceConfirmTitle": "Reemplazar contenido",
  "aiReplaceConfirmMessage": "Esto reemplazará el título, resumen, contenido, tags y portada actuales por una nueva versión generada por IA. ¿Continuar?",
  "aiMinChars": "Longitud mínima (caracteres)",
  "aiImageCount": "Número de imágenes",
  "aiUsageTitle": "Tokens IA consumidos",

  // SEO y redes
  "seoSection": "SEO y redes",
  "seoTitleLabel": "Meta título",
  "seoDescriptionLabel": "Meta descripción",
  "seoHashtagsLabel": "Hashtags",
  "seoHashtagsHint": "Separa con espacios o comas. El símbolo # es opcional.",
  "seoCaptionLabel": "Caption para redes",
  "seoGenerate": "✨ Generar SEO y redes (IA)",
  "seoGenerating": "Generando SEO y redes…",
  "seoDone": "SEO y redes generados.",
  "seoError": "No se pudo generar SEO y redes.",
  "seoNeedContent": "Escribe un título y contenido primero",

  // Retraducir
  "retranslate": "Retraducir",
  "retranslateOk": "Retraducción iniciada.",
  "retranslateError": "No se pudo iniciar la retraducción.",

  // Borrar post
  "postDeleteTitle": "Eliminar publicación",
  "postDeleteMessage": "¿Eliminar la publicación “{title}”? Esta acción no se puede deshacer.",

  // Gestión de categorías
  "tabPublish": "Publicar",
  "tabCategories": "Categorías",
  "tabTags": "Tags",
  "categoriesTitle": "Categorías",
  "categoryNewPlaceholder": "Nueva categoría",
  "categoryAdd": "Añadir",
  "categoriesEmpty": "Aún no hay categorías. Crea la primera.",
  "categoryTagsCount": "{count} tags",
  "categoryRename": "Renombrar",
  "categoryNameLabel": "Nombre de la categoría",
  "categoryDeleteTitle": "Eliminar categoría",
  "categoryDeleteMessage": "¿Eliminar la categoría “{name}” y todos sus tags?",
  "categoryError": "No se pudo guardar la categoría",

  // Gestión de tags
  "tagsTitle": "Tags",
  "tagPickCategory": "— Elige categoría —",
  "tagNewPlaceholder": "Nuevo tag",
  "tagAdd": "Añadir",
  "tagsManageEmpty": "Elige una categoría para gestionar sus tags.",
  "tagsCategoryEmpty": "Esta categoría no tiene tags. Añádelos arriba.",
  "tagNameLabel": "Nombre del tag",
  "tagDeleteTitle": "Eliminar tag",
  "tagDeleteMessage": "¿Eliminar el tag “{name}”?",
  "tagError": "No se pudo guardar el tag",
} as const;

export type BlogMessages = Widen<typeof es>;
