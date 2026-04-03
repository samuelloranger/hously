import { describe, it, expect } from "bun:test";
import { parseNumber } from "../services/trackers/utils";

describe("parseNumber", () => {
  it("parses integers", () => {
    expect(parseNumber("42")).toBe(42);
    expect(parseNumber("0")).toBe(0);
    expect(parseNumber("1234")).toBe(1234);
  });

  it("parses decimals", () => {
    expect(parseNumber("3.14")).toBe(3.14);
    expect(parseNumber("1.5")).toBe(1.5);
  });

  it("parses numbers with comma as decimal separator", () => {
    expect(parseNumber("3,14")).toBe(3.14);
    expect(parseNumber("1,5")).toBe(1.5);
  });

  it("parses negative numbers", () => {
    expect(parseNumber("-5")).toBe(-5);
    expect(parseNumber("-1.23")).toBe(-1.23);
  });

  it("parses numbers with surrounding whitespace", () => {
    expect(parseNumber("  42  ")).toBe(42);
    expect(parseNumber("\t3.14\n")).toBe(3.14);
  });

  it("parses numbers embedded in text", () => {
    expect(parseNumber("ratio: 2.5")).toBe(2.5);
    expect(parseNumber("100 seeders")).toBe(100);
  });

  it("returns null for infinity symbol", () => {
    expect(parseNumber("∞")).toBeNull();
    expect(parseNumber("ratio: ∞")).toBeNull();
  });

  it("returns null for non-numeric strings", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("N/A")).toBeNull();
  });

  it("returns null for Infinity values", () => {
    expect(parseNumber("Infinity")).toBeNull();
  });
});
