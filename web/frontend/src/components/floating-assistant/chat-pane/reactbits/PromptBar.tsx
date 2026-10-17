// React Bits Prompt Bar — https://reactbits.dev/micro/prompt-bar
// Integrated with the LUXIPANEL chat. See REACT-BITS-LICENSE.md.
'use client';

import React, {
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode
} from 'react';
import { createPortal } from 'react-dom';
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  ArrowDown01Icon,
  Attachment01Icon,
  Calendar03Icon,
  Cancel01Icon,
  ChartLineData01Icon,
  File02Icon,
  Globe02Icon,
  HelpCircleIcon,
  Mail01Icon,
  Mic01Icon,
  SparklesIcon,
  Tick02Icon
} from '@hugeicons/core-free-icons';
import './PromptBar.css';
import type { PromptDictationResult } from '../use-prompt-dictation';

export interface PromptBarSource {
  key: string;
  name: string;
  description?: string;
  group?: string;
  icon?: ReactNode | IconSvgElement;
  attach?: boolean;
  onSelect?: () => void;
}

export interface PromptBarCommand {
  key: string;
  name: string;
  description?: string;
  group?: string;
}

export interface PromptBarModel {
  key: string;
  name: string;
  tag?: string;
}

export interface PromptBarPicker {
  key: string;
  label: string;
  value: string;
  options: (PromptBarModel & { icon?: ReactNode })[];
  icon?: ReactNode;
  title?: string;
  before?: ReactNode;
  action?: { label: string; icon?: ReactNode; onSelect: () => void };
  onChange: (key: string) => void;
}

export interface PromptBarSendDetail {
  recording?: PromptDictationResult["recording"];
  attachments: string[];
  model?: PromptBarModel;
  effort?: string;
}

export interface PromptBarProps {
  value?: string;
  onChange?: (value: string) => void;
  inputRef?: React.Ref<HTMLTextAreaElement>;
  onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
  externalAttachmentCount?: number;
  onModelChange?: (model: string) => void;
  onStopDictation?: () => void;
  onCancelDictation?: () => void;
  dictateLabel?: string;
  stopDictationLabel?: string;
  cancelDictationLabel?: string;
  dictateHint?: string;
  placeholder?: string;
  sources?: PromptBarSource[];
  /** Selectors that belong inside the prompt toolbar (provider/project). */
  toolbarControls?: ReactNode;
  toolbarPickers?: PromptBarPicker[];
  /** Optional control immediately beside the message input. */
  inputLeading?: ReactNode;
  /** Chatbox mobile: settings and send flank the input; selectors stay above. */
  mobileLayout?: boolean;
  settingsLabel?: string;
  onOpenSettings?: () => void;
  commands?: PromptBarCommand[];
  models?: PromptBarModel[];
  defaultModel?: string;
  efforts?: string[];
  effortLabels?: Record<string, string>;
  effortTitle?: string;
  effortHelp?: string;
  reasoningLabel?: string;
  automaticReasoningLabel?: string;
  defaultEffort?: string;
  onEffortChange?: (effort: string) => void;
  busy?: boolean;
  readOnly?: boolean;
  realtime?: { active: boolean; toggle: () => void; phase?: string; muted?: boolean; toggleMuted?: () => void;
    error?: string; previousId?: string | null; closePrevious?: () => void };
  onAudioPhaseChange?: (active: boolean) => void;
  onSend?: (text: string, detail: PromptBarSendDetail) => void;
  onStop?: () => void;
  onQueue?: () => void;
  queueLabel?: string;
  onAttach?: () => string | string[] | void | Promise<string | string[] | void>;
  onDictate?: () => string | PromptDictationResult | void | Promise<string | PromptDictationResult | void>;
  background?: string;
  color?: string;
  menuBackground?: string;
  sparkColor?: string;
  sparkBoost?: number;
  width?: number;
  radius?: number;
  maxRows?: number;
  morphDuration?: number;
  squash?: number;
  tilt?: number;
  pressScale?: number;
  className?: string;
}

type Row = {
  key: string;
  name: string;
  description?: string;
  group?: string;
  tag?: string;
  icon?: ReactNode | IconSvgElement;
  attach?: boolean;
};
type Token = { kind: 'at' | 'slash'; query: string; start: number };
type Latest = Pick<PromptBarProps, 'onSend' | 'onStop' | 'onAttach' | 'onDictate' | 'onEffortChange'>;
type Spark = {
  x: number;
  y: number;
  r: number;
  vy: number;
  sway: number;
  phase: number;
  life: number;
  span: number;
};

interface SendGlyphProps {
  busy: boolean;
  morphDuration: number;
  squash: number;
  tilt: number;
}

const ARROW_UP = [12, 4.5, 18.5, 11, 14.25, 11, 14.25, 19.5, 9.75, 19.5, 9.75, 11, 5.5, 11];
const SQUARE = [12, 6, 18, 6, 18, 12, 18, 18, 6, 18, 6, 12, 6, 6];
const EASE_IN_OUT: [number, number, number, number] = [0.77, 0, 0.175, 1];
const LINE = 22;
const EDGE = 11;

const DEFAULT_SOURCES: PromptBarSource[] = [
  {
    key: 'files',
    name: 'Photos & files',
    description: 'Upload from this device',
    icon: Attachment01Icon,
    attach: true
  },
  { key: 'web', name: 'Web search', description: 'Live results', icon: Globe02Icon },
  { key: 'sales', name: 'Sales data', description: 'Revenue and churn', icon: ChartLineData01Icon },
  { key: 'docs', name: 'Documents', description: 'Specs, notes, briefs', icon: File02Icon },
  { key: 'mail', name: 'Mail', description: 'Read and draft mail', icon: Mail01Icon },
  { key: 'calendar', name: 'Calendar', description: 'Events and availability', icon: Calendar03Icon }
];
const DEFAULT_COMMANDS: PromptBarCommand[] = [
  { key: 'summarize', name: '/summarize', description: 'Digest the thread so far' },
  { key: 'compare', name: '/compare', description: 'Two options side by side' },
  { key: 'draft', name: '/draft', description: 'Write a first version' },
  { key: 'explain', name: '/explain', description: 'A plain-language walkthrough' },
  { key: 'tasks', name: '/tasks', description: 'Turn this into a to-do list' }
];
const DEFAULT_MODELS: PromptBarModel[] = [
  { key: 'nova-3', name: 'Nova 3', tag: 'Flagship' },
  { key: 'nova-mini', name: 'Nova Mini', tag: 'Fast' },
  { key: 'nova-2', name: 'Nova 2', tag: 'Legacy' }
];
const DEFAULT_EFFORTS = ['Low', 'Medium', 'High', 'Extra', 'Max'];

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const pathAt = (a: number[], b: number[], t: number) => {
  let d = '';
  for (let i = 0; i < a.length; i += 2) {
    d += `${i ? 'L' : 'M'}${mix(a[i], b[i], t).toFixed(2)} ${mix(a[i + 1], b[i + 1], t).toFixed(2)}`;
  }
  return `${d}Z`;
};

const parseToken = (draft: string): Token | null => {
  const m = /(^|\s)([@/])([\w-]*)$/.exec(draft);
  if (!m) return null;
  return { kind: m[2] === '@' ? 'at' : 'slash', query: m[3].toLowerCase(), start: m.index + m[1].length };
};

const renderIcon = (icon: ReactNode | IconSvgElement, size: number) =>
  icon == null ? null : isValidElement(icon) ? icon : <HugeiconsIcon icon={icon as IconSvgElement} size={size} strokeWidth={1.8} />;

function SendGlyph({ busy, morphDuration, squash, tilt }: SendGlyphProps) {
  const reduce = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const dir = useRef(busy ? 1 : -1);
  const t = useMotionValue(busy ? 1 : 0);

  useEffect(() => {
    const target = busy ? 1 : 0;
    dir.current = busy ? 1 : -1;
    if (t.get() === target) return undefined;
    const controls = animate(
      t,
      target,
      reduce ? { duration: 0 } : { duration: morphDuration / 1000, ease: EASE_IN_OUT }
    );
    return () => controls.stop();
  }, [busy, morphDuration, reduce, t]);

  useMotionValueEvent(t, 'change', v => {
    pathRef.current?.setAttribute('d', pathAt(ARROW_UP, SQUARE, v));
    const goo = reduce ? 0 : Math.sin(v * Math.PI);
    const sx = 1 - squash * goo;
    if (svgRef.current) {
      svgRef.current.style.transform = goo ? `rotate(${dir.current * tilt * goo}deg) scale(${sx}, ${1 / sx})` : '';
    }
  });

  return (
    <svg
      ref={svgRef}
      className="prompt-bar__glyph"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    >
      <path ref={pathRef} d={pathAt(ARROW_UP, SQUARE, t.get())} />
    </svg>
  );
}

const PromptBar: React.FC<PromptBarProps> = ({
  placeholder = 'Ask anything',
  value,
  onChange,
  inputRef: externalInputRef,
  onPaste,
  externalAttachmentCount = 0,
  onModelChange,
  onStopDictation,
  onCancelDictation,
  dictateLabel = 'Dictate',
  stopDictationLabel = 'Stop dictation',
  cancelDictationLabel = 'Cancelar audio',
  dictateHint,
  sources = DEFAULT_SOURCES,
  toolbarControls,
  toolbarPickers = [],
  inputLeading,
  mobileLayout = false,
  settingsLabel = 'Configuración avanzada',
  onOpenSettings,
  commands = DEFAULT_COMMANDS,
  models = DEFAULT_MODELS,
  defaultModel = '',
  efforts = DEFAULT_EFFORTS,
  effortLabels = {},
  effortTitle = 'Effort',
  effortHelp = 'Higher effort thinks longer before answering',
  reasoningLabel = 'reasoning',
  automaticReasoningLabel = 'automatic reasoning',
  defaultEffort = '',
  onEffortChange,
  busy = false,
  readOnly = false,
  realtime,
  onAudioPhaseChange,
  onSend,
  onStop,
  onQueue,
  queueLabel = 'Queue message',
  onAttach,
  onDictate,
  background = 'var(--pb-theme-bg)',
  color = 'var(--pb-theme-ink)',
  menuBackground = 'var(--pb-theme-menu)',
  sparkColor = 'var(--pb-theme-spark)',
  sparkBoost = 1,
  width = 400,
  radius = 16,
  maxRows = 5,
  morphDuration = 240,
  squash = 0.12,
  tilt = 8,
  pressScale = 0.96,
  className = ''
}) => {
  const reduce = useReducedMotion();
  const menuId = useId();
  const pickerActionRef = useRef<HTMLButtonElement>(null);
  const pickerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);
  const sparkRef = useRef<HTMLCanvasElement>(null);
  const typing = useRef({ energy: 0, strokes: 0 });
  const boost = useRef(sparkBoost);
  boost.current = sparkBoost;
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lastOpen = useRef<string | null>(null);
  const dictation = useRef(0);
  useEffect(() => () => { dictation.current += 1; }, []);
  const latest = useRef<Latest>({});
  latest.current = { onSend, onStop, onAttach, onDictate, onEffortChange };

  const [internalDraft, setInternalDraft] = useState('');
  const draft = value ?? internalDraft;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const setDraft = (next: string | ((current: string) => string)) => {
    const resolved = typeof next === 'function' ? next(draftRef.current) : next;
    draftRef.current = resolved;
    setInternalDraft(resolved);
    onChange?.(resolved);
  };
  const [attachments, setAttachments] = useState<string[]>([]);
  const [modelKey, setModelKey] = useState(defaultModel);
  const [pickerOpen, setPickerOpen] = useState<string | null>(null);
  const [menuLayout, setMenuLayout] = useState({ below: false, height: 480 });
  const [mobileSettingsTarget, setMobileSettingsTarget] = useState<HTMLElement | null>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const [effortOpen, setEffortOpen] = useState(false);
  const [effortIndex, setEffortIndex] = useState(() => {
    const i = efforts.indexOf(defaultEffort);
    return i >= 0 ? i : Math.max(0, Math.floor((efforts.length - 1) / 2));
  });
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(0);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [dictationError, setDictationError] = useState<string | null>(null);
  const [audioMenu, setAudioMenu] = useState(false);
  useEffect(() => { if (!realtime?.active) setAudioMenu(false); }, [realtime?.active]);
  const [pressed, setPressed] = useState(false);

  useEffect(() => { setModelKey(defaultModel); }, [defaultModel]);
  useEffect(() => {
    if (!mobileLayout) { setMobileSettingsTarget(null); return; }
    // Keep the shell's existing slot so mobile navigation can relocate it.
    const sync = () => setMobileSettingsTarget(document.documentElement.classList.contains('lxp-webview')
      ? null : document.getElementById('workspace-chat-plus-control'));
    sync();
    document.addEventListener('astro:after-swap', sync);
    document.addEventListener('astro:page-load', sync);
    return () => {
      document.removeEventListener('astro:after-swap', sync);
      document.removeEventListener('astro:page-load', sync);
    };
  }, [mobileLayout]);
  useEffect(() => {
    const next = efforts.indexOf(defaultEffort);
    setEffortIndex(next >= 0 ? next : Math.max(0, Math.floor((efforts.length - 1) / 2)));
  }, [defaultEffort, efforts]);

  const model = models.find(m => m.key === modelKey) ?? models[0];
  const parsedToken = dismissed ? null : parseToken(draft);
  const token = parsedToken?.kind === 'at' && sources.length === 0 ? null : parsedToken;
  const picker = toolbarPickers.find(item => item.key === pickerOpen);
  const open = picker ? 'context' : modelOpen ? 'model' : effortOpen ? 'effort' : token?.kind ?? null;
  const query = token?.query ?? '';
  const list = useMemo<Row[]>(() => {
    if (open === 'at') return sources.filter(s => s.name.toLowerCase().includes(query));
    if (open === 'slash') return commands.filter(c => c.name.replace(/^\//, '').toLowerCase().startsWith(query));
    if (open === 'model') return models;
    if (open === 'context') return picker?.options ?? [];
    return [];
  }, [open, query, sources, commands, models, picker]);
  const cursor = Math.min(active, Math.max(0, list.length - 1));
  const canSend = !readOnly && (draft.trim().length > 0 || attachments.length > 0 || externalAttachmentCount > 0);
  const armed = busy || canSend;
  const level = efforts[effortIndex] ?? '';
  const visibleLevel = effortLabels[level] ?? level;
  const maxed = efforts.length > 1 && effortIndex === efforts.length - 1;

  const focusInput = () => inputRef.current?.focus({ preventScroll: true });
  const closeMenus = useCallback(() => {
    setPickerOpen(null);
    setModelOpen(false);
    setEffortOpen(false);
  }, []);

  useLayoutEffect(() => {
    const glow = glowRef.current;
    if (!glow || !open) return;
    const row = rowRefs.current[cursor];
    if (!row) {
      glow.style.opacity = '0';
      return;
    }
    const fresh = lastOpen.current !== open;
    lastOpen.current = open;
    if (fresh) glow.style.transition = 'none';
    glow.style.top = `${row.offsetTop}px`;
    glow.style.height = `${row.offsetHeight}px`;
    glow.style.opacity = '1';
    if (fresh) {
      void glow.offsetHeight;
      glow.style.transition = '';
    }
  }, [open, cursor, list]);
  useEffect(() => {
    if (!open) lastOpen.current = null;
  }, [open]);

  useEffect(() => {
    if (!modelOpen && !effortOpen && !pickerOpen) return undefined;
    const onDown = (e: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) closeMenus();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [modelOpen, effortOpen, pickerOpen, closeMenus]);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const above = Math.max(0, rect.top - 12);
      const below = Math.max(0, window.innerHeight - rect.bottom - 12);
      const useBelow = above < 160 && below > above;
      setMenuLayout({ below: useBelow, height: Math.min(480, useBelow ? below : above) });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [open]);
  useEffect(() => {
    if (open === 'context' || open === 'model') rowRefs.current[cursor]?.scrollIntoView({ block: 'nearest' });
  }, [open, cursor]);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = '0px';
    const max = LINE * maxRows;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
  }, [draft, maxRows]);

  useEffect(
    () => () => {
      dictation.current += 1;
    },
    []
  );

  useEffect(() => {
    const canvas = sparkRef.current;
    if (!maxed || reduce || !canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    typing.current.strokes = 0;
    let raf = 0;
    let last = performance.now();
    let w = 0;
    let h = 0;
    let due = 0;
    let speed = 1;
    let pulse = 0;
    const parts: Spark[] = [];
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const spawn = (burst: boolean) => {
      parts.push({
        x: Math.random() * w,
        y: burst ? h * (0.2 + Math.random() * 0.8) : h + 3,
        r: 0.9 + Math.random() * 1.1,
        vy: -(7 + Math.random() * 9),
        sway: (Math.random() - 0.5) * 10,
        phase: Math.random() * Math.PI * 2,
        life: burst ? Math.random() * 1.2 : 0,
        span: 2.4 + Math.random() * 2.4
      });
    };
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const typed = typing.current;
      const gain = boost.current;
      typed.energy *= Math.exp(-dt / 0.8);
      pulse *= Math.exp(-dt / 0.16);
      if (typed.strokes > 0) {
        typed.strokes = 0;
        if (gain > 0) pulse = 1;
      }
      const energy = typed.energy * gain;
      speed += (1 + energy * 6 - speed) * (1 - Math.exp(-dt / 0.15));
      due += dt;
      while (due > 0.14) {
        due -= 0.14;
        if (parts.length < 30) spawn(false);
      }
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = sparkColor;
      ctx.shadowColor = sparkColor;
      ctx.shadowBlur = 6 + energy * 10 + pulse * 6;
      for (let i = parts.length - 1; i >= 0; i -= 1) {
        const p = parts[i];
        p.life += dt;
        if (p.life > p.span) {
          parts.splice(i, 1);
          continue;
        }
        const k = p.life / p.span;
        const twinkle = 0.7 + 0.3 * Math.sin((now / 160) * (1 + energy) + p.phase);
        p.y += p.vy * dt * speed;
        if (p.y < -4) {
          p.y = h + 3;
          p.x = Math.random() * w;
        }
        const edge = Math.min(1, Math.max(0, p.y / 14), Math.max(0, (h - p.y) / 14));
        ctx.globalAlpha = Math.min(1, Math.sin(k * Math.PI) * (0.9 + energy * 0.25) * twinkle) * edge;
        ctx.beginPath();
        ctx.arc(
          p.x + Math.sin((now / 900) * (1 + energy * 0.8) + p.phase) * p.sway,
          p.y,
          p.r * twinkle * (1 + energy * 0.35),
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    resize();
    for (let i = 0; i < 26; i += 1) spawn(true);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      ctx.clearRect(0, 0, w, h);
    };
  }, [maxed, reduce, sparkColor]);

  const setEffort = (i: number) => {
    const next = Math.max(0, Math.min(efforts.length - 1, i));
    if (next === effortIndex) return;
    setEffortIndex(next);
    latest.current.onEffortChange?.(efforts[next]);
  };
  const effortFromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const k = (e.clientX - rect.left - EDGE) / Math.max(1, rect.width - 2 * EDGE);
    setEffort(Math.round(k * (efforts.length - 1)));
  };
  const onEffortKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (step) {
      e.preventDefault();
      setEffort(effortIndex + step);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setEffort(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setEffort(efforts.length - 1);
    } else if (e.key === 'Escape') {
      setEffortOpen(false);
      focusInput();
    }
  };
  const stepAt = (i: number) => `calc(${EDGE}px + (100% - ${EDGE * 2}px) * ${i / Math.max(1, efforts.length - 1)})`;
  const fillAt = (i: number) => (i === efforts.length - 1 ? '100%' : `calc(${stepAt(i)} + 7px)`);

  const pick = (row: Row) => {
    if (open === 'context' && picker) {
      const onChange = picker.onChange;
      closeMenus();
      setDismissed(true);
      onChange(row.key);
      return;
    }
    if (open === 'model') {
      setModelKey(row.key);
      onModelChange?.(row.key);
      setModelOpen(false);
      focusInput();
      return;
    }
    const head = token ? draft.slice(0, token.start) : draft;
    const source = sources.find(s => s.key === row.key);
    if (source?.onSelect) {
      setDismissed(false);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      source.onSelect();
      return;
    } else if (row.attach) {
      setDraft(head);
      Promise.resolve(latest.current.onAttach?.()).then(files => {
        if (!files) return;
        setAttachments(a => [...a, ...(Array.isArray(files) ? files : [files])]);
      });
    } else if (open === 'at') {
      setDraft(`${head}@${row.name} `);
    } else {
      setDraft(`${head}${row.name} `);
    }
    setDismissed(false);
    focusInput();
  };

  const send = () => {
    if (!canSend || busy || listening || transcribing || realtime?.active) return;
    latest.current.onSend?.(draft.trim(), { attachments, model, effort: level });
    setDraft('');
    setAttachments([]);
    setDismissed(false);
    closeMenus();
    focusInput();
  };

  const toggleListen = () => {
    if (listening) {
      if (transcribing) return;
      setTranscribing(true);
      onStopDictation?.();
      return;
    }
    setDictationError(null);
    const seq = ++dictation.current;
    setListening(true);
    onAudioPhaseChange?.(true);
    Promise.resolve(latest.current.onDictate?.()).then(
      async text => {
        if (seq !== dictation.current) return;
        setTranscribing(true);
        try {
        const recorded = typeof text === "object" ? text : undefined;
        const transcript = (typeof text === "string" ? text : recorded?.text)?.trim();
        if (transcript) {
          if (recorded) {
            await latest.current.onSend?.(transcript, { attachments: [], model, effort: level, recording: recorded.recording });
          } else {
            // A transcript is voice input, never the user's text draft.
            await latest.current.onSend?.(transcript, { attachments: [], model, effort: level });
          }
        }
        } catch { setDictationError("No se pudo enviar el audio."); }
        finally { setListening(false); setTranscribing(false); onAudioPhaseChange?.(false); }
        focusInput();
      },
      err => {
        if (seq !== dictation.current) return;
        setListening(false);
        setTranscribing(false);
        onAudioPhaseChange?.(false);
        const message = err instanceof Error ? err.message : String(err);
        setDictationError(
          /^OpenAI (?:no autenticó la clave API|rechazó la clave API guardada|denegó el acceso de esta clave|no autorizó la IP de este servidor|no pudo procesar|limitó las solicitudes)/i.test(message)
            ? message
            : /Configura una (?:API key|clave API) de OpenAI|OpenAI \(slot codex\) sin API key/i.test(message)
            ? 'Configura una clave API de OpenAI en Ajustes → Agentes IA → OpenAI para transcribir audio.'
            : /NotAllowedError|Permission denied|denied|permiso/i.test(message)
              ? 'Permite el acceso al micrófono para grabar audio.'
              : /NotFoundError|no.*microphone|sin micrófono/i.test(message)
                ? 'No se encontró un micrófono disponible.'
                : /429|quota|cuota/i.test(message)
                  ? 'La cuota de OpenAI no permite transcribir el audio ahora.'
                  : /La grabación está vacía|No se detectó voz/i.test(message)
                    ? message
                    : 'No se pudo transcribir el audio. Inténtalo de nuevo.',
        );
      }
    );
  };

  const cancelDictation = () => {
    onCancelDictation?.();
    onAudioPhaseChange?.(false);
    dictation.current += 1;
    setListening(false);
    setTranscribing(false);
    setDictationError(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open && list.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((cursor + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length);
        return;
      }
      if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
        e.preventDefault();
        pick(list[cursor]);
        return;
      }
    }
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setDismissed(true);
        closeMenus();
      }
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const onPickerKeyDown = (e: KeyboardEvent<HTMLButtonElement>, key: string, options: Row[], selected: string) => {
    const isOpen = key === 'model' ? modelOpen : pickerOpen === key;
    pickerTriggerRef.current = e.currentTarget;
    if (e.key === 'Tab' && !e.shiftKey && isOpen && key !== 'model' && picker?.action) {
      e.preventDefault(); pickerActionRef.current?.focus({ preventScroll: true }); return;
    }
    if (e.key === 'Escape' || e.key === 'Tab') {
      if (isOpen) { if (e.key === 'Escape') e.preventDefault(); closeMenus(); setDismissed(true); }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      if (!options.length) return;
      if (!isOpen) {
        closeMenus();
        setDismissed(true);
        if (key === 'model') setModelOpen(true); else setPickerOpen(key);
        setActive(e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : Math.max(0, options.findIndex(row => row.key === selected)));
      } else setActive(e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : (cursor + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length);
    } else if (isOpen && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      if (list[cursor]) pick(list[cursor]);
    }
  };

  const down = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || !armed) return;
    setPressed(true);
  };
  const up = () => setPressed(false);

  const dictateButton = onDictate ? (
    <button
      type="button"
      className="prompt-bar__tool"
      aria-label={listening ? stopDictationLabel : dictateLabel}
      title={listening ? stopDictationLabel : (dictateHint ?? dictateLabel)}
      aria-pressed={listening}
      disabled={transcribing}
      data-on={listening ? '' : undefined}
      onMouseDown={e => e.preventDefault()}
      onClick={toggleListen}
    >
      {transcribing ? <i className="ti ti-loader-2 animate-spin" aria-hidden="true" /> : listening ? (
        <span className="prompt-bar__eq" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      ) : (
        <HugeiconsIcon icon={Mic01Icon} size={15} strokeWidth={2} />
      )}
    </button>
  ) : null;
  const cancelDictationButton = listening && onCancelDictation ? (
    <button type="button" className="prompt-bar__tool" aria-label={cancelDictationLabel}
      title={cancelDictationLabel} onMouseDown={e => e.preventDefault()} onClick={cancelDictation}>
      <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} />
    </button>
  ) : null;
  const queueButton = busy && canSend && onQueue && !listening && !transcribing && !realtime?.active ? (
    <button
      type="button"
      className="prompt-bar__tool prompt-bar__queue"
      aria-label={queueLabel}
      title={queueLabel}
      onMouseDown={e => e.preventDefault()}
      onClick={onQueue}
    >
      <i className="ti ti-clock-plus" aria-hidden="true" />
    </button>
  ) : null;
  const settingsButton = onOpenSettings ? (
    <button
      type="button"
      className="prompt-bar__tool lxp-chat-plus-button"
      data-search-target="chat-prompt-settings"
      aria-label={realtime?.active ? "Opciones de audio" : settingsLabel}
      title={realtime?.active ? "Opciones de audio" : settingsLabel}
      aria-haspopup="dialog"
      onClick={() => {
        closeMenus();
        setDismissed(true);
        if (realtime?.active) setAudioMenu(v => !v); else onOpenSettings();
      }}
    >
      <i className="ti ti-settings text-base" aria-hidden="true" />
    </button>
  ) : null;

  const showDictateInSend = !!onDictate && (listening || transcribing || (!busy && !canSend));
  // An idle voice feature must not hide Stop during a text/API/CLI run.
  const sendButton = realtime && (realtime.active || (!busy && !canSend)) ? (
    <button type="button" className="prompt-bar__send" data-armed=""
      aria-label={realtime.active ? "Terminar voz en tiempo real" : "Iniciar voz en tiempo real"}
      aria-pressed={realtime.active} aria-busy={realtime.phase === "connecting" || realtime.phase === "closing"}
      data-recording={realtime.active && !realtime.muted ? "" : undefined}
      title={realtime.active ? (realtime.phase === "closing" ? "Terminando voz…" : realtime.phase === "connecting" ? "Conectando voz · pulsa para cancelar" : realtime.muted ? "Micrófono silenciado · pulsa para terminar" : "Voz activa · pulsa para terminar") : "Iniciar voz en tiempo real"}
      onClick={realtime.toggle}>
      {realtime.active ? <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, background: "currentColor" }} /> : <HugeiconsIcon icon={Mic01Icon} size={18} strokeWidth={2} />}
    </button>
  ) : showDictateInSend ? (
    <button
      type="button"
      className="prompt-bar__send"
      data-armed=""
      data-recording={listening ? "" : undefined}
      aria-label={listening ? stopDictationLabel : dictateLabel}
      title={listening ? stopDictationLabel : (dictateHint ?? dictateLabel)}
      aria-pressed={listening}
      disabled={transcribing}
      onMouseDown={e => e.preventDefault()}
      onClick={toggleListen}
    >
      {transcribing ? <i className="ti ti-loader-2 animate-spin" aria-hidden="true" /> : listening ? <span className="prompt-bar__eq" aria-hidden="true"><i /><i /><i /></span> : <HugeiconsIcon icon={Mic01Icon} size={18} strokeWidth={2} />}
    </button>
  ) : (
    <button
      type="button"
      className="prompt-bar__send"
      disabled={!armed}
      aria-label={busy ? 'Stop' : 'Send'}
      data-armed={armed ? '' : undefined}
      data-pressed={pressed ? '' : undefined}
      onMouseDown={e => e.preventDefault()}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
      onClick={() => {
        if (busy) latest.current.onStop?.();
        else send();
      }}
    >
      <SendGlyph busy={busy} morphDuration={morphDuration} squash={squash} tilt={tilt} />
    </button>
  );

  const menuNode = open ? (
        <div
          id={menuId}
          className="prompt-bar__menu"
          data-placement={menuLayout.below ? "below" : "above"}
          style={{ maxHeight: menuLayout.height }}
          role={open === 'effort' ? 'dialog' : open === 'context' ? 'group' : 'listbox'}
          aria-label={
            open === 'context' ? picker?.label : open === 'at' ? 'Sources' : open === 'slash' ? 'Commands' : open === 'model' ? 'Models' : 'Effort'
          }
          data-kind={open}
        >
          {open === 'effort' ? (
            <>
              <div className="prompt-bar__effort-head">
                <span className="prompt-bar__effort-title">{effortTitle}</span>
                <span className="prompt-bar__effort-level">{visibleLevel}</span>
                <span className="prompt-bar__effort-help" title={effortHelp}>
                  <HugeiconsIcon icon={HelpCircleIcon} size={14} strokeWidth={1.8} />
                </span>
              </div>
              <div
                className="prompt-bar__effort-track"
                role="slider"
                tabIndex={0}
                aria-label={effortTitle}
                aria-valuemin={0}
                aria-valuemax={efforts.length - 1}
                aria-valuenow={effortIndex}
                aria-valuetext={visibleLevel}
                style={
                  { '--pb-effort-x': stepAt(effortIndex), '--pb-effort-fill': fillAt(effortIndex) } as CSSProperties
                }
                onPointerDown={e => {
                  if (e.button !== 0) return;
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {}
                  e.currentTarget.focus({ preventScroll: true });
                  effortFromPointer(e);
                }}
                onPointerMove={e => {
                  if (e.buttons & 1) effortFromPointer(e);
                }}
                onKeyDown={onEffortKey}
              >
                <span className="prompt-bar__effort-fill" />
                {efforts.map((label, i) => (
                  <i key={label} className="prompt-bar__effort-dot" style={{ left: stepAt(i) }} />
                ))}
                <span className="prompt-bar__effort-thumb" />
              </div>
              <div className="prompt-bar__effort-labels" aria-hidden="true">
                {efforts.map((label, i) => <span key={label} data-on={i === effortIndex ? '' : undefined}>{effortLabels[label] ?? label}</span>)}
              </div>
              <p className="prompt-bar__effort-summary">{model?.name ?? 'Auto'} · {level === 'Auto' ? automaticReasoningLabel : `${reasoningLabel} ${visibleLevel.toLowerCase()}`}</p>
            </>
          ) : (
            <>
              <div role={open === 'context' ? 'listbox' : undefined}
                id={open === 'context' ? `${menuId}-list` : undefined}
                aria-label={open === 'context' ? picker?.label : undefined}>
              <span ref={glowRef} className="prompt-bar__glow" aria-hidden="true" />
              {list.map((row, i) => (
                <Fragment key={row.key}>
                <button
                  key={row.key}
                  id={`${menuId}-${i}`}
                  tabIndex={open === "context" || open === "model" ? -1 : 0}
                  ref={el => {
                    rowRefs.current[i] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={open === 'context' ? row.key === picker?.value : open === 'model' ? row.key === model?.key : i === cursor}
                  data-active={i === cursor ? '' : undefined}
                  className="prompt-bar__row"
                  onMouseDown={e => e.preventDefault()}
                  onPointerMove={() => setActive(i)}
                  onClick={() => pick(row)}
                >
                  {open === 'at' || open === 'context' ? <span className="prompt-bar__row-icon">{renderIcon(row.icon, 15)}</span> : null}
                  <span className="prompt-bar__row-name">{row.name}</span>
                  {row.description ? <span className="prompt-bar__row-desc">{row.description}</span> : null}
                  {open === 'model' || open === 'context' ? (
                    <>
                      <span className="prompt-bar__row-tag">{row.tag}</span>
                      <span className="prompt-bar__row-check" data-on={row.key === (open === 'context' ? picker?.value : model?.key) ? '' : undefined}>
                        <HugeiconsIcon icon={Tick02Icon} size={13} strokeWidth={2.5} />
                      </span>
                    </>
                  ) : null}
                </button>
                </Fragment>
              ))}
              {list.length === 0 ? <div className="prompt-bar__empty">No matches for “{query}”</div> : null}
              </div>
              {open === 'context' && picker?.action ? <div className="prompt-bar__menu-footer">
                <button ref={pickerActionRef} type="button" className="prompt-bar__row prompt-bar__picker-action"
                  onKeyDown={event => {
                    if (event.key === "Escape" || event.key === "Tab") {
                      event.preventDefault(); closeMenus(); setDismissed(true);
                      pickerTriggerRef.current?.focus({ preventScroll: true });
                    }
                  }}
                  onClick={() => {
                    const action = picker.action;
                    closeMenus(); setDismissed(true);
                    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
                    action?.onSelect();
                  }}>
                  {picker.action.icon && <span className="prompt-bar__row-icon">{picker.action.icon}</span>}
                  <span className="prompt-bar__row-name">{picker.action.label}</span>
                </button>
              </div> : null}
            </>
          )}
        </div>
  ) : null;

  return (
    <div
      ref={rootRef}
      className={`prompt-bar${className ? ` ${className}` : ''}`}
      data-busy={busy ? '' : undefined}
      data-max={maxed ? '' : undefined}
      style={
        {
          '--pb-bg': background,
          '--pb-ink': color,
          '--pb-menu': menuBackground,
          '--pb-w': `${width}px`,
          '--pb-radius': `${radius}px`,
          '--pb-spark': sparkColor,
          '--pb-press': pressScale
        } as CSSProperties
      }
    >
      {mobileLayout && mobileSettingsTarget ? createPortal(settingsButton, mobileSettingsTarget) : null}
      {menuNode}

      <div
        className="prompt-bar__field"
        role="presentation"
        data-max={maxed ? '' : undefined}
        onPointerDown={e => {
          if (e.target === e.currentTarget || e.target === inputRef.current) closeMenus();
        }}
        onClick={e => { if (e.target === e.currentTarget) focusInput(); }}
      >
        <canvas ref={sparkRef} className="prompt-bar__sparks" aria-hidden="true" />
        {attachments.length > 0 ? (
          <div className="prompt-bar__chips">
            {attachments.map((file, i) => (
              <span key={`${file}-${i}`} className="prompt-bar__chip">
                <HugeiconsIcon icon={File02Icon} size={12} strokeWidth={2} />
                <span className="prompt-bar__chip-name">{file}</span>
                <button
                  type="button"
                  className="prompt-bar__chip-x"
                  aria-label={`Remove ${file}`}
                  onClick={() => setAttachments(a => a.filter((_, j) => j !== i))}
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={10} strokeWidth={2.5} />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="prompt-bar__input-row">
          {mobileLayout ? (mobileSettingsTarget ? null : settingsButton) : inputLeading}
          <textarea
            ref={node => {
              inputRef.current = node;
              if (typeof externalInputRef === 'function') externalInputRef(node);
              else if (externalInputRef) (externalInputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
            }}
            className="prompt-bar__input"
            rows={1}
            value={draft}
            readOnly={readOnly}
            placeholder={realtime?.active ? (realtime.phase === "closing" ? "Terminando voz…" : realtime.phase === "connecting" ? "Conectando voz…" : realtime.muted ? "Micrófono silenciado" : "Habla con el agente…") : listening ? (transcribing ? 'Transcribiendo audio…' : 'Grabando audio…') : placeholder}
            aria-label="Prompt"
            onChange={e => {
              setDraft(e.target.value);
              setDictationError(null);
              typing.current.energy = Math.min(1.6, typing.current.energy + 0.22);
              typing.current.strokes = Math.min(4, typing.current.strokes + 1);
              setDismissed(false);
              closeMenus();
              setActive(0);
            }}
            onFocus={closeMenus}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
          />
          {mobileLayout && cancelDictationButton}
          {mobileLayout && listening && !showDictateInSend && dictateButton}
          {mobileLayout && queueButton}
          {mobileLayout && sendButton}
        </div>
        {audioMenu && realtime?.active && <div role="group" aria-label="Opciones de audio" className="flex flex-wrap gap-3 px-3 py-2 text-xs">
          <button type="button" className="underline" onClick={() => { realtime.toggleMuted?.(); setAudioMenu(false); }}>{realtime.muted ? "Activar micrófono" : "Silenciar micrófono"}</button>
          <button type="button" className="underline" onClick={() => { setAudioMenu(false); onOpenSettings?.(); }}>{settingsLabel}</button>
        </div>}
        {realtime?.error && <p role="alert" className="px-3 text-xs text-amber-600">{realtime.error}
          {realtime.previousId && <button type="button" className="ml-2 underline" onClick={realtime.closePrevious}>Finalizar sesión anterior</button>}
        </p>}
        {dictationError && <p role="alert" className="text-xs text-red-500">{dictationError}</p>}

        <div className="prompt-bar__bar">
          {!mobileLayout && settingsButton}
          {toolbarPickers.length > 0 || toolbarControls ? <span className="prompt-bar__toolbar-controls">
            {toolbarPickers.map(item => {
              const selected = item.options.find(option => option.key === item.value);
              const expanded = pickerOpen === item.key;
              return <span key={item.key} className={`prompt-bar__picker-group prompt-bar__picker-group--${item.key}`}>
                {item.before && <span className="prompt-bar__picker-leading" onClick={closeMenus}>{item.before}</span>}
                <button type="button" className="prompt-bar__pick prompt-bar__context-pick"
                  data-picker={item.key} role="combobox" aria-label={item.label} title={item.title ?? selected?.name ?? item.label}
                  aria-haspopup="listbox" aria-expanded={expanded} aria-controls={expanded ? `${menuId}-list` : undefined}
                  aria-activedescendant={expanded && list.length ? `${menuId}-${cursor}` : undefined}
                  data-on={expanded ? '' : undefined}
                  onKeyDown={event => onPickerKeyDown(event, item.key, item.options, item.value)}
                  onClick={event => {
                    pickerTriggerRef.current = event.currentTarget;
                    closeMenus(); setDismissed(true);
                    setActive(Math.max(0, item.options.findIndex(option => option.key === item.value)));
                    setPickerOpen(expanded ? null : item.key);
                  }}>
                  {item.icon && <span className="prompt-bar__picker-icon">{item.icon}</span>}
                  <span className="prompt-bar__picker-value">{selected?.name ?? item.label}</span>
                  <HugeiconsIcon icon={ArrowDown01Icon} size={12} strokeWidth={2.4} />
                </button>
              </span>;
            })}
            {toolbarControls}
          </span> : null}
          {models.length > 0 ? (
            <button
              type="button"
              className="prompt-bar__pick"
              role="combobox"
              aria-label="Choose model"
              aria-haspopup="listbox"
              aria-controls={modelOpen ? menuId : undefined}
              aria-activedescendant={modelOpen && list.length ? `${menuId}-${cursor}` : undefined}
              onKeyDown={event => onPickerKeyDown(event, "model", models, modelKey)}
              title={model.name}
              aria-expanded={modelOpen}
              data-on={modelOpen ? '' : undefined}
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                setPickerOpen(null);
                setDismissed(true);
                setEffortOpen(false);
                setActive(Math.max(0, models.indexOf(model)));
                setModelOpen(v => !v);
              }}
            >
              <span>{model.name}</span>
              <HugeiconsIcon icon={ArrowDown01Icon} size={12} strokeWidth={2.4} />
            </button>
          ) : null}
          {efforts.length > 0 ? (
            <button
              type="button"
              className="prompt-bar__pick"
              aria-label={`${visibleLevel} · ${effortTitle}`}
              aria-expanded={effortOpen}
              data-on={effortOpen ? '' : undefined}
              data-max={maxed ? '' : undefined}
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                setPickerOpen(null);
                setDismissed(true);
                setModelOpen(false);
                setEffortOpen(v => !v);
              }}
            >
              <HugeiconsIcon icon={SparklesIcon} size={13} strokeWidth={2} />
              <span>{visibleLevel}</span>
            </button>
          ) : null}
          <span className="prompt-bar__spacer" />
          {!mobileLayout && cancelDictationButton}
          {!mobileLayout && listening && !showDictateInSend && dictateButton}
          {!mobileLayout && queueButton}
          {!mobileLayout && sendButton}
        </div>
      </div>
    </div>
  );
};

export default PromptBar;
