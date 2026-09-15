import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DesignToolbar } from "../src/components/editor/DesignToolbar";
import { UI } from "../src/i18n";
import type { DesignTokens } from "../src/types";

// vite.config.ts sets globals:false, so RTL's auto-cleanup never registers.
afterEach(cleanup);

const design: DesignTokens = {
  palette: "warm",
  typography: "serif",
  layout: "classic",
  ornament: "floral",
};

function renderToolbar(overrides: Partial<Parameters<typeof DesignToolbar>[0]> = {}) {
  return render(
    <DesignToolbar
      design={design}
      labels={UI.uk.design}
      onChange={() => {}}
      background={null}
      {...overrides}
    />,
  );
}

describe("DesignToolbar", () => {
  it("shows one segment per token group and no options until one is opened", () => {
    const { container } = renderToolbar();
    expect(container.querySelectorAll(".cc-seg-item")).toHaveLength(4);
    expect(container.querySelector(".cc-design-sheet")).toBeNull();
  });

  it("opens a sheet for the pressed segment", () => {
    const { container } = renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: UI.uk.design.palette }));
    expect(container.querySelector(".cc-design-sheet")).not.toBeNull();
    // Six palettes, each still reading its colour from its own palette-* class.
    expect(container.querySelectorAll(".swatch")).toHaveLength(6);
    expect(container.querySelector(".swatch.palette-warm")).not.toBeNull();
  });

  it("closes the open sheet when the same segment is pressed again", () => {
    const { container } = renderToolbar();
    const seg = screen.getByRole("button", { name: UI.uk.design.palette });
    fireEvent.click(seg);
    fireEvent.click(seg);
    expect(container.querySelector(".cc-design-sheet")).toBeNull();
  });

  it("reports the chosen token and leaves the sheet open to try another", () => {
    const onChange = vi.fn();
    const { container } = renderToolbar({ onChange });
    fireEvent.click(screen.getByRole("button", { name: UI.uk.design.palette }));
    fireEvent.click(screen.getByRole("button", { name: UI.uk.design.values.festive }));
    expect(onChange).toHaveBeenCalledWith({ palette: "festive" });
    expect(container.querySelector(".cc-design-sheet")).not.toBeNull();
  });

  it("hides the background segment for the minimal palette, which rejects one", () => {
    renderToolbar({
      design: { ...design, palette: "minimal" },
      onBackgroundAdd: () => {},
    });
    expect(screen.queryByRole("button", { name: UI.uk.design.background })).toBeNull();
  });

  it("shows the background segment when a handler exists and the palette allows it", () => {
    renderToolbar({ onBackgroundAdd: () => {} });
    expect(screen.getByRole("button", { name: UI.uk.design.background })).not.toBeNull();
  });
});
