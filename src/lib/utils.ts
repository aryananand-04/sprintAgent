import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Translucent version of any CSS colour (hex or var()). Replaces fragile `${hex}22` string concatenation. */
export const withAlpha = (color: string, alpha: number) =>
  `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`
