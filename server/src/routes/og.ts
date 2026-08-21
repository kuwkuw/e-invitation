import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { recallOgPng, rememberOgPng } from "../og/cache.js";
import { OG_HEIGHT, OG_WIDTH, renderOgPng } from "../og/render.js";
import { absoluteBase } from "../publicUrl.js";
import { type Invitation, InvitationId } from "../schemas.js";
import { escapeHtml, type HeadMeta, headTags, renderShell } from "../seo.js";
import { getRecord, type PublishedRecord } from "../store.js";

// versions is non-empty by construction (createRecord seeds version 1).
function latestVersion(record: PublishedRecord): Invitation {
  const invitation = record.versions[record.versions.length - 1];
  if (!invitation) throw new Error(`record ${record.id} has no versions`);
  return invitation;
}

function lookup(params: unknown): PublishedRecord | null {
  const id = InvitationId.safeParse((params as { id?: string }).id);
  return id.success ? getRecord(id.data) : null;
}

/** What a messenger unfurls and what a search crawler is told to do, for one
 *  published invitation.
 *
 *  **`noindex, nofollow`, and no canonical.** A guest page carries a host's
 *  date, venue, guest list prompt and often their family name; the id is
 *  unguessable (adr-005) precisely so that only the people handed the link can
 *  read it, and a search result would hand it to everyone else. The tags
 *  above it are untouched by that: no unfurler consults `robots`, which is
 *  what lets one page be shareable and unindexable at the same time. Keeping
 *  `/i/` crawlable in `robots.txt` is the other half of it — see `seo.ts`. */
function invitationMeta(record: PublishedRecord, base: string): HeadMeta {
  const invitation = latestVersion(record);
  return {
    lang: invitation.brief.language,
    title: invitation.copy.title,
    description: invitation.copy.details_line.replace(/\n+/g, " · "),
    robots: "noindex, nofollow",
    canonical: null,
    // A card still has one right place to link back to, even unindexed.
    url: `${base}/i/${record.id}`,
    // Version in the query busts messenger link-preview caches on republish.
    image: `${base}/api/invitations/${record.id}/og.png?v=${record.versions.length}`,
    imageWidth: OG_WIDTH,
    imageHeight: OG_HEIGHT,
    alternates: [],
    // The invitation's own language is the host's choice, not a variant of
    // this page in another one; and nothing here is meant for an index.
    jsonLd: null,
  };
}

export function registerOgRoutes(app: FastifyInstance): void {
  app.get("/api/invitations/:id/og.png", async (request, reply) => {
    const record = lookup(request.params);
    if (!record) return reply.code(404).send({ error: "Invitation not found." });
    // Keyed id:version — a published snapshot is immutable, so a rendered
    // image never goes stale; republishing bumps the version (og/cache.ts).
    const key = `${record.id}:${record.versions.length}`;
    let png = recallOgPng(key);
    if (!png) {
      png = await renderOgPng(latestVersion(record));
      rememberOgPng(key, png);
    }
    return reply
      .header("Content-Type", "image/png")
      .header("Cache-Control", "public, max-age=86400")
      .send(png);
  });

  // Crawler-facing share page: messenger link crawlers don't run JS, so the
  // OG tags must be in the served HTML. In production this serves the built
  // SPA shell with tags injected; in dev (no web/dist) a minimal page links
  // through to the Vite guest page.
  app.get("/i/:id", async (request, reply) => {
    const record = lookup(request.params);
    if (!record) return reply.code(404).send({ error: "Invitation not found." });
    const meta = invitationMeta(record, absoluteBase(request));
    const spaShell = join(process.cwd(), "..", "web", "dist", "index.html");
    let html: string;
    if (existsSync(spaShell)) {
      // **Replaced, not appended.** The shell ships with the landing page's
      // card in it (adr-016 §2), and `og:title` is first-one-wins in every
      // unfurler that matters — appending here would show every share link as
      // the marketing page. `renderShell` swaps the marked block out.
      html = renderShell(readFileSync(spaShell, "utf8"), meta);
    } else {
      html = `<!doctype html>
<html lang="${meta.lang}">
  <head>
    <meta charset="utf-8">
    ${headTags(meta)}
  </head>
  <body>
    <p><a href="http://localhost:5173/i/${record.id}">${escapeHtml(meta.title)}</a></p>
  </body>
</html>`;
    }
    return (
      reply
        .header("Content-Type", "text/html; charset=utf-8")
        // The same instruction in a header, for a crawler that indexes without
        // parsing the document. Belt and braces on the one page where getting
        // it wrong publishes a stranger's home address.
        .header("X-Robots-Tag", meta.robots)
        .send(html)
    );
  });
}
