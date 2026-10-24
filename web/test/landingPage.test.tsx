import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LANDING } from "../src/i18n";
import { LandingPage } from "../src/LandingPage";
import { forgetHeldManageTokens } from "../src/manageTokens";

/**
 * The landing page's own sections on paper (adr-019 §6). The returning-host
 * list and the sign-in link have their own file (`landingList.test.tsx`).
 */

/** A first-time visitor: signed out, nothing held. Any request but the session
 *  throws, so a section that starts fetching (a count for the stat strip, say)
 *  fails here rather than shipping a request nobody decided on. */
function stubSession() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/session")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            configured: true,
            signed_in: false,
            email: null,
            publish_gate: true,
            notifications: true,
          }),
        } as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    }),
  );
}

function renderLanding(entry = "/") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/create" element={<p>editor</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  forgetHeldManageTokens();
  stubSession();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const t = LANDING.uk;

describe("the hero composer (adr-019 §6.1)", () => {
  it("types the whole sentence from one text node, so crawlers and screen readers get all of it", () => {
    const { container } = renderLanding();
    const typing = container.querySelector(".lp-composer .lp-typing");
    expect(typing?.textContent).toBe(t.heroSentence);
    expect(typing?.childNodes).toHaveLength(1);
  });

  it("labels the box an example, with the call to action as its only control", () => {
    const { container } = renderLanding();
    const composer = container.querySelector(".lp-composer") as HTMLElement;
    expect(composer.querySelector(".lp-composer-label")?.textContent).toBe(t.composerLabel);
    const controls = [...composer.querySelectorAll("a, button, input, textarea")];
    expect(controls.map((el) => el.textContent)).toEqual([t.cta]);
  });

  it("starts the editor from the composer's button", () => {
    const { container } = renderLanding();
    fireEvent.click(container.querySelector(".lp-composer .lp-cta") as HTMLElement);
    expect(screen.getByText("editor")).toBeTruthy();
  });

  it("gains the differentiator under the headline, and says it's free under the composer", () => {
    renderLanding();
    expect(screen.getByText(t.heroPromise)).toBeTruthy();
    expect(screen.getByText(t.composerNote)).toBeTruthy();
  });
});

describe("the hero stage (adr-019 §6.1)", () => {
  it("raises one invitation, the composer's, on the deckled mat on a grained table", () => {
    const { container } = renderLanding();
    const stage = container.querySelector(".lp-stage") as HTMLElement;
    expect(stage.getAttribute("aria-hidden")).toBe("true");
    expect(stage.className).toMatch(/\bgrain\b/);
    const cards = stage.querySelectorAll(".lp-stage-card > .deckle > .inv");
    expect(cards).toHaveLength(1);
    expect(cards[0].querySelector(".inv-title")?.textContent).toBe(t.sample.title);
    // The fan's other two are gone; range lives in the gallery.
    expect(container.querySelectorAll(".inv")).toHaveLength(1);
  });

  it("seals the envelope with the sample couple's monogram, in both languages", () => {
    const { container, unmount } = renderLanding();
    expect(container.querySelector(".lp-stage .seal")?.textContent).toBe("М&А");
    unmount();
    const en = renderLanding("/?lang=en");
    expect(en.container.querySelector(".lp-stage .seal")?.textContent).toBe("M&A");
  });
});
