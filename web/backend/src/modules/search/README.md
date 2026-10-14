# Módulo `search` — fallback IA del super buscador

El super buscador del navbar (`frontend/src/lib/search-catalog.ts` +
`frontend/src/scripts/extracted/layouts/super-search.ts`) resuelve casi todo
en el cliente (catálogo SSOT + ranking en lenguaje natural). Este módulo solo
aporta el **fallback IA** cuando el ranking local es débil o ambiguo.

## Endpoint

`POST /api/search/intent` — `requireAuth` + permiso de vista `panel.search`
(mismo gate que el botón de búsqueda del topbar) + rate limit 30/min por IP.

Body: `{ query: string, locale: string, candidates: [{ id, label, path?, keywords[] }] (≤300) }`
Respuesta: `{ ok: true, id: string|null, confidence: 0..1 }`.

- `id` siempre pertenece a `candidates` (se valida server-side; la IA no puede
  inventar destinos).
- **Fail-open:** sin proveedor API configurado → `503 SEARCH_AI_UNAVAILABLE`
  (el cliente deja de consultar en la sesión). Salida inválida del modelo →
  `{ id: null, confidence: 0 }` (200).

## Anatomía

`models/search-intent.types.ts` (zod) → `services/search-intent.service.ts`
(`aiComplete` de `ai-assistant/services/translation/ai-translator`, prompt corto
con el catálogo de candidatos, parse JSON tolerante) → `controllers/` →
`routes/` → `index.ts` (`registerSearchModule`).
