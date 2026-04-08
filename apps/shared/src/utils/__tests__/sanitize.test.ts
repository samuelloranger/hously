import { describe, it, expect } from "bun:test";
import { sanitizeInput, sanitizeRichText, isValidColor } from "../sanitize";

describe("sanitizeInput", () => {
  it("escapes < and >", () => {
    expect(sanitizeInput("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert('xss')&lt;/script&gt;",
    );
  });

  it("leaves normal text unchanged", () => {
    expect(sanitizeInput("Hello world")).toBe("Hello world");
  });

  it("escapes multiple occurrences", () => {
    expect(sanitizeInput("<b>bold</b> & <i>italic</i>")).toBe(
      "&lt;b&gt;bold&lt;/b&gt; & &lt;i&gt;italic&lt;/i&gt;",
    );
  });
});

describe("sanitizeRichText", () => {
  it("allows whitelisted tags", () => {
    expect(sanitizeRichText("<b>bold</b>")).toBe("<b>bold</b>");
    expect(sanitizeRichText("<em>emphasis</em>")).toBe("<em>emphasis</em>");
    expect(sanitizeRichText("<p>paragraph</p>")).toBe("<p>paragraph</p>");
  });

  it("escapes disallowed tags", () => {
    expect(sanitizeRichText("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert('xss')&lt;/script&gt;",
    );
    expect(sanitizeRichText("<iframe src='evil'></iframe>")).toBe(
      "&lt;iframe src='evil'&gt;&lt;/iframe&gt;",
    );
  });

  it("preserves safe href on anchor tags", () => {
    expect(sanitizeRichText('<a href="https://example.com">link</a>')).toBe(
      '<a href="https://example.com">link</a>',
    );
  });

  it("strips javascript: protocol from href", () => {
    const result = sanitizeRichText('<a href="javascript:alert(1)">link</a>');
    expect(result).not.toContain("javascript:");
  });

  it("strips data: protocol from href", () => {
    const result = sanitizeRichText(
      '<a href="data:text/html,<h1>bad</h1>">link</a>',
    );
    expect(result).not.toContain("data:");
  });

  it("strips vbscript: protocol from href", () => {
    const result = sanitizeRichText('<a href="vbscript:msgbox">link</a>');
    expect(result).not.toContain("vbscript:");
  });

  it("handles self-closing br tags", () => {
    expect(sanitizeRichText("<br>")).toBe("<br />");
  });

  it("strips attributes from non-anchor allowed tags", () => {
    expect(sanitizeRichText('<b class="bold" onclick="hack()">text</b>')).toBe(
      "<b>text</b>",
    );
  });
});

describe("isValidColor", () => {
  it("accepts valid hex colors", () => {
    expect(isValidColor("#FF0000")).toBe(true);
    expect(isValidColor("#00ff00")).toBe(true);
    expect(isValidColor("#aaBB99")).toBe(true);
  });

  it("rejects invalid hex colors", () => {
    expect(isValidColor("#FFF")).toBe(false);
    expect(isValidColor("#GGGGGG")).toBe(false);
    expect(isValidColor("FF0000")).toBe(false);
  });

  it("accepts named CSS colors", () => {
    expect(isValidColor("red")).toBe(true);
    expect(isValidColor("blue")).toBe(true);
    expect(isValidColor("cornflowerblue")).toBe(true);
  });

  it("rejects strings with numbers or special chars as named colors", () => {
    expect(isValidColor("red1")).toBe(false);
    expect(isValidColor("not-a-color")).toBe(false);
  });
});
