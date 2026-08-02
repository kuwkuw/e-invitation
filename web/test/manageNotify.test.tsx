import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotifyControl } from "../src/components/manage/NotifyControl";
import { AUTH } from "../src/i18n";
import { ManagePage } from "../src/ManagePage";
import { forgetHeldManageTokens, manageTokenKey } from "../src/manageTokens";

/**
 * Reply email on the host dashboard (adr-015 §7, amended).
 *
 * Two rules carry the weight here, and neither is about the switch working:
 * the control must say it governs the whole account, on a page about one
 * event; and it must be **absent** rather than disabled for a host who cannot
 * reach it, because the preference endpoints are session-authorized while this
 * page is authorized by a manage token.
 */

afterEach(cleanup);

const auth = AUTH.en;
const ID = "abc123xy";
const TOKEN = "a".repeat(32);

describe("NotifyControl", () => {
  function renderControl(enabled: boolean, onToggle = () => {}) {
    return render(
      <NotifyControl enabled={enabled} onToggle={onToggle} email="host@example.com" t={auth} />,
    );
  }

  it("names the setting identically in both states", () => {
    const off = renderControl(false);
    expect(off.container.querySelector(".notify-name")?.textContent).toBe(auth.notifyOptIn);
    cleanup();
    const on = renderControl(true);
    expect(on.container.querySelector(".notify-name")?.textContent).toBe(auth.notifyOptIn);
  });

  // The rule this surface exists to not break, and it now lives inside the
  // line a host actually reads rather than in a caveat beneath it.
  it("names the boundary against this event, in the state row", () => {
    const on = renderControl(true);
    expect(on.container.querySelector(".notify-state")?.textContent).toBe(
      "To host@example.com — for all your invitations, not just this one.",
    );
    cleanup();
    const off = renderControl(false);
    expect(off.container.querySelector(".notify-state")?.textContent).toBe(
      "Not emailing you right now — about any of your invitations.",
    );
  });

  // If the text reads correctly without knowing which event is open, the
  // control has not annexed the surface.
  it("says nothing about the event it sits on", () => {
    const { container } = renderControl(true);
    expect(container.textContent).not.toContain("Хрестини");
    expect(container.textContent?.toLowerCase()).not.toContain("this invitation");
  });

  it("toggles through the callback", () => {
    const onToggle = vi.fn();
    const { container } = renderControl(false, onToggle);
    fireEvent.click(container.querySelector(".notify-input") as HTMLElement);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("is the same control the share panel uses", () => {
    const { container } = renderControl(false);
    expect(container.querySelector("label.notify-check input[type=checkbox]")).toBeTruthy();
    expect(container.querySelector(".hm-notify-toggle")).toBeNull();
  });
});

describe("the manage page's notification control", () => {
  function stubApi(session: { signed_in: boolean; notifications: boolean }) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const json = (body: unknown) =>
          ({ ok: true, status: 200, json: async () => body }) as Response;
        if (url.includes("/api/auth/session")) {
          return json({
            configured: true,
            signed_in: session.signed_in,
            email: session.signed_in ? "host@example.com" : null,
            publish_gate: true,
            notifications: session.notifications,
          });
        }
        if (url.includes("/api/account/keyring")) return json({ invitations: [] });
        if (url.includes("/api/account/notifications")) return json({ enabled: true });
        if (url.includes("/rsvps")) {
          return json({ rsvps: [], counts: { yes: 0, no: 0, guests: 0 } });
        }
        if (url.includes(`/api/invitations/${ID}`)) {
          return json({
            id: ID,
            version: 1,
            invitation: {
              copy: {
                title: "Хрестини Даринки",
                greeting: "",
                body: "",
                details_line: "",
                rsvp_prompt: "",
                closing: "",
              },
              design: {
                palette: "warm",
                typography: "serif",
                layout: "classic",
                ornament: "none",
              },
            },
          });
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );
  }

  function renderManage() {
    return render(
      <MemoryRouter initialEntries={[`/manage/${ID}`]}>
        <ManagePage id={ID} />
      </MemoryRouter>,
    );
  }

  beforeEach(() => {
    localStorage.clear();
    forgetHeldManageTokens();
    // The dashboard only renders with a token; this page is authorized by it.
    localStorage.setItem(manageTokenKey(ID), TOKEN);
    // The page picks its own language, and the assertions below name English
    // strings — without this they would assert absence in Ukrainian and pass
    // for the wrong reason.
    localStorage.setItem("inv-ui-lang", "en");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("offers the control to a signed-in host", async () => {
    stubApi({ signed_in: true, notifications: true });
    renderManage();

    expect(await screen.findByText(auth.notifyOptIn)).toBeTruthy();
  });

  // A host who arrived on a pasted manage link has no session, so the
  // session-authorized endpoint behind this control would refuse them. Absent,
  // not disabled — a dead control promises a feature that is not reachable.
  it("shows nothing to a host with no session on this device", async () => {
    stubApi({ signed_in: false, notifications: true });
    renderManage();

    await screen.findByText("Хрестини Даринки");
    expect(screen.queryByText(auth.notifyOptIn)).toBeNull();
  });

  it("shows nothing where the deployment cannot send mail", async () => {
    stubApi({ signed_in: true, notifications: false });
    renderManage();

    await screen.findByText("Хрестини Даринки");
    expect(screen.queryByText(auth.notifyOptIn)).toBeNull();
  });
});
