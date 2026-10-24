import { useCallback, useEffect, useRef, useState } from "react";

/** How long a control says "copied" before it reads as itself again. */
export const COPIED_MS = 2000;

/**
 * Copying the public link from the host dashboard: the empty state's share
 * row and «Нагадати гостям» (adr-019 §8.3) are one action in two places.
 *
 * `copied` is true for `COPIED_MS` after a write the clipboard accepted. A
 * clipboard that refuses (a webview without the permission, a document
 * without focus) leaves it false: the control claims nothing that didn't
 * happen, and the rejection is caught here instead of escaping a click
 * handler as an unhandled one. The link stays selectable on the page either
 * way.
 */
export function useCopyLink(url: string): { copied: boolean; copy: () => Promise<void> } {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  }, [url]);

  return { copied, copy };
}
