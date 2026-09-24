import { describe, it, expect } from "vitest";
import { checkRateLimit } from "@/lib/security/rate-limit";

describe("Rate Limiter", () => {
  it("should allow requests under the limit", () => {
    const id = `test-user-${Date.now()}`;
    const r1 = checkRateLimit(id, { limit: 3, windowMs: 10000 });
    expect(r1.success).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = checkRateLimit(id, { limit: 3, windowMs: 10000 });
    expect(r2.success).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit(id, { limit: 3, windowMs: 10000 });
    expect(r3.success).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("should block requests exceeding the limit", () => {
    const id = `test-blocked-${Date.now()}`;
    checkRateLimit(id, { limit: 2, windowMs: 10000 });
    checkRateLimit(id, { limit: 2, windowMs: 10000 });

    const blocked = checkRateLimit(id, { limit: 2, windowMs: 10000 });
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });
});
