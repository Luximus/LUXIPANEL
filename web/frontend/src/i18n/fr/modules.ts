const modules = {
  "pageTitle": "Modules",
  "header": {
    "heading": "Modules et intégrations",
    "subheading": "Activez ou masquez les modules préinstallés qui apparaissent dans le menu latéral"
  },
  "search": {
    "placeholder": "Rechercher un module..."
  },
  "tabs": {
    "all": "Tous",
    "modules": "Modules",
    "integrations": "Intégrations",
    "visible": "Visibles"
  },
  "stats": {
    "visible": "Visibles :",
    "hidden": "Masqués :",
    "systemNote": "Les modules système restent préinstallés"
  },
  "categories": {
    "label": "Catégories",
    "all": "Toutes",
    "communication": "Communication",
    "infrastructure": "Infrastructure",
    "security": "Sécurité",
    "developer": "Développeur"
  },
  "statusFilter": {
    "label": "État",
    "all": "Tous",
    "visible": "Visibles",
    "hidden": "Masqués"
  },
  "empty": {
    "title": "Aucun module trouvé",
    "subtitle": "Essayez un autre terme de recherche ou une autre catégorie"
  },
  "errors": {
    "loadTitle": "Erreur lors du chargement des modules",
    "loadSubtitle": "Impossible d'obtenir la liste des modules"
  },
  "labels": {
    "metaVersion": "Version",
    "metaInstalls": "Installations",
    "metaRating": "Évaluation",
    "metaAuthor": "Auteur",
    "metaCreatedAt": "Date de création",
    "metaUpdatedAt": "Dernière mise à jour",
    "kindIntegration": "INTÉGRATION",
    "kindModule": "MODULE",
    "tagFree": "Gratuit",
    "tagLicense": "Licence requise",
    "statusVisible": "Visible dans le menu",
    "statusHidden": "Caché",
    "dragHandle": "Faites glisser pour réorganiser",
    "menuToggle": "Afficher dans le menu latéral",
    "moduleToggle": "Activer le module",
    "fabToggle": "Afficher le bouton flottant"
  },
  "toasts": {
    "moduleVisible": "{name} visible",
    "moduleHidden": "{name} caché",
    "moduleVisibleWithDeps": "{name} visible (également activé : {deps})",
    "moduleHiddenWithDeps": "{name} caché (également activé : {deps})",
    "moduleUpdateError": "Impossible de mettre à jour {name}",
    "sidebarShown": "{name} apparaît dans le menu",
    "sidebarHidden": "{name} masqué du menu",
    "fabShown": "{name} : bouton flottant activé",
    "fabHidden": "{name} : bouton flottant désactivé",
    "orderSaved": "Ordre mis à jour",
    "orderError": "Impossible d'enregistrer l'ordre",
    "orderHttpError": "Impossible d'enregistrer l'ordre ({status})"
  }
} as const;

export default modules;
