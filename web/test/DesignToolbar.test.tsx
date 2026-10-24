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
      envelope={{ title: "Весілля", monogram: "М&А", hasHosts: true }}
      {...overrides}
    />,
  );
}

describe("DesignToolbar", () => {
  it("shows one tab per group and no options until one is opened", () => {
    const { container } = renderToolbar();
    expect(container.querySelectorAll(".cc-tab")).toHaveLength(4);
    expect(container.querySelector(".cc-design-sheet")).toBeNull();
  });

  it("opens a sheet for the pressed tab", () => {
    const { container } = renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: UI.uk.design.palette }));
    expect(container.querySelector(".cc-design-sheet")).not.toBeNull();
    // Six palettes, each still reading its colour from its own palette-* class.
    expect(container.querySelectorAll(".swatch")).toHaveLength(6);
    expect(container.querySelector(".swatch.palette-warm")).not.toBeNull();
  });

  it("closes the open sheet when the same tab is pressed again", () => {
    const { container } = renderToolbar();
    const tab = screen.getByRole("button", { name: UI.uk.design.palette });
    fireEvent.click(tab);
    fireEvent.click(tab);
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

  it("hides the background tab for the minimal palette, which rejects one", () => {
    renderToolbar({
      design: { ...design, palette: "minimal" },
      onBackgroundAdd: () => {},
    });
    expect(screen.queryByRole("button", { name: UI.uk.design.background })).toBeNull();
  });

  it("shows the background tab when a handler exists and the palette allows it", () => {
    renderToolbar({ onBackgroundAdd: () => {} });
    expect(screen.getByRole("button", { name: UI.uk.design.background })).not.toBeNull();
  });
});

describe("DesignToolbar tabs (adr-019 §7.3)", () => {
  it("names five tabs, with ornament inside «Макет»", () => {
    const { container } = renderToolbar({ onBackgroundAdd: () => {} });
    const tabs = [...container.querySelectorAll(".cc-tab")].map((tab) => tab.textContent);
    expect(tabs).toEqual(["Палітра", "Шрифт", "Макет", "Конверт", "Фон"]);
  });

  it("opens composition and ornament together under «Макет»", () => {
    const onChange = vi.fn();
    renderToolbar({ onChange });
    fireEvent.click(screen.getByRole("button", { name: UI.uk.design.layoutTab }));
    expect(screen.getByRole("group", { name: UI.uk.design.layout })).toBeTruthy();
    expect(screen.getByRole("group", { name: UI.uk.design.ornament })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Геометричний/ }));
    expect(onChange).toHaveBeenCalledWith({ ornament: "geometric" });
  });

  // Disclosures, not ARIA tabs: none is open at rest, and a second press closes.
  it("expands and collapses rather than selecting", () => {
    renderToolbar();
    const tab = screen.getByRole("button", { name: UI.uk.design.palette });
    expect(tab.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("tab")).toBeNull();
    fireEvent.click(tab);
    expect(tab.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(tab);
    expect(tab.getAttribute("aria-expanded")).toBe("false");
  });

  // The override is deferred (adr-019 §9.2), so the tab shows and never asks.
  it("shows the envelope guests open, with the hosts' seal, and no input", () => {
    const { container } = renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: UI.uk.design.envelope }));
    const sheet = container.querySelector(".cc-design-sheet") as HTMLElement;
    expect(sheet.querySelector(".cc-env-to")?.textContent).toBe("Весілля");
    expect(sheet.querySelector(".cc-env .seal")?.textContent).toBe("М&А");
    expect(sheet.querySelector("input, textarea, select, button")).toBeNull();
    expect(sheet.textContent).toContain(UI.uk.design.envelopeNote);
  });

  it("says where the seal comes from when no host is named", () => {
    renderToolbar({ envelope: { title: "Свято", monogram: "I", hasHosts: false } });
    fireEvent.click(screen.getByRole("button", { name: UI.uk.design.envelope }));
    expect(screen.getByText(UI.uk.design.envelopeNoHosts)).toBeTruthy();
    expect(screen.queryByText(UI.uk.design.envelopeNote)).toBeNull();
  });
});
