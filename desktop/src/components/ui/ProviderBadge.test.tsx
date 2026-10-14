import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ProviderBadge } from "./ProviderBadge";

describe("ProviderBadge", () => {
  it("renders an invisible spacer for a missing provider", () => {
    const { container } = render(<ProviderBadge provider={null} />);
    const span = container.firstChild as HTMLElement;
    expect(span).toHaveAttribute("aria-hidden", "true");
    expect(span.querySelector("svg")).toBeNull();
  });

  it("renders a spacer (no icon) for email-based methods", () => {
    const { container } = render(<ProviderBadge provider="passkey" />);
    expect(container.querySelector("svg")).toBeNull();
    const recovery = render(<ProviderBadge provider="recovery" />);
    expect(recovery.container.querySelector("svg")).toBeNull();
  });

  it("renders an icon for the google provider", () => {
    const { container } = render(<ProviderBadge provider="google" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders an icon for apple/github/microsoft", () => {
    for (const provider of ["apple", "github", "microsoft"] as const) {
      const { container } = render(<ProviderBadge provider={provider} />);
      expect(container.querySelector("svg")).not.toBeNull();
    }
  });

  it("propagates the badge size CSS variable", () => {
    const { container } = render(<ProviderBadge provider="google" size={24} />);
    const span = container.firstChild as HTMLElement;
    expect(span.style.getPropertyValue("--badge-size")).toBe("24px");
  });
});
