import React, { useMemo, useRef } from "react";
import { FormSubmissionContext } from "../server/form-submission-context";
import { StyleSheet, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { loadSessionState } from "../../lib/session-state";
import { ModuleSettingsDrawer } from "./ModuleSettingsDrawer";

type FormDrawerProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  language?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  scrollable?: boolean;
  /** Compatibility with migrated forms; drawers always use the available height. */
  fillHeight?: boolean;
};

/** Full-height creation/editing drawer, above its owner without disposing it. */
export function FormDrawer({ visible, onClose, title = "", language = loadSessionState().language, children, footer, scrollable = true }: FormDrawerProps) {
  const pending = useRef(false);
  const submission = useMemo(() => ({setPending:(value:boolean) => { pending.current = value; }}), []);
  return <FormSubmissionContext.Provider value={submission}><ModuleSettingsDrawer variant="form" visible={visible} onClose={() => { if (!pending.current) onClose(); }} title={title} language={language} footer={footer}>
    {scrollable ? <ScrollView testID="module-form-content" style={styles.fill} contentContainerStyle={styles.content}
      nestedScrollEnabled keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      {children}
    </ScrollView> : <View testID="module-form-content" style={styles.fill}>{children}</View>}
  </ModuleSettingsDrawer></FormSubmissionContext.Provider>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0, minWidth: 0 },
  content: { paddingHorizontal: 20, paddingVertical: 16, gap: 14 },
});
