import type { ButtonHTMLAttributes } from 'react'
import { cn } from './cn'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants
}

const variants = {
  // Solid accent: Send
  primary:
    'h-9 px-4 rounded-lg bg-accent text-[13px] font-medium text-on-accent hover:bg-accent-strong disabled:bg-raised disabled:text-faint disabled:cursor-not-allowed',
  // Bordered: New chat, Continue with Google, Stop
  outline: 'h-9 px-3 rounded-lg border border-line text-[13px] font-medium text-ink hover:bg-raised',
  // Plain text: Copy, Download, Open
  link: 'text-[12px] text-muted hover:text-ink',
}

// Text button. Pass `className` to adjust size/layout; it overrides the
// variant's classes where they clash (e.g. className='h-11 text-[14px]').
export function Button({ variant = 'primary', className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn('flex items-center justify-center gap-2 transition-colors cursor-pointer', variants[variant], className)}
      {...props}
    />
  )
}

// Square icon-only button (close, delete...). Always give it a `title` so it
// has a tooltip and an accessible name.
export function IconButton({ className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        'w-8 h-8 shrink-0 flex items-center justify-center rounded-md text-muted hover:bg-raised hover:text-ink transition-colors cursor-pointer',
        className,
      )}
      {...props}
    />
  )
}
