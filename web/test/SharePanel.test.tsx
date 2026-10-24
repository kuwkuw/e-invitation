import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SharePanel } from "../src/components/editor/SharePanel";
import { UI } from "../src/i18n";

// vite.config.ts sets globals:false, so RTL's auto-cleanup never registers —
// without this, each render stacks up in document.body and `screen` queries
// start matching the previous test's markup.
afterEach(cleanup);

const TOKEN = "f".repeat(32);
const published = { id: "abc123", version: 3, manage_token: TOKEN };

function renderPanel(overrides: Partial<Parameters<typeof SharePanel>[0]> = {}) {
  return render(
    <SharePanel
      published={published}
      onCopyLink={() => {}}
      copied={false}
      onCopyManageLink={() => {}}
      manageCopied={false}
      t={UI.uk}
      {...overrides}
    />,
  );
}

describe("SharePanel", () => {
  it("shows the public link in full — it is the one meant to be pasted", () => {
    const { container } = renderPanel();
    expect(container.textContent).toContain("/i/abc123");
    expect(screen.getByText(UI.uk.copyLink)).toBeTruthy();
  });

  it("keeps the manage token out of the DOM until it is deliberately revealed", () => {
    // The masking is the point: a stray select-all or an over-eager screen
    // scrape must not walk away with the host's only credential.
    const { container } = renderPanel();
    expect(container.textContent).not.toContain(TOKEN);
    expect(container.textContent).toContain("••••••••");

    fireEvent.click(screen.getByText(UI.uk.revealManageLink));

    expect(container.textContent).toContain(TOKEN);
  });

  it("warns beside the manage link, in its own block", () => {
    renderPanel();
    expect(screen.getByText(UI.uk.manageLinkWarning)).toBeTruthy();
  });

  it("gives the public link the only filled accent button", () => {
    const { container } = renderPanel();
    // Hierarchy is the whole safeguard (adr-010 §3): exactly one primary, and
    // the manage action is an outline ghost.
    expect(container.querySelectorAll(".sp-primary")).toHaveLength(1);
    expect(container.querySelector(".sp-primary")?.textContent).toBe(UI.uk.copyLink);
    expect(container.querySelector(".sp-ghost")?.textContent).toBe(UI.uk.copyManageLink);
  });

  it("repeats the privacy reminder when the manage link is copied", () => {
    renderPanel({ manageCopied: true });
    expect(screen.getByText(UI.uk.manageLinkCopied)).toBeTruthy();
  });

  it("routes to the dashboard rather than duplicating the response list", () => {
    const { container } = renderPanel();
    expect(container.querySelector("a.sp-responses-link")?.getAttribute("href")).toBe(
      "/manage/abc123",
    );
    // The old embedded list is gone — responses live at /manage/:id now.
    expect(container.querySelector(".responses-list")).toBeNull();
  });

  it("fires the two copy actions independently", () => {
    const onCopyLink = vi.fn();
    const onCopyManageLink = vi.fn();
    renderPanel({ onCopyLink, onCopyManageLink });

    fireEvent.click(screen.getByText(UI.uk.copyLink));
    expect(onCopyLink).toHaveBeenCalledTimes(1);
    expect(onCopyManageLink).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText(UI.uk.copyManageLink));
    expect(onCopyManageLink).toHaveBeenCalledTimes(1);
  });
});

// 01-vision intent 4: sharing is messenger-native. Where the browser has a
// share sheet the panel offers it, and everywhere else it is untouched — every
// case above runs with `canShare` unset and is the proof of the second half.
describe("native share", () => {
  function renderShareable(overrides: Partial<Parameters<typeof SharePanel>[0]> = {}) {
    return renderPanel({ canShare: true, onShare: () => {}, t: UI.en, ...overrides });
  }

  it("makes the share sheet the primary action and keeps copy beneath it", () => {
    const { container } = renderShareable();
    expect(container.querySelector(".sp-primary")?.textContent).toContain(UI.en.shareInvitation);
    expect(container.querySelector(".sp-secondary")?.textContent).toBe(UI.en.copyLink);
  });

  // The rule the panel is built on is a count, not a label (adr-010 §3): one
  // filled accent, and the manage action still an outline in its own block.
  it("does not add a second filled accent", () => {
    const { container } = renderShareable({ signedIn: true, manageShown: true });
    expect(container.querySelectorAll(".sp-primary")).toHaveLength(1);
    expect(container.querySelector(".sp-secondary")?.className).not.toContain("sp-ghost");
    expect(container.querySelector(".sp-ghost")?.textContent).toBe(UI.en.copyManageLink);
  });

  // The hint describes the primary button. Promising a paste when nothing is
  // pasted is the kind of copy that survives because nobody re-reads it.
  it("stops telling the host to paste once nothing is pasted", () => {
    renderShareable();
    expect(screen.getByText(UI.en.shareInvitationHint)).toBeTruthy();
    expect(screen.queryByText(UI.en.shareHint)).toBeNull();
  });

  it("keeps the two actions on separate callbacks", () => {
    const onShare = vi.fn();
    const onCopyLink = vi.fn();
    renderShareable({ onShare, onCopyLink });

    fireEvent.click(screen.getByText(UI.en.shareInvitation));
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onCopyLink).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText(UI.en.copyLink));
    expect(onCopyLink).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it("still confirms the copy from its demoted position", () => {
    renderShareable({ copied: true });
    expect(screen.getByText(UI.en.copied).className).toContain("sp-secondary");
  });

  it("leaves the panel alone where the browser cannot share", () => {
    const { container } = renderPanel({ t: UI.en });
    expect(container.querySelector(".sp-primary")?.textContent).toBe(UI.en.copyLink);
    expect(container.querySelector(".sp-secondary")).toBeNull();
    expect(screen.getByText(UI.en.shareHint)).toBeTruthy();
  });

  it("carries both labels in Ukrainian", () => {
    const { container } = renderShareable({ t: UI.uk });
    expect(container.querySelector(".sp-primary")?.textContent).toContain(UI.uk.shareInvitation);
    expect(container.querySelector(".sp-secondary")?.textContent).toBe(UI.uk.copyLink);
  });
});

// adr-014 §5 / design project `ShareSignedIn`. The hierarchy above must survive intact;
// what changes is how much work it takes to reach the manage link.
describe("signed in", () => {
  function renderSignedIn(manageShown: boolean, onToggleManage = () => {}) {
    return render(
      <SharePanel
        published={published}
        onCopyLink={() => {}}
        copied={false}
        onCopyManageLink={() => {}}
        manageCopied={false}
        signedIn
        manageShown={manageShown}
        onToggleManage={onToggleManage}
        t={UI.en}
      />,
    );
  }

  it("collapses the manage block and says the account holds it", () => {
    renderSignedIn(false);
    expect(screen.getByText(UI.en.auth.savedToAccount)).toBeTruthy();
    expect(screen.getByText(UI.en.auth.showManage)).toBeTruthy();
    // Collapsed there is nothing to copy, so nothing to warn about.
    expect(screen.queryByText(UI.en.copyManageLink)).toBeNull();
    expect(screen.queryByText(UI.en.manageLinkWarning)).toBeNull();
  });

  // The hard rule from ShareSpec: the copy button never exists on screen
  // without the warning above it — every state, every width, both languages.
  it("brings back the warning with the copy button, word for word", () => {
    renderSignedIn(true);
    expect(screen.getByText(UI.en.copyManageLink)).toBeTruthy();
    expect(screen.getByText(UI.en.manageLinkWarning)).toBeTruthy();
  });

  it("keeps the public link first and the only filled accent", () => {
    renderSignedIn(true);
    // Same primary as the signed-out panel: one filled accent, and it is the
    // guest link.
    expect(screen.getByText(UI.en.copyLink).className).toContain("sp-primary");
    expect(screen.getByText(UI.en.copyManageLink).className).toContain("sp-ghost");
  });
});

// adr-015 §7: the choice is made where it is caused, at publish. adr-019 §10
// makes it one checkbox, redone on paper from PR #66's design pass.
describe("SharePanel reply email (adr-019 §10)", () => {
  function renderNotify(overrides: Partial<Parameters<typeof SharePanel>[0]> = {}) {
    return renderPanel({
      signedIn: true,
      manageShown: true,
      notifyEmail: "host@example.com",
      t: UI.en,
      ...overrides,
    });
  }

  it("names the setting identically in both states", () => {
    const off = renderNotify({ notifyEnabled: false });
    expect(off.container.querySelector(".notify-name")?.textContent).toBe(UI.en.auth.notifyOptIn);
    cleanup();
    const on = renderNotify({ notifyEnabled: true });
    expect(on.container.querySelector(".notify-name")?.textContent).toBe(UI.en.auth.notifyOptIn);
  });

  // The scope rides the offer, so the host agrees knowing it; and it stays in
  // the on state, so it doesn't vanish the moment they do.
  it("says where mail goes and what it covers, before and after agreeing", () => {
    const off = renderNotify({ notifyEnabled: false });
    expect(off.container.querySelector(".notify-state")?.textContent).toBe(
      "To host@example.com — for every invitation in your account.",
    );
    cleanup();
    const on = renderNotify({ notifyEnabled: true });
    expect(on.container.querySelector(".notify-state")?.textContent).toBe(
      "To host@example.com — for all your invitations, not just this one.",
    );
  });

  // Opt-in (adr-015 §7, amended): a panel handed no preference must not imply
  // mail is already coming.
  it("defaults to unchecked, an offer rather than a promise", () => {
    const { container } = renderNotify();
    expect((container.querySelector(".notify-input") as HTMLInputElement).checked).toBe(false);
  });

  it("toggles through a real checkbox", () => {
    const onToggleNotify = vi.fn();
    const { container } = renderNotify({ onToggleNotify });
    fireEvent.click(
      container.querySelector("label.notify-check input[type=checkbox]") as HTMLElement,
    );
    expect(onToggleNotify).toHaveBeenCalledTimes(1);
  });

  // A square carries the state now. The envelope keeps its job only where
  // nothing is pressable: the email footer and the unsubscribe page.
  it("carries no envelope icon", () => {
    for (const notifyEnabled of [false, true]) {
      const { container } = renderNotify({ notifyEnabled });
      const glyphs = [...container.querySelectorAll(".sp-notify svg")];
      expect(glyphs.every((svg) => svg.closest(".notify-box"))).toBe(true);
      cleanup();
    }
  });

  // adr-010 §3.1: the hierarchy counts fills, and the checkbox spends none.
  it("leaves the public link the only filled accent", () => {
    const { container } = renderNotify({ notifyEnabled: true });
    expect(container.querySelectorAll(".sp-primary")).toHaveLength(1);
    expect(screen.getByText(UI.en.copyLink).className).toContain("sp-primary");
  });

  // §8: a deployment with no mail credentials must promise nothing. The
  // control is absent, not disabled.
  it("renders nothing when the deployment cannot send mail, or for a signed-out host", () => {
    const noMail = renderNotify({ notifyEmail: null });
    expect(noMail.container.querySelector(".sp-notify")).toBeNull();
    cleanup();
    const signedOut = renderNotify({ signedIn: false });
    expect(signedOut.container.querySelector(".sp-notify")).toBeNull();
  });

  it("carries the copy in Ukrainian too", () => {
    const { container } = renderNotify({ notifyEnabled: false, t: UI.uk });
    expect(container.querySelector(".notify-name")?.textContent).toBe("Повідомляти про відповіді");
    expect(container.querySelector(".notify-state")?.textContent).toBe(
      "На host@example.com — про всі ваші запрошення.",
    );
  });
});
