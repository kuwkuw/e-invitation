import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { OG_HEIGHT, OG_WIDTH, renderOgPng } from "../og/render.js";
import { type Invitation, InvitationId } from "../schemas.js";
import { getRecord, type PublishedRecord } from "../store.js";

// versions is non-empty by construction (createRecord seeds version 1).
function latestVersion(record: PublishedRecord): Invitation {
  const invitation = record.versions[record.versions.length - 1];
  if (!invitation) throw new Error(`record ${record.id} has no versions`);
  return invitation;
}

// PNG cache keyed by id:version — a published snapshot is immutable, so a
// rendered image never goes stale; republishing bumps the version.
const pngCache = new Map<string, Buffer>();

function lookup(params: unknown): PublishedRecord | null {
  const id = InvitationId.safeParse((params as { id?: string }).id);
  return id.success ? getRecord(id.data) : null;
}

function absoluteBase(request: FastifyRequest): string {
  return `${request.protocol}://${request.headers.host ?? "localhost"}`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function ogMetaTags(record: PublishedRecord, base: string): string {
  const invitation = latestVersion(record);
  const title = escapeHtml(invitation.copy.title);
  const description = escapeHtml(invitation.copy.details_line.replace(/\n+/g, " · "));
  // Version in the query busts messenger link-preview caches on republish.
  const image = `${base}/api/invitations/${record.id}/og.png?v=${record.versions.length}`;
  return [
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:image" content="${image}">`,
    `<meta property="og:image:width" content="${OG_WIDTH}">`,
    `<meta property="og:image:height" content="${OG_HEIGHT}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].join("\n    ");
}

export function registerOgRoutes(app: FastifyInstance): void {
  app.get("/api/invitations/:id/og.png", async (request, reply) => {
    const record = lookup(request.params);
    if (!record) return reply.code(404).send({ error: "Invitation not found." });
    const key = `${record.id}:${record.versions.length}`;
    let png = pngCache.get(key);
    if (!png) {
      png = await renderOgPng(latestVersion(record));
      pngCache.set(key, png);
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
    const meta = ogMetaTags(record, absoluteBase(request));
    const spaShell = join(process.cwd(), "..", "web", "dist", "index.html");
    let html: string;
    if (existsSync(spaShell)) {
      html = readFileSync(spaShell, "utf8").replace("</head>", `    ${meta}\n  </head>`);
    } else {
      const invitation = latestVersion(record);
      html = `<!doctype html>
<html lang="${invitation.brief.language}">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(invitation.copy.title)}</title>
    ${meta}
  </head>
  <body>
    <p><a href="http://localhost:5173/i/${record.id}">${escapeHtml(invitation.copy.title)}</a></p>
  </body>
</html>`;
    }
    return reply.header("Content-Type", "text/html; charset=utf-8").send(html);
  });
}
