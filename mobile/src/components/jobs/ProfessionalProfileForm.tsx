import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { getLocaleRowDirection, getLocaleTextAlign } from "../../i18n";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import {
  enrollProfessional,
  getMyProfessionalProfile,
  jobsErrorKey,
  updateProfessionalProfile,
  type Availability,
  type MyProfessionalProfile,
  type ProfessionalProfileInput,
  type ProfileLink,
} from "../../api/jobs";
import { jt, type JobsDict } from "./jobs-i18n";
import { makeStyles } from "./ProfessionalProfileForm.styles";

const AVAILABILITIES: Availability[] = ["available", "busy", "away"];

/** Idiomas seleccionables (códigos de locale del portal; el match de ranking
 *  compara contra requirement.language, que usa estos mismos códigos). */
const LANGUAGES: { code: string; label: string }[] = [
  { code: "es", label: "Español" }, { code: "en", label: "English" },
  { code: "fr", label: "Français" }, { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" }, { code: "pt", label: "Português" },
  { code: "ru", label: "Русский" }, { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" }, { code: "bn", label: "বাংলা" },
  { code: "ja", label: "日本語" }, { code: "ko", label: "한국어" },
  { code: "zh-Hant", label: "繁體中文" },
];

function parseChips(raw: string): string[] {
  return raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
}

// Mi perfil profesional (espejo de readProfileForm/fillProfileForm/saveProfile).
// enroll si aún no soy profesional, update si ya lo soy. ratingAvg/ratingCount/
// activeJobsCount son solo lectura. Se monta dentro de la pestaña "Mi perfil".
export function ProfessionalProfileForm({
  token,
  dict,
  language,
  notify,
}: {
  token: string;
  dict: JobsDict;
  language: string;
  notify: (msg: string, variant?: "success" | "error") => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const textAlign = getLocaleTextAlign(language);
  const rowDir = getLocaleRowDirection(language);

  const [profile, setProfile] = useState<MyProfessionalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Nombre/país NO: vienen del perfil de usuario (cuenta).
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [cvUrl, setCvUrl] = useState("");
  const [availability, setAvailability] = useState<string>("available");
  const [skills, setSkills] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [links, setLinks] = useState("");

  const fill = (p: MyProfessionalProfile | null) => {
    setHeadline(p?.headline ?? "");
    setBio(p?.bio ?? "");
    setCvUrl(p?.cvUrl ?? "");
    setAvailability(p?.availability ?? "available");
    setSkills((p?.skills ?? []).join(", "));
    setLanguages(p?.spokenLanguages ?? []);
    setLinks((p?.profileLinks ?? []).map((l) => `${l.label}|${l.url}`).join("\n"));
  };

  const toggleLang = (code: string) =>
    setLanguages((cur) => (cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]));

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const p = await getMyProfessionalProfile(token);
        if (!alive) return;
        setProfile(p);
        fill(p);
      } catch (e) {
        if (!alive) return;
        setError(jt(dict, jobsErrorKey(e)));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const save = async () => {
    setError("");
    setSaving(true);
    try {
      const profileLinks: ProfileLink[] = parseChips(links)
        .map((line) => {
          const [a, b] = line.split("|").map((s) => s.trim());
          return b ? { label: a, url: b } : { label: a, url: a };
        })
        .filter((l) => /^https?:\/\//i.test(l.url))
        .slice(0, 10);
      const input: ProfessionalProfileInput = {
        headline: headline.trim() || null,
        bio: bio.trim() || null,
        cvUrl: cvUrl.trim() || null,
        availability: availability as Availability,
        skills: parseChips(skills),
        spokenLanguages: languages,
        profileLinks,
      };
      const enrolled = Boolean(profile?.isProfessional);
      const updated = enrolled
        ? await updateProfessionalProfile(token, input)
        : await enrollProfessional(token, input);
      setProfile(updated);
      fill(updated);
      notify(jt(dict, "profile.saved"), "success");
    } catch (e) {
      setError(jt(dict, jobsErrorKey(e)));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ paddingVertical: 40, alignItems: "center" }}>
        <ActivityIndicator color={tokens.brand} />
      </View>
    );
  }

  const enrolled = Boolean(profile?.isProfessional);
  const ratingText = profile && profile.ratingCount > 0
    ? `★ ${profile.ratingAvg.toFixed(1)} (${profile.ratingCount})`
    : "—";

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.metaCard}>
        <View style={[styles.metaRow, { flexDirection: rowDir }]}>
          <Text style={[styles.metaLabel, { color: tokens.textMuted }]}>{jt(dict, "prof.score")}</Text>
          <Text style={[styles.metaValue, { color: tokens.textPrimary }]}>{ratingText}</Text>
        </View>
        <View style={[styles.metaRow, { flexDirection: rowDir }]}>
          <Text style={[styles.metaLabel, { color: tokens.textMuted }]}>{jt(dict, "prof.busyCount", { n: profile?.activeJobsCount ?? 0 })}</Text>
        </View>
        {profile?.displayName ? (
          <View style={[styles.metaRow, { flexDirection: rowDir }]}>
            <Text style={[styles.metaLabel, { color: tokens.textMuted }]}>{jt(dict, "field.displayName")}</Text>
            <Text style={[styles.metaValue, { color: tokens.textPrimary }]}>
              {profile.displayName}{profile.country ? ` · ${profile.country}` : ""}
            </Text>
          </View>
        ) : null}
      </View>

      <Input label={jt(dict, "field.title")} value={headline} onChangeText={setHeadline} maxLength={200} />
      <Input label={jt(dict, "field.description")} value={bio} onChangeText={setBio} multiline maxLength={4000} />
      <Input label={jt(dict, "field.cvUrl")} value={cvUrl} onChangeText={setCvUrl} autoCapitalize="none" placeholder="https://…" />

      <View style={{ gap: 6 }}>
        <Text style={[styles.metaLabel, { color: tokens.textMuted, textAlign }]}>{jt(dict, "profile.avail.available")}</Text>
        <Select
          value={availability}
          onChange={setAvailability}
          options={AVAILABILITIES.map((a) => ({ value: a, label: jt(dict, `profile.avail.${a}`) }))}
        />
      </View>

      <Input label={jt(dict, "field.skills")} value={skills} onChangeText={setSkills} placeholder="a, b, c" />

      <View style={{ gap: 6 }}>
        <Text style={[styles.metaLabel, { color: tokens.textMuted, textAlign }]}>{jt(dict, "field.language")}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {LANGUAGES.map((l) => {
            const on = languages.includes(l.code);
            return (
              <Pressable
                key={l.code}
                onPress={() => toggleLang(l.code)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: on ? tokens.brand : tokens.border,
                  backgroundColor: on ? tokens.brand : "transparent",
                }}
              >
                <Text style={{ color: on ? "#fff" : tokens.textPrimary, fontSize: 13 }}>{l.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Input label={jt(dict, "field.links")} value={links} onChangeText={setLinks} multiline placeholder="GitHub|https://…" />

      {error ? <Text style={[styles.error, { color: tokens.danger, textAlign }]}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={enrolled ? jt(dict, "profile.save") : jt(dict, "profile.enroll")}
          variant="primary"
          onPress={save}
          loading={saving}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}
