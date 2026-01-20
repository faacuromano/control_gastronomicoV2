/**
 * @fileoverview Verification script for hourly sharding implementation
 *
 * USAGE: npx ts-node scripts/verify-hourly-sharding.ts
 *
 * VALIDATES:
 * 1. getBusinessDateKeyHourly() generates correct format
 * 2. Different hours produce different keys (contention reduction)
 * 3. Same hour produces same key (expected grouping)
 * 4. 6 AM cutoff rule still applies
 */
export {};
//# sourceMappingURL=verify-hourly-sharding.d.ts.map