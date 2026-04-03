import { Suspense } from "react";
import { useLocation } from "@tanstack/react-router";
import { Outlet } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { HouseLoader } from "@/components/HouseLoader";

export function PageTransition() {
  const location = useLocation();

  // Key is on the inner div for animations, not on Suspense wrapper
  // This prevents Suspense from remounting and re-checking lazy components
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-neutral-900">
          <HouseLoader size="lg" />
        </div>
      }
    >
      <div
        className="h-full flex flex-col flex-1 page-transition page-enter"
        key={location.pathname}
      >
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </div>
    </Suspense>
  );
}
