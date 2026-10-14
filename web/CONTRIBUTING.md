# Contributing to LUXIPANEL

Thanks for your interest in contributing to LUXIPANEL. This document explains
the inbound license terms for contributions and a few project conventions.

This file is informational, not legal advice.

## License of contributions

LUXIPANEL is licensed under the **GNU Affero General Public License v3.0 only
(AGPL-3.0-only)**. Unless explicitly agreed otherwise in writing, all
contributions you submit are provided under the **AGPL-3.0-only**.

## Developer Certificate of Origin (DCO) + license-back

To contribute, you must:

1. **Sign off every commit** to certify the Developer Certificate of Origin
   (DCO 1.1, reproduced below). Add a `Signed-off-by` line using your real name
   and email:

   ```
   Signed-off-by: Jane Doe <jane@example.com>
   ```

   You can do this automatically with `git commit -s`.

2. **Grant LUXISOFT a license-back.** By signing off, and in addition to the
   DCO, you agree that:

   > You grant to LUXISOFT a perpetual, worldwide, non-exclusive, royalty-free,
   > irrevocable license to use, reproduce, modify, prepare derivative works of,
   > publicly display, sublicense, and distribute your contribution and such
   > derivative works, **under the AGPL-3.0-only and under any other license
   > terms** (including proprietary/commercial licenses), as part of LUXIPANEL
   > or any LUXISOFT product or service. You represent that you are legally
   > entitled to grant this license and that the contribution is your original
   > work (or you have the necessary rights to submit it).

   This license-back lets LUXISOFT relicense or dual-license the combined work
   (the usual open-core monetization model) while keeping the public project
   fully AGPL-3.0. You retain copyright in your contribution.

If your employer has rights to work you create, ensure you have permission to
contribute, or have your employer sign off as well.

### Developer Certificate of Origin 1.1

```
By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I have the right
    to submit it under the open source license indicated in the file; or

(b) The contribution is based upon previous work that, to the best of my
    knowledge, is covered under an appropriate open source license and I have
    the right under that license to submit that work with modifications, whether
    created in whole or in part by me, under the same open source license
    (unless I am permitted to submit under a different license), as indicated in
    the file; or

(c) The contribution was provided directly to me by some other person who
    certified (a), (b) or (c) and I have not modified it.

(d) I understand and agree that this project and the contribution are public and
    that a record of the contribution (including all personal information I
    submit with it, including my sign-off) is maintained indefinitely and may be
    redistributed consistent with this project or the open source license(s)
    involved.
```

## Trademarks

The names and logos "LUXIPANEL" and "LUXISOFT" are trademarks of LUXISOFT and
are **not** licensed under the AGPL-3.0 (see the NOTICE file). Contributions must
not add new uses of these Marks that imply affiliation or endorsement beyond the
existing first-party branding of this repository, and forks/redistributions must
rename per the NOTICE. Questions: legal@luxisoft.com.

## Development conventions

- Two independent pnpm projects: `backend/` (Express 5 + TypeScript) and
  `frontend/` (Astro SSR). See `CLAUDE.md` for architecture and module rules.
- Keep every source file's SPDX header intact:
  `// SPDX-License-Identifier: AGPL-3.0-only` and the LUXISOFT copyright line.
- Before opening a PR, run the applicable checks from each affected project:
  backend `pnpm run typecheck`, `pnpm run lint`, `pnpm test`; frontend
  `pnpm test:unit` and `pnpm run build`. The frontend `pnpm test` runs
  Playwright end-to-end tests when that environment is available.
- Follow the per-module structure (models → repositories → services →
  controllers → routes → index) and the extracted-scripts pattern for the
  frontend.

## Security

Please report security vulnerabilities privately (see `SECURITY.md`); do not
open public issues for security reports.
