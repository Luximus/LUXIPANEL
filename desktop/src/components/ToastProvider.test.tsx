import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ToastProvider, useToast } from "./ToastProvider";

/** Buttons that drive the imperative toast API from inside the provider. */
function Harness() {
  const toast = useToast();
  return (
    <div>
      <button type="button" onClick={() => toast.success("Guardado")}>ok</button>
      <button type="button" onClick={() => toast.error("Falló")}>fail</button>
      <button type="button" onClick={() => toast.info("Info msg", { title: null, duration: 0 })}>sticky</button>
    </div>
  );
}

function setup() {
  return render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );
}

describe("ToastProvider / useToast", () => {
  beforeEach(() => {
    // Spanish so default per-variant titles are the source-of-truth strings.
    localStorage.setItem("lxp-language", "es");
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("renders no toast until one is triggered", () => {
    setup();
    expect(screen.queryByText("Guardado")).toBeNull();
  });

  it("shows a success toast with the default title and a polite status role", () => {
    setup();
    fireEvent.click(screen.getByText("ok"));
    expect(screen.getByText("Guardado")).toBeInTheDocument();
    expect(screen.getByText("Éxito")).toBeInTheDocument();
    const alert = document.querySelector(".alert-success");
    expect(alert).not.toBeNull();
    expect(alert?.getAttribute("role")).toBe("status");
  });

  it("shows an error toast with an assertive alert role", () => {
    setup();
    fireEvent.click(screen.getByText("fail"));
    expect(screen.getByText("Falló")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
    const alert = document.querySelector(".alert-error");
    expect(alert).not.toBeNull();
    expect(alert?.getAttribute("role")).toBe("alert");
  });

  it("dismisses a toast when the close button is clicked", () => {
    setup();
    fireEvent.click(screen.getByText("ok"));
    const closeBtn = screen.getByRole("button", { name: "Cerrar" });
    act(() => {
      fireEvent.click(closeBtn);
      vi.advanceTimersByTime(250); // play the exit animation timeout
    });
    expect(screen.queryByText("Guardado")).toBeNull();
  });

  it("auto-dismisses after its duration elapses", () => {
    setup();
    fireEvent.click(screen.getByText("ok"));
    expect(screen.getByText("Guardado")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4000 + 250); // success default (4s) + exit
    });
    expect(screen.queryByText("Guardado")).toBeNull();
  });

  it("keeps a sticky toast (duration 0) and omits the title when set to null", () => {
    setup();
    fireEvent.click(screen.getByText("sticky"));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText("Info msg")).toBeInTheDocument();
    expect(screen.queryByText("Información")).toBeNull();
  });
});
