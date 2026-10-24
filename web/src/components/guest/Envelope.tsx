import { useEffect, useRef } from "react";
import type { EnvelopePhase } from "../../hooks/useEnvelope";
import type { GuestStrings } from "../../i18n";

interface Props {
  phase: Exclude<EnvelopePhase, "none">;
  /** The invitation's title. The recipient line would read "для …" for a named
   *  link, which the product doesn't issue, so it carries the title instead. */
  title: string;
  monogram: string;
  onOpen: () => void;
  t: GuestStrings;
}

/**
 * The first-open envelope (adr-019 §5.1): kraft on a dark ground, sealed with
 * the hosts' monogram. The seal, «Пропустити» and Escape all open it; the
 * flap, the drop and the card rising behind it are CSS on `data-phase`. The
 * page is already loaded underneath, so nothing waits on the animation.
 */
export function Envelope({ phase, title, monogram, onOpen, t }: Props) {
  const seal = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    seal.current?.focus();
  }, []);

  return (
    <div
      className="gr-env"
      data-phase={phase}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key === "Escape") onOpen();
      }}
    >
      <div className="gr-env-body">
        <div className="gr-env-flap" />
        <p className="gr-env-to">{title}</p>
        <button
          ref={seal}
          type="button"
          className="seal gr-env-seal"
          aria-label={t.openInvitation}
          onClick={onOpen}
        >
          {monogram}
        </button>
      </div>
      <button type="button" className="gr-env-skip" onClick={onOpen}>
        {t.skip}
      </button>
    </div>
  );
}
