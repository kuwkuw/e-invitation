import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/api";
import { tokenFromManageLink } from "../src/hooks/useHostManage";
import { manageUrl, shareUrl, usePublishing } from "../src/hooks/usePublishing";

const RESULT = { id: "abc123", version: 1, manage_token: "b".repeat(32) };

const invitation = {
  brief: {},
  copy: {},
  design: {},
} as unknown as Parameters<ReturnType<typeof usePublishing>["share"]>[0];

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("link building", () => {
  it("keeps the manage token in the fragment, never the query string", () => {
    const url = manageUrl("abc123", "deadbeef");
    // The fragment is not sent to the server: no access logs, no referrer
    // leakage (adr-010 §2).
    expect(url).toContain("/manage/abc123#t=deadbeef");
    expect(url).not.toContain("?");
  });

  it("round-trips: what the panel copies is what the dashboard accepts", () => {
    // These two live in different modules; if they ever disagree, a host's
    // manage link silently stops working.
    expect(tokenFromManageLink(manageUrl("abc123", "c".repeat(32)))).toBe("c".repeat(32));
  });

  it("builds a share link that carries no token at all", () => {
    expect(shareUrl("abc123")).toMatch(/\/i\/abc123$/);
    expect(shareUrl("abc123")).not.toContain("#");
  });
});

describe("usePublishing", () => {
  it("stores the manage token so /manage/:id works after this tab closes", async () => {
    vi.spyOn(api, "publishInvitation").mockResolvedValue(RESULT);
    const { result } = renderHook(() => usePublishing(() => {}));

    await act(async () => {
      await result.current.share(invitation);
    });

    expect(localStorage.getItem("inv-manage:abc123")).toBe(RESULT.manage_token);
    expect(result.current.shareOpen).toBe(true);
  });

  it("copies the two links to separate confirmations", async () => {
    vi.spyOn(api, "publishInvitation").mockResolvedValue(RESULT);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const { result } = renderHook(() => usePublishing(() => {}));
    await act(async () => {
      await result.current.share(invitation);
    });

    await act(async () => {
      await result.current.copyLink();
    });
    expect(writeText).toHaveBeenLastCalledWith(shareUrl("abc123"));
    expect(result.current.copied).toBe(true);
    // The public copy must not light up the manage confirmation, or the
    // "keep it private" warning would appear at the wrong moment.
    expect(result.current.manageCopied).toBe(false);

    await act(async () => {
      await result.current.copyManageLink();
    });
    expect(writeText).toHaveBeenLastCalledWith(manageUrl("abc123", RESULT.manage_token));
    expect(result.current.manageCopied).toBe(true);
  });

  it("reports a failed publish instead of opening an empty panel", async () => {
    vi.spyOn(api, "publishInvitation").mockRejectedValue(new Error("boom"));
    const onError = vi.fn();
    const { result } = renderHook(() => usePublishing(onError));

    await act(async () => {
      await result.current.share(invitation);
    });

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(result.current.shareOpen).toBe(false);
    expect(result.current.published).toBeNull();
  });
});
