import type { LandingStrings } from "../../i18n";

/**
 * "What guests see" (adr-019 §6.2): the guest's first frame (FR-4.8) shown as
 * a still beside the copy — a kraft envelope on its dark ground, carrying the
 * sample's title and sealed with its hosts' monogram. The guest page's
 * `.gr-env-*` is the living one; this is a picture of it, so nothing on it
 * opens, it is `aria-hidden`, and the prerendered block carries only the copy.
 */
export function GuestsSection({ t, monogram }: { t: LandingStrings; monogram: string }) {
  return (
    <section className="lp-guests">
      <div className="lp-guests-still" aria-hidden="true">
        <div className="lp-guests-env">
          <div className="lp-guests-flap" />
          <p className="lp-guests-to">{t.sample.title}</p>
          <span className="seal lp-guests-seal">{monogram}</span>
        </div>
      </div>
      <div className="lp-guests-copy">
        <h2 className="lp-guests-title">{t.guestsTitle}</h2>
        <p className="lp-guests-text">{t.guestsText}</p>
        <ul className="lp-guests-points">
          {t.guestsPoints.map((point) => (
            <li key={point} className="lp-guests-point">
              {point}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
