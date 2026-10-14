// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { AssistantSkill } from "../skill.types.js";
import { catalogSkill } from "./factory.js";

export const dataRagSkills: AssistantSkill[] = [
  catalogSkill({
    id: "supabase",
    name: "Supabase",
    category: "data-rag",
    source: "https://supabase.com/docs",
    description:
      "Backend Postgres gestionado con auth, storage y realtime.",
    block:
      "Activa SIEMPRE Row Level Security en tablas del esquema expuesto; sin RLS la anon key lee todo. service_role key solo en servidor. En políticas usa TO authenticated/anon y envuelve auth.uid() en (select auth.uid()) e indexa esa columna (mucho más rápido); auth.jwt() para metadata. Genera tipos con supabase gen types. Migraciones versionadas. Vectores con pgvector; lógica sensible en Edge Functions.",
  }),
  catalogSkill({
    id: "postgresql",
    name: "PostgreSQL",
    category: "data-rag",
    source: "https://www.postgresql.org/docs/",
    description:
      "Base de datos relacional robusta con tipos ricos.",
    block:
      "Indexa columnas de filtro/join (B-tree); EXPLAIN ANALYZE para verificar planes. Consultas parametrizadas/prepared statements siempre (anti inyección). Transacciones para invariantes; elige aislamiento (READ COMMITTED/REPEATABLE READ/SERIALIZABLE). jsonb (no json) con índice GIN para documentos. Restricciones en la BD (NOT NULL, FK, CHECK). Evita SELECT *. Connection pooling (pgbouncer). autovacuum sano. Migraciones idempotentes.",
  }),
  catalogSkill({
    id: "pgvector",
    name: "pgvector",
    category: "data-rag",
    source: "https://github.com/pgvector/pgvector",
    description:
      "Búsqueda de similitud vectorial dentro de Postgres.",
    block:
      "CREATE EXTENSION vector; columna vector(dim) con la dimensión exacta. Operadores: <-> L2, <=> coseno, <#> producto interno negativo, <+> L1. Índice USING hnsw (mejor recall/latencia, WITH m, ef_construction; ajusta hnsw.ef_search) o ivfflat (WITH lists tras cargar datos; ivfflat.probes); clase de operador acorde (vector_cosine_ops…). ORDER BY <op> LIMIT k. Filtra metadatos en la misma query. halfvec/bit/sparsevec si aplica.",
  }),
  catalogSkill({
    id: "pinecone",
    name: "Pinecone",
    category: "data-rag",
    source: "https://docs.pinecone.io/",
    description:
      "Base de datos vectorial gestionada para RAG a escala.",
    block:
      "Usa namespaces para particionar/aislar tenants (consultas más rápidas). Métrica (cosine/dotproduct/euclidean) y dimensión se fijan al crear el índice y no deben mezclarse. upsert por lotes con IDs estables + metadata; query con topK y filter por metadata. Rerank para más precisión. Serverless para escalar por uso; vectores dispersos para búsqueda léxica; embedding integrado convierte texto en upsert/search.",
  }),
  catalogSkill({
    id: "qdrant",
    name: "Qdrant",
    category: "data-rag",
    source: "https://qdrant.tech/documentation/",
    description:
      "Motor vectorial open-source con filtrado por payload.",
    block:
      "create_collection con size y distance (Cosine/Dot/Euclid) correctos. create_payload_index en campos usados en filtros (filtrado rápido). upsert points por lotes con IDs deterministas. query_points con Filter (must/should/must_not) junto a la búsqueda vectorial. Quantization (scalar/binary/product) para ahorrar RAM. HNSW config (m, ef_construct; ef en búsqueda). Snapshots para backup.",
  }),
  catalogSkill({
    id: "weaviate",
    name: "Weaviate",
    category: "data-rag",
    source: "https://weaviate.io/developers/weaviate",
    description:
      "Base de datos vectorial con esquema y módulos de vectorización.",
    block:
      "Define collections con propiedades tipadas; decide vectorización (módulo text2vec-* o vectores propios). query.hybrid() fusiona vector + BM25F (alpha: 1=vector, 0=keyword; fusión RelativeScore) y suele mejorar recall; near_text/near_vector para vectorial pura. Filtra con where; references para relaciones; named vectors con target_vector. Batch import para ingesta. Multi-tenancy para aislar. gRPC para rendimiento; pagina con limit/offset.",
  }),
];
