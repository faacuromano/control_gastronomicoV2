/**
 * Extreme Load Test - 100 Restaurants on Friday Night Peak Hours (OPTIMIZED)
 *
 * SCENARIO:
 * - 100 restaurants operating simultaneously
 * - Small (50): 10-15 orders/hour → 40-60 orders total (4 hours)
 * - Medium (35): 30-50 orders/hour → 120-200 orders total (4 hours)
 * - Large (15): 80-120 orders/hour → 320-480 orders total (4 hours)
 *
 * TOTAL EXPECTED ORDERS: ~14,100 orders
 *
 * This version generates all orders concurrently without artificial delays
 * to test system capacity under extreme load.
 *
 * SUCCESS CRITERIA:
 * ✓ Zero duplicate order numbers
 * ✓ p95 latency < 100ms
 * ✓ Zero failures
 *
 * Usage:
 *   npx ts-node scripts/extreme-load-test-fast.ts
 */
export {};
//# sourceMappingURL=extreme-load-test-fast.d.ts.map