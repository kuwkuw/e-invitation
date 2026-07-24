import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation, useNavigationType } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/api";
import { ApiError } from "../src/api";
import { manageTokenKey, tokenFromManageLink, useHostManage } from "../src/hooks/useHostManage";
import type { PublishedInvitation, RsvpSummary } from "../src/types";

const ID = "abc123";
const TOKEN = "a".repeat(32);

const published = { id: ID, version: 1 } as PublishedInvitation;
const summary: RsvpSummary = { rsvps: [], counts: { yes: 0, no: 0, guests: 0 } };

function apiError(status: number): ApiError {
  const error = new ApiError("nope");
  error.status = status;
  return error;
}

/** The hook reads the URL through the router now, so tests hand it a
 *  MemoryRouter entry instead of writing window.location (adr-011 §5). */
function at(entry: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
  );
}

const wrapper = at(`/manage/${ID}`);

/** The hook plus the location it acts on, for the tests that check what
 *  happened to the address bar. */
function renderWithLocation(id: string, entry: string) {
  return renderHook(
    () => ({
      manage: useHostManage(id),
      location: useLocation(),
      navigationType: useNavigationType(),
    }),
    { wrapper: at(entry) },
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("tokenFromManageLink", () => {
  it("accepts a whole manage link, a bare token, and rejects anything else", () => {
    expect(tokenFromManageLink(`https://invito.ua/manage/${ID}#t=${TOKEN}`)).toBe(TOKEN);
    expect(tokenFromManageLink(`  ${TOKEN}  `)).toBe(TOKEN);
    expect(tokenFromManageLink(`https://invito.ua/i/${ID}`)).toBeNull();
    expect(tokenFromManageLink("")).toBeNull();
    // A share link is the thing a host is most likely to paste by mistake.
    expect(tokenFromManageLink("not-a-token")).toBeNull();
  });
});

describe("useHostManage", () => {
  it("adopts a token from the URL fragment, stores it, and strips the fragment", async () => {
    vi.spyOn(api, "fetchInvitation").mockResolvedValue(published);
    const rsvps = vi.spyOn(api, "fetchRsvps").mockResolvedValue(summary);

    const { result } = renderWithLocation(ID, `/manage/${ID}#t=${TOKEN}`);

    await waitFor(() => expect(result.current.manage.status).toBe("ready"));
    expect(rsvps).toHaveBeenCalledWith(ID, TOKEN);
    // Persisted so the next visit needs no link...
    expect(localStorage.getItem(manageTokenKey(ID))).toBe(TOKEN);
    // ...and removed from the address bar so the credential stops trailing
    // the tab around (adr-010 §2). The router's location is the one that
    // matters now — a replaceState behind its back would leave it stale.
    expect(result.current.location.hash).toBe("");
    expect(result.current.location.pathname).toBe(`/manage/${ID}`);
  });

  it("falls back to the stored token when there is no fragment", async () => {
    vi.spyOn(api, "fetchInvitation").mockResolvedValue(published);
    const rsvps = vi.spyOn(api, "fetchRsvps").mockResolvedValue(summary);
    localStorage.setItem(manageTokenKey(ID), TOKEN);

    const { result } = renderHook(() => useHostManage(ID), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(rsvps).toHaveBeenCalledWith(ID, TOKEN);
    expect(result.current.summary).toEqual(summary);
  });

  it("asks for the link when no token is available anywhere", () => {
    const invitation = vi.spyOn(api, "fetchInvitation");
    const { result } = renderHook(() => useHostManage(ID), { wrapper });

    expect(result.current.status).toBe("no_token");
    // Nothing to spend — don't fire a doomed request.
    expect(invitation).not.toHaveBeenCalled();
  });

  it.each([
    [403, "invalid_token"],
    [404, "not_found"],
  ])("maps %i to the %s state", async (httpStatus, expected) => {
    vi.spyOn(api, "fetchInvitation").mockResolvedValue(published);
    vi.spyOn(api, "fetchRsvps").mockRejectedValue(apiError(httpStatus));
    localStorage.setItem(manageTokenKey(ID), TOKEN);

    const { result } = renderHook(() => useHostManage(ID), { wrapper });

    await waitFor(() => expect(result.current.status).toBe(expected));
    // A refused token is kept, not dropped: the paste field overwrites it, and
    // discarding it would turn a transient failure into permanent lockout.
    expect(localStorage.getItem(manageTokenKey(ID))).toBe(TOKEN);
  });

  it("reports a network failure as a retryable error, never a silent stall", async () => {
    vi.spyOn(api, "fetchInvitation").mockRejectedValue(new Error("network"));
    vi.spyOn(api, "fetchRsvps").mockRejectedValue(new Error("network"));
    localStorage.setItem(manageTokenKey(ID), TOKEN);

    const { result } = renderHook(() => useHostManage(ID), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("error"));
  });

  it("recovers from no_token when the host pastes their manage link", async () => {
    vi.spyOn(api, "fetchInvitation").mockResolvedValue(published);
    vi.spyOn(api, "fetchRsvps").mockResolvedValue(summary);

    const { result } = renderHook(() => useHostManage(ID), { wrapper });
    expect(result.current.status).toBe("no_token");

    act(() => {
      expect(result.current.applyManageLink(`https://invito.ua/manage/${ID}#t=${TOKEN}`)).toBe(
        true,
      );
    });

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(localStorage.getItem(manageTokenKey(ID))).toBe(TOKEN);
  });

  it("rejects a paste with no token in it and stays put", () => {
    const { result } = renderHook(() => useHostManage(ID), { wrapper });

    act(() => {
      expect(result.current.applyManageLink("https://invito.ua/i/abc123")).toBe(false);
    });

    expect(result.current.status).toBe("no_token");
    expect(localStorage.getItem(manageTokenKey(ID))).toBeNull();
  });

  it("surfaces a refresh failure instead of leaving the old list looking current", async () => {
    vi.spyOn(api, "fetchInvitation").mockResolvedValue(published);
    const rsvps = vi.spyOn(api, "fetchRsvps").mockResolvedValue(summary);
    localStorage.setItem(manageTokenKey(ID), TOKEN);

    const { result } = renderHook(() => useHostManage(ID), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    rsvps.mockRejectedValueOnce(apiError(403));
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.status).toBe("invalid_token");
  });

  it("treats a malformed id as a dead link without asking the server", () => {
    const fetchInvitation = vi.spyOn(api, "fetchInvitation");
    const fetchRsvps = vi.spyOn(api, "fetchRsvps");

    for (const id of ["", "abc", "../../etc/passwd"]) {
      const { result } = renderHook(() => useHostManage(id), { wrapper: at(`/manage/${id}`) });
      expect(result.current.status).toBe("not_found");
    }
    expect(fetchInvitation).not.toHaveBeenCalled();
    expect(fetchRsvps).not.toHaveBeenCalled();
  });

  it("replaces the tokened entry rather than pushing past it", async () => {
    vi.spyOn(api, "fetchInvitation").mockResolvedValue(published);
    vi.spyOn(api, "fetchRsvps").mockResolvedValue(summary);

    const { result } = renderWithLocation(ID, `/manage/${ID}#t=${TOKEN}`);

    await waitFor(() => expect(result.current.location.hash).toBe(""));
    // A push would leave the credential one Back press away and grow the
    // history on every visit. Asserting the navigation type rather than where
    // Back lands, because the effect would simply re-strip a restored
    // fragment and hide the difference.
    expect(result.current.navigationType).toBe("REPLACE");
  });

  it("stores nothing under a malformed id, fragment token or not", () => {
    const { result } = renderWithLocation("abc", `/manage/abc#t=${TOKEN}`);

    expect(result.current.manage.status).toBe("not_found");
    // Neither the token nor the last-seen marker may be written under a key
    // the server could never have minted (adr-011 §3).
    expect(localStorage.length).toBe(0);
    // And the fragment is left alone rather than stripped, because nothing
    // adopted it.
    expect(result.current.location.hash).toBe(`#t=${TOKEN}`);
  });

  it("refuses a pasted manage link when the id itself is malformed", () => {
    const { result } = renderHook(() => useHostManage("abc"), { wrapper: at("/manage/abc") });

    let accepted = true;
    act(() => {
      accepted = result.current.applyManageLink(TOKEN);
    });

    expect(accepted).toBe(false);
    expect(localStorage.length).toBe(0);
  });
});
