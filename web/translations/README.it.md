# LUXIPANEL

Revisionato il 13 ottobre 2026

LUXIPANEL funziona sul tuo server Linux e gestisce risorse locali e destinazioni SSH. LP-LICENSE-SERVER gestisce account, pagamenti, token, catalogo moduli e servizi editoriali di luxipanel.com. Creare un account non installa un pannello né registra un server.

[en](../README.md) | [es](../translations/README.es.md) | [fr](../translations/README.fr.md) | [de](../translations/README.de.md) | [it](../translations/README.it.md) | [pt](../translations/README.pt.md) | [ru](../translations/README.ru.md) | [ar](../translations/README.ar.md) | [hi](../translations/README.hi.md) | [bn](../translations/README.bn.md) | [ja](../translations/README.ja.md) | [ko](../translations/README.ko.md)

## Prima dell’installazione

Servono Debian/Ubuntu, accesso amministrativo, dominio e DNS funzionante. I pacchetti attuali richiedono Node.js 22.12 o successivo e dichiarano pnpm 11.5.0. Devono essere disponibili Redis, nginx e i servizi dei moduli abilitati. Controlla install.sh: installa dipendenze e modifica il sistema.

## Installare e accedere

Dal repository LUXIPANEL esegui l’installer con il tuo dominio. Usa --https per l’origine pubblica TLS o --cloudflare quando necessario. Configura DNS e certificato valido, poi apri /login con un utente Linux esistente. Il primo utente sudo/wheel idoneo può diventare amministratore. Esiste una sola modalità self-hosted; la vecchia configurazione «managed» non è più quella corrente.

```bash
sudo bash install.sh --domain panel.example.com --https
```

## Accesso locale

Il pannello autentica l’utente Linux e applica ruoli e permessi dei moduli. Credenziali web e chiavi API account non sostituiscono il login Linux. L’esecutore locale opera sulla macchina che ospita LUXIPANEL.

## Scegliere la destinazione prima di agire

Seleziona server locale o connessione SSH nel pannello. File, terminale, servizi e operazioni compatibili agiscono su quel server secondo capacità e permessi. Verifica il nome prima di scrivere, riavviare o eliminare.

## Aggiungere una destinazione SSH

Nel selettore del pannello inserisci host, porta, utente SSH e credenziale. Le credenziali sono cifrate sul pannello, non nel vecchio inventario web. Verifica la destinazione, selezionala e prova una lettura prima delle modifiche. SSH non garantisce ogni modulo su qualsiasi sistema operativo.

## Diagnosticare la connessione

Controlla rete, porta SSH, credenziali e privilegi remoti. Gli indirizzi privati sono limitati dalla politica del server; SERVERS_ALLOW_PRIVATE è un’impostazione amministrativa per reti private legittime. Non disattivare la verifica host né esporre segreti per aggirare errori. Riconnetti le sessioni scadute.

## Creare una chiave API con nome

Apri Sicurezza → API KEY nell’account web, completa i controlli e assegna un nome descrittivo. Copia il segreto mostrato e inseriscilo tramite API KEY nel LUXIPANEL installato. Non devi selezionare server, IP o credenziali SSH su luxipanel.com. La chiave identifica l’account per i servizi autorizzati.

## Ruotare o revocare una chiave

Il segreto completo appare solo alla creazione o rotazione. Dopo la rotazione aggiornalo in tutte le installazioni interessate. La revoca interrompe l’autorizzazione e annulla gli abbonamenti attivi ai moduli associati. Non inserirlo in schermate, log, repository o richieste di assistenza.

## Installare e gestire moduli

Apri Moduli nel pannello per catalogo, permessi, dipendenze e disponibilità. Abilita o installa secondo il tuo ruolo. Funzioni integrate e moduli marketplace possono avere requisiti diversi. Prima di sottoscrivere un modulo a pagamento consulta prezzi e condizioni attuali.

## Configurare le integrazioni nel pannello

Configura Cloudflare per DNS e zone, GitHub per repository, Expo per EAS e fornitori/connettori dell’assistente quando abilitati. Ogni integrazione richiede credenziali e permessi propri. Il vecchio import cloud e i sottodomini gestiti dal sito non sono più il percorso di configurazione.

## Mobile: accesso diretto

Aggiungi l’URL di un LUXIPANEL installato, scegli la connessione e accedi con l’utente pannello/Linux. L’app attiva usa schermate native React Native. Ricordami conserva dati di sessione in memoria sicura, non la password Linux. Moduli e azioni dipendono dal server scelto e dai permessi.

## Desktop: profili e schede

Salva nome e URL del pannello, prova la connessione e apri una scheda. Desktop mostra la sua interfaccia web in una vista Electron isolata. Le schede dello stesso profilo condividono sessione; i profili hanno archivi separati. Cambiare URL cancella l’archivio precedente. Chiudere la finestra mantiene l’icona nell’area di notifica; Esci termina l’app.

## Aggiornamenti e ripristino

Salva configurazione e credenziali cifrate. Conserva la chiave del vault: cambiarla rende illeggibili le credenziali esistenti. Compila un progetto alla volta. Per Astro pulisci dist, usa NODE_OPTIONS=--max-old-space-size=2560, riavvia e verifica HTTP. Se cambi l’ambiente PM2, rivaluta ecosystem con --only e --update-env.

## Preparare una segnalazione utile

Indica prodotto, versioni client e pannello, orario, destinazione, errore e passi per riprodurlo. Descrivi l’esito atteso e allega schermate o log senza segreti. Mai inviare password, chiavi private/API complete, cookie o codici di recupero a due fattori.

## Guide correlate

- [Self-hosting](../SELF-HOSTING.md)
- [Despliegue](../DESPLIEGUE-STANDALONE.md)
- [Module SDK](../MODULE-SDK-SPEC.md)
- [Testing](../TESTING.md)
- [Contributing](../CONTRIBUTING.md)
- [Security](../SECURITY.md)
- [License](../LICENSE)
