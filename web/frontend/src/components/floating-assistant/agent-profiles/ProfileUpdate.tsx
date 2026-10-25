import { useEffect, useRef, useState } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import { scopeHeaders, resolveTargetScope } from "@/lib/api-client";
import { profilesApi } from "./api";
import { profileCopy } from "./copy";
import { profileControl } from "./GlobalProfiles";
import type { UpdatePreview } from "./types";

export function ProfileUpdate({ agentId, projectId, locale, onUpdated }: { agentId: string; projectId: string; locale?: string; onUpdated(): void }) {
  const t = profileCopy(locale), [preview, setPreview] = useState<UpdatePreview>(), [error, setError] = useState(""), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const scope = () => JSON.stringify([resolveTargetScope(), scopeHeaders(true)]);
  const initial = useRef(scope()), alive = useRef(true), running = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const current = () => alive.current && initial.current === scope();
  async function work(apply: boolean) {
    if (!current() || running.current) return;
    running.current = true; setBusy(true); setError("");
    try {
      if (apply && preview) { await profilesApi.update(agentId, projectId, preview); if (current()) { setPreview(undefined); setNotice(t.updated); onUpdated(); } }
      else { const result = await profilesApi.preview(agentId, projectId); if (current()) { setPreview(result); setNotice(""); } }
    } catch (e) { if (current()) setError((e as Error).message); }
    finally { running.current = false; if (current()) setBusy(false); }
  }
  return <><button className={profileControl} disabled={busy} onClick={() => void work(false)}>{t.update}</button>{!preview && error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {preview && <ModalShell title={t.update} description={t.privateHint} closeLabel={t.cancel} closeDisabled={busy} onClose={() => setPreview(undefined)}>
      <div className="space-y-4 p-4"><p>{t.current}: {preview.current.version} → {t.incoming}: {preview.incoming.version}</p>
        {preview.current.hash === preview.incoming.hash && preview.current.version === preview.incoming.version ? <p>{t.upToDate}</p> : <>{(Object.keys(preview.incoming.snapshot) as (keyof typeof preview.incoming.snapshot)[]).filter(k => JSON.stringify(preview.current.snapshot[k]) !== JSON.stringify(preview.incoming.snapshot[k])).map(key =>
          <div key={key} className="border-t border-border pt-3 text-sm"><h3 className="font-medium">{t[key as keyof typeof t] ?? key}{preview.preserved.includes(key) ? ` · ${t.preserved}` : ""}</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2"><div className="whitespace-pre-wrap break-words text-muted-foreground">{JSON.stringify(preview.current.snapshot[key], null, 2)}</div><div className="whitespace-pre-wrap break-words">{JSON.stringify(preview.incoming.snapshot[key], null, 2)}</div></div></div>)}
          {!!preview.preserved.length && <p>{t.preserved}: {preview.preserved.join(", ")}</p>}
          <button className={profileControl} disabled={busy || !!preview.inheritedFrom} onClick={() => void work(true)}>{t.apply}</button></>}
        {error && <p role="alert" className="text-destructive">{error}</p>}
      </div>
    </ModalShell>}
  </>;
}
