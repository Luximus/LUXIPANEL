# codebase-graph (community module)

Surfaces the `codebase-memory-mcp` knowledge graph of the **connected server's
repo** inside LUXIPANEL: architecture, routes, imports, functions/classes, call
paths and the interactive graph view. All structural data comes from the local
CLI (`codebase-memory-mcp cli <tool> '<json>'`); the module parses no code itself.

## Surface

Tools (agent + `POST /api/community/codebase-graph/tool/<name>`):

| tool          | kind   | what it does                                            |
|---------------|--------|---------------------------------------------------------|
| `architecture`| read   | node-label / edge-type breakdown (totals, routes, …)    |
| `search`      | read   | find symbols by name / label / qualified-name pattern   |
| `trace`       | read   | trace call chain / data flow / cross-service from a fn  |
| `query`       | read   | read-only Cypher pattern over the graph                 |
| `open-graph`  | read   | returns the graph UI URL + SSH-tunnel command           |
| `reindex`     | action | rebuild the graph after large code changes              |

Data panel (`GET /api/community/codebase-graph/panel/overview`): index status +
architecture summary (nodes, edges, routes, functions, classes, imports, graph URL).

## Open the graphic view

The graph UI binds to **localhost** only (it exposes code structure), default
`http://127.0.0.1:9749`. For remote viewing use an SSH tunnel:

```
ssh -N -L 9749:127.0.0.1:9749 <user>@<server>
# then open http://127.0.0.1:9749
```

`open-graph` returns the exact command for the connected target.

## Re-index

```
codebase-memory-mcp cli index_repository '{"path":"/var/www/LUXIPANEL"}'
# or, from the panel/agent: run the codebase-graph `reindex` tool
```

## Build / deploy notes

- Source entry is `backend/index.ts`; the loader imports **JS** at runtime, so a
  compiled `backend/index.js` is shipped alongside (the dist manifest points at
  `backend/index.js`). Rebuild with:
  `esbuild backend/index.ts --format=esm --platform=node --outfile=<dist>/.../backend/index.js`
- It loads on backend boot via the community loader (vendored under
  `modules/community/installed/`). Restart `luxipanel-backend` to (re)load.

## Marketplace (LP-LS) registration

This module is registered **locally** (vendored + loaded into the running panel).
Publishing it to the LUXIPANEL marketplace is a **separate** flow on the LP-LS
server: submit through `module-dev` / the dev portal → static-analysis review
pipeline → KYC → approval (auto-semver + signature). That step needs a developer
account on LP-LS and is not performed from this host.
