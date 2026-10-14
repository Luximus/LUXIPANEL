// Ordered native copy of floating-terminal/cli-registry.ts in the web workspace.
export const terminalCliCatalog = [
  {
    "id": "default",
    "label": "Default",
    "description": "Bash sin autostart de ningún CLI.",
    "installCommand": null
  },
  {
    "id": "opencode",
    "label": "Opencode",
    "description": "Agente terminal opensource compatible con varios modelos.",
    "installCommand": "sudo npm install -g opencode-ai"
  },
  {
    "id": "claude",
    "label": "Claude CLI",
    "description": "Claude Code de Anthropic.",
    "installCommand": "sudo npm install -g @anthropic-ai/claude-code"
  },
  {
    "id": "codex",
    "label": "Codex CLI",
    "description": "OpenAI Codex CLI.",
    "installCommand": "sudo npm install -g @openai/codex"
  },
  {
    "id": "grok",
    "label": "Grok CLI",
    "description": "Agente de codificación en terminal de xAI (Grok); soporta modo headless.",
    "installCommand": "curl -fsSL https://raw.githubusercontent.com/superagent-ai/grok-cli/main/install.sh | bash"
  },
  {
    "id": "gemini",
    "label": "Gemini CLI",
    "description": "Google Gemini CLI.",
    "installCommand": "sudo npm install -g @google/gemini-cli"
  },
  {
    "id": "copilot",
    "label": "GitHub Copilot CLI",
    "description": "Asistente de GitHub Copilot en terminal.",
    "installCommand": "sudo npm install -g @github/copilot"
  },
  {
    "id": "cursor",
    "label": "Cursor CLI",
    "description": "Agente CLI de Cursor.",
    "installCommand": "curl https://cursor.com/install -fsS | bash"
  },
  {
    "id": "aider",
    "label": "Aider",
    "description": "Pair programming en terminal con LLMs.",
    "installCommand": "python3 -m pip install aider-install && aider-install"
  },
  {
    "id": "qwen",
    "label": "Qwen Code",
    "description": "Qwen Code CLI de Alibaba.",
    "installCommand": "sudo npm install -g @qwen-code/qwen-code"
  },
  {
    "id": "continue",
    "label": "Continue CLI",
    "description": "Continue.dev en terminal.",
    "installCommand": "sudo npm install -g @continuedev/cli"
  },
  {
    "id": "goose",
    "label": "Goose CLI",
    "description": "Goose de Block — agente open source.",
    "installCommand": "curl -fsSL https://github.com/aaif-goose/goose/releases/download/stable/download_cli.sh | bash"
  },
  {
    "id": "crush",
    "label": "Crush",
    "description": "Crush de Charm — agente terminal cool.",
    "installCommand": "sudo npm install -g @charmland/crush"
  },
  {
    "id": "amp",
    "label": "Amp",
    "description": "Amp de Sourcegraph.",
    "installCommand": "sudo npm install -g @sourcegraph/amp"
  },
  {
    "id": "openhands",
    "label": "OpenHands",
    "description": "OpenHands CLI (All Hands AI).",
    "installCommand": "curl -fsSL https://install.openhands.dev/install.sh | sh"
  },
  {
    "id": "codebuff",
    "label": "Codebuff",
    "description": "Codebuff CLI.",
    "installCommand": "sudo npm install -g codebuff"
  },
  {
    "id": "minimax",
    "label": "MiniMax CLI",
    "description": "MiniMax CLI (mmx) — texto, visión, imagen, vídeo y voz.",
    "installCommand": "sudo npm install -g mmx-cli"
  }
];
