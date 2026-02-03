import * as React from "react";
import { cn } from "../../lib/utils";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        className={cn(
          "flex h-10 w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = "Select";

const SelectTrigger = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, ...props }, ref) => {
    return <Select ref={ref} className={className} {...props} />;
  }
);
SelectTrigger.displayName = "SelectTrigger";

const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "absolute z-50 min-w-[8rem] overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-md",
        className
      )}
      {...props}
    />
  );
});
SelectContent.displayName = "SelectContent";

const SelectItem = React.forwardRef<
  HTMLOptionElement,
  React.OptionHTMLAttributes<HTMLOptionElement>
>(({ className, ...props }, ref) => {
  return <option ref={ref} className={className} {...props} />;
});
SelectItem.displayName = "SelectItem";

const SelectValue = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { placeholder?: string }
>(({ className, placeholder, ...props }, ref) => {
  return (
    <span ref={ref} className={cn("block truncate", className)} {...props}>
      {props.children || placeholder}
    </span>
  );
});
SelectValue.displayName = "SelectValue";

export { Select, SelectTrigger, SelectContent, SelectItem, SelectValue };
