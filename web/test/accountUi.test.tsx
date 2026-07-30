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
