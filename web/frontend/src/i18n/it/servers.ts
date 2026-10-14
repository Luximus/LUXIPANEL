const servers = {
  "pageTitle": "Server",
  "description": "Registro locale delle destinazioni SSH a cui questo pannello può connettersi. I segreti (chiavi e password) sono conservati in forma cifrata e non vengono mai mostrati qui.",
  "btnNew": "Aggiungi server",
  "table": {
    "name": "Nome",
    "host": "Host",
    "username": "Utente",
    "authType": "Autenticazione",
    "status": "Stato"
  },
  "authTypes": {
    "key": "Chiave SSH",
    "password": "Password"
  },
  "status": {
    "approved": "Approvato",
    "pending": "In attesa",
    "untested": "Non testato"
  },
  "common": {
    "test": "Testa",
    "edit": "Modifica",
    "delete": "Elimina",
    "cancel": "Annulla",
    "save": "Salva",
    "close": "Chiudi",
    "error": "Errore",
    "yes": "Sì",
    "no": "No"
  },
  "dialog": {
    "titleNew": "Aggiungi server",
    "titleEdit": "Modifica server",
    "name": "Nome",
    "namePlaceholder": "Il mio server di produzione",
    "host": "Host o IP",
    "hostPlaceholder": "203.0.113.10 o server.esempio.com",
    "port": "Porta",
    "username": "Utente",
    "usernamePlaceholder": "root",
    "authType": "Tipo di autenticazione",
    "secretKey": "Chiave privata SSH",
    "secretKeyPlaceholder": "-----BEGIN OPENSSH PRIVATE KEY-----",
    "passphrase": "Passphrase della chiave (facoltativa)",
    "passphrasePlaceholder": "Passphrase per sbloccare la chiave",
    "secretPassword": "Password",
    "secretPasswordPlaceholder": "Password dell'utente SSH",
    "secretKeepHint": "Lascia vuoto per mantenere il segreto attuale.",
    "btnCancel": "Annulla",
    "btnSave": "Salva"
  },
  "fingerprint": {
    "title": "Approva l'impronta dell'host",
    "intro": "Questa è la prima connessione al server. Prima di approvarla, verifica che l'impronta della chiave host corrisponda a quella prevista.",
    "approve": "Approva impronta",
    "approving": "Approvazione…",
    "approved": "Impronta approvata",
    "approveError": "Impossibile approvare l'impronta"
  },
  "toasts": {
    "created": "Server aggiunto",
    "updated": "Server aggiornato",
    "deleted": "Server eliminato",
    "testOk": "Connessione riuscita",
    "testFailed": "Connessione non riuscita"
  },
  "validation": {
    "nameRequired": "Inserisci un nome",
    "hostRequired": "Inserisci l'host",
    "usernameRequired": "Inserisci l'utente",
    "secretRequired": "Inserisci il segreto di autenticazione"
  },
  "confirmDelete": "Eliminare il server {name}? Questa operazione non può essere annullata.",
  "confirmDeleteTitle": "Elimina server",
  "testing": "Verifica della connessione…"
} as const;

export default servers;
