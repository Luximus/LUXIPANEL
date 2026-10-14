/* eslint-disable react-refresh/only-export-components -- fichero compartido del split: exporta helpers y constantes además de componentes */
// blog-shared (desktop) — tipos, helpers puros y bloque de uso IA compartidos
// por la sección Blog. Extraído de `screens/BlogScreen.tsx`; espeja la
// convención de hermanos de la app RN (`blog-shared` junto a `blog-editor` y
// `blog-managers`).
import type { getMessages } from "../../i18n";
import type { AiUsage, BlogPost } from "../../api/blog";

export type BlogT = ReturnType<typeof getMessages>["blog"];
export type Tab = "publish" | "categories" | "tags";

// Deriva un slug (path público) espejando la derivación del backend (que sigue
// siendo la autoridad de unicidad): minúsculas, sin acentos, no-alfanumérico → "-".
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

// Hashtags escritos con espacios/comas y "#" opcional → string[] limpio.
export function parseHashtags(raw: string): string[] {
  return raw.split(/[\s,]+/).map((h) => h.replace(/^#+/, "").trim()).filter(Boolean);
}

// ── Fila de la tabla (viewmodel plano, formatos ya resueltos) ─────────────────
export type BlogPostRow = {
  id: string;
  title: string;
  categoryLabel: string;
  statusLabel: string;
  tagsLabel: string;
  authorLabel: string;
  views: number;
  dateLabel: string;
  searchBlob: string;
  source: BlogPost;
};

// Bloque compacto de tokens IA consumidos (texto / imagen / total).
export function UsageBlock({ t, usage }: { t: BlogT; usage: AiUsage }) {
  const rows: Array<[string, AiUsage["text"]]> = [
    [t.aiUsageText, usage.text],
    [t.aiUsageImage, usage.image],
    [t.aiUsageTotal, usage.total],
  ];
  return (
    <div className="mt-1 rounded-box border border-base-300 bg-base-100 p-2 text-xs">
      <p className="mb-1 font-semibold">{t.aiUsageTitle}</p>
      <table className="w-full">
        <thead>
          <tr className="text-base-content/50">
            <th className="text-left font-normal"></th>
            <th className="text-right font-normal">{t.aiUsageInput}</th>
            <th className="text-right font-normal">{t.aiUsageCached}</th>
            <th className="text-right font-normal">{t.aiUsageOutput}</th>
            <th className="text-right font-normal">{t.aiUsageTotal}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, b]) => (
            <tr key={label}>
              <td className="text-left">{label}</td>
              <td className="text-right tabular-nums">{b.input}</td>
              <td className="text-right tabular-nums">{b.cached}</td>
              <td className="text-right tabular-nums">{b.output}</td>
              <td className="text-right tabular-nums">{b.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-base-content/50">{t.aiUsageNote}</p>
    </div>
  );
}
