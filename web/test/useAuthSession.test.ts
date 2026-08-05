import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthSession } from "../src/hooks/useAuthSession";
import { loadHostInvitations } from "../src/hostInvitations";
import { forgetHeldManageTokens, manageTokenKey, readManageToken } from "../src/manageTokens";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    json: async () => body,
  } as Response;
}

/** Routes the calls the hook makes, so a test can vary any of them.
 *  `keyringAfterClaim` answers the *second* read — the one a successful claim
 *  triggers — so a test can show the account gaining what was just filed. */
function stubApi(handlers: {
  session: unknown;
  keyring?: unknown;
  keyringStatus?: number;
  keyringAfterClaim?: unknown;
  claim?: unknown;
  claimStatus?: number;
}) {
  let keyringReads = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/auth/session")) return jsonResponse(handlers.session);
    if (url.includes("/api/account/claim")) {
      return jsonResponse(
        handlers.claim ?? { results: [], linked: 0 },
        handlers.claimStatus ?? 200,
      );
    }
    if (url.includes("/api/account/keyring")) {
      keyringReads += 1;
      const after = handlers.keyringAfterClaim;
      const body =
        keyringReads > 1 && after !== undefined ? after : (handlers.keyring ?? { invitations: [] });
      return jsonResponse(body, handlers.keyringStatus ?? 200);
    }
    if (url.includes("/api/auth/signout")) return jsonResponse(null, 204);
    if (url.includes("/api/account") && !url.includes("keyring") && !url.includes("claim")) {
      return jsonResponse({ deleted: true, invitations_retained: 2 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** The body of the claim request, or null if none was made. */
function claimedItems(
  fetchMock: ReturnType<typeof stubApi>,
): { id: string; token: string }[] | null {
  const call = fetchMock.mock.calls.find(([input]) => String(input).includes("/api/account/claim"));
  return call ? JSON.parse(String(call[1]?.body)).items : null;
}

const entry = {
  id: "abc123xy",
  manage_token: "0123456789abcdef0123456789abcdef",
  title: "День народження Олени",
  published_at: "2026-07-01T00:00:00.000Z",
  palette: "warm" as const,
};

beforeEach(() => {
  localStorage.clear();
  forgetHeldManageTokens();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useAuthSession", () => {
  it("reports a deployment with no OAuth client as unavailable", async () => {
    stubApi({ session: { configured: false, signed_in: false, email: null } });
    const { result } = renderHook(() => useAuthSession());
    await waitFor(() => expect(result.current.status).toBe("unavailable"));
    // Not a disabled affordance — there is nothing to offer (adr-014 §7).
    expect(result.current.email).toBeNull();
  });

  it("reports signed out without touching stored tokens", async () => {
    localStorage.setItem(manageTokenKey("abc123xy"), "already-here");
    stubApi({ session: { configured: true, signed_in: false, email: null } });

    const { result } = renderHook(() => useAuthSession());
    await waitFor(() => expect(result.current.status).toBe("signed_out"));
    expect(readManageToken("abc123xy")).toBe("already-here");
  });

  // adr-014 §5: the keyring seeds the state the app already runs on, so no
  // other hook needs to know accounts exist.
  it("seeds manage tokens and the returning-host list on sign-in", async () => {
    stubApi({
      session: { configured: true, signed_in: true, email: "host@example.com" },
      keyring: { invitations: [entry] },
    });

    const { result } = renderHook(() => useAuthSession());
    await waitFor(() => expect(result.current.status).toBe("signed_in"));
    await waitFor(() => expect(readManageToken(entry.id)).toBe(entry.manage_token));

    expect(result.current.email).toBe("host@example.com");
    // Written under the key every other reader already uses.
    expect(localStorage.getItem(manageTokenKey(entry.id))).toBe(entry.manage_token);
    expect(loadHostInvitations()).toEqual([
      { id: entry.id, title: entry.title, published_at: entry.published_at, palette: "warm" },
    ]);
  });

  // Claiming (adr-014 §5) is what stops the landing list being two-class: an
  // invitation published before the host ever signed in is knowable only in
  // this browser until something files it into the account.
  it("files a token the account does not know about, then re-reads the keyring", async () => {
    localStorage.setItem(manageTokenKey(entry.id), entry.manage_token);
    const fetchMock = stubApi({
      session: { configured: true, signed_in: true, email: "host@example.com" },
      keyring: { invitations: [] },
      claim: { results: [{ id: entry.id, status: "ok" }], linked: 1 },
      keyringAfterClaim: { invitations: [entry] },
    });

    const { result } = renderHook(() => useAuthSession());
    await waitFor(() => expect(result.current.invitations).toHaveLength(1));

    expect(claimedItems(fetchMock)).toEqual([{ id: entry.id, token: entry.manage_token }]);
    // The re-read is what makes the row real: title and palette live on the
    // record, not in this browser's token.
    expect(loadHostInvitations()).toEqual([
      { id: entry.id, title: entry.title, published_at: entry.published_at, palette: "warm" },
    ]);
  });

  it("sends no claim when the account already holds everything", async () => {
    localStorage.setItem(manageTokenKey(entry.id), entry.manage_token);
    const fetchMock = stubApi({
      session: { configured: true, signed_in: true, email: "host@example.com" },
      keyring: { invitations: [entry] },
    });

    const { result } = renderHook(() => useAuthSession());
    await waitFor(() => expect(result.current.invitations).toHaveLength(1));

    // The ordinary sign-in holds nothing new and must cost no extra request.
    expect(claimedItems(fetchMock)).toBeNull();
  });

  it("never sends an id the server would reject the whole batch for", async () => {
    localStorage.setItem(manageTokenKey(entry.id), entry.manage_token);
    // A hand-edited or half-written key. One of these in the body is a 400,
    // and a 400 costs the host every other invitation in the batch.
    localStorage.setItem("inv-manage:../etc/passwd", "junk");
    const fetchMock = stubApi({
      session: { configured: true, signed_in: true, email: "host@example.com" },
      keyring: { invitations: [] },
      claim: { results: [{ id: entry.id, status: "ok" }], linked: 1 },
      keyringAfterClaim: { invitations: [entry] },
    });

    renderHook(() => useAuthSession());
    await waitFor(() => expect(claimedItems(fetchMock)).not.toBeNull());
    expect(claimedItems(fetchMock)).toEqual([{ id: entry.id, token: entry.manage_token }]);
  });

  it("never surfaces a failed claim as a broken sign-in", async () => {
    localStorage.setItem(manageTokenKey(entry.id), entry.manage_token);
    stubApi({
      session: { configured: true, signed_in: true, email: "host@example.com" },
      keyring: { invitations: [] },
      claimStatus: 500,
    });

    const { result } = renderHook(() => useAuthSession());
    // The session is good and the keyring read succeeded; one filing did not.
    await waitFor(() => expect(result.current.status).toBe("signed_in"));
    await waitFor(() => expect(result.current.invitations).toEqual([]));
    // And the host keeps every token they had — the next sign-in retries.
    expect(readManageToken(entry.id)).toBe(entry.manage_token);
  });

  it("still serves tokens in memory when storage is blocked", async () => {
    // Private-mode Safari: every localStorage call throws.
    const blocked = () => {
      throw new Error("blocked");
    };
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
    stubApi({
      session: { configured: true, signed_in: true, email: "host@example.com" },
      keyring: { invitations: [entry] },
    });

    const { result } = renderHook(() => useAuthSession());
    await waitFor(() => expect(result.current.status).toBe("signed_in"));
    // The seed lands in memory first, which is the whole reason it exists —
    // before accounts, a blocked store meant every host feature degraded.
    await waitFor(() => expect(readManageToken(entry.id)).toBe(entry.manage_token));
    vi.restoreAllMocks();
  });

  it("never surfaces a failed keyring fetch as a broken sign-in", async () => {
    stubApi({
      session: { configured: true, signed_in: true, email: "host@example.com" },
      keyringStatus: 500,
    });

    const { result } = renderHook(() => useAuthSession());
    // Signed in is still true — the account is fine, one fetch was not.
    await waitFor(() => expect(result.current.status).toBe("signed_in"));
    expect(loadHostInvitations()).toEqual([]);
  });

  it("keeps this browser's tokens after signing out", async () => {
    stubApi({
      session: { configured: true, signed_in: true, email: "host@example.com" },
      keyring: { invitations: [entry] },
    });
    const { result } = renderHook(() => useAuthSession());
    await waitFor(() => expect(readManageToken(entry.id)).toBe(entry.manage_token));

    await result.current.signOut();

    await waitFor(() => expect(result.current.status).toBe("signed_out"));
    // Sign-out ends the account session; it does not revoke a capability the
    // host held before they ever signed in (adr-014 §1).
    expect(readManageToken(entry.id)).toBe(entry.manage_token);
  });

  it("keeps this browser's invitations after deleting the account", async () => {
    stubApi({
      session: { configured: true, signed_in: true, email: "host@example.com" },
      keyring: { invitations: [entry] },
    });
    const { result } = renderHook(() => useAuthSession());
    await waitFor(() => expect(readManageToken(entry.id)).toBe(entry.manage_token));

    const deletion = await result.current.deleteAccount();

    // The honest answer to "will this delete my events" is no, and the count
    // is what lets the UI say so (adr-014 §9).
    expect(deletion.invitations_retained).toBe(2);
    await waitFor(() => expect(result.current.status).toBe("signed_out"));
    // Taking the tokens would turn "delete my account" into "lose my
    // invitations" — they are what the host has left.
    expect(readManageToken(entry.id)).toBe(entry.manage_token);
  });
});
