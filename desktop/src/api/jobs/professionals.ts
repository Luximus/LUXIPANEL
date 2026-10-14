/**
 * Jobs Marketplace — profesionales (§ professionals): mi perfil, enroll,
 * búsqueda por email y ranking.
 * Extraído de `src/api/jobs.ts` (fachada); los consumidores importan `../api/jobs`.
 */

import { request } from "../client";
import type {
  Availability, Envelope, MyProfessionalProfile, ProfileLink,
  PublicProfessional, RankedProfessional,
} from "./types";

// ── Profesionales (§ professionals) ───────────────────────────────────────────

// Nombre y país NO se envían: viven en el perfil de usuario (cuenta). Solo
// datos EXTRA de profesional.
export interface ProfessionalProfileInput {
  headline: string | null;
  bio: string | null;
  cvUrl: string | null;
  availability: Availability;
  skills: string[];
  spokenLanguages: string[];
  profileLinks: ProfileLink[];
}

/** GET /portal/jobs/professionals/me → mi perfil (null si no enrolado). */
export async function getMyProfessionalProfile(token: string): Promise<MyProfessionalProfile | null> {
  const res = await request<Envelope<{ profile: MyProfessionalProfile | null }>>(
    "/portal/jobs/professionals/me",
    token,
  );
  return res.data.profile ?? null;
}

/** POST /portal/jobs/professionals/enroll → activa el perfil profesional. */
export async function enrollProfessional(
  token: string,
  input: ProfessionalProfileInput,
): Promise<MyProfessionalProfile> {
  const res = await request<Envelope<{ profile: MyProfessionalProfile }>>(
    "/portal/jobs/professionals/enroll",
    token,
    { method: "POST", body: JSON.stringify(input) },
  );
  return res.data.profile;
}

/** PATCH /portal/jobs/professionals/me → actualiza el perfil profesional. */
export async function updateProfessionalProfile(
  token: string,
  input: ProfessionalProfileInput,
): Promise<MyProfessionalProfile> {
  const res = await request<Envelope<{ profile: MyProfessionalProfile }>>(
    "/portal/jobs/professionals/me",
    token,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return res.data.profile;
}

/** GET /portal/jobs/professionals/search?email= → un profesional por email exacto. */
export async function searchProfessionalByEmail(
  token: string,
  email: string,
): Promise<PublicProfessional | null> {
  const res = await request<Envelope<{ professional: PublicProfessional | null }>>(
    `/portal/jobs/professionals/search?email=${encodeURIComponent(email)}`,
    token,
  );
  return res.data.professional ?? null;
}

/** GET /portal/jobs/professionals/ranked?requirementId=&onlyAvailable= → ranking. */
export async function listRankedProfessionals(
  token: string,
  requirementId: string,
  onlyAvailable: boolean,
): Promise<RankedProfessional[]> {
  const qs = `requirementId=${encodeURIComponent(requirementId)}${onlyAvailable ? "&onlyAvailable=true" : ""}`;
  const res = await request<Envelope<{ professionals: RankedProfessional[] }>>(
    `/portal/jobs/professionals/ranked?${qs}`,
    token,
  );
  return res.data.professionals ?? [];
}
