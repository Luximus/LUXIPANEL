import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { getMessages } from "../../i18n";
import { Tooltip } from "../ui/Tooltip";
import styles from "./AdminProductModal.module.css";
import {
  createWompiProduct, updateWompiProduct, getWompiProductLogos, uploadWompiProductLogo, getExchangeRate,
  type WompiProduct, type WompiProductPayload, type ProductLogo,
} from "../../api/admin";

type FailedField = "name" | "amountUsd" | null;

function parseNumber(value: string): number | null {
  const normalized = value.replace(/[^0-9.,-]/g, "").replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function AdminProductModal({
  open,
  product,
  token,
  language,
  onClose,
  onSaved,
}: {
  open: boolean;
  product: WompiProduct | null;
  token: string;
  language: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = getMessages(language);
  const a = t.admin;
  const isEditing = Boolean(product);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [amountUsd, setAmountUsd] = useState("");
  const [productKind, setProductKind] = useState<"tokens" | "license">("tokens");
  const [tokenAmount, setTokenAmount] = useState("");
  const [validityMonths, setValidityMonths] = useState("1");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [trialDays, setTrialDays] = useState("0");
  const [purchaseLimit, setPurchaseLimit] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [showInPlans, setShowInPlans] = useState(true);
  const [showInApp, setShowInApp] = useState(false);
  const [showInDesktop, setShowInDesktop] = useState(true);
  const [autoPurchaseOnSignup, setAutoPurchaseOnSignup] = useState(false);

  const [exchangeRate, setExchangeRate] = useState(0);
  const [logos, setLogos] = useState<ProductLogo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState<FailedField>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const amountUsdRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const usdNum = parseNumber(amountUsd) ?? 0;
  const isFree = usdNum === 0;
  // COP derivado = USD × tasa (peso entero). 0 si gratis.
  const derivedCop = isFree ? 0 : (exchangeRate > 0 ? Math.round(usdNum * exchangeRate) : null);

  useEffect(() => {
    if (!open) return;
    // Carga tasa de cambio y galería de logos al abrir.
    void getExchangeRate(token).then(setExchangeRate);
    void getWompiProductLogos(token).then(setLogos).catch(() => setLogos([]));
    setError("");
    setFailed(null);
    if (product) {
      setName(product.name);
      setDescription(product.description ?? "");
      setLogoUrl(product.logoUrl ?? "");
      const usd = product.amountUsd ?? null;
      setAmountUsd(usd !== null && usd !== undefined ? String(Number(usd).toFixed(2)) : "");
      setProductKind(product.productKind === "license" ? "license" : "tokens");
      setTokenAmount(String(product.tokenAmount ?? 0));
      setValidityMonths(String(product.validityMonths ?? 1));
      setDiscountPercent(String(product.discountPercent ?? 0));
      setTrialDays(String(product.trialDays ?? 0));
      setPurchaseLimit(product.purchaseLimit !== null && product.purchaseLimit !== undefined ? String(product.purchaseLimit) : "");
      setIsActive(product.isActive);
      setShowInPlans(product.showInPlans !== false);
      setShowInApp(product.showInApp !== false);
      setShowInDesktop(product.showInDesktop !== false);
      setAutoPurchaseOnSignup(product.autoPurchaseOnSignup === true);
    } else {
      setName(""); setDescription(""); setLogoUrl(""); setAmountUsd(""); setProductKind("tokens"); setTokenAmount("");
      setValidityMonths("1"); setDiscountPercent("0"); setTrialDays("0"); setPurchaseLimit("");
      setIsActive(true); setShowInPlans(true); setShowInApp(false); setShowInDesktop(true); setAutoPurchaseOnSignup(false);
    }
  }, [open, product, token]);

  useEffect(() => {
    if (failed === "name") nameRef.current?.focus();
    else if (failed === "amountUsd") amountUsdRef.current?.focus();
  }, [failed]);


  if (!open) return null;

  const onUploadFile = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const url = await uploadWompiProductLogo(file, token);
      setLogoUrl(url);
      setLogos(await getWompiProductLogos(token).catch(() => logos));
    } catch (err) {
      setError(err instanceof Error ? err.message : a.saveError);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setError("");
    const nameValue = name.trim();
    if (!nameValue || usdNum < 0) { setFailed(!nameValue ? "name" : "amountUsd"); setError(a.validateTitlePrice); return; }
    const credits = Number(tokenAmount);
    if (productKind === "tokens" && (!Number.isInteger(credits) || credits < 1)) {
      setError(language.startsWith("es") ? "Indica una cantidad positiva de tokens." : "Enter a positive token amount.");
      return;
    }
    const amountCop = isFree ? 0 : (derivedCop ?? 0);
    // Producto de pago sin COP derivado (tasa no disponible) → no guardar.
    if (usdNum > 0 && (derivedCop === null || amountCop <= 0)) { setError(a.copRateUnavailable); return; }

    const validityParsed = Number(validityMonths);
    const validityRaw = Number.isFinite(validityParsed) && validityParsed >= 0 ? Math.round(validityParsed) : 1;
    const limitRaw = purchaseLimit.trim();
    const limit = limitRaw === "" ? null : Math.max(1, Number(limitRaw) || 0);
    const discount = Math.min(100, Math.max(0, Math.round(Number(discountPercent) || 0)));
    const trial = isFree ? 0 : Math.min(365, Math.max(0, Math.round(Number(trialDays) || 0)));

    const payload: WompiProductPayload = {
      name: nameValue,
      description: description.trim() || null,
      logoUrl: logoUrl.trim() || null,
      amountCop,
      amountUsd: usdNum > 0 ? usdNum : null,
      productKind,
      tokenAmount: productKind === "license" ? 0 : credits,
      validityMonths: amountCop === 0 ? 0 : validityRaw,
      isActive,
      showInPlans,
      showInApp,
      showInDesktop,
      // Auto-compra solo aplica a gratis.
      autoPurchaseOnSignup: isFree ? autoPurchaseOnSignup : false,
      purchaseLimit: limit,
      discountPercent: discount,
      trialDays: trial,
    };

    setSaving(true);
    try {
      if (isEditing && product) await updateWompiProduct(product.id, payload, token);
      else await createWompiProduct(payload, token);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : a.saveError);
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || uploading;

  return (
    <div
      className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[150] grid place-items-center p-4"
    >
      <div className="lp-modal-card flex max-h-full w-full max-w-2xl flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{isEditing ? a.editProduct : a.createProduct}</h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label={a.close} disabled={busy}>
            <X size={18} />
          </button>
        </div>

        <div className={`lp-modal-body ${styles.body}`}>
          <label className={`lp-modal-label ${styles.label}`}>
            <span>{a.fieldProductName}</span>
            <input
              ref={nameRef}
              className={`lp-modal-input${failed === "name" ? " lp-modal-input--error" : ""}`}
              aria-invalid={failed === "name" || undefined}
              type="text"
              value={name}
              disabled={busy}
              onChange={(e) => { setName(e.target.value); setFailed(null); }}
            />
          </label>

          <label className={`lp-modal-label ${styles.label}`}>
            <span>{a.fieldProductDescription}</span>
            <textarea className={`lp-modal-input ${styles.resizable}`} rows={2} value={description} disabled={busy} onChange={(e) => setDescription(e.target.value)} />
          </label>

          <label className={`lp-modal-label ${styles.label}`}>
            <span>{a.fieldLogo}</span>
            <input className="lp-modal-input" type="text" value={logoUrl} disabled={busy} onChange={(e) => setLogoUrl(e.target.value)} />
          </label>

          <div className={styles.uploadRow}>
            <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={() => fileRef.current?.click()} disabled={busy}>
              {uploading ? a.uploadingImage : a.uploadImage}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className={styles.hidden}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void onUploadFile(f); }}
            />
            {logos.length > 0 ? (
              <div className={styles.logoGallery}>
                {logos.slice(0, 8).map((logo) => (
                  <Tooltip key={logo.url} tip={logo.name} position="bottom">
                    <button
                      type="button"
                      aria-label={logo.name}
                      onClick={() => setLogoUrl((cur) => (cur.trim() === logo.url ? "" : logo.url))}
                      className={styles.logoBtn}
                      style={{
                        border: logoUrl.trim() === logo.url ? "2px solid var(--lp-brand, #6366f1)" : "1px solid var(--lp-border, #ccc)",
                      }}
                    >
                      <img src={logo.url} alt="" loading="lazy" className={styles.logoImg} />
                    </button>
                  </Tooltip>
                ))}
              </div>
            ) : null}
          </div>

          <div className={styles.grid2}>
            <label className={`lp-modal-label ${styles.label}`}>
              <span>{a.fieldAmountUsd}</span>
              <input
                ref={amountUsdRef}
                className={`lp-modal-input${failed === "amountUsd" ? " lp-modal-input--error" : ""}`}
                aria-invalid={failed === "amountUsd" || undefined}
                type="number"
                min={0}
                step="0.01"
                value={amountUsd}
                disabled={busy}
                onChange={(e) => { setAmountUsd(e.target.value); setFailed(null); }}
              />
            </label>
            <label className={`lp-modal-label ${styles.label}`}>
              <span>{a.fieldAmountCop}</span>
              <input className="lp-modal-input" type="text" readOnly value={isFree ? "0" : derivedCop !== null ? String(derivedCop) : ""} disabled={busy} />
            </label>
          </div>

          <div className={styles.grid2}>
            <label className={`lp-modal-label ${styles.label}`}>
              <span>{language.startsWith("es") ? "Tipo de producto" : "Product type"}</span>
              <select className="lp-modal-input" value={productKind} disabled={busy}
                onChange={(event) => { const kind = event.target.value === "license" ? "license" : "tokens"; setProductKind(kind); setTokenAmount(kind === "license" ? "0" : ""); }}>
                <option value="tokens">Tokens</option>
                <option value="license">{language.startsWith("es") ? "Licencia" : "License"}</option>
              </select>
            </label>
            {productKind === "tokens" ? (
              <label className={`lp-modal-label ${styles.label}`}>
                <span>{language.startsWith("es") ? "Tokens que acredita" : "Tokens credited"}</span>
                <input className="lp-modal-input" type="number" min={1} step={1} value={tokenAmount} disabled={busy}
                  onChange={(event) => setTokenAmount(event.target.value)} />
              </label>
            ) : null}
          </div>

          <div className={styles.grid2}>
            <label className={`lp-modal-label ${styles.label}`}>
              <span>{a.fieldValidityMonths}</span>
              <input className="lp-modal-input" type="number" min={0} value={isFree ? "0" : validityMonths} disabled={busy || isFree} onChange={(e) => setValidityMonths(e.target.value)} />
            </label>
          </div>

          <div className={styles.grid3}>
            <label className={`lp-modal-label ${styles.label}`}>
              <span>{a.fieldDiscountPercent}</span>
              <input className="lp-modal-input" type="number" min={0} max={100} value={discountPercent} disabled={busy} onChange={(e) => setDiscountPercent(e.target.value)} />
            </label>
            <label className={`lp-modal-label ${styles.label}`}>
              <span>{a.fieldTrialDays}</span>
              <input className="lp-modal-input" type="number" min={0} max={365} value={isFree ? "0" : trialDays} disabled={busy || isFree} onChange={(e) => setTrialDays(e.target.value)} />
            </label>
            <label className={`lp-modal-label ${styles.label}`}>
              <span>{a.fieldPurchaseLimit}</span>
              <input className="lp-modal-input" type="number" min={1} value={purchaseLimit} disabled={busy} onChange={(e) => setPurchaseLimit(e.target.value)} />
            </label>
          </div>

          <div className={styles.checkboxGroup}>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" className="checkbox checkbox-sm" checked={isActive} disabled={busy} onChange={(e) => setIsActive(e.target.checked)} />
              <span>{a.optActive}</span>
            </label>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" className="checkbox checkbox-sm" checked={showInPlans} disabled={busy} onChange={(e) => setShowInPlans(e.target.checked)} />
              <span>{a.optShowInPlans}</span>
            </label>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" className="checkbox checkbox-sm" checked={showInApp} disabled={busy} onChange={(e) => setShowInApp(e.target.checked)} />
              <span>{a.optShowInApp}</span>
            </label>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" className="checkbox checkbox-sm" checked={showInDesktop} disabled={busy} onChange={(e) => setShowInDesktop(e.target.checked)} />
              <span>{a.optShowInDesktop}</span>
            </label>
            <label className={styles.checkboxLabel} style={{ opacity: isFree ? 1 : 0.5 }}>
              <input type="checkbox" className="checkbox checkbox-sm" checked={isFree && autoPurchaseOnSignup} disabled={busy || !isFree} onChange={(e) => setAutoPurchaseOnSignup(e.target.checked)} />
              <span>{a.optAutoPurchase}</span>
            </label>
          </div>

          {error ? <p className="lp-modal-error">{error}</p> : null}
        </div>

        <div className="lp-modal-footer">
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClose} disabled={busy}>{a.cancel}</button>
          <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={() => void submit()} disabled={busy}>
            {saving ? a.saving : isEditing ? a.save : a.create}
          </button>
        </div>
      </div>
    </div>
  );
}
