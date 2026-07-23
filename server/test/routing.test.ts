import { describe, expect, it } from "vitest";
import { MODEL_PRICES_PER_MTOK } from "../src/llm/pricing.js";
import { TASK_ROUTES } from "../src/llm/routing.js";

describe("routing table", () => {
  const tasks = Object.keys(TASK_ROUTES);

  it("covers all pipeline tasks", () => {
    expect(tasks.sort()).toEqual(
      ["brief_extraction", "copy_generation", "design_resolution", "field_regeneration"].sort(),
    );
  });

  it.each(Object.entries(TASK_ROUTES))(
    "%s has a primary, fallbacks, and sane maxTokens",
    (_task, route) => {
      expect(route.primary.length).toBeGreaterThan(0);
      expect(route.fallbacks.length).toBeGreaterThan(0);
      expect(route.fallbacks).not.toContain(route.primary);
      expect(route.maxTokens).toBeGreaterThan(0);
    },
  );

  it("has a pricing entry for every routed model (cost logging contract)", () => {
    const models = new Set(Object.values(TASK_ROUTES).flatMap((r) => [r.primary, ...r.fallbacks]));
    for (const model of models) {
      expect(MODEL_PRICES_PER_MTOK[model], `missing price for ${model}`).toBeDefined();
    }
  });
});
