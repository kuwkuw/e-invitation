import { Link, useParams } from "react-router-dom";
import { ExampleCard } from "./components/gallery/ExampleCard";
import { GALLERY_DESIGNS, galleryFor, isOccasionId, populatedOccasions } from "./gallery";
import { useUiLanguage } from "./hooks/useUiLanguage";
import { GALLERY } from "./i18n";
import { galleryRouteMeta, routeMeta, useDocumentMeta } from "./seo";

/** `/gallery/:occasion` — the page written to rank (adr-017 §1).
 *
 *  An unrecognised slug renders a dead-link state rather than the marketing
 *  page. `shellMeta` has already told the crawler this URL is `noindex`, and
 *  serving landing copy under it is exactly the duplicate that rule declines —
 *  the same shape as `isInvitationId` guarding `:id` (adr-011 §3).
 *
 *  Search traffic here is overwhelmingly mobile, which inverts the usual
 *  assumption: the 375 layout is the design and the desktop grid is the
 *  widening, not the other way round. */
export function GalleryOccasionPage() {
  const { occasion } = useParams();
  const lang = useUiLanguage();
  const t = GALLERY[lang];
  const known = occasion && isOccasionId(occasion) ? occasion : null;
  // A client-side navigation leaves the previous page's head in the document
  // (FR-13.7). An unknown occasion takes the notFound head, matching what the
  // server already told the crawler about this URL.
  useDocumentMeta(known ? galleryRouteMeta(lang, known) : routeMeta("notFound", lang));

  if (!known) {
    return (
      <div className="gl gl-empty">
        <p>{t.notFound}</p>
        <Link to="/gallery">{t.hubTitle}</Link>
      </div>
    );
  }

  const examples = galleryFor(known, lang);
  const others = populatedOccasions(lang).filter((other) => other !== known);

  return (
    <div className="gl">
      <nav className="gl-crumbs">
        <Link to="/">{t.home}</Link>
        <Link to="/gallery">{t.hubTitle}</Link>
        <span>{t.occasions[known]}</span>
      </nav>
      <h1>{t.occasionTitle[known]}</h1>
      <p className="gl-intro">{t.occasionIntro[known]}</p>
      <div className="gl-examples">
        {examples.map((example) => {
          const design = GALLERY_DESIGNS[example.id];
          return design ? (
            <ExampleCard key={example.id} example={example} design={design} useLabel={t.use} />
          ) : null;
        })}
      </div>
      {others.length > 0 && (
        <section className="gl-others">
          <h2>{t.otherOccasions}</h2>
          <div className="gl-chips">
            {others.map((other) => (
              <Link className="gl-chip" key={other} to={`/gallery/${other}`}>
                {t.occasions[other]}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
