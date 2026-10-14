import { createContext, useContext } from "react";

/** Shared density for server drawers; account/login controls keep their own sizing. */
export const ModuleUiContext = createContext(false);
export const useModuleUi = () => useContext(ModuleUiContext);
export const moduleSpacing = { paddingHorizontal: 28, paddingTop: 44, gap: 14 } as const;

/** Shared density for native fields that need the TextInput primitive directly. */
export const moduleInputMetrics = {
  minHeight: 32, borderRadius: 5, borderWidth: 1,
  paddingHorizontal: 10, paddingVertical: 6, fontSize: 12,
  includeFontPadding: false,
} as const;
