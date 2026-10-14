import messages from "./server-user-messages.json";
export function serverUserText(language: string | undefined) {
  const locale = (language ?? "es").split("-")[0];
  const dictionaries = messages as Record<string, unknown>;
  return (path: string, fallback = path) => {
    const read = (root: unknown) =>
      path
        .split(".")
        .reduce<unknown>(
          (value, key) =>
            value && typeof value === "object"
              ? (value as Record<string, unknown>)[key]
              : undefined,
          root,
        );
    const value = read(dictionaries[locale]) ?? read(dictionaries.en);
    return typeof value === "string" ? value : fallback;
  };
}

export const serverUserModuleLabel = (
  id: string,
  language: string | undefined,
) =>
  id === "chat"
    ? serverUserText(language)("chat.pageTitle")
    : id === "preferences"
      ? serverUserText(language)("preferences.pageTitle")
      : undefined;
