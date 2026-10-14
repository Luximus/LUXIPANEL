import React, {
  memo,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  subscribeDirectSessions,
  getDirectSessionRevision, getDirect,
} from "../../api/serverApi";
import { NativeSessionBoundary } from "./NativeSessionBoundary";
import { NativeModuleContext } from "./native-module-context";
import { NativeModuleDrawer } from '../../components/server/NativeModuleDrawer';
import { NativeModuleView } from "./native-module-view";
import type { NativeModuleSession } from "./shell-types";
type Props = {
  active: NativeModuleSession | null;
  token: string;
  accountId?: string | null;
  visible?: boolean;
  onClose: () => void;
};
const NativeEntry = memo(function NativeEntry({
  sessionKey,
  entry,
  token,
  visible,
  onClose,
}: {
  sessionKey: string;
  entry: NativeModuleSession;
  token: string;
  visible: boolean;
  onClose: () => void;
}) {
  const parent = useContext(NativeModuleContext);
  const [selection, setSelection] = useState({ view: entry.selectedView, revision: entry.viewRevision });
  const request = useRef({ view: entry.selectedView, revision: entry.viewRevision });
  useEffect(() => {
    if (request.current.view === entry.selectedView && request.current.revision === entry.viewRevision) return;
    request.current = { view: entry.selectedView, revision: entry.viewRevision };
    if (entry.selectedView) setSelection(previous => ({ view: entry.selectedView, revision: (previous.revision ?? 0) + 1 }));
  }, [entry.selectedView, entry.viewRevision]);
  const selectView = useCallback((view: string) => setSelection(previous => ({ view, revision: (previous.revision ?? 0) + 1 })), []);
  const context = useMemo(
    () => ({ ...parent, key: sessionKey, visible, insideModuleDrawer: true, selectedView: selection.view, viewRevision: selection.revision, selectView }),
    [parent, sessionKey, visible, selection, selectView],
  );
  return (
    <NativeModuleContext.Provider value={context}>
      <NativeModuleDrawer visible={visible} onClose={onClose}>
        <NativeSessionBoundary panelId={entry.panelId} moduleId={entry.moduleId} token={token} onBack={onClose}>
        <NativeModuleView
          moduleId={entry.moduleId}
          panelId={entry.panelId}
          token={token}
          onBack={onClose}
        />
        </NativeSessionBoundary>
      </NativeModuleDrawer>
    </NativeModuleContext.Provider>
  );
});
/** Closing hides a session; changing its server or credentials disposes it. */
export function PersistentNativeModules({
  active,
  token,
  accountId,
  visible = true,
  onClose,
}: Props) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const close = useCallback(() => closeRef.current(), []);
  const [state, setState] = useState<{
    owner: string;
    entries: Map<string, NativeModuleSession>;
  }>({ owner: "", entries: new Map() });
  const panelId =
    active?.panelId ?? state.entries.values().next().value?.panelId ?? "";
  useSyncExternalStore(subscribeDirectSessions, () =>
    getDirectSessionRevision(panelId),
  );
  const target = getDirect(panelId);
  // Initial handoff and JWT renewal retain the form. Logout or host/account change dispose it.
  const hostRef = useRef<{ panelId: string; host?: string; generation: number; authenticated?: boolean; principal?: string }>({ panelId, generation: 0 });
  if (hostRef.current.panelId !== panelId) hostRef.current = { panelId, generation: 0 };
  const hostChanged = target && hostRef.current.host && target.baseUrl !== hostRef.current.host;
  let principal: string | undefined;
  if (target) {
    try { const claims = JSON.parse(atob(target.jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); principal = JSON.stringify([claims.userId ?? claims.sub, claims.username, claims.kind]); } catch { principal = "authenticated"; }
  }
  const removed = hostRef.current.authenticated && !target;
  const changedUser = principal && hostRef.current.principal && principal !== hostRef.current.principal;
  if (hostChanged || removed || changedUser) hostRef.current.generation++;
  hostRef.current.authenticated = !!target;
  if (principal) hostRef.current.principal = principal;
  if (target) hostRef.current.host = target.baseUrl;
  const owner = JSON.stringify([panelId, accountId ?? "session", token ? "signed-in" : "signed-out", hostRef.current.generation]);
  const activeKey = active ? `${active.panelId}:${active.moduleId}` : null;
  useEffect(() => {
    setState((previous) => {
      const entries =
        previous.owner === owner
          ? new Map(previous.entries)
          : new Map<string, NativeModuleSession>();
      if (active) entries.set(`${active.panelId}:${active.moduleId}`, active);
      return { owner, entries };
    });
  }, [owner, active?.moduleId, active?.selectedView, active?.viewRevision]);
  // Never render stale views against a newly selected server, even for one frame.
  if (state.owner !== owner) return null;
  return (
    <>
      {[...state.entries].map(([key, entry]) => {
        const shown = visible && key === activeKey;
        return (
          <NativeEntry
            key={`${owner}:${key}`}
            sessionKey={key}
            entry={entry}
            token={token}
            visible={shown}
            onClose={close}
          />
        );
      })}
    </>
  );
}
