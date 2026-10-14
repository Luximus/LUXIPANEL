// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * `zodIssues()` — the ONE Zod-issue → API-error projection (B-06).
 *
 * Nine `ai-assistant` controllers each declared a byte-identical local copy of
 * this three-liner. The shape it produces (`{ field, message }[]`) is part of
 * the public API contract of every `400` those controllers return, so it must
 * stay exactly as it was.
 *
 * The parameter type is intentionally structural (`{ path, message }[]`) rather
 * than `z.ZodIssue[]`: it accepts issues from any Zod version/instance and lets
 * this module stay free of a `zod` import.
 */

import { API_LOCALES, apiErrorMessage, apiLocale } from "../i18n/errors.js";

/** An API-shaped validation error: dotted field path + human message. */
export interface ApiFieldIssue {
  field: string;
  message: string;
}

type Issue = {
  path: readonly (string | number)[];
  message: string;
  code?: string;
  received?: unknown;
  minimum?: number | bigint;
  maximum?: number | bigint;
};

type Translations = readonly [string, string, string, string, string, string, string, string, string, string, string, string];
const customMessages = {
  "Provide title and/or pinned": ["Indica un título o el estado fijado", "Provide a title or pinned status", "Indiquez un titre ou l’état épinglé", "Gib einen Titel oder den Anheftstatus an", "Indica un titolo o lo stato fissato", "Indique um título ou o estado fixado", "حدّد عنوانًا أو حالة التثبيت", "শিরোনাম বা পিন করা অবস্থা দিন", "शीर्षक या पिन की स्थिति दें", "タイトルまたは固定状態を指定してください", "제목 또는 고정 상태를 지정하세요", "Укажите заголовок или состояние закрепления"],
  "At least one of enabled / requireConfirm must be provided": ["Indica enabled o requireConfirm como mínimo", "Provide at least one of enabled or requireConfirm", "Indiquez au moins enabled ou requireConfirm", "Gib mindestens enabled oder requireConfirm an", "Indica almeno enabled o requireConfirm", "Indique pelo menos enabled ou requireConfirm", "حدّد enabled أو requireConfirm على الأقل", "অন্তত enabled বা requireConfirm দিন", "कम से कम enabled या requireConfirm दें", "enabled または requireConfirm のいずれかを指定してください", "enabled 또는 requireConfirm 중 하나 이상을 지정하세요", "Укажите хотя бы enabled или requireConfirm"],
  "Ruta absoluta inválida": ["Ruta absoluta no válida", "Invalid absolute path", "Chemin absolu invalide", "Ungültiger absoluter Pfad", "Percorso assoluto non valido", "Caminho absoluto inválido", "المسار المطلق غير صالح", "পরম পাথটি সঠিক নয়", "निरपेक्ष पथ अमान्य है", "絶対パスが無効です", "절대 경로가 올바르지 않습니다", "Недопустимый абсолютный путь"],
  "La URL de vista previa debe ser HTTPS o una ruta del panel": ["La URL de vista previa debe usar HTTPS o ser una ruta del panel", "The preview URL must use HTTPS or be a panel path", "L’URL d’aperçu doit utiliser HTTPS ou être un chemin du panneau", "Die Vorschau-URL muss HTTPS verwenden oder ein Panelpfad sein", "L’URL di anteprima deve usare HTTPS o essere un percorso del pannello", "O URL de pré-visualização deve usar HTTPS ou ser um caminho do painel", "يجب أن يستخدم رابط المعاينة HTTPS أو يكون مسارًا داخل اللوحة", "প্রিভিউ URL-টি HTTPS ব্যবহার করতে হবে অথবা প্যানেলের পাথ হতে হবে", "पूर्वावलोकन URL को HTTPS उपयोग करना चाहिए या पैनल का पथ होना चाहिए", "プレビュー URL は HTTPS を使用するか、パネル内のパスにしてください", "미리보기 URL은 HTTPS를 사용하거나 패널 경로여야 합니다", "URL предпросмотра должен использовать HTTPS или путь панели"],
  "ruta absoluta requerida": ["Se requiere una ruta absoluta", "An absolute path is required", "Un chemin absolu est requis", "Ein absoluter Pfad ist erforderlich", "È richiesto un percorso assoluto", "É necessário um caminho absoluto", "المسار المطلق مطلوب", "পরম পাথ প্রয়োজন", "निरपेक्ष पथ आवश्यक है", "絶対パスが必要です", "절대 경로가 필요합니다", "Требуется абсолютный путь"],
  "projectPath debe ser una ruta absoluta": ["projectPath debe ser una ruta absoluta", "projectPath must be an absolute path", "projectPath doit être un chemin absolu", "projectPath muss ein absoluter Pfad sein", "projectPath deve essere un percorso assoluto", "projectPath deve ser um caminho absoluto", "يجب أن يكون projectPath مسارًا مطلقًا", "projectPath অবশ্যই পরম পাথ হতে হবে", "projectPath एक निरपेक्ष पथ होना चाहिए", "projectPath は絶対パスにしてください", "projectPath는 절대 경로여야 합니다", "projectPath должен быть абсолютным путём"],
  "patch vacío": ["El cambio no puede estar vacío", "The update cannot be empty", "La modification ne peut pas être vide", "Die Änderung darf nicht leer sein", "La modifica non può essere vuota", "A alteração não pode estar vazia", "لا يمكن أن يكون التعديل فارغًا", "পরিবর্তন খালি হতে পারে না", "बदलाव खाली नहीं हो सकता", "変更内容を空にすることはできません", "변경 사항은 비워 둘 수 없습니다", "Изменение не может быть пустым"],
} as const satisfies Record<string, Translations>;

function issueMessage(issue: Issue, locale: unknown): string {
  const specific = customMessages[issue.message as keyof typeof customMessages];
  if (specific) return specific[API_LOCALES.indexOf(apiLocale(locale))] ?? specific[1];
  if (issue.code === "invalid_type" && issue.received === "undefined") return apiErrorMessage(locale, "required");
  if (issue.code === "invalid_enum_value") return apiErrorMessage(locale, "invalidOption");
  if (issue.code === "too_small") return apiErrorMessage(locale, "minimum", String(issue.minimum ?? ""));
  if (issue.code === "too_big") return apiErrorMessage(locale, "maximum", String(issue.maximum ?? ""));
  if (issue.code === "invalid_string") return apiErrorMessage(locale, "invalidFormat");
  return apiErrorMessage(locale, "invalid");
}

/** Project Zod issues to the `{ field, message }` pairs the API answers with. */
export function zodIssues(
  issues: readonly Issue[],
  locale?: unknown,
): ApiFieldIssue[] {
  return issues.map((i) => ({ field: i.path.join("."), message: locale === undefined ? i.message : issueMessage(i, locale) }));
}
