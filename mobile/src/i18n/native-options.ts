import { nativeText } from './native-text';

// This table translates display labels only; the corresponding API values stay unchanged.
const labels: Record<string, string> = {
  basic: 'Básico', pro: 'Pro', business: 'Empresarial', custom: 'Personalizado',
  key: 'Llave SSH', password: 'Contraseña', text: 'Texto', regex: 'Expresión regular',
  email: 'Correo electrónico', url: 'URL', apikey: 'Clave API', import: 'Importar',
  function: 'Función', endpoint: 'Endpoint', variable: 'Variable', default: 'Predeterminado',
  blank: 'En blanco', 'blank-typescript': 'En blanco (TypeScript)', tabs: 'Pestañas',
  client: 'Cliente', developer: 'Desarrollador', multiple: 'Múltiple', multi: 'Múltiple',
  single: 'Único', all: 'Todos', blocked_failed: 'Bloqueados o fallidos', disabled: 'Desactivado',
  account: 'Cuenta', external: 'Externo', off: 'Desactivado', low: 'Bajo', medium: 'Medio',
  high: 'Alto', xhigh: 'Muy alto', full: 'Completo', edit: 'Editar', preview: 'Vista previa',
  split: 'Vista dividida', saved: 'Guardados', cloned: 'Clonados', update: 'Actualizaciones',
  relevance: 'Relevancia', stars_desc: 'Más estrellas', stars_asc: 'Menos estrellas',
  updated_desc: 'Actualizados recientemente', name_asc: 'Nombre ascendente',
  enable: 'Activar', disable: 'Desactivar', delete: 'Eliminar', number: 'Número',
  boolean: 'Booleano', date: 'Fecha', array: 'Lista', collection: 'Colección',
  allow: 'Permitir', deny: 'Denegar', limit: 'Limitar', reject: 'Rechazar', any: 'Cualquiera',
  static: 'Estático', proxy: 'Proxy', php: 'PHP', tcp: 'TCP', udp: 'UDP', https: 'HTTPS', ssh: 'SSH',
  claude: 'Claude', codex: 'Codex', gemini: 'Gemini', deepseek: 'DeepSeek', grok: 'Grok', minimax: 'MiniMax',
  cpu: 'CPU', ram: 'RAM', disk: 'Disco', network: 'Red', swap: 'Swap',
};

export function nativeOptionLabel(value: string, language?: string): string {
  return nativeText(labels[value.toLowerCase()] ?? value, undefined, language);
}
