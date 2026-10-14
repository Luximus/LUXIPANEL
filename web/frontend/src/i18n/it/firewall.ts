const firewall = {
  "pageTitle": "Firewall",
  "installWarning": {
    "title": "Componenti del firewall non rilevati",
    "description": "Verrà eseguito il gestore di pacchetti (apt/dnf/apk/...) con configurazione predefinita e i servizi verranno abilitati al termine.",
    "btnInstall": "Installa ora"
  },
  "statusCard": {
    "label": "Stato Firewall (UFW)",
    "verifying": "Verifica in corso...",
    "btnDisable": "Disabilita",
    "btnEnable": "Abilita"
  },
  "securityAudit": {
    "title": "Audit di sicurezza (Premium)",
    "btnStartAudit": "Avvia analisi",
    "scannerChecking": "verifica...",
    "btnInstallScanner": "Installa",
    "scanProgress": "Avanzamento scansione",
    "scanAi": "Analisi IA: 0%",
    "noReports": "Nessun audit completato. Avvia uno nuovo per iniziare."
  },
  "ufwRules": {
    "title": "Regole UFW",
    "btnNewRule": "Nuova regola",
    "loading": "Caricamento regole...",
    "btnAllowCloudflare": "Consenti Cloudflare",
    "searchLabel": "Cerca regola",
    "searchPlaceholder": "Cerca porta, IP o commento…"
  },
  "fail2ban": {
    "btnBanIp": "Banna IP",
    "loading": "Caricamento jail..."
  },
  "ruleDialog": {
    "title": "Nuova regola UFW",
    "labelAction": "Azione",
    "optionAllow": "Consenti",
    "optionDeny": "Nega",
    "optionReject": "Rifiuta",
    "labelProtocol": "Protocollo",
    "optionAny": "Qualsiasi",
    "labelPort": "Porta",
    "placeholderPort": "25 o 8080:8090",
    "labelFromIp": "Da IP",
    "placeholderFromIp": "any o 192.168.0.0/24",
    "labelComment": "Commento (facoltativo)",
    "placeholderComment": "SMTP in entrata",
    "btnCancel": "Annulla",
    "btnAdd": "Aggiungi regola"
  },
  "banDialog": {
    "title": "Banna IP manualmente",
    "labelIp": "Indirizzo IP",
    "placeholderIp": "192.168.1.100",
    "labelJail": "Jail",
    "btnCancel": "Annulla",
    "btnBan": "Banna"
  },
  "auditReportDialog": {
    "title": "Rapporto di audit di sicurezza",
    "btnClose": "Chiudi"
  },
  "aiAssistant": {
    "btnSuggestRules": "Suggerisci regole (IA)",
    "btnSuggestBans": "Suggerisci ban (IA)",
    "btnAnalyze": "Analisi IA",
    "promptUfw": "Analizza il firewall UFW del server connesso: esamina lo stato e le regole attuali (usa lo strumento firewall.ufw_status) e suggerisci regole UFW intelligenti per migliorare la sicurezza senza interrompere i servizi in uso. Per ogni regola proposta spiega il perché e includi l'esatto comando `ufw` per applicarla.",
    "promptFail2ban": "Analizza Fail2ban sul server connesso: esamina le jail configurate e gli IP banditi (usa lo strumento firewall.fail2ban_status) e suggerisci ban e miglioramenti di configurazione per proteggerlo dagli attacchi brute-force. Indica jail, IP/intervallo e motivo, e i comandi per applicarli.",
    "promptAnalyze": "Esegui un'analisi di sicurezza generale del firewall sul server connesso. Esamina lo stato di UFW e Fail2ban (usa gli strumenti firewall.ufw_status e firewall.fail2ban_status), identifica rischi, porte esposte e configurazioni deboli, e fornisci raccomandazioni prioritarie con i comandi per applicarle.",
    "analyzeRule": "Analizza con IA",
    "promptRule": "Analizza questa regola UFW esistente sul server connesso. Spiega quale traffico consente o blocca, valuta i rischi e suggerisci se mantenerla, modificarla o sostituirla. Se proponi modifiche, includi i comandi esatti.\n\nRegola #{number}\nAzione: {action}\nDestinazione/porta: {to}\nOrigine: {from}\nProtocollo: {proto}\nCommento: {comment}"
  },
  "labels": {
    "active": "Attivo",
    "inactive": "Inattivo",
    "bannedCount": "{count} bloccati",
    "moreIps": "+{n} altri",
    "installingText": "Installazione UFW e Fail2ban… potrebbe richiedere alcuni minuti.",
    "installSuccessText": "Firewall installato correttamente.",
    "cfEdgeBlockQuestion": "Bloccare anche {ip} al bordo di Cloudflare?",
    "findingsCount": "{n} risultati trovati",
    "completedAt": "Completato in {time}",
    "scanAiProgress": "Analisi IA: {pct}%",
    "overallRisk": "Rischio generale",
    "unknown": "SCONOSCIUTO",
    "keyThreats": "Minacce principali",
    "recommendations": "Raccomandazioni",
    "findingsTitle": "Risultati ({n})",
    "moreFindingsCount": "+{n} risultati in più",
    "from": "da",
    "any": "qualsiasi",
    "scanBitNinjaProgress": "BitNinja: {pct}%",
    "scanLynisProgress": "Lynis: {pct}%",
    "scanRkhunterProgress": "Rkhunter: {pct}%",
    "scanChkrootkitProgress": "Chkrootkit: {pct}%"
  },
  "empty": {
    "noRules": "Nessuna regola",
    "noJails": "Nessun jail attivo"
  },
  "actions": {
    "unban": "sblocca",
    "blockInCloudflare": "Blocca in Cloudflare",
    "dismiss": "Scarta"
  },
  "confirm": {
    "deleteRuleMsg": "Eliminare la regola #{number}?",
    "deleteRuleTitle": "Elimina regola",
    "disableFwMsg": "Disattivare il firewall? Il server rimarrà senza protezione di rete.",
    "disableFwTitle": "Disattiva firewall",
    "disableFwBtn": "Sì, disattiva",
    "cfAllowMsg": "Verranno aggiunte regole UFW per consentire 80/443 dai range ufficiali di Cloudflare. Continuare?",
    "cfAllowTitle": "Consenti IP Cloudflare",
    "cfAllowBtn": "Continua"
  },
  "toasts": {
    "ruleDeleted": "Regola eliminata",
    "errorDelete": "Errore durante l'eliminazione",
    "ipUnbanned": "{ip} sbloccato",
    "errorUnban": "Errore durante lo sblocco",
    "fwEnabled": "Firewall attivato",
    "errorEnable": "Errore nell'attivazione",
    "fwDisabled": "Firewall disattivato",
    "errorDisable": "Errore nella disattivazione",
    "fwInstalled": "Firewall installato",
    "ruleAdded": "Regola aggiunta",
    "ipBanned": "{ip} bloccato in {jail}",
    "errorBan": "Errore nel blocco",
    "cfRulesApplied": "Regole Cloudflare applicate ({applied})",
    "errorCfRules": "Errore nell'applicazione regole Cloudflare",
    "errorStartAudit": "Errore nell'avvio dell'audit",
    "auditCompleted": "Audit completato",
    "auditFailed": "Audit fallito",
    "errorLoadReport": "Errore nel caricamento del report",
    "reportOf": "Report di {date}"
  },
  "errors": {
    "addRule": "Errore nell'aggiunta regola"
  },
  "runtime": {
    "statusError": "Impossibile verificare lo stato",
    "rulesLoadError": "Impossibile caricare le regole.",
    "noMatchingRules": "Nessuna regola corrisponde al filtro.",
    "loggingSaved": "Livello di registrazione salvato.",
    "loggingSaveError": "Impossibile salvare il livello di registrazione."
  },
  "settingsUi": {
    "rulesView": "Vista delle regole",
    "ufwLog": "Registro UFW",
    "related": "Correlati",
    "title": "Impostazioni firewall",
    "description": "Filtri personali e registro UFW del server attivo.",
    "sectionsLabel": "Sezioni delle impostazioni firewall",
    "showActions": "Mostra azioni",
    "all": "Tutte",
    "limit": "Limita",
    "serverSettingHint": "Questa impostazione modifica la configurazione del server attivo.",
    "logLevel": "Livello di registrazione",
    "off": "Disattivato",
    "low": "Basso",
    "medium": "Medio",
    "high": "Alto",
    "full": "Completo",
    "saveLevel": "Salva livello",
    "relatedModules": "Moduli correlati"
  }
} as const;

export default firewall;
