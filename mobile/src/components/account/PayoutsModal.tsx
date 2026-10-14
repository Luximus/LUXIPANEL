import React from "react";
import { View } from "react-native";
import { FormSheet } from "../ui/FormSheet";
import { PayoutSection } from "./PayoutSection";
import { getMessages } from "../../i18n";

/** Modal independiente de "Pagos" (desembolso de tokens → USD). Espejo de
 *  `SecurityModal`: cada item del dropdown de cuenta abre su propio modal. El
 *  contenido reutiliza `PayoutSection` (igual que la antigua pestaña Pagos). */
export function PayoutsModal({
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
  const t = getMessages(language);
  return (
    <FormSheet
      visible={visible}
      onClose={onClose}
      title={t.account.tabPayments}
      language={language}
    >
      <View style={{ minHeight: 260 }}>
        <PayoutSection language={language} token={token} />
      </View>
    </FormSheet>
  );
}
