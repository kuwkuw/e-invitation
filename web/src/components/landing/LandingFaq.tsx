import type { LandingStrings } from "../../i18n";

/**
 * Four common questions (adr-019 §6.3), each a `<details>` closed until
 * opened. Crawlable because the answers are in the prerendered block as well
 * (FR-13.10); there is no `FAQPage` structured data, which Google retired as
 * a rich result (adr-016 §7). The cost answer is «Безкоштовно.» and gains its
 * sentence about the one-time unlock only when 07-monetization §5.2 ships.
 */
export function LandingFaq({ t }: { t: LandingStrings }) {
  return (
    <section className="lp-faq">
      <h2 className="lp-faq-title">{t.faqTitle}</h2>
      {t.faq.map((item) => (
        <details key={item.q} className="lp-faq-item">
          <summary className="lp-faq-q">{item.q}</summary>
          <p className="lp-faq-a">{item.a}</p>
        </details>
      ))}
    </section>
  );
}
