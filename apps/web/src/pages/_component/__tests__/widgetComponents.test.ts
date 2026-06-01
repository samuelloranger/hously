import { describe, it, expect } from "vitest";
import { WIDGET_COMPONENTS } from "@/pages/_component/widgetComponents";

describe("WIDGET_COMPONENTS", () => {
  it("registers every widget id as a lazy (code-split) component", () => {
    const ids = Object.keys(WIDGET_COMPONENTS);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const C = WIDGET_COMPONENTS[id as keyof typeof WIDGET_COMPONENTS];
      // React.lazy returns an exotic object with $$typeof === Symbol(react.lazy)
      expect((C as { $$typeof?: symbol }).$$typeof?.toString()).toBe(
        "Symbol(react.lazy)",
      );
    }
  });
});
