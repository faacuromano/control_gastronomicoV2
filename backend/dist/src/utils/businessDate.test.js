"use strict";
/**
 * @fileoverview Tests for business date utility functions
 *
 * CRITICAL: These tests verify the 6 AM cutoff rule and hourly sharding logic
 */
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const businessDate_1 = require("./businessDate");
(0, globals_1.describe)('getBusinessDate', () => {
    (0, globals_1.it)('should return same day if after 6 AM', () => {
        const testDate = new Date('2026-01-19T08:00:00'); // 8 AM
        const result = (0, businessDate_1.getBusinessDate)(testDate);
        (0, globals_1.expect)(result.getFullYear()).toBe(2026);
        (0, globals_1.expect)(result.getMonth()).toBe(0); // January = 0
        (0, globals_1.expect)(result.getDate()).toBe(19);
        (0, globals_1.expect)(result.getHours()).toBe(0); // Midnight
    });
    (0, globals_1.it)('should return previous day if before 6 AM', () => {
        const testDate = new Date('2026-01-19T05:30:00'); // 5:30 AM
        const result = (0, businessDate_1.getBusinessDate)(testDate);
        (0, globals_1.expect)(result.getFullYear()).toBe(2026);
        (0, globals_1.expect)(result.getMonth()).toBe(0);
        (0, globals_1.expect)(result.getDate()).toBe(18); // Previous day
        (0, globals_1.expect)(result.getHours()).toBe(0); // Midnight
    });
    (0, globals_1.it)('should handle exactly 6 AM as current day', () => {
        const testDate = new Date('2026-01-19T06:00:00'); // Exactly 6 AM
        const result = (0, businessDate_1.getBusinessDate)(testDate);
        (0, globals_1.expect)(result.getDate()).toBe(19); // Same day
    });
});
(0, globals_1.describe)('getBusinessDateKey', () => {
    (0, globals_1.it)('should format date as YYYYMMDD', () => {
        const testDate = new Date('2026-01-19T14:30:00'); // Jan 19, 2PM
        const result = (0, businessDate_1.getBusinessDateKey)(testDate);
        (0, globals_1.expect)(result).toBe('20260119');
    });
    (0, globals_1.it)('should pad single-digit month', () => {
        const testDate = new Date('2026-03-05T10:00:00'); // March 5
        const result = (0, businessDate_1.getBusinessDateKey)(testDate);
        (0, globals_1.expect)(result).toBe('20260305');
    });
    (0, globals_1.it)('should apply 6 AM rule', () => {
        const testDate = new Date('2026-01-20T02:30:00'); // Jan 20, 2:30 AM
        const result = (0, businessDate_1.getBusinessDateKey)(testDate);
        (0, globals_1.expect)(result).toBe('20260119'); // Business date is Jan 19
    });
});
(0, globals_1.describe)('getBusinessDateKeyHourly', () => {
    (0, globals_1.it)('should format date as YYYYMMDDHH', () => {
        const testDate = new Date('2026-01-19T14:30:00'); // Jan 19, 2:30 PM
        const result = (0, businessDate_1.getBusinessDateKeyHourly)(testDate);
        (0, globals_1.expect)(result).toBe('2026011914'); // Hour = 14
    });
    (0, globals_1.it)('should pad single-digit hour', () => {
        const testDate = new Date('2026-01-19T08:15:00'); // 8:15 AM
        const result = (0, businessDate_1.getBusinessDateKeyHourly)(testDate);
        (0, globals_1.expect)(result).toBe('2026011908'); // Hour = 08
    });
    (0, globals_1.it)('should use ORIGINAL hour even with 6 AM rule', () => {
        // CRITICAL TEST: Verify hour is from original timestamp
        const testDate = new Date('2026-01-20T02:30:00'); // Jan 20, 2:30 AM
        const result = (0, businessDate_1.getBusinessDateKeyHourly)(testDate);
        // Business date: Jan 19 (due to 6 AM rule)
        // Hour: 02 (from original timestamp, NOT midnight)
        (0, globals_1.expect)(result).toBe('2026011902');
    });
    (0, globals_1.it)('should handle midnight correctly', () => {
        const testDate = new Date('2026-01-19T00:30:00'); // 12:30 AM
        const result = (0, businessDate_1.getBusinessDateKeyHourly)(testDate);
        // Before 6 AM, so business date is Jan 18
        // Hour is 00 from original timestamp
        (0, globals_1.expect)(result).toBe('2026011800');
    });
    (0, globals_1.it)('should handle late night hours (22-23)', () => {
        const testDate = new Date('2026-01-19T23:45:00'); // 11:45 PM
        const result = (0, businessDate_1.getBusinessDateKeyHourly)(testDate);
        (0, globals_1.expect)(result).toBe('2026011923');
    });
    (0, globals_1.it)('should create 24 unique keys per day', () => {
        const keys = new Set();
        // Generate keys for every hour of Jan 19
        for (let hour = 0; hour < 24; hour++) {
            const testDate = new Date(`2026-01-19T${String(hour).padStart(2, '0')}:30:00`);
            const key = (0, businessDate_1.getBusinessDateKeyHourly)(testDate);
            keys.add(key);
        }
        // Should have 24 unique keys (one per hour)
        // Note: Hours 0-5 will map to previous day's business date
        (0, globals_1.expect)(keys.size).toBe(24);
    });
    (0, globals_1.it)('should maintain chronological ordering', () => {
        const date1 = new Date('2026-01-19T13:00:00'); // 1 PM
        const date2 = new Date('2026-01-19T14:00:00'); // 2 PM
        const date3 = new Date('2026-01-19T15:00:00'); // 3 PM
        const key1 = (0, businessDate_1.getBusinessDateKeyHourly)(date1); // "2026011913"
        const key2 = (0, businessDate_1.getBusinessDateKeyHourly)(date2); // "2026011914"
        const key3 = (0, businessDate_1.getBusinessDateKeyHourly)(date3); // "2026011915"
        // Keys should be in ascending order (string comparison works here)
        (0, globals_1.expect)(key1 < key2).toBe(true);
        (0, globals_1.expect)(key2 < key3).toBe(true);
    });
});
(0, globals_1.describe)('Performance characteristics', () => {
    (0, globals_1.it)('should reduce contention - different hours produce different keys', () => {
        const order1 = new Date('2026-01-19T13:00:00'); // 1 PM
        const order2 = new Date('2026-01-19T14:00:00'); // 2 PM
        const key1 = (0, businessDate_1.getBusinessDateKeyHourly)(order1);
        const key2 = (0, businessDate_1.getBusinessDateKeyHourly)(order2);
        // Different hours = different sequence rows = no lock contention
        (0, globals_1.expect)(key1).not.toBe(key2);
        (0, globals_1.expect)(key1).toBe('2026011913');
        (0, globals_1.expect)(key2).toBe('2026011914');
    });
    (0, globals_1.it)('should group orders within same hour - same key', () => {
        const order1 = new Date('2026-01-19T14:15:00'); // 2:15 PM
        const order2 = new Date('2026-01-19T14:45:00'); // 2:45 PM
        const key1 = (0, businessDate_1.getBusinessDateKeyHourly)(order1);
        const key2 = (0, businessDate_1.getBusinessDateKeyHourly)(order2);
        // Same hour = same key = will compete for same lock (expected)
        (0, globals_1.expect)(key1).toBe(key2);
        (0, globals_1.expect)(key1).toBe('2026011914');
    });
});
//# sourceMappingURL=businessDate.test.js.map