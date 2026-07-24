import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/api";
import { useHostInvitationCounts } from "../src/hooks/useHostInvitationCounts";
import type { HostInvitation } from "../src/hostInvitations";

const rows: HostInvitation[] = [
  { id: "aaa111", title: "Новосілля", published_at: "2026-08-01T10:00:00.000Z", palette: "warm" },
  {
    id: "bbb222",
    title: "День народження",
    published_at: "2026-08-02T10:00:00.000Z",
    palette: "warm",
  },
];

function counts(yes: number, no: number, guests: number) {
  return { yes, no, guests };
}

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("useHostInvitationCounts", () => {
  it("asks only about rows this browser still holds a token for", async () => {
    localStorage.setItem("inv-manage:aaa111", "a".repeat(32));
    // bbb222 has an index entry but no token — cleared storage, or an entry
    // that outlived its key. It must not appear in the request at all.
    const fetchCounts = vi.spyOn(api, "fetchRsvpCounts").mockResolvedValue({
      results: [{ id: "aaa111", status: "ok", counts: counts(3, 1, 5), new_since: 2 }],
    });

    const { result } = renderHook(() => useHostInvitationCounts(rows));

    await waitFor(() => expect(result.current.size).toBe(1));
    expect(fetchCounts).toHaveBeenCalledWith([{ id: "aaa111", token: "a".repeat(32) }]);
    expect(result.current.get("aaa111")).toEqual({ counts: counts(3, 1, 5), newSince: 2 });
    expect(result.current.has("bbb222")).toBe(false);
  });

  it("sends the seen marker when it has one, and omits it otherwise", async () => {
    localStorage.setItem("inv-manage:aaa111", "a".repeat(32));
    localStorage.setItem("inv-manage-seen:aaa111", "2026-08-03T00:00:00.000Z");
    localStorage.setItem("inv-manage:bbb222", "b".repeat(32));
    const fetchCounts = vi.spyOn(api, "fetchRsvpCounts").mockResolvedValue({ results: [] });

    renderHook(() => useHostInvitationCounts(rows));

    await waitFor(() => expect(fetchCounts).toHaveBeenCalled());
    expect(fetchCounts).toHaveBeenCalledWith([
      { id: "aaa111", token: "a".repeat(32), seen_at: "2026-08-03T00:00:00.000Z" },
      { id: "bbb222", token: "b".repeat(32) },
    ]);
  });

  it("one request covers every row, however many there are", async () => {
    for (const row of rows) localStorage.setItem(`inv-manage:${row.id}`, "c".repeat(32));
    const fetchCounts = vi.spyOn(api, "fetchRsvpCounts").mockResolvedValue({ results: [] });

    const { rerender } = renderHook(() => useHostInvitationCounts(rows));
    // A caller that rebuilds the array each render must not re-fire it.
    rerender();
    rerender();

    await waitFor(() => expect(fetchCounts).toHaveBeenCalledTimes(1));
    expect(fetchCounts.mock.calls[0][0]).toHaveLength(2);
  });

  it("drops refused and unknown ids instead of showing them as zero", async () => {
    for (const row of rows) localStorage.setItem(`inv-manage:${row.id}`, "c".repeat(32));
    vi.spyOn(api, "fetchRsvpCounts").mockResolvedValue({
      results: [
        { id: "aaa111", status: "ok", counts: counts(1, 0, 1), new_since: 0 },
        { id: "bbb222", status: "forbidden" },
      ],
    });

    const { result } = renderHook(() => useHostInvitationCounts(rows));

    await waitFor(() => expect(result.current.size).toBe(1));
    // A stale token is not "no replies yet" — the row shows nothing, and
    // /manage/:id explains it properly with the recovery.
    expect(result.current.has("bbb222")).toBe(false);
  });

  it("resolves to no counts when the request fails, and never throws", async () => {
    localStorage.setItem("inv-manage:aaa111", "a".repeat(32));
    vi.spyOn(api, "fetchRsvpCounts").mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useHostInvitationCounts(rows));

    await waitFor(() => expect(api.fetchRsvpCounts).toHaveBeenCalled());
    expect(result.current.size).toBe(0);
  });

  it("makes no request at all when no row has a token", async () => {
    const fetchCounts = vi.spyOn(api, "fetchRsvpCounts").mockResolvedValue({ results: [] });

    const { result } = renderHook(() => useHostInvitationCounts([]));
    renderHook(() => useHostInvitationCounts(rows));

    expect(fetchCounts).not.toHaveBeenCalled();
    expect(result.current.size).toBe(0);
  });
});
