// Cron page — AI provider models + labels.
import { t } from "./dom";

  // Models per provider — mirrors the AI Assistant's PROVIDER_MODELS.
  export const PROVIDER_MODELS: Record<string, string[]> = {
    claude: ["claude-fable-5", "claude-opus-4-8", "claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5"],
    codex: ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.6"],
    gemini: ["gemini-3.5-flash", "gemini-3.1-pro-preview", "gemini-2.5-pro", "gemini-2.5-flash"],
    deepseek: ["deepseek-chat", "deepseek-reasoner"],
    minimax: ["MiniMax-M3[1m]", "MiniMax-M2.7", "MiniMax-M2.5-highspeed", "MiniMax-M2.1"],
  };
  // Built with t() at module-eval time — loadI18n() runs later in init(), so the
  // fallbacks are what render here. Keep this a const (NOT a getter) to preserve
  // the visible labels.
  export const PROVIDER_LABELS: Record<string, string> = {
    claude: t("providers.claudeLabel", "Claude (Anthropic)"),
    codex: t("providers.codexLabel", "Codex (OpenAI)"),
    gemini: t("providers.geminiLabel", "Gemini (Google)"),
    deepseek: t("providers.deepseekLabel", "DeepSeek"),
    minimax: t("providers.minimaxLabel", "MiniMax"),
  };
