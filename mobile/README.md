# LUXIPANEL mobile

Install dependencies with `pnpm install --frozen-lockfile`. Add your own server name and URL on first launch and sign in with its Linux/panel account. No shared password is provided.

The active entry is `App.tsx` → `DirectPanelApp`. Run `pnpm start`; native packaging uses Expo/EAS. The default config uses generic app identifiers and no publisher project. Optional Firebase/ADI/EAS settings come from your own ignored `.env` or `app.config.local.json`. Keep Google service files, credentials and signing material outside Git. Configure your own EAS project/owner before a store build. `eas.json` points submit credentials to the ignored `credentials/` directory.

Consult ARCHITECTURE.md for runtime contracts. A source release does not submit an application to a store or confirm physical-device behavior.
