import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, upsertUser } from "../src/accounts.js";
import { buildApp } from "../src/app.js";
import { closeDb } from "../src/db.js";
import { resetMetricsCache } from "../src/metrics.js";
import type { Invitation } from "../src/schemas.js";

const invitation: Invitation = {
  brief: {
    event_type: "birthday",
    hosts: ["Олена"],
    date: "12 серпня",
    time: "18:00",
    venue: "Кафе «Затишок»",
    city: "Львів",
    tone: "warm and familial",
    language: "uk",
    extra_details: null,
  },
  copy: {
    title: "Запрошення",
    greeting: "Дорогі друзі!",
    body: "Запрошуємо вас відсвяткувати разом із нами.",
    details_line: "12 серпня, 18:00",
    rsvp_prompt: "Підтвердіть свою присутність.",
    closing: "З любов'ю, Олена",
  },
  design: { palette: "warm", typography: "serif", layout: "classic", ornament: "floral" },
};

let app: FastifyInstance | null = null;
let dataDir: string;

function configureGoogle() {
  vi.stubEnv("GOOGLE_CLIENT_ID", "test-client.apps.googleusercontent.com");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-secret");
}

async function start() {
  app = await buildApp({ logger: false });
  return app;
}

function signIn() {
  const user = upsertUser("google-sub-1", "host@example.com");
  return { user, cookies: { inv_session: createSession(user.id).id } };
}

function publish(instance: FastifyInstance, payload: unknown, cookies?: Record<string, string>) {
  return instance.inject({
    method: "POST",
    url: "/api/invitations/publish",
    payload,
    ...(cookies ? { cookies } : {}),
  });
}

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "inv-gate-test-"));
  process.env.DATA_DIR = dataDir;
  // Counters and the baseline are cached for the process lifetime; each case
  // gets its own DATA_DIR and must start from it, not from the last one.
  resetMetricsCache();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  if (app) {
    await app.close();
    app = null;
  }
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
});

describe("publish gate (adr-014 §2)", () => {
  // §7: an unconfigured deployment behaves exactly as it did before accounts.
  it("does not gate publishing when there is no OAuth client", async () => {
    const instance = await start();
    const res = await publish(instance, { invitation });
    expect(res.statusCode).toBe(200);
    expect(res.json().manage_token).toBeTruthy();
  });

  it("requires a session for a first publish once sign-in is configured", async () => {
    configureGoogle();
    const instance = await start();

    const res = await publish(instance, { invitation });
    expect(res.statusCode).toBe(401);
    // Nothing was created — a refused publish must not leave a record behind.
    expect(res.json().id).toBeUndefined();
  });

  // The staging path: sign-in is available and hosts can create accounts, but
  // anonymous publishing still works. Without this the gate and the UI that
  // explains it have to land in the same deploy, and the window between them
  // is a 401 the client has nothing to say about.
  it("offers sign-in without gating when PUBLISH_REQUIRES_ACCOUNT=0", async () => {
    configureGoogle();
    vi.stubEnv("PUBLISH_REQUIRES_ACCOUNT", "0");
    const instance = await start();

    const health = (await instance.inject({ method: "GET", url: "/healthz" })).json();
    expect(health.auth).toEqual({ google: true, publish_gate: false });
    expect((await publish(instance, { invitation })).statusCode).toBe(200);
  });

  it("still links an anonymous-capable publish for a host who did sign in", async () => {
    configureGoogle();
    vi.stubEnv("PUBLISH_REQUIRES_ACCOUNT", "0");
    const instance = await start();
    const { cookies } = signIn();

    const res = await publish(instance, { invitation }, cookies);
    const keyring = await instance.inject({
      method: "GET",
      url: "/api/account/keyring",
      cookies,
    });
    expect(keyring.json().invitations.map((e: { id: string }) => e.id)).toEqual([res.json().id]);
  });

  it("publishes for a signed-in host and links it to the account", async () => {
    configureGoogle();
    const instance = await start();
    const { cookies } = signIn();

    const res = await publish(instance, { invitation }, cookies);
    expect(res.statusCode).toBe(200);

    const keyring = await instance.inject({
      method: "GET",
      url: "/api/account/keyring",
      cookies,
    });
    expect(keyring.json().invitations.map((e: { id: string }) => e.id)).toEqual([res.json().id]);
  });

  // adr-014 §1, and the reason the gate is on *first* publish only: auth never
  // revokes a capability. Everything already published stays republishable
  // forever, by whoever holds the token, signed in or not.
  it("never gates a republish backed by a valid manage token", async () => {
    const instance = await start();
    // Published before sign-in existed, as every record in production was.
    const first = await publish(instance, { invitation });
    const { id, manage_token } = first.json();

    await instance.close();
    configureGoogle();
    const gated = await start();

    const again = await publish(gated, { id, manage_token, invitation });
    expect(again.statusCode).toBe(200);
    expect(again.json().version).toBe(2);
  });

  it("still refuses a republish with a bad token, and says so as 403 not 401", async () => {
    configureGoogle();
    const instance = await start();
    const { cookies } = signIn();
    const first = await publish(instance, { invitation }, cookies);

    const forged = await publish(instance, {
      id: first.json().id,
      manage_token: "0".repeat(32),
      invitation,
    });
    // The token is what authorizes here; being signed out is beside the point.
    expect(forged.statusCode).toBe(403);
  });

  it("leaves the guest side and the LLM-free reads open", async () => {
    configureGoogle();
    const instance = await start();
    const { cookies } = signIn();
    const published = await publish(instance, { invitation }, cookies);
    const id = published.json().id;

    // A guest never meets any of this (01-vision: guests never register).
    expect(
      (await instance.inject({ method: "GET", url: `/api/invitations/${id}` })).statusCode,
    ).toBe(200);
    const rsvp = await instance.inject({
      method: "POST",
      url: `/api/invitations/${id}/rsvp`,
      payload: { name: "Іван", attending: true, party_size: 2 },
    });
    expect(rsvp.statusCode).toBe(200);
  });

  describe("metrics baseline", () => {
    it("freezes the pre-gate counters the first time the gate is configured", async () => {
      // Traffic before anyone thought about accounts.
      const open = await start();
      await publish(open, { invitation });
      await publish(open, { invitation });
      await open.close();
      app = null;

      configureGoogle();
      const gated = await start();
      const metrics = (await gated.inject({ method: "GET", url: "/api/metrics" })).json();

      expect(metrics.baseline.reason).toBe("auth-gate");
      expect(metrics.baseline.before.publishes).toBe(2);
      expect(metrics.baseline.since.publishes).toBe(0);
    });

    it("does not move the baseline on restart", async () => {
      configureGoogle();
      const first = await start();
      const at = (await first.inject({ method: "GET", url: "/api/metrics" })).json().baseline.at;
      const { cookies } = signIn();
      await publish(first, { invitation }, cookies);
      await first.close();
      app = null;

      const restarted = await start();
      const metrics = (await restarted.inject({ method: "GET", url: "/api/metrics" })).json();
      expect(metrics.baseline.at).toBe(at);
      // The publish landed after the gate, and stays counted there.
      expect(metrics.baseline.since.publishes).toBe(1);
      expect(metrics.baseline.before.publishes).toBe(0);
    });

    // The baseline hangs on the gate closing, not on OAuth being configured —
    // otherwise staging the rollout would freeze "before" while anonymous
    // publishes were still landing, and put them on the wrong side of it.
    it("waits for the gate rather than freezing when sign-in is merely available", async () => {
      configureGoogle();
      vi.stubEnv("PUBLISH_REQUIRES_ACCOUNT", "0");
      const staged = await start();
      await publish(staged, { invitation });
      expect(
        (await staged.inject({ method: "GET", url: "/api/metrics" })).json().baseline,
      ).toBeNull();
      await staged.close();
      app = null;

      vi.stubEnv("PUBLISH_REQUIRES_ACCOUNT", "1");
      const gated = await start();
      const metrics = (await gated.inject({ method: "GET", url: "/api/metrics" })).json();
      expect(metrics.baseline.before.publishes).toBe(1);
      expect(metrics.baseline.since.publishes).toBe(0);
    });

    it("takes no baseline at all on an ungated deployment", async () => {
      const instance = await start();
      await publish(instance, { invitation });
      const metrics = (await instance.inject({ method: "GET", url: "/api/metrics" })).json();
      expect(metrics.baseline).toBeNull();
      // And nothing was frozen on disk either, so configuring sign-in later
      // still captures the whole pre-gate period.
      expect(JSON.parse(readFileSync(join(dataDir, "metrics.json"), "utf8")).baseline).toBeNull();
    });
  });
});
