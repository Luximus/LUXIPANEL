declare module "virtual:lxp-controller/*" {
  export function mount(scope: import("./controller-scope").ControllerScope): void | (() => void);
}
declare module "*chat-event-stream.js" {
  export const acquireChatStream: typeof import("../../lib/chat-event-stream").acquireChatStream;
}
interface Window {
  __lxpModuleNav?: { opened(link: HTMLElement): void; reset(): void; show(link: HTMLElement): boolean; activateRoot(document: unknown, url: URL, window: unknown): void };
}

declare module "*logout.js?v=20260929-logout-spinner" { export const bindLogout: typeof import("../../scripts/extracted/lib/logout").bindLogout; }
