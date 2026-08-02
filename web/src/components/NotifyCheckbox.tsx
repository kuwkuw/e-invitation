/**
 * Reply email, as one control on every surface that offers it
 * (DS `ShareOptIn` / `HostNotify` / `LandingSignedOut`, adr-015 §7 amended).
 *
 * **Why a checkbox and not a quieter sentence.** Opt-in changed what this
 * element is for. Under default-on the line was a disclosure: it could be as
 * quiet as it liked, because the feature worked whether or not anyone read it.
 * Under opt-in the same line is the only thing standing between the feature and
 * its non-existence, and a sentence with a text button reads as one more quiet
 * sentence in a stack of quiet sentences.
 *
 * The share panel's hierarchy (adr-010 §3) is why the answer is not "louder".
 * That rule counts **fills**, not affordances: the public share link owns the
 * only accent on the panel, and a control with no fill does not compete with it
 * — it competes with the prose around it, which is exactly what it should win
 * against. A square is recognised as pressable at a glance and costs nothing
 * from the accent budget. Visibility bought with *category* rather than colour.
 *
 * It also settles the objection that ruled out a toggle (DS `NotifyLine` §2):
 * a toggle needs a caption, a caption needs a heading, and a heading turns a
 * disclosure into the settings screen adr-015 keeps refusing. A checkbox's
 * caption *is* its sentence, so no heading appears.
 *
 * **Two rows, two roles.** `name` is the name of the setting and never changes
 * between states — which is what makes unchecking as easy as checking. `state`
 * carries everything that does change, including the scope, so the fact that
 * this covers the whole account is inside the thing the host reads rather than
 * a second sentence they can skip.
 *
 * The whole label is the target, 44px tall. In the version this replaces the
 * target was the height of the button's text — about 17px, on a product whose
 * hosts are on phones in a messenger.
 */
export function NotifyCheckbox({
  checked,
  onToggle,
  name,
  state,
}: {
  checked: boolean;
  onToggle: () => void;
  /** The setting's name. Identical in both states, by design. */
  name: string;
  /** What is true right now, scope included. Changes entirely with the state. */
  state: string;
}) {
  return (
    // A real input rather than a styled span: this has to be reachable by
    // keyboard and announced as a checkbox. The square below is decoration
    // driven by it, and `.notify-input` puts the input off-screen rather than
    // `display:none`, which would take it out of the tab order too.
    <label className="notify-check">
      <input type="checkbox" className="notify-input" checked={checked} onChange={onToggle} />
      <span className={checked ? "notify-box is-on" : "notify-box"} aria-hidden="true">
        {checked && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 13l4 4L19 7"
              stroke="#ffffff"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span className="notify-copy">
        <span className="notify-name">{name}</span>
        <span className="notify-state">{state}</span>
      </span>
    </label>
  );
}
