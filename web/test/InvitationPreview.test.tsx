import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InvitationPreview } from "../src/components/InvitationPreview";
import type { DesignTokens, InvitationCopy } from "../src/types";
import { LAYOUTS, ORNAMENTS, PALETTES, TYPOGRAPHIES } from "../src/types";

// The server has the same guarantee for the OG renderer (server/test/og.test.ts
// asserts every token enum has a style); this is the client half of that
// mirror. Design tokens must map 1:1 onto CSS classes — a new enum value with
// no class silently renders an unstyled card.

const copy: InvitationCopy = {
  title: "Ми одружуємось!",
  greeting: "Любі друзі,",
  body: "Запрошуємо вас на свято.",
  details_line: "6 червня, 15:00",
  rsvp_prompt: "Підтвердіть присутність.",
  closing: "Марія та Андрій",
};

const base: DesignTokens = {
  palette: "warm",
  typography: "serif",
  layout: "classic",
  ornament: "floral",
};

function classesOf(design: DesignTokens): string {
  const { container } = render(<InvitationPreview copy={copy} design={design} />);
  return (container.firstElementChild as HTMLElement).className;
}

describe("InvitationPreview token mapping", () => {
  it("emits a class for every palette", () => {
    for (const palette of PALETTES) {
      expect(classesOf({ ...base, palette })).toContain(`palette-${palette}`);
    }
  });

  it("emits a class for every typography, layout and ornament", () => {
    for (const typography of TYPOGRAPHIES) {
      expect(classesOf({ ...base, typography })).toContain(`type-${typography}`);
    }
    for (const layout of LAYOUTS) {
      expect(classesOf({ ...base, layout })).toContain(`layout-${layout}`);
    }
    for (const ornament of ORNAMENTS) {
      expect(classesOf({ ...base, ornament })).toContain(`ornament-${ornament}`);
    }
  });

  it("renders the copy as text, never as markup", () => {
    // The no-model-output-as-HTML rule (adr-003): angle brackets in generated
    // copy must survive as characters.
    render(<InvitationPreview copy={{ ...copy, title: "<b>bold</b>" }} design={base} />);
    expect(screen.getByText("<b>bold</b>")).toBeDefined();
    expect(document.querySelector("b")).toBeNull();
  });
});

describe("InvitationPreview background layer (adr-009)", () => {
  it("composites image + scrim for a normal layout", () => {
    const { container } = render(
      <InvitationPreview copy={copy} design={base} background={{ id: "bg123456" }} />,
    );
    const img = container.querySelector("img.inv-bg") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("/api/backgrounds/bg123456");
    expect(container.querySelector(".inv-scrim")).not.toBeNull();
  });

  it("confines the image to a side panel for the split layout", () => {
    const { container } = render(
      <InvitationPreview
        copy={copy}
        design={{ ...base, layout: "split" }}
        background={{ id: "bg123456" }}
      />,
    );
    expect(container.querySelector("img.inv-panel-img")).not.toBeNull();
    expect(container.querySelector(".inv-scrim")).toBeNull();
  });

  it("drops the background entirely for the minimal palette", () => {
    const { container } = render(
      <InvitationPreview
        copy={copy}
        design={{ ...base, palette: "minimal" }}
        background={{ id: "bg123456" }}
      />,
    );
    expect(container.querySelector("img")).toBeNull();
  });
});
