// Lazy internal components; routes identify views and are never fetched as HTML.
export const MODULE_REGISTRY = {
  backups: {
    route: "/panel/backups",
    namespaces: ["components", "common", "backups", "deps"],
    load: () => import("./views/pages_panel_backups_index"),
    controller: () =>
      import("virtual:lxp-controller/pages_panel_backups_index"),
  },
  bitninja: {
    route: "/panel/bitninja",
    namespaces: ["components", "common", "bitninja"],
    load: () => import("./views/pages_panel_bitninja_index"),
    controller: () =>
      import("virtual:lxp-controller/pages_panel_bitninja_index"),
  },
  chat: {
    route: "/panel/chat",
    namespaces: ["components", "common", "chat"],
    load: () => import("./views/pages_panel_chat_index"),
  },
  cloudflare: {
    route: "/panel/cloudflare",
    namespaces: ["components", "common", "cloudflare", "settings"],
    load: () => import("./views/pages_panel_cloudflare_index"),
    controller: () =>
      import("virtual:lxp-controller/pages_panel_cloudflare_index"),
  },
  "codebase-graph": {
    route: "/panel/codebase-graph",
    namespaces: ["components", "common", "codebaseGraph"],
    load: () => import("./views/pages_panel_codebase_graph_index"),
    controller: () =>
      import("virtual:lxp-controller/pages_panel_codebase_graph_index"),
  },
  cron: {
    route: "/panel/cron",
    namespaces: ["components", "common", "cron", "deps"],
    load: () => import("./views/pages_panel_cron_index"),
    controller: () => import("virtual:lxp-controller/pages_panel_cron_index"),
  },
  databases: {
    route: "/panel/databases",
    namespaces: ["components", "common", "databases", "deps"],
    load: () => import("./views/pages_panel_databases_index"),
    controller: () =>
      import("virtual:lxp-controller/pages_panel_databases_index"),
  },
  expo: {
    route: "/panel/expo",
    namespaces: ["components", "common", "expo", "settings"],
    load: () => import("./views/pages_panel_expo_index"),
    controller: () => import("virtual:lxp-controller/pages_panel_expo_index"),
  },
  files: {
    route: "/panel/files",
    namespaces: ["components", "common", "files", "deps"],
    load: () => import("./views/pages_panel_files_index"),
    controller: () => import("virtual:lxp-controller/pages_panel_files_index"),
  },
  firewall: {
    route: "/panel/firewall",
    namespaces: ["components", "common", "firewall"],
    load: () => import("./views/pages_panel_firewall_index"),
    controller: () =>
      import("virtual:lxp-controller/pages_panel_firewall_index"),
  },
  hosting: {
    route: "/panel/hosting",
    namespaces: ["components", "common", "hosting", "permissions"],
    load: () => import("./views/pages_panel_hosting_index"),
    controller: () =>
      import("virtual:lxp-controller/pages_panel_hosting_index"),
  },
  mail: {
    route: "/panel/mail",
    namespaces: ["components", "common", "mail", "deps"],
    load: () => import("./views/pages_panel_mail_index"),
    controller: () => import("virtual:lxp-controller/pages_panel_mail_index"),
  },
  "module-dev/logs": {
    route: "/panel/module-dev/logs", namespaces: ["components", "common", "moduleDev"],
    load: () => import("./views/pages_panel_module_dev_logs"),
  },
  "module-dev": {
    route: "/panel/module-dev",
    namespaces: ["components", "common", "moduleDev"],
    load: () => import("./views/pages_panel_module_dev_index"),
    controller: () =>
      import("virtual:lxp-controller/pages_panel_module_dev_index"),
  },
  modules: {
    route: "/panel/modules",
    namespaces: ["components", "common", "modules", "moduleCatalog"],
    load: () => import("./views/pages_panel_modules_index"),
    controller: () =>
      import("virtual:lxp-controller/pages_panel_modules_index"),
  },
  monitor: {
    route: "/panel/monitor",
    namespaces: ["components", "common", "monitor"],
    load: () => import("./views/pages_panel_monitor_index"),
    controller: () =>
      import("virtual:lxp-controller/pages_panel_monitor_index"),
  },
  nginx: {
    route: "/panel/nginx",
    namespaces: ["components", "common", "nginx", "deps"],
    load: () => import("./views/pages_panel_nginx_index"),
    controller: () => import("virtual:lxp-controller/pages_panel_nginx_index"),
  },
  obsidian: {
    route: "/panel/obsidian",
    namespaces: ["components", "common", "obsidian"],
    load: () => import("./views/pages_panel_obsidian_index"),
    controller: () =>
      import("virtual:lxp-controller/pages_panel_obsidian_index"),
  },
  openclaw: {
    route: "/panel/openclaw",
    namespaces: ["components", "common", "openclaw", "settings"],
    load: () => import("./views/pages_panel_openclaw_index"),
    controller: () =>
      import("virtual:lxp-controller/pages_panel_openclaw_index"),
  },
  preferences: {
    route: "/panel/preferences",
    namespaces: ["components", "common", "preferences"],
    load: () => import("./views/pages_panel_preferences_index"),
    controller: () =>
      import("virtual:lxp-controller/pages_panel_preferences_index"),
  },
  "project-map": {
    route: "/panel/project-map",
    namespaces: ["components", "common", "projectMap"],
    load: () => import("./views/pages_panel_project_map_index"),
    controller: () =>
      import("virtual:lxp-controller/pages_panel_project_map_index"),
  },
  "repository-store": {
    route: "/panel/repository-store",
    namespaces: ["components", "common", "repositoryStore", "settings"],
    load: () => import("./views/pages_panel_repository_store_index"),
    controller: () =>
      import("virtual:lxp-controller/pages_panel_repository_store_index"),
  },
  "server-alerts": {
    route: "/panel/server-alerts",
    namespaces: ["components", "common", "serverAlerts"],
    load: () => import("./views/pages_panel_server_alerts_index"),
    controller: () =>
      import("virtual:lxp-controller/pages_panel_server_alerts_index"),
  },
  settings: {
    route: "/panel/settings",
    namespaces: [
      "components",
      "common",
      "settings",
      "files",
      "repositoryStore",
      "servers",
    ],
    load: () => import("./views/pages_panel_settings_index"),
    controller: () =>
      import("virtual:lxp-controller/pages_panel_settings_index"),
  },
  terminal: {
    route: "/panel/terminal",
    namespaces: ["components", "common", "terminal"],
    load: () => import("./views/pages_panel_terminal_index"),
  },
  users: {
    route: "/panel/users",
    namespaces: ["components", "common", "users", "permissions"],
    load: () => import("./views/pages_panel_users_index"),
    controller: () => import("virtual:lxp-controller/pages_panel_users_index"),
  },
  webhooks: {
    route: "/panel/webhooks",
    namespaces: ["components", "common", "webhooks"],
    load: () => import("./views/pages_panel_webhooks_index"),
    controller: () =>
      import("virtual:lxp-controller/pages_panel_webhooks_index"),
  },
  "mail/[id]/inbox": {
    route: "/panel/mail/[id]/inbox",
    namespaces: ["components", "common", "mail"],
    load: () => import("./views/pages_panel_mail__id__inbox"),
    controller: () =>
      import("virtual:lxp-controller/pages_panel_mail__id__inbox"),
  },
  "mail/compose": {
    route: "/panel/mail/compose",
    namespaces: ["components", "common", "mail"],
    load: () => import("./views/pages_panel_mail_compose"),
    controller: () => import("virtual:lxp-controller/pages_panel_mail_compose"),
  },
  "repository-store/[owner]/[repo]": {
    route: "/panel/repository-store/[owner]/[repo]",
    namespaces: ["components", "common", "repositoryStore"],
    load: () => import("./views/pages_panel_repository_store__owner___repo_"),
    controller: () =>
      import("virtual:lxp-controller/pages_panel_repository_store__owner___repo_"),
  },
  "docs/hosting-api": {
    route: "/panel/docs/hosting-api",
    namespaces: ["components", "common", "hosting"],
    load: () => import("./views/pages_panel_docs_hosting_api"),
  },
} as const;
export type ModuleId = keyof typeof MODULE_REGISTRY;
