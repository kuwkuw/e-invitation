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

/** The id guard's whole job: the landing page, and no screen that would have
 *  taken the id straight to the API (adr-011 §3). */
function expectRefusedId(path: string) {
  renderAt(path);
  expect(screen.getByText("landing screen")).toBeDefined();
  expect(screen.queryByText(/guest screen|manage screen/)).toBeNull();
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

  it("refuses a malformed id instead of passing it to the screen", () => {
    // `:id` matches any segment, so without the guard these would reach
    // fetchInvitation with whatever was in the URL.
    expectRefusedId("/i/abc");
    expectRefusedId("/i/abc.123");
    expectRefusedId(`/i/${"a".repeat(33)}`);
    expectRefusedId("/manage/abc");
  });

  it("refuses a percent-encoded traversal in the id position", () => {
    expectRefusedId("/i/%2e%2e%2f%2e%2e%2fetc");
  });
});
