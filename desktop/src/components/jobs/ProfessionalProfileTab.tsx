// Pestaña "Mi perfil profesional" (Fase 6, IMPL-B).
// Espejo de `loadMyProfile`/`readProfileForm`/`fillProfileForm`/`saveProfile`/
// `renderProfileMeta` del web. Enrola si aún no soy profesional; actualiza si ya
// lo soy. Habilidades/idiomas = chips por coma/línea; enlaces = "label|url" o
// "url" por línea (solo http/https, máx 10).
import { useCallback, useEffect, useState } from "react";
import {
  getMyProfessionalProfile, enrollProfessional, updateProfessionalProfile, jobsErrorKey,
  type Availability, type MyProfessionalProfile, type ProfileLink,
} from "../../api/jobs";
import { useToast } from "../ToastProvider";
import type { JobsMessages } from "./i18n";

function parseChips(raw: string): string[] {
  return raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
}

/** Idiomas seleccionables (códigos de locale del portal). El match de ranking
 *  compara contra `requirement.language`, que usa estos mismos códigos. */
const LANGUAGES: { code: string; label: string }[] = [
  { code: "es", label: "Español" }, { code: "en", label: "English" },
  { code: "fr", label: "Français" }, { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" }, { code: "pt", label: "Português" },
  { code: "ru", label: "Русский" }, { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" }, { code: "bn", label: "বাংলা" },
  { code: "ja", label: "日本語" }, { code: "ko", label: "한국어" },
  { code: "zh-Hant", label: "繁體中文" },
];

export function ProfessionalProfileTab({
  token, j, saveLabel,
}: {
  token: string;
  j: JobsMessages;
  /** Etiqueta del botón guardar/enrolar la decide el padre por estado (enroll/save). */
  saveLabel?: (enrolled: boolean) => string;
}) {
  const toast = useToast();
  const [profile, setProfile] = useState<MyProfessionalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Campos del formulario (nombre/país NO: vienen del perfil de usuario).
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [cvUrl, setCvUrl] = useState("");
  const [availability, setAvailability] = useState<Availability>("available");
  const [skills, setSkills] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [links, setLinks] = useState("");

  const fill = useCallback((p: MyProfessionalProfile | null) => {
    setHeadline(p?.headline ?? "");
    setBio(p?.bio ?? "");
    setCvUrl(p?.cvUrl ?? "");
    setAvailability(p?.availability ?? "available");
    setSkills((p?.skills ?? []).join(", "));
    setLanguages(p?.spokenLanguages ?? []);
    setLinks((p?.profileLinks ?? []).map((l) => `${l.label}|${l.url}`).join("\n"));
  }, []);

  const toggleLang = useCallback((code: string) => {
    setLanguages((cur) => (cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]));
  }, []);

  const errKey = useCallback((err: unknown): string => {
    const path = jobsErrorKey(err).split(".");
    let node: unknown = j;
    for (const p of path) node = (node as Record<string, unknown>)?.[p];
    return typeof node === "string" ? node : (err instanceof Error ? err.message : j.error.generic);
  }, [j]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getMyProfessionalProfile(token)
      .then((p) => { if (!cancelled) { setProfile(p); fill(p); } })
      .catch(() => { if (!cancelled) { setProfile(null); fill(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, fill]);

  const enrolled = Boolean(profile?.isProfessional);

  function readForm() {
    const profileLinks: ProfileLink[] = parseChips(links)
      .map((line) => {
        const [a, b] = line.split("|").map((s) => s.trim());
        return b ? { label: a, url: b } : { label: a, url: a };
      })
      .filter((l) => /^https?:\/\//i.test(l.url))
      .slice(0, 10);
    return {
      headline: headline.trim() || null,
      bio: bio.trim() || null,
      cvUrl: cvUrl.trim() || null,
      availability,
      skills: parseChips(skills),
      spokenLanguages: languages,
      profileLinks,
    };
  }

  async function save() {
    setSaving(true);
    try {
      const input = readForm();
      const updated = enrolled
        ? await updateProfessionalProfile(token, input)
        : await enrollProfessional(token, input);
      setProfile(updated);
      fill(updated);
      toast.success(j.profile.saved);
    } catch (err) {
      toast.error(errKey(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl bg-base-200" />;
  }

  const btnLabel = saveLabel ? saveLabel(enrolled) : (enrolled ? j.profile.save : j.profile.enroll);

  return (
    <div className="rounded-xl border border-base-300 bg-base-100 p-4">
      {/* Meta solo-lectura: identidad (nombre/país) del perfil de USUARIO. */}
      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        {profile?.displayName ? (
          <div>
            <span className="opacity-60">{j.profile.displayName}: </span>
            <strong>{profile.displayName}{profile.country ? ` · ${profile.country}` : ""}</strong>
          </div>
        ) : null}
        <div>
          <span className="opacity-60">{j.profile.rating}: </span>
          <strong>{profile && profile.ratingCount > 0 ? `★ ${profile.ratingAvg.toFixed(1)} (${profile.ratingCount})` : "—"}</strong>
        </div>
        <div>
          <span className="opacity-60">{j.profile.activeJobs}: </span>
          <strong>{profile?.activeJobsCount ?? 0}</strong>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="form-control sm:col-span-2">
          <span className="label-text mb-1">{j.profile.headline}</span>
          <input className="input input-bordered" value={headline} onChange={(e) => setHeadline(e.target.value)} />
        </label>
        <label className="form-control sm:col-span-2">
          <span className="label-text mb-1">{j.profile.bio}</span>
          <textarea className="textarea textarea-bordered" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
        </label>
        <label className="form-control">
          <span className="label-text mb-1">{j.profile.cvUrl}</span>
          <input className="input input-bordered" value={cvUrl} onChange={(e) => setCvUrl(e.target.value)} />
        </label>
        <label className="form-control">
          <span className="label-text mb-1">{j.profile.availability}</span>
          <select className="select select-bordered" value={availability} onChange={(e) => setAvailability(e.target.value as Availability)}>
            <option value="available">{j.profile.avail.available}</option>
            <option value="busy">{j.profile.avail.busy}</option>
            <option value="away">{j.profile.avail.away}</option>
          </select>
        </label>
        <label className="form-control sm:col-span-2">
          <span className="label-text mb-1">{j.profile.skills}</span>
          <input className="input input-bordered" value={skills} onChange={(e) => setSkills(e.target.value)} />
        </label>
        <div className="form-control sm:col-span-2">
          <span className="label-text mb-1">{j.profile.languages}</span>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((l) => {
              const on = languages.includes(l.code);
              return (
                <button
                  key={l.code}
                  type="button"
                  className={`btn btn-sm ${on ? "btn-primary" : "btn-outline"}`}
                  aria-pressed={on}
                  onClick={() => toggleLang(l.code)}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
        </div>
        <label className="form-control sm:col-span-2">
          <span className="label-text mb-1">{j.profile.links}</span>
          <textarea className="textarea textarea-bordered" rows={3} value={links} onChange={(e) => setLinks(e.target.value)} />
        </label>
      </div>

      <div className="mt-4 flex justify-end">
        <button type="button" className="btn btn-primary gap-2" onClick={() => void save()} disabled={saving}>
          {saving ? <span className="loading loading-spinner loading-xs" /> : null}
          {btnLabel}
        </button>
      </div>
    </div>
  );
}
