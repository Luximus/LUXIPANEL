# LUXIPANEL

Reviewed on 13 October 2026

LUXIPANEL runs on your Linux server and manages local resources and SSH targets. LP-LICENSE-SERVER powers the account, payments, tokens, module catalog and editorial services on luxipanel.com. Creating an account does not install a panel or register a server.

[en](README.md) | [es](translations/README.es.md) | [fr](translations/README.fr.md) | [de](translations/README.de.md) | [it](translations/README.it.md) | [pt](translations/README.pt.md) | [ru](translations/README.ru.md) | [ar](translations/README.ar.md) | [hi](translations/README.hi.md) | [bn](translations/README.bn.md) | [ja](translations/README.ja.md) | [ko](translations/README.ko.md)

## Before installation

Use a Debian/Ubuntu host with administrator access, a hostname and working DNS. The current packages require Node.js 22.12 or later and declare pnpm 11.5.0. Redis, nginx and the system services used by enabled modules must be available. Review install.sh before running it: it installs dependencies and changes system configuration.

## Install and sign in

From the LUXIPANEL repository, run the installer with your own hostname. Use --https when the public origin uses TLS, or --cloudflare when applicable. Configure DNS and a valid certificate, then open /login and sign in with an existing Linux user. The first eligible sudo/wheel user can become the panel administrator. There is one self-hosted operating mode; the old managed-mode setup is not the current installation path.

```bash
sudo bash install.sh --domain panel.example.com --https
```

## Local access

The panel authenticates against the Linux system and applies its own roles and module permissions. Website account credentials and account API keys do not replace the Linux login. The local executor operates on the machine hosting LUXIPANEL.

## Select the target before acting

Choose the local server or an SSH connection in the installed panel. Files, terminal, services and other supported operations run against the selected target, subject to module capabilities and permissions. Check the target name before writing files, restarting services or deleting resources.

## Add and use an SSH target

In the installed panel’s server selector, add the host, port, SSH user and credential. Credentials are stored encrypted on that panel, not in the website’s retired server inventory. Verify the destination, switch to it and test a read operation before making changes. SSH access does not make every module available on every operating system.

## Connection troubleshooting

Check reachability, SSH port, credentials and the remote user’s privileges. Private-address targets are restricted by the server policy; SERVERS_ALLOW_PRIVATE is an administrator setting for legitimate private networks. Do not disable host verification or expose credentials to work around a failure. Reconnect when the SSH session expires.

## Create a named API key

Open Security → API KEY in your website account, complete the required security checks and create a key with a descriptive name. Copy the secret when it is shown and enter it through API KEY in your installed LUXIPANEL. You do not select a server, IP or SSH credential on luxipanel.com. The key identifies your account for the services it authorizes.

## Rotate or revoke a key

The full secret is shown only on creation or rotation. After rotating it, replace it in every installation that uses it. Revocation stops authorization and cancels active module subscriptions associated with that key. Treat a key as a secret: do not include it in screenshots, logs, repositories or support messages.

## Install and manage modules

Open Modules on the installed panel to inspect the catalog, permissions, dependencies and availability. Enable or install the desired module according to your role. Built-in capabilities and marketplace modules have different requirements. For paid modules, review the actual catalog price and terms before subscribing.

## Configure integrations on the installed panel

Configure supported providers in their own module: Cloudflare for DNS and related zone operations, GitHub for repositories, Expo for EAS workflows, and assistant providers/connectors where enabled. Each integration needs its own credentials and permissions. The former website cloud-server import and managed-subdomain flow is not the setup path.

## Mobile: direct panel access

Add the URL of an already installed LUXIPANEL, select the connection and sign in with the panel/Linux user. The active app uses native React Native module screens. Remember me stores session material in secure storage rather than the Linux password. Available modules and actions depend on the selected server and its permissions.

## Desktop: profiles and tabs

Save a profile with a name and the URL of an installed panel, test the connection and open a tab. Desktop displays that panel’s web interface in an isolated Electron view. Tabs in one profile share the session; different profiles use separate storage. Changing a profile URL clears its previous storage. Closing the window leaves the tray active; Quit exits the application.

## Updates and recovery

Back up configuration and encrypted credentials before updating. Keep the credential-vault key: changing it makes existing stored credentials unreadable. Compile one project at a time. Build Astro from a clean dist with NODE_OPTIONS=--max-old-space-size=2560, then restart its process and check HTTP responses. When changing a PM2 environment file, restart the ecosystem configuration with --only and --update-env so the new values are evaluated.

## Prepare a useful report

Include the affected product, client and panel versions, time of failure, selected target, exact error and reproduction steps. Explain the expected result and attach a redacted screenshot or log excerpt. Never send passwords, private keys, full API keys, session cookies or two-factor recovery codes.

## Related guides

- [Self-hosting](SELF-HOSTING.md)
- [Despliegue](DESPLIEGUE-STANDALONE.md)
- [Module SDK](MODULE-SDK-SPEC.md)
- [Testing](TESTING.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [License](LICENSE)
