// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * NGINX module path constants (single source of truth).
 *
 * The Debian-style nginx layout: real server blocks live in
 * `sites-available` and are activated by symlinking them into
 * `sites-enabled`. These two paths are referenced across the nginx
 * services and by the webhooks nginx discovery detector — keep them here
 * so a layout change lands in exactly one place.
 */

export const SITES_AVAILABLE = "/etc/nginx/sites-available";
export const SITES_ENABLED = "/etc/nginx/sites-enabled";

// ── Layout paths (extended SSOT) ──

export const NGINX_CONF = "/etc/nginx/nginx.conf";
export const NGINX_CONF_D = "/etc/nginx/conf.d";
export const NGINX_VHOSTS_D = "/etc/nginx/vhosts.d";
export const NGINX_VHOST_D = "/etc/nginx/vhost.d";
export const NGINX_SNIPPETS_DIR = "/etc/nginx/snippets";
export const NGINX_LOG_DIR = "/var/log/nginx";
export const NGINX_CACHE_DIR = "/var/cache/nginx";
export const CERTBOT_WEBROOT = "/var/www/certbot";

/** Standard HTTP / HTTPS ports used in `listen` directives. */
export const HTTP_PORT = 80;
export const HTTPS_PORT = 443;

/** Standard access/error log filenames (under `NGINX_LOG_DIR`). */
export const NGINX_ACCESS_LOG = "access.log";
export const NGINX_ERROR_LOG = "error.log";
