import { Suspense } from "react";
import { useLocation } from "@tanstack/react-router";
import { Outlet } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { HouseLoader } from "@/components/HouseLoader";

export function PageTransition() {
  const location = useLocation();

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-neutral-900">
          <HouseLoader size="lg" />
        </div>
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          className="h-full flex flex-col flex-1"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </motion.div>
      </AnimatePresence>
    </Suspense>
  );
}
