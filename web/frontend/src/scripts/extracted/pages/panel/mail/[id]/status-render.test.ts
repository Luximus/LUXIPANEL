import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./state", () => ({
  fallback: (_key: string, def: string) => def,
}));

import {
  isMailboxCredentialError,
  rememberCredentialFailure,
  renderMailboxCredentialBlockedState,
} from "./status-render";

beforeEach(() => {
  document.body.innerHTML = `<div id="folders-list"></div><div id="messages-list"></div>`;
});

describe("isMailboxCredentialError", () => {
  it("matches by typed backend code even when the message carries no keyword", () => {
    for (const code of ["MAIL_CREDENTIAL_INVALID", "MAIL_PASSWORD_NOT_SET", "MAIL_CREDENTIAL_DECRYPT_FAILED", "MAIL_CREDENTIAL_UNRECOVERABLE"]) {
      expect(isMailboxCredentialError({ ok: false, status: 409, error: code, code })).toBe(true);
    }
  });

  it("keeps the legacy wording match", () => {
    expect(isMailboxCredentialError({ ok: false, status: 409, error: "The stored mailbox password was rejected" })).toBe(true);
  });

  it("ignores other 409s and non-409 statuses", () => {
    expect(isMailboxCredentialError({ ok: false, status: 409, error: "Target scope changed", code: "TARGET_SCOPE_CHANGED" })).toBe(false);
    expect(isMailboxCredentialError({ ok: false, status: 502, error: "mailbox password", code: "MAIL_CREDENTIAL_INVALID" })).toBe(false);
    expect(isMailboxCredentialError({ ok: true, status: 200 })).toBe(false);
  });
});

describe("renderMailboxCredentialBlockedState", () => {
  it("explains a stale (externally changed) password and shows the backend detail", () => {
    rememberCredentialFailure({ code: "MAIL_CREDENTIAL_INVALID", error: "rejected by the IMAP server <x>" });
    renderMailboxCredentialBlockedState();
    const html = document.getElementById("messages-list")!.innerHTML;
    expect(html).toContain("se cambió fuera del panel");
    expect(html).toContain("rejected by the IMAP server &lt;x&gt;");
    expect(html).toContain("openMailboxCurrentCredentialDialog()");
    expect(html).toContain("openMailboxCredentialDialog()");
  });

  it("explains missing master access when nothing is stored", () => {
    rememberCredentialFailure({ code: "MAIL_PASSWORD_NOT_SET", error: "" });
    renderMailboxCredentialBlockedState();
    expect(document.getElementById("messages-list")!.innerHTML).toContain("acceso maestro");
  });
});
