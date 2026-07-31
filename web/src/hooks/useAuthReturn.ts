import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/** What Google's callback told us, read from `?auth=` on the way back in. */
export type AuthReturn = "ok" | "failed" | "declined";

const RESULTS: AuthReturn[] = ["ok", "failed", "declined"];

export interface AuthReturnState {
  result: AuthReturn | null;
  /** The coarse failure class, rendered as `auth_<code>_failed` for support.
   *  Only ever present with `failed`. */
  code: string | null;
}

/**
 * The sign-in result the callback redirected back with, captured once at mount
 * and stripped from the URL through the router — exactly as `useReferralSource`
 * handles `?ref` and `useHostManage` handles `#t=` (adr-011 §4). Nothing may
 * call `history.replaceState` behind the router.
 *
 * Held in state rather than re-read from the location, because the strip
 * happens immediately and the gate has to keep rendering the outcome after the
 * parameter is gone.
 */
export function useAuthReturn(): AuthReturnState {
  const location = useLocation();
  const navigate = useNavigate();
  const [captured] = useState<AuthReturnState>(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("auth");
    const result = RESULTS.find((value) => value === raw) ?? null;
    return { result, code: result === "failed" ? params.get("auth_code") : null };
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has("auth") && !params.has("auth_code")) return;
    params.delete("auth");
    params.delete("auth_code");
    const search = params.toString();
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : "" },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  return captured;
}
