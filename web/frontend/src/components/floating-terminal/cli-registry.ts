// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
export type CliId =
  | "default"
  | "opencode"
  | "claude"
  | "codex"
  | "grok"
  | "gemini"
  | "copilot"
  | "cursor"
  | "aider"
  | "qwen"
  | "continue"
  | "goose"
  | "crush"
  | "amp"
  | "openhands"
  | "codebuff"
  | "minimax";

export interface CliEntry {
  id: CliId;
  label: string;
  command: string;
  description: string;
  icon: string;
  installCommand: string | null;
  detectCommand: string;
  homepage: string;
}

export const CLI_REGISTRY: CliEntry[] = [
  {
    id: "default",
    label: "Default",
    command: "",
    description: "Bash sin autostart de ningún CLI.",
    icon: "ti-terminal-2",
    installCommand: null,
    detectCommand: "",
    homepage: "",
  },
  {
    id: "opencode",
    label: "Opencode",
    command: "opencode",
    description: "Agente terminal opensource compatible con varios modelos.",
    icon: "ti-square-asterisk",
    installCommand: "sudo npm install -g opencode-ai",
    detectCommand: "command -v opencode",
    homepage: "https://opencode.ai",
  },
  {
    id: "claude",
    label: "Claude CLI",
    command: "claude",
    description: "Claude Code de Anthropic.",
    icon: "ti-message-2-code",
    installCommand: "sudo npm install -g @anthropic-ai/claude-code",
    detectCommand: "command -v claude",
    homepage: "https://docs.claude.com/en/docs/claude-code",
  },
  {
    id: "codex",
    label: "Codex CLI",
    command: "codex",
    description: "OpenAI Codex CLI.",
    icon: "ti-brand-openai",
    installCommand: "sudo npm install -g @openai/codex",
    detectCommand: "command -v codex",
    homepage: "https://github.com/openai/codex",
  },
  {
    id: "grok",
    label: "Grok CLI",
    command: "grok",
    description: "Agente de codificación en terminal de xAI (Grok); soporta modo headless.",
    icon: "ti-robot-face",
    installCommand:
      "curl -fsSL https://raw.githubusercontent.com/superagent-ai/grok-cli/main/install.sh | bash",
    detectCommand: "command -v grok",
    homepage: "https://github.com/superagent-ai/grok-cli",
  },
  {
    id: "gemini",
    label: "Gemini CLI",
    command: "gemini",
    description: "Google Gemini CLI.",
    icon: "ti-sparkles",
    installCommand: "sudo npm install -g @google/gemini-cli",
    detectCommand: "command -v gemini",
    homepage: "https://github.com/google-gemini/gemini-cli",
  },
  {
    id: "copilot",
    label: "GitHub Copilot CLI",
    command: "copilot",
    description: "Asistente de GitHub Copilot en terminal.",
    icon: "ti-brand-github-copilot",
    installCommand: "sudo npm install -g @github/copilot",
    detectCommand: "command -v copilot",
    homepage: "https://github.com/github/copilot-cli",
  },
  {
    id: "cursor",
    label: "Cursor CLI",
    command: "cursor-agent",
    description: "Agente CLI de Cursor.",
    icon: "ti-pointer",
    installCommand: "curl https://cursor.com/install -fsS | bash",
    detectCommand: "command -v cursor-agent",
    homepage: "https://docs.cursor.com/cli",
  },
  {
    id: "aider",
    label: "Aider",
    command: "aider",
    description: "Pair programming en terminal con LLMs.",
    icon: "ti-git-pull-request",
    installCommand: "python3 -m pip install aider-install && aider-install",
    detectCommand: "command -v aider",
    homepage: "https://aider.chat",
  },
  {
    id: "qwen",
    label: "Qwen Code",
    command: "qwen",
    description: "Qwen Code CLI de Alibaba.",
    icon: "ti-brain",
    installCommand: "sudo npm install -g @qwen-code/qwen-code",
    detectCommand: "command -v qwen",
    homepage: "https://github.com/QwenLM/qwen-code",
  },
  {
    id: "continue",
    label: "Continue CLI",
    command: "cn",
    description: "Continue.dev en terminal.",
    icon: "ti-arrow-right-bar",
    installCommand: "sudo npm install -g @continuedev/cli",
    detectCommand: "command -v cn",
    homepage: "https://docs.continue.dev/reference/cli",
  },
  {
    id: "goose",
    label: "Goose CLI",
    command: "goose",
    description: "Goose de Block — agente open source.",
    icon: "ti-feather",
    installCommand:
      "curl -fsSL https://github.com/aaif-goose/goose/releases/download/stable/download_cli.sh | bash",
    detectCommand: "command -v goose",
    homepage: "https://block.github.io/goose",
  },
  {
    id: "crush",
    label: "Crush",
    command: "crush",
    description: "Crush de Charm — agente terminal cool.",
    icon: "ti-flame",
    installCommand: "sudo npm install -g @charmland/crush",
    detectCommand: "command -v crush",
    homepage: "https://github.com/charmbracelet/crush",
  },
  {
    id: "amp",
    label: "Amp",
    command: "amp",
    description: "Amp de Sourcegraph.",
    icon: "ti-bolt",
    installCommand: "sudo npm install -g @sourcegraph/amp",
    detectCommand: "command -v amp",
    homepage: "https://ampcode.com",
  },
  {
    id: "openhands",
    label: "OpenHands",
    command: "openhands",
    description: "OpenHands CLI (All Hands AI).",
    icon: "ti-hand-stop",
    installCommand: "curl -fsSL https://install.openhands.dev/install.sh | sh",
    detectCommand: "command -v openhands",
    homepage: "https://docs.openhands.dev",
  },
  {
    id: "codebuff",
    label: "Codebuff",
    command: "codebuff",
    description: "Codebuff CLI.",
    icon: "ti-tools",
    installCommand: "sudo npm install -g codebuff",
    detectCommand: "command -v codebuff",
    homepage: "https://www.codebuff.com",
  },
  {
    id: "minimax",
    label: "MiniMax CLI",
    command: "mmx",
    description: "MiniMax CLI (mmx) — texto, visión, imagen, vídeo y voz.",
    icon: "ti-sparkles",
    installCommand: "sudo npm install -g mmx-cli",
    detectCommand: "command -v mmx",
    homepage: "https://platform.minimax.io/docs/token-plan/minimax-cli",
  },
];

const CLI_BY_ID: Record<CliId, CliEntry> = Object.fromEntries(
  CLI_REGISTRY.map((e) => [e.id, e]),
) as Record<CliId, CliEntry>;

export function getCli(id: string | null | undefined): CliEntry | null {
  if (!id) return null;
  return CLI_BY_ID[id as CliId] ?? null;
}

export function isInstallable(entry: CliEntry): boolean {
  return entry.installCommand !== null;
}
