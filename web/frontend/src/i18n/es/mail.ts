// Aggregator for the mail namespace — split into ./mail/part*.ts to keep each
// file <1000 lines. The merged object is byte-identical to the pre-split literal
// (contiguous key slices spread in order), so the generated i18n JSON is unchanged.
import mailPart1 from "./mail/part1";
import mailPart2 from "./mail/part2";

const mail = { ...mailPart1, ...mailPart2, serverConnection: {
  "title": "Servidor SMTP / IMAP",
  "intro": "Usa los buzones de otro servidor guardado. Esta selección se aplica a Correo en esta pestaña; los demás módulos conservan su servidor activo.",
  "serverLabel": "Servidor de correo",
  "hint": "El servidor debe tener Postfix/Dovecot compatibles y sus puertos de correo accesibles. Se usan los buzones y credenciales del servidor elegido.",
  "apply": "Aplicar servidor",
  "current": "Servidor actual",
  "currentHint": "Se usa el correo del servidor activo del panel.",
  "loading": "Cargando servidores…",
  "loadError": "No se pudieron cargar los servidores.",
  "unavailable": "Servidor seleccionado no disponible",
  "unavailableHint": "El servidor seleccionado ya no está disponible. Elige otro o vuelve al servidor actual.",
  "empty": "No hay otros servidores habilitados con huella SSH aprobada a los que tengas acceso.",
  "connecting": "Verificando conexión…",
  "connectError": "No se pudo conectar o guardar la selección.",
  "active": "Correo: {server}"
} } as const;

export default mail;
