interface HouseLoaderProps {
  size?: "sm" | "md" | "lg";
}

/**
 * An animated house-themed loading spinner for the Hously app.
 * Features a house being "built" with animated elements.
 */
export function HouseLoader({ size = "md" }: HouseLoaderProps) {
  const textClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      {/* Loading text with animated dots */}
      <div
        className={`${textClasses[size]} text-neutral-500 dark:text-neutral-400 text-[50px] font-medium`}
      >
        <span className="inline-flex w-6 justify-start">
          <span
            className="animate-bounce"
            style={{ animationDelay: "0ms", animationDuration: "1s" }}
          >
            .
          </span>
          <span
            className="animate-bounce"
            style={{ animationDelay: "150ms", animationDuration: "1s" }}
          >
            .
          </span>
          <span
            className="animate-bounce"
            style={{ animationDelay: "300ms", animationDuration: "1s" }}
          >
            .
          </span>
        </span>
      </div>

      {/* Inline styles for custom animations */}
      <style>{`
        @keyframes fadeIn {
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
