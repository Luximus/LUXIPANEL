const modules = {
  "pageTitle": "Moduli",
  "header": {
    "heading": "Moduli e integrazioni",
    "subheading": "Attiva o nascondi i moduli preinstallati che appaiono nel menu laterale"
  },
  "search": {
    "placeholder": "Cerca modulo..."
  },
  "tabs": {
    "all": "Tutti",
    "modules": "Moduli",
    "integrations": "Integrazioni",
    "visible": "Visibili"
  },
  "stats": {
    "visible": "Visibili:",
    "hidden": "Nascosti:",
    "systemNote": "I moduli di sistema rimangono preinstallati"
  },
  "categories": {
    "label": "Categorie",
    "all": "Tutte",
    "communication": "Comunicazione",
    "infrastructure": "Infrastruttura",
    "security": "Sicurezza",
    "developer": "Sviluppatore"
  },
  "statusFilter": {
    "label": "Stato",
    "all": "Tutti",
    "visible": "Visibili",
    "hidden": "Nascosti"
  },
  "empty": {
    "title": "Nessun modulo trovato",
    "subtitle": "Prova con un altro termine di ricerca o categoria"
  },
  "errors": {
    "loadTitle": "Errore nel caricamento dei moduli",
    "loadSubtitle": "Impossibile ottenere l'elenco dei moduli"
  },
  "labels": {
    "metaVersion": "Versione",
    "metaInstalls": "Installazioni",
    "metaRating": "Valutazione",
    "metaAuthor": "Autore",
    "metaCreatedAt": "Data di creazione",
    "metaUpdatedAt": "Ultimo aggiornamento",
    "kindIntegration": "INTEGRAZIONE",
    "kindModule": "MODULO",
    "tagFree": "Gratuito",
    "tagLicense": "Licenza richiesta",
    "statusVisible": "Visibile nel menu",
    "statusHidden": "Nascosto",
    "dragHandle": "Trascinare per riordinare",
    "menuToggle": "Mostra nel menu laterale",
    "moduleToggle": "Abilita modulo",
    "fabToggle": "Mostra pulsante mobile"
  },
  "toasts": {
    "moduleVisible": "{name} visibile",
    "moduleHidden": "{name} nascosto",
    "moduleVisibleWithDeps": "{name} visibile (anche abilitati: {deps})",
    "moduleHiddenWithDeps": "{name} nascosto (anche abilitati: {deps})",
    "moduleUpdateError": "Impossibile aggiornare {name}",
    "sidebarShown": "{name} appare nel menu",
    "sidebarHidden": "{name} nascosto dal menu",
    "fabShown": "{name}: pulsante mobile attivato",
    "fabHidden": "{name}: pulsante mobile disattivato",
    "orderSaved": "Ordine aggiornato",
    "orderError": "Impossibile salvare l'ordine",
    "orderHttpError": "Impossibile salvare l'ordine ({status})"
  }
} as const;

export default modules;
