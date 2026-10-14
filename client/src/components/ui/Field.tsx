import clsx from 'clsx';
import { Check } from 'lucide-react';
import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

const controlBase =
  'block w-full rounded-control border bg-sand-50 px-4 text-sm text-river-700 placeholder:text-river-500 transition-colors focus:outline-none focus:ring-2 disabled:bg-sand-100 disabled:text-river-500';

function controlClasses(invalid?: boolean, extra?: string) {
  return clsx(
    controlBase,
    invalid ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-sand-200 focus:border-leaf-600 focus:ring-leaf-100',
    extra,
  );
}

interface FormFieldProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>;
}

/** Wires label, hint and error message to the control for screen readers. */
export function FormField({ label, error, hint, required, className, children }: FormFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={clsx('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-river-800">
        {label}
        {required && <span className="ml-0.5 text-red-600" aria-hidden>*</span>}
      </label>
      {isValidElement(children)
        ? cloneElement(children, { id, 'aria-invalid': Boolean(error) || undefined, 'aria-describedby': describedBy })
        : children}
      {hint && !error && (
        <p id={hintId} className="text-xs text-river-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...rest }, ref) {
    return <input ref={ref} className={controlClasses(invalid ?? Boolean(rest['aria-invalid']), clsx('min-h-11', className))} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 4, ...rest },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={controlClasses(Boolean(rest['aria-invalid']), clsx('py-2.5', className))} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={controlClasses(Boolean(rest['aria-invalid']), clsx('min-h-11 pr-8', className))} {...rest}>
      {children}
    </select>
  );
});

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ label, description, className, ...rest }, ref) {
  return (
    <label className={clsx('flex min-h-11 cursor-pointer items-start gap-3 py-1.5', className)}>
      <span className="relative mt-0.5 inline-flex">
        <input ref={ref} type="checkbox" className="peer size-5 cursor-pointer appearance-none rounded border border-sand-300 bg-white checked:border-leaf-600 checked:bg-leaf-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf-500" {...rest} />
        <Check className="pointer-events-none absolute inset-0 m-auto size-3.5 text-white opacity-0 peer-checked:opacity-100" aria-hidden />
      </span>
      <span className="text-sm">
        <span className="font-medium text-river-800">{label}</span>
        {description && <span className="block text-xs text-river-500">{description}</span>}
      </span>
    </label>
  );
});

/** Pill-style toggle used for multi-select filters (category, area, interests). */
export function ChipToggle({
  checked,
  onChange,
  children,
  icon,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={clsx(
        'inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
        checked ? 'border-leaf-600 bg-leaf-600 text-white' : 'border-sand-300 bg-white text-river-700 hover:border-leaf-400',
      )}
    >
      {icon}
      {children}
    </button>
  );
}
