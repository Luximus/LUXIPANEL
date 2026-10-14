// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { validateReplyDraft } from "./reply-draft";

describe("validateReplyDraft", () => {
  it("bloquea el envío mientras haya subidas en curso (aunque el texto valga)", () => {
    expect(validateReplyDraft({ content: "ya lo probé", readyAttachments: 0, hasPendingUploads: true }))
      .toBe("uploads-pending");
    expect(validateReplyDraft({ content: "", readyAttachments: 2, hasPendingUploads: true }))
      .toBe("uploads-pending");
  });

  it("un borrador sin texto ni adjuntos está vacío", () => {
    expect(validateReplyDraft({ content: "", readyAttachments: 0, hasPendingUploads: false })).toBe("empty");
    expect(validateReplyDraft({ content: "   \n\t ", readyAttachments: 0, hasPendingUploads: false })).toBe("empty");
  });

  it("con texto escrito es enviable (el caso que la barra inferior rompía con su closure congelado)", () => {
    expect(validateReplyDraft({ content: "hola", readyAttachments: 0, hasPendingUploads: false })).toBe("ok");
    expect(validateReplyDraft({ content: "  hola  ", readyAttachments: 0, hasPendingUploads: false })).toBe("ok");
  });

  it("solo adjuntos (sin texto) también es enviable", () => {
    expect(validateReplyDraft({ content: "", readyAttachments: 1, hasPendingUploads: false })).toBe("ok");
  });
});
