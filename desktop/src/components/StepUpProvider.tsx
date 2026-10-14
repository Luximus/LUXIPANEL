import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../context/useAuth";
import { getStepUpPrefs, getTotpStatus, setStepUpPrefs } from "../api/client";
import { registerStepUpHandler } from "../lib/step-up-bridge";
import { loadSessionState } from "../lib/session-state";
import { StepUpCodeModal } from "./StepUpCodeModal";

// El token step-up dura 5 min en el backend; lo reusamos por scope con margen.
const TOKEN_TTL_MS = 4.5 * 60 * 1000;

type StepUpContextValue = {
  totpEnabled: boolean;
  /** True tras el bootstrap (`getTotpStatus`): el panel de Seguridad espera esto
   *  para decidir el gate inline sin parpadear. */
  ready: boolean;
  availableScopes: string[];
  enabledScopes: string[];
  loading: boolean;
  refresh: () => Promise<void>;
  saveScopes: (scopes: string[]) => Promise<void>;
  requireSecurityAccess: () => Promise<boolean>;
  /** ¿Token step-up vigente en cache para ese scope? */
  isUnlocked: (scope: string) => boolean;
  /** Cachea un token verificado INLINE (gate inline de Seguridad) para que el
   *  retry central lo reutilice y no dispare el modal. */
  cacheToken: (scope: string, stepUpToken: string) => void;
};

const StepUpContext = createContext<StepUpContextValue | null>(null);

export function useStepUp(): StepUpContextValue {
  const ctx = useContext(StepUpContext);
  if (!ctx) throw new Error("useStepUp must be used within StepUpProvider");
  return ctx;
}

export function StepUpProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [availableScopes, setAvailableScopes] = useState<string[]>([]);
  const [enabledScopes, setEnabledScopes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<Map<string, { token: string; expiresAt: number }>>(new Map());
  const pendingRef = useRef<((value: string | null) => void) | null>(null);
  const [modal, setModal] = useState<{ open: boolean; scope: string }>({ open: false, scope: "" });

  // Lee las preferencias COMPLETAS (gateadas con `security.access`). NO se llama
  // en el montaje global: dispararía el step-up de entrada a Seguridad en CUALQUIER
  // pantalla. Lo invoca `SecurityTab` al abrir Seguridad (donde el gate sí toca y
  // el token ya queda cacheado por los otros reads gateados).
  const refresh = useCallback(async () => {
    if (!token) {
      setTotpEnabled(false);
      setEnabledScopes([]);
      setAvailableScopes([]);
      cacheRef.current.clear();
      return;
    }
    setLoading(true);
    try {
      const prefs = await getStepUpPrefs(token);
      setTotpEnabled(Boolean(prefs.totpEnabled));
      setAvailableScopes(prefs.availableScopes ?? []);
      setEnabledScopes(prefs.enabledScopes ?? []);
    } catch {
      /* best-effort: los gates del backend siguen protegiendo */
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Bootstrap global: SOLO `totpEnabled`, vía el endpoint SIN gate `/auth/totp/status`
  // (su propósito explícito es "decidir si mostrar el gate"). Antes esto leía las
  // prefs GATEADAS (`getStepUpPrefs`), lo que provocaba el modal de "Verificación en
  // dos pasos" (scope `security.access`) al entrar a Servidores/cualquier pantalla
  // sin haber abierto Seguridad. Las prefs completas las carga `SecurityTab`.
  useEffect(() => {
    if (!token) {
      setTotpEnabled(false);
      setAvailableScopes([]);
      setEnabledScopes([]);
      cacheRef.current.clear();
      setReady(false);
      return;
    }
    let cancelled = false;
    setReady(false);
    void (async () => {
      try {
        const status = await getTotpStatus(token);
        if (!cancelled) setTotpEnabled(Boolean(status.enabled));
      } catch {
        /* best-effort: los gates del backend siguen protegiendo */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const isUnlocked = useCallback((scope: string) => {
    const cached = cacheRef.current.get(scope);
    return Boolean(cached && cached.expiresAt - 5000 > Date.now());
  }, []);

  const cacheToken = useCallback((scope: string, stepUpToken: string) => {
    cacheRef.current.set(scope, { token: stepUpToken, expiresAt: Date.now() + TOKEN_TTL_MS });
  }, []);

  const prompt = useCallback((scope: string): Promise<string | null> => {
    const cached = cacheRef.current.get(scope);
    if (cached && cached.expiresAt - 5000 > Date.now()) return Promise.resolve(cached.token);
    return new Promise<string | null>((resolve) => {
      pendingRef.current = resolve;
      setModal({ open: true, scope });
    });
  }, []);

  useEffect(() => {
    registerStepUpHandler((scope) => prompt(scope));
    return () => registerStepUpHandler(null);
  }, [prompt]);

  const handleVerified = useCallback((stepUpToken: string) => {
    setModal((m) => {
      if (m.scope) cacheRef.current.set(m.scope, { token: stepUpToken, expiresAt: Date.now() + TOKEN_TTL_MS });
      return { open: false, scope: "" };
    });
    const resolve = pendingRef.current;
    pendingRef.current = null;
    resolve?.(stepUpToken);
  }, []);

  const handleClose = useCallback(() => {
    setModal({ open: false, scope: "" });
    const resolve = pendingRef.current;
    pendingRef.current = null;
    resolve?.(null);
  }, []);

  const requireSecurityAccess = useCallback(async () => {
    if (!token || !totpEnabled) return true;
    const tok = await prompt("security.access");
    return Boolean(tok);
  }, [token, totpEnabled, prompt]);

  const saveScopes = useCallback(async (scopes: string[]) => {
    if (!token) return;
    const res = await setStepUpPrefs(token, scopes);
    setEnabledScopes(res.enabledScopes ?? scopes);
  }, [token]);

  const value = useMemo<StepUpContextValue>(
    () => ({ totpEnabled, ready, availableScopes, enabledScopes, loading, refresh, saveScopes, requireSecurityAccess, isUnlocked, cacheToken }),
    [totpEnabled, ready, availableScopes, enabledScopes, loading, refresh, saveScopes, requireSecurityAccess, isUnlocked, cacheToken],
  );

  return (
    <StepUpContext.Provider value={value}>
      {children}
      <StepUpCodeModal
        open={modal.open}
        token={token ?? ""}
        scope={modal.scope}
        language={loadSessionState().language}
        onClose={handleClose}
        onVerified={handleVerified}
      />
    </StepUpContext.Provider>
  );
}
