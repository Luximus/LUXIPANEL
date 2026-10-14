import React, { useEffect, useMemo, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Paperclip, Send, X } from "lucide-react-native";
import type { NewTicketState, TicketPriority } from "../features/app/viewModels";
import { MAX_TICKET_ATTACHMENTS, useTicketUploads } from "../hooks/useTicketUploads";
import { UploadList } from "./UploadList";
import type { TicketAttachment } from "../types/models";
import type { UploadFileInput } from "../api/client";
import { getMessages } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { FormSheet } from "./ui/FormSheet";
import { Button } from "./ui/Button";
import { Chip } from "./ui/Chip";
import { Input } from "./ui/Input";
import { localizeCommonError } from "../lib/error-localization";
import { styles } from "./NewTicketModal.styles";

export function NewTicketModal({
  state,
  setState,
  close,
  submit,
  token,
  language,
  maxFileBytes,
}: {
  state: NewTicketState;
  setState: (updater: (current: NewTicketState) => NewTicketState) => void;
  close: () => void;
  submit: (attachments: TicketAttachment[]) => void;
  token: string | null;
  language?: string;
  /** Límite por archivo en bytes (dinámico por rol; `customer.maxUploadMb`). */
  maxFileBytes?: number;
}) {
  const t = getMessages(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const uploads = useTicketUploads(() => tokenRef.current, language, maxFileBytes);
  const wasOpen = useRef(state.open);
  const titleRef = useRef<TextInput>(null);
  const descriptionRef = useRef<TextInput>(null);
  // Campo señalado como inválido para resaltar en rojo + enfocar al guardar.
  const [invalidField, setInvalidField] = useState<"title" | "description" | null>(null);

  const priorities = useMemo<{ value: TicketPriority; label: string }[]>(
    () => [
      { value: "low", label: t.newTicket.priorities.low },
      { value: "medium", label: t.newTicket.priorities.medium },
      { value: "high", label: t.newTicket.priorities.high },
      { value: "critical", label: t.newTicket.priorities.critical },
    ],
    [t],
  );

  useEffect(() => {
    if (wasOpen.current && !state.open) {
      uploads.clear();
    }
    wasOpen.current = state.open;
  }, [state.open, uploads]);

  const onPickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets) return;
      const files: UploadFileInput[] = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name ?? "file",
        type: asset.mimeType ?? "application/octet-stream",
        size: asset.size ?? 0,
      }));
      const { rejected } = uploads.add(files);
      if (rejected.length > 0) {
        const message = rejected.map((r) => `${r.name}: ${r.reason}`).join("\n");
        setState((current) => ({ ...current, error: message }));
      }
    } catch (error) {
      setState((current) => ({
        ...current,
        error: localizeCommonError(error, t, t.importExport.errors.readFailed),
      }));
    }
  };

  const onSubmit = () => {
    // Valida obligatorios y enfoca el primero que falte (título primero).
    if (state.title.trim().length < 5) {
      setInvalidField("title");
      setState((current) => ({ ...current, error: t.errors.ticketTitleTooShort }));
      titleRef.current?.focus();
      return;
    }
    if (!state.description.trim()) {
      setInvalidField("description");
      setState((current) => ({ ...current, error: t.newTicket.descriptionRequired }));
      descriptionRef.current?.focus();
      return;
    }
    setInvalidField(null);
    if (uploads.hasPending) {
      setState((current) => ({ ...current, error: t.newTicket.awaitUploads }));
      return;
    }
    submit(uploads.ready);
  };

  return (
    <FormSheet
      visible={state.open}
      onClose={close}
      title={t.newTicket.title}
      language={language}
      footer={
        <>
          <Button label={t.common.cancel} variant="ghost" onPress={close} icon={<X size={15} />} />
          <Button
            label={state.saving ? t.newTicket.creating : t.newTicket.create}
            variant="primary"
            onPress={onSubmit}
            loading={state.saving}
            disabled={state.saving || uploads.hasPending}
            icon={<Send size={15} color="#fff" />}
          />
        </>
      }
    >
      <Input
        ref={titleRef}
        label={t.newTicket.titleField}
        placeholder={t.newTicket.titlePlaceholder}
        maxLength={200}
        value={state.title}
        error={invalidField === "title" ? " " : undefined}
        onChangeText={(value) => {
          if (invalidField === "title") setInvalidField(null);
          setState((current) => ({ ...current, title: value }));
        }}
      />

      <View>
        <Text style={[styles.label, { color: tokens.textMuted }]}>{t.newTicket.priorityField}</Text>
        <View style={styles.priorityRow}>
          {priorities.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={state.priority === option.value}
              onPress={() => setState((current) => ({ ...current, priority: option.value }))}
            />
          ))}
        </View>
      </View>

      <Input
        ref={descriptionRef}
        label={t.newTicket.descriptionField}
        placeholder={t.newTicket.descriptionPlaceholder}
        multiline
        maxLength={5000}
        value={state.description}
        error={invalidField === "description" ? " " : undefined}
        onChangeText={(value) => {
          if (invalidField === "description") setInvalidField(null);
          setState((current) => ({ ...current, description: value }));
        }}
      />

      <View style={styles.attachSection}>
        <Text style={[styles.label, { color: tokens.textMuted }]}>{t.newTicket.attachFiles}</Text>
        <View style={styles.attachRow}>
          <Button
            label={t.newTicket.attachButton}
            variant="ghost"
            onPress={onPickFiles}
            disabled={uploads.remaining === 0}
            icon={<Paperclip size={16} color={tokens.textSecondary} />}
          />
          <Text style={[styles.counter, { color: tokens.textMuted }]}>
            {uploads.count} / {MAX_TICKET_ATTACHMENTS}
          </Text>
        </View>
        <UploadList entries={uploads.entries} onRemove={uploads.remove} language={language} />
      </View>

      {state.error ? (
        <View
          style={[
            styles.errorBox,
            { borderColor: tokens.danger, backgroundColor: tokens.bgSecondary },
          ]}
        >
          <Text style={[styles.errorText, { color: tokens.danger }]}>{state.error}</Text>
        </View>
      ) : null}
    </FormSheet>
  );
}
