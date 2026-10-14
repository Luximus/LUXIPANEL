import { NativeModuleContext } from "../../screens/main/native-module-visibility";
import React, { useContext, useState } from "react";
import { View, useWindowDimensions } from "react-native";

/** The web's lg sidebar/content grid, stacking at the same 1024 px breakpoint. */
export function ModuleSplitLayout({ sidebar, children, sidebarWidth = 260 }: { sidebar: React.ReactNode; children: React.ReactNode; sidebarWidth?: number }) {
  const { width } = useWindowDimensions();
  const [measured, setMeasured] = useState<number | null>(null);
  const wide = (measured ?? width) >= 1024;
  return <View testID="module-split-layout" onLayout={event => setMeasured(event.nativeEvent.layout.width)} style={{ flexDirection: wide ? "row" : "column", gap: 20, minWidth: 0 }}>
    <View style={{ width: wide ? sidebarWidth : "100%", gap: 16, flexShrink: 0 }}>{sidebar}</View>
    <View style={{ flex: wide ? 1 : undefined, minWidth: 0, gap: 16 }}>{children}</View>
  </View>;
}

/** Responsive dashboard cards use equal columns and keep source order. */
export function ModuleGrid({ children, columns = 3, breakpoint = 640 }: { children: React.ReactNode; columns?: number; breakpoint?: number }) {
  const { width } = useWindowDimensions();
  const [measured, setMeasured] = useState<number | null>(null);
  const count = (measured ?? width) >= breakpoint ? columns : 1;
  return <View onLayout={event => setMeasured(event.nativeEvent.layout.width)} style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
    {React.Children.toArray(children).map((child, index) => <View key={(React.isValidElement(child) && child.key) || index} style={{ width: count === 1 ? "100%" : `${100 / count - 2}%`, flexGrow: 1, minWidth: 0 }}>{child}</View>)}
  </View>;
}

/** Keep table settings and drafts mounted when switching the module's tabs. */
export function ModuleTabPanel({active,children}:{active:boolean;children:React.ReactNode}) {
 const context=useContext(NativeModuleContext);
 return <NativeModuleContext.Provider value={context?{...context,visible:context.visible&&active}:null}><View style={{display:active?"flex":"none",gap:14}} pointerEvents={active?"auto":"none"} accessibilityElementsHidden={!active} importantForAccessibility={active?"auto":"no-hide-descendants"}>{children}</View></NativeModuleContext.Provider>;
}
