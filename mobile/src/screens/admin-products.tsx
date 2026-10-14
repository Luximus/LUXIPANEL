/**
 * admin-products — sección Productos Wompi de AdminScreen (extraída sin cambio de comportamiento).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { Pencil, Trash2, Ban, CheckCircle2 } from "lucide-react-native";
import { styles } from "./AdminScreen.styles";
import {
  getAdminUsers,
  updateAdminUser,
  setAdminUserBlocked,
  deleteAdminUser,
  getAdminRoles,
  createAdminRole,
  updateAdminRole,
  deleteAdminRole,
  getWompiProducts,
  createWompiProduct,
  updateWompiProduct,
  deleteWompiProduct,
  getExchangeRate,
  getPremiumModules,
  createPremiumModule,
  updatePremiumModule,
  deletePremiumModule,
  type AdminUser,
  type AdminRole,
  type PermissionDef,
  type WompiProduct,
  type PremiumModule,
} from "../api/admin";
import { getMessages, formatMessage, getLocaleTextAlign } from "../i18n";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import {
  type ThemeTokens,
  useListLoader,
  SectionShell,
  Card,
  Badge,
  ActionIcon,
  ConfirmModal,
  FieldLabel,
  ToggleRow,
  FormError,
} from "./admin-shared";

// ── Productos Wompi ──────────────────────────────────────────────────────────

function parseNumber(value: string): number | null {
  const normalized = value.replace(/[^0-9.,-]/g, "").replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ProductsSection({ token, language, tokens }: { token: string; language: string; tokens: ThemeTokens }) {
  const t = getMessages(language).admin;
  const textAlign = getLocaleTextAlign(language);
  const { items: products, busy, error, refresh } = useListLoader<WompiProduct>(() => getWompiProducts(token));
  const [rate, setRate] = useState(0);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyProductForm());
  const [invalid, setInvalid] = useState<"name" | "amountUsd" | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, title: "", message: "", busy: false, action: null as null | (() => Promise<void>) });
  const nameRef = useRef<TextInput>(null);
  const usdRef = useRef<TextInput>(null);

  useEffect(() => { void getExchangeRate().then(setRate); }, []);
  useEffect(() => {
    if (invalid === "name") nameRef.current?.focus();
    else if (invalid === "amountUsd") usdRef.current?.focus();
  }, [invalid]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => `${p.sku} ${p.name} ${p.description ?? ""}`.toLowerCase().includes(q));
  }, [products, search]);

  const amountUsdNum = parseNumber(form.amountUsd) ?? 0;
  const isFree = amountUsdNum === 0;
  const derivedCop = isFree ? 0 : (rate > 0 ? Math.round(amountUsdNum * rate) : null);

  const openCreate = () => {
    setInvalid(null); setFormError("");
    setForm(emptyProductForm());
    setEditingId(null);
    setOpen(true);
  };
  const openEdit = (p: WompiProduct) => {
    setInvalid(null); setFormError("");
    const usd = p.amountUsd != null ? p.amountUsd : (rate > 0 && p.amountCop ? p.amountCop / rate : 0);
    setForm({
      name: p.name,
      description: p.description ?? "",
      logoUrl: p.logoUrl ?? "",
      amountUsd: usd ? String(Number(usd).toFixed(2)) : "",
      productKind: p.productKind === "license" ? "license" : "tokens",
      tokenAmount: String(p.tokenAmount ?? 0),
      validityMonths: String(p.validityMonths ?? 1),
      isActive: p.isActive,
      showInPlans: p.showInPlans !== false,
      showInApp: p.showInApp !== false,
      showInDesktop: p.showInDesktop !== false,
      autoPurchaseOnSignup: p.autoPurchaseOnSignup === true,
      purchaseLimit: p.purchaseLimit != null ? String(p.purchaseLimit) : "",
      discountPercent: String(p.discountPercent ?? 0),
      trialDays: String(p.trialDays ?? 0),
    });
    setEditingId(p.id);
    setOpen(true);
  };

  const save = async () => {
    const name = form.name.trim();
    const usd = parseNumber(form.amountUsd) ?? 0;
    if (!name || usd < 0) { setFormError(t.productValidateTitlePrice); setInvalid(!name ? "name" : "amountUsd"); return; }
    const tokenAmount = Number(form.tokenAmount);
    if (!Number.isInteger(tokenAmount) || (form.productKind === "tokens" && tokenAmount < 1)) {
      setFormError(language.startsWith("es") ? "Indica una cantidad positiva de tokens." : "Enter a positive token amount.");
      return;
    }
    const computedCop = usd === 0 ? 0 : (rate > 0 ? Math.round(usd * rate) : null);
    if (usd > 0 && (computedCop === null || computedCop <= 0)) { setFormError(t.productCopRateUnavailable); return; }
    const validityParsed = Number(form.validityMonths);
    const validityRaw = Number.isFinite(validityParsed) && validityParsed >= 0 ? Math.round(validityParsed) : 1;
    const purchaseLimitRaw = form.purchaseLimit.trim();
    const purchaseLimit = purchaseLimitRaw === "" ? null : Math.max(1, Number(purchaseLimitRaw) || 0);
    const discountPercent = Math.min(100, Math.max(0, Math.round(Number(form.discountPercent) || 0)));
    const trialDays = usd === 0 ? 0 : Math.min(365, Math.max(0, Math.round(Number(form.trialDays) || 0)));
    const payload = {
      name,
      description: form.description.trim() || null,
      logoUrl: form.logoUrl.trim() || null,
      amountCop: usd === 0 ? 0 : (computedCop ?? 0),
      amountUsd: usd > 0 ? usd : null,
      productKind: form.productKind,
      tokenAmount: form.productKind === "license" ? 0 : tokenAmount,
      validityMonths: usd === 0 ? 0 : validityRaw,
      isActive: form.isActive,
      showInPlans: form.showInPlans,
      showInApp: form.showInApp,
      showInDesktop: form.showInDesktop,
      autoPurchaseOnSignup: isFree ? form.autoPurchaseOnSignup : false,
      purchaseLimit,
      discountPercent,
      trialDays,
    };
    setSaving(true); setFormError("");
    try {
      if (editingId) await updateWompiProduct(editingId, payload, token);
      else await createWompiProduct(payload, token);
      setOpen(false);
      await refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t.saveError);
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (p: WompiProduct) => {
    setConfirm({
      open: true,
      title: t.productDeleteTitle,
      message: formatMessage(t.productDeleteMessage, { name: p.name }),
      busy: false,
      action: async () => { await deleteWompiProduct(p.id, token); await refresh(); },
    });
  };
  const runConfirm = async () => {
    if (!confirm.action) return;
    setConfirm((c) => ({ ...c, busy: true }));
    try {
      await confirm.action();
      setConfirm({ open: false, title: "", message: "", busy: false, action: null });
    } catch {
      setConfirm((c) => ({ ...c, busy: false }));
    }
  };

  const fmtUsd = (p: WompiProduct) => {
    if (p.amountCop === 0) return t.productFree;
    // USD canónico de la BD; si un producto antiguo no lo tiene, "—" (no se
    // deriva del COP — evita desfases por tasa).
    if (typeof p.amountUsd === "number") return `$${p.amountUsd.toFixed(2)} USD`;
    return "—";
  };

  return (
    <SectionShell
      tokens={tokens}
      language={language}
      busy={busy}
      error={error}
      empty={filtered.length === 0}
      emptyLabel={t.empty}
      retryLabel={t.retry}
      onRetry={refresh}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder={t.search}
      onNew={openCreate}
    >
      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <Card tokens={tokens}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={[styles.cardTitle, { color: tokens.textPrimary, textAlign }]}>{item.name}</Text>
                <Text numberOfLines={1} style={[styles.cardMeta, { color: tokens.textMuted, textAlign }]}>{item.sku} · {fmtUsd(item)}</Text>
              </View>
              <View style={styles.cardActions}>
                <ActionIcon icon={<Pencil />} color={tokens.brand} onPress={() => openEdit(item)} />
                <ActionIcon icon={<Trash2 />} color={tokens.danger} onPress={() => askDelete(item)} />
              </View>
            </View>
            <View style={styles.badgeRow}>
              <Badge label={item.isActive ? t.productStatusActive : t.productStatusInactive} color={item.isActive ? tokens.success : tokens.textMuted} />
              {item.showInApp !== false ? <Badge label={t.productShowAppLabel} color={tokens.brand} /> : null}
            </View>
          </Card>
        )}
      />

      <Modal
        visible={open}
        onClose={() => setOpen(false)}
        title={editingId ? t.productEditTitle : t.productCreateTitle}
        language={language}
        footer={
          <>
            <Button label={t.cancel} variant="ghost" onPress={() => setOpen(false)} disabled={saving} />
            <Button label={editingId ? t.save : t.create} variant="primary" onPress={() => void save()} loading={saving} disabled={saving} />
          </>
        }
      >
        <Input ref={nameRef} label={t.productNameLabel} value={form.name} error={invalid === "name" ? " " : undefined}
          onChangeText={(v) => { setInvalid(null); setForm((f) => ({ ...f, name: v })); }} />
        <Input label={t.productDescriptionLabel} value={form.description} multiline onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} />
        <Input label={t.productLogoLabel} value={form.logoUrl} autoCapitalize="none" onChangeText={(v) => setForm((f) => ({ ...f, logoUrl: v }))} />
        <Input ref={usdRef} label={t.productPriceUsdLabel} value={form.amountUsd} keyboardType="numeric"
          error={invalid === "amountUsd" ? " " : undefined}
          onChangeText={(v) => { setInvalid(null); setForm((f) => ({ ...f, amountUsd: v })); }} />
        <Input label={t.productPriceCopLabel} value={derivedCop !== null ? String(derivedCop) : ""} editable={false} hint={t.productCopDerived} />
        <FieldLabel tokens={tokens} language={language}>{language.startsWith("es") ? "Tipo de producto" : "Product type"}</FieldLabel>
        <Select value={form.productKind} placeholder={language.startsWith("es") ? "Tipo de producto" : "Product type"}
          options={[{ value: "tokens", label: "Tokens" }, { value: "license", label: language.startsWith("es") ? "Licencia" : "License" }]}
          onChange={(v) => setForm((f) => ({ ...f, productKind: v === "license" ? "license" : "tokens", tokenAmount: v === "license" ? "0" : "" }))} />
        {form.productKind === "tokens" ? (
          <Input label={language.startsWith("es") ? "Tokens que acredita" : "Tokens credited"} value={form.tokenAmount}
            keyboardType="numeric" onChangeText={(v) => setForm((f) => ({ ...f, tokenAmount: v }))} />
        ) : null}
        {!isFree ? (
          <Input label={t.productValidityLabel} value={form.validityMonths} keyboardType="numeric" onChangeText={(v) => setForm((f) => ({ ...f, validityMonths: v }))} />
        ) : null}
        <Input label={t.productPurchaseLimitLabel} value={form.purchaseLimit} keyboardType="numeric" placeholder={t.productNoLimit} onChangeText={(v) => setForm((f) => ({ ...f, purchaseLimit: v }))} />
        <Input label={t.productDiscountLabel} value={form.discountPercent} keyboardType="numeric" onChangeText={(v) => setForm((f) => ({ ...f, discountPercent: v }))} />
        {!isFree ? (
          <Input label={t.productTrialDaysLabel} value={form.trialDays} keyboardType="numeric" onChangeText={(v) => setForm((f) => ({ ...f, trialDays: v }))} />
        ) : null}
        <ToggleRow tokens={tokens} language={language} label={t.productActiveLabel} value={form.isActive} onValueChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
        <ToggleRow tokens={tokens} language={language} label={t.productShowPlansLabel} value={form.showInPlans} onValueChange={(v) => setForm((f) => ({ ...f, showInPlans: v }))} />
        <ToggleRow tokens={tokens} language={language} label={t.productShowAppLabel} value={form.showInApp} onValueChange={(v) => setForm((f) => ({ ...f, showInApp: v }))} />
        <ToggleRow tokens={tokens} language={language} label={t.productShowDesktopLabel} value={form.showInDesktop} onValueChange={(v) => setForm((f) => ({ ...f, showInDesktop: v }))} />
        <ToggleRow tokens={tokens} language={language} label={t.productAutoSignupLabel} value={form.autoPurchaseOnSignup} disabled={!isFree}
          onValueChange={(v) => setForm((f) => ({ ...f, autoPurchaseOnSignup: v }))} />
        {formError ? <FormError tokens={tokens} message={formError} /> : null}
      </Modal>

      <ConfirmModal state={confirm} language={language} tokens={tokens}
        onCancel={() => setConfirm({ open: false, title: "", message: "", busy: false, action: null })}
        onConfirm={() => void runConfirm()} />
    </SectionShell>
  );
}

function emptyProductForm() {
  return {
    name: "",
    description: "",
    logoUrl: "",
    amountUsd: "",
    productKind: "tokens" as "tokens" | "license",
    tokenAmount: "",
    validityMonths: "1",
    isActive: true,
    showInPlans: true,
    showInApp: false,
    showInDesktop: true,
    autoPurchaseOnSignup: false,
    purchaseLimit: "",
    discountPercent: "0",
    trialDays: "0",
  };
}
