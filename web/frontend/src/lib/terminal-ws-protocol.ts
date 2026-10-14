// Terminal WS wire protocol. Twin of backend/src/shared/terminal-ws-protocol.ts — keep in sync.
export const TerminalWsMsg = {
  INPUT: "input", RESIZE: "resize", PING: "ping",
  OUTPUT: "output", PONG: "pong",
} as const;
