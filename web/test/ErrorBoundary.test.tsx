import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Two screens that throw while rendering and two that don't: the boundary has
// to catch the first pair and be invisible around the second. The throw stands
// in for any render-time bug — before the boundary, each of these produced a
// blank <body> and a console warning.
vi.mock("../src/App", () => ({
  default: () => {
    throw new Error("editor blew up");
  },
}));
vi.mock("../src/GuestPage", () => ({
  GuestPage: () => {
    throw new Error("guest page blew up");
  },
}));
vi.mock("../src/LandingPage", () => ({ LandingPage: () => <div>landing screen</div> }));
vi.mock("../src/ManagePage", () => ({ ManagePage: () => <div>manage screen</div> }));

import { AppRoutes } from "../src/AppRoutes";
import { saveGuestLang } from "../src/guestLang";
import { CRASH, saveUiLang } from "../src/i18n";

// vite.config.ts sets globals:false, so RTL's auto-cleanup never registers.
afterEach(() => {
  cleanup();
  localStorage.clear();
});

// React logs every error it hands to a boundary, and the boundary logs the
// component stack; both are noise here. restoreMocks:true in vite.config.ts
// puts console.error back after each test.
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

/** Lives outside AppRoutes so it survives the crash — it stands for the kind of
 *  navigation the fallback itself doesn't offer, above all the back button. */
function NavProbe() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate("/")}>
      probe: go home
    </button>
  );
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <NavProbe />
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe("route error boundary", () => {
  it("shows the host a way out instead of blanking the page", () => {
    renderAt("/create");

    expect(screen.getByText(CRASH.uk.host.title)).toBeTruthy();
    expect(screen.getByText(CRASH.uk.host.reload)).toBeTruthy();
  });

  it("tells a guest to ask for a fresh link, not to try again as a host would", () => {
    // A guest has no editor to return to and nothing to retry — the host is
    // their only recovery, the same one the dead-link screen points at.
    renderAt("/i/abc123");

    expect(screen.getByText(CRASH.uk.guest.title)).toBeTruthy();
    expect(screen.getByText(CRASH.uk.guest.hint)).toBeTruthy();
    expect(screen.queryByText(CRASH.uk.host.hint)).toBeNull();
  });

  it("keeps the host's UI language", () => {
    saveUiLang("en");

    renderAt("/create");

    expect(screen.getByText(CRASH.en.host.title)).toBeTruthy();
  });

  it("keeps the guest's chrome-language override", () => {
    // The invitation that would have set the language is exactly what failed to
    // render, so the guest's own choice is all that's left to go on.
    saveGuestLang("en");

    renderAt("/i/abc123");

    expect(screen.getByText(CRASH.en.guest.title)).toBeTruthy();
  });

  it("stays out of the way when nothing throws", () => {
    renderAt("/");

    expect(screen.getByText("landing screen")).toBeTruthy();
    expect(screen.queryByText(CRASH.uk.host.title)).toBeNull();
  });

  it("clears the fallback when the route changes under it", () => {
    // React unmounted the children, so nothing inside can clear the error:
    // without the reset key the crash screen would sit there for the rest of
    // the session, at URLs that render perfectly well.
    renderAt("/create");
    expect(screen.getByText(CRASH.uk.host.title)).toBeTruthy();

    fireEvent.click(screen.getByText("probe: go home"));

    expect(screen.getByText("landing screen")).toBeTruthy();
    expect(screen.queryByText(CRASH.uk.host.title)).toBeNull();
  });
});
