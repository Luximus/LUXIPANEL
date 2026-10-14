import { createContext, useContext } from "react";
type Context = { key: string; visible: boolean; panelId?: string; token?: string; moduleId?: string; insideWorkspace?: boolean; insideModuleDrawer?: boolean; selectedView?: string; viewRevision?: number; selectView?: (view: string) => void; openModule?: (moduleId: string, selectedView?: string) => void };
export const NativeModuleContext = createContext<Context | null>(null);
export const useNativeModuleVisible = () => useContext(NativeModuleContext)?.visible ?? true;
