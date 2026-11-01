import type { ButtonHTMLAttributes } from 'react'
import { cn } from './cn'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants
}

const variants = {
  // Solid white: Send, Continue with Google
  primary:
    'h-9 px-4 rounded-xl bg-white text-[13px] font-medium text-slate-900 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed',
  // Bordered: New chat
  outline: 'h-10 px-3 rounded-xl border border-line text-[13px] font-medium text-slate-200 hover:bg-white/5',
  // Plain text: Copy, Download, Open, Log out
  link: 'text-[12px] text-slate-400 hover:text-slate-100',
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
        'w-7 h-7 shrink-0 flex items-center justify-center rounded-lg text-slate-400 hover:bg-white/6 hover:text-slate-100 transition-colors cursor-pointer',
        className,
      )}
      {...props}
    />
  )
}
