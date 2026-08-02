import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type HostInvitation,
  loadHostInvitations,
  mergeHostInvitations,
  recordHostInvitation,
} from "../src/hostInvitations";

const entry = (over: Partial<HostInvitation> & { id: string }): HostInvitation => ({
  title: "Подія",
  published_at: "2026-08-01T10:00:00.000Z",
  palette: "warm",
  ...over,
});

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("hostInvitations", () => {
  it("returns an empty list for a browser that has published nothing", () => {
    expect(loadHostInvitations()).toEqual([]);
  });

  it("keeps the newest first regardless of insertion order", () => {
    recordHostInvitation(entry({ id: "old", published_at: "2026-08-01T10:00:00.000Z" }));
    recordHostInvitation(entry({ id: "new", published_at: "2026-08-09T10:00:00.000Z" }));
    recordHostInvitation(entry({ id: "mid", published_at: "2026-08-05T10:00:00.000Z" }));

    expect(loadHostInvitations().map((i) => i.id)).toEqual(["new", "mid", "old"]);
  });

  it("updates an entry in place on republish rather than duplicating it", () => {
    // A new version is the same event — the list must not grow a row per
    // republish.
    recordHostInvitation(entry({ id: "abc", title: "Чернетка" }));
    recordHostInvitation(entry({ id: "abc", title: "Мілані — 7 років!" }));

    const all = loadHostInvitations();
    expect(all).toHaveLength(1);
    expect(all[0]?.title).toBe("Мілані — 7 років!");
  });

  it("survives corrupt storage instead of breaking the landing page", () => {
    localStorage.setItem("inv-invitations", "{ not json");
    expect(loadHostInvitations()).toEqual([]);

    localStorage.setItem(
      "inv-invitations",
      JSON.stringify([{ nonsense: true }, entry({ id: "ok" })]),
    );
    expect(loadHostInvitations().map((i) => i.id)).toEqual(["ok"]);
  });

  it("never lets a storage failure break publishing", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    // The share link is what matters; this list is a nicety.
    expect(() => recordHostInvitation(entry({ id: "abc" }))).not.toThrow();
  });

  it("holds no secrets — the manage token lives under its own key", () => {
    recordHostInvitation(entry({ id: "abc" }));
    expect(localStorage.getItem("inv-invitations")).not.toContain("manage_token");
  });
});

describe("mergeHostInvitations", () => {
  it("leaves the local list alone until the keyring answers", () => {
    const local = [entry({ id: "abc" })];
    // `null` is signed out, unconfigured, or still in flight — none of which
    // may say anything about what this browser knows.
    expect(mergeHostInvitations(local, null)).toEqual(local);
  });

  it("lets the keyring win on the same id", () => {
    // Republished from another device: the record is current there and the
    // local copy is a stale title.
    const merged = mergeHostInvitations(
      [entry({ id: "abc", title: "Чернетка" })],
      [entry({ id: "abc", title: "Мілані — 7 років!" })],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.title).toBe("Мілані — 7 років!");
  });

  it("keeps an invitation this browser published before it signed in", () => {
    // The union is the whole point: an anonymous publish, or one from before
    // accounts existed, is in no keyring and must not vanish from the list.
    const merged = mergeHostInvitations(
      [entry({ id: "local-only" })],
      [entry({ id: "in-account" })],
    );
    expect(merged.map((i) => i.id).sort()).toEqual(["in-account", "local-only"]);
  });

  it("orders the union newest first, not local-then-keyring", () => {
    const merged = mergeHostInvitations(
      [entry({ id: "mine-old", published_at: "2026-08-01T10:00:00.000Z" })],
      [
        entry({ id: "acct-new", published_at: "2026-08-09T10:00:00.000Z" }),
        entry({ id: "acct-mid", published_at: "2026-08-05T10:00:00.000Z" }),
      ],
    );
    expect(merged.map((i) => i.id)).toEqual(["acct-new", "acct-mid", "mine-old"]);
  });

  it("renders a signed-in account that holds nothing as holding nothing", () => {
    // `[]` and `null` are different answers, and only this one is an answer.
    expect(mergeHostInvitations([], [])).toEqual([]);
  });
});
