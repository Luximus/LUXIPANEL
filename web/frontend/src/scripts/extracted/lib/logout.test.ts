import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bindLogout } from "./logout";

describe("sign out", () => {
  const target = "/login?logout=1";
  let fetchMock: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;
  let button: HTMLButtonElement;
  const options = {
    label: "Cerrando sesión…", url: "/api/logout", csrfToken: () => "csrf-test",
    csrfHeader: "X-CSRF-Token", target,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<main><button id="logout-btn">Cerrar sesión</button></main>';
    button = document.querySelector("button")!;
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    navigate = vi.spyOn(window.location, "assign").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("shows the blocking screen immediately and waits for revocation", async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>(resolve => { finish = resolve; }));
    bindLogout(button, options);
    button.click();
    const screen = document.querySelector<HTMLDialogElement>("#logout-screen")!;
    expect(screen.open).toBe(true);
    expect(screen.textContent).toContain(options.label);
    expect(document.querySelector("main")!.inert).toBe(true);
    expect(button.disabled).toBe(true);
    expect(document.activeElement).toBe(screen);
    expect(navigate).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("/api/logout", expect.objectContaining({
      method: "POST", credentials: "include", keepalive: true,
      headers: { "X-CSRF-Token": "csrf-test" },
    }));
    const cancel = new Event("cancel", { cancelable: true });
    screen.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    finish(new Response('{"ok":true}', { status: 200 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(navigate).toHaveBeenCalledWith(target);
  });

  it("does not duplicate sign out across bindings or repeated clicks", async () => {
    fetchMock.mockResolvedValue(new Response());
    bindLogout(button, options);
    bindLogout(button, options);
    button.click();
    button.dispatchEvent(new Event("click"));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403, 500])("returns to the cookie-clearing login after HTTP %s", async status => {
    fetchMock.mockResolvedValue(new Response("", { status }));
    bindLogout(button, options);
    button.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(navigate).toHaveBeenCalledWith(target);
  });

  it("returns to login after a network failure", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    bindLogout(button, options);
    button.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(navigate).toHaveBeenCalledWith(target);
  });

  it("bounds the wait while leaving the revocation request alive", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    bindLogout(button, options);
    button.click();
    await vi.advanceTimersByTimeAsync(7999);
    expect(navigate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(navigate).toHaveBeenCalledWith(target);
    expect(fetchMock.mock.calls[0][1].signal).toBeUndefined();
  });
});
