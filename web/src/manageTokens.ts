// Where a manage token lives in the browser, and the only way to reach one.
//
// Both sides of every key go through the helpers here, so a write cannot drift
// from the reads that depend on it — a drifted key strands the host's access
// silently. The accessors moved out of `useHostManage.ts` when the keyring
// (adr-014 §5) needed a third writer.
//
// Two layers, memory first:
//
//  - An in-process map, which is what makes a signed-in host work at all on
//    private-mode Safari or with site data blocked. The keyring seeds it on
//    sign-in; before accounts, blocked storage meant every host feature
//    degraded, and several of these reads ran unguarded during render, where a
//    throw is a blank page rather than a lost preference.
//  - `localStorage`, best-effort in both directions. It is what carries access
//    past this tab for a host who never signs in — still the only path in an
//    unconfigured deployment (adr-014 §7).
//
// Nothing here is a credential store in the security sense: a manage token is
// a bearer secret, and this is the browser. It is the same exposure adr-005
// accepted, reached through one door instead of five.

const tokens = new Map<string, string>();
const seen = new Map<string, string>();

export function manageTokenKey(id: string): string {
  return `inv-manage:${id}`;
}

/** When this browser last looked at these responses — drives "N new since
 *  your last visit". Browser-local, like the token itself. */
export function manageSeenKey(id: string): string {
  return `inv-manage-seen:${id}`;
}

export function readManageToken(id: string): string | null {
  const held = tokens.get(id);
  if (held) return held;
  return safeRead(manageTokenKey(id));
}

export function writeManageToken(id: string, token: string): void {
  tokens.set(id, token);
  safeWrite(manageTokenKey(id), token);
}

export function readManageSeen(id: string): string | null {
  return seen.get(id) ?? safeRead(manageSeenKey(id));
}

export function writeManageSeen(id: string, at: string): void {
  seen.set(id, at);
  safeWrite(manageSeenKey(id), at);
}

/** Everything this browser can currently authorize, for the batch-counts
 *  request (FR-5.7): ids the caller asked about that we hold a token for. */
export function heldManageTokens(ids: string[]): Map<string, string> {
  const held = new Map<string, string>();
  for (const id of ids) {
    const token = readManageToken(id);
    if (token) held.set(id, token);
  }
  return held;
}

/** Drop the in-memory layer. A browser never needs this — a reload does it —
 *  but anything that clears `localStorage` out from under these accessors has
 *  to say so explicitly, because `localStorage.clear()` cannot reach a Map and
 *  would otherwise leave the tokens readable with no sign of where from. */
export function forgetHeldManageTokens(): void {
  tokens.clear();
  seen.clear();
}

function safeRead(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Private-mode Safari and blocked-storage settings throw on plain access,
    // and these run as useState initializers during render, where a throw is a
    // blank page.
    return null;
  }
}

function safeWrite(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // A blocked store degrades a feature; it never fails the action around it.
    // Notably publish, which has already succeeded server-side by the time the
    // token is written — and for a signed-in host the keyring is the way back
    // regardless.
  }
}
