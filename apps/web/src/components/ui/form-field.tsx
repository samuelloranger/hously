import * as React from 'react';
import { cn } from '../../lib/utils';
import { Input } from './input';
import { Textarea } from './textarea';
import { Select } from './select';

interface FormFieldProps {
  label?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

function FormField({ label, error, required, className, children }: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {children}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  required?: boolean;
}

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, required, className, ...props }, ref) => {
    return (
      <FormField label={label} error={error} required={required}>
        <Input ref={ref} className={cn(error && 'border-red-500 focus:ring-red-500', className)} {...props} />
      </FormField>
    );
  }
);
FormInput.displayName = 'FormInput';

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  required?: boolean;
}

export const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, error, required, className, ...props }, ref) => {
    return (
      <FormField label={label} error={error} required={required}>
        <Textarea ref={ref} className={cn(error && 'border-red-500 focus:ring-red-500', className)} {...props} />
      </FormField>
    );
  }
);
FormTextarea.displayName = 'FormTextarea';

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  required?: boolean;
}

const FormSelect = React.forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ label, error, required, className, children, ...props }, ref) => {
    return (
      <FormField label={label} error={error} required={required}>
        <Select ref={ref} className={cn(error && 'border-red-500 focus:ring-red-500', className)} {...props}>
          {children}
        </Select>
      </FormField>
    );
  }
);
FormSelect.displayName = 'FormSelect';
