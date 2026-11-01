import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Joins class names (clsx: skips false/null, handles conditionals) and lets
// later Tailwind classes override earlier ones (twMerge: "text-sm text-xs" -> "text-xs").
// Usage: cn('px-3 rounded-lg', active && 'bg-white/8', className)
export const cn = (...classes: ClassValue[]) => twMerge(clsx(classes))
