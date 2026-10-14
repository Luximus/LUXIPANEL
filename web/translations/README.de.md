# LUXIPANEL

Geprüft am 13. Oktober 2026

LUXIPANEL läuft auf Ihrem Linux-Server und verwaltet lokale Ressourcen sowie SSH-Ziele. LP-LICENSE-SERVER betreibt Konten, Zahlungen, Tokens, Modulkatalog und Redaktion auf luxipanel.com. Ein Konto installiert kein Panel und registriert keinen Server.

[en](../README.md) | [es](../translations/README.es.md) | [fr](../translations/README.fr.md) | [de](../translations/README.de.md) | [it](../translations/README.it.md) | [pt](../translations/README.pt.md) | [ru](../translations/README.ru.md) | [ar](../translations/README.ar.md) | [hi](../translations/README.hi.md) | [bn](../translations/README.bn.md) | [ja](../translations/README.ja.md) | [ko](../translations/README.ko.md)

## Vor der Installation

Sie benötigen Debian/Ubuntu, Administratorzugriff, einen Hostnamen und funktionierendes DNS. Die aktuellen Pakete verlangen Node.js ab 22.12 und geben pnpm 11.5.0 an. Redis, nginx und die Dienste aktivierter Module müssen verfügbar sein. Prüfen Sie install.sh vor der Ausführung: Es installiert Abhängigkeiten und ändert die Systemkonfiguration.

## Installieren und anmelden

Starten Sie den Installer im LUXIPANEL-Repository mit Ihrem Hostnamen. Verwenden Sie --https bei öffentlichem TLS oder gegebenenfalls --cloudflare. Richten Sie DNS und ein gültiges Zertifikat ein und melden Sie sich unter /login mit einem vorhandenen Linux-Benutzer an. Der erste geeignete sudo/wheel-Benutzer kann Panel-Administrator werden. Es gibt einen selbst gehosteten Betriebsmodus; die frühere Managed-Einrichtung ist nicht mehr aktuell.

```bash
sudo bash install.sh --domain panel.example.com --https
```

## Lokaler Zugriff

Das Panel authentifiziert Linux-Benutzer und wendet Rollen sowie Modulrechte an. Webzugangsdaten und Konto-API-Schlüssel ersetzen keine Linux-Anmeldung. Der lokale Executor arbeitet auf dem LUXIPANEL-Host.

## Vor Aktionen das Ziel auswählen

Wählen Sie im Panel den lokalen Server oder eine SSH-Verbindung. Dateien, Terminal, Dienste und unterstützte Aktionen arbeiten gemäß Fähigkeiten und Rechten auf diesem Ziel. Prüfen Sie den Zielnamen vor Schreibzugriffen, Neustarts oder Löschungen.

## SSH-Ziel hinzufügen und verwenden

Tragen Sie Host, Port, SSH-Benutzer und Zugangsdaten im Serverwähler des Panels ein. Zugangsdaten werden dort verschlüsselt gespeichert, nicht im entfernten Webinventar. Ziel prüfen, auswählen und zuerst einen Lesezugriff testen. SSH garantiert nicht die Unterstützung jedes Moduls auf jedem Betriebssystem.

## Verbindungen prüfen

Prüfen Sie Erreichbarkeit, SSH-Port, Zugangsdaten und Benutzerrechte. Private Ziele unterliegen der Serverrichtlinie; SERVERS_ALLOW_PRIVATE ist eine Administratoreinstellung für berechtigte private Netzwerke. Deaktivieren Sie nicht die Hostprüfung und legen Sie keine Geheimnisse offen. Abgelaufene SSH-Sitzungen neu verbinden.

## Benannten API-Schlüssel erstellen

Öffnen Sie Sicherheit → API KEY im Webkonto, führen Sie die Sicherheitsprüfungen durch und vergeben Sie einen aussagekräftigen Namen. Kopieren Sie das angezeigte Geheimnis und geben Sie es über API KEY im installierten LUXIPANEL ein. Auf luxipanel.com wählen Sie weder Server noch IP oder SSH-Zugangsdaten aus. Der Schlüssel identifiziert Ihr Konto für erlaubte Dienste.

## Schlüssel rotieren oder widerrufen

Der vollständige Schlüssel wird nur beim Erstellen oder Rotieren angezeigt. Aktualisieren Sie ihn danach in allen betroffenen Installationen. Ein Widerruf beendet die Autorisierung und kündigt aktive Modulabonnements dieses Schlüssels. Niemals in Screenshots, Protokollen, Repositories oder Supportnachrichten veröffentlichen.

## Module installieren und verwalten

Öffnen Sie Module im Panel für Katalog, Rechte, Abhängigkeiten und Verfügbarkeit. Aktivieren oder installieren Sie gemäß Ihrer Rolle. Integrierte Funktionen und Marketplace-Module können unterschiedliche Anforderungen haben. Vor einem kostenpflichtigen Abonnement die aktuellen Preise und Bedingungen prüfen.

## Integrationen im Panel konfigurieren

Cloudflare verwaltet DNS und Zonen, GitHub Repositories, Expo EAS-Abläufe; Assistentenanbieter und Konnektoren sind bei Aktivierung verfügbar. Jede Integration benötigt eigene Zugangsdaten und Rechte. Der frühere Cloud-Serverimport und verwaltete Subdomains im Webportal sind nicht mehr der Einrichtungsweg.

## Mobil: direkter Panelzugriff

Fügen Sie die URL eines installierten LUXIPANEL hinzu, wählen Sie die Verbindung und melden Sie den Panel-/Linux-Benutzer an. Die aktive App verwendet native React-Native-Modulansichten. Die Anmeldespeicherung legt Sitzungsdaten sicher ab, nicht das Linux-Passwort. Funktionen hängen vom Zielserver und seinen Rechten ab.

## Desktop: Profile und Tabs

Speichern Sie Name und URL eines Panels, testen Sie die Verbindung und öffnen Sie einen Tab. Desktop zeigt dessen Weboberfläche in einer isolierten Electron-Ansicht. Tabs eines Profils teilen die Sitzung, unterschiedliche Profile haben getrennten Speicher. Ein URL-Wechsel löscht den bisherigen Profilspeicher. Fensterschließen behält das Tray-Symbol; Beenden schließt die Anwendung.

## Updates und Wiederherstellung

Sichern Sie Konfiguration und verschlüsselte Zugangsdaten. Bewahren Sie den Tresorschlüssel auf: Ein Wechsel macht gespeicherte Zugangsdaten unlesbar. Bauen Sie nur ein Projekt gleichzeitig. Für Astro dist bereinigen, NODE_OPTIONS=--max-old-space-size=2560 verwenden, danach den Prozess neu starten und HTTP prüfen. Nach PM2-Umgebungsänderungen die ecosystem-Konfiguration mit --only und --update-env neu auswerten.

## Hilfreichen Fehlerbericht erstellen

Nennen Sie Produkt, Client-/Panelversion, Zeitpunkt, Ziel, genaue Fehlermeldung und Reproduktionsschritte. Beschreiben Sie das erwartete Ergebnis und fügen Sie bereinigte Screenshots oder Protokolle bei. Keine Passwörter, privaten Schlüssel, vollständigen API-Schlüssel, Sitzungscookies oder Zwei-Faktor-Wiederherstellungscodes senden.

## Weitere Anleitungen

- [Self-hosting](../SELF-HOSTING.md)
- [Despliegue](../DESPLIEGUE-STANDALONE.md)
- [Module SDK](../MODULE-SDK-SPEC.md)
- [Testing](../TESTING.md)
- [Contributing](../CONTRIBUTING.md)
- [Security](../SECURITY.md)
- [License](../LICENSE)
