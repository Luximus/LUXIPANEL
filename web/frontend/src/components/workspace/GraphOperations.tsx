// SPDX-License-Identifier: AGPL-3.0-only
import { useEffect, useRef, useState } from "react";
import { scopeHeaders } from "@/lib/api-client";
import { useModuleVisibility } from "./module-visibility";
import { useViewContext } from "./view-context";
const LABELS: Record<string, string[]> = {
  es: [
    "Proyectos",
    "Carpetas",
    "Indexar",
    "Esquema",
    "Procesos",
    "Registros",
    "Guardar",
    "Eliminar índice",
    "Detener proceso",
    "Cancelar",
    "Confirmar",
    "Ruta",
    "Actualizar",
    "Buscar",
  ],
  en: [
    "Projects",
    "Folders",
    "Index",
    "Schema",
    "Processes",
    "Logs",
    "Save",
    "Delete index",
    "Stop process",
    "Cancel",
    "Confirm",
    "Path",
    "Refresh",
    "Search",
  ],
  pt: [
    "Projetos",
    "Pastas",
    "Indexar",
    "Esquema",
    "Processos",
    "Registos",
    "Guardar",
    "Eliminar índice",
    "Parar processo",
    "Cancelar",
    "Confirmar",
    "Caminho",
    "Atualizar",
    "Pesquisar",
  ],
  fr: [
    "Projets",
    "Dossiers",
    "Indexer",
    "Schéma",
    "Processus",
    "Journaux",
    "Enregistrer",
    "Supprimer l’index",
    "Arrêter le processus",
    "Annuler",
    "Confirmer",
    "Chemin",
    "Actualiser",
    "Rechercher",
  ],
  de: [
    "Projekte",
    "Ordner",
    "Indizieren",
    "Schema",
    "Prozesse",
    "Protokolle",
    "Speichern",
    "Index löschen",
    "Prozess beenden",
    "Abbrechen",
    "Bestätigen",
    "Pfad",
    "Aktualisieren",
    "Suchen",
  ],
  it: [
    "Progetti",
    "Cartelle",
    "Indicizza",
    "Schema",
    "Processi",
    "Registri",
    "Salva",
    "Elimina indice",
    "Arresta processo",
    "Annulla",
    "Conferma",
    "Percorso",
    "Aggiorna",
    "Cerca",
  ],
  ja: [
    "プロジェクト",
    "フォルダー",
    "索引作成",
    "スキーマ",
    "プロセス",
    "ログ",
    "保存",
    "索引を削除",
    "プロセスを停止",
    "キャンセル",
    "確認",
    "パス",
    "更新",
    "検索",
  ],
  ko: [
    "프로젝트",
    "폴더",
    "색인 생성",
    "스키마",
    "프로세스",
    "로그",
    "저장",
    "색인 삭제",
    "프로세스 중지",
    "취소",
    "확인",
    "경로",
    "새로 고침",
    "검색",
  ],
  ru: [
    "Проекты",
    "Папки",
    "Индексировать",
    "Схема",
    "Процессы",
    "Журналы",
    "Сохранить",
    "Удалить индекс",
    "Остановить процесс",
    "Отмена",
    "Подтвердить",
    "Путь",
    "Обновить",
    "Поиск",
  ],
  ar: [
    "المشاريع",
    "المجلدات",
    "فهرسة",
    "المخطط",
    "العمليات",
    "السجلات",
    "حفظ",
    "حذف الفهرس",
    "إيقاف العملية",
    "إلغاء",
    "تأكيد",
    "المسار",
    "تحديث",
    "بحث",
  ],
  hi: [
    "प्रोजेक्ट",
    "फ़ोल्डर",
    "अनुक्रमित करें",
    "स्कीमा",
    "प्रक्रियाएँ",
    "लॉग",
    "सहेजें",
    "सूचकांक हटाएँ",
    "प्रक्रिया रोकें",
    "रद्द करें",
    "पुष्टि करें",
    "पथ",
    "रीफ़्रेश करें",
    "खोजें",
  ],
  bn: [
    "প্রকল্প",
    "ফোল্ডার",
    "সূচি তৈরি",
    "স্কিমা",
    "প্রক্রিয়া",
    "লগ",
    "সংরক্ষণ",
    "সূচি মুছুন",
    "প্রক্রিয়া থামান",
    "বাতিল",
    "নিশ্চিত করুন",
    "পথ",
    "হালনাগাদ",
    "খুঁজুন",
  ],
};
type Tab = "projects" | "folders" | "schema" | "adr" | "processes" | "logs";
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
) {
  const response = await fetch("/cgraph/" + path, {
    method,
    credentials: "include",
    headers: {
      ...scopeHeaders(method !== "GET"),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error("Graph operation failed");
  return data;
}
async function tool(
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
) {
  const data = await request(
    "rpc",
    "POST",
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    },
    signal,
  );
  return JSON.parse(data.result?.content?.[0]?.text ?? "{}");
}
/** The graph service exposes JSON here; its standalone HTML is never embedded. */
export function GraphOperations({
  project,
  onChange,
}: {
  project: string;
  onChange: () => void;
}) {
  const { locale, messages } = useViewContext(),
    visible = useModuleVisibility(),
    labels = LABELS[locale] ?? LABELS.en;
  const [tab, setTab] = useState<Tab>("projects"),
    [data, setData] = useState<any>(null),
    [path, setPath] = useState(""),
    [roots, setRoots] = useState(""),
    [adr, setAdr] = useState(""),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState<{
      text: string;
      run: () => Promise<unknown>;
    } | null>(null),
    [revision, setRevision] = useState(0);
  const adrProject = useRef<string | null>(null);
  useEffect(() => {
    if (!visible || !confirm) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setConfirm(null);
      }
    };
    window.addEventListener("keydown", close, true);
    return () => window.removeEventListener("keydown", close, true);
  }, [visible, confirm]);
  const refresh = () => setRevision((value) => value + 1);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    let alive = true;
    const read = async () => {
      try {
        let value: unknown;
        if (tab === "projects")
          value = await tool("list_projects", {}, controller.signal);
        else if (tab === "schema")
          value = project
            ? await tool("get_graph_schema", { project }, controller.signal)
            : null;
        else if (tab === "adr")
          value = project
            ? await request(
                "api/adr?" + new URLSearchParams({ project }),
                undefined,
                undefined,
                controller.signal,
              )
            : null;
        else
          value = await request(
            tab === "folders"
              ? "api/browse?" + new URLSearchParams({ path })
              : tab === "logs"
                ? "api/logs?lines=200"
                : "api/processes",
            undefined,
            undefined,
            controller.signal,
          );
        if (alive) {
          setData(value);
          setError(false);
          if (tab === "adr" && adrProject.current !== project) {
            adrProject.current = project;
            setAdr((value as any)?.content ?? "");
          }
        }
      } catch (error) {
        if (alive && (error as Error).name !== "AbortError") setError(true);
      }
    };
    void read();
    const timer = ["processes", "logs"].includes(tab)
      ? setInterval(() => void read(), 3000)
      : null;
    return () => {
      alive = false;
      controller.abort();
      if (timer) clearInterval(timer);
    };
  }, [tab, visible, project, path, revision]);
  const perform = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      await action();
      refresh();
      onChange();
      setConfirm(null);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="flex min-h-0 flex-col gap-3 overflow-auto border-t border-border p-3">
      <nav className="flex flex-wrap gap-2" aria-label={labels[0]}>
        {(
          ["projects", "folders", "schema", "adr", "processes", "logs"] as const
        ).map((item, index) => (
          <button
            key={item}
            className={`rounded-lg border border-border px-3 py-2 text-xs ${tab === item ? "bg-primary text-primary-foreground" : ""}`}
            aria-pressed={tab === item}
            onClick={() => {
              setData(null);
              setTab(item);
            }}
          >
            {
              [labels[0], labels[1], labels[3], "ADR", labels[4], labels[5]][
                index
              ]
            }
          </button>
        ))}
        <button
          className="rounded-lg border border-border px-3 py-2 text-xs"
          onClick={refresh}
        >
          {labels[12]}
        </button>
      </nav>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {messages.codebaseGraph.graphUnavailable}
        </p>
      )}
      {tab === "folders" && (
        <>
          <div className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-lg border border-border bg-background p-2 text-xs"
              aria-label={labels[11]}
              value={path}
              onChange={(event) => setPath(event.target.value)}
            />
            <button
              className="rounded-lg border border-border p-2 text-xs"
              onClick={() => setPath(data?.parent ?? "/")}
            >
              ↑
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(data?.dirs ?? []).map((dir: string) => (
              <button
                key={dir}
                className="rounded-lg border border-border p-2 text-xs"
                onClick={() =>
                  setPath(`${data?.path ?? path}/${dir}`.replace(/\/+/g, "/"))
                }
              >
                {dir}
              </button>
            ))}
          </div>
          <textarea
            className="min-h-20 rounded-lg border border-border bg-background p-2 text-xs"
            aria-label={labels[11]}
            value={roots}
            onChange={(event) => setRoots(event.target.value)}
            placeholder={data?.path ?? path}
          />
          <button
            disabled={busy || (!roots.trim() && !path)}
            className="rounded-lg bg-primary p-2 text-xs text-primary-foreground"
            onClick={() =>
              void perform(async () => {
                for (const root of (roots.trim() || data?.path || path)
                  .split("\n")
                  .map((value: string) => value.trim())
                  .filter(Boolean))
                  await request("api/index", "POST", { root_path: root });
              })
            }
          >
            {labels[2]}
          </button>
        </>
      )}
      {tab === "projects" && (
        <div className="space-y-2">
          {(data?.projects ?? []).map((row: any) => (
            <div
              key={row.name}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-2 text-xs"
            >
              <span>
                {row.name}
                <span className="ml-2 text-muted-foreground">
                  {row.root_path}
                </span>
              </span>
              <button
                disabled={busy}
                className="text-destructive"
                onClick={() =>
                  setConfirm({
                    text: `${labels[7]} · ${row.name}`,
                    run: () =>
                      request(
                        "api/project?" +
                          new URLSearchParams({ name: row.name }),
                        "DELETE",
                      ),
                  })
                }
              >
                {labels[7]}
              </button>
            </div>
          ))}
        </div>
      )}
      {tab === "adr" && project && (
        <>
          <textarea
            className="min-h-60 rounded-lg border border-border bg-background p-3 font-mono text-xs"
            value={adr}
            onChange={(event) => setAdr(event.target.value)}
          />
          <button
            disabled={busy}
            className="rounded-lg bg-primary p-2 text-xs text-primary-foreground"
            onClick={() =>
              void perform(() =>
                request("api/adr", "POST", { project, content: adr }),
              )
            }
          >
            {labels[6]}
          </button>
        </>
      )}
      {tab === "processes" && (
        <div className="space-y-2">
          {(data?.processes ?? []).map((row: any) => (
            <div
              key={row.pid}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-2 text-xs"
            >
              <span>
                {row.pid} · {row.command} · {row.cpu}% · {row.rss_mb} MB
              </span>
              <button
                disabled={busy}
                className="text-destructive"
                onClick={() =>
                  setConfirm({
                    text: `${labels[8]} · ${row.pid}`,
                    run: () =>
                      request("api/process-kill", "POST", { pid: row.pid }),
                  })
                }
              >
                {labels[8]}
              </button>
            </div>
          ))}
        </div>
      )}
      {tab === "schema" && (
        <pre className="overflow-auto whitespace-pre-wrap text-xs">
          {data
            ? JSON.stringify(data, null, 2)
            : messages.codebaseGraph.chooseProjectHint}
        </pre>
      )}
      {tab === "logs" && (
        <pre className="overflow-auto whitespace-pre-wrap font-mono text-xs">
          {(data?.lines ?? []).join("\n")}
        </pre>
      )}
      {confirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="absolute inset-3 z-30 grid content-center gap-4 rounded-xl border border-border bg-card p-5"
        >
          <p>{confirm.text}</p>
          <div className="flex gap-3">
            <button
              disabled={busy}
              className="rounded-lg bg-destructive px-4 py-2 text-destructive-foreground"
              onClick={() => void perform(confirm.run)}
            >
              {labels[10]}
            </button>
            <button
              className="rounded-lg border border-border px-4 py-2"
              onClick={() => setConfirm(null)}
            >
              {labels[9]}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
