# LUXIPANEL desktop

Install dependencies with `pnpm install --frozen-lockfile`. Add your own server name and URL on first launch and sign in with its Linux/panel account. No shared password is provided.

The active Electron shell isolates browser sessions by connection profile and loads the selected server UI without Node or privileged preload in remote content. Run `pnpm run dev` or `pnpm run build`. Signing uses private `CSC_LINK` / `CSC_KEY_PASSWORD` environment variables.

Consult ARCHITECTURE.md for runtime contracts. A source release does not submit an application to a store or confirm physical-device behavior.
