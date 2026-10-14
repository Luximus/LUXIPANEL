// Fachada: el catálogo vive troceado por idioma en ./server-mail/ (Wave G-1).
// app y desktop deben quedar byte-idénticos (guardia scripts/check-i18n-sync.mjs).
export { serverMail, type ServerMailMessages } from "./server-mail/index";
