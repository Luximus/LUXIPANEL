import { describe, it, expect } from "vitest";
import {
  loadGuestHistory,
  pushGuestAccessLink,
  removeGuestEntry,
} from "./guestHistory";

describe("guest history (localStorage) — access links only", () => {
  it("empieza vacío", () => {
    expect(loadGuestHistory()).toEqual([]);
  });
  it("push agrega al frente, sin duplicar por token", () => {
    pushGuestAccessLink({ token: "tok-uno" });
    pushGuestAccessLink({ token: "tok-dos" });
    pushGuestAccessLink({ token: "tok-uno" }); // duplicado por token
    const list = loadGuestHistory();
    expect(list.map((e) => e.token)).toEqual(["tok-uno", "tok-dos"]);
  });
  it("remove elimina por token", () => {
    pushGuestAccessLink({ token: "alpha" });
    pushGuestAccessLink({ token: "beta" });
    removeGuestEntry("alpha");
    expect(loadGuestHistory().map((e) => e.token)).toEqual(["beta"]);
  });
  it("limita a 12 entradas", () => {
    for (let i = 0; i < 20; i++) pushGuestAccessLink({ token: `s${i}` });
    expect(loadGuestHistory()).toHaveLength(12);
  });
});
