import { createContext, useContext } from "react";
export const NativeModuleVisibility = createContext(true);
export const useNativeModuleVisible = () => useContext(NativeModuleVisibility);
