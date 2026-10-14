import { ConfirmationModal } from "../ui/ConfirmationModal";
/**
 * Overlays de formularios del gear de ajustes (extraídos de
 * `DataTableSettingsModal.tsx`): registro de llave SSH, registro de
 * categoría+tag, confirmación de borrado y edición de llave SSH. SIN estado
 * propio: los valores/handlers viven en `SettingsPanels` y llegan por props.
 */
import React from "react";
import { Text, TextInput, View } from "react-native";
import { Plus, Save } from "lucide-react-native";
import { styles } from "../DataTableSettingsModal.styles";
import { FormSheet } from "../ui/FormSheet";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { getLocaleRowDirection, getLocaleTextAlign, getMessages } from "../../i18n";
import type { getThemeTokens } from "../../theme/colors";

type Messages = ReturnType<typeof getMessages>;
type Tokens = ReturnType<typeof getThemeTokens>;
type RowDirection = ReturnType<typeof getLocaleRowDirection>;
type TextAlignValue = ReturnType<typeof getLocaleTextAlign>;

/** Campo obligatorio faltante marcado con borde rojo + focus. */
export type SettingsInvalidField =
  | "newCategory" | "newTag" | "selectedCategory" | "sshUser" | "sshKey" | "editLinuxUsername" | null;

export type SshEditState = {
  open: boolean;
  id: string;
  linuxUsername: string;
  panelIds: string[];
  sshKey: string;
  passphrase: string;
};

export function RegisterSshSheet({
  visible,
  onClose,
  language,
  t,
  tokens,
  textAlign,
  sshUser,
  sshKey,
  invalidField,
  onChangeUser,
  onChangeKey,
  onSubmit,
  sshUserRef,
  sshKeyRef,
}: {
  visible: boolean;
  onClose: () => void;
  language: string;
  t: Messages;
  tokens: Tokens;
  textAlign: TextAlignValue;
  sshUser: string;
  sshKey: string;
  invalidField: SettingsInvalidField;
  onChangeUser: (v: string) => void;
  onChangeKey: (v: string) => void;
  onSubmit: () => void;
  sshUserRef: React.RefObject<TextInput | null>;
  sshKeyRef: React.RefObject<TextInput | null>;
}) {
  return (
    <FormSheet
      visible={visible}
      onClose={onClose}
      title={t.settingsModals.sshKeysRegisterTab}
      language={language}
    >
      <View style={styles.sheetForm}>
        <TextInput
          ref={sshUserRef}
          value={sshUser}
          onChangeText={onChangeUser}
          placeholder={t.dataTableSettings.sshKeysTab.sshUserPlaceholder}
          placeholderTextColor={tokens.textMuted}
          style={[styles.input, { borderColor: invalidField === "sshUser" ? tokens.danger : tokens.border, color: tokens.textPrimary, textAlign }]}
        />
        <TextInput
          ref={sshKeyRef}
          value={sshKey}
          onChangeText={onChangeKey}
          multiline
          placeholder={t.dataTableSettings.sshKeysTab.keyPlaceholder}
          placeholderTextColor={tokens.textMuted}
          style={[styles.input, styles.textarea, { borderColor: invalidField === "sshKey" ? tokens.danger : tokens.border, color: tokens.textPrimary, textAlign }]}
        />
        {invalidField === "sshUser" ? (
          <Text style={{ color: tokens.danger, fontSize: 12, textAlign }}>{t.errors.sshLocalUsernameRequired}</Text>
        ) : invalidField === "sshKey" ? (
          <Text style={{ color: tokens.danger, fontSize: 12, textAlign }}>{t.errors.sshLocalKeyRequired}</Text>
        ) : null}
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={14} />}
          label={t.dataTableSettings.sshKeysTab.register}
          onPress={onSubmit}
          style={{ alignSelf: "flex-start" }}
        />
      </View>
    </FormSheet>
  );
}

export function RegisterCatTagSheet({
  visible,
  onClose,
  language,
  t,
  tokens,
  textAlign,
  rowDirection,
  newCategory,
  newTag,
  selectedCategoryId,
  categoryOptions,
  invalidField,
  onChangeCategoryName,
  onChangeTagName,
  onChangeSelectedCategory,
  onCreateCategory,
  onCreateTag,
  newCategoryRef,
  newTagRef,
}: {
  visible: boolean;
  onClose: () => void;
  language: string;
  t: Messages;
  tokens: Tokens;
  textAlign: TextAlignValue;
  rowDirection: RowDirection;
  newCategory: string;
  newTag: string;
  selectedCategoryId: string;
  categoryOptions: { value: string; label: string }[];
  invalidField: SettingsInvalidField;
  onChangeCategoryName: (v: string) => void;
  onChangeTagName: (v: string) => void;
  onChangeSelectedCategory: (v: string) => void;
  onCreateCategory: () => void;
  onCreateTag: () => void;
  newCategoryRef: React.RefObject<TextInput | null>;
  newTagRef: React.RefObject<TextInput | null>;
}) {
  return (
    <FormSheet
      visible={visible}
      onClose={onClose}
      title={t.dataTableSettings.accordion.form}
      language={language}
    >
      <View style={styles.sheetForm}>
        {/* Crear categoría */}
        <Text style={[styles.groupLabel, { color: tokens.textMuted, textAlign }]}>{t.dataTableSettings.tabs.categories}</Text>
        <View style={[styles.row, { flexDirection: rowDirection }]}>
          <TextInput
            ref={newCategoryRef}
            value={newCategory}
            onChangeText={onChangeCategoryName}
            placeholder={t.dataTableSettings.categoriesTab.newPlaceholder}
            placeholderTextColor={tokens.textMuted}
            style={[styles.input, { borderColor: invalidField === "newCategory" ? tokens.danger : tokens.border, color: tokens.textPrimary, textAlign }]}
          />
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            label={t.dataTableSettings.categoriesTab.create}
            onPress={onCreateCategory}
          />
        </View>
        {/* Separador entre el grupo Categorías y el grupo Tags. */}
        <View style={[styles.groupDivider, { backgroundColor: tokens.border }]} />
        {/* Crear tag (dentro de una categoría) */}
        <Text style={[styles.groupLabel, { color: tokens.textMuted, textAlign }]}>{t.dataTableSettings.tabs.tags}</Text>
        <Text style={{ color: tokens.textMuted, fontSize: 11, marginBottom: 2, textAlign }}>
          {t.settingsModals.tagsSelectCategoryHint}
        </Text>
        <View style={[styles.tagInlineRow, { flexDirection: rowDirection }]}>
          <View style={[styles.tagCategorySelect, invalidField === "selectedCategory" ? { borderWidth: 1, borderRadius: 10, borderColor: tokens.danger } : null]}>
            <Select
              value={selectedCategoryId}
              options={categoryOptions}
              onChange={onChangeSelectedCategory}
              placeholder={t.panelEditor.categoryLabel}
            />
          </View>
          <TextInput
            ref={newTagRef}
            value={newTag}
            onChangeText={onChangeTagName}
            placeholder={t.dataTableSettings.tagsTab.newPlaceholder}
            placeholderTextColor={tokens.textMuted}
            style={[styles.input, styles.tagInputInline, { borderColor: invalidField === "newTag" ? tokens.danger : tokens.border, color: tokens.textPrimary, textAlign }]}
          />
          <IconButton
            variant="primary"
            size={42}
            onPress={onCreateTag}
            icon={<Plus size={14} />}
          />
        </View>
        {invalidField === "selectedCategory" ? (
          <Text style={{ color: tokens.danger, fontSize: 12, marginTop: 6, textAlign }}>{t.errors.selectCategoryFirst}</Text>
        ) : invalidField === "newTag" ? (
          <Text style={{ color: tokens.danger, fontSize: 12, marginTop: 6, textAlign }}>{t.errors.tagNameRequired}</Text>
        ) : null}
      </View>
    </FormSheet>
  );
}

export function ConfirmDeleteModal({
  open,
  title,
  message,
  onClose,
  onConfirm,
  t,
  tokens,
  language,
  submitting,
}: {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
  t: Messages;
  tokens: Tokens;
  language: string;
  submitting?: boolean;
}) {
  return <ConfirmationModal visible={open} submitting={submitting} title={title} message={message} language={language}
    onCancel={onClose} onConfirm={onConfirm} confirmLabel={t.common.delete} cancelLabel={t.common.cancel} />;
}

export function SshEditSheet({
  modal,
  invalidField,
  onClose,
  onSave,
  onChangeLinuxUsername,
  onPatch,
  editLinuxUsernameRef,
  t,
  tokens,
  textAlign,
  language,
}: {
  modal: SshEditState;
  invalidField: SettingsInvalidField;
  onClose: () => void;
  onSave: () => void;
  onChangeLinuxUsername: (v: string) => void;
  onPatch: (patch: Partial<SshEditState>) => void;
  editLinuxUsernameRef: React.RefObject<TextInput | null>;
  t: Messages;
  tokens: Tokens;
  textAlign: TextAlignValue;
  language: string;
}) {
  return (
    <FormSheet
      visible={modal.open}
      onClose={onClose}
      title={t.settingsModals.sshKeysEditTitle}
      language={language}
      footer={(
        <>
          <Button variant="ghost" label={t.common.cancel} onPress={onClose} />
          <Button
            variant="primary"
            icon={<Save size={14} />}
            label={t.common.save}
            onPress={onSave}
          />
        </>
      )}
    >
      <View style={styles.body}>
        <TextInput
          ref={editLinuxUsernameRef}
          value={modal.linuxUsername}
          onChangeText={onChangeLinuxUsername}
          placeholder={t.dataTableSettings.sshKeysTab.sshUserPlaceholder}
          placeholderTextColor={tokens.textMuted}
          style={[styles.input, { borderColor: invalidField === "editLinuxUsername" ? tokens.danger : tokens.border, color: tokens.textPrimary, textAlign }]}
        />
        {invalidField === "editLinuxUsername" ? (
          <Text style={{ color: tokens.danger, fontSize: 12, textAlign }}>{t.errors.linuxUsernameRequired}</Text>
        ) : null}
        <TextInput
          value={(modal.panelIds || []).join(",")}
          onChangeText={(v) => onPatch({ panelIds: v.split(",").map((x) => x.trim()).filter(Boolean) })}
          placeholder="panelId1,panelId2"
          placeholderTextColor={tokens.textMuted}
          style={[styles.input, { borderColor: tokens.border, color: tokens.textPrimary, textAlign }]}
        />
        <TextInput
          value={modal.sshKey}
          onChangeText={(v) => onPatch({ sshKey: v })}
          multiline
          placeholder={t.dataTableSettings.sshKeysTab.keyPlaceholder}
          placeholderTextColor={tokens.textMuted}
          style={[styles.input, styles.textarea, { borderColor: tokens.border, color: tokens.textPrimary, textAlign }]}
        />
        <TextInput
          value={modal.passphrase}
          onChangeText={(v) => onPatch({ passphrase: v })}
          secureTextEntry
          placeholder={t.connectLocalKey.passphraseLabel}
          placeholderTextColor={tokens.textMuted}
          style={[styles.input, { borderColor: tokens.border, color: tokens.textPrimary, textAlign }]}
        />
      </View>
    </FormSheet>
  );
}
