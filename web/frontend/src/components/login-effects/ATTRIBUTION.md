# Login background effects — attribution

The `*.jsx`/`*.css` components in this folder are vendored from **React Bits**
(https://reactbits.dev, https://github.com/DavidHDev/react-bits) by David Haz.
They were refreshed from upstream commit `70fff300d4b5eb10d6667605c929fb6bb4042da9`
(2026-09-27). The selection matches the 57 backgrounds published in the
React Bits gallery at that date. `MicroSlats` exists in the source tree but is
not published in the gallery, so it is not offered as a setting.

They are used as selectable animated backgrounds for login and panel layout
(Settings → Layout/UI). Existing saved effect IDs remain valid.

License: **MIT + Commons Clause** — see `REACT-BITS-LICENSE.md` in this folder.
The Commons Clause restricts *selling the Software itself*; here these
components are incidental decorative backgrounds, not the substantial value of
the panel. Keep the license file alongside the components.

Project glue (not vendored): `loaders.ts`, `prop-adapters.ts`, and the registry
under `../../lib/login-effects/`. LUXIPANEL patches to upstream code:

- `Ballpit.jsx` and `Hyperspeed.jsx` import `Timer` from `three` for the
  supported Three.js version.
- `GridScan.jsx` loads face models only if its optional webcam mode is enabled.
  The panel does not expose webcam mode in background settings.
