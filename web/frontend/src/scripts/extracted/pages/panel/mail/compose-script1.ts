  import { api, getCsrfToken, CSRF_HEADER_NAME, scopeHeaders, resolvePanelApiPath } from "/scripts/extracted/lib/mail-api-client.js?v=20260930a";
  import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
  import { SCRIPT_INIT_COOLDOWN_MS } from "/scripts/extracted/lib/script-init.js";
  import { setCollapsed } from "/scripts/extracted/lib/dom.js";

  // Load i18n translations
  const i18nEl = document.getElementById("compose-i18n");
  const t = i18nEl ? JSON.parse(i18nEl.textContent || "{}") : {};
  const fallback = (path: string, def: string) => {
    const parts = path.split(".");
    let val: any = t;
    for (const part of parts) {
      val = val?.[part];
      if (!val) return def;
    }
    return val || def;
  };

  // Sanitize quoted HTML body (reply/forward of a malicious message).
  //
  // The previous regex sanitizer was bypassable via:
  //   * HTML-entity escaping (`&#x6A;avascript:`)
  //   * Malformed nesting (`<scr<script>ipt>`)
  //   * CSS expressions / `url(javascript:…)`, `<svg onload>`, `<use
  //     href="javascript:…">`, base64 `data:text/html`
  //   * `<style>` CSS-exfil via `background: url(…)`
  //
  // We delegate to a real parser (DOMParser) + an allowlisted node-and-attribute
  // filter (denylisting everything else). The result is structurally clean
  // HTML safe to drop into the editor as a paste-as-quote source.
  //
  // Implemented locally because the compose view runs synchronously and the
  // `vendor/markdown` bundle is heavy (marked + DOMPurify); we only need HTML
  // sanitization here, not markdown rendering.
  const SAFE_TAGS = new Set([
    "A", "B", "BLOCKQUOTE", "BR", "CITE", "CODE", "DD", "DEL", "DIV", "DL",
    "DT", "EM", "FONT", "H1", "H2", "H3", "H4", "H5", "H6", "HR", "I",
    "IMG", "INS", "KBD", "LI", "MARK", "OL", "P", "PRE", "Q", "S", "SAMP",
    "SPAN", "STRIKE", "STRONG", "SUB", "SUP", "TABLE", "TBODY", "TD",
    "TFOOT", "TH", "THEAD", "TR", "TT", "U", "UL", "VAR", "WBR",
  ]);
  // Attributes allowed on `A` and `IMG`. Everything else gets stripped.
  const ANCHOR_ATTRS = new Set(["href", "title", "target", "rel", "name"]);
  const IMG_ATTRS = new Set(["src", "alt", "title", "width", "height"]);
  // Generic safe attributes that may appear on any whitelisted element.
  const GENERIC_ATTRS = new Set(["style"]);
  const SAFE_URL_SCHEMES = /^(https?:|mailto:|tel:|#|\/|\.{1,2}\/)/i;

  function sanitizeQuotedBody(html: any): string {
    if (!html || typeof html !== "string") return "";
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
    const root = doc.body.firstElementChild;
    if (!root) return "";
    const clean = (node: Element): Element | null => {
      const tag = node.tagName.toUpperCase();
      if (!SAFE_TAGS.has(tag)) {
        // Replace disallowed nodes with their text content so a `<script>`
        // body doesn't silently disappear (the user still sees the literal
        // text we couldn't render).
        const txt = doc.createElement("span");
        txt.textContent = node.textContent || "";
        return txt;
      }
      // Drop event-handlers, javascript: URLs, and unknown URLs everywhere.
      for (const attr of Array.from(node.attributes)) {
        const name = attr.name.toLowerCase();
        const value = attr.value;
        // Strip inline event handler attributes (onclick/onerror/…).
        if (name.startsWith("on")) {
          node.removeAttribute(attr.name);
          continue;
        }
        // htmlFor, class, id are stripped by omission; keep this explicit so
        // a future contributor doesn't broaden the allowlist by accident.
        let allowed = false;
        if (tag === "A" && ANCHOR_ATTRS.has(name)) allowed = true;
        if (tag === "IMG" && IMG_ATTRS.has(name)) allowed = true;
        if (GENERIC_ATTRS.has(name)) allowed = true;
        if (!allowed) {
          node.removeAttribute(attr.name);
          continue;
        }
        // URL-bearing attributes are scheme-pinned to a denylist+allowlist
        // to defang `javascript:`, `data:text/html`, etc.
        if (name === "href" || name === "src" || name === "formaction") {
          try {
            const probe = new URL(value, location.origin);
            const scheme = probe.protocol.toLowerCase();
            if (
              !(scheme === "http:" || scheme === "https:" || scheme === "mailto:" || scheme === "tel:")
              && !SAFE_URL_SCHEMES.test(value.trim())
            ) {
              node.removeAttribute(attr.name);
            }
          } catch {
            node.removeAttribute(attr.name);
          }
        }
      }
      // Recurse into children, rebuilding a clean tree.
      for (const child of Array.from(node.children)) {
        const cleaned = clean(child as Element);
        if (!cleaned) {
          child.replaceWith(doc.createTextNode(child.textContent || ""));
        } else if (cleaned !== child) {
          child.replaceWith(cleaned);
        }
      }
      // Drop dangerous children entirely (script/style/etc — already handled
      // by the tag denylist; belt-and-braces for SVG-like embedded payloads).
      for (const child of Array.from(node.querySelectorAll("script,style,iframe,object,embed,form,link,meta,base"))) {
        child.remove();
      }
      return node;
    };
    const cleaned = clean(root);
    return cleaned ? cleaned.outerHTML : "";
  }

  let boundComposeRoot: Element | null = null;
  function mountCompose() {
  const root = document.getElementById("body-rich");
  if (!root || root === boundComposeRoot) return;
  boundComposeRoot = root;
  const searchParams = new URLSearchParams(window.location.search);
  const fromAccountId = searchParams.get("from") ?? "";
  const replyToUid = searchParams.get("replyTo");
  const forwardUid = searchParams.get("forward");
  const sourceFolder = searchParams.get("folder") ?? "";
  let draftUid = searchParams.get("draftUid");
  let draftFolder = sourceFolder || "Drafts";
  let draftAttachmentsReady = true;

  // ── Toast ──────────────────────────────────────────────────
  function showToast(msg: string, ok = true) {
    const t = document.getElementById("toast")!;
    const inner = document.getElementById("toast-inner")!;
    document.getElementById("toast-msg")!.textContent = msg;
    document.getElementById("toast-icon")!.className = `text-base ${ok ? "ti ti-circle-check" : "ti ti-circle-x"}`;
    inner.className = `flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${
      ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
         : "border-destructive/30 bg-destructive/10 text-destructive"}`;
    t.classList.remove("hidden");
    setTimeout(() => t.classList.add("hidden"), 4000);
  }

  // ── Load accounts ──────────────────────────────────────────
async function loadAccounts() {
  const res = await api.get<any>("/api/accounts");
  const sel = document.getElementById("from-account") as HTMLSelectElement;
  if (!res.ok) return;
  const payload = res.data as any;
  const accounts = (Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : []) as any[];
  if (!accounts.length) return;
  // Build options via DOM construction so a malicious `address` cannot inject
  // HTML (`\"<img onerror=...>@evil`) into the select dropdown.
  for (const a of accounts) {
    const opt = document.createElement("option");
    opt.value = String(a.id);
    opt.textContent = String(a.address ?? "");
    if (String(a.id) === String(fromAccountId)) opt.selected = true;
    sel.appendChild(opt);
  }
}

  // ── Address tags ───────────────────────────────────────────
  function makeTagInput(inputId: string, tagsId: string): { getAddresses: () => string[]; addAddress: (address: string) => void } {
    const input = document.getElementById(inputId) as HTMLInputElement;
    const tags = document.getElementById(tagsId)!;
    const addresses: string[] = [];

    function addAddress(addr: string) {
      addr = addr.trim().toLowerCase();
      if (!addr || !addr.includes("@") || addresses.includes(addr)) return;
      addresses.push(addr);
      const tag = document.createElement("span");
      tag.className = "inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium";
      const label = document.createElement("span");
      label.textContent = addr;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "hover:text-primary/70 transition-colors";
      remove.setAttribute("aria-label", `Quitar ${addr}`);
      remove.textContent = "×";
      tag.append(label, remove);
      remove.addEventListener("click", () => {
        const idx = addresses.indexOf(addr);
        if (idx > -1) addresses.splice(idx, 1);
        tag.remove();
      });
      tags.appendChild(tag);
    }

    input.addEventListener("keydown", e => {
      if (["Enter", ",", ";", " ", "Tab"].includes(e.key)) {
        e.preventDefault();
        addAddress(input.value);
        input.value = "";
      }
      if (e.key === "Backspace" && !input.value && addresses.length > 0) {
        const last = addresses[addresses.length - 1];
        addresses.splice(-1);
        tags.lastElementChild?.remove();
      }
    });

    input.addEventListener("blur", () => {
      if (input.value.trim()) { addAddress(input.value); input.value = ""; }
    });

    return { getAddresses: () => addresses, addAddress };
  }

  const toCtrl = makeTagInput("to-input", "to-tags");
  const ccCtrl = makeTagInput("cc-input", "cc-tags");
  const bccCtrl = makeTagInput("bcc-input", "bcc-tags");

  // ── CC toggle ──────────────────────────────────────────────
  document.getElementById("btn-toggle-cc")?.addEventListener("click", () => {
    setCollapsed(document.getElementById("cc-row"));
  });
  document.getElementById("btn-toggle-bcc")?.addEventListener("click", () => setCollapsed(document.getElementById("bcc-row")));

  // ── Format toolbar ─────────────────────────────────────────
  document.querySelectorAll<HTMLButtonElement>(".format-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.execCommand(btn.dataset.cmd!, false);
      document.getElementById("body-rich")!.focus();
    });
  });

  // ── Plain text toggle ──────────────────────────────────────
  let isPlainText = false;
  document.getElementById("btn-plain-text")?.addEventListener("click", () => {
    const rich = document.getElementById("body-rich")!;
    const plain = document.getElementById("body-plain") as HTMLTextAreaElement;
    isPlainText = !isPlainText;
    if (isPlainText) {
      plain.value = rich.innerText;
      rich.classList.add("hidden");
      plain.classList.remove("hidden");
    } else {
      rich.innerText = plain.value;
      plain.classList.add("hidden");
      rich.classList.remove("hidden");
    }
    (document.getElementById("btn-plain-text") as HTMLButtonElement).textContent =
      isPlainText ? fallback("compose.btnRichText", "Rich text") : fallback("compose.btnPlainText", "Texto plano");
  });

  // ── Attachments ────────────────────────────────────────────
  const attachments: File[] = [];

  document.getElementById("btn-attach")?.addEventListener("click", () => {
    document.getElementById("file-input")!.click();
  });

  document.getElementById("file-input")?.addEventListener("change", e => {
    const files = (e.target as HTMLInputElement).files;
    if (!files) return;
    Array.from(files).forEach(f => {
      attachments.push(f);
      addAttachmentTag(f);
    });
    (e.target as HTMLInputElement).value = "";
  });

  function addAttachmentTag(f: File) {
    const preview = document.getElementById("attachments-preview")!;
    const list = document.getElementById("attachments-list")!;
    preview.classList.remove("hidden");
    const size = f.size < 1024 * 1024 ? `${(f.size / 1024).toFixed(0)}KB` : `${(f.size / 1024 / 1024).toFixed(1)}MB`;
    const tag = document.createElement("div");
    tag.className = "flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs";
    const icon = document.createElement("i"); icon.className = "ti ti-paperclip text-muted-foreground";
    const name = document.createElement("span"); name.textContent = f.name;
    const sizeLabel = document.createElement("span"); sizeLabel.className = "text-muted-foreground"; sizeLabel.textContent = size;
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "ml-1 text-muted-foreground hover:text-destructive"; remove.textContent = "×";
    tag.append(icon, name, sizeLabel, remove);
    remove.addEventListener("click", () => {
      const idx = attachments.indexOf(f);
      if (idx > -1) attachments.splice(idx, 1);
      tag.remove();
      if (!attachments.length) preview.classList.add("hidden");
    });
    list.appendChild(tag);
  }

  // ── Load reply/forward data ────────────────────────────────
  async function loadOriginalMessage(uid: string, mode: "reply" | "forward") {
    const fromId = (document.getElementById("from-account") as HTMLSelectElement).value;
    if (!fromId) return;

    const res = await api.get<any>(`/api/mail/${fromId}/messages/${uid}`, {
      params: { folder: sourceFolder || "INBOX" },
    });
    if (!res.ok || !res.data) return;

    const msg = res.data as any;
    const subjectEl = document.getElementById("subject") as HTMLInputElement;
    const richEl = document.getElementById("body-rich")!;

    if (mode === "reply") {
      // Pre-fill To with sender
      const toInput = document.getElementById("to-input") as HTMLInputElement;
      const fromAddr = msg.from?.address || msg.from || "";
      toInput.value = fromAddr;
      toInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

      subjectEl.value = msg.subject?.startsWith("Re:") ? msg.subject : `${fallback("compose.replyPrefix", "Re:")} ${msg.subject || ""}`;
      const fromNameEsc = String(msg.from?.name ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string);
      const fromAddrEsc = String(msg.from?.address ?? msg.from ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string);
      const subjectEsc = String(msg.subject ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string);
      const dateEsc = String(msg.date ? new Date(msg.date).toLocaleString(document.documentElement.lang || undefined) : "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string);
      richEl.innerHTML = `<br><br><div style="border-left:3px solid var(--border-brand);padding-left:1rem;margin-top:1rem;color:var(--text-muted)">
        <p><b>${fallback("compose.quoted.from", "De:")}</b> ${fromNameEsc} &lt;${fromAddrEsc}&gt;</p>
        <p><b>${fallback("compose.quoted.date", "Fecha:")}</b> ${dateEsc}</p>
        <p><b>${fallback("compose.quoted.subject", "Asunto:")}</b> ${subjectEsc}</p>
        <br>${sanitizeQuotedBody(msg.html) || `<pre>${String(msg.text ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string)}</pre>`}
      </div>`;
    } else {
      subjectEl.value = msg.subject?.startsWith("Fwd:") ? msg.subject : `${fallback("compose.forwardPrefix", "Fwd:")} ${msg.subject || ""}`;
      const fromNameEsc = String(msg.from?.name ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string);
      const fromAddrEsc = String(msg.from?.address ?? msg.from ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string);
      const toAddrEsc = String(msg.to?.address ?? msg.to ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string);
      const subjectEsc = String(msg.subject ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string);
      const dateEsc = String(msg.date ? new Date(msg.date).toLocaleString(document.documentElement.lang || undefined) : "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string);
      richEl.innerHTML = `<br><br><div style="border-top:1px solid var(--border);margin-top:1rem;padding-top:1rem;color:var(--text-muted)">
        <p><b>${fallback("compose.quoted.forwardedSeparator", "-------- Mensaje reenviado --------")}</b></p>
        <p><b>${fallback("compose.quoted.from", "De:")}</b> ${fromNameEsc} &lt;${fromAddrEsc}&gt;</p>
        <p><b>${fallback("compose.quoted.to", "Para:")}</b> ${toAddrEsc}</p>
        <p><b>${fallback("compose.quoted.date", "Fecha:")}</b> ${dateEsc}</p>
        <p><b>${fallback("compose.quoted.subject", "Asunto:")}</b> ${subjectEsc}</p>
        <br>${sanitizeQuotedBody(msg.html) || `<pre>${String(msg.text ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string)}</pre>`}
      </div>`;
    }

    richEl.focus();
    // Move cursor to top
    const range = document.createRange();
    const sel = window.getSelection();
    range.setStart(richEl, 0);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  async function loadDraftMessage(uid: string) {
    const fromId = (document.getElementById("from-account") as HTMLSelectElement).value;
    if (!fromId) return;
    const res = await api.get<any>(`/api/mail/${fromId}/messages/${uid}`, { params: { folder: draftFolder } });
    if (!res.ok || !res.data) { showToast(res.error ?? fallback("composeRuntime.openDraftError", "No se pudo abrir el borrador"), false); return; }
    const msg = res.data as any;
    for (const value of msg.to ?? []) toCtrl.addAddress(value.address ?? value);
    for (const value of msg.cc ?? []) ccCtrl.addAddress(value.address ?? value);
    for (const value of msg.bcc ?? []) bccCtrl.addAddress(value.address ?? value);
    if (msg.cc?.length) document.getElementById("cc-row")?.classList.remove("hidden");
    if (msg.bcc?.length) document.getElementById("bcc-row")?.classList.remove("hidden");
    (document.getElementById("subject") as HTMLInputElement).value = msg.subject ?? "";
    const rich = document.getElementById("body-rich")!;
    rich.innerHTML = sanitizeQuotedBody(msg.html || "") || "";
    if (!msg.html) rich.textContent = msg.text || "";
    draftAttachmentsReady = false;
    try {
      for (const [index, meta] of (msg.attachments ?? []).entries()) {
        const response = await fetch(resolvePanelApiPath(`/api/mail/${fromId}/messages/${uid}/attachments/${index}?folder=${encodeURIComponent(draftFolder)}`), { credentials: "include", headers: scopeHeaders() });
        if (!response.ok) throw new Error(fallback("composeRuntime.draftAttachmentsError", "No se pudieron recuperar todos los adjuntos del borrador"));
        const file = new File([await response.blob()], meta.filename || fallback("inbox.attachmentFilename", "adjunto"), { type: meta.contentType || "application/octet-stream" });
        attachments.push(file);
        addAttachmentTag(file);
      }
      draftAttachmentsReady = true;
    } catch (err) {
      showToast((err as Error).message, false);
      (document.getElementById("btn-save-draft") as HTMLButtonElement).disabled = true;
      (document.getElementById("btn-send") as HTMLButtonElement).disabled = true;
    }
  }

  // ── Send ───────────────────────────────────────────────────
  async function sendEmail(isDraft = false) {
    const fromId = (document.getElementById("from-account") as HTMLSelectElement).value;
    const to = toCtrl.getAddresses();
    const cc = ccCtrl.getAddresses();
    const bcc = bccCtrl.getAddresses();
    const subject = (document.getElementById("subject") as HTMLInputElement).value.trim();
    const bodyEl = document.getElementById("body-rich")!;
    const plainEl = document.getElementById("body-plain") as HTMLTextAreaElement;

    const html = isPlainText ? undefined : bodyEl.innerHTML;
    const text = isPlainText ? plainEl.value : bodyEl.innerText;

    if (!fromId) { showToast(fallback("compose.validation.selectAccount", "Selecciona una cuenta remitente"), false); return; }
    if (!draftAttachmentsReady) { showToast("Espera a que se recuperen los adjuntos del borrador", false); return; }
    if (!isDraft && to.length === 0) { showToast(fallback("compose.validation.addRecipient", "Agrega al menos un destinatario"), false); return; }
    if (!subject && !isDraft) { if (!await openConfirm(fallback("compose.validation.confirmNoSubject", "¿Enviar sin asunto?"), { title: fallback("compose.validation.confirmTitle", "Confirmar envío"), confirmText: fallback("compose.validation.confirmBtn", "Sí, enviar") })) return; }

    const btn = document.getElementById("btn-send") as HTMLButtonElement;
    const icon = document.getElementById("send-icon")!;
    const text2 = document.getElementById("send-text")!;
    btn.disabled = true;
    icon.className = "ti ti-loader-2 animate-spin text-sm";
    text2.textContent = isDraft ? fallback("compose.saving", "Guardando...") : fallback("compose.sending", "Enviando...");

    // Build FormData for multipart (attachments)
    const formData = new FormData();
    formData.append("to", JSON.stringify(to));
    if (cc.length) formData.append("cc", JSON.stringify(cc));
    if (bcc.length) formData.append("bcc", JSON.stringify(bcc));
    formData.append("subject", subject);
    if (html) formData.append("html", html);
    formData.append("text", text);
    if (isDraft) formData.append("draft", "true");
    if (!isDraft && draftUid) { formData.append("draftUid", draftUid); formData.append("draftFolder", draftFolder); }
    if (!isDraft && (document.getElementById("mail-compose-encrypted") as HTMLInputElement | null)?.checked) formData.append("encrypted", "true");
    attachments.forEach(f => formData.append("attachments", f, f.name));

    // Get CSRF token
    const csrf = getCsrfToken();

    try {
      const url = isDraft && draftUid
        ? `/api/mail/${fromId}/drafts/${draftUid}?folder=${encodeURIComponent(draftFolder)}`
        : `/api/mail/${fromId}/send`;
      const res = await fetch(resolvePanelApiPath(url), {
        method: isDraft && draftUid ? "PUT" : "POST",
        credentials: "include",
        headers: { [CSRF_HEADER_NAME]: csrf, ...scopeHeaders(true) },
        body: formData,
      });
      const data = await res.json() as { ok: boolean; error?: string; sentCopySaved?: boolean; data?: { uid?: number; folder?: string; previousDraftRemoved?: boolean } };
      if (!res.ok || !data.ok) { showToast(data.error ?? fallback("compose.error.sendFailed", "Error al enviar"), false); return; }
      if (isDraft) {
        if (data.data?.uid) draftUid = String(data.data.uid);
        if (data.data?.folder) draftFolder = data.data.folder;
        if (draftUid) {
          const next = new URL(location.href);
          next.searchParams.set("draftUid", draftUid);
          next.searchParams.set("folder", draftFolder);
          history.replaceState(null, "", next);
        }
        showToast(data.data?.previousDraftRemoved === false ? fallback("composeRuntime.previousDraftVisible", "Borrador guardado; el anterior sigue visible") : fallback("compose.success.draftSaved", "Borrador guardado"));
      } else {
        if (draftUid) {
          const deleted = await api.delete(`/api/mail/${fromId}/messages/${draftUid}`, { params: { folder: draftFolder } });
          if (!deleted.ok) showToast(fallback("composeRuntime.sentPreviousDraftVisible", "Correo enviado; el borrador anterior sigue visible"), false);
        }
        showToast(data.sentCopySaved === false ? fallback("composeRuntime.sentCopyNotSaved", "Correo enviado; no se pudo guardar en Enviados") : fallback("compose.success.messageSent", "Mensaje enviado correctamente"));
        setTimeout(() => { window.location.href = `/panel/mail/${fromId}/inbox`; }, 1500);
      }
    } catch (err) {
      showToast((err as Error).message || fallback("compose.error.sendFailed", "Error al enviar"), false);
    } finally {
      btn.disabled = false;
      icon.className = "ti ti-send text-sm";
      text2.textContent = fallback("compose.btnSend", "Enviar");
    }
  }

  document.getElementById("btn-send")?.addEventListener("click", () => sendEmail(false));
  document.getElementById("btn-save-draft")?.addEventListener("click", () => sendEmail(true));

  // ── Init ───────────────────────────────────────────────────
  // Cooldown + lifecycle: el script type="module" solo evalúa una vez por
  // pestaña; sin estos hooks una segunda visita SPA a /compose quedaba
  // con el DOM fresco vacío. 3 fires/entrada (module-eval + after-swap +
  // page-load) dedupeados con throttle de 4s.
  let initLastAt = 0;
  const INIT_COOLDOWN_MS = SCRIPT_INIT_COOLDOWN_MS;
  async function init() {
    if (!document.getElementById("body-rich")) return;
    if (Date.now() - initLastAt < INIT_COOLDOWN_MS) return;
    initLastAt = Date.now();
    await loadAccounts();
    // Wait a tick for the account selector to populate
    setTimeout(async () => {
      if (draftUid) await loadDraftMessage(draftUid);
      else if (replyToUid) await loadOriginalMessage(String(replyToUid), "reply");
      else if (forwardUid) await loadOriginalMessage(String(forwardUid), "forward");
      else document.getElementById("body-rich")!.focus();
    }, 100);
  }
  void init();
  }
  document.addEventListener("astro:page-load", mountCompose);
  document.addEventListener("astro:after-swap", mountCompose);
  mountCompose();
