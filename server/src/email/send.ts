// The mail transport (adr-015 §6): one function, one REST call, plain `fetch`.
//
// No SDK and no nodemailer. This is adr-007's finding applied to a new
// dependency — that ADR removed a proxy sidecar and a client library in favour
// of `fetch` against the providers' own endpoints, and the resulting adapter is
// the smallest module in the gateway. A mail API is a POST with a JSON body and
// a bearer token; a library for that is a supply-chain entry and a version to
// track in exchange for nothing.
//
// There is no transport abstraction, no `PROVIDERS` table and no interface to
// implement. §6 recommends Resend and says the swap cost is one module, which
// is only true while this file *is* the abstraction. A second provider is when
// to generalize, not before.

const ENDPOINT = "https://api.resend.com/emails";

// The provider's own timeout is longer than anything a notification deserves.
// Nothing waits on this call (§5), but an unbounded socket would keep the
// process holding a request that stopped mattering minutes ago.
const TIMEOUT_MS = 10_000;

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Becomes `List-Unsubscribe` + `List-Unsubscribe-Post` (RFC 8058), so a
   *  mail client can offer one-click unsubscribe without opening a page —
   *  adr-015 §7. Omitted for any message that is not a subscription. */
  unsubscribeUrl?: string;
}

export type SendOutcome =
  | { ok: true; id: string | null }
  | { ok: false; reason: "unconfigured" | "rejected" | "unreachable"; detail?: string };

interface MailConfig {
  apiKey: string;
  from: string;
}

/** Read per call rather than at import, matching how every other operator
 *  switch in this server is read (guardrails, the publish gate, CANONICAL_HOST)
 *  — tests set the environment per case and a module-load snapshot would
 *  freeze the first one. */
function mailConfig(): MailConfig | null {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM;
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

/** Whether mail can be sent at all. `/healthz` reports this, and the trigger
 *  checks it before doing any work to decide whom to notify. */
export function emailConfigured(): boolean {
  return mailConfig() !== null;
}

function logEmail(line: Record<string, unknown>): void {
  // One JSON line per attempt, on the gateway's precedent (NFR-6). The
  // recipient is not logged: it is the host's address and the log would
  // otherwise become a mailing list. Neither is the API key, obviously, nor
  // the body — the subject carries the invitation title.
  console.log(JSON.stringify({ evt: "email_send", ts: new Date().toISOString(), ...line }));
}

/**
 * Send one message. Never throws — every failure is a returned reason.
 *
 * That total-ness is the contract §5 needs: the caller dispatches this after
 * the guest's RSVP response has already gone out, so there is nobody left to
 * show an error to, and an exception escaping into a floating promise would be
 * an unhandled rejection rather than a lost notification.
 *
 * **Unconfigured is a no-op, not a failure** — no key or no from-address means
 * `{ ok: false, reason: "unconfigured" }` with nothing logged as an error and
 * no request attempted. NFR-3's keyless boot and adr-014 §7's
 * auth-unconfigured mode, applied a third time: a deployment with no mail
 * credentials runs every other feature unchanged.
 */
export async function sendEmail(message: EmailMessage): Promise<SendOutcome> {
  const config = mailConfig();
  if (!config) return { ok: false, reason: "unconfigured" };

  const startedAt = performance.now();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };
  const body: Record<string, unknown> = {
    from: config.from,
    to: [message.to],
    subject: message.subject,
    html: message.html,
    text: message.text,
  };
  if (message.unsubscribeUrl) {
    body.headers = {
      "List-Unsubscribe": `<${message.unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const latency_ms = Math.round(performance.now() - startedAt);
    if (!response.ok) {
      // The provider's message is logged, never returned upward: nothing above
      // this shows it to anyone, and a 4xx body can quote the request.
      const detail = await response.text().catch(() => "");
      logEmail({ ok: false, status: response.status, latency_ms, error: detail.slice(0, 300) });
      return { ok: false, reason: "rejected", detail: `status ${response.status}` };
    }
    const id = await providerMessageId(response);
    logEmail({ ok: true, status: response.status, latency_ms, id });
    return { ok: true, id };
  } catch (error) {
    // DNS failure, connection reset, or the timeout above. Indistinguishable
    // from the caller's point of view and treated identically: no retry, and
    // the next reply after the window notifies anyway (§5).
    const latency_ms = Math.round(performance.now() - startedAt);
    const detail = error instanceof Error ? error.message : String(error);
    logEmail({ ok: false, latency_ms, error: detail });
    return { ok: false, reason: "unreachable", detail };
  }
}

/** The provider's id for the accepted message, for the log only. A body that
 *  is not the JSON we expect is not a failure — the message was accepted, and
 *  the id is a debugging convenience rather than something the app stores. */
async function providerMessageId(response: Response): Promise<string | null> {
  try {
    const payload = (await response.json()) as { id?: unknown };
    return typeof payload.id === "string" ? payload.id : null;
  } catch {
    return null;
  }
}
