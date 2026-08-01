// The origin this deployment is reachable at, derived from the request.
//
// Shared rather than duplicated because two very different things depend on it
// agreeing: the `og:*` URLs messenger crawlers fetch (FR-3.5) and the links in
// a reply notification (adr-015 §2). A copy that drifted would break one of
// them silently — a wrong `og:image` host stops unfurls with nothing in the
// logs, and a wrong manage link lands in a host's inbox permanently.
//
// Nothing hardcodes the host: `trustProxy` is on, so `protocol` follows
// `x-forwarded-proto`, and the canonical-host redirect (CANONICAL_HOST) has
// already run by the time any handler executes — so the host in hand is the
// one the operator configured, and there is no second place to read it from.

import type { FastifyRequest } from "fastify";

export function absoluteBase(request: FastifyRequest): string {
  return `${request.protocol}://${request.headers.host ?? "localhost"}`;
}
