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
          "bg-[var(--surface-1)]",
          "border border-[var(--surface-border)] border-l-2 border-l-[var(--surface-border)]",
          "text-slate-100 placeholder:text-[var(--surface-muted-fg)]",
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
