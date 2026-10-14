// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Default terminal snippet library — seeded the first time a server's snippet
 * store is empty for a user (see `snippetsRepository.getState`). It is seeded
 * PER USER, so every account that opens the Snippets panel on a new server gets
 * its own editable copy. Every group becomes a category, its `tags` become tags
 * scoped to that category, and each snippet is linked to the listed tags.
 *
 * SECURITY: snippets are EXECUTED automatically on click (the client sends the
 * command with "\r"). Therefore default commands are READ-ONLY / diagnostic:
 * nothing that installs, restarts, kills processes, changes permissions, or
 * deletes. EXCEPTION: the "LUXIPANEL" category holds this panel's own deploy
 * commands (build / pm2 restart / nginx reload) — the AI agents are forbidden
 * from running these (see BASE_SYSTEM_PROMPT) and the user runs them from the
 * snippet selector instead. Its MUTATING snippets are tagged with the tags in
 * `MUTATING_SNIPPET_TAGS`, and the chat snippet drawer requires a second-click
 * confirmation before executing any snippet carrying one of those tags. If you
 * add commands elsewhere, keep the read-only invariant.
 *
 * Texts are in English by design (shown verbatim in the UI for all locales).
 */

export interface DefaultSnippet {
  name: string;
  command: string;
  tags: string[];
}

export interface DefaultSnippetGroup {
  category: string;
  tags: string[];
  snippets: DefaultSnippet[];
}

export const DEFAULT_SNIPPET_GROUPS: DefaultSnippetGroup[] = [
  {
    category: "System",
    tags: ["info", "resources"],
    snippets: [
      { name: "Kernel information", command: "uname -a", tags: ["info"] },
      { name: "OS version", command: "cat /etc/os-release", tags: ["info"] },
      { name: "Uptime and load", command: "uptime", tags: ["resources"] },
      { name: "Free memory", command: "free -h", tags: ["resources"] },
      { name: "CPU summary", command: "lscpu | head -20", tags: ["info"] },
      { name: "Date and timezone", command: "timedatectl", tags: ["info"] },
    ],
  },
  {
    category: "Files",
    tags: ["list", "search"],
    snippets: [
      { name: "Detailed list", command: "ls -lah", tags: ["list"] },
      { name: "Current path", command: "pwd", tags: ["list"] },
      { name: "Item sizes", command: "du -sh ./* 2>/dev/null", tags: ["list"] },
      { name: "Find files by name", command: 'find . -type f -iname "*.conf"', tags: ["search"] },
      { name: "Recursive text search", command: 'grep -rni "error" .', tags: ["search"] },
      { name: "Last lines of a log", command: "tail -n 100 /var/log/syslog", tags: ["search"] },
    ],
  },
  {
    category: "Network",
    tags: ["connections", "diagnostics"],
    snippets: [
      { name: "Listening ports", command: "ss -tulpn", tags: ["connections"] },
      { name: "Interfaces and IP addresses", command: "ip a", tags: ["connections"] },
      { name: "Routing table", command: "ip route", tags: ["connections"] },
      { name: "Established connections", command: "ss -tan state established", tags: ["connections"] },
      { name: "Ping test", command: "ping -c 4 8.8.8.8", tags: ["diagnostics"] },
      { name: "DNS resolution", command: "getent hosts luxipanel.com", tags: ["diagnostics"] },
    ],
  },
  {
    category: "Processes",
    tags: ["list", "resources"],
    snippets: [
      { name: "Top by memory", command: "ps aux --sort=-%mem | head -15", tags: ["resources"] },
      { name: "Top by CPU", command: "ps aux --sort=-%cpu | head -15", tags: ["resources"] },
      { name: "Load summary (top)", command: "top -b -n 1 | head -20", tags: ["resources"] },
      { name: "Find process", command: "pgrep -af node", tags: ["list"] },
      { name: "Process tree", command: "ps -ejH | head -30", tags: ["list"] },
    ],
  },
  {
    category: "Disks",
    tags: ["usage", "partitions"],
    snippets: [
      { name: "Disk usage", command: "df -h", tags: ["usage"] },
      { name: "Usage by folder", command: "du -sh /var/* 2>/dev/null", tags: ["usage"] },
      { name: "Available inodes", command: "df -i", tags: ["usage"] },
      { name: "Largest files (here)", command: "du -ah . 2>/dev/null | sort -rh | head -15", tags: ["usage"] },
      { name: "Partitions and blocks", command: "lsblk", tags: ["partitions"] },
    ],
  },
  {
    category: "Services",
    tags: ["status", "logs"],
    snippets: [
      { name: "Running services", command: "systemctl list-units --type=service --state=running --no-pager", tags: ["status"] },
      { name: "Failed services", command: "systemctl --failed --no-pager", tags: ["status"] },
      { name: "Nginx status", command: "systemctl status nginx --no-pager", tags: ["status"] },
      { name: "Latest system logs", command: "journalctl -n 100 --no-pager", tags: ["logs"] },
      { name: "Boot errors", command: "journalctl -b -p err --no-pager | tail -50", tags: ["logs"] },
    ],
  },
  {
    category: "Packages",
    tags: ["query"],
    snippets: [
      { name: "Installed packages", command: "apt list --installed 2>/dev/null | head -40", tags: ["query"] },
      { name: "Available updates", command: "apt list --upgradable 2>/dev/null", tags: ["query"] },
      { name: "Search package", command: "apt-cache search nginx | head", tags: ["query"] },
      { name: "Package info", command: "apt-cache show nginx | head -30", tags: ["query"] },
    ],
  },
  {
    category: "Users",
    tags: ["identity", "session"],
    snippets: [
      { name: "User and IDs", command: "id", tags: ["identity"] },
      { name: "Who am I", command: "whoami", tags: ["identity"] },
      { name: "System users", command: "cut -d: -f1 /etc/passwd | sort", tags: ["identity"] },
      { name: "Active sessions", command: "who", tags: ["session"] },
      { name: "Last logins", command: "last -n 15", tags: ["session"] },
    ],
  },
  {
    // Deploy/ops commands for a LUXIPANEL installation itself. The AI agents
    // must NOT run builds/restarts (base prompt rule) — the user runs them
    // here. `build`, `pm2` and `nginx` are mutating tags (confirmation gate).
    category: "LUXIPANEL",
    tags: ["build", "pm2", "nginx", "logs", "status"],
    snippets: [
      { name: "Build frontend", command: "cd /var/www/LUXIPANEL/frontend && npm run build", tags: ["build"] },
      { name: "Build backend", command: "cd /var/www/LUXIPANEL/backend && npm run build", tags: ["build"] },
      { name: "Restart frontend", command: "pm2 restart luxipanel-frontend", tags: ["pm2"] },
      { name: "Restart backend", command: "pm2 restart luxipanel-backend", tags: ["pm2"] },
      { name: "Build + restart frontend", command: "cd /var/www/LUXIPANEL/frontend && npm run build && pm2 restart luxipanel-frontend", tags: ["build", "pm2"] },
      { name: "Build + restart backend", command: "cd /var/www/LUXIPANEL/backend && npm run build && pm2 restart luxipanel-backend", tags: ["build", "pm2"] },
      { name: "Save pm2 process list", command: "pm2 save", tags: ["pm2"] },
      { name: "pm2 process list", command: "pm2 list", tags: ["status"] },
      { name: "Backend logs", command: "pm2 logs luxipanel-backend --lines 100 --nostream", tags: ["logs"] },
      { name: "Frontend logs", command: "pm2 logs luxipanel-frontend --lines 100 --nostream", tags: ["logs"] },
      { name: "Test + reload nginx", command: "sudo nginx -t && sudo systemctl reload nginx", tags: ["nginx"] },
      { name: "Nginx status", command: "systemctl status nginx --no-pager", tags: ["status"] },
      { name: "Panel ports listening", command: "ss -ltnp | grep -E ':(80|443|8080|4321)'", tags: ["status"] },
    ],
  },
];

/**
 * Tags whose snippets MUTATE the system (build/restart/reload). UI consumers
 * that execute on click (the chat snippet drawer) must ask for an explicit
 * second-click confirmation before running a snippet tagged with any of these.
 */
export const MUTATING_SNIPPET_TAGS = ["build", "pm2", "nginx", "deploy"] as const;
