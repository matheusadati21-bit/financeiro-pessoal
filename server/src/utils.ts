import type { Decimal } from '@prisma/client/runtime/library';

export const toNumber = (value: Decimal | number | string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return Number(value);
};

export const startOfMonth = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(`${value}-01T00:00:00.000Z`) : value;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0));
};

export const endOfMonth = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(`${value}-01T00:00:00.000Z`) : value;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0));
};

export const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

export const addMonths = (date: Date, months: number) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  return d;
};

export const currency = (value: Decimal | number | string | null | undefined) => Math.round(toNumber(value) * 100) / 100;

export const parseDate = (date: string) => new Date(`${date.includes('T') ? date : `${date}T12:00:00.000Z`}`);

export const serialize = <T>(data: T): T => JSON.parse(JSON.stringify(data, (_, value) => {
  if (value && typeof value === 'object' && typeof value.toNumber === 'function') return value.toNumber();
  return value;
}));
