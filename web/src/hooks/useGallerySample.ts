import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { findSample, type GallerySample } from "../gallery";
import type { Language } from "../types";

/**
 * The gallery sample this editor session was opened with (adr-017 §4).
 *
 * Deliberately the same shape as `useReferralSource`: captured once at mount,
 * because the seeding it drives happens on the editor's first render and the
 * parameter is gone from the address bar by the next one. Stripping goes
 * through the router — never `history.replaceState` (adr-011 §4) — and
 * `replace` rather than a push, so the back button does not return to the
 * seeded URL and re-arm it.
 *
 * One parameter, not two: `?sample=` names the example, and its presence is
 * what marks the session as coming from the gallery. An unrecognised value is
 * simply no sample — this is a hint from a link, not a credential, and there
 * is nothing to gain by interpreting more of it than the gallery writes.
 */
export function useGallerySample(lang: Language): GallerySample | null {
  const location = useLocation();
  const navigate = useNavigate();
  const [sample] = useState<GallerySample | null>(() =>
    findSample(new URLSearchParams(location.search).get("sample") ?? "", lang),
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has("sample")) return;
    params.delete("sample");
    // Any other query parameter survives — this owns `sample` and nothing else.
    const search = params.toString();
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : "" },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  return sample;
}
