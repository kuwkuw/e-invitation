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
  it("offers rather than reports when off", () => {
    render(<NotifyControl enabled={false} onToggle={() => {}} t={auth} />);
    expect(screen.getByText(auth.notifyOffer)).toBeTruthy();
    expect(screen.getByText(auth.notifyOptIn)).toBeTruthy();
  });

  it("states where mail goes, and the way out, when on", () => {
    render(<NotifyControl enabled onToggle={() => {}} t={auth} />);
    expect(screen.getByText(auth.notifyOnAccount)).toBeTruthy();
    expect(screen.getByText(auth.notifyTurnOff)).toBeTruthy();
  });

  // The rule this surface exists to not break. A host who silences their
  // wedding here and finds they silenced their daughter's birthday too presses
  // Spam next, which costs deliverability for everything the product sends —
  // the exact outcome opt-in was adopted to avoid.
  it("says the switch covers the whole account, in both states", () => {
    const off = render(<NotifyControl enabled={false} onToggle={() => {}} t={auth} />);
    expect(off.container.textContent).toContain(auth.notifyAllEvents);
    cleanup();

    const on = render(<NotifyControl enabled onToggle={() => {}} t={auth} />);
    expect(on.container.textContent).toContain(auth.notifyAllEvents);
  });

  it("toggles through the callback", () => {
    const onToggle = vi.fn();
    render(<NotifyControl enabled={false} onToggle={onToggle} t={auth} />);

    fireEvent.click(screen.getByText(auth.notifyOptIn));

    expect(onToggle).toHaveBeenCalledTimes(1);
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

    expect(await screen.findByText(auth.notifyAllEvents)).toBeTruthy();
  });

  // A host who arrived on a pasted manage link has no session, so the
  // session-authorized endpoint behind this control would refuse them. Absent,
  // not disabled — a dead control promises a feature that is not reachable.
  it("shows nothing to a host with no session on this device", async () => {
    stubApi({ signed_in: false, notifications: true });
    renderManage();

    await screen.findByText("Хрестини Даринки");
    expect(screen.queryByText(auth.notifyAllEvents)).toBeNull();
  });

  it("shows nothing where the deployment cannot send mail", async () => {
    stubApi({ signed_in: true, notifications: false });
    renderManage();

    await screen.findByText("Хрестини Даринки");
    expect(screen.queryByText(auth.notifyAllEvents)).toBeNull();
  });
});
