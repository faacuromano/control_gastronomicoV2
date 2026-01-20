/**
 * ONE-TIME MIGRATION: Synchronize OrderSequence with existing Order data
 *
 * This script fixes the desynchronization issue where OrderSequence.currentValue
 * is lower than the actual MAX(orderNumber) for a given businessDate.
 *
 * This happens when:
 * 1. The OrderSequence table was dropped/recreated
 * 2. Data was imported from another source
 * 3. Manual database modifications were made
 *
 * Usage:
 *   npx ts-node backend/scripts/sync-order-sequences.ts
 */
export {};
//# sourceMappingURL=sync-order-sequences.d.ts.map