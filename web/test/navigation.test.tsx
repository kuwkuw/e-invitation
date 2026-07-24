import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { AppRoutes } from "../src/AppRoutes";
import { recordHostInvitation } from "../src/hostInvitations";
import { GUEST, LANDING, MANAGE, UI } from "../src/i18n";

// globals:false in vite.config.ts means RTL never auto-cleans.
afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

/** The screens are real here — the point of these tests is that moving between
 *  them is a transition and not a page load, which a stub could not show. */
describe("navigation", () => {
  it("takes the landing call to action into the editor", () => {
    renderAt("/");
    expect(screen.getByText(LANDING.uk.heroTitle)).toBeTruthy();

    fireEvent.click(document.querySelector(".lp-cta")!);

    expect(screen.getByText(UI.uk.chat.startTitle)).toBeTruthy();
  });

  it("brings the editor's back button home", () => {
    renderAt("/create");
    expect(screen.getByText(UI.uk.chat.startTitle)).toBeTruthy();

    fireEvent.click(screen.getByLabelText(UI.uk.chat.back));

    expect(screen.getByText(LANDING.uk.heroTitle)).toBeTruthy();
  });

  it("tells a guest their link is dead rather than showing them the pitch", () => {
    // A broken share link used to land on the marketing page, which answers a
    // question the guest did not ask.
    renderAt("/i/not-a-real-id-!!");

    expect(screen.getByText(GUEST.uk.notFoundTitle)).toBeTruthy();
    expect(screen.queryByText(LANDING.uk.heroTitle)).toBeNull();
  });

  it("opens an invitations row in the manage view", () => {
    recordHostInvitation({
      id: "abc123",
      title: "Подія",
      published_at: new Date().toISOString(),
      palette: "warm",
    });
    renderAt("/");

    fireEvent.click(document.querySelector("a.lp-yours-row")!);

    // This browser holds no token for it, so the manage view asks for the
    // manage link — reaching that state is what proves the row routed.
    expect(screen.getByText(MANAGE.uk.noTokenTitle)).toBeTruthy();
  });
});
