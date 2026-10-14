import { useEffect, useState } from "react";
import SpringCheck from "@/components/reactbits-controls/SpringCheck";
import { ReorderList } from "@/components/reactbits-controls/ReorderList";
import { HISTORY_CLIS, type HistoryMode } from "./helpers";
import type { TerminalMessages } from "../i18n";
import { historyControlsMessages } from "./history-controls-messages";

const initial: HistoryMode[] = ["codex", "claude", "commands"];
function controlsConfig(messages: TerminalMessages) {
  const locale =
    typeof document === "undefined"
      ? "es"
      : document.documentElement.lang.split("-")[0];
  const fallback =
    historyControlsMessages[locale as keyof typeof historyControlsMessages] ||
    historyControlsMessages.es;
  return {
    ...messages.config,
    ...fallback,
    consoleLabel: messages.config.consoleLabel,
  };
}
export function HistoryOrderSettingsCard({
  messages,
}: {
  messages: TerminalMessages;
}) {
  const cfg = controlsConfig(messages);
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <h4 className="text-sm font-semibold">{cfg.historyOrderTitle}</h4>
      <p className="text-xs text-muted-foreground">
        {cfg.historyOrderDescription}
      </p>
      <HistoryOrderTable messages={messages} />
    </div>
  );
}
export function HistoryOrderTable({
  messages,
}: {
  messages: TerminalMessages;
}) {
  const [order, setOrder] = useState(initial),
    [visible, setVisible] = useState(initial),
    [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  const cfg = controlsConfig(messages);
  useEffect(() => {
    const receive = (event: Event) => {
      const d = (event as CustomEvent).detail;
      if (d.order) setOrder(d.order);
      if (d.visible) setVisible(d.visible);
      setBusy(Boolean(d.busy));
      setError(d.error || "");
    };
    window.addEventListener("lxp-terminal:history-preferences", receive);
    window.dispatchEvent(
      new CustomEvent("lxp-terminal:history-preferences-request"),
    );
    return () =>
      window.removeEventListener("lxp-terminal:history-preferences", receive);
  }, []);
  function update(nextOrder: HistoryMode[], nextVisible: HistoryMode[]) {
    setOrder(nextOrder);
    setVisible(nextVisible);
    setError("");
    window.dispatchEvent(
      new CustomEvent("lxp-terminal:history-preferences-change", {
        detail: { order: nextOrder, visible: nextVisible },
      }),
    );
  }
  function move(id: HistoryMode, offset: number) {
    const next = [...order],
      i = next.indexOf(id),
      j = i + offset;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    update(next, visible);
  }
  const labels: Record<string, string> = {
    commands: cfg.consoleLabel,
    ...Object.fromEntries(HISTORY_CLIS.map((c) => [c.id, c.label])),
  };
  return (
    <div
      className="mt-4"
      data-history-order-table
      role="table"
      aria-label={cfg.historyOrderTitle}
      aria-colcount={2}
      aria-rowcount={4}
      aria-busy={busy}
    >
      <div className="lxp-history-order-head" role="row">
        <span role="columnheader">{cfg.visibleOrder}</span>
        <span role="columnheader">{cfg.historyShow}</span>
      </div>
      <ReorderList
        role="rowgroup"
        items={order.map((id) => ({ id }))}
        label={cfg.historyOrderTitle}
        onReorder={(items) =>
          update(
            items.map((i) => i.id),
            visible,
          )
        }
        renderItem={(item, index) => (
          <div
            role="row"
            className="lxp-history-order-row"
            data-history-order-id={item.id}
          >
            <div role="cell" className="lxp-history-order-controls">
              <button
                type="button"
                data-reorder-handle
                aria-label={cfg.historyDrag.replace("{name}", labels[item.id])}
                title={cfg.historyDrag.replace("{name}", labels[item.id])}
                disabled={busy}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                    e.preventDefault();
                    move(item.id, e.key === "ArrowUp" ? -1 : 1);
                  }
                }}
              >
                <i className="ti ti-grip-vertical" aria-hidden />
              </button>
              <span className="lxp-history-order-name">
                <i
                  className={`ti ${item.id === "commands" ? "ti-terminal-2" : "ti-message"}`}
                  aria-hidden
                />
                {labels[item.id]}
              </span>
              <div className="lxp-history-order-arrows">
                <button
                  type="button"
                  onClick={() => move(item.id, -1)}
                  disabled={busy || index === 0}
                  aria-label={cfg.historyMoveUp.replace(
                    "{name}",
                    labels[item.id],
                  )}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(item.id, 1)}
                  disabled={busy || index === order.length - 1}
                  aria-label={cfg.historyMoveDown.replace(
                    "{name}",
                    labels[item.id],
                  )}
                >
                  ↓
                </button>
              </div>
            </div>
            <div role="cell">
              <SpringCheck
                checked={visible.includes(item.id)}
                disabled={
                  busy || (visible.length === 1 && visible.includes(item.id))
                }
                onChange={(checked) =>
                  update(
                    order,
                    checked
                      ? [...visible, item.id]
                      : visible.filter((id) => id !== item.id),
                  )
                }
                label={null}
                ariaLabel={cfg.historyShowCli.replace(
                  "{name}",
                  labels[item.id],
                )}
                color="var(--foreground)"
                fillColor="var(--foreground)"
                checkColor="var(--background)"
                strike="none"
                doneOpacity={1}
                boxSize={20}
                boxRadius={6}
              />
            </div>
          </div>
        )}
      />
      <p className="mt-2 text-xs text-muted-foreground">
        {cfg.historyOrderHint}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
