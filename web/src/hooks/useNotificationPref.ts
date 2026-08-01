import { useCallback, useEffect, useState } from "react";
import { fetchNotificationPref, setNotificationPref } from "../api";

/**
 * Whether this host wants email about replies (adr-015 §7).
 *
 * **One switch for the whole account**, not per invitation: a mail client's
 * one-click unsubscribe promises "stop sending me this kind of mail", and a
 * host who clicks it and keeps getting mail about their other events reports
 * the next one as spam. Per-event control is a later question.
 *
 * State lives here rather than in `SharePanel` so the panel stays composition,
 * the way every other piece of editor state already works.
 *
 * **Optimistic, and it stays optimistic on failure.** The control is a
 * preference about future email, not an action with a result the host is
 * waiting on: a spinner on a toggle is worse than a toggle that lands and gets
 * corrected on the next read. A failed write reverts, because silently showing
 * "off" while the server still has "on" would keep mailing a host who believes
 * they turned it off — the one direction of this switch that has to be true.
 */
export function useNotificationPref(active: boolean) {
  // Defaults to on, matching the server's "absent row means enabled". A first
  // publish therefore renders correctly before the fetch resolves, which is
  // the common case — the panel opens the instant publishing succeeds.
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!active) return;
    let live = true;
    fetchNotificationPref()
      .then((pref) => {
        if (live) setEnabled(pref.enabled);
      })
      // A failed read leaves the default. The host sees "on", which is what a
      // new account is, and the next open corrects it.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [active]);

  const toggle = useCallback(async () => {
    const next = !enabled;
    setEnabled(next);
    try {
      const pref = await setNotificationPref(next);
      setEnabled(pref.enabled);
    } catch {
      setEnabled(!next);
    }
  }, [enabled]);

  return { enabled, toggle };
}
