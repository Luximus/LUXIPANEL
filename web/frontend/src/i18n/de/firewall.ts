const firewall = {
  "pageTitle": "Firewall",
  "installWarning": {
    "title": "Firewall-Komponenten nicht erkannt",
    "description": "Der Paketmanager (apt/dnf/apk/...) wird mit Standardkonfiguration ausgeführt und die Dienste werden nach Abschluss aktiviert.",
    "btnInstall": "Jetzt installieren"
  },
  "statusCard": {
    "label": "Firewall-Status (UFW)",
    "verifying": "Wird überprüft...",
    "btnDisable": "Deaktivieren",
    "btnEnable": "Aktivieren"
  },
  "securityAudit": {
    "title": "Sicherheitsaudit (Premium)",
    "btnStartAudit": "Analyse starten",
    "scannerChecking": "wird geprüft…",
    "btnInstallScanner": "Installieren",
    "scanProgress": "Scan-Fortschritt",
    "scanAi": "KI-Analyse: 0%",
    "noReports": "Keine abgeschlossenen Audits. Starte eine neue zum Starten."
  },
  "ufwRules": {
    "title": "UFW-Regeln",
    "btnNewRule": "Neue Regel",
    "loading": "Regeln werden geladen...",
    "btnAllowCloudflare": "Cloudflare erlauben",
    "searchLabel": "Regel suchen",
    "searchPlaceholder": "Port, IP oder Kommentar suchen…"
  },
  "fail2ban": {
    "btnBanIp": "IP blockieren",
    "loading": "Jails werden geladen..."
  },
  "ruleDialog": {
    "title": "Neue UFW-Regel",
    "labelAction": "Aktion",
    "optionAllow": "Zulassen",
    "optionDeny": "Verweigern",
    "optionReject": "Ablehnen",
    "labelProtocol": "Protokoll",
    "optionAny": "Beliebig",
    "labelPort": "Port",
    "placeholderPort": "25 oder 8080:8090",
    "labelFromIp": "Aus IP",
    "placeholderFromIp": "any oder 192.168.0.0/24",
    "labelComment": "Kommentar (optional)",
    "placeholderComment": "Eingehendes SMTP",
    "btnCancel": "Abbrechen",
    "btnAdd": "Regel hinzufügen"
  },
  "banDialog": {
    "title": "IP manuell blockieren",
    "labelIp": "IP-Adresse",
    "placeholderIp": "192.168.1.100",
    "labelJail": "Jail",
    "btnCancel": "Abbrechen",
    "btnBan": "Blockieren"
  },
  "auditReportDialog": {
    "title": "Sicherheitsaudit-Bericht",
    "btnClose": "Schließen"
  },
  "aiAssistant": {
    "btnSuggestRules": "Regeln vorschlagen (KI)",
    "btnSuggestBans": "Sperren vorschlagen (KI)",
    "btnAnalyze": "KI-Analyse",
    "promptUfw": "Analysiere die UFW-Firewall auf dem verbundenen Server: überprüfe den Status und die aktuellen Regeln (verwende das Tool firewall.ufw_status) und schlage clevere UFW-Regeln vor, um die Sicherheit zu verbessern, ohne laufende Dienste zu unterbrechen. Erkläre für jede vorgeschlagene Regel das Warum und nenne den genauen `ufw`-Befehl zu ihrer Anwendung.",
    "promptFail2ban": "Analysiere Fail2ban auf dem verbundenen Server: überprüfe die konfigurierten Jails und gesperrten IPs (verwende das Tool firewall.fail2ban_status) und schlage Sperrungen und Konfigurationsverbesserungen vor, um es gegen Brute-Force-Angriffe abzusichern. Gib Jail, IP/Bereich und Grund sowie die anzuwendenden Befehle an.",
    "promptAnalyze": "Führe eine allgemeine Sicherheitsanalyse der Firewall auf dem verbundenen Server durch. Überprüfe den Status von UFW und Fail2ban (verwende die Tools firewall.ufw_status und firewall.fail2ban_status), identifiziere Risiken, offene Ports und schwache Konfigurationen und liefere priorisierte Empfehlungen mit den anzuwendenden Befehlen.",
    "analyzeRule": "Mit KI analysieren",
    "promptRule": "Analysiere diese bestehende UFW-Regel auf dem verbundenen Server. Erkläre, welchen Verkehr sie erlaubt oder blockiert, bewerte ihre Risiken und empfehle, ob sie beibehalten, angepasst oder ersetzt werden sollte. Falls du Änderungen vorschlägst, gib die genauen Befehle an.\n\nRegel #{number}\nAktion: {action}\nZiel/Port: {to}\nQuelle: {from}\nProtokoll: {proto}\nKommentar: {comment}"
  },
  "labels": {
    "active": "Aktiv",
    "inactive": "Inaktiv",
    "bannedCount": "{count} verboten",
    "moreIps": "+{n} weitere",
    "installingText": "UFW und Fail2ban werden installiert… dies kann einige Minuten dauern.",
    "installSuccessText": "Firewall erfolgreich installiert.",
    "cfEdgeBlockQuestion": "{ip} auch am Cloudflare-Edge blockieren?",
    "findingsCount": "{n} Ergebnisse gefunden",
    "completedAt": "Abgeschlossen in {time}",
    "scanAiProgress": "KI-Analyse: {pct}%",
    "overallRisk": "Gesamtrisiko",
    "unknown": "UNBEKANNT",
    "keyThreats": "Wichtigste Bedrohungen",
    "recommendations": "Empfehlungen",
    "findingsTitle": "Ergebnisse ({n})",
    "moreFindingsCount": "+{n} weitere Ergebnisse",
    "from": "von",
    "any": "beliebig",
    "scanBitNinjaProgress": "BitNinja: {pct}%",
    "scanLynisProgress": "Lynis: {pct}%",
    "scanRkhunterProgress": "Rkhunter: {pct}%",
    "scanChkrootkitProgress": "Chkrootkit: {pct}%"
  },
  "empty": {
    "noRules": "Keine Regeln",
    "noJails": "Keine aktiven Jails"
  },
  "actions": {
    "unban": "entsperren",
    "blockInCloudflare": "In Cloudflare blockieren",
    "dismiss": "Verwerfen"
  },
  "confirm": {
    "deleteRuleMsg": "Regel #{number} löschen?",
    "deleteRuleTitle": "Regel löschen",
    "disableFwMsg": "Firewall deaktivieren? Der Server wird ohne Netzwerkschutz sein.",
    "disableFwTitle": "Firewall deaktivieren",
    "disableFwBtn": "Ja, deaktivieren",
    "cfAllowMsg": "UFW-Regeln werden hinzugefügt, um 80/443 von offiziellen Cloudflare-Bereichen zuzulassen. Fortfahren?",
    "cfAllowTitle": "Cloudflare-IPs zulassen",
    "cfAllowBtn": "Fortfahren"
  },
  "toasts": {
    "ruleDeleted": "Regel gelöscht",
    "errorDelete": "Fehler beim Löschen",
    "ipUnbanned": "{ip} entsperrt",
    "errorUnban": "Fehler beim Entsperren",
    "fwEnabled": "Firewall aktiviert",
    "errorEnable": "Fehler beim Aktivieren",
    "fwDisabled": "Firewall deaktiviert",
    "errorDisable": "Fehler beim Deaktivieren",
    "fwInstalled": "Firewall installiert",
    "ruleAdded": "Regel hinzugefügt",
    "ipBanned": "{ip} im Jail {jail} geblockt",
    "errorBan": "Fehler beim Blocken",
    "cfRulesApplied": "Cloudflare-Regeln angewendet ({applied})",
    "errorCfRules": "Fehler beim Anwenden von Cloudflare-Regeln",
    "errorStartAudit": "Fehler beim Starten des Audits",
    "auditCompleted": "Audit abgeschlossen",
    "auditFailed": "Audit fehlgeschlagen",
    "errorLoadReport": "Fehler beim Laden des Berichts",
    "reportOf": "Bericht vom {date}"
  },
  "errors": {
    "addRule": "Fehler beim Hinzufügen der Regel"
  },
  "runtime": {
    "statusError": "Status konnte nicht abgerufen werden",
    "rulesLoadError": "Regeln konnten nicht geladen werden.",
    "noMatchingRules": "Keine Regel entspricht dem Filter.",
    "loggingSaved": "Protokollierungsstufe gespeichert.",
    "loggingSaveError": "Protokollierungsstufe konnte nicht gespeichert werden."
  },
  "settingsUi": {
    "rulesView": "Regelansicht",
    "ufwLog": "UFW-Protokoll",
    "related": "Verwandte",
    "title": "Firewall-Einstellungen",
    "description": "Persönliche Filter und UFW-Protokoll des aktiven Servers.",
    "sectionsLabel": "Bereiche der Firewall-Einstellungen",
    "showActions": "Aktionen anzeigen",
    "all": "Alle",
    "limit": "Begrenzen",
    "serverSettingHint": "Diese Einstellung ändert die Konfiguration des aktiven Servers.",
    "logLevel": "Protokollierungsstufe",
    "off": "Deaktiviert",
    "low": "Niedrig",
    "medium": "Mittel",
    "high": "Hoch",
    "full": "Vollständig",
    "saveLevel": "Stufe speichern",
    "relatedModules": "Verwandte Module"
  }
} as const;

export default firewall;
