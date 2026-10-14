import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type OverlayExit = (done: () => void) => () => void;
type Overlay = { content: React.ReactNode; exit?: OverlayExit; exiting?: boolean; cancelExit?: () => void };
type Host = { put: (id: symbol, content: React.ReactNode, exit?: OverlayExit) => void; remove: (id: symbol) => void };
const OverlayHostContext = createContext<Host | null>(null);
export const OverlayExitingContext = createContext(false);

/** Places nested sheets at the screen root instead of inside a table row/card. */
export function NativeOverlayHost({ children }: { children: React.ReactNode }) {
  const entries = useRef(new Map<symbol, Overlay>());
  const [overlays, setOverlays] = useState(entries.current);
  const put = useCallback((id: symbol, content: React.ReactNode, exit?: OverlayExit) => {
    entries.current.get(id)?.cancelExit?.();
    entries.current = new Map(entries.current).set(id, { content, exit });
    setOverlays(entries.current);
  }, []);
  const remove = useCallback((id: symbol) => {
    const entry = entries.current.get(id);
    if (!entry || entry.exiting) return;
    const finish = () => {
      if (entries.current.get(id) !== entry) return;
      const next = new Map(entries.current);
      next.delete(id);
      entries.current = next;
      setOverlays(next);
    };
    if (!entry.exit) { finish(); return; }
    // The owner may unmount immediately on Cancel or Save. Keep its last frame
    // in the host until the exit finishes, with all its controls disabled.
    entry.exiting = true;
    setOverlays(new Map(entries.current));
    entry.cancelExit = entry.exit(finish);
  }, []);
  useLayoutEffect(() => () => {
    for (const entry of entries.current.values()) entry.cancelExit?.();
    entries.current.clear();
  }, []);
  const host = useMemo(() => ({ put, remove }), [put, remove]);
  return (
    <OverlayHostContext.Provider value={host}>
      {children}
      {[...overlays].map(([id, entry]) => <OverlayExitingContext.Provider key={String(id)} value={!!entry.exiting}>{entry.content}</OverlayExitingContext.Provider>)}
    </OverlayHostContext.Provider>
  );
}

export function useNativeOverlay(id: symbol, content: React.ReactNode, exit?: OverlayExit) {
  const host = useContext(OverlayHostContext);
  useLayoutEffect(() => {
    if (host) host.put(id, content, exit);
  }, [host, id, content, exit]);
  useLayoutEffect(() => () => host?.remove(id), [host, id]);
  return !!host;
}
