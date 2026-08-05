import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { YourInvitations } from "../src/components/YourInvitations";
import type { HostInvitation } from "../src/hostInvitations";
import { LANDING } from "../src/i18n";
import type { CountsResult } from "../src/types";

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
    const { container } = render(<YourInvitations invitations={[]} t={t} />, { wrapper });
    // The landing page must look exactly as it did before for a newcomer.
    expect(container.firstChild).toBeNull();
  });

  it("uses the singular heading for one invitation", () => {
    render(<YourInvitations invitations={make(1)} t={t} />, { wrapper });
    expect(screen.getByText(t.yoursTitleOne)).toBeTruthy();
    expect(screen.queryByText(t.yoursTitle)).toBeNull();
  });

  it("caps the list and reveals the rest on request", () => {
    const { container } = render(<YourInvitations invitations={make(6)} t={t} />, { wrapper });
    // Capped so the block can't push the pitch off the screen.
    expect(container.querySelectorAll(".lp-yours-row")).toHaveLength(3);

    fireEvent.click(screen.getByText("Показати всі 6"));

    expect(container.querySelectorAll(".lp-yours-row")).toHaveLength(6);
    expect(screen.queryByText("Показати всі 6")).toBeNull();
  });

  it("offers no 'show all' when everything already fits", () => {
    render(<YourInvitations invitations={make(3)} t={t} />, { wrapper });
    expect(screen.queryByText(/Показати всі/)).toBeNull();
  });

  it("points each row at the host dashboard", () => {
    const { container } = render(<YourInvitations invitations={make(1)} t={t} />, { wrapper });
    expect(container.querySelector("a.lp-yours-row")?.getAttribute("href")).toBe("/manage/id0");
  });

  // The list only renders without an account where accounts cannot exist
  // (adr-014 §7), and there "on this device" contrasts with nothing — it would
  // be noise about the only possible state (DS `LandingListIsAccount`).
  it("carries no subtitle when the list is not the account's", () => {
    const { container } = render(<YourInvitations invitations={make(2)} t={t} />, { wrapper });
    expect(container.querySelector(".lp-yours-sub")).toBeNull();
  });

  it("renders every row fully before any counts arrive, with a sized slot", () => {
    const { container } = render(<YourInvitations invitations={make(3)} t={t} />, { wrapper });
    // Titles are present with no counts map at all — the list never waits.
    expect(screen.getByText("Подія 0")).toBeTruthy();
    // The count slot exists on every row from the first render, so nothing
    // shifts when counts fill in later (adr-012 §6).
    expect(container.querySelectorAll(".lp-yours-stat")).toHaveLength(3);
    expect(container.querySelector(".lp-yours-count")).toBeNull();
  });

  it("fills in a row's reply count and 'new' badge without changing the layout", () => {
    const counts = new Map<string, CountsResult>([
      ["id0", { id: "id0", status: "ok", counts: { yes: 3, no: 1, guests: 5 }, new_since: 2 }],
    ]);
    const { container } = render(<YourInvitations invitations={make(1)} counts={counts} t={t} />, {
      wrapper,
    });
    // 4 replies (3 yes + 1 no), pluralized "відповіді".
    expect(screen.getByText("4 відповіді")).toBeTruthy();
    expect(screen.getByText("+2")).toBeTruthy();
    expect(screen.getByLabelText("2 нових з вашого останнього візиту")).toBeTruthy();
    // Row structure is unchanged: still one row, one stat slot.
    expect(container.querySelectorAll(".lp-yours-row")).toHaveLength(1);
    expect(container.querySelectorAll(".lp-yours-stat")).toHaveLength(1);
  });

  it("shows the muted 0-state and hides the 'new' badge at zero", () => {
    const counts = new Map<string, CountsResult>([
      ["id0", { id: "id0", status: "ok", counts: { yes: 0, no: 0, guests: 0 }, new_since: 0 }],
    ]);
    const { container } = render(<YourInvitations invitations={make(1)} counts={counts} t={t} />, {
      wrapper,
    });
    expect(screen.getByText("без відповідей")).toBeTruthy();
    expect(container.querySelector(".lp-yours-new")).toBeNull();
  });

  it("leaves a row plain when its token was refused or is missing", () => {
    const counts = new Map<string, CountsResult>([["id0", { id: "id0", status: "forbidden" }]]);
    const { container } = render(<YourInvitations invitations={make(1)} counts={counts} t={t} />, {
      wrapper,
    });
    // The slot is still there (sized), but carries no count — a refused token
    // must not blank the row, only leave it countless (adr-012 §6).
    expect(container.querySelector(".lp-yours-stat")).toBeTruthy();
    expect(container.querySelector(".lp-yours-count")).toBeNull();
    expect(screen.getByText("Подія 0")).toBeTruthy();
  });

  it("tints the monogram with the invitation's own palette", () => {
    const { container } = render(
      <YourInvitations invitations={[{ ...make(1)[0]!, palette: "festive" }]} t={t} />,
      { wrapper },
    );
    const mono = container.querySelector(".lp-yours-mono");
    expect(mono?.className).toContain("palette-festive");
    // First letter of the event, not of a person.
    expect(mono?.textContent).toBe("П");
  });
});
