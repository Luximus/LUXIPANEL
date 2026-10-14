import { describe, expect, it } from "vitest";
import { API_LOCALES } from "./errors.js";
import { MODULE_MESSAGE_KEYS, apiModuleMessage, localizeCloudflareTokenMessage, localizeGitServiceMessage, localizeRepoCloneStatus, localizeOpenClawTestMessage, localizeImageOptimMessage, localizeTeamTaskFailure } from "./module-messages.js";

describe("module response localization", () => {
  it("supplies every supported locale and falls back to English", () => {
    for (const locale of API_LOCALES) {
      expect(apiModuleMessage(locale, "snapshotNotFound").trim()).not.toBe("");
      expect(apiModuleMessage(locale, "pathForbidden").trim()).not.toBe("");
    }
    expect(apiModuleMessage("unknown", "snapshotNotFound")).toBe("Snapshot not found");
    expect(apiModuleMessage("ja", "snapshotNotFound")).toBe("スナップショットが見つかりません");
  });

  it("keeps every backend module message nonempty with matching placeholders", () => {
    const placeholders = (value: string) => [...value.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)].map((match) => match[1]).sort();
    for (const key of MODULE_MESSAGE_KEYS) {
      const canonical = placeholders(apiModuleMessage("es", key));
      for (const locale of API_LOCALES) {
        const message = apiModuleMessage(locale, key);
        expect(message.trim(), `${locale}.${key}`).not.toBe("");
        expect(placeholders(message), `${locale}.${key}`).toEqual(canonical);
      }
    }
  });

  it("translates Git service messages at the controller boundary", () => {
    expect(localizeGitServiceMessage("en", "No es un repositorio Git")).toBe("Not a Git repository");
    expect(localizeGitServiceMessage("fr", "Nombre de rama inválido")).toBe("Nom de branche invalide");
    expect(localizeGitServiceMessage("en", "El mensaje del commit es obligatorio")).toBe("A commit message is required");
    expect(localizeGitServiceMessage("ja", "La rama actual no sigue origin/main")).toBe("現在のブランチは origin/main を追跡していません");
    expect(localizeRepoCloneStatus("en", "La rama actual (dev) difiere de la registrada (main)"))
      .toBe("The current branch (dev) differs from the registered branch (main)");
    expect(localizeGitServiceMessage("en", "fatal: remote rejected")).toBe("fatal: remote rejected");
  });

  it("translates connection results and keeps the HTTP status", () => {
    expect(localizeOpenClawTestMessage("fr", "Conexión exitosa")).toBe("Connexion réussie");
    expect(localizeOpenClawTestMessage("ja", "OpenClaw respondió con HTTP 503")).toBe("OpenClaw は HTTP 503 を返しました");
    expect(localizeOpenClawTestMessage("en", "unexpected protocol detail")).toBe("unexpected protocol detail");
    expect(localizeCloudflareTokenMessage("en", "Token válido y activo")).toBe("Token is valid and active");
    expect(localizeCloudflareTokenMessage("ja", "El token existe pero su estado es \"expired\"")).toBe("トークンは存在しますが、状態は「expired」です");
  });

  it("translates image tool guidance but preserves command diagnostics", () => {
    expect(localizeImageOptimMessage("en", "Instala ImageMagick para redimensionar")).toBe("Install ImageMagick to resize images");
    expect(localizeImageOptimMessage("ja", "No se generó ninguna variante")).toBe("バリエーションを生成できませんでした");
    expect(localizeImageOptimMessage("fr", "magick: permission denied")).toBe("magick: permission denied");
  });

  it("translates team assignment failures without exposing unknown service errors", () => {
    expect(localizeTeamTaskFailure("en", 'El proyecto "p1" no pertenece al agente "worker".'))
      .toBe('Project “p1” does not belong to agent “worker”.');
    expect(localizeTeamTaskFailure("fr", "Límite de 12 tareas activas por conversación alcanzado; espera (team.collect) o cancela tareas antes de asignar más."))
      .toContain("12 tâches actives");
    expect(localizeTeamTaskFailure("ja", "Presupuesto del plan agotado (100 de 100 tokens; plan abc); no se asignan más tareas."))
      .toContain("100 中 100");
    expect(localizeTeamTaskFailure("es", "secret=untrusted raw error"))
      .toBe("No se pudo asignar la tarea. Revisa el agente y el proyecto e inténtalo de nuevo.");
  });
});
