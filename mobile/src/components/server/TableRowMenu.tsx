import React, { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScopedNativeModal } from "../../screens/main/native-module-context";
import { getMessages } from "../../i18n";
import { RowActionItem } from "./server-table-cells";
import type { ServerRowAction } from "./server-table-logic";
import type { ThemeTokens } from "../../theme/colors";

export type TableMenuAnchor = { x: number; y: number; width: number; height: number };

/** A row's ellipsis opens a menu attached to that row, above the owning drawer. */
export function TableRowMenu({ anchor, actions, tokens, language, onSelect, onClose }: {
  anchor: TableMenuAnchor; actions: ServerRowAction[]; tokens: ThemeTokens; language: string;
  onSelect: (id: string) => void; onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const overlay = useRef<View>(null);
  const [viewport, setViewport] = useState<TableMenuAnchor | null>(null);
  // Scoped overlays can start below the workspace header: convert window
  // coordinates to the owning overlay instead of adding that offset twice.
  const localX = anchor.x - (viewport?.x ?? 0), localY = anchor.y - (viewport?.y ?? 0);
  const viewWidth = viewport?.width ?? width, viewHeight = viewport?.height ?? height;
  const naturalHeight = actions.length * 40 + 16;
  const below = Math.max(0, viewHeight - insets.bottom - localY - anchor.height - 12);
  const above = Math.max(0, localY - 12);
  const openBelow = below >= naturalHeight || below >= above;
  const maxHeight = Math.min(naturalHeight, openBelow ? below : above);
  const top = openBelow ? localY + anchor.height + 4 : localY - maxHeight - 4;
  const menuWidth = Math.min(280, viewWidth - 16);
  const left = Math.max(8, Math.min(viewWidth - menuWidth - 8, localX + anchor.width - menuWidth));
  return <ScopedNativeModal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
    <View ref={overlay} style={{ flex: 1 }} onLayout={() => overlay.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => setViewport({ x, y, width: measuredWidth, height: measuredHeight }))}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={getMessages(language).common.close} />
      <View testID="table-row-menu" accessibilityViewIsModal style={{ position: "absolute", opacity: viewport ? 1 : 0, top, left, width: menuWidth, maxHeight, backgroundColor: tokens.bgCardSolid, borderColor: tokens.border, borderWidth: 1, borderRadius: 8, elevation: 12, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 4 }}>{actions.map(action => <RowActionItem key={action.id} action={action} onPress={onSelect} tokens={tokens} compact />)}</ScrollView>
      </View>
    </View>
  </ScopedNativeModal>;
}
