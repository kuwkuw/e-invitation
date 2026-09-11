import { Link } from "react-router-dom";
import { galleryFor, populatedOccasions } from "./gallery";
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
        {populatedOccasions(lang).map((occasion) => (
          <Link className="gl-tile" key={occasion} to={`/gallery/${occasion}`}>
            <span className="gl-tile-name">{t.occasions[occasion]}</span>
            <span className="gl-tile-sample">
              {galleryFor(occasion, lang)[0]?.copy.title ?? ""}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
