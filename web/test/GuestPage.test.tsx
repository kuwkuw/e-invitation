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

describe("around the card (adr-019 §5.2, §9.4)", () => {
  beforeEach(() => asReturningGuest());

  // Only Date is faked, so the mocked fetch and RTL's polling still run.
  function today(date: Date) {
    vi.useFakeTimers({ now: date, toFake: ["Date"] });
  }

  it("pins the details and a way to the reply above the card", async () => {
    renderPage();
    const reply = await screen.findByRole("link", { name: t.reply });
    expect(reply.getAttribute("href")).toBe("#rsvp");
    expect(document.getElementById("rsvp")).not.toBeNull();

    const bar = reply.closest(".gr-bar") as HTMLElement;
    expect(bar.querySelector(".gr-bar-when")?.textContent).toBe("12 серпня, 18:00");
    expect(bar.querySelector(".gr-bar-where")?.textContent).toBe("Кафе «Затишок», Львів");
    expect(bar.querySelector(".seal")?.textContent).toBe("О&А");
  });

  it("joins a third line onto the venue line, and drops it when there is one line", async () => {
    renderPage(guestFixture({}, { details_line: "12 серпня\n18:00\nЛьвів" }));
    await screen.findByRole("link", { name: t.reply });
    expect(document.querySelector(".gr-bar-where")?.textContent).toBe("18:00 · Львів");
    cleanup();

    renderPage(guestFixture({}, { details_line: "12 серпня, 18:00, Львів" }));
    await screen.findByRole("link", { name: t.reply });
    expect(document.querySelector(".gr-bar-where")).toBeNull();
  });

  it("counts down the days to a date that parses", async () => {
    today(new Date(2026, 6, 31, 12));
    renderPage();
    expect(await screen.findByText("До свята 12 днів")).toBeDefined();
  });

  it("says so on the day itself", async () => {
    today(new Date(2026, 7, 12, 10));
    renderPage();
    expect(await screen.findByText(t.countdownToday)).toBeDefined();
  });

  it("counts nothing once the day has passed, or when the date doesn't parse", async () => {
    today(new Date(2026, 7, 13, 10));
    renderPage();
    await screen.findByRole("link", { name: t.reply });
    expect(document.querySelector(".gr-countdown")).toBeNull();
    cleanup();

    renderPage(guestFixture({ date: "скоро" }));
    await screen.findByRole("link", { name: t.reply });
    expect(document.querySelector(".gr-countdown")).toBeNull();
  });

  // FR-4.5, amended: the calendar no longer waits for a yes.
  it("offers «У календар» before any reply, when the date parses", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: t.addToCalendar })).toBeDefined();
    expect(screen.getByRole("button", { name: t.send })).toBeDefined();
    cleanup();

    renderPage(guestFixture({ date: "скоро" }));
    await screen.findByRole("link", { name: t.reply });
    expect(screen.queryByRole("button", { name: t.addToCalendar })).toBeNull();
  });

  it("links «Маршрут» to a maps search for the venue and city, and only when there is one", async () => {
    renderPage();
    const route = await screen.findByRole("link", { name: t.route });
    expect(route.getAttribute("href")).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Кафе «Затишок», Львів")}`,
    );
    cleanup();

    renderPage(guestFixture({ venue: null, city: null }));
    await screen.findByRole("link", { name: t.reply });
    expect(screen.queryByRole("link", { name: t.route })).toBeNull();
  });
});
