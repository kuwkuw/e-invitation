import { describe, expect, it } from "vitest";
import { isInvitationId } from "../src/invitationId";

describe("isInvitationId", () => {
  it("accepts the shape the server mints", () => {
    expect(isInvitationId("abc123")).toBe(true);
    expect(isInvitationId("a".repeat(32))).toBe(true);
    expect(isInvitationId("A-b_c-1")).toBe(true);
  });

  it("rejects lengths outside 6–32", () => {
    expect(isInvitationId("abc12")).toBe(false);
    expect(isInvitationId("a".repeat(33))).toBe(false);
    expect(isInvitationId("")).toBe(false);
    expect(isInvitationId(undefined)).toBe(false);
  });

  it("rejects anything that could leave the id position in a URL", () => {
    // The guard the route regex used to provide (adr-011 §3): these are what a
    // permissive `:id` param would otherwise hand to fetchInvitation.
    expect(isInvitationId("../../etc/passwd")).toBe(false);
    expect(isInvitationId("abc/123")).toBe(false);
    expect(isInvitationId("abc.123")).toBe(false);
    expect(isInvitationId("abc 123")).toBe(false);
    expect(isInvitationId("abc?x=1")).toBe(false);
  });
});
