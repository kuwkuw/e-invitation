import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/api";
import { GuestPage } from "../src/GuestPage";
import { ENVELOPE_MS } from "../src/hooks/useEnvelope";
import { GUEST } from "../src/i18n";
import type { PublishedInvitation } from "../src/types";
import { asReturningGuest, guestFixture } from "./guestFixture";

// vite.config.ts sets globals: false, so RTL never auto-cleans.
afterEach(cleanup);
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query }));
});

const t = GUEST.uk;

function renderPage(published: PublishedInvitation = guestFixture()) {
  vi.spyOn(api, "fetchInvitation").mockResolvedValue(published);
  const beacon = vi.spyOn(api, "recordInvitationView").mockImplementation(() => {});
  const view = render(
    <MemoryRouter>
      <GuestPage id="abc123" />
    </MemoryRouter>,
  );
  const page = () => view.container.querySelector(".gr-page") as HTMLElement;
  return { ...view, beacon, page };
}

describe("the envelope (adr-019 §5.1)", () => {
  it("greets a first open with the title, the hosts' seal and a way to skip", async () => {
    const { page } = renderPage();

    expect(await screen.findByRole("dialog", { name: "Запрошення" })).toBeDefined();
    const seal = screen.getByRole("button", { name: t.openInvitation });
    expect(seal.textContent).toBe("О&А");
    expect(screen.getByRole("button", { name: t.skip })).toBeDefined();
    // The form behind it can't be tabbed to or read out while it is hidden.
    expect(page().hasAttribute("inert")).toBe(true);
  });

  it("takes focus, so a keyboard or a screen reader starts on the seal", async () => {
    renderPage();
    const seal = await screen.findByRole("button", { name: t.openInvitation });
    expect(document.activeElement).toBe(seal);
  });

  for (const [how, act_] of [
    ["the seal", () => fireEvent.click(screen.getByRole("button", { name: t.openInvitation }))],
    ["«Пропустити»", () => fireEvent.click(screen.getByRole("button", { name: t.skip }))],
    [
      "Escape",
      () =>
        fireEvent.keyDown(screen.getByRole("button", { name: t.openInvitation }), {
          key: "Escape",
        }),
    ],
  ] as const) {
    it(`opens from ${how}, and leaves the page live within 1.2 s`, async () => {
      const { page } = renderPage();
      await screen.findByRole("dialog");
      vi.useFakeTimers();

      act_();
      expect(page().dataset.rising).toBeDefined();
      act(() => vi.advanceTimersByTime(ENVELOPE_MS));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(page().hasAttribute("inert")).toBe(false);
      expect(page().dataset.rising).toBeUndefined();
    });
  }

  it("stays away for a returning guest", async () => {
    asReturningGuest();
    const { page } = renderPage();

    expect(await screen.findByRole("button", { name: t.send })).toBeDefined();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(page().hasAttribute("inert")).toBe(false);
  });

  it("stays away under reduced motion", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
    }));
    renderPage();

    expect(await screen.findByRole("button", { name: t.send })).toBeDefined();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // adr-013's denominator is views on load. The envelope must not move it to
  // views on open.
  it("leaves the view counted on load, before anyone touches it", async () => {
    const { beacon } = renderPage();
    await screen.findByRole("dialog");
    expect(beacon).toHaveBeenCalledTimes(1);
  });

  it("falls back to the product's letter when no host is named", async () => {
    renderPage(guestFixture({ hosts: [] }));
    const seal = await screen.findByRole("button", { name: t.openInvitation });
    expect(seal.textContent).toBe("I");
  });
});
