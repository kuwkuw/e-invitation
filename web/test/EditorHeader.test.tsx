import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { EditorHeader, repliesLine } from "../src/components/editor/EditorHeader";
import { UI } from "../src/i18n";
import type { RsvpCounts } from "../src/types";

// vite.config.ts sets globals:false, so RTL's auto-cleanup never registers.
afterEach(cleanup);

const PUBLISHED = { id: "abc123", version: 1, manage_token: "f".repeat(32) };

function renderHeader(
  overrides: { published?: typeof PUBLISHED | null; counts?: RsvpCounts | null } = {},
) {
  return render(
    <MemoryRouter>
      <EditorHeader
        title="Весілля Марії та Андрія"
        monogram="М&А"
        published={overrides.published === undefined ? PUBLISHED : overrides.published}
        counts={overrides.counts ?? null}
        onBack={() => {}}
        t={UI.uk.chat}
      >
        <button type="button">Publish</button>
      </EditorHeader>
    </MemoryRouter>,
  );
}

describe("the editor's header (adr-019 §7.2)", () => {
  it("seals the bar with the hosts' monogram beside the title", () => {
    const { container } = renderHeader({ published: null });
    const seal = container.querySelector(".cc-header .seal");
    expect(seal?.textContent).toBe("М&А");
    // Decoration: the title says the same thing in words.
    expect(seal?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector(".cc-title")?.textContent).toBe("Весілля Марії та Андрія");
  });

  it("keeps the controls it is handed on the right", () => {
    const { container } = renderHeader({ published: null });
    expect(container.querySelector(".cc-header-right button")?.textContent).toBe("Publish");
  });

  it("offers no replies link before the first publish", () => {
    renderHeader({ published: null });
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("links to the dashboard with the replies so far, headcount first", () => {
    renderHeader({ counts: { yes: 7, no: 3, maybe: 2, guests: 16 } });
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/manage/abc123");
    expect(link.textContent).toBe("16 буде · 3 ні · 2 можливо");
    expect(link.getAttribute("aria-label")).toBe("Відповіді: 16 буде · 3 ні · 2 можливо");
  });

  // adr-012 §6: the counts are decoration, and the link is never blank.
  it("still links to the dashboard when the counts never arrive", () => {
    renderHeader({ counts: null });
    expect(screen.getByRole("link").textContent).toBe(UI.uk.chat.repliesLink);
  });
});

describe("repliesLine", () => {
  const t = UI.uk.chat;

  it("leaves out an answer nobody gave", () => {
    expect(repliesLine({ yes: 2, no: 0, maybe: 0, guests: 4 }, t)).toBe("4 буде");
    expect(repliesLine({ yes: 0, no: 2, maybe: 0, guests: 0 }, t)).toBe("2 ні");
  });

  // adr-019 §9.1: a maybe is a reply, and never part of the headcount.
  it("counts a maybe beside the headcount, never in it", () => {
    expect(repliesLine({ yes: 0, no: 0, maybe: 1, guests: 0 }, t)).toBe("1 можливо");
  });

  it("says so when no one has replied", () => {
    expect(repliesLine({ yes: 0, no: 0, maybe: 0, guests: 0 }, t)).toBe(t.repliesNone);
  });

  it("names the link when the counts are unknown", () => {
    expect(repliesLine(null, t)).toBe(t.repliesLink);
  });

  it("reads in English too", () => {
    expect(repliesLine({ yes: 7, no: 3, maybe: 2, guests: 16 }, UI.en.chat)).toBe(
      "16 coming · 3 no · 2 maybe",
    );
  });
});
