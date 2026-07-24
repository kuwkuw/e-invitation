import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

// The screens are stubbed so these tests are about the route table and nothing
// else — each one fetches on mount, and that behaviour has its own tests.
vi.mock("../src/App", () => ({ default: () => <div>editor screen</div> }));
vi.mock("../src/GuestPage", () => ({
  GuestPage: ({ id }: { id: string }) => <div>guest screen {id}</div>,
}));
vi.mock("../src/ManagePage", () => ({
  ManagePage: ({ id }: { id: string }) => <div>manage screen {id}</div>,
}));
vi.mock("../src/LandingPage", () => ({ LandingPage: () => <div>landing screen</div> }));

import { AppRoutes } from "../src/AppRoutes";

// vite.config.ts sets globals:false, so RTL's auto-cleanup never registers.
afterEach(cleanup);

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

/** Several paths per test, and cleanup only fires between tests. */
function expectScreenAt(path: string, text: string) {
  renderAt(path);
  expect(screen.getByText(text)).toBeDefined();
  cleanup();
}

describe("AppRoutes", () => {
  it("resolves the four screens", () => {
    expectScreenAt("/", "landing screen");
    expectScreenAt("/create", "editor screen");
    expectScreenAt("/i/abc123", "guest screen abc123");
    expectScreenAt("/manage/abc123", "manage screen abc123");
  });

  it("sends unknown paths to the landing page, as the regex resolver did", () => {
    expectScreenAt("/nope", "landing screen");
    expectScreenAt("/i", "landing screen");
  });

  it("routes a malformed id to the screen, which reports it as a dead link", () => {
    // The route no longer diverts these to the marketing page: someone
    // following a broken share link needs to be told the link is broken. The
    // screens' hooks refuse to spend a malformed id on the API — covered in
    // usePublishedInvitation.test.ts and useHostManage.test.ts.
    expectScreenAt("/i/abc", "guest screen abc");
    expectScreenAt("/i/%2e%2e%2f%2e%2e%2fetc", "guest screen ../../etc");
    expectScreenAt("/manage/abc", "manage screen abc");
  });
});
