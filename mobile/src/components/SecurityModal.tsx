import React from "react";
import { View } from "react-native";
import { FormSheet } from "./ui/FormSheet";
import { SecurityTab } from "./account/SecurityTab";

export function SecurityModal({
  visible,
  onClose,
  language,
  token,
}: {
  visible: boolean;
  onClose: () => void;
  language: string;
  token: string;
}) {
  return (
    <FormSheet
      visible={visible}
      onClose={onClose}
      title="Seguridad"
      language={language}
    >
      <View style={{ minHeight: 260 }}>
        <SecurityTab language={language} token={token} />
      </View>
    </FormSheet>
  );
}
