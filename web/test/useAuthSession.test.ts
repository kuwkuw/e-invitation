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

/** Routes the two calls the hook makes, so a test can vary either. */
function stubApi(handlers: { session: unknown; keyring?: unknown; keyringStatus?: number }) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/auth/session")) return jsonResponse(handlers.session);
    if (url.includes("/api/account/keyring")) {
      return jsonResponse(handlers.keyring ?? { invitations: [] }, handlers.keyringStatus ?? 200);
    }
    if (url.includes("/api/auth/signout")) return jsonResponse(null, 204);
    if (url.includes("/api/account") && !url.includes("keyring")) {
      return jsonResponse({ deleted: true, invitations_retained: 2 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
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
