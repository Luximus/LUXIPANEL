import * as React from "react";
import { RefreshCw, X } from "lucide-react";
import { getAssistantTasks, cancelAssistantTask, ackAssistantTask, type AssistantTask } from "../api/client";
import { ticketStrings, tkTaskBadge, tkFormatDate } from "./ticketHubStrings";

/**
 * Panel "Tareas" del hub del asistente (desktop). Espejo del web: lista los
 * comandos al agente del servidor que corren en background, con su estado y
 * resultado. Al abrirlo marca como leídas las terminadas (limpia el badge).
 */
export default function TasksPanel({
  token,
  language,
  reloadKey,
  onUnreadChange,
}: {
  token: string;
  language: string;
  reloadKey?: number;
  onUnreadChange?: (n: number) => void;
}) {
  const t = ticketStrings(language);
  const [tasks, setTasks] = React.useState<AssistantTask[] | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const res = await getAssistantTasks(token);
      setTasks(res.tasks);
      const unreadIds = res.tasks.filter((x) => x.unread).map((x) => x.id);
      if (unreadIds.length > 0) {
        await Promise.all(unreadIds.map((id) => ackAssistantTask(id, token)));
        onUnreadChange?.(0);
      } else {
        onUnreadChange?.(res.unread);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.tasksLoadError);
    } finally {
      setBusy(false);
    }
  }, [token, t.tasksLoadError, onUnreadChange]);

  React.useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const cancel = React.useCallback(
    async (id: string) => {
      await cancelAssistantTask(id, token);
      void load();
    },
    [token, load],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex justify-end gap-2 border-b border-base-300 p-2 dark:border-zinc-700">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()} disabled={busy} aria-label={t.loading}>
          <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {tasks === null ? (
          <p className="my-4 text-center text-sm opacity-60">{t.loading}</p>
        ) : error ? (
          <p className="my-4 text-center text-sm text-error">{error}</p>
        ) : tasks.length === 0 ? (
          <p className="my-4 text-center text-sm opacity-60">{t.noTasks}</p>
        ) : (
          tasks.map((task) => {
            const badge = tkTaskBadge(t, task.status);
            return (
              <div key={task.id} className="rounded-xl border border-base-300 bg-base-200/40 p-3 dark:border-zinc-700">
                <div className="flex flex-wrap items-center gap-1">
                  <span className={`badge badge-sm ${badge.cls}`}>{badge.label}</span>
                  {task.panel ? <span className="text-xs opacity-60">{task.panel}</span> : null}
                </div>
                <p className="mt-1 text-sm font-semibold">{task.instruction}</p>
                {task.status === "done" && task.result ? (
                  <div className="mt-2">
                    <span className="text-xs font-semibold opacity-70">{t.taskResult}</span>
                    <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-base-300/40 p-2 text-xs">{task.result}</pre>
                  </div>
                ) : null}
                {task.status === "error" && task.error ? (
                  <div className="mt-2">
                    <span className="text-xs font-semibold text-error">{t.taskErrorDetail}</span>
                    <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-error/40 p-2 text-xs">{task.error}</pre>
                  </div>
                ) : null}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs opacity-60">{tkFormatDate(task.createdAt, language)}</span>
                  {task.status === "pending" ? (
                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => void cancel(task.id)} aria-label={t.taskCancel} title={t.taskCancel}>
                      <X size={14} />
                      {t.taskCancel}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
