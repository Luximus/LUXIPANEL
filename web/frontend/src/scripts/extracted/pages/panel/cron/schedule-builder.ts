// Cron page — schedule builder (cron expression composer for both dialogs).
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { t, inputCls } from "./dom";

  // ---------------------------------------------------------------------------
  // Schedule builder
  // ---------------------------------------------------------------------------
  const builderRoot = (p: string) => document.querySelector<HTMLElement>(`.schedule-builder[data-prefix="${p}"]`);
  const WEEKDAYS = () => t("builder.weekdays", "domingo,lunes,martes,miércoles,jueves,viernes,sábado").split(",");

  function renderFreqExtra(prefix: string) {
    const root = builderRoot(prefix); if (!root) return;
    const freq = (root.querySelector('[data-role="freq"]') as HTMLSelectElement).value;
    const extra = root.querySelector('[data-role="freq-extra"]') as HTMLElement;
    const lbl = (t: string) => `<label class="text-xs font-medium text-muted-foreground">${t}</label>`;
    let html = "";
    if (freq === "none") html = "";
    else if (freq === "minutes") html = lbl(t("builder.everyNMinutes", "Cada N minutos")) + `<input data-role="min-interval" type="number" min="1" max="59" value="15" class="${inputCls}">`
      + `<div class="grid grid-cols-2 gap-2 mt-1">`
      + `<div class="space-y-1">${lbl(t("builder.fromHour", "Desde la hora"))}<input data-role="from-hour" type="number" min="0" max="23" placeholder="${t("builder.allDay", "todo el día")}" class="${inputCls}"></div>`
      + `<div class="space-y-1">${lbl(t("builder.toHour", "Hasta la hora"))}<input data-role="to-hour" type="number" min="0" max="23" placeholder="23" class="${inputCls}"></div>`
      + `</div>`;
    else if (freq === "hourly") html = lbl(t("builder.atMinute", "En el minuto")) + `<input data-role="minute" type="number" min="0" max="59" value="0" class="${inputCls}">`;
    else if (freq === "daily") html = lbl(t("builder.atTime", "Hora")) + `<input data-role="time" type="time" value="03:00" class="${inputCls}">`;
    else if (freq === "weekly") html = lbl(t("builder.dayAndTime", "Día y hora")) + `<div class="flex gap-2"><select data-role="weekday" class="${inputCls}">${WEEKDAYS().map((d, i) => `<option value="${i}" ${i === 1 ? "selected" : ""}>${d}</option>`).join("")}</select><input data-role="time" type="time" value="03:00" class="${inputCls}"></div>`;
    else if (freq === "monthly") html = lbl(t("builder.domAndTime", "Día del mes y hora")) + `<div class="flex gap-2"><input data-role="dom" type="number" min="1" max="31" value="1" class="${inputCls}"><input data-role="time" type="time" value="03:00" class="${inputCls}"></div>`;
    else if (freq === "advanced") html = lbl(t("builder.cronExpr", "Expresión cron")) + `<input data-role="adv" type="text" placeholder="*/5 * * * *" class="${inputCls} font-mono">` +
      `<div class="flex flex-wrap gap-1 mt-1">${[["0 * * * *", t("builder.presetEveryHour", "Cada hora")], ["0 3 * * *", t("builder.preset3amDaily", "3am diario")], ["0 3 * * 0", t("builder.presetSun3am", "Dom 3am")], ["*/15 * * * *", t("builder.presetEvery15m", "Cada 15m")]].map(([e, l]) => `<button type="button" class="preset-btn rounded-md border border-border px-2 py-0.5 text-xs hover:bg-accent" data-expr="${e}">${l}</button>`).join("")}</div>`;
    extra.innerHTML = html;
    extra.querySelectorAll<HTMLElement>("input,select").forEach((e) => {
      e.addEventListener("input", () => recompute(prefix));
      e.addEventListener("change", () => recompute(prefix));
    });
    extra.querySelectorAll<HTMLButtonElement>(".preset-btn").forEach((b) => b.addEventListener("click", () => {
      const adv = extra.querySelector('[data-role="adv"]') as HTMLInputElement | null;
      if (adv) { adv.value = b.dataset.expr!; recompute(prefix); }
    }));
    recompute(prefix);
  }

  function computeExpr(prefix: string): string {
    const root = builderRoot(prefix); if (!root) return "";
    const freq = (root.querySelector('[data-role="freq"]') as HTMLSelectElement).value;
    const extra = root.querySelector('[data-role="freq-extra"]') as HTMLElement;
    const v = (r: string) => (extra.querySelector(`[data-role="${r}"]`) as HTMLInputElement | null)?.value ?? "";
    const hm = (t: string) => { const [h, m] = (t || "03:00").split(":"); return { h: String(+h!), m: String(+m!) }; };
    if (freq === "none") return "";
    if (freq === "minutes") {
      const n = v("min-interval") || "15";
      const fromRaw = v("from-hour").trim();
      const toRaw = v("to-hour").trim();
      let hour = "*";
      if (fromRaw !== "") {
        const f = Math.max(0, Math.min(23, parseInt(fromRaw, 10) || 0));
        const tParsed = toRaw !== "" ? parseInt(toRaw, 10) : 23;
        const t = Math.max(f, Math.min(23, isNaN(tParsed) ? 23 : tParsed));
        hour = f === 0 && t === 23 ? "*" : `${f}-${t}`;
      }
      return `*/${n} ${hour} * * *`;
    }
    if (freq === "hourly") return `${v("minute") || "0"} * * * *`;
    if (freq === "daily") { const { h, m } = hm(v("time")); return `${m} ${h} * * *`; }
    if (freq === "weekly") { const { h, m } = hm(v("time")); return `${m} ${h} * * ${v("weekday") || "1"}`; }
    if (freq === "monthly") { const { h, m } = hm(v("time")); return `${m} ${h} ${v("dom") || "1"} * *`; }
    if (freq === "advanced") return v("adv").trim();
    return "";
  }

  async function recompute(prefix: string) {
    const root = builderRoot(prefix); if (!root) return;
    const expr = computeExpr(prefix);
    (root.querySelector('[data-role="schedule"]') as HTMLInputElement).value = expr;
    (root.querySelector('[data-role="preview-expr"]') as HTMLElement).textContent = expr;
    const txt = root.querySelector('[data-role="preview-text"]') as HTMLElement;
    const freqSel = root.querySelector('[data-role="freq"]') as HTMLSelectElement;
    if (freqSel.value === "none") {
      txt.textContent = freqSel.selectedOptions[0]?.textContent || t("builder.noSchedulePreview", "Sin programación");
      txt.className = "text-muted-foreground";
      return;
    }
    if (!expr) { txt.textContent = "—"; txt.className = "text-muted-foreground"; return; }
    const res = await api.post<any>("/api/cron/validate", { expression: expr });
    if (res.ok && res.data?.valid) { txt.textContent = res.data.description || t("builder.validExpr", "Expresión válida"); txt.className = "text-emerald-500"; }
    else { txt.textContent = res.data?.error || t("builder.invalidExpr", "Expresión inválida"); txt.className = "text-destructive"; }
  }

  export function setupBuilder(prefix: string) {
    const root = builderRoot(prefix); if (!root || root.dataset.ready) return;
    root.dataset.ready = "1";
    (root.querySelector('[data-role="freq"]') as HTMLSelectElement).addEventListener("change", () => renderFreqExtra(prefix));
    renderFreqExtra(prefix);
  }
  export const getSchedule = (prefix: string) => (builderRoot(prefix)?.querySelector('[data-role="schedule"]') as HTMLInputElement | null)?.value || "";
  export const getFreq = (prefix: string) => (builderRoot(prefix)?.querySelector('[data-role="freq"]') as HTMLSelectElement | null)?.value || "";
  export function setScheduleNone(prefix: string) {
    const root = builderRoot(prefix); if (!root) return;
    (root.querySelector('[data-role="freq"]') as HTMLSelectElement).value = "none";
    renderFreqExtra(prefix);
  }
  export function setScheduleAdvanced(prefix: string, expr: string) {
    const root = builderRoot(prefix); if (!root) return;
    (root.querySelector('[data-role="freq"]') as HTMLSelectElement).value = "advanced";
    renderFreqExtra(prefix);
    const adv = root.querySelector('[data-role="adv"]') as HTMLInputElement | null;
    if (adv) adv.value = expr;
    recompute(prefix);
  }
  export function resetBuilder(prefix: string) {
    const root = builderRoot(prefix); if (!root) return;
    (root.querySelector('[data-role="freq"]') as HTMLSelectElement).value = "daily";
    renderFreqExtra(prefix);
  }
