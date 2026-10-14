import labels from "./workspace-labels.json";
/** Native workspace labels copied from the deployed frontend locale sources. */
export function workspaceLabels(language: string) {
  return (labels as Record<string, typeof labels.en>)[language.slice(0, 2)] ?? labels.en;
}
export const WORKSPACE_LOCALES = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "ar", label: "العربية" },
  { code: "bn", label: "বাংলা" },
  { code: "hi", label: "हिन्दी" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "ru", label: "Русский" },
] as const;
