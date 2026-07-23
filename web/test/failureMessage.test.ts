import { describe, expect, it } from "vitest";
import { ApiError, llmFailureKind } from "../src/api";
import { failureMessage } from "../src/failureMessage";
import { UI } from "../src/i18n";

const chat = UI.en.chat;

function apiError(status: number, causes?: { model: string; class: string }[]): ApiError {
  const error = new ApiError("failed");
  error.status = status;
  if (causes) error.causes = causes;
  return error;
}

describe("llmFailureKind", () => {
  it("reads the guardrails off the status, before any cause inspection", () => {
    // 429 per-IP limit and 503 budget breaker (adr-008) both mean "not today"
    // regardless of what the models did.
    expect(llmFailureKind(apiError(429))).toBe("limited");
    expect(llmFailureKind(apiError(503))).toBe("limited");
  });

  it("reports quota when any model hit its provider's ceiling", () => {
    const kind = llmFailureKind(
      apiError(502, [
        { model: "llama-3.3-70b-versatile", class: "connectivity" },
        { model: "gemini-2.5-flash", class: "quota" },
      ]),
    );
    expect(kind).toBe("quota");
  });

  it("reports auth only when every model failed on credentials", () => {
    expect(
      llmFailureKind(
        apiError(502, [
          { model: "gemini-2.5-flash", class: "auth" },
          { model: "claude-sonnet-5", class: "auth" },
        ]),
      ),
    ).toBe("auth");
    // A mixed bag is not a key problem — don't send the host to the key panel.
    expect(
      llmFailureKind(
        apiError(502, [
          { model: "gemini-2.5-flash", class: "auth" },
          { model: "claude-sonnet-5", class: "output-invalid" },
        ]),
      ),
    ).toBe("generic");
  });

  it("reports busy when every model was down or overloaded", () => {
    const kind = llmFailureKind(
      apiError(502, [
        { model: "gemini-2.5-flash", class: "connectivity" },
        { model: "llama-3.3-70b-versatile", class: "connectivity" },
      ]),
    );
    expect(kind).toBe("busy");
  });

  it("falls back to generic for unknown shapes and plain errors", () => {
    expect(llmFailureKind(apiError(502, []))).toBe("generic");
    expect(llmFailureKind(new Error("boom"))).toBe("generic");
    expect(llmFailureKind(null)).toBe("generic");
  });
});

describe("failureMessage", () => {
  it("maps each failure kind to its own chat message", () => {
    expect(failureMessage(apiError(502, [{ model: "m", class: "quota" }]), chat)).toBe(
      chat.quotaMsg,
    );
    expect(failureMessage(apiError(502, [{ model: "m", class: "auth" }]), chat)).toBe(chat.keyMsg);
    expect(failureMessage(apiError(429), chat)).toBe(chat.limitMsg);
    expect(failureMessage(apiError(502, [{ model: "m", class: "connectivity" }]), chat)).toBe(
      chat.busyMsg,
    );
    expect(failureMessage(new Error("boom"), chat)).toBe(chat.failMsg);
  });

  it("points quota and limit failures at the BYOK escape hatch", () => {
    // The whole point of distinguishing these: the host can keep working by
    // supplying their own key.
    expect(failureMessage(apiError(429), chat).toLowerCase()).toContain("key");
    expect(
      failureMessage(apiError(502, [{ model: "m", class: "quota" }]), chat).toLowerCase(),
    ).toContain("key");
  });
});
