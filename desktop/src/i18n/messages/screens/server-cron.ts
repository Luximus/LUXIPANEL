// Fachada: el catálogo vive troceado por idioma en ./server-cron/ (Wave G-1).
// app y desktop deben quedar byte-idénticos (guardia scripts/check-i18n-sync.mjs).
export { serverCron, type ServerCronMessages } from "./server-cron/index";
