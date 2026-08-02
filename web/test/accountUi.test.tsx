import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountFooter } from "../src/components/AccountFooter";
import { DeleteAccountSheet } from "../src/components/DeleteAccountSheet";
import { YourInvitations } from "../src/components/YourInvitations";
import type { HostInvitation } from "../src/hostInvitations";
import { AUTH, LANDING } from "../src/i18n";

afterEach(cleanup);

const t = LANDING.en;
const auth = AUTH.en;

const invitations: HostInvitation[] = [
  {
    id: "aaa111",
    title: "Milana turns 7",
    published_at: "2026-07-20T00:00:00.000Z",
    palette: "warm",
  },
  {
    id: "bbb222",
    title: "Maria & Andrii",
    published_at: "2026-07-10T00:00:00.000Z",
    palette: "festive",
  },
];

function renderList(props: Partial<Parameters<typeof YourInvitations>[0]> = {}) {
  return render(
    <MemoryRouter>
      <YourInvitations invitations={invitations} t={t} auth={auth} {...props} />
    </MemoryRouter>,
  );
}

describe("returning-host list", () => {
  // adr-014, DS `LandingSignedInStates`: today's signed-out variant is
  // untouched. No sign-in offer here — that would be an advertisement where a
  // host simply wants their list.
  it("is unchanged when signed out", () => {
    renderList();
    expect(screen.getByText("Milana turns 7")).toBeTruthy();
    expect(screen.queryByText(auth.signOut)).toBeNull();
    expect(screen.queryByText(auth.crossDevice)).toBeNull();
    expect(screen.queryByText(auth.deleteAccount)).toBeNull();
  });

  it("renders nothing at all when there is nothing and no account", () => {
    const { container } = render(
      <MemoryRouter>
        <YourInvitations invitations={[]} t={t} auth={auth} />
      </MemoryRouter>,
    );
    expect(container.textContent).toBe("");
  });

  // §7: a deployment with no OAuth client shows no account surface whatsoever
  // — not a disabled one, which would promise a feature that isn't there.
  it("renders nothing about accounts when sign-in is unavailable", () => {
    const { container } = render(
      <MemoryRouter>
        <YourInvitations invitations={[]} signedIn={false} footer={null} t={t} auth={auth} />
      </MemoryRouter>,
    );
    expect(container.textContent).toBe("");
  });

  it("carries the account footer and the one cross-device line when signed in", () => {
    renderList({
      signedIn: true,
      footer: <AccountFooter email="olena@example.com" onSignOut={() => {}} t={auth} />,
      onDeleteAccount: () => {},
    });
    expect(screen.getByText("olena@example.com")).toBeTruthy();
    expect(screen.getByText(auth.signOut)).toBeTruthy();
    expect(screen.getByText(auth.crossDevice)).toBeTruthy();
    // The subtitle stops saying "on this device", because it no longer is.
    expect(screen.queryByText(t.yoursCountOnThisDevice.replace("{n}", "2"))).toBeNull();
  });

  // The card has to survive an empty list, or a signed-in host with nothing
  // published has no way to sign out.
  it("keeps the card for a signed-in host with nothing published", () => {
    render(
      <MemoryRouter>
        <YourInvitations
          invitations={[]}
          signedIn
          footer={<AccountFooter email="olena@example.com" onSignOut={() => {}} t={auth} />}
          t={t}
          auth={auth}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(auth.emptySignedIn)).toBeTruthy();
    expect(screen.getByText(auth.signOut)).toBeTruthy();
    // No heading over an empty space.
    expect(screen.queryByText(t.yoursTitle)).toBeNull();
  });
});

describe("delete account confirmation", () => {
  function renderSheet(overrides: Partial<Parameters<typeof DeleteAccountSheet>[0]> = {}) {
    return render(
      <DeleteAccountSheet
        invitationCount={3}
        replyCount={32}
        onCopyAllLinks={() => {}}
        onConfirm={() => {}}
        onCancel={() => {}}
        t={auth}
        {...overrides}
      />,
    );
  }

  // The whole point of this screen: almost every host assumes the opposite.
  it("leads with what survives, with real numbers", () => {
    renderSheet();
    expect(screen.getByText("Your 3 invitations stay exactly where they are.")).toBeTruthy();
    expect(screen.getByText("All 32 replies you've collected are kept")).toBeTruthy();
    expect(screen.getByText(auth.deleteKeepGuests)).toBeTruthy();
    expect(screen.getByText(auth.deleteKeepManage)).toBeTruthy();
  });

  it("offers the keys back before taking the account", () => {
    const onCopyAllLinks = vi.fn();
    renderSheet({ onCopyAllLinks });
    fireEvent.click(screen.getByText("Copy all 3 links"));
    expect(onCopyAllLinks).toHaveBeenCalledOnce();
    expect(screen.getByText(auth.copyAllLinksDone)).toBeTruthy();
  });

  // Deliberately absent per the DS board — each of these would shout
  // "irreversible catastrophe" at a host whose invitations all survive.
  it("has no filled red button and no type-to-confirm", () => {
    const { container } = renderSheet();
    expect(container.querySelector("input")).toBeNull();
    // Cancel is the wide outlined control; deleting is a line of text.
    expect(screen.getByText(auth.cancel).className).toContain("ag-google");
    expect(screen.getByText(auth.deleteAccount).className).toContain("da-confirm");
  });

  it("cancels and confirms through their own handlers", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderSheet({ onConfirm, onCancel });
    fireEvent.click(screen.getByText(auth.cancel));
    fireEvent.click(screen.getByText(auth.deleteAccount));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

// adr-015 §7's durable home for the account-wide switch (DS
// LandingAccountNotify). The share panel discloses it at publish; this is
// where it lives afterwards.
describe("AccountFooter reply notifications", () => {
  const notifyOn = { enabled: true, onToggle: () => {} };

  function renderFooter(notify: { enabled: boolean; onToggle: () => void } | null, strings = auth) {
    return render(
      <AccountFooter
        email="olena@example.com"
        onSignOut={() => {}}
        {...(notify ? { notify } : {})}
        t={strings}
      />,
    );
  }

  it("names the setting and states what we send, without repeating the address", () => {
    const { container } = renderFooter(notifyOn);
    expect(container.querySelector(".notify-name")?.textContent).toBe(auth.notifyOptIn);
    const state = container.querySelector(".notify-state");
    expect(state?.textContent).toBe(auth.notifyStateOnAccount);
    // The address is on the row above; saying it twice in one block is the one
    // change from the share panel's wording.
    expect(state?.textContent).not.toContain("olena@example.com");
  });

  // The name is the same in both states — which is what makes unchecking as
  // easy as checking, and why the verbs it replaced are gone.
  it("keeps the same name when off and moves only the state", () => {
    const { container } = renderFooter({ enabled: false, onToggle: () => {} });
    expect(container.querySelector(".notify-name")?.textContent).toBe(auth.notifyOptIn);
    expect(container.querySelector(".notify-state")?.textContent).toBe(auth.notifyStateOffNow);
    expect(container.querySelector(".notify-box.is-on")).toBeNull();
  });

  it("toggles through the callback", () => {
    const onToggle = vi.fn();
    const { container } = renderFooter({ enabled: true, onToggle });
    fireEvent.click(container.querySelector(".notify-input") as HTMLElement);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  // A real input, so the control is reachable by keyboard and announced as a
  // checkbox. Off-screen rather than display:none, which would drop it out of
  // the tab order.
  it("is a real checkbox inside the label", () => {
    const { container } = renderFooter(notifyOn);
    const input = container.querySelector(".notify-check input[type=checkbox]") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.checked).toBe(true);
  });

  // Absent, never disabled: a dead control promises a feature that is not
  // there. This is the deployment-without-mail and the no-invitations-yet case.
  it("renders no line at all when there is nothing to promise", () => {
    const { container } = renderFooter(null);
    expect(container.querySelector(".lp-account-mail")).toBeNull();
    expect(container.querySelector(".notify-check")).toBeNull();
    // The identity row is untouched — this is the footer exactly as it was.
    expect(screen.getByText("olena@example.com")).toBeTruthy();
    expect(screen.getByText(auth.signOut)).toBeTruthy();
  });

  // The envelope stopped carrying the state when the square started. Two state
  // glyphs in one stack would argue with each other, so the strike is gone and
  // the envelope is a label for the address in both states.
  it("keeps one unstruck envelope whatever the state", () => {
    const on = renderFooter(notifyOn);
    expect(on.container.querySelectorAll(".lp-account-id svg")).toHaveLength(1);
    const onStrokes = on.container.querySelectorAll(".lp-account-id svg path").length;
    cleanup();

    const off = renderFooter({ enabled: false, onToggle: () => {} });
    expect(off.container.querySelectorAll(".lp-account-id svg")).toHaveLength(1);
    expect(off.container.querySelectorAll(".lp-account-id svg path").length).toBe(onStrokes);
  });

  it("carries the copy in Ukrainian too", () => {
    const { container } = renderFooter(notifyOn, AUTH.uk);
    expect(container.querySelector(".notify-name")?.textContent).toBe("Повідомляти про відповіді");
    expect(container.querySelector(".notify-state")?.textContent).toBe(
      "Пишемо про всі ваші запрошення.",
    );
  });
});
