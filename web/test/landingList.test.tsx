import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordHostInvitation } from "../src/hostInvitations";
import { AUTH, LANDING } from "../src/i18n";
import { LandingPage } from "../src/LandingPage";
import { forgetHeldManageTokens } from "../src/manageTokens";

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

  it("renders the local list unchanged for a signed-out host", async () => {
    recordHostInvitation({
      id: "zzz999",
      title: "Хрестини Даринки",
      published_at: "2026-06-01T00:00:00.000Z",
      palette: "festive",
    });
    stubApi({ signedIn: false });
    renderLanding();

    expect(await screen.findByText("Хрестини Даринки", inList)).toBeTruthy();
    // No keyring answered, so nothing claims this browser holds anything else.
    expect(screen.queryByText("Весілля Марії та Андрія", inList)).toBeNull();
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

  // DS LandingSignedOut: left of the language switcher, never beside Create.
  // Next to the accent it reads as that button's caption — "create… or sign
  // in?" — where on the far side it belongs to the chrome group instead.
  it("sits with the chrome, not beside the call to action", async () => {
    stubApi({ signedIn: false });
    const { container } = renderLanding();
    await screen.findByText(label);

    const order = [...(container.querySelector(".lp-nav-right")?.children ?? [])].map(
      (el) => el.className.split(" ")[0],
    );
    expect(order[0]).toBe("lp-nav-signin");
    expect(order[order.length - 1]).toBe("lp-cta");
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
