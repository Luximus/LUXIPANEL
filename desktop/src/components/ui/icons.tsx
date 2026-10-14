export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.6 14.6 2.7 12 2.7 6.9 2.7 2.8 6.8 2.8 11.9S6.9 21 12 21c6.9 0 9.2-4.8 9.2-7.3 0-.5 0-.9-.1-1.3H12z" />
      <path fill="#34A853" d="M2.8 11.9c0 1.7.6 3.3 1.6 4.6l3.3-2.6c-.4-.6-.6-1.3-.6-2s.2-1.4.6-2L4.4 7.3c-1 1.3-1.6 2.9-1.6 4.6z" />
      <path fill="#4A90E2" d="M12 21c2.5 0 4.6-.8 6.1-2.2l-3-2.4c-.8.5-1.8.8-3.1.8-2.4 0-4.4-1.6-5.1-3.8l-3.3 2.6C5.2 19 8.4 21 12 21z" />
      <path fill="#FBBC05" d="M6.9 13.4c-.2-.5-.3-1-.3-1.5s.1-1 .3-1.5L3.6 7.8c-.5 1-.8 2.1-.8 3.3s.3 2.3.8 3.3l3.3-2.6z" />
    </svg>
  );
}

// Iconos de marca para los botones OAuth. lucide-react retiró los iconos de
// marca (Github, etc.), así que los servimos como SVG propios. Heredan
// `currentColor` salvo Microsoft (logo de 4 cuadros con color fijo).
export function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l-.49.99zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

export function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.21 3.44 9.63 8.21 11.19.6.11.82-.26.82-.58v-2.03c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.23 1.84 1.23 1.07 1.83 2.81 1.3 3.49.99.11-.77.42-1.3.76-1.6-2.67-.3-5.47-1.32-5.47-5.88 0-1.3.47-2.36 1.24-3.19-.13-.3-.54-1.52.12-3.16 0 0 1.01-.32 3.3 1.22.96-.26 1.98-.39 3-.4 1.02.01 2.04.14 3 .4 2.29-1.54 3.3-1.22 3.3-1.22.66 1.64.25 2.86.12 3.16.77.83 1.24 1.89 1.24 3.19 0 4.57-2.81 5.58-5.49 5.87.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A11.8 11.8 0 0 0 24 12.29C24 5.78 18.63.5 12 .5z" />
    </svg>
  );
}

export function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#F25022" d="M3 3h8.5v8.5H3z" />
      <path fill="#7FBA00" d="M12.5 3H21v8.5h-8.5z" />
      <path fill="#00A4EF" d="M3 12.5h8.5V21H3z" />
      <path fill="#FFB900" d="M12.5 12.5H21V21h-8.5z" />
    </svg>
  );
}

export function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5.5 9.5V21h13V9.5" />
      <path d="M10 21v-6h4v6" />
    </svg>
  );
}

export function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** Engranaje "Configurar". Fuente única para todos los botones de configuración
 *  (toolbar de DataTable y sub-tablas de DataTableSettings), para que el botón
 *  "Configurar" sea idéntico en todos lados. */
export function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="3.25" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1.9 1.9 0 1 1-3.8 0v-.1a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.9 1.9 0 0 1-2.7-2.7l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a1.9 1.9 0 0 1 0-3.8h.1a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .5-.9V4a1.9 1.9 0 1 1 3.8 0v.1a1 1 0 0 0 .6.9h.1a1 1 0 0 0 1.1-.2l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.5H20a1.9 1.9 0 0 1 0 3.8h-.1a1 1 0 0 0-.9.6z" />
    </svg>
  );
}
