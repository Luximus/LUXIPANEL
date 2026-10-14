import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useConfirm, type ConfirmOptions } from "./ConfirmDialog";

const BASE: ConfirmOptions = {
  title: "Eliminar panel",
  message: "Esta accion no se puede deshacer.",
  confirmLabel: "Eliminar",
  cancelLabel: "Cancelar",
};

/** Test harness: exposes the imperative confirm() + renders the dialog portal. */
function Harness({ options, onResult }: { options: ConfirmOptions; onResult: (v: boolean) => void }) {
  const { confirm, dialog } = useConfirm();
  return (
    <>
      <button type="button" onClick={() => void confirm(options).then(onResult)}>
        open
      </button>
      {dialog}
    </>
  );
}

describe("useConfirm", () => {
  it("does not render the dialog until confirm() is called", () => {
    render(<Harness options={BASE} onResult={() => {}} />);
    expect(screen.queryByText("Eliminar panel")).toBeNull();
  });

  it("renders title, message and both labels when opened", () => {
    render(<Harness options={BASE} onResult={() => {}} />);
    fireEvent.click(screen.getByText("open"));
    expect(screen.getByText("Eliminar panel")).toBeInTheDocument();
    expect(screen.getByText("Esta accion no se puede deshacer.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeInTheDocument();
    // "Cancelar" is the accessible name of both the footer button and the
    // close (X) button, so there are two matches.
    expect(screen.getAllByRole("button", { name: "Cancelar" })).toHaveLength(2);
  });

  it("resolves true when confirm is clicked and closes the dialog", async () => {
    const results: boolean[] = [];
    render(<Harness options={BASE} onResult={(v) => results.push(v)} />);
    fireEvent.click(screen.getByText("open"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    });
    expect(results).toEqual([true]);
    expect(screen.queryByText("Eliminar panel")).toBeNull();
  });

  it("resolves false when the cancel button is clicked", async () => {
    const results: boolean[] = [];
    render(<Harness options={BASE} onResult={(v) => results.push(v)} />);
    fireEvent.click(screen.getByText("open"));
    // The footer ghost button is the cancel action (the X close button shares
    // the same accessible name).
    const cancelBtn = document.querySelector(".lp-modal-btn--ghost") as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(cancelBtn);
    });
    expect(results).toEqual([false]);
  });

  it("renders the danger styling without a title when title is omitted", () => {
    render(
      <Harness
        options={{ ...BASE, title: undefined, danger: true }}
        onResult={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("open"));
    // danger icon is an svg inside the title heading
    const heading = screen.getByRole("heading");
    expect(heading.querySelector("svg")).not.toBeNull();
  });
});
