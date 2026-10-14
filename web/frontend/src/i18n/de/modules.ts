const modules = {
  "pageTitle": "Module",
  "header": {
    "heading": "Module und Integrationen",
    "subheading": "Aktiviere oder blende vorinstallierte Module aus, die im Seitenmenü erscheinen"
  },
  "search": {
    "placeholder": "Modul suchen..."
  },
  "tabs": {
    "all": "Alle",
    "modules": "Module",
    "integrations": "Integrationen",
    "visible": "Sichtbar"
  },
  "stats": {
    "visible": "Sichtbar:",
    "hidden": "Ausgeblendet:",
    "systemNote": "Systemmodule bleiben vorinstalliert"
  },
  "categories": {
    "label": "Kategorien",
    "all": "Alle",
    "communication": "Kommunikation",
    "infrastructure": "Infrastruktur",
    "security": "Sicherheit",
    "developer": "Entwickler"
  },
  "statusFilter": {
    "label": "Status",
    "all": "Alle",
    "visible": "Sichtbar",
    "hidden": "Ausgeblendet"
  },
  "empty": {
    "title": "Keine Module gefunden",
    "subtitle": "Versuche einen anderen Suchbegriff oder eine andere Kategorie"
  },
  "errors": {
    "loadTitle": "Fehler beim Laden der Module",
    "loadSubtitle": "Modulliste konnte nicht abgerufen werden"
  },
  "labels": {
    "metaVersion": "Version",
    "metaInstalls": "Installationen",
    "metaRating": "Bewertung",
    "metaAuthor": "Autor",
    "metaCreatedAt": "Erstellungsdatum",
    "metaUpdatedAt": "Zuletzt aktualisiert",
    "kindIntegration": "INTEGRATION",
    "kindModule": "MODUL",
    "tagFree": "Kostenlos",
    "tagLicense": "Lizenz erforderlich",
    "statusVisible": "Im Menü sichtbar",
    "statusHidden": "Verborgen",
    "dragHandle": "Zum Neuordnen ziehen",
    "menuToggle": "In der Seitenleiste anzeigen",
    "moduleToggle": "Modul aktivieren",
    "fabToggle": "Schwebende Schaltfläche anzeigen"
  },
  "toasts": {
    "moduleVisible": "{name} sichtbar",
    "moduleHidden": "{name} verborgen",
    "moduleVisibleWithDeps": "{name} sichtbar (auch aktiviert: {deps})",
    "moduleHiddenWithDeps": "{name} verborgen (auch aktiviert: {deps})",
    "moduleUpdateError": "Fehler beim Aktualisieren von {name}",
    "sidebarShown": "{name} erscheint im Menü",
    "sidebarHidden": "{name} aus dem Menü ausgeblendet",
    "fabShown": "{name}: schwebende Schaltfläche aktiviert",
    "fabHidden": "{name}: schwebende Schaltfläche deaktiviert",
    "orderSaved": "Reihenfolge aktualisiert",
    "orderError": "Fehler beim Speichern der Reihenfolge",
    "orderHttpError": "Fehler beim Speichern der Reihenfolge ({status})"
  }
} as const;

export default modules;
