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
