import { describe, it, expect } from "vitest";
import {
  loadSavedAccounts,
  upsertSavedAccount,
  updateSavedAccountPhoto,
  removeSavedAccount,
  reorderSavedAccounts,
  type SavedAccount,
} from "./savedAccounts";

const KEY = "lp.desktop.saved.accounts";

function acct(over: Partial<SavedAccount> = {}): SavedAccount {
  return {
    uid: "u1",
    email: "a@example.com",
    displayName: "A",
    photoURL: null,
    lastLogin: 1000,
    ...over,
  };
}

describe("loadSavedAccounts", () => {
  it("returns [] when nothing stored", () => {
    expect(loadSavedAccounts()).toEqual([]);
  });

  it("returns [] when stored value is empty string", () => {
    localStorage.setItem(KEY, "");
    expect(loadSavedAccounts()).toEqual([]);
  });

  it("returns [] on invalid JSON", () => {
    localStorage.setItem(KEY, "{not-json");
    expect(loadSavedAccounts()).toEqual([]);
  });

  it("returns [] when parsed value is not an array (object)", () => {
    localStorage.setItem(KEY, JSON.stringify({ uid: "x" }));
    expect(loadSavedAccounts()).toEqual([]);
  });

  it("returns [] when parsed value is a non-array primitive", () => {
    localStorage.setItem(KEY, JSON.stringify(42));
    expect(loadSavedAccounts()).toEqual([]);
  });

  it("returns the stored array as-is", () => {
    const data = [acct(), acct({ uid: "u2", email: "b@example.com" })];
    localStorage.setItem(KEY, JSON.stringify(data));
    expect(loadSavedAccounts()).toEqual(data);
  });
});

describe("upsertSavedAccount", () => {
  it("adds a new account when empty", () => {
    const next = upsertSavedAccount(acct());
    expect(next).toHaveLength(1);
    expect(next[0].uid).toBe("u1");
    expect(loadSavedAccounts()).toEqual(next);
  });

  it("prepends the account (most recent first)", () => {
    upsertSavedAccount(acct({ uid: "u1", email: "a@example.com" }));
    const next = upsertSavedAccount(acct({ uid: "u2", email: "b@example.com" }));
    expect(next.map((a) => a.uid)).toEqual(["u2", "u1"]);
  });

  it("replaces an existing entry with the same uid (dedupe by uid)", () => {
    upsertSavedAccount(acct({ uid: "u1", email: "a@example.com", displayName: "Old" }));
    const next = upsertSavedAccount(acct({ uid: "u1", email: "a@example.com", displayName: "New" }));
    expect(next).toHaveLength(1);
    expect(next[0].displayName).toBe("New");
  });

  it("replaces an existing entry with the same email but different uid", () => {
    upsertSavedAccount(acct({ uid: "u1", email: "same@example.com" }));
    const next = upsertSavedAccount(acct({ uid: "u2", email: "same@example.com" }));
    expect(next).toHaveLength(1);
    expect(next[0].uid).toBe("u2");
  });

  it("removes BOTH a uid-match and an email-match in a single upsert", () => {
    // Seed two distinct entries, then upsert one that collides with each
    localStorage.setItem(
      KEY,
      JSON.stringify([
        acct({ uid: "u1", email: "one@example.com" }),
        acct({ uid: "u2", email: "two@example.com" }),
      ]),
    );
    const next = upsertSavedAccount(acct({ uid: "u1", email: "two@example.com" }));
    expect(next).toHaveLength(1);
    expect(next[0].uid).toBe("u1");
    expect(next[0].email).toBe("two@example.com");
  });
});

describe("updateSavedAccountPhoto", () => {
  it("updates photoURL for the matching uid and persists", () => {
    upsertSavedAccount(acct({ uid: "u1", photoURL: null }));
    const next = updateSavedAccountPhoto("u1", "http://img/p.png");
    expect(next[0].photoURL).toBe("http://img/p.png");
    expect(loadSavedAccounts()[0].photoURL).toBe("http://img/p.png");
  });

  it("can clear the photo by passing null", () => {
    upsertSavedAccount(acct({ uid: "u1", photoURL: "http://img/p.png" }));
    const next = updateSavedAccountPhoto("u1", null);
    expect(next[0].photoURL).toBeNull();
  });

  it("returns the list unchanged when uid is not found and does not persist a change", () => {
    upsertSavedAccount(acct({ uid: "u1", email: "a@example.com", photoURL: "keep" }));
    const before = loadSavedAccounts();
    const next = updateSavedAccountPhoto("missing", "x");
    expect(next).toEqual(before);
    expect(loadSavedAccounts()).toEqual(before);
  });

  it("leaves other accounts untouched", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        acct({ uid: "u1", email: "a@example.com", photoURL: "a" }),
        acct({ uid: "u2", email: "b@example.com", photoURL: "b" }),
      ]),
    );
    const next = updateSavedAccountPhoto("u2", "newB");
    expect(next.find((a) => a.uid === "u1")?.photoURL).toBe("a");
    expect(next.find((a) => a.uid === "u2")?.photoURL).toBe("newB");
  });

  it("returns [] when there are no accounts", () => {
    expect(updateSavedAccountPhoto("u1", "x")).toEqual([]);
  });
});

describe("removeSavedAccount", () => {
  it("removes the account matching the email", () => {
    upsertSavedAccount(acct({ uid: "u1", email: "a@example.com" }));
    upsertSavedAccount(acct({ uid: "u2", email: "b@example.com" }));
    const next = removeSavedAccount("a@example.com");
    expect(next.map((a) => a.email)).toEqual(["b@example.com"]);
    expect(loadSavedAccounts()).toEqual(next);
  });

  it("is a no-op when the email is not present", () => {
    upsertSavedAccount(acct({ uid: "u1", email: "a@example.com" }));
    const next = removeSavedAccount("nope@example.com");
    expect(next).toHaveLength(1);
    expect(next[0].email).toBe("a@example.com");
  });

  it("returns [] when removing from an empty store", () => {
    expect(removeSavedAccount("a@example.com")).toEqual([]);
  });
});

describe("reorderSavedAccounts", () => {
  it("reorders accounts to match the given email order", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        acct({ uid: "u1", email: "a@example.com" }),
        acct({ uid: "u2", email: "b@example.com" }),
        acct({ uid: "u3", email: "c@example.com" }),
      ]),
    );
    const next = reorderSavedAccounts(["c@example.com", "a@example.com", "b@example.com"]);
    expect(next.map((a) => a.email)).toEqual(["c@example.com", "a@example.com", "b@example.com"]);
    expect(loadSavedAccounts().map((a) => a.email)).toEqual([
      "c@example.com",
      "a@example.com",
      "b@example.com",
    ]);
  });

  it("appends accounts not mentioned in the order list (preserving their order)", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        acct({ uid: "u1", email: "a@example.com" }),
        acct({ uid: "u2", email: "b@example.com" }),
        acct({ uid: "u3", email: "c@example.com" }),
      ]),
    );
    const next = reorderSavedAccounts(["c@example.com"]);
    expect(next.map((a) => a.email)).toEqual(["c@example.com", "a@example.com", "b@example.com"]);
  });

  it("ignores emails in the order list that do not exist", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([acct({ uid: "u1", email: "a@example.com" })]),
    );
    const next = reorderSavedAccounts(["ghost@example.com", "a@example.com"]);
    expect(next.map((a) => a.email)).toEqual(["a@example.com"]);
  });

  it("does not duplicate an email listed more than once", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        acct({ uid: "u1", email: "a@example.com" }),
        acct({ uid: "u2", email: "b@example.com" }),
      ]),
    );
    const next = reorderSavedAccounts(["a@example.com", "a@example.com"]);
    expect(next.map((a) => a.email)).toEqual(["a@example.com", "b@example.com"]);
  });

  it("returns [] when there are no accounts", () => {
    expect(reorderSavedAccounts(["a@example.com"])).toEqual([]);
  });
});
