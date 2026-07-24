import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ApiError, fetchInvitation, fetchRsvps } from "../api";
import { isInvitationId } from "../invitationId";
import type { PublishedInvitation, RsvpSummary } from "../types";

/** Every outcome the host can land in. Access failures are deliberately three
 *  distinct states, not one "error": "we never had a key", "the key we had is
 *  refused", and "there is no such invitation" need different words and
 *  different recovery (adr-010 §7). */
export type ManageStatus =
  | "loading"
  | "ready"
  | "no_token"
  | "invalid_token"
  | "not_found"
  | "error";

export function manageTokenKey(id: string): string {
  return `inv-manage:${id}`;
}

/** When this browser last looked at these responses — drives "N new since
 *  your last visit". Browser-local, like the token itself. */
export function manageSeenKey(id: string): string {
  return `inv-manage-seen:${id}`;
}

/** Reads `#t=<token>` out of a hash. Pure: persisting the token and stripping
 *  the fragment are separate steps, done in an effect, because a router
 *  navigation cannot happen during render.
 *  Fragment and never query string: fragments are not sent to the server, so
 *  the token stays out of access logs and referrer headers (adr-010 §2). */
export function tokenFromHash(hash: string): string | null {
  const token = hash.match(/[#&]t=([^&]+)/)?.[1];
  return token ? decodeURIComponent(token) : null;
}

/** Accepts what a host pastes into the recovery field: a whole manage link, or
 *  a bare token on its own. Returns null when it is neither, so the UI can say
 *  "that doesn't look like your link" instead of firing a doomed request. */
export function tokenFromManageLink(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const fragment = trimmed.match(/[#&]t=([^&\s]+)/)?.[1];
  if (fragment) return decodeURIComponent(fragment);
  // Manage tokens are 16 random bytes as hex (server/src/store.ts).
  return /^[0-9a-f]{32}$/i.test(trimmed) ? trimmed : null;
}

function classify(error: unknown): ManageStatus {
  if (error instanceof ApiError) {
    if (error.status === 403) return "invalid_token";
    if (error.status === 404) return "not_found";
  }
  return "error";
}

/**
 * Everything behind `/manage/:id`: which token we hold, and what the server
 * says when we spend it. The invitation itself comes from the public endpoint
 * and the responses from the token-gated one, so a valid link yields both in
 * one pass.
 */
export function useHostManage(id: string) {
  const location = useLocation();
  const navigate = useNavigate();
  // An id the server could never have minted gets no token work at all: no
  // fragment adopted, nothing written under a garbage key (adr-011 §3).
  const valid = isInvitationId(id);
  // The token the host arrived with, read from the router's location rather
  // than window.location — one thing owns the URL now (adr-011 §5). Read
  // during render, acted on in the effect below.
  const fragmentToken = valid ? tokenFromHash(location.hash) : null;
  // Wrapped in an object so a retry can hand the effect a fresh identity:
  // re-submitting the *same* token has to re-run the load, and a bare string
  // compares equal and would sit there doing nothing.
  const [session, setSession] = useState<{ token: string | null }>(() => ({
    // Fragment first (the host just followed their manage link), then whatever
    // this browser already stored from publishing.
    token: valid ? (fragmentToken ?? localStorage.getItem(manageTokenKey(id))) : null,
  }));
  const token = session.token;
  const [published, setPublished] = useState<PublishedInvitation | null>(null);
  const [summary, setSummary] = useState<RsvpSummary | null>(null);
  const [status, setStatus] = useState<ManageStatus>(() => {
    if (!valid) return "not_found";
    return token ? "loading" : "no_token";
  });
  const [refreshing, setRefreshing] = useState(false);
  // Mirrors `refreshing` for the guard, so `refresh` keeps a stable identity
  // and the visibility listener below doesn't churn on every toggle.
  const refreshingRef = useRef(false);

  // Captured once, before the effect below moves the marker forward — read
  // during render precisely so StrictMode's double-invoked effects can't
  // overwrite the baseline with "now" and report zero new replies.
  const baselineRef = useRef<string | null | undefined>(undefined);
  if (baselineRef.current === undefined) {
    baselineRef.current = localStorage.getItem(manageSeenKey(id));
  }

  useEffect(() => {
    if (!valid) return;
    localStorage.setItem(manageSeenKey(id), new Date().toISOString());
  }, [id, valid]);

  // Keep the token, drop it from the address bar so the credential stops
  // trailing the tab around. `replace` rather than a push: the URL with the
  // token in it should not be somewhere the back button can return to.
  useEffect(() => {
    if (!fragmentToken) return;
    localStorage.setItem(manageTokenKey(id), fragmentToken);
    navigate({ pathname: location.pathname, search: location.search }, { replace: true });
  }, [fragmentToken, id, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!valid) {
      setStatus("not_found");
      return;
    }
    if (!session.token) {
      setStatus("no_token");
      return;
    }
    let active = true;
    setStatus("loading");
    Promise.all([fetchInvitation(id), fetchRsvps(id, session.token)])
      .then(([invitation, rsvpSummary]) => {
        if (!active) return;
        setPublished(invitation);
        setSummary(rsvpSummary);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        // The stored token is kept even when refused — the paste field
        // overwrites it, and silently dropping it would turn a temporary
        // server-side problem into permanent loss of access.
        setStatus(classify(error));
      });
    return () => {
      active = false;
    };
  }, [id, session, valid]);

  /** Re-read the responses only; the invitation rarely changes under a host
   *  who is watching replies arrive. Failures surface — the old silent
   *  `finally`-only path left the spinner stopping with nothing said. */
  const refresh = useCallback(async () => {
    if (!token || refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      setSummary(await fetchRsvps(id, token));
      setStatus("ready");
    } catch (error) {
      setStatus(classify(error));
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [id, token]);

  // A host who left the tab open and came back should see current numbers.
  // Cheaper and calmer than polling: no timers, and it matches how people
  // actually use this page (check, background it, check again).
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible") void refresh();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [refresh]);

  /** Recovery for the no-token and invalid-token states. Returns false when
   *  the pasted text carries no token, leaving the current state untouched. */
  const applyManageLink = useCallback(
    (input: string): boolean => {
      const parsed = tokenFromManageLink(input);
      if (!parsed || !valid) return false;
      localStorage.setItem(manageTokenKey(id), parsed);
      setSession({ token: parsed });
      return true;
    },
    [id, valid],
  );

  const retry = useCallback(() => setSession((current) => ({ token: current.token })), []);

  // Replies that arrived since the last visit. Only live answers count — a
  // guest amending an old answer is news, their superseded original is not.
  // Zero on a first-ever visit: "everything is new" tells the host nothing.
  const baseline = baselineRef.current;
  const newSinceLastVisit =
    baseline && summary
      ? summary.rsvps.filter((rsvp) => !rsvp.superseded && rsvp.created_at > baseline).length
      : 0;

  return {
    status,
    published,
    summary,
    refreshing,
    refresh,
    applyManageLink,
    retry,
    newSinceLastVisit,
    /** Baseline for "new" markers in the list; null on a first visit. */
    seenAt: baseline,
  };
}
