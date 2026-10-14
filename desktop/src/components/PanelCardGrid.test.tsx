import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// PanelCardGrid pulls in gsap, a heavy carousel and PNG assets. None of those
// are relevant to the drawer open/close behaviour under test, so we stub them
// out BEFORE importing the component (vi.mock is hoisted, but we keep them up
// top for clarity).
vi.mock("gsap", () => ({
  default: {
    context: () => ({ revert() {} }),
    from: () => {},
  },
}));
vi.mock("./ServerWindowCarousel", () => ({ default: () => null }));
// NOTE: the asset is spelled "ligth" in the source — match it exactly.
vi.mock("../assets/cloud-computing-ligth.png", () => ({ default: "" }));
vi.mock("../assets/cloud-computing-dark.png", () => ({ default: "" }));

import PanelCardGrid from "./PanelCardGrid";
import { getMessages } from "../i18n";

const t = getMessages("es");
const CONFIG_LABEL = t.titleBar.fabConfig; // "Configuración" — abre el drawer
const CLOSE_LABEL = t.dashboard.collapsePanel; // "Colapsar panel" — cierra el drawer

function stubMatchMedia() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function renderGrid() {
  return render(
    <PanelCardGrid
      data={[]}
      filters={[]}
      rowActions={[]}
      language="es"
      onRefresh={() => {}}
      sidebarHeader={<div>PANEL CONTENT</div>}
    />,
  );
}

describe("PanelCardGrid config drawer", () => {
  beforeEach(() => {
    stubMatchMedia();
  });

  it("keeps the drawer content unmounted until the settings button opens it", () => {
    renderGrid();

    // Drawer closed by default: settings button present, content not mounted.
    const settingsBtn = screen.getByLabelText(CONFIG_LABEL);
    expect(settingsBtn).toBeInTheDocument();
    expect(screen.queryByText("PANEL CONTENT")).toBeNull();

    // Open the drawer → content mounts, close (X) button appears.
    fireEvent.click(settingsBtn);
    expect(screen.getByText("PANEL CONTENT")).toBeInTheDocument();
    expect(screen.getByLabelText(CLOSE_LABEL)).toBeInTheDocument();

    // Close it again → content unmounts.
    fireEvent.click(screen.getByLabelText(CLOSE_LABEL));
    expect(screen.queryByText("PANEL CONTENT")).toBeNull();
  });

  it("does not render the settings button when there is no sidebar content (guest mode)", () => {
    render(
      <PanelCardGrid
        data={[]}
        filters={[]}
        rowActions={[]}
        language="es"
        onRefresh={() => {}}
      />,
    );

    expect(screen.queryByLabelText(CONFIG_LABEL)).toBeNull();
  });
});
