import { type Messages } from "../../../i18n";
import type { AiUsage } from "../../../api/blog";
import { fmtTokens } from "./helpers";

/** Desglose de tokens IA (texto/imagen/total) del borrador. Solo se pinta si hay
 *  consumo (`aiUsage.total.total > 0`). */
export function AiUsageTable({ aiUsage, b }: { aiUsage: AiUsage; b: Messages["blog"] }) {
  return (
    <div className="rounded-lg border border-base-300 p-2 text-xs">
      <div className="mb-1 font-semibold">{b.aiUsageTitle}</div>
      <table className="w-full text-right">
        <thead>
          <tr className="opacity-70">
            <th className="text-left"></th>
            <th>{b.aiUsageInput}</th><th>{b.aiUsageCached}</th><th>{b.aiUsageOutput}</th><th>{b.aiUsageTotal}</th>
          </tr>
        </thead>
        <tbody>
          {([["text", b.aiUsageText], ["image", b.aiUsageImage], ["total", b.aiUsageTotal]] as const).map(([k, lbl]) => {
            const bucket = aiUsage[k];
            return (
              <tr key={k} className={k === "total" ? "font-semibold" : ""}>
                <th className="text-left font-normal">{lbl}</th>
                <td>{fmtTokens(bucket.input)}</td>
                <td>{fmtTokens(bucket.cached)}</td>
                <td>{fmtTokens(bucket.output)}</td>
                <td>{fmtTokens(bucket.total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-1 opacity-60">{b.aiUsageNote}</p>
    </div>
  );
}
