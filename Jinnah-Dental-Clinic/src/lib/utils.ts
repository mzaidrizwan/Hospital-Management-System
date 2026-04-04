// lib/utils.ts - Already have formatCurrency, but ensure it removes decimals

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  if (isNaN(amount)) return 'Rs. 0';
  // Round to nearest integer to remove decimal points
  const roundedAmount = Math.round(amount);
  return 'Rs. ' + new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(roundedAmount);
}