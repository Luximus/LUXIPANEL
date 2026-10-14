// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Static catalog of connectable office tools (MCP servers).
 *
 * Google Drive is the flagship, wired end-to-end. The rest ship as catalog
 * entries: enabling them just means a user provides credentials — the connect
 * / browse / fetch flow is generic (office-connectors.service.ts).
 *
 * Entrypoints use community MCP server packages launched via `npx`. Tool names
 * are best-effort hints; the service falls back to heuristic discovery
 * (search/list/find, read/get/fetch) when a server names its tools differently.
 */

import type { OfficeConnectorCatalogEntry } from "../models/office-connectors.types.js";

export const OFFICE_CONNECTORS_CATALOG: OfficeConnectorCatalogEntry[] = [
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Busca y adjunta documentos de tu Google Drive.",
    icon: "ti-brand-google-drive",
    entrypoint: "npx -y @modelcontextprotocol/server-gdrive",
    credentialFields: [
      {
        key: "GDRIVE_CREDENTIALS",
        label: "Credenciales OAuth (JSON)",
        type: "textarea",
        required: true,
        placeholder: '{"client_id":"…","client_secret":"…","refresh_token":"…"}',
        help: "Pega el JSON de credenciales OAuth con un refresh_token de Google Drive.",
        helpUrl: "https://developers.google.com/oauthplayground/",
        helpUrlLabel: "Generar refresh_token con OAuth Playground",
      },
    ],
    setup: {
      steps: [
        "Entra a Google Cloud Console (console.cloud.google.com), crea un proyecto y habilita la API de Google Drive.",
        "En «APIs y servicios → Credenciales», crea un «ID de cliente de OAuth 2.0» (tipo Aplicación web) y guarda el client_id y el client_secret.",
        "Abre OAuth Playground, pulsa el ⚙ (arriba a la derecha), marca «Use your own OAuth credentials» y pega tu client_id y client_secret.",
        "En el panel izquierdo selecciona el scope «https://www.googleapis.com/auth/drive.readonly» y pulsa «Authorize APIs»; inicia sesión y acepta.",
        "Pulsa «Exchange authorization code for tokens» y copia el refresh_token generado.",
        'Pega aquí el JSON: {"client_id":"…","client_secret":"…","refresh_token":"…"} y pulsa «Guardar y conectar».',
      ],
      docUrl: "https://developers.google.com/oauthplayground/",
      docLabel: "Abrir OAuth Playground",
    },
    tools: { search: "search", searchArgKey: "query", read: "read", readArgKey: "fileId" },
  },
  {
    id: "onedrive",
    name: "OneDrive",
    description: "Accede a archivos de Microsoft OneDrive / SharePoint.",
    icon: "ti-brand-onedrive",
    entrypoint: "npx -y @modelcontextprotocol/server-onedrive",
    credentialFields: [
      { key: "ONEDRIVE_CLIENT_ID", label: "Client ID", type: "text", required: true },
      { key: "ONEDRIVE_CLIENT_SECRET", label: "Client Secret", type: "password", required: true },
      { key: "ONEDRIVE_REFRESH_TOKEN", label: "Refresh token", type: "password", required: true },
    ],
    setup: {
      steps: [
        "Entra al portal de Azure (portal.azure.com) → «Microsoft Entra ID → App registrations → New registration».",
        "Registra la app (cuenta personal o de organización) y copia el «Application (client) ID» → es el Client ID.",
        "En «Certificates & secrets → New client secret», genera un secreto y copia su valor → es el Client Secret.",
        "En «API permissions» añade Microsoft Graph → permisos delegados «Files.Read.All» y «offline_access», y concede el consentimiento.",
        "Obtén un refresh_token con el flujo OAuth2 authorization code (redirige a /authorize y canjea el code en /token con scope offline_access).",
        "Pega aquí el Client ID, Client Secret y Refresh token, y pulsa «Guardar y conectar».",
      ],
      docUrl: "https://learn.microsoft.com/azure/active-directory/develop/quickstart-register-app",
      docLabel: "Guía: registrar app en Azure",
    },
    tools: { search: "search", searchArgKey: "query", read: "read", readArgKey: "itemId" },
  },
  {
    id: "dropbox",
    name: "Dropbox",
    description: "Busca y adjunta archivos de Dropbox.",
    icon: "ti-brand-dropbox",
    entrypoint: "npx -y @modelcontextprotocol/server-dropbox",
    credentialFields: [
      { key: "DROPBOX_ACCESS_TOKEN", label: "Access token", type: "password", required: true },
    ],
    setup: {
      steps: [
        "Entra a la App Console de Dropbox (dropbox.com/developers/apps) y pulsa «Create app».",
        "Elige «Scoped access» y «Full Dropbox» (o «App folder» si quieres limitar el alcance), y ponle un nombre.",
        "En la pestaña «Permissions» activa «files.metadata.read» y «files.content.read», y pulsa «Submit».",
        "En la pestaña «Settings», sección «OAuth 2», pulsa «Generate» bajo «Generated access token» y copia el token.",
        "Pega aquí el Access token y pulsa «Guardar y conectar».",
      ],
      docUrl: "https://www.dropbox.com/developers/apps",
      docLabel: "Abrir App Console de Dropbox",
    },
    tools: { search: "search", searchArgKey: "query", read: "download", readArgKey: "path" },
  },
  {
    id: "notion",
    name: "Notion",
    description: "Consulta páginas y bases de datos de Notion.",
    icon: "ti-brand-notion",
    entrypoint: "npx -y @notionhq/notion-mcp-server",
    credentialFields: [
      { key: "NOTION_API_KEY", label: "Integration token", type: "password", required: true },
    ],
    setup: {
      steps: [
        "Entra a «My integrations» de Notion (notion.so/my-integrations) y pulsa «New integration».",
        "Asígnale un nombre y el workspace, créala y copia el «Internal Integration Token» (empieza por «secret_»).",
        "Abre cada página o base de datos que quieras consultar → menú «•••» → «Connections» → añade tu integración (sin esto Notion no la verá).",
        "Pega aquí el Integration token y pulsa «Guardar y conectar».",
      ],
      docUrl: "https://www.notion.so/my-integrations",
      docLabel: "Abrir integraciones de Notion",
    },
    tools: { search: "search", searchArgKey: "query", read: "fetch", readArgKey: "id" },
  },
];

export function getCatalogEntry(id: string): OfficeConnectorCatalogEntry | undefined {
  return OFFICE_CONNECTORS_CATALOG.find((c) => c.id === id);
}
