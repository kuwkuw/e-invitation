import type { AuthStrings } from "../../i18n";

/**
 * Reply email, on the page a host is on when they think about replies
 * (adr-015 §7, amended).
 *
 * Opt-in made this surface necessary rather than merely convenient. Before,
 * the only durable control lived in the landing page's account footer, which
 * was fine for a host turning something *off* — they knew it was on, because
 * mail had arrived. A host who declined at publish and later wonders why no
 * mail comes looks at the event's dashboard, and until this existed there was
 * nothing there.
 *
 * **It says it is account-wide, in words.** The preference governs every
 * invitation the account holds, and this is a page about exactly one of them —
 * the shape most likely to be misread. A host silencing their wedding here and
 * discovering later it also silenced their daughter's birthday is precisely
 * the surprise that earns a Spam press, which is the thing opt-in exists to
 * avoid. Per-event control stays deferred, with adr-015 §7's trigger intact.
 *
 * Rendered only for a signed-in host on a deployment that can send mail. Not
 * disabled — absent, following the rule the account footer already sets: the
 * preference endpoints are session-authorized while this page is authorized by
 * a manage token, so a host who arrived on a pasted link genuinely cannot read
 * or write this, and a dead control would promise otherwise.
 */
export function NotifyControl({
  enabled,
  onToggle,
  t,
}: {
  enabled: boolean;
  onToggle: () => void;
  t: AuthStrings;
}) {
  return (
    <div className="hm-notify">
      <div className="hm-notify-copy">
        <p className="hm-notify-text">{enabled ? t.notifyOnAccount : t.notifyOffer}</p>
        {/* Always present, in both states: the scope is as true of turning it
            on as of turning it off, and a note that appeared only alongside
            the off switch would read as a warning rather than a fact. */}
        <p className="hm-notify-scope">{t.notifyAllEvents}</p>
      </div>
      <button type="button" className="hm-notify-toggle" onClick={onToggle}>
        {enabled ? t.notifyTurnOff : t.notifyOptIn}
      </button>
    </div>
  );
}
