import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { YourInvitations } from "../src/components/YourInvitations";
import type { InvitationActivity } from "../src/hooks/useHostInvitationCounts";
import type { HostInvitation } from "../src/hostInvitations";
import { LANDING } from "../src/i18n";

/** What the rows get before the counts land — and forever, if they never do. */
const NONE = new Map<string, InvitationActivity>();

const activityFor = (id: string, guests: number, newSince = 0) =>
  new Map<string, InvitationActivity>([[id, { counts: { yes: guests, no: 0, guests }, newSince }]]);

// globals:false in vite.config.ts means RTL never auto-cleans.
afterEach(cleanup);

// Rows are <Link>s now, so every render needs router context.
const wrapper = MemoryRouter;

const t = LANDING.uk;

const make = (n: number): HostInvitation[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `id${i}`,
    title: `Подія ${i}`,
    published_at: new Date(Date.UTC(2026, 7, 20 - i)).toISOString(),
    palette: "warm" as const,
  }));

describe("YourInvitations", () => {
  it("renders nothing for a first-time visitor", () => {
    const { container } = render(<YourInvitations invitations={[]} activity={NONE} t={t} />, {
      wrapper,
    });
    // The landing page must look exactly as it did before for a newcomer.
    expect(container.firstChild).toBeNull();
  });

  it("uses the singular heading for one invitation", () => {
    render(<YourInvitations invitations={make(1)} activity={NONE} t={t} />, { wrapper });
    expect(screen.getByText(t.yoursTitleOne)).toBeTruthy();
    expect(screen.queryByText(t.yoursTitle)).toBeNull();
  });

  it("caps the list and reveals the rest on request", () => {
    const { container } = render(<YourInvitations invitations={make(6)} activity={NONE} t={t} />, {
      wrapper,
    });
    // Capped so the block can't push the pitch off the screen.
    expect(container.querySelectorAll(".lp-yours-row")).toHaveLength(3);

    fireEvent.click(screen.getByText("Показати всі 6"));

    expect(container.querySelectorAll(".lp-yours-row")).toHaveLength(6);
    expect(screen.queryByText("Показати всі 6")).toBeNull();
  });

  it("offers no 'show all' when everything already fits", () => {
    render(<YourInvitations invitations={make(3)} activity={NONE} t={t} />, { wrapper });
    expect(screen.queryByText(/Показати всі/)).toBeNull();
  });

  it("points each row at the host dashboard", () => {
    const { container } = render(<YourInvitations invitations={make(1)} activity={NONE} t={t} />, {
      wrapper,
    });
    expect(container.querySelector("a.lp-yours-row")?.getAttribute("href")).toBe("/manage/id0");
  });

  it("says the list is local rather than implying an account", () => {
    render(<YourInvitations invitations={make(2)} activity={NONE} t={t} />, { wrapper });
    expect(screen.getByText("2 на цьому пристрої")).toBeTruthy();
  });

  it("renders every row fully before any counts arrive", () => {
    const { container } = render(<YourInvitations invitations={make(2)} activity={NONE} t={t} />, {
      wrapper,
    });
    // The page must not wait on the counts, and must not shift when they land:
    // the slot is in the DOM from the first paint, holding nothing.
    expect(container.querySelectorAll(".lp-yours-row")).toHaveLength(2);
    expect(container.querySelectorAll(".lp-yours-activity")).toHaveLength(2);
    expect(container.querySelector(".lp-yours-activity")?.textContent).toBe("");
  });

  it("shows the headcount once it arrives, with Ukrainian plural forms", () => {
    const rows = make(1);
    const { rerender } = render(<YourInvitations invitations={rows} activity={NONE} t={t} />, {
      wrapper,
    });

    rerender(<YourInvitations invitations={rows} activity={activityFor("id0", 5)} t={t} />);
    expect(screen.getByText("5 гостей буде")).toBeTruthy();

    rerender(<YourInvitations invitations={rows} activity={activityFor("id0", 2)} t={t} />);
    expect(screen.getByText("2 гості буде")).toBeTruthy();

    rerender(<YourInvitations invitations={rows} activity={activityFor("id0", 1)} t={t} />);
    expect(screen.getByText("1 гість буде")).toBeTruthy();
  });

  it("says there are no replies rather than showing a bare zero", () => {
    render(<YourInvitations invitations={make(1)} activity={activityFor("id0", 0)} t={t} />, {
      wrapper,
    });
    expect(screen.getByText(t.yoursNoReplies)).toBeTruthy();
  });

  it("marks new replies, and shows nothing at all when there are none", () => {
    const rows = make(1);
    const { container, rerender } = render(
      <YourInvitations invitations={rows} activity={activityFor("id0", 4, 5)} t={t} />,
      { wrapper },
    );
    expect(screen.getByText("5 нових")).toBeTruthy();
    expect(container.querySelector(".lp-yours-dot")).toBeTruthy();

    // 3 takes the "few" form, not "many" — the same rule guest counts use.
    rerender(<YourInvitations invitations={rows} activity={activityFor("id0", 4, 3)} t={t} />);
    expect(screen.getByText("3 нові")).toBeTruthy();
    rerender(<YourInvitations invitations={rows} activity={activityFor("id0", 4, 1)} t={t} />);
    expect(screen.getByText("1 нова")).toBeTruthy();

    // Hidden entirely at zero — a "0 new" marker is noise on a quiet event.
    rerender(<YourInvitations invitations={rows} activity={activityFor("id0", 4, 0)} t={t} />);
    expect(container.querySelector(".lp-yours-dot")).toBeNull();
  });

  it("leaves a row bare when its own counts are missing", () => {
    const { container } = render(
      <YourInvitations invitations={make(2)} activity={activityFor("id0", 3)} t={t} />,
      { wrapper },
    );
    // id1's token was refused or absent. A row is not where a host learns that,
    // and 0 would be a lie about their event — so it simply shows nothing.
    const slots = container.querySelectorAll(".lp-yours-activity");
    expect(slots[0]?.textContent).toContain("3 гості буде");
    expect(slots[1]?.textContent).toBe("");
  });

  it("tints the monogram with the invitation's own palette", () => {
    const { container } = render(
      <YourInvitations
        invitations={[{ ...make(1)[0]!, palette: "festive" }]}
        activity={NONE}
        t={t}
      />,
      { wrapper },
    );
    const mono = container.querySelector(".lp-yours-mono");
    expect(mono?.className).toContain("palette-festive");
    // First letter of the event, not of a person.
    expect(mono?.textContent).toBe("П");
  });
});
