import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { loadUiLang, saveUiLang } from "../i18n";
import { langFromSearch } from "../seo";
import type { Language } from "../types";

/**
 * The UI language for a page that has no language toggle of its own.
 *
 * `?lang=` wins over the stored preference and then writes it (adr-016 §5): it
 * is the more specific answer, and a crawler holds no stored preference at all
 * — the parameter is the only address the English pages have. Persisting it
 * matters because the next click is usually `/create`, which would otherwise
 * silently switch back.
 *
 * Read-only on purpose. `LandingPage` keeps its own `useState` because its
 * switcher must work on unknown paths too, where `*` renders it and there is
 * no language pair to navigate between — so it needs a value it can set
 * without the URL moving. The gallery pages have no switcher, so they need
 * only the resolution, and sharing a hook that returned a setter neither of
 * them wanted would be the worse trade.
 */
export function useUiLanguage(): Language {
  const location = useLocation();
  const urlLang = langFromSearch(location.search);

  useEffect(() => {
    if (urlLang) saveUiLang(urlLang);
  }, [urlLang]);

  return urlLang ?? loadUiLang();
}
