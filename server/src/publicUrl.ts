// The origin this deployment is reachable at, derived from the request.
//
// Shared rather than duplicated because two very different things depend on it
// agreeing: the `og:*` URLs messenger crawlers fetch (FR-3.5) and the links in
// a reply notification (adr-015 §2). A copy that drifted would break one of
// them silently — a wrong `og:image` host stops unfurls with nothing in the
// logs, and a wrong manage link lands in a host's inbox permanently.
//
// `CANONICAL_HOST` is the origin when it is set, and this reads it rather than
// inferring it from the request. The redirect hook in app.ts does already turn
// away every other host before a handler runs, so in practice the two agree —
// but "the header is safe because something upstream checked it" is a property
// that holds until someone moves the hook, and what depends on it here is a
// link that lands in a host's inbox permanently. A guest can POST an RSVP with
// any `Host` they like; asserting the origin costs a line and makes the
// dependency enforced rather than documented.
//
// Unset — localhost, a test, a preview deployment — still derives from the
// request, which is what makes development work with no configuration.
// `trustProxy` is on, so `protocol` follows `x-forwarded-proto` there.

import type { FastifyRequest } from "fastify";

export function absoluteBase(request: FastifyRequest): string {
  const canonical = process.env.CANONICAL_HOST;
  if (canonical) return `https://${canonical}`;
  return `${request.protocol}://${request.headers.host ?? "localhost"}`;
}
