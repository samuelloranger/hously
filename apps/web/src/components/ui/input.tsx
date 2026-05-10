import * as React from "react";
import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md px-3 py-2 text-sm",
          "border border-neutral-200 border-l-2 border-l-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-500",
          "dark:border-neutral-700 dark:border-l-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-400",
          "focus:outline-none focus:border-l-primary-500 focus:shadow-[0_0_0_3px_rgba(34,197,94,0.08)]",
          "transition-all duration-150",
          "disabled:cursor-not-allowed disabled:opacity-40",
          "[&[type=number]]:font-mono [&[type=search]]:font-mono",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
