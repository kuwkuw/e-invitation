import type { LandingStrings } from "../../i18n";

/**
 * The hero's composer (adr-019 §6.1): an example of what a host types, not an
 * input. A box that looks typeable but is not would be a dead control, so it
 * says it is an example, carries no send glyph, and its one control is the
 * call to action, which goes where a real composer is.
 *
 * The typing is CSS on a span whose text is already the whole sentence, so a
 * crawler, a screen reader and a visitor under reduced motion all get the
 * sentence at once; only the no-preference rules in styles.css reveal it.
 * `prerender.ts` emits the same span with the same class.
 */
export function HeroComposer({ t, onStart }: { t: LandingStrings; onStart: () => void }) {
  return (
    <>
      <div className="lp-composer">
        <p className="lp-composer-label">{t.composerLabel}</p>
        <p className="lp-composer-line">
          <span className="lp-typing">{t.heroSentence}</span>
        </p>
        <button type="button" className="lp-cta" onClick={onStart}>
          {t.cta}
        </button>
      </div>
      <p className="lp-composer-note">{t.composerNote}</p>
    </>
  );
}
