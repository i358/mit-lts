import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extracts the code from codename format
 * Format: "username (code)" or just "code"
 * Returns only the code part
 */
export function extractCode(codename: string | undefined): string {
  if (!codename) return 'X';
  
  // Try to extract code from format "username (code)"
  const match = codename.match(/\(([^)]+)\)$/);
  if (match && match[1]) {
    return match[1];
  }
  
  // If no parentheses found, return as is (might already be just the code)
  return codename;
}
