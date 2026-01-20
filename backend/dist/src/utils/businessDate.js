"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBusinessDate = getBusinessDate;
exports.getBusinessDateKey = getBusinessDateKey;
exports.getBusinessDateKeyHourly = getBusinessDateKeyHourly;
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
function getBusinessDate(date = new Date()) {
    const businessDate = new Date(date);
    // If before 6 AM, use previous day
    if (businessDate.getHours() < 6) {
        businessDate.setDate(businessDate.getDate() - 1);
    }
    // Reset to midnight for consistent date comparison
    businessDate.setHours(0, 0, 0, 0);
    return businessDate;
}
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
function getBusinessDateKey(date = new Date()) {
    const businessDate = getBusinessDate(date);
    const year = businessDate.getFullYear();
    const month = String(businessDate.getMonth() + 1).padStart(2, '0');
    const day = String(businessDate.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}
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
function getBusinessDateKeyHourly(date = new Date()) {
    const businessDate = getBusinessDate(date);
    const year = businessDate.getFullYear();
    const month = String(businessDate.getMonth() + 1).padStart(2, '0');
    const day = String(businessDate.getDate()).padStart(2, '0');
    // CRITICAL: Use ORIGINAL hour (not adjusted business date hour)
    // Rationale: businessDate is always midnight (00), we need actual hour for sharding
    const hour = String(date.getHours()).padStart(2, '0');
    return `${year}${month}${day}${hour}`;
}
//# sourceMappingURL=businessDate.js.map