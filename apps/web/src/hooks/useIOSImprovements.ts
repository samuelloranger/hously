/**
 * Hook to handle iOS-specific improvements for better user experience
 * - Touch responsiveness improvements
 * - Prevents zoom on double tap for form elements
 * - Viewport height fix for iOS address bar
 */

import { useEffect } from "react";

export function useIOSImprovements(): void {
  useEffect(() => {
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    if (!isIOS) {
      return;
    }

    // Improve touch responsiveness
    document.addEventListener("touchstart", () => {}, { passive: true });

    // Prevent zoom on double tap for form elements
    let lastTouchEnd = 0;
    const touchEndHandler = (event: TouchEvent) => {
      const now = new Date().getTime();
      const timeSince = now - lastTouchEnd;

      if (timeSince < 300 && timeSince > 40) {
        event.preventDefault();
      }

      lastTouchEnd = now;
    };

    document.addEventListener("touchend", touchEndHandler, false);

    // Viewport height fix for iOS address bar
    function setVH() {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    }

    setVH();
    window.addEventListener("resize", setVH);
    window.addEventListener("orientationchange", () => {
      setTimeout(setVH, 100);
    });

    // Cleanup function
    return () => {
      document.removeEventListener("touchend", touchEndHandler);
      window.removeEventListener("resize", setVH);
      window.removeEventListener("orientationchange", () => {
        setTimeout(setVH, 100);
      });
    };
  }, []);
}
