import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordHostInvitation } from "../src/hostInvitations";
import { AUTH, LANDING } from "../src/i18n";
import { LandingPage } from "../src/LandingPage";
import { forgetHeldManageTokens, manageTokenKey } from "../src/manageTokens";

/**
 * The seed-to-render path (adr-014 §5, as amended).
 *
 * The landing list used to read `inv-invitations` once, synchronously, in a
 * `useState` initializer, while the keyring fetch that fills it lands after
 * that render. Nothing re-read it, so a signed-in host on a device that had
 * never published saw an empty list until they reloaded — the cross-device
 * event list FR-11 shipped, reachable only by pressing refresh.
 *
 * These tests drive the page rather than the hook because that gap lived
 * precisely in the seam between them: both halves worked.
 */

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

/** Every call the landing page makes. Counts and notifications are decorative
 *  here — they must never decide whether the list appears. */
function stubApi(options: { signedIn: boolean; keyring?: unknown[]; configured?: boolean }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/session")) {
        return jsonResponse({
          configured: options.configured ?? true,
          signed_in: options.signedIn,
          email: options.signedIn ? "host@example.com" : null,
          publish_gate: true,
          notifications: true,
        });
      }
      if (url.includes("/api/account/keyring")) {
        return jsonResponse({ invitations: options.keyring ?? [] });
      }
      if (url.includes("/api/account/notifications")) return jsonResponse({ enabled: true });
      if (url.includes("/api/invitations/counts")) return jsonResponse({ results: [] });
      throw new Error(`unexpected fetch: ${url}`);
    }),
  );
}

const keyringEntry = {
  id: "abc123xy",
  manage_token: "0123456789abcdef0123456789abcdef",
  title: "Весілля Марії та Андрія",
  published_at: "2026-07-01T00:00:00.000Z",
  palette: "romantic" as const,
};

/** Scoped to the list's own title element on purpose: the landing page also
 *  renders three sample invitations in its hero, so a bare text query can match
 *  showcase copy and pass — or collide — for reasons that have nothing to do
 *  with what a host published. */
const inList = { selector: ".lp-yours-title" } as const;

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  forgetHeldManageTokens();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the returning host's landing list", () => {
  it("shows the account's invitations on a device that has published nothing", async () => {
    stubApi({ signedIn: true, keyring: [keyringEntry] });
    renderLanding();

    // The bug this covers: present after the keyring lands, with no reload.
    expect(await screen.findByText("Весілля Марії та Андрія", inList)).toBeTruthy();
  });

  it("keeps an invitation this browser published but the account does not hold", async () => {
    // Published before this browser ever signed in — in no keyring, and the
    // host can see it today. Rendering the keyring alone would take it away.
    recordHostInvitation({
      id: "zzz999",
      title: "Хрестини Даринки",
      published_at: "2026-06-01T00:00:00.000Z",
      palette: "festive",
    });
    stubApi({ signedIn: true, keyring: [keyringEntry] });
    renderLanding();

    expect(await screen.findByText("Весілля Марії та Андрія", inList)).toBeTruthy();
    expect(screen.getByText("Хрестини Даринки", inList)).toBeTruthy();
  });

  // The list is the view of whichever store owns the identity (DS
  // `LandingListIsAccount`). Publishing already requires an account, so a list
  // rendered to someone without one is a second source of truth about "your
  // events" that contradicts the first.
  it("does not show the list to a signed-out host where accounts exist", async () => {
    recordHostInvitation({
      id: "zzz999",
      title: "Хрестини Даринки",
      published_at: "2026-06-01T00:00:00.000Z",
      palette: "festive",
    });
    stubApi({ signedIn: false });
    renderLanding();

    // The page is the first-time visitor's page: it begins at the pitch.
    await screen.findByText(LANDING.uk.heroTitle);
    expect(screen.queryByText("Хрестини Даринки", inList)).toBeNull();
    expect(document.querySelector(".lp-yours")).toBeNull();
  });

  // §7: no OAuth client means no accounts, so there is no "signed out" state
  // to be in — the identity is the browser and the list is the browser's. The
  // rule does not make an exception here, it points at the other store.
  it("shows the browser's list where accounts cannot exist", async () => {
    recordHostInvitation({
      id: "zzz999",
      title: "Хрестини Даринки",
      published_at: "2026-06-01T00:00:00.000Z",
      palette: "festive",
    });
    stubApi({ signedIn: false, configured: false });
    renderLanding();

    expect(await screen.findByText("Хрестини Даринки", inList)).toBeTruthy();
    // And no subtitle: with no account to contrast against, "on this device"
    // would describe the only state there is.
    expect(document.querySelector(".lp-yours-sub")).toBeNull();
  });
});

describe("the landing sign-in link", () => {
  const label = AUTH.uk.signInLink;

  it("offers a signed-out host a way in that is not the publish gate", async () => {
    stubApi({ signedIn: false });
    renderLanding();

    const link = await screen.findByText(label);
    // Back to the landing page, not to /create: the host came here for their
    // list, and the server guards this value before it reaches a Location.
    expect(link.getAttribute("href")).toBe("/api/auth/google?redirect_to=%2F");
  });

  // The card no longer renders for them, so the door is the only place the
  // page can admit their events exist. A fact about what is already in this
  // browser, not an offer — and it disappears on sign-in because the list
  // replaces it (DS `LandingListIsAccount`, case 1).
  it("counts what this browser holds once the card is gone", async () => {
    localStorage.setItem(manageTokenKey("zzz999"), "0123456789abcdef0123456789abcdef");
    localStorage.setItem(manageTokenKey("yyy888"), "fedcba9876543210fedcba9876543210");
    stubApi({ signedIn: false });
    renderLanding();

    // Asserted on the raw text, not through a text matcher: the separator is
    // thin-spaced (U+2009) and RTL normalizes whitespace in the DOM but not in
    // the string it is matched against, so an exact query could never pass.
    const link = await screen.findByText(label, { exact: false });
    expect(link.textContent).toBe(AUTH.uk.navMyInvitationsCount.replace("{n}", "2"));
  });

  it("shows a first-time visitor the plain link, never a zero", async () => {
    // Nothing held, so the branch carrying the number does not render at all —
    // which is what keeps the link costing a newcomer no attention.
    stubApi({ signedIn: false });
    renderLanding();

    expect(await screen.findByText(label)).toBeTruthy();
    expect(document.querySelector(".lp-nav-counted")).toBeNull();
  });

  it("makes no room for a count it does not render", async () => {
    // Where sign-in is unavailable there is no link and so no count — and the
    // wordmark must not give up size for something nobody sees.
    localStorage.setItem(manageTokenKey("zzz999"), "0123456789abcdef0123456789abcdef");
    stubApi({ signedIn: false, configured: false });
    renderLanding();

    await screen.findByText(LANDING.uk.heroTitle);
    expect(document.querySelector(".lp-nav-counted")).toBeNull();
  });

  it("does not offer sign-in to a host already signed in", async () => {
    stubApi({ signedIn: true, keyring: [keyringEntry] });
    renderLanding();

    await screen.findByText("Весілля Марії та Андрія", inList);
    expect(screen.queryByText(label)).toBeNull();
  });

  it("shows nothing at all where there is no OAuth client", async () => {
    // adr-014 §7: not a disabled control — there is no feature to offer.
    stubApi({ signedIn: false, configured: false });
    renderLanding();

    await screen.findByText(LANDING.uk.heroTitle);
    expect(screen.queryByText(label)).toBeNull();
  });

  it("renders no link while the session is still unknown", async () => {
    // A link that appears and then vanishes for a signed-in host is worse than
    // one that arrives a beat late.
    stubApi({ signedIn: true, keyring: [] });
    renderLanding();
    expect(screen.queryByText(label)).toBeNull();
  });
});
