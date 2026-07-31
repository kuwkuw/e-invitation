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

// adr-014 §5 / DS `ShareSignedIn`. The hierarchy above must survive intact;
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

// adr-015 §7: the disclosure is made where it is caused — at publish, beside
// the switch — rather than discovered from the first email.
describe("SharePanel reply notifications", () => {
  function renderNotify(overrides: Partial<Parameters<typeof SharePanel>[0]> = {}) {
    return renderPanel({ signedIn: true, manageShown: true, t: UI.en, ...overrides });
  }

  it("says which address replies go to", () => {
    renderNotify({ notifyEmail: "host@example.com", notifyEnabled: true });
    expect(screen.getByText("We'll email host@example.com when replies come in.")).toBeTruthy();
    expect(screen.getByText(UI.en.auth.notifyTurnOff)).toBeTruthy();
  });

  it("says the opposite, and offers the opposite action, when off", () => {
    renderNotify({ notifyEmail: "host@example.com", notifyEnabled: false });
    expect(screen.getByText(UI.en.auth.notifyOff)).toBeTruthy();
    expect(screen.getByText(UI.en.auth.notifyTurnOn)).toBeTruthy();
  });

  it("toggles through the callback", () => {
    const onToggleNotify = vi.fn();
    renderNotify({ notifyEmail: "host@example.com", notifyEnabled: true, onToggleNotify });

    fireEvent.click(screen.getByText(UI.en.auth.notifyTurnOff));

    expect(onToggleNotify).toHaveBeenCalledTimes(1);
  });

  // §8: a deployment with no mail credentials must promise nothing. The line
  // is absent, not disabled — an offer that cannot be honoured is worse than
  // no offer.
  it("renders nothing when the deployment cannot send mail", () => {
    const { container } = renderNotify({ notifyEmail: null });
    expect(container.querySelector(".sp-notify")).toBeNull();
    expect(screen.queryByText(UI.en.auth.notifyTurnOff)).toBeNull();
  });

  it("renders nothing for a signed-out host", () => {
    const { container } = renderPanel({
      signedIn: false,
      notifyEmail: "host@example.com",
      t: UI.en,
    });
    expect(container.querySelector(".sp-notify")).toBeNull();
  });

  // The panel's hierarchy is the safeguard (adr-010 §3): the notification line
  // must not become a third thing competing with the two links.
  it("stays quiet — no accent button, and the public link keeps the only one", () => {
    const { container } = renderNotify({ notifyEmail: "host@example.com" });
    const toggle = screen.getByText(UI.en.auth.notifyTurnOff);
    expect(toggle.className).not.toContain("sp-primary");
    expect(container.querySelectorAll(".sp-primary")).toHaveLength(1);
    expect(screen.getByText(UI.en.copyLink).className).toContain("sp-primary");
  });

  it("carries the copy in Ukrainian too", () => {
    renderNotify({ notifyEmail: "host@example.com", t: UI.uk });
    expect(
      screen.getByText("Ми напишемо на host@example.com, коли надійдуть відповіді."),
    ).toBeTruthy();
  });
});
