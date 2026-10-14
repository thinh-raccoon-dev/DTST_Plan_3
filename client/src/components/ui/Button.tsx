import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'inverted' | 'outlineInverted';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[background-color,box-shadow,transform,border-color,color] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 select-none';

const variants: Record<Variant, string> = {
  primary: 'bg-leaf-600 text-white shadow-cta hover:bg-leaf-700 focus-visible:outline-leaf-600',
  accent: 'bg-leaf-800 text-white shadow-[0_10px_24px_-12px_rgb(15_47_37/0.55)] hover:bg-river-950 focus-visible:outline-leaf-800',
  secondary: 'border border-sand-200 bg-white text-river-700 shadow-card hover:border-leaf-300 hover:text-leaf-700',
  ghost: 'text-river-700 hover:bg-leaf-50 hover:text-river-900',
  danger: 'bg-red-700 text-white hover:bg-red-800 focus-visible:outline-red-600',
  /** Nút trắng trên nền tối (panel xanh rừng). */
  inverted: 'bg-white text-leaf-800 hover:bg-leaf-50 focus-visible:outline-white',
  /** Nút viền mờ trên nền tối. */
  outlineInverted: 'border border-white/25 bg-white/10 text-white hover:bg-white/15 focus-visible:outline-white',
};

const sizes: Record<Size, string> = {
  sm: 'min-h-9 px-4 text-sm',
  md: 'min-h-11 px-5 text-sm',
  lg: 'min-h-12 px-6 text-base',
};

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return clsx(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

interface ButtonLinkProps extends LinkProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function ButtonLink({ variant = 'primary', size = 'md', icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, typeof className === 'string' ? className : undefined)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
