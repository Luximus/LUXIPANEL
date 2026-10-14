import React, { useContext } from "react";
import { View } from "react-native";
import { NativeModuleContext } from "./native-module-context";
/** Keep each view mounted so switching submenus retains its edits. */
export function WorkspaceModuleSection({
  views,
  children,
}: {
  views: string[];
  children: React.ReactNode;
}) {
  const context = useContext(NativeModuleContext);
  const selected = context?.selectedView;
  const shown = !selected || views.includes(selected);
  return (
    <NativeModuleContext.Provider value={context ? { ...context, visible: context.visible && shown } : null}>
    <View style={[{ gap: 14 }, !shown && { display: "none" }]} pointerEvents={shown ? "auto" : "none"}
      accessibilityElementsHidden={!shown} importantForAccessibility={shown ? "auto" : "no-hide-descendants"}>
      {children}
    </View>
    </NativeModuleContext.Provider>
  );
}
