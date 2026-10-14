export type PanelProfile = { id: string; name: string; baseUrl: string };
export type PanelDesktopState = { language?: string; profiles: PanelProfile[]; tabs: { id: string; profileId: string; loading?: boolean; error?: string }[]; activeTab?: string };
declare global { interface Window { panelDesktop?: {
  state(): Promise<PanelDesktopState>; subscribe(fn: (state: PanelDesktopState) => void): () => void;
  language(locale: string): Promise<void>; settings(): Promise<void>; hideSettings(): Promise<void>;
  probe(url: string): Promise<{ baseUrl: string }>; save(profile: Partial<PanelProfile>): Promise<PanelProfile>;
  migrate(profiles: Partial<PanelProfile>[]): Promise<PanelDesktopState>; remove(id: string): Promise<void>;
  open(id: string): Promise<void>; activate(id: string): Promise<void>; close(id: string): Promise<void>; reload(): Promise<void>;
  window(action: "minimize" | "maximize" | "close"): Promise<void>;
} } }
