import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UserAvatar, getInitials } from "./Avatar";

describe("getInitials", () => {
  it("returns ? for empty input", () => {
    expect(getInitials()).toBe("?");
    expect(getInitials("", "")).toBe("?");
  });

  it("uses first+last initial for multi-part names", () => {
    expect(getInitials("Ada Lovelace")).toBe("AL");
  });

  it("uses first two letters for a single-part name", () => {
    expect(getInitials("Ada")).toBe("AD");
  });

  it("splits on dots/underscores/dashes (e.g. emails)", () => {
    // Only [\s._-] are separators; '@' is not, so the last part is "com".
    expect(getInitials(null, "ada.lovelace@example.com")).toBe("AC");
    expect(getInitials("ada_b")).toBe("AB");
  });

  it("prefers name over email", () => {
    expect(getInitials("Grace Hopper", "ada@x.com")).toBe("GH");
  });
});

describe("UserAvatar", () => {
  it("renders the photo when src is provided", () => {
    render(<UserAvatar src="https://example.com/a.png" name="Ada Lovelace" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/a.png");
    expect(img).toHaveAttribute("alt", "Ada Lovelace");
  });

  it("shows the initials fallback when there is no src", () => {
    render(<UserAvatar name="Ada Lovelace" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("AL")).toBeInTheDocument();
  });

  it("falls back to initials when the image fails to load", () => {
    render(<UserAvatar src="https://example.com/broken.png" name="Ada Lovelace" />);
    const img = screen.getByRole("img");
    fireEvent.error(img);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("AL")).toBeInTheDocument();
  });

  it("applies the size CSS variable", () => {
    const { container } = render(<UserAvatar name="Ada" size={48} />);
    const span = container.querySelector(".lxp-avatar") as HTMLElement;
    expect(span.style.getPropertyValue("--avatar-size")).toBe("48px");
  });
});
