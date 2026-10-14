const modules = {
  "pageTitle": "Modules",
  "header": {
    "heading": "Modules and integrations",
    "subheading": "Enable or hide the pre-installed modules that appear in the side menu"
  },
  "search": {
    "placeholder": "Search module..."
  },
  "tabs": {
    "all": "All",
    "modules": "Modules",
    "integrations": "Integrations",
    "visible": "Visible"
  },
  "stats": {
    "visible": "Visible:",
    "hidden": "Hidden:",
    "systemNote": "System modules remain pre-installed"
  },
  "categories": {
    "label": "Categories",
    "all": "All",
    "communication": "Communication",
    "infrastructure": "Infrastructure",
    "security": "Security",
    "developer": "Developer"
  },
  "statusFilter": {
    "label": "Status",
    "all": "All",
    "visible": "Visible",
    "hidden": "Hidden"
  },
  "empty": {
    "title": "No modules found",
    "subtitle": "Try another search term or category"
  },
  "errors": {
    "loadTitle": "Error loading modules",
    "loadSubtitle": "Could not get the list of modules"
  },
  "labels": {
    "metaVersion": "Version",
    "metaInstalls": "Installs",
    "metaRating": "Rating",
    "metaAuthor": "Author",
    "metaCreatedAt": "Creation date",
    "metaUpdatedAt": "Last updated",
    "kindIntegration": "INTEGRATION",
    "kindModule": "MODULE",
    "tagFree": "Free",
    "tagLicense": "License required",
    "statusVisible": "Visible in menu",
    "statusHidden": "Hidden",
    "dragHandle": "Drag to reorder",
    "menuToggle": "Show in sidebar",
    "moduleToggle": "Enable module",
    "fabToggle": "Show floating button"
  },
  "toasts": {
    "moduleVisible": "{name} visible",
    "moduleHidden": "{name} hidden",
    "moduleVisibleWithDeps": "{name} visible (also enabled: {deps})",
    "moduleHiddenWithDeps": "{name} hidden (also enabled: {deps})",
    "moduleUpdateError": "Could not update {name}",
    "sidebarShown": "{name} appears in the menu",
    "sidebarHidden": "{name} hidden from the menu",
    "fabShown": "{name}: floating button enabled",
    "fabHidden": "{name}: floating button disabled",
    "orderSaved": "Order updated",
    "orderError": "Could not save order",
    "orderHttpError": "Could not save order ({status})"
  }
} as const;

export default modules;
