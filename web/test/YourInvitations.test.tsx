import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { YourInvitations } from "../src/components/YourInvitations";
import type { HostInvitation } from "../src/hostInvitations";
import { LANDING } from "../src/i18n";

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

  it("says the list is local rather than implying an account", () => {
    render(<YourInvitations invitations={make(2)} t={t} />, { wrapper });
    expect(screen.getByText("2 на цьому пристрої")).toBeTruthy();
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
