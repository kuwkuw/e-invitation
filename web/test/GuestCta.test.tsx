import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/api";
import { GuestCta } from "../src/components/guest/GuestCta";
import { GuestPage } from "../src/GuestPage";
import { GUEST } from "../src/i18n";
import type { PublishedInvitation } from "../src/types";

// vite.config.ts sets globals: false, so RTL never auto-cleans.
afterEach(cleanup);

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

function renderCta(lang: "uk" | "en") {
  return render(
    <MemoryRouter>
      <GuestCta t={GUEST[lang]} />
    </MemoryRouter>,
  );
}

describe("GuestCta", () => {
  it("links to the editor carrying the guest referral", () => {
    renderCta("uk");
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/create?ref=guest");
  });

  it("reads as its action, not as the wordmark", () => {
    renderCta("en");
    // The mark is aria-hidden, so the accessible name is the thing the link
    // actually does — "HOSTYMO create your own invitation" would be noise.
    expect(screen.getByRole("link", { name: "Create your own invitation" })).toBeDefined();
  });

  it("speaks the guest's chrome language", () => {
    renderCta("uk");
    expect(screen.getByText("Створіть власне запрошення")).toBeDefined();
    cleanup();

    renderCta("en");
    expect(screen.getByText("Create your own invitation")).toBeDefined();
  });

  it("keeps the wordmark at the whisper it was", () => {
    renderCta("uk");
    // Values inherited from .gr-brand — the DS guest-rsvp intent is that the
    // mark does not get louder when it gains a job (adr-013 §7).
    const mark = screen.getByText("HOSTYMO");
    expect(mark.className).toBe("gr-cta-mark");
    expect(mark.getAttribute("aria-hidden")).toBe("true");
  });
});

const published = {
  id: "abc123",
  version: 1,
  invitation: {
    brief: {
      event_type: "birthday",
      hosts: ["Олена"],
      date: "12 серпня",
      time: "18:00",
      venue: "Кафе «Затишок»",
      city: "Львів",
      tone: "warm",
      language: "uk",
      extra_details: null,
    },
    copy: {
      title: "Запрошення",
      greeting: "Дорогі друзі!",
      body: "Запрошуємо вас.",
      details_line: "12 серпня, 18:00",
      rsvp_prompt: "Підтвердіть присутність.",
      closing: "Олена",
    },
    design: { palette: "warm", typography: "serif", layout: "classic", ornament: "floral" },
    background: null,
  },
} as unknown as PublishedInvitation;

describe("GuestCta on the guest page", () => {
  // adr-013 §7 turns on this property: the native-row treatment was rejected
  // precisely because those rows exist only after an attending RSVP, so one
  // placement covering both states is the thing worth pinning.
  it("is present before and after the guest answers", async () => {
    vi.spyOn(api, "fetchInvitation").mockResolvedValue(published);
    vi.spyOn(api, "submitRsvp").mockResolvedValue({ ok: true });
    vi.spyOn(api, "recordInvitationView").mockImplementation(() => {});

    render(
      <MemoryRouter>
        <GuestPage id="abc123" />
      </MemoryRouter>,
    );

    const cta = { name: GUEST.uk.ctaLine };
    await waitFor(() => expect(screen.getByRole("link", cta)).toBeDefined());

    fireEvent.change(screen.getByPlaceholderText(GUEST.uk.namePlaceholder), {
      target: { value: "Іван" },
    });
    fireEvent.click(screen.getByRole("radio", { name: GUEST.uk.yes }));
    fireEvent.click(screen.getByRole("button", { name: GUEST.uk.send }));

    await waitFor(() => expect(screen.getByText(GUEST.uk.thanksTitle)).toBeDefined());
    expect(screen.getByRole("link", cta)).toBeDefined();
  });

  it("stays off the dead-link page, so every referral has a counted view", async () => {
    vi.spyOn(api, "fetchInvitation").mockRejectedValue(new Error("not found"));
    const beacon = vi.spyOn(api, "recordInvitationView").mockImplementation(() => {});

    render(
      <MemoryRouter>
        <GuestPage id="abc123" />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText(GUEST.uk.notFoundTitle)).toBeDefined());
    // The beacon does not fire for a dead link (PR 2), so a referral from one
    // would be a generation with no view behind it — §7's "one placement"
    // keeps the funnel's two numbers describing the same population.
    expect(beacon).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: GUEST.uk.ctaLine })).toBeNull();
  });
});
