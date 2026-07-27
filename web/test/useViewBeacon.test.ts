import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/api";
import type { LoadStatus } from "../src/hooks/usePublishedInvitation";
import { useViewBeacon } from "../src/hooks/useViewBeacon";

// vite.config.ts sets globals: false, so RTL never auto-cleans.
afterEach(cleanup);

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

function render(id: string, status: LoadStatus) {
  return renderHook(() => useViewBeacon(id, status));
}

describe("useViewBeacon", () => {
  it("counts a view once the invitation has loaded", () => {
    const beacon = vi.spyOn(api, "recordInvitationView").mockImplementation(() => {});

    render("abc123", "ready");

    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon).toHaveBeenCalledWith("abc123");
    expect(localStorage.getItem("inv-viewed:abc123")).not.toBeNull();
  });

  it("counts nothing before the invitation resolves, or when it never does", () => {
    const beacon = vi.spyOn(api, "recordInvitationView").mockImplementation(() => {});

    // A dead link is not a view, and neither is a failed request — the two
    // states the guest page works hardest to tell apart must not collapse
    // back into one number.
    for (const status of ["loading", "not_found", "error"] as const) {
      render("abc123", status);
    }

    expect(beacon).not.toHaveBeenCalled();
    expect(localStorage.getItem("inv-viewed:abc123")).toBeNull();
  });

  it("counts the same reader once across remounts", () => {
    const beacon = vi.spyOn(api, "recordInvitationView").mockImplementation(() => {});

    render("abc123", "ready");
    cleanup();
    render("abc123", "ready");
    cleanup();
    render("abc123", "ready");

    expect(beacon).toHaveBeenCalledTimes(1);
  });

  it("counts each invitation separately", () => {
    const beacon = vi.spyOn(api, "recordInvitationView").mockImplementation(() => {});

    render("abc123", "ready");
    cleanup();
    render("def456", "ready");

    expect(beacon).toHaveBeenCalledTimes(2);
    expect(beacon).toHaveBeenLastCalledWith("def456");
  });

  it("counts the view when it becomes ready, not while it is loading", () => {
    const beacon = vi.spyOn(api, "recordInvitationView").mockImplementation(() => {});

    const { rerender } = renderHook(
      ({ status }: { status: LoadStatus }) => useViewBeacon("abc123", status),
      { initialProps: { status: "loading" as LoadStatus } },
    );
    expect(beacon).not.toHaveBeenCalled();

    rerender({ status: "ready" });
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon).toHaveBeenCalledWith("abc123");
  });

  it("still counts when storage is blocked, and never throws at the guest", () => {
    // Private-mode Safari throws on any localStorage access. The page has to
    // render regardless; the server's per-day dedupe is the backstop.
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const beacon = vi.spyOn(api, "recordInvitationView").mockImplementation(() => {});

    expect(() => render("abc123", "ready")).not.toThrow();
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon).toHaveBeenCalledWith("abc123");
  });

  it("swallows a failed beacon — a metric never reaches the guest", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    expect(() => render("abc123", "ready")).not.toThrow();
    expect(fetchMock).toHaveBeenCalledWith("/api/invitations/abc123/view", { method: "POST" });
    // An unhandled rejection here would fail the suite; letting the
    // microtask queue drain is the assertion.
    await Promise.resolve();
  });
});
