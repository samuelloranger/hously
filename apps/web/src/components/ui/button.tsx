import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-neutral-800 dark:focus-visible:ring-primary-600',
  {
    variants: {
      variant: {
        default: 'bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-600 dark:hover:bg-primary-700',
        destructive: 'bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700',
        outline:
          'border border-neutral-300 bg-white hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:hover:text-neutral-50',
        secondary:
          'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-700',
        ghost: 'hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-50',
        link: 'text-primary-600 underline-offset-4 hover:underline dark:text-primary-400',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => {
  return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';

export { Button };
