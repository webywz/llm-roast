import { describe, expect, it } from "vitest";
import { copyToClipboard } from "../src/clipboard.js";

describe("copyToClipboard", () => {
  it("returns a boolean and does not throw", () => {
    expect(() => {
      const result = copyToClipboard("llm-roast clipboard probe");
      expect(typeof result).toBe("boolean");
    }).not.toThrow();
  });
});
