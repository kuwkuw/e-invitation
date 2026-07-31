import { afterEach, describe, expect, it, vi } from "vitest";
import { renderReplyNotification } from "../src/email/notification.js";
import { emailConfigured, sendEmail } from "../src/email/send.js";
import { emailStrings, pluralForm, replyCount } from "../src/email/strings.js";

function stubFetch(response: Response = new Response(JSON.stringify({ id: "msg-1" }))) {
  const spy = vi.fn(async () => response);
  vi.stubGlobal("fetch", spy);
  return spy;
}

function requestOf(spy: ReturnType<typeof vi.fn>): {
  url: string;
  headers: Record<string, string>;
  body: Record<string, any>;
} {
  const [url, init] = spy.mock.calls[0] as [string, RequestInit];
  return {
    url,
    headers: init.headers as Record<string, string>,
    body: JSON.parse(init.body as string),
  };
}

function configure() {
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("NOTIFY_FROM", "INVITO <replies@invinto.app>");
}

function notification(overrides: Partial<Parameters<typeof renderReplyNotification>[0]> = {}) {
  return renderReplyNotification({
    title: "Мій день народження",
    newReplies: 3,
    language: "uk",
    manageUrl: "https://invinto.app/manage/abc12345",
    unsubscribeUrl: "https://invinto.app/api/notifications/unsubscribe/tok",
    ...overrides,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("email strings", () => {
  // Ukrainian needs three forms where English needs two — the same rule
  // web/src/plural.ts carries for guest counts.
  it("picks the Ukrainian one/few/many form", () => {
    const forms = emailStrings("uk").replyForms;
    expect(pluralForm(1, forms)).toBe("нова відповідь");
    expect(pluralForm(3, forms)).toBe("нові відповіді");
    expect(pluralForm(7, forms)).toBe("нових відповідей");
    // 11-14 take "many" despite ending in 1-4.
    expect(pluralForm(11, forms)).toBe("нових відповідей");
    expect(pluralForm(21, forms)).toBe("нова відповідь");
  });

  it("collapses to two forms in English", () => {
    const forms = emailStrings("en").replyForms;
    expect(replyCount(1, emailStrings("en"))).toBe("1 new reply");
    expect(pluralForm(3, forms)).toBe("new replies");
    expect(pluralForm(11, forms)).toBe("new replies");
  });
});

describe("reply notification", () => {
  it("carries the count and the title in the subject", () => {
    expect(notification().subject).toBe("3 нові відповіді — Мій день народження");
    expect(notification({ language: "en", title: "My birthday", newReplies: 1 }).subject).toBe(
      "1 new reply — My birthday",
    );
  });

  // adr-015 §3: a count and a link, never who replied. There is no field on
  // the payload to leak a guest through, and this pins that the rendered
  // output stays that way.
  it("names no guest anywhere in either part", () => {
    const rendered = notification();
    for (const part of [rendered.subject, rendered.html, rendered.text]) {
      expect(part).not.toMatch(/Іван|attending|party_size/);
    }
  });

  // §2: the whole reason the email is safe to forward. The manage token comes
  // from the keyring after sign-in, never from the message.
  it("links to a bare /manage/:id with no token fragment", () => {
    const rendered = notification();
    expect(rendered.html).toContain("https://invinto.app/manage/abc12345");
    expect(rendered.html).not.toContain("#t=");
    expect(rendered.text).not.toContain("#t=");
  });

  it("escapes host-authored copy rather than rendering it as markup", () => {
    const rendered = notification({ title: '<script>alert("x")</script>' });
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain("&lt;script&gt;");
  });

  it("escapes an apostrophe, which Ukrainian copy actually contains", () => {
    const rendered = notification({ title: "З любов'ю" });
    expect(rendered.html).toContain("&#39;");
  });

  // Not optional: a transactional email without a text part is a spam signal,
  // and it is the version that renders correctly everywhere (§10).
  it("ships a plain-text part carrying both links", () => {
    const rendered = notification();
    expect(rendered.text).toContain("https://invinto.app/manage/abc12345");
    expect(rendered.text).toContain("https://invinto.app/api/notifications/unsubscribe/tok");
    expect(rendered.text).not.toContain("<");
  });

  it("writes the body in the invitation's language", () => {
    expect(notification({ language: "en", title: "My birthday" }).text).toContain(
      "You are getting this because you published this invitation while signed in.",
    );
    expect(notification().text).toContain("Ви отримали цей лист");
  });
});

describe("sendEmail", () => {
  // adr-015 §8 / NFR-3: no credentials is a supported mode, not a failure.
  describe("unconfigured", () => {
    it("is a no-op with a reason and no request", async () => {
      const spy = stubFetch();
      const outcome = await sendEmail({ to: "h@example.com", subject: "s", html: "h", text: "t" });

      expect(outcome).toEqual({ ok: false, reason: "unconfigured" });
      expect(spy).not.toHaveBeenCalled();
      expect(emailConfigured()).toBe(false);
    });

    it("stays unconfigured when only one of the two vars is set", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_test_key");
      const spy = stubFetch();
      await sendEmail({ to: "h@example.com", subject: "s", html: "h", text: "t" });
      expect(spy).not.toHaveBeenCalled();
      expect(emailConfigured()).toBe(false);
    });
  });

  describe("configured", () => {
    it("posts the message and reports the provider id", async () => {
      configure();
      const spy = stubFetch();

      const outcome = await sendEmail({
        to: "host@example.com",
        subject: "3 нові відповіді",
        html: "<p>hi</p>",
        text: "hi",
      });

      expect(outcome).toEqual({ ok: true, id: "msg-1" });
      const request = requestOf(spy);
      expect(request.url).toBe("https://api.resend.com/emails");
      expect(request.headers.Authorization).toBe("Bearer re_test_key");
      expect(request.body).toMatchObject({
        from: "INVITO <replies@invinto.app>",
        to: ["host@example.com"],
        subject: "3 нові відповіді",
        html: "<p>hi</p>",
        text: "hi",
      });
      expect(emailConfigured()).toBe(true);
    });

    // RFC 8058, so a mail client can unsubscribe without opening a page (§7).
    it("adds the one-click unsubscribe headers when given a URL", async () => {
      configure();
      const spy = stubFetch();
      await sendEmail({
        to: "host@example.com",
        subject: "s",
        html: "h",
        text: "t",
        unsubscribeUrl: "https://invinto.app/api/notifications/unsubscribe/tok",
      });

      expect(requestOf(spy).body.headers).toEqual({
        "List-Unsubscribe": "<https://invinto.app/api/notifications/unsubscribe/tok>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      });
    });

    it("omits those headers for a message that is not a subscription", async () => {
      configure();
      const spy = stubFetch();
      await sendEmail({ to: "host@example.com", subject: "s", html: "h", text: "t" });
      expect(requestOf(spy).body.headers).toBeUndefined();
    });

    it("still succeeds when the provider answers without a usable id", async () => {
      configure();
      stubFetch(new Response("accepted", { status: 202 }));
      expect(await sendEmail({ to: "h@example.com", subject: "s", html: "h", text: "t" })).toEqual({
        ok: true,
        id: null,
      });
    });
  });

  // §5's contract: never throws, so a floating promise cannot become an
  // unhandled rejection after the guest's response has already gone out.
  describe("failure", () => {
    it("reports a rejected send without leaking the provider body", async () => {
      configure();
      stubFetch(new Response('{"message":"domain not verified"}', { status: 403 }));

      const outcome = await sendEmail({ to: "h@example.com", subject: "s", html: "h", text: "t" });

      expect(outcome).toEqual({ ok: false, reason: "rejected", detail: "status 403" });
    });

    it("reports an unreachable provider instead of throwing", async () => {
      configure();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new Error("getaddrinfo ENOTFOUND api.resend.com");
        }),
      );

      const outcome = await sendEmail({ to: "h@example.com", subject: "s", html: "h", text: "t" });

      expect(outcome.ok).toBe(false);
      expect(outcome).toMatchObject({ reason: "unreachable" });
    });
  });

  it("never logs the api key or the recipient", async () => {
    configure();
    stubFetch();
    const logged: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((line: string) => {
      logged.push(line);
    });

    await sendEmail({ to: "host@example.com", subject: "s", html: "h", text: "t" });
    spy.mockRestore();

    expect(logged.join("\n")).not.toContain("re_test_key");
    expect(logged.join("\n")).not.toContain("host@example.com");
    expect(logged.join("\n")).toContain("email_send");
  });
});
