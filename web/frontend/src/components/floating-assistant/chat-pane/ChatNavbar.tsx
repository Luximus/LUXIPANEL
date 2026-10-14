import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { PromptBarPicker } from "./reactbits/PromptBar";

export interface ChatNavbarProps {
  project: PromptBarPicker;
  terminalAvailable: boolean;
  terminalLabel: string;
  multimediaLabel: string;
  onTerminal: () => void;
  onMultimedia: () => void;
}

/** The active chat owns the controls even though the navbar belongs to Astro. */
export function ChatNavbar({ project, terminalAvailable, terminalLabel, multimediaLabel, onTerminal, onMultimedia }: ChatNavbarProps) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [position, setPosition] = useState<CSSProperties>({});
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const edit = useRef<HTMLButtonElement>(null);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const selected = project.options.find(option => option.key === project.value);

  useEffect(() => {
    const sync = () => {
      // The same Astro host moves above the input on mobile; keep its portal
      // mounted when the host is outside the topbar and after route swaps.
      setTarget(document.querySelector("[data-assistant-topbar]")
        ? document.getElementById("workspace-chat-navbar-controls") : null);
      setOpen(false);
    };
    sync();
    document.addEventListener("astro:after-swap", sync);
    document.addEventListener("astro:page-load", sync);
    return () => {
      document.removeEventListener("astro:after-swap", sync);
      document.removeEventListener("astro:page-load", sync);
    };
  }, []);
  useEffect(() => setOpen(false), [project.value]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(300, window.innerWidth - 16);
      const viewport = window.visualViewport;
      const above = rect.top - (viewport?.offsetTop ?? 0) - 16;
      const below = (viewport ? viewport.height + viewport.offsetTop : window.innerHeight) - rect.bottom - 16;
      const downward = below > above;
      setPosition({ width, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        maxHeight: Math.max(80, Math.min(480, downward ? below : above)),
        ...(downward ? { top: rect.bottom + 8 } : { bottom: window.innerHeight - rect.top + 8 }) });
    };
    place();
    window.addEventListener("resize", place);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      window.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [open]);
  useEffect(() => { if (open) rows.current[cursor]?.scrollIntoView({ block: "nearest" }); }, [open, cursor]);

  const close = () => { setOpen(false); trigger.current?.focus({ preventScroll: true }); };
  const select = (key: string) => { close(); project.onChange(key); };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape") { if (open) { event.preventDefault(); close(); } return; }
    if (event.key === "Tab") {
      if (open && !event.shiftKey && project.action) { event.preventDefault(); edit.current?.focus(); }
      else setOpen(false);
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (!project.options.length) return;
      const current = open ? cursor : Math.max(0, project.options.findIndex(option => option.key === project.value));
      setCursor(event.key === "Home" ? 0 : event.key === "End" ? project.options.length - 1 : !open ? current : (current + (event.key === "ArrowDown" ? 1 : project.options.length - 1)) % project.options.length);
      setOpen(true);
    } else if (open && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      if (project.options[cursor]) select(project.options[cursor].key);
    }
  };
  if (!target) return null;
  return createPortal(<>
    <button ref={trigger} type="button" className="lxp-navbar-project" data-picker="project" role="combobox"
      aria-label={project.label} title={selected?.name ?? project.label} aria-haspopup="listbox" aria-expanded={open}
      aria-controls={open ? id : undefined} aria-activedescendant={open && project.options[cursor] ? `${id}-${cursor}` : undefined}
      onKeyDown={onKeyDown} onClick={() => { setCursor(Math.max(0, project.options.findIndex(option => option.key === project.value))); setOpen(value => !value); }}>
      <i className="ti ti-folder" aria-hidden="true" /><span>{selected?.name ?? project.label}</span><i className="ti ti-chevron-down" aria-hidden="true" />
    </button>
    {terminalAvailable && <button type="button" className="lxp-navbar-tool" data-search-target="chat-navbar-terminal" aria-label={terminalLabel} title={terminalLabel} onClick={onTerminal}>
      <i className="ti ti-terminal-2" aria-hidden="true" />
    </button>}
    <button type="button" className="lxp-navbar-tool" data-search-target="chat-navbar-multimedia" aria-label={multimediaLabel} title={multimediaLabel} onClick={onMultimedia}>
      <i className="ti ti-photo" aria-hidden="true" />
    </button>
    {open && createPortal(<div ref={menu} className="lxp-navbar-project-menu" style={position} data-navbar-project-menu>
      <div id={id} role="listbox" aria-label={project.label} className="lxp-navbar-project-options">
        {project.options.map((option, index) => <button key={option.key} ref={node => { rows.current[index] = node; }} id={`${id}-${index}`} type="button" role="option" tabIndex={-1}
          aria-selected={option.key === project.value} data-active={index === cursor ? "true" : undefined} onMouseEnter={() => setCursor(index)} onClick={() => select(option.key)}>
          <span>{option.name}</span>{option.key === project.value && <i className="ti ti-check" aria-hidden="true" />}
        </button>)}
      </div>
      {project.action && <button ref={edit} type="button" className="lxp-navbar-project-edit" onClick={() => { close(); project.action?.onSelect(); }}
        onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); close(); } else if (event.key === "Tab") setOpen(false); }}>
        <i className="ti ti-pencil" aria-hidden="true" /><span>{project.action.label}</span>
      </button>}
    </div>, document.body)}
  </>, target);
}
