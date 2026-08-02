import type { AuthStrings } from "../../i18n";
import { NotifyCheckbox } from "../NotifyCheckbox";

/**
 * Reply email, on the page a host is on when they think about replies
 * (adr-015 §7 amended, DS `HostNotify`).
 *
 * Opt-in made this surface necessary rather than merely convenient. Before,
 * the only durable control lived in the landing page's account footer, which
 * was fine for a host turning something *off* — they knew it was on, because
 * mail had arrived. A host who declined at publish and later wonders why no
 * mail comes looks at the event's dashboard, and until this existed there was
 * nothing there.
 *
 * **How the "event surface for an account-level setting" objection is
 * honoured.** An earlier decision note rejected `/manage/:id` for this
 * control, and it was right that an event page is not the setting's *home* —
 * that is the landing card, where it sits among the address and the sign-out,
 * things of its own kind. Here it is not a home but a **signal**, justified
 * only by the host who declined at publish having nowhere else to meet it. So
 * both rows speak about the account and **neither speaks about this event**:
 * no event title, no event data, and the block is the only thing on the page
 * standing below the summary rule.
 *
 * The test that keeps it honest, worth applying to anything added here later:
 * *if the control's text reads correctly without knowing which event is open,
 * it has not annexed the surface.* "For all your invitations, not just this
 * one" passes; anything naming this invitation would fail.
 *
 * Rendered only for a signed-in host on a deployment that can send mail. Not
 * disabled — absent, following the rule the account footer already sets: the
 * preference endpoints are session-authorized while this page is authorized by
 * a manage token, so a host who arrived on a pasted link genuinely cannot read
 * or write this, and a greyed control would be the one element on the page
 * that does nothing.
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
        // is looking at, which an abstract "covers every invitation in your
        // account" did not: that one could be read without being taken
        // personally, sitting where fine print sits.
        state={(enabled ? t.notifyStateOnEvent : t.notifyStateOffNow).replace("{email}", email)}
      />
    </div>
  );
}
