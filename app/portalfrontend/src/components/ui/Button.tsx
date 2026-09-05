import * as React from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'outline' | 'ghost';
type ButtonSize = 'default' | 'lg' | 'sm';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // 2026-09-05 redesign (mockup-approved): navy->lime gradient on every primary CTA, matching the
  // single consistent `.btn-solid`/`.glass-cta` treatment the mockup used everywhere - not just
  // the nav. hover:brightness-105 rather than the old bg-primary/90, since a gradient can't be
  // darkened with an opacity trick the same way a flat fill can.
  primary: 'bg-gradient-to-br from-primary to-brand-green text-white shadow-md hover:brightness-105',
  outline: 'border border-input bg-background hover:bg-secondary',
  ghost: 'hover:bg-secondary',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  default: 'h-11 px-5 text-sm',
  lg: 'h-12 px-7 text-base',
  sm: 'h-9 px-3 text-sm',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'default', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
