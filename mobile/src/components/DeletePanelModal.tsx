import React from "react";
import { Text, View } from "react-native";
import type { DeletePanelState } from "../features/app/viewModels";
import { formatMessage, getMessages } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { ConfirmationModal } from "./ui/ConfirmationModal";
import { styles } from "./DeletePanelModal.styles";

export function DeletePanelModal({
  deletePanel,
  closeDeletePanel,
  confirmDeletePanel,
  language,
}: {
  deletePanel: DeletePanelState;
  closeDeletePanel: () => void;
  confirmDeletePanel: () => void;
  language?: string;
}) {
  const t = getMessages(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");

  return (
    <ConfirmationModal visible={deletePanel.open} onCancel={closeDeletePanel} onConfirm={confirmDeletePanel}
      title={t.deletePanel.title} language={language} submitting={deletePanel.saving}
      message={formatMessage(t.deletePanel.description, { name: deletePanel.panelName })}
      confirmLabel={t.deletePanel.delete} cancelLabel={t.common.cancel}
    >
      {deletePanel.error ? (
        <View
          style={[styles.errorBox, { borderColor: tokens.danger, backgroundColor: tokens.bgSecondary }]}
        >
          <Text style={{ color: tokens.danger, fontSize: 13 }}>{deletePanel.error}</Text>
        </View>
      ) : null}
    </ConfirmationModal>
  );
}

