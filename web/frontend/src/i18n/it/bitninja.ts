const bitninja = {
  "header": {
    "description": "Agente di sicurezza completo (WAF, anti-DoS, rilevamento malware e reputazione IP) sul server connesso.",
    "statusChecking": "verifica..."
  },
  "sudo": {
    "label": "Password sudo (passphrase della tua sessione)",
    "placeholder": "Solo se il server lo richiede per sudo",
    "hint": "Viene utilizzato solo per questa azione e mai salvato nel browser."
  },
  "installCard": {
    "title": "BitNinja non è installato",
    "description": "Inserisci la chiave di licenza del tuo account BitNinja per installare l'agente su questo server. L'installer ufficiale (get.bitninja.io) viene scaricato ed eseguito con sudo.",
    "licensePlaceholder": "License key (es: ab12cd34-…)",
    "installButton": "Installa BitNinja"
  },
  "stats": {
    "service": "Servizio",
    "license": "Licenza",
    "version": "Versione"
  },
  "serviceControl": {
    "title": "Controllo servizio",
    "start": "Avvia",
    "restart": "Riavvia",
    "stop": "Arresta"
  },
  "components": {
    "title": "Componenti di protezione",
    "checking": "verifica...",
    "noReported": "L'agente non ha riportato componenti.",
    "active": "Attivo",
    "inactive": "Inattivo"
  },
  "updateLicense": {
    "title": "Aggiorna chiave di licenza",
    "placeholder": "Nuova chiave di licenza",
    "applyButton": "Applicare"
  },
  "toasts": {
    "sudoRequired": "Inserisci la tua password sudo e riprova.",
    "sudoInvalid": "Password sudo non valida.",
    "actionFailed": "Azione fallita. Controlla l'output.",
    "installing": "Installazione di BitNinja in corso… potrebbe durare alcuni minuti.",
    "installed": "BitNinja installato.",
    "serviceAction": "Servizio: {action} OK.",
    "componentToggleEnabled": "{component}: abilitato.",
    "componentToggleDisabled": "{component}: disabilitato.",
    "licenseApplied": "License key applicata."
  },
  "errors": {
    "unknown": "Errore sconosciuto"
  },
  "status": {
    "notInstalled": "Non installato",
    "running": "Attivo",
    "installedStopped": "Installato (fermato)",
    "serviceRunning": "In esecuzione",
    "serviceStopped": "Fermato",
    "licenseValid": "Valida",
    "licenseReview": "Rivedi"
  },
  "validation": {
    "licenseKeyRequired": "Inserisci la license key.",
    "newLicenseKeyRequired": "Inserisci la nuova license key."
  },
  "settingsUi": {
    "settingsTitle": "Impostazioni BitNinja",
    "settingsButton": "Impostazioni",
    "settingsDescription": "Preferenze di diagnosi per il server attivo.",
    "settingsSections": "Sezioni delle impostazioni BitNinja",
    "diagnostics": "Diagnosi",
    "related": "Correlati",
    "logSource": "Il log viene letto dal servizio BitNinja del server selezionato.",
    "autoRefresh": "Aggiorna lo stato ogni 30 secondi",
    "logLines": "Righe del log",
    "relatedModules": "Moduli correlati",
    "firewallAudit": "Firewall e verifica",
    "credentials": "Credenziali BitNinja"
  },
  "logsUi": {
    "loading": "Caricamento del registro…",
    "empty": "Nessun evento recente.",
    "loadError": "Impossibile caricare il registro.",
    "logsTitle": "Log recente",
    "logsDescription": "Eventi del servizio sul server attivo.",
    "refreshLogs": "Aggiorna log",
    "logsHint": "Seleziona «Aggiorna log» per caricare gli eventi."
  }
} as const;

export default bitninja;
