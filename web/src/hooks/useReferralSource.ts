import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { GenerateSource } from "../types";

/** Reads `?ref=guest` out of a query string. Pure, like `tokenFromHash`: the
 *  stripping is a separate step done in an effect, because a router
 *  navigation cannot happen during render.
 *
 *  Anything other than the one known value is `direct` — the parameter is a
 *  hint, not a credential, and there is nothing to gain by interpreting more
 *  of it than the CTA writes. */
export function sourceFromSearch(search: string): GenerateSource {
  return new URLSearchParams(search).get("ref") === "guest" ? "guest" : "direct";
}

/**
 * Where this editor session came from (adr-013 §3–4).
 *
 * Captured once at mount and held in state, because the generate call it
 * labels can be several chat turns and several minutes later — long after the
 * effect below has taken the parameter out of the address bar.
 *
 * The router does the stripping, via `navigate(..., { replace: true })`.
 * adr-011 §4 ended the split ownership of the history stack that had
 * `useHostManage` doing raw `history.replaceState` surgery; a second
 * hand-rolled URL rewrite would reopen exactly that. `replace` rather than a
 * push, so the back button doesn't return to the referred URL and re-arm it.
 */
export function useReferralSource(): GenerateSource {
  const location = useLocation();
  const navigate = useNavigate();
  const [source] = useState<GenerateSource>(() => sourceFromSearch(location.search));

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has("ref")) return;
    params.delete("ref");
    // Any other query parameters survive — this owns `ref` and nothing else.
    const search = params.toString();
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : "" },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  return source;
}
