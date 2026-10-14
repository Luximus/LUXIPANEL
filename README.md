# LUXIPANEL

Self-hosted server administration for the web, desktop and mobile. This is the current public repository. The previous repository was renamed to [LUXIPANEL-OLD](https://github.com/Luxisoft/LUXIPANEL-OLD).

| Application | Source | How it connects |
| --- | --- | --- |
| Web and server | `web/backend`, `web/frontend` | Runs on your Linux server |
| Desktop | `desktop` | Opens your selected panel in an isolated Electron browser profile |
| Mobile | `mobile` | Native React Native / Expo workspace connected directly to your panel |

## Install the server

Use a supported Debian/Ubuntu server with Node 22, pnpm 11.5, Redis, nginx and PM2. The installer generates installation secrets and configures services; it does not ship a shared administrator password. Sign in with your own Linux/panel account.

```sh
git clone https://github.com/Luxisoft/LUXIPANEL.git
cd LUXIPANEL
sudo bash install.sh --domain panel.example.com
```

Review [the server installation guide](web/DESPLIEGUE-STANDALONE.md) for prerequisites and deployment options. The root commands delegate to `web/`. Start only the panel processes specified in `ecosystem.config.cjs`.

For local development, copy each web package's `.env.example` to `.env`, generate a unique JWT/encryption key as required, then install and build packages one at a time:

```sh
cd web/backend
pnpm install --frozen-lockfile
pnpm run build
cd ../frontend
pnpm install --frozen-lockfile
pnpm run build
```

## Desktop and mobile

Open the application and add a connection with a name and your panel URL. Use that server's own login. No panel credentials or store signing keys are included in the repository.

```sh
cd desktop
pnpm install --frozen-lockfile
pnpm run dev
```

```sh
cd mobile
pnpm install --frozen-lockfile
pnpm start
```

See [desktop usage](desktop/README.md) and [mobile configuration](mobile/README.md). Store publication uses your own private signing and publisher configuration; it is separate from a source release.

## LOG, contributions and updates

**Dev → LOG** has separate LUXIPANEL and Modules tabs. Module entries belong to the selected user/server: their created modules, public reports for their linked modules, and that user's own module execution. Evidence stays in the installation. Sharing a report publishes a sanitized GitHub issue.

Configure an API-mode AI agent and your personal GitHub credential in LOG settings. Automatic repair starts disabled and can be enabled per component/severity with time/token limits. Repairs use isolated worktrees and checks; publication goes to the user's fork and a PR in this repository. Core PRs target `main`; module PRs change only `web/modules/<id>/` and target `modules`.

Reviewed changes are collected in one release PR. Accepted module changes become public only with the official panel Release. Each installation shows version/community notices without requiring a license or GitHub login. Updates are manual; local changes/custom commits stop an update for resolution. Module installation/enabled status, entitlements and server data are preserved.

See [release workflow](RELEASES.md), [LOG behavior](web/docs/module-dev-logs.md), [contributing](CONTRIBUTING.md) and [security](SECURITY.md). Source releases contain all three clients. Store installers require separate platform builds and signing.

## License

LUXIPANEL is distributed under [AGPL-3.0](LICENSE). Dependency notices remain with their respective packages; see [NOTICE](NOTICE).
