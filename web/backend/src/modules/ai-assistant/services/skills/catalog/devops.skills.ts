// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { AssistantSkill } from "../skill.types.js";
import { catalogSkill } from "./factory.js";

export const devopsSkills: AssistantSkill[] = [
  catalogSkill({
    id: "github-actions",
    name: "GitHub Actions",
    category: "devops",
    source: "https://docs.github.com/en/actions",
    description: "CI/CD en GitHub con workflows YAML (.github/workflows) disparados por eventos.",
    block:
      "Define workflows en .github/workflows/*.yml: on (push/pull_request), jobs.<id> con runs-on y steps. Cachea dependencias (actions/cache). Referencia secretos con ${{ secrets.X }}, nunca en el YAML. Fija acciones a SHA, no a @main. strategy.matrix para multi-versión; needs encadena jobs. Restringe permissions: (read por defecto) sobre GITHUB_TOKEN; concurrency con cancel-in-progress para abortar runs viejos.",
  }),
  catalogSkill({
    id: "vercel",
    name: "Vercel",
    category: "devops",
    source: "https://vercel.com/docs",
    description: "Despliegue de frontends y funciones serverless con preview por commit/PR.",
    block:
      "Conecta el repo Git: cada commit/PR genera un Preview Deployment con URL única; promueve a Production o usa vercel --prod desde la CLI. Configura build/rewrites/headers en vercel.json. Variables por entorno (Production/Preview/Development), nunca en el código ni en el bundle cliente. Funciones serverless/edge para APIs ligeras; vigila cold starts y timeouts. Aprovecha CDN y cache-control. Revisa Resources/Logs en el dashboard.",
  }),
  catalogSkill({
    id: "docker",
    name: "Docker",
    category: "devops",
    source: "https://docs.docker.com/",
    description: "Empaqueta apps en contenedores efímeros con imágenes ligeras y reproducibles.",
    block:
      "Usa multi-stage builds: compila en una etapa y copia solo el artefacto a una base slim/alpine oficial. Fija la base por digest (FROM img@sha256:...). Ordena capas de menos a más cambiante (deps antes que código) y combina RUN apt-get update con install en la misma capa. .dockerignore para no inflar el contexto. USER no-root. Un concern por contenedor. Secretos en runtime, nunca en ENV/imagen.",
  }),
  catalogSkill({
    id: "nginx",
    name: "Nginx",
    category: "devops",
    source: "https://nginx.org/en/docs/",
    description: "Servidor web y reverse proxy de alto rendimiento.",
    block:
      "Reverse proxy: proxy_pass al upstream reenviando Host + X-Forwarded-For/Proto. Tras editar la config corre SIEMPRE nginx -t, luego nginx -s reload (recarga sin cortar conexiones; -s quit cierra gradual). Sirve estáticos con root/location (gana el prefijo más largo) + expires. TLS moderno (TLSv1.2+), HSTS. Sube client_max_body_size para uploads. WebSocket: headers Upgrade/Connection. Mantén vhosts en sites-enabled y confirma su include.",
  }),
  catalogSkill({
    id: "pm2",
    name: "PM2",
    category: "devops",
    source: "https://pm2.keymetrics.io/docs/usage/quick-start/",
    description: "Gestor de procesos Node con cluster, reinicio y logs.",
    block:
      "Usa ecosystem.config.cjs para declarar apps, env e instancias. Tras editar .env recuerda que --update-env usa la config cacheada: re-evalúa el ecosystem para aplicar cambios. pm2 save tras start/restart para persistir y pm2 startup para arranque en boot. pm2 logs <app> para depurar; max_memory_restart para fugas. exec_mode cluster solo si la app es stateless. Revisa pm2 list ante caídas.",
  }),
  catalogSkill({
    id: "redis",
    name: "Redis",
    category: "devops",
    source: "https://redis.io/docs/latest/",
    description: "Store en memoria para caché, colas y estructuras de datos.",
    block:
      "Pon TTL (EXPIRE/SET ... EX) a las claves de caché para no crecer sin límite. Nombra jerárquico (app:entidad:id). NUNCA KEYS en producción (bloquea): usa SCAN. Prefiere estructuras nativas (HSET, list, sorted set) antes que serializar JSON gigante. Pipeline/MGET reducen round-trips. requirepass + bind 127.0.0.1 si es local; nunca expuesto sin auth. Define maxmemory + maxmemory-policy. Persistencia RDB (snapshots) o AOF (durabilidad) según tolerancia a pérdida.",
  }),
];
