import { createContext, useContext } from "react";
export const ModuleVisibilityContext = createContext(true);
export const useModuleVisibility = () => useContext(ModuleVisibilityContext);
