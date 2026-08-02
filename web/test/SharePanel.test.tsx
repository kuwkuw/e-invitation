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

// adr-015 §7 as amended, DS `ShareOptIn`. Under opt-in this block stopped
// being a disclosure and became the only thing standing between the feature
// and its non-existence — which is why it is a control, not a sentence.
describe("SharePanel reply notifications", () => {
  function renderNotify(overrides: Partial<Parameters<typeof SharePanel>[0]> = {}) {
    return renderPanel({
      signedIn: true,
      manageShown: true,
      t: UI.en,
      notifyEmail: "host@example.com",
      ...overrides,
    });
  }

  it("offers, with the address and the scope inside the offer", () => {
    const { container } = renderNotify();
    expect(container.querySelector(".notify-name")?.textContent).toBe(UI.en.auth.notifyOptIn);
    // Scope in the state row, not in a caveat below it: a host accepts knowing
    // this covers every invitation, rather than being told once they have.
    expect(container.querySelector(".notify-state")?.textContent).toBe(
      "To host@example.com — for every invitation in your account.",
    );
    expect(container.querySelector(".notify-box.is-on")).toBeNull();
  });

  it("confirms where mail goes once accepted, keeping the same name", () => {
    const { container } = renderNotify({ notifyEnabled: true });
    expect(container.querySelector(".notify-name")?.textContent).toBe(UI.en.auth.notifyOptIn);
    expect(container.querySelector(".notify-state")?.textContent).toBe(
      "We'll email host@example.com when replies come in.",
    );
    expect(container.querySelector(".notify-box.is-on")).toBeTruthy();
  });

  // The defect this replaced: the target was the height of a button's text,
  // ~17px, on a product whose hosts are on phones in a messenger.
  it("makes the whole label the target, not a line of text", () => {
    const { container } = renderNotify();
    const label = container.querySelector("label.notify-check");
    expect(label).toBeTruthy();
    expect(label?.querySelector("input[type=checkbox]")).toBeTruthy();
    // Both rows are inside the target.
    expect(label?.querySelector(".notify-name")).toBeTruthy();
    expect(label?.querySelector(".notify-state")).toBeTruthy();
  });

  // adr-010 §3.1: hierarchy counts fills, not affordances. The square adds a
  // control without spending any of the accent budget the public link owns.
  it("spends no accent — the public link keeps the only filled button", () => {
    const { container } = renderNotify();
    expect(container.querySelectorAll(".sp-primary")).toHaveLength(1);
    expect(screen.getByText(UI.en.copyLink).className).toContain("sp-primary");
    // The old text button is gone entirely.
    expect(container.querySelector(".sp-notify-toggle")).toBeNull();
  });

  it("toggles through the callback", () => {
    const onToggleNotify = vi.fn();
    const { container } = renderNotify({ notifyEnabled: true, onToggleNotify });

    fireEvent.click(container.querySelector(".notify-input") as HTMLElement);

    expect(onToggleNotify).toHaveBeenCalledTimes(1);
  });

  // The default carries the reversal: a panel handed no preference must not
  // imply mail is already coming.
  it("defaults to unchecked", () => {
    const { container } = renderNotify();
    expect((container.querySelector(".notify-input") as HTMLInputElement).checked).toBe(false);
  });

  // §8: a deployment with no mail credentials must promise nothing. Absent,
  // not disabled — and deliberately no "sign in to get emails" either, which
  // would be an account advertisement in a panel where the host just acted.
  it("renders nothing when the deployment cannot send mail", () => {
    const { container } = renderNotify({ notifyEmail: null });
    expect(container.querySelector(".sp-notify")).toBeNull();
    expect(container.querySelector(".notify-check")).toBeNull();
  });

  it("renders nothing for a signed-out host", () => {
    const { container } = renderPanel({
      signedIn: false,
      notifyEmail: "host@example.com",
      t: UI.en,
    });
    expect(container.querySelector(".sp-notify")).toBeNull();
  });

  it("carries the copy in Ukrainian too", () => {
    const { container } = renderNotify({ notifyEnabled: true, t: UI.uk });
    expect(container.querySelector(".notify-state")?.textContent).toBe(
      "Ми напишемо на host@example.com, коли надійдуть відповіді.",
    );
  });
});
