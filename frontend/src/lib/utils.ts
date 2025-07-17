import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwindcss/lib/util/index.js";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatPercentage = (value: number): string => {
  return `${Math.round(value)}%`;
};

export const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const formatDateShort = (date: string): string => {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
};

export const getDealStatusColor = (status: string): string => {
  switch (status) {
    case 'closed_won':
      return 'bg-green-100 text-green-800';
    case 'closed_lost':
      return 'bg-red-100 text-red-800';
    case 'open':
    default:
      return 'bg-blue-100 text-blue-800';
  }
};

export const getCategoryColor = (category: string): string => {
  switch (category) {
    case 'closed':
      return 'bg-green-100 text-green-800';
    case 'commit':
      return 'bg-orange-100 text-orange-800';
    case 'best_case':
      return 'bg-purple-100 text-purple-800';
    case 'pipeline':
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const getTrendIcon = (trend: 'up' | 'down' | 'stable'): string => {
  switch (trend) {
    case 'up':
      return '↗️';
    case 'down':
      return '↘️';
    case 'stable':
    default:
      return '→';
  }
};

export const calculateDaysUntilClose = (closeDate: string): number => {
  const close = new Date(closeDate);
  const today = new Date();
  const diffTime = close.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export const getDealUrgencyColor = (daysUntilClose: number): string => {
  if (daysUntilClose < 0) return 'text-red-600'; // Overdue
  if (daysUntilClose <= 7) return 'text-orange-600'; // Within a week
  if (daysUntilClose <= 30) return 'text-yellow-600'; // Within a month
  return 'text-gray-600'; // Future
};

export const getInitials = (firstName: string, lastName: string): string => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const isCurrentPeriod = (startDate: string, endDate: string): boolean => {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  return now >= start && now <= end;
};

export const getQuarterName = (date: string): string => {
  const d = new Date(date);
  const month = d.getMonth();
  const year = d.getFullYear();
  const quarter = Math.floor(month / 3) + 1;
  return `Q${quarter} ${year}`;
};

export const getMonthName = (date: string): string => {
  const d = new Date(date);
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};