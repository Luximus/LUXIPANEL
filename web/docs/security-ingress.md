# Verified ingress and shared rate limits

The backend accepts a forwarded client address only when the TCP peer is
loopback and both internal headers match the configured ingress. Direct calls,
including calls by local tenants, use the TCP peer for rate limiting. All API
limits use Redis; `/api/health` is excluded from the global limit.

## Deployment requirements

1. Generate a random secret with at least 32 characters. Store it as
   `LUXIPANEL_PROXY_SECRET` in the backend environment with mode `0600`.
2. Store the same value in a root owned NGINX configuration with mode `0600`.
   Keep the value out of source control, browser responses and request logs.
3. In **every location** that proxies panel traffic to Astro or the API,
   overwrite the inbound headers:

   ```nginx
   proxy_set_header X-Luxipanel-Proxy-Secret $luxipanel_proxy_secret;
   proxy_set_header X-Luxipanel-Client-IP $luxipanel_client_ip;
   ```

   Define `$luxipanel_proxy_secret` from the protected local configuration.
   Derive `$luxipanel_client_ip` from the real TCP transport. When Cloudflare is
   used, accept `CF-Connecting-IP` only if `$realip_remote_addr` belongs to the
   official Cloudflare ranges. Loopback and other application servers do not
   qualify as Cloudflare edges. Do not trust a client supplied forwarding header
   for direct traffic.
4. Preserve these settings when regenerating the panel vhost. Run `nginx -t`,
   reload NGINX and restart the backend with the updated environment.

## Verification

- Login and health must work through the public proxy.
- A loopback request with forged forwarding headers and no ingress secret must
  use the loopback Redis bucket, even if the claimed client IP changes.
- A request through NGINX must use the verified client IP.
- Never log the internal secret or include it in a response.

Missing or mismatched attestation fails closed: forwarded addresses are ignored
and requests share their TCP peer's rate limit. Redis failures do not silently
switch to independent in-memory counters.
