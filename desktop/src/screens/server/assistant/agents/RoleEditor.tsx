import { ShieldCheck } from "lucide-react";
import type { RoleDraft, RoleEditorCopy } from "./types";

export { emptyRoleDraft, roleToDraft } from "./roleDraft";
export type { RoleDraft, RoleEditorCopy } from "./types";

function splitTools(value: string): string[] {
  return [...new Set(value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean))];
}

export default function RoleEditor({
  draft,
  copy,
  readOnly,
  busy,
  onChange,
  onCancel,
  onSave,
}: {
  draft: RoleDraft;
  copy: RoleEditorCopy;
  readOnly: boolean;
  busy: boolean;
  onChange: (draft: RoleDraft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const set = (patch: Partial<RoleDraft>) => onChange({ ...draft, ...patch });
  return (
    <div className="flex flex-col gap-3">
      {readOnly ? (
        <div role="status" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          {copy.readOnlyHint}
        </div>
      ) : null}

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{copy.name}</span>
        <input
          className="input input-bordered w-full"
          value={draft.name}
          maxLength={120}
          disabled={readOnly}
          onChange={(event) => set({ name: event.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{copy.description}</span>
        <textarea
          className="textarea textarea-bordered w-full"
          value={draft.description}
          maxLength={500}
          disabled={readOnly}
          onChange={(event) => set({ description: event.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{copy.prompt}</span>
        <textarea
          className="textarea textarea-bordered w-full font-mono"
          style={{ minHeight: "14rem" }}
          value={draft.systemPrompt}
          maxLength={20_000}
          disabled={readOnly}
          onChange={(event) => set({ systemPrompt: event.target.value })}
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="checkbox checkbox-sm"
          checked={draft.allowedTools === null}
          disabled={readOnly}
          onChange={(event) => set({ allowedTools: event.target.checked ? null : [] })}
        />
        <span>{copy.allowAllTools}</span>
      </label>

      {draft.allowedTools !== null ? (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{copy.allowedTools}</span>
          <textarea
            className="textarea textarea-bordered w-full"
            value={draft.allowedTools.join("\n")}
            disabled={readOnly}
            onChange={(event) => set({ allowedTools: splitTools(event.target.value) })}
          />
          <small className="text-base-content/60">{copy.allowedToolsHint}</small>
        </label>
      ) : null}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="checkbox checkbox-sm"
          checked={Boolean(draft.canSpawnChats)}
          disabled={readOnly}
          onChange={(event) => set({ canSpawnChats: event.target.checked })}
        />
        <span>{copy.supervisor}</span>
      </label>

      <div className="lp-modal-footer">
        <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onCancel}>
          {copy.cancel}
        </button>
        {!readOnly ? (
          <button
            type="button"
            className="lp-modal-btn lp-modal-btn--primary"
            disabled={busy || !draft.name.trim()}
            onClick={onSave}
          >
            <ShieldCheck size={14} />
            {busy ? copy.saving : copy.save}
          </button>
        ) : null}
      </div>
    </div>
  );
}
