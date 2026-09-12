import { Link } from "react-router-dom";
import { InvitationPreview } from "./components/InvitationPreview";
import { GALLERY_DESIGNS, galleryFor, populatedOccasions } from "./gallery";
import { useUiLanguage } from "./hooks/useUiLanguage";
import { GALLERY } from "./i18n";
import { galleryRouteMeta, useDocumentMeta } from "./seo";

/** `/gallery` — the hub (adr-017 §1).
 *
 *  Two modest jobs: give a crawler a path to the six occasion pages, and let a
 *  visitor pick theirs. This page barely ranks itself — the occasion pages do
 *  — so it is deliberately thin and fast.
 *
 *  No filled accent anywhere: the tile *is* the link, so there is no second
 *  action on it to confuse with the first. */
export function GalleryHubPage() {
  const lang = useUiLanguage();
  const t = GALLERY[lang];
  useDocumentMeta(galleryRouteMeta(lang, null));

  return (
    <div className="gl">
      <h1>{t.hubTitle}</h1>
      <p className="gl-intro">{t.hubIntro}</p>
      <div className="gl-tiles">
        {populatedOccasions(lang).map((occasion) => {
          const examples = galleryFor(occasion, lang);
          const first = examples[0];
          const design = first ? GALLERY_DESIGNS[first.id] : undefined;
          return (
            <Link className="gl-tile" key={occasion} to={`/gallery/${occasion}`}>
              {/* A real card rather than an icon: how it looks is the only
                  thing this page has to promise. Scaled by CSS inside a
                  clipping window — `InvitationPreview` has a 380px min-height
                  and its own padding, and a `compact` prop would mean editing
                  the DS contract mirrored by hand in InvitationPreview.d.ts
                  and conventions.md, which has gone stale once already. */}
              {first && design && (
                <span className="gl-tile-shot" aria-hidden="true">
                  <span className="gl-tile-shot-inner">
                    <InvitationPreview copy={first.copy} design={design} />
                  </span>
                </span>
              )}
              <span className="gl-tile-body">
                <span className="gl-tile-name">{t.occasions[occasion]}</span>
                <span className="gl-tile-count">
                  {t.exampleCount.replace("{n}", String(examples.length))}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
