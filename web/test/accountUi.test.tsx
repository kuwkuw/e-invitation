import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountFooter } from "../src/components/AccountFooter";
import { DeleteAccountSheet } from "../src/components/DeleteAccountSheet";
import { SignOutSheet } from "../src/components/SignOutSheet";
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
  // adr-014, design project `LandingSignedInStates`: today's signed-out variant is
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
    // The subtitle counts the account's invitations; the device it is being
    // read on stopped being something the card talks about.
    expect(screen.getByText(auth.invitationCount.replace("{n}", "2"))).toBeTruthy();
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

  // Deliberately absent per the design-project board — each of these would shout
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

// adr-019 §10, from PR #66's design pass. adr-015 §7's durable home for the
// account-wide switch: under opt-in it is the only thing between the feature
// and its non-existence, so it is a control, not a sentence with a text button.
describe("AccountFooter reply email", () => {
  const footer = (notify: { enabled: boolean; onToggle: () => void } | null, t = auth) =>
    render(<AccountFooter email="olena@example.com" onSignOut={() => {}} notify={notify} t={t} />);
  const box = () =>
    screen.getByRole("checkbox", { name: new RegExp(auth.notifyOptIn) }) as HTMLInputElement;

  it("is a real checkbox, checked while mail is on, with the scope in its state line", () => {
    footer({ enabled: true, onToggle: () => {} });
    expect(box().checked).toBe(true);
    expect(screen.getByText(auth.notifyStateOnAccount)).toBeTruthy();
  });

  it("keeps its name when off, and says no invitation is written about", () => {
    footer({ enabled: false, onToggle: () => {} });
    expect(box().checked).toBe(false);
    expect(screen.getByText(auth.notifyOptIn)).toBeTruthy();
    expect(screen.getByText(auth.notifyStateOffNow)).toBeTruthy();
  });

  it("toggles from anywhere on its label, which is the 44px target", () => {
    const onToggle = vi.fn();
    footer({ enabled: false, onToggle });
    fireEvent.click(screen.getByText(auth.notifyStateOffNow));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("never repeats the address the row above already shows", () => {
    const { container } = footer({ enabled: true, onToggle: () => {} });
    expect(container.querySelector(".lp-account-mail")?.textContent).not.toContain(
      "olena@example.com",
    );
  });

  // Absent, never disabled: a deployment without mail, or a host with nothing
  // published, has nothing to promise.
  it("renders no control at all when there is nothing to promise", () => {
    footer(null);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText("olena@example.com")).toBeTruthy();
    expect(screen.getByText(auth.signOut)).toBeTruthy();
  });

  // The square carries the state now. Two state glyphs in one stack would
  // argue, so the envelope only labels the address.
  it("labels the address with one plain envelope, struck in neither state", () => {
    const glyph = (enabled: boolean) => {
      const { container } = footer({ enabled, onToggle: () => {} });
      const counts = [
        container.querySelectorAll(".lp-account-id svg").length,
        container.querySelectorAll(".lp-account-id svg path").length,
      ];
      cleanup();
      return counts;
    };
    expect(glyph(false)).toEqual(glyph(true));
    expect(glyph(true)[0]).toBe(1);
  });

  it("carries the copy in Ukrainian too", () => {
    footer({ enabled: true, onToggle: () => {} }, AUTH.uk);
    expect(screen.getByText("Пишемо про всі ваші запрошення.")).toBeTruthy();
    expect(screen.getByText("Повідомляти про відповіді")).toBeTruthy();
  });
});

/**
 * Sign-out confirmation (design project `LandingListIsAccount`, case 2).
 *
 * Sign-out could be immediate while the list was the browser's. Now it is the
 * account's view, so signing out takes the list off the page while leaving
 * every manage token in place — access unchanged, visibility gone. That is the
 * most counter-intuitive event in the product, and the sheet exists to say so
 * before it happens rather than after.
 */
describe("sign-out confirmation", () => {
  function renderSheet(props: Partial<Parameters<typeof SignOutSheet>[0]> = {}) {
    return render(
      <SignOutSheet
        invitationCount={3}
        onCopyAllLinks={() => {}}
        onConfirm={() => {}}
        onCancel={() => {}}
        t={auth}
        {...props}
      />,
    );
  }

  it("says what stays and what goes, in that order", () => {
    renderSheet();
    expect(screen.getByText(auth.signOutKeepCount.replace("{n}", "3"))).toBeTruthy();
    expect(screen.getByText(auth.signOutOnlyList.replace("{n}", "3"))).toBeTruthy();
  });

  // Nobody signing out fears losing data — the account survives — so the
  // deletion sheet's third reassurance is deliberately absent here.
  it("answers only the fears that actually arise", () => {
    const { container } = renderSheet();
    expect(container.querySelectorAll(".da-keep-list li")).toHaveLength(2);
    expect(screen.queryByText(auth.deleteKeepReplies.replace("{n}", "0"))).toBeNull();
  });

  // Red belongs to account deletion alone, or it stops meaning anything.
  it("keeps the confirm quiet rather than destructive", () => {
    const { container } = renderSheet();
    expect(container.querySelector(".da-confirm")).toBeNull();
    expect(container.querySelector(".so-confirm")?.textContent).toBe(auth.signOut);
  });

  // A choice between two lasting states, not the interruption of an action.
  it("names the state the wide button leads to", () => {
    const { container } = renderSheet();
    expect(container.querySelector(".da-cancel")?.textContent).toBe(auth.signOutStay);
    expect(screen.queryByText(auth.cancel)).toBeNull();
  });

  // The one thing sign-out costs is convenient access, handed back first.
  it("offers the keys before taking the list", () => {
    const copied = vi.fn();
    renderSheet({ onCopyAllLinks: copied });
    fireEvent.click(screen.getByText(auth.copyAllLinks.replace("{n}", "3")));
    expect(copied).toHaveBeenCalledOnce();
    expect(screen.getByText(auth.copyAllLinksDone)).toBeTruthy();
  });

  it("does not promise a danger that is not there", () => {
    renderSheet();
    // The tokens are not erased here, unlike deletion — so the wording says
    // they stay, and deletion's "save them first" must not appear.
    expect(screen.getByText(auth.signOutKeysHere)).toBeTruthy();
    expect(screen.queryByText(auth.saveKeysTitle)).toBeNull();
  });
});
