(() => {
  let I18N = {};
  function loadI18n() {
    try {
      const el = document.getElementById("settings-i18n");
      if (el?.textContent) I18N = JSON.parse(el.textContent);
    } catch {
      I18N = {};
    }
  }
  function t(path, fallback) {
    let node = I18N;
    for (const part of path.split(".")) {
      if (!node || typeof node !== "object") return fallback;
      node = node[part];
    }
    return typeof node === "string" ? node : fallback;
  }
  const wrap = (border, bg) => 'class="flex items-start gap-3 rounded-xl border ' + border + " " + bg + ' px-4 py-3 text-sm"';
  const paint = (state, data) => {
    const card = document.getElementById("admin-bootstrap-card");
    if (!card) return;
    card.classList.remove("hidden");
    if (state === "loading") {
      card.innerHTML = "<div " + wrap("border-border", "bg-card") + '><i class="ti ti-loader-2 text-muted-foreground text-base mt-0.5 animate-spin"></i><div class="min-w-0"><p class="font-medium text-muted-foreground">' + t("bootstrap.verifying", "Verificando el grupo administrador\u2026") + "</p></div></div>";
      return;
    }
    if (state === "done") {
      const who = data && data.adminUsername ? ' \xB7 <span class="font-mono">' + data.adminUsername + "</span>" : "";
      let when = "";
      if (data && data.at) {
        try {
          when = " \xB7 " + new Date(data.at).toLocaleString();
        } catch (e) {
        }
      }
      card.innerHTML = "<div " + wrap("border-emerald-500/30", "bg-emerald-500/5") + '><i class="ti ti-shield-check text-emerald-500 text-base mt-0.5"></i><div class="min-w-0"><p class="font-medium text-emerald-600">' + t("bootstrap.doneTitle", "Grupo administrador asignado") + '</p><p class="text-xs text-muted-foreground">' + t("bootstrap.doneDesc", "Se cre\xF3 el grupo de usuarios <b>administrador</b> (rol) en este servidor y se asign\xF3 al usuario que ingres\xF3 por SSH, en la primera conexi\xF3n") + who + when + ". " + t("bootstrap.doneOnce", "Esto se hace una sola vez.") + "</p></div></div>";
      return;
    }
    if (state === "pending") {
      card.innerHTML = "<div " + wrap("border-amber-500/40", "bg-amber-500/5") + '><i class="ti ti-alert-triangle text-amber-500 text-base mt-0.5"></i><div class="min-w-0"><p class="font-medium text-amber-600">' + t("bootstrap.pendingTitle", "Falta crear el grupo administrador") + '</p><p class="text-xs text-muted-foreground">' + t("bootstrap.pendingDesc", "A\xFAn no se ha creado el grupo de usuarios <b>administrador</b> (rol) ni se ha asignado al usuario SSH en este servidor. Se hace autom\xE1ticamente en la primera conexi\xF3n SSH desde LP-LICENSE-SERVER; vuelve a iniciar sesi\xF3n con el usuario propietario para completarlo.") + "</p></div></div>";
      return;
    }
    card.innerHTML = "<div " + wrap("border-border", "bg-card") + '><i class="ti ti-info-circle text-muted-foreground text-base mt-0.5"></i><div class="min-w-0"><p class="text-xs text-muted-foreground">' + t("bootstrap.errorDesc", "No se pudo verificar el estado del administrador en este momento.") + "</p></div></div>";
  };
  const load = async () => {
    if (!document.getElementById("admin-bootstrap-card")) return;
    loadI18n();
    paint("loading");
    try {
      const res = await fetch("/api/auth/bootstrap-status", { credentials: "include", cache: "no-store", headers: { accept: "application/json" } });
      if (!res.ok) {
        paint("error");
        return;
      }
      const json = await res.json();
      const data = json && json.data ? json.data : null;
      paint(data && data.adminBootstrapped ? "done" : "pending", data);
    } catch (e) {
      paint("error");
    }
  };
  let tries = 0;
  const kick = () => {
    if (document.getElementById("admin-bootstrap-card")) {
      void load();
      return;
    }
    if (tries++ < 20) setTimeout(kick, 100);
  };
  kick();
  document.addEventListener("astro:page-load", () => {
    tries = 0;
    kick();
  });
})();
