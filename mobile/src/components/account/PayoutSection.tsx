import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { styles } from "./PayoutSection.styles";
import { Check, Pencil, Plus, Star, Trash2, Wallet } from "lucide-react-native";
import {
  getPayoutConfig, getPayoutMethods, createPayoutMethod, updatePayoutMethod, deletePayoutMethod,
  requestPayout, getPayoutRequests, tokensToUsd,
  type PayoutConfig, type PayoutMethodDTO, type PayoutMethodType, type PayoutRequestDTO,
} from "../../api/payouts";
import { getLocaleRowDirection, getLocaleTextAlign, getMessages } from "../../i18n";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { Select } from "../ui/Select";
import { FormSheet } from "../ui/FormSheet";
import { Button } from "../ui/Button";

const PAYOUT_STATUS_COLORS: Record<string, string> = {
  requested: "#f59e0b",
  approved: "#3b82f6",
  paid: "#10b981",
  rejected: "#ef4444",
};

// Campos del formulario por tipo de método de desembolso. La clave del objeto
// `details` que se envía al backend + la clave i18n de su etiqueta.
const PAYOUT_FIELDS: Record<PayoutMethodType, { key: string; labelKey: string }[]> = {
  paypal: [{ key: "email", labelKey: "fieldEmail" }],
  bank: [
    { key: "bankName", labelKey: "fieldBankName" },
    { key: "accountName", labelKey: "fieldAccountName" },
    { key: "accountNumber", labelKey: "fieldAccountNumber" },
    { key: "document", labelKey: "fieldDocument" },
  ],
  wompi: [
    { key: "phone", labelKey: "fieldPhone" },
    { key: "document", labelKey: "fieldDocument" },
  ],
  binance: [
    { key: "binanceId", labelKey: "fieldBinanceId" },
    { key: "network", labelKey: "fieldNetwork" },
    { key: "walletAddress", labelKey: "fieldWalletAddress" },
  ],
  other: [{ key: "details", labelKey: "fieldDetails" }],
};

/**
 * Desembolso de tokens → USD (pestaña "Pagos" del modal de cuenta). Espejo del
 * `desktop/src/screens/PayoutSection.tsx`: balance (disponible/ganado/en proceso),
 * conversor tokens→USD, métodos (crear/editar/eliminar/predeterminado),
 * solicitud de retiro e historial. Componente autónomo: descarga sus propios
 * datos al montar (config + métodos + solicitudes) para poder usarse standalone.
 */
export function PayoutSection({ language, token, onRegisterReload }: {
  language: string;
  token: string;
  /** Expone al contenedor la recarga forzada (para el pull-to-refresh del tab). */
  onRegisterReload?: (reload: () => Promise<void>) => void;
}) {
  const t = getMessages(language);
  const p = t.payouts;
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const rowDirection = getLocaleRowDirection(language);
  const textAlign = getLocaleTextAlign(language);

  const [payoutConfig, setPayoutConfig] = useState<PayoutConfig | null>(null);
  const [payoutMethods, setPayoutMethods] = useState<PayoutMethodDTO[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequestDTO[]>([]);
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [payoutError, setPayoutError] = useState("");
  // Error específico del historial: no debe vaciar el resto de la pestaña.
  const [requestsError, setRequestsError] = useState("");
  const [payoutLoaded, setPayoutLoaded] = useState(false);

  // Conversor en vivo + solicitud de retiro.
  const [convTokens, setConvTokens] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestNote, setRequestNote] = useState("");
  const [requestMethodId, setRequestMethodId] = useState("");

  // Editor de método (crear/editar).
  const [methodModalOpen, setMethodModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PayoutMethodDTO | null>(null);
  const [methodType, setMethodType] = useState<PayoutMethodType>("paypal");
  const [methodLabel, setMethodLabel] = useState("");
  const [methodDefault, setMethodDefault] = useState(false);
  const [methodFields, setMethodFields] = useState<Record<string, string>>({});
  const [methodBusy, setMethodBusy] = useState(false);
  const [methodError, setMethodError] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const rate = payoutConfig?.tokenUsdRate ?? 0;
  const minTokens = payoutConfig?.minTokens ?? 0;
  const availableTokens = payoutConfig?.balance.available ?? 0;
  const convTokensNum = Number(convTokens) || 0;
  const convUsd = tokensToUsd(convTokensNum, rate);

  const loadPayouts = useCallback(async (force = false) => {
    if (!token) return;
    if (!force && payoutLoaded) return;
    setPayoutBusy(true);
    setPayoutError("");
    setRequestsError("");
    // Cada sección carga de forma independiente (igual que el portal web): un
    // fallo en una (p.ej. el historial) no debe vaciar TODA la pestaña. Solo el
    // fallo de `config` (datos esenciales: balance + tasa) muestra error global.
    const [cfgR, msR, rsR] = await Promise.allSettled([
      getPayoutConfig(token),
      getPayoutMethods(token),
      getPayoutRequests(token),
    ]);
    if (cfgR.status === "fulfilled") {
      setPayoutConfig(cfgR.value);
    } else {
      setPayoutError(cfgR.reason instanceof Error ? cfgR.reason.message : p.loadError);
    }
    if (msR.status === "fulfilled") {
      setPayoutMethods(msR.value);
      // Pre-selecciona el método predeterminado (o el primero) para la solicitud.
      setRequestMethodId((prev) => prev || msR.value.find((m) => m.isDefault)?.id || msR.value[0]?.id || "");
    }
    if (rsR.status === "fulfilled") {
      setPayoutRequests(rsR.value);
    } else {
      setPayoutRequests([]);
      setRequestsError(rsR.reason instanceof Error ? rsR.reason.message : p.loadError);
    }
    // `payoutLoaded` evita recargas; se marca aunque una sección falle (el
    // usuario puede reintentar con el botón de refrescar).
    setPayoutLoaded(true);
    setPayoutBusy(false);
  }, [token, payoutLoaded, p.loadError]);

  // Carga inicial al montar (componente autónomo).
  useEffect(() => {
    void loadPayouts();
  }, [loadPayouts]);

  // Pull-to-refresh del tab "Pagos": expone la recarga forzada al contenedor.
  useEffect(() => {
    onRegisterReload?.(() => loadPayouts(true));
  }, [onRegisterReload, loadPayouts]);

  const openCreateMethod = useCallback(() => {
    setEditingMethod(null);
    setMethodType("paypal");
    setMethodLabel("");
    setMethodDefault(payoutMethods.length === 0);
    setMethodFields({});
    setMethodError("");
    setMethodModalOpen(true);
  }, [payoutMethods.length]);

  const openEditMethod = useCallback((m: PayoutMethodDTO) => {
    setEditingMethod(m);
    setMethodType((m.type as PayoutMethodType) ?? "other");
    setMethodLabel(m.label);
    setMethodDefault(m.isDefault);
    // Los detalles sensibles no vuelven del backend; el editor parte de campos
    // vacíos (re-ingresar) y conserva la máscara solo como referencia visual.
    setMethodFields({});
    setMethodError("");
    setMethodModalOpen(true);
  }, []);

  const saveMethod = useCallback(async () => {
    if (!token) return;
    if (!methodLabel.trim()) {
      setMethodError(p.saveError);
      return;
    }
    setMethodBusy(true);
    setMethodError("");
    try {
      const fields = PAYOUT_FIELDS[methodType];
      const details: Record<string, unknown> = {};
      for (const f of fields) {
        const v = methodFields[f.key]?.trim();
        if (v) details[f.key] = v;
      }
      if (editingMethod) {
        const patch: { label?: string; details?: Record<string, unknown>; isDefault?: boolean } = {
          label: methodLabel.trim(),
          isDefault: methodDefault,
        };
        if (Object.keys(details).length > 0) patch.details = details;
        await updatePayoutMethod(token, editingMethod.id, patch);
      } else {
        await createPayoutMethod(token, {
          type: methodType,
          label: methodLabel.trim(),
          details,
          isDefault: methodDefault,
        });
      }
      setMethodModalOpen(false);
      await loadPayouts(true);
    } catch (err) {
      setMethodError(err instanceof Error ? err.message : p.saveError);
    } finally {
      setMethodBusy(false);
    }
  }, [token, methodLabel, methodType, methodFields, methodDefault, editingMethod, loadPayouts, p.saveError]);

  const removeMethod = useCallback(async (id: string) => {
    if (!token) return;
    setDeletingId(id);
    try {
      await deletePayoutMethod(token, id);
      await loadPayouts(true);
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : p.saveError);
    } finally {
      setDeletingId("");
    }
  }, [token, loadPayouts, p.saveError]);

  const makeDefault = useCallback(async (m: PayoutMethodDTO) => {
    if (!token || m.isDefault) return;
    try {
      await updatePayoutMethod(token, m.id, { isDefault: true });
      await loadPayouts(true);
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : p.saveError);
    }
  }, [token, loadPayouts, p.saveError]);

  const submitRequest = useCallback(async () => {
    if (!token) return;
    setRequestNote("");
    const amount = convTokensNum;
    if (!requestMethodId) {
      setRequestNote(p.selectMethodFirst);
      return;
    }
    if (amount < minTokens) {
      setRequestNote(p.minNotReached.replace("{min}", String(minTokens)));
      return;
    }
    if (amount > availableTokens) {
      setRequestNote(p.insufficientBalance);
      return;
    }
    setRequestBusy(true);
    try {
      await requestPayout(token, { methodId: requestMethodId, amountTokens: amount });
      setConvTokens("");
      setRequestNote(p.requestSuccess);
      await loadPayouts(true);
    } catch (err) {
      setRequestNote(err instanceof Error ? err.message : p.saveError);
    } finally {
      setRequestBusy(false);
    }
  }, [token, convTokensNum, requestMethodId, minTokens, availableTokens, loadPayouts, p]);

  const renderStat = (label: string, value: string | number, meta?: string) => (
    <View style={[styles.glanceCard, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border }]}>
      <Text style={[styles.glanceLabel, { color: tokens.textMuted, textAlign }]}>{label}</Text>
      <Text style={[styles.glanceValue, { color: tokens.textPrimary, textAlign }]}>{value}</Text>
      {meta ? <Text style={[styles.glanceMeta, { color: tokens.textMuted, textAlign }]}>{meta}</Text> : null}
    </View>
  );

  const methodTypeOptions = useMemo(
    () => (["paypal", "bank", "wompi", "binance", "other"] as PayoutMethodType[]).map((tp) => ({
      value: tp,
      label: (p as Record<string, string>)[`type${tp.charAt(0).toUpperCase() + tp.slice(1)}`] ?? tp,
    })),
    [p],
  );

  if (payoutError && !payoutConfig) {
    return (
      <View style={[styles.emptyWrap, { gap: 10 }]}>
        <Text style={{ color: tokens.textMuted, textAlign }}>{payoutError}</Text>
        <Button variant="primary" label={p.retry} onPress={() => void loadPayouts(true)} />
      </View>
    );
  }

  if (payoutBusy && !payoutConfig) {
    return (
      <View style={styles.loadingWrap}><ActivityIndicator color={tokens.brand} /></View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.plansContent}>
        <Text style={[styles.subtitle, { color: tokens.textMuted, textAlign }]}>{p.subtitle}</Text>

        {/* Balance de tokens + tasa */}
        <Text style={[styles.sectionTitle, { color: tokens.textSecondary, textAlign }]}>{p.balanceTitle}</Text>
        <View style={[styles.glanceRow, { flexDirection: rowDirection }]}>
          {renderStat(p.available, availableTokens, `$${tokensToUsd(availableTokens, rate).toFixed(2)} USD`)}
          {renderStat(p.earned, payoutConfig?.balance.earned ?? 0)}
        </View>
        <View style={[styles.glanceRow, { flexDirection: rowDirection }]}>
          {renderStat(p.pendingPayout, payoutConfig?.balance.pendingPayout ?? 0)}
          {renderStat(p.rate, `$${rate.toFixed(rate < 0.01 ? 5 : 4)}`, p.ratePerToken)}
        </View>

        {/* Conversor tokens → USD en vivo */}
        <Text style={[styles.sectionTitle, { color: tokens.textSecondary, textAlign }]}>{p.converterTitle}</Text>
        <View style={[styles.payoutConverter, { backgroundColor: tokens.bgCard, borderColor: tokens.border }]}>
          <View style={[styles.payoutConverterRow, { flexDirection: rowDirection }]}>
            <View style={styles.payoutConverterField}>
              <Text style={[styles.payoutFieldLabel, { color: tokens.textMuted, textAlign }]}>{p.tokensLabel}</Text>
              <TextInput
                value={convTokens}
                onChangeText={(v) => setConvTokens(v.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                placeholder={p.tokensPlaceholder}
                placeholderTextColor={tokens.textMuted}
                style={[styles.payoutInput, { color: tokens.textPrimary, borderColor: tokens.border, backgroundColor: tokens.bgInput }]}
              />
            </View>
            <Text style={[styles.payoutArrow, { color: tokens.textMuted }]}>→</Text>
            <View style={styles.payoutConverterField}>
              <Text style={[styles.payoutFieldLabel, { color: tokens.textMuted, textAlign }]}>{p.usdLabel}</Text>
              <Text style={[styles.payoutUsdValue, { color: tokens.brand, textAlign }]}>${convUsd.toFixed(2)}</Text>
            </View>
          </View>
          <Pressable
            onPress={() => setConvTokens(String(availableTokens))}
            style={[styles.payoutMaxBtn, { borderColor: tokens.brand, backgroundColor: tokens.brandDim }]}
          >
            <Text style={[styles.payoutMaxBtnText, { color: tokens.brandLight }]}>{p.useMax}</Text>
          </Pressable>
        </View>

        {/* Solicitar retiro */}
        <Text style={[styles.sectionTitle, { color: tokens.textSecondary, textAlign }]}>{p.requestTitle}</Text>
        {payoutMethods.length === 0 ? (
          <Text style={{ color: tokens.textMuted, textAlign }}>{p.selectMethodFirst}</Text>
        ) : (
          <>
            <Text style={[styles.payoutModalLabel, { color: tokens.textSecondary, textAlign }]}>{p.requestMethod}</Text>
            <Select
              value={requestMethodId}
              options={payoutMethods.map((m) => ({ value: m.id, label: `${m.label}${m.isDefault ? ` · ${p.defaultBadge}` : ""}` }))}
              onChange={setRequestMethodId}
            />
            <Button
              variant="primary"
              label={p.requestSubmit}
              icon={<Wallet size={15} />}
              loading={requestBusy}
              disabled={requestBusy || convTokensNum <= 0}
              onPress={() => void submitRequest()}
              style={{ marginTop: 4 }}
            />
          </>
        )}
        {requestNote ? (
          <Text style={[styles.payoutInlineError, { color: requestNote === p.requestSuccess ? "#10b981" : tokens.danger, textAlign }]}>{requestNote}</Text>
        ) : null}

        {/* Métodos de desembolso */}
        <View style={[styles.payoutDefaultRow, { flexDirection: rowDirection }]}>
          <Text style={[styles.sectionTitle, { color: tokens.textSecondary, textAlign, marginTop: 0 }]}>{p.methodsTitle}</Text>
          <Pressable
            onPress={openCreateMethod}
            style={[styles.payoutMethodActionBtn, { borderColor: tokens.brand, backgroundColor: tokens.brandDim, flexDirection: rowDirection, alignItems: "center", gap: 4 }]}
          >
            <Plus size={14} color={tokens.brandLight} />
            <Text style={[styles.payoutMethodActionText, { color: tokens.brandLight }]}>{p.addMethod}</Text>
          </Pressable>
        </View>
        {payoutMethods.length === 0 ? (
          <Text style={{ color: tokens.textMuted, textAlign }}>{p.noMethods}</Text>
        ) : (
          payoutMethods.map((m) => {
            const typeLabel = (p as Record<string, string>)[`type${m.type.charAt(0).toUpperCase() + m.type.slice(1)}`] ?? m.type;
            const maskText = Object.values(m.mask ?? {}).filter(Boolean).join(" · ");
            return (
              <View key={m.id} style={[styles.payoutMethodCard, { backgroundColor: tokens.bgCard, borderColor: m.isDefault ? tokens.borderBrand : tokens.border }]}>
                <View style={[styles.payoutMethodTop, { flexDirection: rowDirection }]}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={[styles.cardTitle, { color: tokens.textPrimary, textAlign }]}>{m.label}</Text>
                    <Text style={[styles.cardMeta, { color: tokens.textMuted, textAlign }]}>{typeLabel}</Text>
                  </View>
                  {m.isDefault ? (
                    <View style={[styles.badge, { backgroundColor: `${tokens.brand}22`, flexDirection: rowDirection }]}>
                      <Star size={11} color={tokens.brand} />
                      <Text style={[styles.badgeText, { color: tokens.brand }]}>{p.defaultBadge}</Text>
                    </View>
                  ) : null}
                </View>
                {maskText ? <Text style={[styles.cardRef, { color: tokens.textMuted, textAlign }]}>{maskText}</Text> : null}
                <View style={[styles.payoutMethodActions, { flexDirection: rowDirection, flexWrap: "wrap" }]}>
                  {!m.isDefault ? (
                    <Pressable onPress={() => void makeDefault(m)} style={[styles.payoutMethodActionBtn, { borderColor: tokens.border, flexDirection: rowDirection, alignItems: "center", gap: 4 }]}>
                      <Star size={13} color={tokens.textSecondary} />
                      <Text style={[styles.payoutMethodActionText, { color: tokens.textSecondary }]}>{p.setDefault}</Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => openEditMethod(m)} style={[styles.payoutMethodActionBtn, { borderColor: tokens.border, flexDirection: rowDirection, alignItems: "center", gap: 4 }]}>
                    <Pencil size={13} color={tokens.textSecondary} />
                    <Text style={[styles.payoutMethodActionText, { color: tokens.textSecondary }]}>{p.editMethod}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void removeMethod(m.id)}
                    disabled={deletingId === m.id}
                    style={[styles.payoutMethodActionBtn, { borderColor: tokens.danger, flexDirection: rowDirection, alignItems: "center", gap: 4, opacity: deletingId === m.id ? 0.5 : 1 }]}
                  >
                    <Trash2 size={13} color={tokens.danger} />
                    <Text style={[styles.payoutMethodActionText, { color: tokens.danger }]}>{p.deleteMethod}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}

        {/* Historial de solicitudes */}
        <Text style={[styles.sectionTitle, { color: tokens.textSecondary, textAlign }]}>{p.historyTitle}</Text>
        {requestsError ? (
          <Text style={{ color: tokens.textMuted, textAlign }}>{p.loadError}</Text>
        ) : payoutRequests.length === 0 ? (
          <Text style={{ color: tokens.textMuted, textAlign }}>{p.noRequests}</Text>
        ) : (
          payoutRequests.map((r) => {
            const statusColor = PAYOUT_STATUS_COLORS[r.status] ?? tokens.textMuted;
            const statusLabel = (p as Record<string, string>)[`status${r.status.charAt(0).toUpperCase() + r.status.slice(1)}`] ?? r.status;
            return (
              <View key={r.id} style={[styles.card, { backgroundColor: tokens.bgCard, borderColor: tokens.border }]}>
                <View style={[styles.payoutMethodTop, { flexDirection: rowDirection }]}>
                  <Text style={[styles.cardTitle, { color: tokens.textPrimary, textAlign }]}>${r.amountUsd.toFixed(2)} USD</Text>
                  <View style={[styles.badge, { backgroundColor: `${statusColor}22`, flexDirection: rowDirection }]}>
                    <View style={[styles.badgeDot, { backgroundColor: statusColor }]} />
                    <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
                  </View>
                </View>
                <Text style={[styles.cardMeta, { color: tokens.textMuted, textAlign }]}>{p.colAmountTokens}: {r.amountTokens.toLocaleString()}{r.methodLabel ? ` · ${r.methodLabel}` : ""}</Text>
                <Text style={[styles.cardMeta, { color: tokens.textMuted, textAlign }]}>{p.requestedAt}: {r.requestedAt ? new Date(r.requestedAt).toLocaleDateString() : "-"}{r.paidAt ? ` · ${p.paidAt}: ${new Date(r.paidAt).toLocaleDateString()}` : ""}</Text>
                {r.status === "rejected" && r.rejectionReason ? (
                  <Text style={[styles.cardMeta, { color: tokens.danger, textAlign }]}>{p.rejectionReason}: {r.rejectionReason}</Text>
                ) : null}
              </View>
            );
          })
        )}
      </View>

      {/* Editor de método de desembolso (crear / editar). */}
      <FormSheet
        visible={methodModalOpen}
        onClose={() => setMethodModalOpen(false)}
        title={editingMethod ? p.editMethod : p.addMethod}
        language={language}
        footer={(
          <Button variant="primary" label={p.save} loading={methodBusy} disabled={methodBusy} onPress={() => void saveMethod()} />
        )}
      >
        <View style={styles.payoutModalForm}>
          {!editingMethod ? (
            <View style={styles.payoutModalField}>
              <Text style={[styles.payoutModalLabel, { color: tokens.textSecondary, textAlign }]}>{p.methodType}</Text>
              <Select
                value={methodType}
                options={methodTypeOptions}
                onChange={(v) => { setMethodType(v as PayoutMethodType); setMethodFields({}); }}
              />
            </View>
          ) : null}
          <View style={styles.payoutModalField}>
            <Text style={[styles.payoutModalLabel, { color: tokens.textSecondary, textAlign }]}>{p.methodLabelField}</Text>
            <TextInput
              value={methodLabel}
              onChangeText={setMethodLabel}
              placeholder={p.methodLabelPlaceholder}
              placeholderTextColor={tokens.textMuted}
              style={[styles.payoutModalInput, { color: tokens.textPrimary, borderColor: tokens.border, backgroundColor: tokens.bgInput }]}
            />
          </View>
          {PAYOUT_FIELDS[methodType].map((f) => (
            <View key={f.key} style={styles.payoutModalField}>
              <Text style={[styles.payoutModalLabel, { color: tokens.textSecondary, textAlign }]}>{(p as Record<string, string>)[f.labelKey] ?? f.key}</Text>
              <TextInput
                value={methodFields[f.key] ?? ""}
                onChangeText={(v) => setMethodFields((prev) => ({ ...prev, [f.key]: v }))}
                placeholder={editingMethod ? editingMethod.mask?.[f.key] ?? "" : ""}
                placeholderTextColor={tokens.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.payoutModalInput, { color: tokens.textPrimary, borderColor: tokens.border, backgroundColor: tokens.bgInput }]}
              />
            </View>
          ))}
          <Pressable
            onPress={() => setMethodDefault((v) => !v)}
            style={[styles.payoutDefaultRow, { flexDirection: rowDirection }]}
          >
            <Text style={[styles.payoutModalLabel, { color: tokens.textSecondary, textAlign }]}>{p.defaultBadge}</Text>
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: methodDefault ? tokens.brand : tokens.border, backgroundColor: methodDefault ? tokens.brand : "transparent", alignItems: "center", justifyContent: "center" }}>
              {methodDefault ? <Check size={14} color="#fff" /> : null}
            </View>
          </Pressable>
          {methodError ? <Text style={[styles.payoutInlineError, { color: tokens.danger, textAlign }]}>{methodError}</Text> : null}
        </View>
      </FormSheet>
    </View>
  );
}
