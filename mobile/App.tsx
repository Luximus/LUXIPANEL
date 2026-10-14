import React from "react";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PanelFontsReady } from "./src/components/ui/PanelText";
import { ThemeTransitionProvider } from "./src/theme/ThemeTransitionProvider";
import DirectPanelApp from "./src/screens/DirectPanelApp";
import { setupNotificationHandler } from "./src/lib/notifications";
setupNotificationHandler();
export default function App() {
  const [ready] = useFonts({"LUXIPANEL-Inter":require("./assets/fonts/Inter-Regular.ttf"),"LUXIPANEL-Inter-Bold":require("./assets/fonts/Inter-Bold.ttf")});
  return <PanelFontsReady.Provider value={ready}><GestureHandlerRootView style={{flex:1}}><SafeAreaProvider><ThemeTransitionProvider><DirectPanelApp/></ThemeTransitionProvider></SafeAreaProvider></GestureHandlerRootView></PanelFontsReady.Provider>;
}
