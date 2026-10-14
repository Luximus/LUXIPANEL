import React from "react";
import type { PanelTaxonomy, SshKeyOption } from "../api/client";
import type { PanelEditorState } from "../features/app/viewModels";
import { getMessages } from "../i18n";
import { FormSheet } from "./ui/FormSheet";
import { PanelEditorPanel } from "./PanelEditorPanel";

/**
 * Drawer de formularios de editor de panel (crear/editar). Envoltura fina sobre `PanelEditorPanel`
 * (formulario + acciones). El tab "New" del bottom-sheet central usa el mismo panel
 * inline; este drawer se usa al EDITAR desde la tarjeta.
 */
export function PanelEditorModal({
  panelEditor,
  taxonomy,
  sshKeys,
  setPanelEditor,
  closePanelEditor,
  submitPanelEditor,
  requestDeletePanel,
  language,
}: {
  panelEditor: PanelEditorState;
  taxonomy: PanelTaxonomy["categories"];
  sshKeys: SshKeyOption[];
  setPanelEditor: React.Dispatch<React.SetStateAction<PanelEditorState>>;
  closePanelEditor: () => void;
  submitPanelEditor: () => void;
  requestDeletePanel: () => void;
  language?: string;
}) {
  const t = getMessages(language);
  return (
    <FormSheet
      visible={panelEditor.open}
      onClose={closePanelEditor}
      title={panelEditor.mode === "create" ? t.panelEditor.titleCreate : t.panelEditor.titleEdit}
      language={language}
      scrollable={false}
      fillHeight
    >
      {panelEditor.open ? (
        <PanelEditorPanel
          panelEditor={panelEditor}
          taxonomy={taxonomy}
          sshKeys={sshKeys}
          setPanelEditor={setPanelEditor}
          closePanelEditor={closePanelEditor}
          submitPanelEditor={submitPanelEditor}
          requestDeletePanel={requestDeletePanel}
          language={language}
        />
      ) : null}
    </FormSheet>
  );
}

export default PanelEditorModal;
