import { Users } from "lucide-react";
import type { TeamDraft, TeamEditorCopy } from "./types";

export { emptyTeamDraft, teamToDraft } from "./teamDraft";
export type { TeamDraft, TeamEditorCopy } from "./types";

export default function TeamEditor({
  draft,
  copy,
  readOnly,
  busy,
  onChange,
  onCancel,
  onSave,
}: {
  draft: TeamDraft;
  copy: TeamEditorCopy;
  readOnly: boolean;
  busy: boolean;
  onChange: (draft: TeamDraft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const set = (patch: Partial<TeamDraft>) => onChange({ ...draft, ...patch });
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
          value={draft.description ?? ""}
          maxLength={500}
          disabled={readOnly}
          onChange={(event) => set({ description: event.target.value })}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{copy.icon}</span>
          <input
            className="input input-bordered w-full"
            value={draft.icon ?? ""}
            maxLength={60}
            disabled={readOnly}
            onChange={(event) => set({ icon: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{copy.color}</span>
          <input
            className="input input-bordered w-full"
            value={draft.color ?? ""}
            maxLength={30}
            disabled={readOnly}
            onChange={(event) => set({ color: event.target.value })}
          />
        </label>
      </div>

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
            <Users size={14} />
            {busy ? copy.saving : copy.save}
          </button>
        ) : null}
      </div>
    </div>
  );
}
