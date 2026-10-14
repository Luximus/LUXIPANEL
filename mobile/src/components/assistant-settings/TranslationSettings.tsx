import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { luxAssistantProxy } from "../../api/client";
import type { ThemeTokens } from "../../theme/colors";
import type { Messages } from "../../i18n/messages";
import { Select } from "../ui/Select";
import { s } from "./styles";
import { SectionHead, ToggleRow } from "./parts";

type T = Messages["assistantSettings"];
type EngineId = "ai" | "deepl" | "google" | "libretranslate";

/** Idiomas ofrecidos en el selector de idioma destino (espeja
 *  `TRANSLATION_LANGUAGES` de WEB/assistant-api.ts). */
const TRANSLATION_LANGUAGES: { code: string; label: string }[] = [
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "ru", label: "Русский" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
];

type TranslationCfg = {
  enabled: boolean;
  engine: EngineId;
  targetLanguage: string;
  deepl: { hasApiKey: boolean };
  google: { hasApiKey: boolean };
  libretranslate: { baseUrl: string };
};

/**
 * Traducción automática de las respuestas del asistente. Réplica RN (subconjunto)
 * de `TranslationSettings` de la web: activar + idioma destino + motor
 * (IA/DeepL/Google/LibreTranslate). Las credenciales de motores dedicados se
 * gestionan desde el panel/desktop; aquí solo se ofrecen los motores ya
 * configurados (más "IA", que reutiliza el proveedor activo). Persiste vía
 * `PUT /api/ai/translation/config`.
 */
export function TranslationSettings({
  panelId,
  token,
  t,
  tokens,
}: {
  panelId: string;
  token: string;
  t: T;
  tokens: ThemeTokens;
}) {
  const [cfg, setCfg] = useState<TranslationCfg | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void luxAssistantProxy<{ translation?: TranslationCfg }>(panelId, token, "GET", "/api/ai/translation/config").then((body) => {
      if (!cancelled && body?.translation) setCfg(body.translation);
    });
    return () => { cancelled = true; };
  }, [panelId, token]);

  const save = async (patch: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await luxAssistantProxy<{ translation?: TranslationCfg }>(
        panelId, token, "PUT", "/api/ai/translation/config", patch,
      );
      if (res?.translation) setCfg(res.translation);
    } finally {
      setBusy(false);
    }
  };

  const tx = t.providersExtra;
  const engineLabels: Record<EngineId, string> = {
    ai: tx.engineAi,
    deepl: tx.engineDeepl,
    google: tx.engineGoogle,
    libretranslate: tx.engineLibre,
  };

  // Un motor es seleccionable solo si tiene credenciales: IA siempre (usa el
  // proveedor activo), DeepL/Google con su key, LibreTranslate con su URL. El
  // motor guardado se mantiene en la lista aunque pierda credenciales.
  const engineConfigured = (e: EngineId): boolean =>
    e === "ai" ? true
      : e === "deepl" ? !!cfg?.deepl.hasApiKey
      : e === "google" ? !!cfg?.google.hasApiKey
      : !!cfg?.libretranslate.baseUrl?.trim();
  const allEngines: EngineId[] = ["ai", "deepl", "google", "libretranslate"];
  const engineOptions = Array.from(new Set([...allEngines.filter(engineConfigured), cfg?.engine ?? "ai"]));

  return (
    <View style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.border }]}>
      <SectionHead title={tx.translationTitle} desc={tx.translationDesc} tokens={tokens} />
      <ToggleRow
        label={tx.translationEnable}
        value={cfg?.enabled ?? false}
        disabled={busy || !cfg}
        onChange={(v) => void save({ enabled: v })}
        tokens={tokens}
      />

      <View>
        <Text style={[s.fieldLabel, { color: tokens.textMuted }]}>{tx.translationYourLanguage}</Text>
        <Select
          value={cfg?.targetLanguage ?? ""}
          options={[{ value: "", label: tx.translationAutoDetect }, ...TRANSLATION_LANGUAGES.map((l) => ({ value: l.code, label: l.label }))]}
          onChange={(v) => void save({ targetLanguage: v })}
        />
      </View>

      <View>
        <Text style={[s.fieldLabel, { color: tokens.textMuted }]}>{tx.translationEngine}</Text>
        <Select
          value={cfg?.engine ?? "ai"}
          options={engineOptions.map((e) => ({ value: e, label: engineLabels[e] }))}
          onChange={(v) => void save({ engine: v as EngineId })}
        />
      </View>
    </View>
  );
}

export default TranslationSettings;
