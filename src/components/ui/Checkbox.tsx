import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, id, ...props }, ref) => {
    const checkboxId = id || label.toLowerCase().replace(/\s+/g, '-');

    return (
      <label
        htmlFor={checkboxId}
        className={cn(
          'flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all',
          'min-h-[56px]',
          'hover:bg-surface-secondary hover:border-border-secondary',
          'has-[:checked]:bg-primary-50 has-[:checked]:border-primary-500',
          'has-[:focus]:ring-2 has-[:focus]:ring-primary-500 has-[:focus]:ring-offset-2 has-[:focus]:ring-offset-background',
          className
        )}
      >
        <input
          ref={ref}
          type="checkbox"
          id={checkboxId}
          className={cn(
            'w-6 h-6 mt-0.5 rounded border-2 border-border',
            'text-primary-600 focus:ring-primary-500 focus:ring-2',
            'cursor-pointer flex-shrink-0'
          )}
          {...props}
        />
        <div className="flex-1 min-w-0">
          <span className="text-base font-medium text-text-primary break-words">
            {label}
          </span>
          {description && (
            <p className="text-sm text-text-secondary mt-0.5">{description}</p>
          )}
        </div>
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export { Checkbox };
