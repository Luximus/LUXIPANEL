import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { PassphraseInput } from "./PassphraseInput";

const A11Y = { ariaShow: "Mostrar", ariaHide: "Ocultar" };

describe("PassphraseInput", () => {
  it("renders as a password field by default", () => {
    render(<PassphraseInput value="secret" onChange={() => {}} {...A11Y} />);
    const input = screen.getByDisplayValue("secret") as HTMLInputElement;
    expect(input.type).toBe("password");
  });

  it("toggles visibility when the reveal button is clicked", () => {
    render(<PassphraseInput value="secret" onChange={() => {}} {...A11Y} />);
    const input = screen.getByDisplayValue("secret") as HTMLInputElement;
    const toggle = screen.getByRole("button", { name: "Mostrar" });
    fireEvent.click(toggle);
    expect(input.type).toBe("text");
    // label flips to hide once visible
    fireEvent.click(screen.getByRole("button", { name: "Ocultar" }));
    expect(input.type).toBe("password");
  });

  it("calls onChange with the typed value", () => {
    const onChangeSpy = vi.fn();
    const { container } = render(<PassphraseInput value="" onChange={onChangeSpy} {...A11Y} />);
    // password inputs have no implicit ARIA role; query the DOM directly
    const input = container.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc" } });
    expect(onChangeSpy).toHaveBeenCalledWith("abc");
  });

  it("reflects a controlled value round-trip", () => {
    function Harness() {
      const [v, setV] = useState("");
      return <PassphraseInput value={v} onChange={setV} {...A11Y} />;
    }
    const { container } = render(<Harness />);
    const input = container.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "hunter2" } });
    expect(input.value).toBe("hunter2");
  });

  it("disables both the input and the reveal button when disabled", () => {
    render(<PassphraseInput value="x" onChange={() => {}} disabled {...A11Y} />);
    const input = screen.getByDisplayValue("x") as HTMLInputElement;
    expect(input).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mostrar" })).toBeDisabled();
  });

  it("marks the input as invalid when ariaInvalid is set", () => {
    render(<PassphraseInput value="" onChange={() => {}} ariaInvalid {...A11Y} />);
    const input = document.querySelector("input") as HTMLInputElement;
    expect(input).toHaveAttribute("aria-invalid", "true");
  });
});
