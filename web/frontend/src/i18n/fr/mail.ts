// Aggregator for the mail namespace — split into ./mail/part*.ts to keep each
// file <1000 lines. The merged object is byte-identical to the pre-split literal
// (contiguous key slices spread in order), so the generated i18n JSON is unchanged.
import mailPart1 from "./mail/part1";
import mailPart2 from "./mail/part2";

const mail = { ...mailPart1, ...mailPart2, serverConnection: {
  "title": "Serveur SMTP / IMAP",
  "intro": "Utilisez les boîtes mail d’un autre serveur enregistré. Ce choix s’applique au Courrier dans cet onglet ; les autres modules gardent leur serveur actif.",
  "serverLabel": "Serveur de messagerie",
  "hint": "Le serveur doit disposer de Postfix/Dovecot compatibles et de ports de messagerie accessibles. Les boîtes et identifiants sont ceux du serveur choisi.",
  "apply": "Appliquer le serveur",
  "current": "Serveur actuel",
  "currentHint": "Le courrier utilise le serveur actif du panneau.",
  "loading": "Chargement des serveurs…",
  "loadError": "Impossible de charger les serveurs.",
  "unavailable": "Serveur choisi indisponible",
  "unavailableHint": "Le serveur choisi n’est plus disponible. Choisissez-en un autre ou revenez au serveur actuel.",
  "empty": "Aucun autre serveur activé avec une empreinte SSH approuvée ne vous est accessible.",
  "connecting": "Vérification de la connexion…",
  "connectError": "Impossible de se connecter ou d’enregistrer le choix.",
  "active": "Courrier : {server}"
} } as const;

export default mail;
