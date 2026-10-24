import type { AuthStrings } from "../../i18n";
import { NotifyCheckbox } from "../NotifyCheckbox";

/**
 * Reply email, on the page a host is on when they think about replies
 * (adr-015 §7, amended; adr-019 §10).
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
 * **How the "event surface for an account-level setting" objection is
 * honoured** (from PR #66's design pass). An event page is not the setting's
 * *home*; that is the landing footer, among the address and the sign-out.
 * Here it is a **signal**, justified only by the host who declined at publish
 * having nowhere else to meet it. So both rows speak about the account and
 * neither speaks about this event. The test that keeps it honest, worth
 * applying to anything added here later: *if the control's text reads
 * correctly without knowing which event is open, it has not annexed the
 * surface.*
 *
 * Rendered only for a signed-in host with an address, on a deployment that
 * can send mail. Not disabled — absent, following the rule the account footer
 * already sets: the preference endpoints are session-authorized while this
 * page is authorized by a manage token, so a host who arrived on a pasted link
 * genuinely cannot read or write this, and a dead control would promise
 * otherwise.
 */
export function NotifyControl({
  enabled,
  onToggle,
  email,
  t,
}: {
  enabled: boolean;
  onToggle: () => void;
  /** The signed-in address. Present whenever this renders at all. */
  email: string;
  t: AuthStrings;
}) {
  return (
    <div className="hm-notify">
      <NotifyCheckbox
        checked={enabled}
        onToggle={onToggle}
        name={t.notifyOptIn}
        // "…not just this one" names the boundary against the thing the host
        // is looking at, where an abstract "covers every invitation in your
        // account" could be read without being taken personally.
        state={(enabled ? t.notifyStateOnEvent : t.notifyStateOffNow).replace("{email}", email)}
      />
    </div>
  );
}
