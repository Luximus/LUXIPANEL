// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import React, { useContext, useState } from "react";
import { PanelText as Text } from "../../ui/PanelText";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { Clock3, Folder, Pencil, Pin, PinOff, Trash2, MoreVertical } from "lucide-react-native";
import { useInlineEditCancel } from "../../../hooks/useInlineEditCancel";
import type { Conversation } from "../../../features/assistant/types";
import type { ThemeTokens } from "../../../theme/colors";
import { FormSheet } from "../../ui/FormSheet";
import { Button } from "../../ui/Button";
import { NativeModuleContext } from "../../../screens/main/native-module-context";
import { PROVIDER_META, ProviderIcon } from "../../ProviderIcon";
import type { AssistantStrings } from "../types";
import { relativeDate } from "../format";
import { PulseDot } from "./PulseDot";
import { styles } from "./ConvoRow.styles";

/** Fila de conversación con TODOS los indicadores (paridad con `ConvoRow` web):
 *  spinner "respondiendo" (emerald), punto amarillo "aprobación pendiente"
 *  (pulse), icono del proveedor, pin ámbar, punto rojo "sin revisar", título,
 *  preview, etiqueta de proyecto (en búsqueda) y fecha; acciones: fijar, renombrar
 *  inline y eliminar.
 *
 *  MEMOIZADA (`React.memo`): es la hoja que se multiplica por N. En la lista
 *  plana (búsqueda / proyecto) hay hasta 200 filas montadas y CUALQUIER cambio de
 *  estado del drawer —cada tecla del buscador, cada página que aterriza de la
 *  paginación de fondo, la llegada de los runs vivos, `busy`/`loadingMore`— las
 *  re-renderizaba TODAS (cada una con sus 4-6 iconos SVG). Con el memo solo
 *  re-renderizan las filas cuyos datos cambian de verdad.
 *
 *  CONTRATO: quien la use debe pasar props con identidad estable (`onOpen`,
 *  `onDelete`, `onRename`, `onTogglePin`, `t`, `tokens`); si no, el memo no
 *  ahorra nada. Ver los envoltorios `useCallback` de `ConversationsDrawer`. */
export const ConvoRow = React.memo(function ConvoRow({ c, activeId, isLive, projectLabel, agentLabel, t, tokens, onOpen, onDelete, onRename, onTogglePin }: {
  c: Conversation;
  activeId: string | null;
  isLive: boolean;
  projectLabel?: string | null;
  agentLabel?: string;
  t: AssistantStrings;
  tokens: ThemeTokens;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
}) {
  const workspace = useContext(NativeModuleContext)?.insideWorkspace;
  const [menuOpen,setMenuOpen]=useState(false);
  const isActive = c.id === activeId;
  const unreviewed = !isLive && !!c.unreviewed;
  const needsApproval = !!c.needsApproval;
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(c.title ?? "");
  const title = c.title?.trim() || c.id.slice(0, 8);
  const rowProvider = (c.provider && PROVIDER_META[c.provider])
    ? c.provider
    : (c.originProvider && PROVIDER_META[c.originProvider]) ? c.originProvider : null;
  const provMeta = rowProvider ? PROVIDER_META[rowProvider] : null;

  const commitRename = () => {
    const next = editTitle.trim();
    setEditing(false);
    if (next && next !== (c.title ?? "")) onRename(c.id, next);
    else setEditTitle(c.title ?? "");
  };
  // Atrás de Android / ocultar el teclado cancela el renombrado descartando el
  // borrador (mismo tratamiento que categorías/tags/pestañas/consolas).
  useInlineEditCancel(editing, () => { setEditing(false); setEditTitle(c.title ?? ""); });

  return (
    <>
    <Pressable
      onPress={() => { if (!editing) onOpen(c.id); }}
      style={[styles.convoRow, workspace ? {backgroundColor:tokens.bgCardSolid,borderWidth:1,borderColor:isActive ? tokens.brand : tokens.border,borderRadius:11,padding:8,minHeight:62,marginBottom:2} : null, isActive ? { backgroundColor: tokens.brandDim } : null]}
    >
      <View style={styles.convoMain}>
        {workspace && !editing ? <View style={{flexDirection:"row",alignItems:"center",gap:5,marginBottom:3}}>{provMeta ? <ProviderIcon id={rowProvider!} size={10} color={tokens.textMuted}/> : null}{agentLabel ? <Text numberOfLines={1} style={{flex:1,color:tokens.textMuted,fontSize:10}}>{agentLabel}</Text> : <View style={{flex:1}}/>}<Clock3 size={9} color={tokens.textMuted}/><Text style={{color:tokens.textMuted,fontSize:9}}>{relativeDate(c.updatedAt,t.justNow)}</Text></View> : null}
        {editing ? (
          <TextInput
            autoFocus
            value={editTitle}
            onChangeText={setEditTitle}
            onBlur={commitRename}
            onSubmitEditing={commitRename}
            blurOnSubmit
            style={[styles.convoRenameInput, { color: tokens.textPrimary, borderColor: tokens.brand, backgroundColor: tokens.bgInput }]}
          />
        ) : (
          <View style={styles.convoTitleRow}>
            {isLive ? <ActivityIndicator size="small" color={tokens.success} /> : null}
            {needsApproval ? <PulseDot color="#fbbf24" /> : null}
            {provMeta && !workspace ? <ProviderIcon id={rowProvider!} size={11} color={tokens.textMuted} /> : null}
            {c.pinned ? <Pin size={11} color="#f59e0b" fill="#f59e0b" /> : null}
            {unreviewed ? <PulseDot color={tokens.danger} /> : null}
            <Text numberOfLines={1} style={[styles.convoTitle, workspace ? {fontSize:12,fontWeight:"400"} : null, { color: isActive ? tokens.textPrimary : tokens.textSecondary }]}>{title}</Text>
          </View>
        )}
        <Text numberOfLines={1} style={[styles.convoPreview, { color: tokens.textMuted }]}>{c.preview?.trim() || "—"}</Text>
        {projectLabel ? (
          <View style={styles.convoMetaLine}>
            <Folder size={9} color={tokens.textMuted} />
            <Text numberOfLines={1} style={[styles.convoMetaText, { color: tokens.textMuted }]}>{projectLabel}</Text>
          </View>
        ) : null}
        {!workspace && relativeDate(c.updatedAt, t.justNow) ? (
          <Text style={[styles.convoMetaText, { color: tokens.textMuted, marginTop: 1 }]}>{relativeDate(c.updatedAt, t.justNow)}</Text>
        ) : null}
      </View>
      {!editing && workspace ? <Pressable onPress={(event)=>{event.stopPropagation();setMenuOpen(true);}} hitSlop={8} accessibilityLabel={"Más opciones"} style={styles.convoAction}><MoreVertical size={17} color={tokens.textMuted}/></Pressable> : !editing ? (
        <>
          <Pressable onPress={(event) => { event.stopPropagation(); onTogglePin(c.id, !c.pinned); }} accessibilityLabel={c.pinned ? (t.unpinAction ?? "Desfijar") : (t.pinAction ?? "Fijar arriba")} hitSlop={4} style={styles.convoAction}>
            {c.pinned ? <Pin size={14} color="#f59e0b" fill="#f59e0b" /> : <PinOff size={14} color={tokens.textMuted} />}
          </Pressable>
          <Pressable onPress={(event) => { event.stopPropagation(); setEditTitle(c.title ?? ""); setEditing(true); }} accessibilityLabel={t.renameAction ?? "Renombrar"} hitSlop={4} style={styles.convoAction}>
            <Pencil size={14} color={tokens.textMuted} />
          </Pressable>
          <Pressable onPress={(event) => { event.stopPropagation(); onDelete(c.id); }} accessibilityLabel={t.deleteConv} hitSlop={4} style={styles.convoAction}>
            <Trash2 size={14} color={tokens.textMuted} />
          </Pressable>
        </>
      ) : null}
    </Pressable>
    {workspace && <FormSheet visible={menuOpen} onClose={()=>setMenuOpen(false)} title={title}><View style={{gap:8}}><Button label={c.pinned ? t.unpinAction ?? "Desfijar" : t.pinAction ?? "Fijar arriba"} variant="ghost" onPress={()=>{onTogglePin(c.id,!c.pinned);setMenuOpen(false);}}/><Button label={t.renameAction ?? "Renombrar"} variant="ghost" onPress={()=>{setEditTitle(c.title ?? "");setEditing(true);setMenuOpen(false);}}/><Button label={t.deleteConv} variant="danger" onPress={()=>onDelete(c.id)}/></View></FormSheet>}
    </>
  );
});
