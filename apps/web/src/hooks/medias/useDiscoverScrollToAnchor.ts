import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Smooth-scroll to anchor when discover identity changes — not on first paint
 * and not on React Strict Mode’s duplicate effect (same signature twice).
 */
export function useDiscoverScrollToAnchor(
  topRef: RefObject<HTMLDivElement | null>,
  signature: string,
) {
  const sigRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const prev = sigRef.current;
    if (prev === null) {
      sigRef.current = signature;
      return;
    }
    if (prev === signature) return;
    sigRef.current = signature;
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [signature]);
}
