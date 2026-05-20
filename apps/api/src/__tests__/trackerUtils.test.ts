import { describe, it, expect } from "bun:test";
import { parseRatio } from "@hously/api/services/trackers/parseUtils";

describe("parseRatio", () => {
  it("parses integers", () => {
    expect(parseRatio("42")).toBe(42);
    expect(parseRatio("0")).toBe(0);
    expect(parseRatio("1234")).toBe(1234);
  });

  it("parses decimals", () => {
    expect(parseRatio("3.14")).toBe(3.14);
    expect(parseRatio("1.5")).toBe(1.5);
  });

  it("parses numbers with comma as decimal separator", () => {
    expect(parseRatio("3,14")).toBe(3.14);
    expect(parseRatio("1,5")).toBe(1.5);
  });

  it("parses negative numbers", () => {
    expect(parseRatio("-5")).toBe(-5);
    expect(parseRatio("-1.23")).toBe(-1.23);
  });

  it("parses numbers with surrounding whitespace", () => {
    expect(parseRatio("  42  ")).toBe(42);
    expect(parseRatio("\t3.14\n")).toBe(3.14);
  });

  it("parses numbers embedded in text", () => {
    expect(parseRatio("ratio: 2.5")).toBe(2.5);
    expect(parseRatio("100 seeders")).toBe(100);
  });

  it("returns null for infinity symbol", () => {
    expect(parseRatio("∞")).toBeNull();
    expect(parseRatio("ratio: ∞")).toBeNull();
  });

  it("returns null for non-numeric strings", () => {
    expect(parseRatio("")).toBeNull();
    expect(parseRatio("abc")).toBeNull();
    expect(parseRatio("N/A")).toBeNull();
  });

  it("returns null for Infinity values", () => {
    expect(parseRatio("Infinity")).toBeNull();
  });
});
