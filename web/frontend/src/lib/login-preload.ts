/** Download reusable shell code during login without executing authenticated reads. */
export function warmLoginShell() {
  if (!document.getElementById("form-password")) return;
  const connection = (navigator as Navigator & {connection?:{saveData?:boolean;effectiveType?:string}}).connection;
  if (connection?.saveData || ["slow-2g","2g"].includes(connection?.effectiveType ?? "")) return;
  for (const file of ["PanelLayout-define-vars-script1", "notifications", "chat", "server-clock"]) {
    const href = `/scripts/extracted/layouts/${file}.js?v=20261003-startup-v3`;
    if (document.querySelector(`link[rel="modulepreload"][href="${href}"]`)) continue;
    const link = document.createElement("link");link.rel="modulepreload";link.href=href;document.head.appendChild(link);
  }
}
