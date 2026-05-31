import * as React from "react";
import { cn } from "@/lib/utils";

export interface ToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  size?: "default" | "sm" | "lg" | "xs";
}

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  (
    { className, pressed, onPressedChange, size = "default", ...props },
    ref,
  ) => {
    const sizeClasses = {
      default: "h-10 px-3",
      sm: "h-9 px-2",
      lg: "h-11 px-4",
      xs: "h-6 px-1.5",
    };

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-pressed={pressed}
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 disabled:pointer-events-none disabled:opacity-50",
          pressed
            ? "bg-primary-600 text-neutral-950 hover:bg-primary-500"
            : "bg-neutral-800 text-neutral-100 hover:bg-neutral-700 hover:text-neutral-50",
          sizeClasses[size],
          className,
        )}
        onClick={() => onPressedChange?.(!pressed)}
        {...props}
      />
    );
  },
);
Toggle.displayName = "Toggle";

export { Toggle };
