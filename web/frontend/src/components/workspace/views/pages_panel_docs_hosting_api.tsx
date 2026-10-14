// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/docs/hosting-api.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Guía web del contrato de proveedores de HOSTING v1. */
import PanelLayout from "../module-frame";
import { adminRedirect, getPageMessages } from "../view-context";
export default function pages_panel_docs_hosting_api(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const denied = adminRedirect(Astro);
  if (denied) return denied;
  const t = getPageMessages(Astro, ["hosting"]);
  const d = t.hosting.apiDocs;
  const endpoints = [
    {
      method: "GET",
      path: "/capabilities",
      permission: d.anyProvider,
      description: d.endpointCapabilities,
    },
    {
      method: "PUT",
      path: "/accounts/{accountId}",
      permission: "accounts.write",
      description: d.endpointPutAccount,
    },
    {
      method: "GET",
      path: "/accounts/{accountId}",
      permission: "accounts.read",
      description: d.endpointGetAccount,
    },
    {
      method: "PATCH",
      path: "/accounts/{accountId}",
      permission: "accounts.status",
      description: d.endpointPatchAccount,
    },
    {
      method: "DELETE",
      path: "/accounts/{accountId}",
      permission: "accounts.delete",
      description: d.endpointDeleteAccount,
    },
    {
      method: "GET",
      path: "/accounts/{accountId}/usage",
      permission: "usage.read",
      description: d.endpointUsage,
    },
    {
      method: "PUT",
      path: "/accounts/{accountId}/sites/{siteId}",
      permission: "sites.write",
      description: d.endpointPutSite,
    },
    {
      method: "DELETE",
      path: "/accounts/{accountId}/sites/{siteId}",
      permission: "sites.write",
      description: d.endpointDeleteSite,
    },
    {
      method: "POST",
      path: "/accounts/{accountId}/access-ticket",
      permission: "access.issue",
      description: d.endpointTicket,
    },
  ];
  const methodClass: Record<string, string> = {
    GET: "text-sky-600 dark:text-sky-300",
    PUT: "text-amber-600 dark:text-amber-300",
    PATCH: "text-violet-600 dark:text-violet-300",
    POST: "text-emerald-600 dark:text-emerald-300",
    DELETE: "text-rose-600 dark:text-rose-300",
  };

  return (
    <Fragment>
      <PanelLayout title={d.pageTitle} activeModule="hosting-docs">
        <main className="mx-auto max-w-6xl space-y-9 px-4 pb-16 pt-5 sm:px-6">
          <header className="border-b border-border pb-7">
            <a
              href="/panel/hosting"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              <i className="ti ti-arrow-left" aria-hidden="true"></i>{" "}
              {d.backToHosting}
            </a>
            <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
              <div className="max-w-3xl">
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  {d.contractVersion}
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  {d.heading}
                </h1>
                <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                  {d.intro}
                </p>
              </div>
              <code className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground">
                /api/hosting/v1
              </code>
            </div>
          </header>

          <nav
            aria-label={d.guideContents}
            className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-primary"
          >
            <a href="#preparacion" className="hover:underline">
              {d.preparation}
            </a>
            <a href="#autenticacion" className="hover:underline">
              {d.authentication}
            </a>
            <a href="#operaciones" className="hover:underline">
              {d.operations}
            </a>
            <a href="#ejemplo" className="hover:underline">
              {d.example}
            </a>
            <a href="#acceso" className="hover:underline">
              {d.panelAccess}
            </a>
            <a href="#limites" className="hover:underline">
              {d.limitsErrors}
            </a>
          </nav>

          <section id="preparacion" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-semibold text-foreground">
              {d.preparationHeading}
            </h2>
            <ol className="grid gap-3 md:grid-cols-3">
              <li className="rounded-xl border border-border bg-card p-4">
                <span className="font-mono text-xs text-primary">
                  01 · {d.administrator}
                </span>
                <p className="mt-2 text-sm text-foreground">{d.adminStep}</p>
              </li>
              <li className="rounded-xl border border-border bg-card p-4">
                <span className="font-mono text-xs text-primary">
                  02 · {d.scope}
                </span>
                <p className="mt-2 text-sm text-foreground">{d.scopeStep}</p>
              </li>
              <li className="rounded-xl border border-border bg-card p-4">
                <span className="font-mono text-xs text-primary">
                  03 · {d.key}
                </span>
                <p className="mt-2 text-sm text-foreground">{d.keyStep}</p>
              </li>
            </ol>
            <p className="text-sm text-muted-foreground">
              {d.providerScopeNote}
            </p>
          </section>

          <section id="autenticacion" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-semibold text-foreground">
              {d.authentication}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {d.authNote}
            </p>
            <pre className="overflow-x-auto rounded-xl border border-border bg-muted p-4 text-sm text-foreground">
              <code>
                Authorization: Bearer lhp_YOUR_KEY Content-Type:
                application/json
              </code>
            </pre>
            <p className="text-sm text-muted-foreground">{d.baseNote}</p>
          </section>

          <section id="operaciones" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-semibold text-foreground">
              {d.operationsHeading}
            </h2>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">{d.method}</th>
                    <th className="px-4 py-3">{d.pathFromBase}</th>
                    <th className="px-4 py-3">{d.permission}</th>
                    <th className="px-4 py-3">{d.result}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {endpoints.map((entry: any) => (
                    <Fragment>
                      <tr>
                        <td
                          className={`px-4 py-3 font-mono text-xs font-bold ${methodClass[entry.method]}`}
                        >
                          {entry.method}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-foreground">
                          {entry.path}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {entry.permission}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {entry.description}
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-muted-foreground">{d.idempotencyNote}</p>
          </section>

          <section id="ejemplo" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-semibold text-foreground">
              {d.createAccount}
            </h2>
            <pre className="overflow-x-auto rounded-xl border border-border bg-muted p-4 text-xs leading-relaxed text-foreground">
              <code>{`curl -fsS -X PUT "https://panel.example.org/api/hosting/v1/accounts/account-42" \\
  -H "Authorization: Bearer $LUXIPANEL_HOSTING_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"displayName":"Example Ltd","email":"owner@example.com"}'`}</code>
            </pre>
            <p className="text-sm text-muted-foreground">
              {d.accountResponseNote}
            </p>
            <p className="text-sm text-muted-foreground">{d.siteExampleNote}</p>
          </section>

          <section id="acceso" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-semibold text-foreground">
              {d.clientAccessHeading}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {d.clientAccessNote}
            </p>
          </section>

          <section id="limites" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-semibold text-foreground">
              {d.limitsHeading}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {d.limitsNote}
            </p>
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              <p>{d.errorCodes}</p>
              <p className="mt-2">{d.bandwidthNote}</p>
            </div>
          </section>
        </main>
      </PanelLayout>
    </Fragment>
  );
}
