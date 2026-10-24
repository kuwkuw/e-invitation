/**
 * Reply email, as one control (adr-019 §10, redone on paper from PR #66's
 * design pass; adr-015 §7). The landing footer carries it first; the share
 * panel and the manage page take it in adr-019 steps 5 and 6.
 *
 * **Why a checkbox and not a quieter sentence.** Opt-in changed what this
 * element is for. Under default-on the line was a disclosure, and could be as
 * quiet as it liked, because the feature worked whether anyone read it or not.
 * Under opt-in the same line is the only thing between the feature and its
 * non-existence, and a sentence with a text button reads as one more quiet
 * sentence in a stack of them. A square is recognised as pressable at a glance
 * and spends no fill, so it costs nothing from the accent budget: adr-010 §3's
 * hierarchy counts fills, not affordances. The checked box is ink for the same
 * reason — the accent means "the public link".
 *
 * **Two rows, two roles.** `name` is the setting's name and never changes
 * between states, which is what makes unchecking as easy as checking. `state`
 * carries everything that does change, the scope included, so "every
 * invitation in your account" is read before the host agrees, not after.
 *
 * The whole label is the target, 44px tall. The text button this replaced was
 * about 17px, on a product whose hosts are on phones inside a messenger.
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
    // A real input, so it is reachable by keyboard and announced as a
    // checkbox. The square is decoration driven by it, and `.notify-input`
    // sits off-screen rather than `display: none`, which would also take it
    // out of the tab order.
    <label className="notify-check">
      <input type="checkbox" className="notify-input" checked={checked} onChange={onToggle} />
      <span className="notify-box" aria-hidden="true">
        {checked && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
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
