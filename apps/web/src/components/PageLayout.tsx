import { ReactNode } from "react";
import { usePWA } from "../hooks/usePWA";

interface PageLayoutProps {
  children: ReactNode;
  className?: string;
}

export function PageLayout({ children, className = "" }: PageLayoutProps) {
  const { isStandalone } = usePWA();
  return (
    <div
      className={`pt-8 w-full max-w-7xl mx-auto px-4 ${
        isStandalone ? "pb-8" : "pb-4"
      } sm:px-6 lg:px-8 ${className}`}
    >
      {children}
    </div>
  );
}
