import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PreviewPanel } from "../src/components/editor/PreviewPanel";
import { UI } from "../src/i18n";
import { guestFixture } from "./guestFixture";

// vite.config.ts sets globals:false, so RTL's auto-cleanup never registers.
afterEach(cleanup);

function renderPreview() {
  return render(
    <PreviewPanel
      invitation={guestFixture().invitation}
      generating={false}
      activeField={null}
      onFieldClick={() => {}}
      onDesignChange={() => {}}
      backgroundBusy={false}
      onBackgroundAdd={() => {}}
      onBackgroundRemove={() => {}}
      t={UI.uk}
    />,
  );
}

describe("the editor's canvas (adr-019 §7.1)", () => {
  it("sets the card on the deckled mat, as the guest receives it", () => {
    const { container } = renderPreview();
    const mat = container.querySelector(".cc-mat > .deckle");
    expect(mat?.querySelector(".inv")).toBeTruthy();
  });

  // The roadmap's sticky bug: as the scroller's first child the toolbar never
  // pinned and scrolled away. After the card, it sticks to the pane's bottom.
  it("puts the design controls after the card", () => {
    const { container } = renderPreview();
    const inner = container.querySelector(".cc-preview-inner") as HTMLElement;
    const kids = [...inner.children].map((el) => el.className);
    expect(kids[0]).toContain("cc-mat");
    expect(kids.at(-1)).toContain("cc-design");
  });
});
