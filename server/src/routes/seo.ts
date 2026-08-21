import type { FastifyInstance } from "fastify";
import { absoluteBase } from "../publicUrl.js";
import { robotsTxt, sitemapXml } from "../seo.js";

/** `/robots.txt` and `/sitemap.xml` (adr-016 §4).
 *
 *  Server routes rather than files in `web/public/`: both need the deployment's
 *  absolute origin — the `Sitemap:` directive and every `<loc>` are required to
 *  be absolute — and that is a runtime fact (`CANONICAL_HOST`, a preview
 *  deployment, localhost), not a build-time one. Shipping them as static files
 *  would also collide with `@fastify/static`, which registers a route per file
 *  in `web/dist` and would refuse to boot beside a duplicate declaration.
 *
 *  Registered before the SPA fallback, which would otherwise answer both paths
 *  with the shell — a crawler reading an HTML page as a crawl policy ignores it
 *  entirely, so this ordering is what makes the two files exist at all. */
export function registerSeoRoutes(app: FastifyInstance): void {
  app.get("/robots.txt", async (request, reply) =>
    reply
      .header("Content-Type", "text/plain; charset=utf-8")
      // A day: long enough that crawlers do not refetch it on every pass,
      // short enough that flipping a rule takes effect the same day.
      .header("Cache-Control", "public, max-age=86400")
      .send(robotsTxt(absoluteBase(request))),
  );

  app.get("/sitemap.xml", async (request, reply) =>
    reply
      .header("Content-Type", "application/xml; charset=utf-8")
      .header("Cache-Control", "public, max-age=86400")
      .send(sitemapXml(absoluteBase(request))),
  );
}
