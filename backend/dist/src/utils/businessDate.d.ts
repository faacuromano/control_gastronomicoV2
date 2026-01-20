/**
 * @fileoverview Business Date utility functions
 * Centralized logic for calculating business dates with 6 AM cutoff
 *
 * @module utils/businessDate
 *
 * BUSINESS RULE:
 * Orders created before 6 AM belong to the previous calendar day.
 * This ensures late-night operations (e.g., 2 AM) are grouped with
 * the previous day's business for reporting and order numbering.
 */
/**
 * Calculate the business date for a given datetime.
 *
 * @param date - The datetime to calculate business date for (defaults to now)
 * @returns Date object set to midnight of the business day
 *
 * @example
 * // If it's 2026-01-19 at 5:30 AM:
 * getBusinessDate() // Returns 2026-01-18 00:00:00
 *
 * // If it's 2026-01-19 at 6:00 AM or later:
 * getBusinessDate() // Returns 2026-01-19 00:00:00
 */
export declare function getBusinessDate(date?: Date): Date;
/**
 * Get the business date key in YYYYMMDD format.
 * Used for OrderSequence sharding (legacy/daily sharding).
 *
 * @param date - The datetime to calculate business date for (defaults to now)
 * @returns String in format "YYYYMMDD" (e.g., "20260119")
 *
 * @example
 * getBusinessDateKey() // "20260119"
 *
 * @deprecated Use getBusinessDateKeyHourly() for better performance
 */
export declare function getBusinessDateKey(date?: Date): string;
/**
 * Get the business date key with HOUR granularity in YYYYMMDDHH format.
 *
 * PERFORMANCE OPTIMIZATION:
 * - Reduces OrderSequence lock contention by 24x (1 row per day → 24 rows per day)
 * - Expected latency improvement: 1200ms → 50ms
 * - Each hour gets its own sequence counter (isolated locking)
 *
 * BUSINESS RULE:
 * - Hour is based on the ORIGINAL timestamp (before 6 AM adjustment)
 * - This ensures chronological ordering within the business day
 *
 * @param date - The datetime to calculate business date for (defaults to now)
 * @returns String in format "YYYYMMDDHH" (e.g., "2026011914" for 2 PM)
 *
 * @example
 * // If it's 2026-01-19 at 14:30 (2:30 PM):
 * getBusinessDateKeyHourly() // "2026011914"
 *
 * // If it's 2026-01-20 at 02:30 AM (before 6 AM cutoff):
 * getBusinessDateKeyHourly() // "2026011902" (business date is 2026-01-19, hour is 02)
 */
export declare function getBusinessDateKeyHourly(date?: Date): string;
//# sourceMappingURL=businessDate.d.ts.map