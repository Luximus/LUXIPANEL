// Modales POR PESTAÑA de MainTab (Wave D2: extraídos verbatim de MainScreen.tsx
// sin cambios de semántica). Todos se alimentan del controlador de la pestaña
// (`ctrl`); no tienen estado propio.
import React from "react";
import type { useMainTabController } from "../../hooks/useMainTabController";
import { DeletePanelModal } from "../../components/DeletePanelModal";
import { ConnectionErrorModal } from "../../components/ConnectionErrorModal";
import { PurchaseResultModal } from "../../components/PurchaseResultModal";
import { ConnectMethodModal } from "../../components/ConnectMethodModal";
import { ConnectSshKeyModal } from "../../components/ConnectSshKeyModal";
import { ConnectLocalKeyModal } from "../../components/ConnectLocalKeyModal";
import { NewTicketModal } from "../../components/NewTicketModal";

export function MainTabModals({ ctrl, maxUploadBytes }: {
  ctrl: ReturnType<typeof useMainTabController>;
  /** Límite dinámico de subida (bytes) para los adjuntos del ticket nuevo. */
  maxUploadBytes: number;
}) {
  return (
    <React.Fragment>
      <DeletePanelModal
        deletePanel={ctrl.deletePanelState}
        closeDeletePanel={ctrl.closeDeletePanelModal}
        confirmDeletePanel={ctrl.confirmDeletePanel}
        language={ctrl.language}
      />
      <ConnectionErrorModal
        state={ctrl.connectionError}
        onClose={ctrl.closeConnectionErrorModal}
        onReconnect={ctrl.reconnect}
        language={ctrl.language}
      />
      <PurchaseResultModal
        state={ctrl.purchaseResult}
        onClose={ctrl.clearPurchaseResult}
        language={ctrl.language}
      />
      <ConnectMethodModal
        state={ctrl.connectMethod}
        onClose={ctrl.closeConnectMethod}
        onUseSaved={() => void ctrl.confirmConnectMethodSaved()}
        onUseLocalKey={ctrl.confirmConnectMethodLocal}
        language={ctrl.language}
      />
      <ConnectSshKeyModal
        open={ctrl.connectKeyOpen}
        onClose={ctrl.closeConnectKeyModal}
        onConfirm={ctrl.confirmConnectWithKey}
        keys={ctrl.connectKeyOptions}
        selectedKeyId={ctrl.connectKeySelectedId}
        setSelectedKeyId={ctrl.setConnectKeySelectedId}
        language={ctrl.language}
      />
      <ConnectLocalKeyModal
        state={ctrl.connectLocalKey}
        setState={ctrl.setConnectLocalKey}
        close={ctrl.closeConnectLocalKey}
        submit={() => void ctrl.submitConnectLocalKey()}
        language={ctrl.language}
      />
      <NewTicketModal
        state={ctrl.newTicket}
        setState={ctrl.setNewTicket}
        close={ctrl.closeNewTicketModal}
        submit={(attachments) => void ctrl.submitNewTicket(attachments)}
        token={ctrl.token ?? null}
        language={ctrl.language}
        maxFileBytes={maxUploadBytes}
      />
    </React.Fragment>
  );
}
