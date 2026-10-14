import messages from "./connections.json";
let activeLanguage = "en";
export const setConnectionLanguage = (language: string) => { activeLanguage = language; };
export const connectionMessages = (language = activeLanguage): typeof messages.en => (messages as Record<string,typeof messages.en>)[language.split("-")[0]] ?? messages.en;
export function connectionError(error: unknown, language = activeLanguage): string {
 const text = error instanceof Error ? error.message : String(error), t = connectionMessages(language);
 if (/Actualiza LUXIPANEL/.test(text)) return t.updateRequired;
 if (/no responde como/.test(text)) return t.notPanel;
 if (/URL inválida|dominio o IP|Introduce la URL|Enter the panel URL|Invalid URL/.test(text)) return t.invalidUrl;
 if (/autenticación inválida|Origen de autenticación|acceso caducó|No se recibió/.test(text)) return t.invalidAuth;
 if (/iniciar el acceso seguro/.test(text)) return t.browserFailed;
 if (/network_error|timeout|No se pudo conectar/.test(text)) return t.unreachable;
 return text;
}
