import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("still opens the panel when storage is blocked", async () => {
    // Private-mode Safari and blocked-storage settings throw on setItem. The
    // publish already succeeded server-side by then, so treating the throw as
    // a publish failure would hide a live invitation from its own host — and
    // the share panel is where the manage link that survives this browser is.
    vi.spyOn(api, "publishInvitation").mockResolvedValue(RESULT);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    const onError = vi.fn();
    const { result } = renderHook(() => usePublishing(onError));

    await act(async () => {
      await result.current.share(invitation);
    });

    expect(onError).not.toHaveBeenCalled();
    expect(result.current.shareOpen).toBe(true);
    expect(result.current.published).toEqual(RESULT);
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

// 01-vision intent 4. The guest page has had the native sheet since it
// shipped; the host — at the one moment the whole loop depends on — had
// "copy, leave the app, find Viber, paste".
describe("the native share sheet", () => {
  // A fresh one per test: the published-title case mutates it on purpose.
  const titled = () =>
    ({
      brief: {},
      copy: { title: "Ювілей Олени" },
      design: {},
    }) as unknown as Parameters<ReturnType<typeof usePublishing>["share"]>[0];

  afterEach(() => {
    // Assigned rather than spied, so `restoreAllMocks` will not take it back —
    // and a leaked `navigator.share` makes `canShare` true for every test
    // after this one, which is exactly the assertion those tests rest on.
    Reflect.deleteProperty(navigator, "share");
  });

  async function publishedWith(share: () => Promise<void>, invitation = titled()) {
    vi.spyOn(api, "publishInvitation").mockResolvedValue(RESULT);
    // Before the render: `canShare` is read once, in a state initializer.
    Object.assign(navigator, { share });
    const { result } = renderHook(() => usePublishing(() => {}));
    await act(async () => {
      await result.current.share(invitation);
    });
    return result;
  }

  it("hands the guest link — and only the guest link — to the sheet", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const result = await publishedWith(share);
    expect(result.current.canShare).toBe(true);

    await act(async () => {
      await result.current.shareLink();
    });

    expect(share).toHaveBeenCalledWith({ title: "Ювілей Олени", url: shareUrl("abc123") });
    // The manage token is a bearer secret; it has no business in a share sheet
    // whose targets are group chats (adr-010 §3).
    expect(JSON.stringify(share.mock.calls)).not.toContain(RESULT.manage_token);
  });

  it("names the invitation as published, not as edited since", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const invitation = titled();
    const result = await publishedWith(share, invitation);
    // The editor keeps running after a publish. What the link resolves to does
    // not change until the host republishes, so neither does what we call it.
    invitation.copy.title = "Renamed but not republished";

    await act(async () => {
      await result.current.shareLink();
    });

    expect(share.mock.calls[0][0].title).toBe("Ювілей Олени");
  });

  it("treats a dismissed sheet as a decision, not as a failure", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const result = await publishedWith(
      vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError")),
    );

    await act(async () => {
      await result.current.shareLink();
    });

    // Copying anyway would pop "Copied!" over a deliberate cancel and answer a
    // question the host had just declined to answer.
    expect(writeText).not.toHaveBeenCalled();
    expect(result.current.copied).toBe(false);
  });

  it("falls back to the clipboard when the sheet itself fails", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const result = await publishedWith(
      vi.fn().mockRejectedValue(new DOMException("not allowed", "NotAllowedError")),
    );

    await act(async () => {
      await result.current.shareLink();
    });

    // A host who pressed Share and got nothing is worse off than before this
    // existed, so a real failure still leaves them holding the link.
    expect(writeText).toHaveBeenLastCalledWith(shareUrl("abc123"));
    expect(result.current.copied).toBe(true);
  });

  it("reports no sheet where the browser has none", () => {
    const { result } = renderHook(() => usePublishing(() => {}));
    expect(result.current.canShare).toBe(false);
  });
});
