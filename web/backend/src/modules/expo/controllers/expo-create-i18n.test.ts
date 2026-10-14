// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { localizeExpoCreateMessage } from "./expo-create-i18n.js";

describe("Expo creation response messages", () => {
  it("translates progress and results into the requested locale", () => {
    expect(localizeExpoCreateMessage("en", "Creando la app…")).toBe("Creating the app…");
    expect(localizeExpoCreateMessage("ja", "App creada y lista.")).toBe("アプリの作成が完了しました。");
  });

  it("preserves path and diagnostic details", () => {
    expect(localizeExpoCreateMessage("en", "La ruta /srv/my-app ya existe.")).toBe("The path /srv/my-app already exists.");
    expect(localizeExpoCreateMessage("en", "No se pudo iniciar la creación. process exited with code 1"))
      .toBe("Could not start app creation. process exited with code 1");
  });

  it("leaves unknown technical messages untouched", () => {
    expect(localizeExpoCreateMessage("fr", "EAS CLI exited with code 1")).toBe("EAS CLI exited with code 1");
  });

  it("supports every available locale", () => {
    for (const locale of ["es", "en", "fr", "de", "it", "pt", "ar", "bn", "hi", "ja", "ko", "ru"]) {
      expect(localizeExpoCreateMessage(locale, "Creando la app…")).toBeTruthy();
    }
  });
});
