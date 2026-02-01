/**
 * Data migration: Backfill pinLookup for existing users.
 *
 * Since pinLookup is a SHA-256 hash of the raw PIN, and we only store
 * bcrypt hashes (pinHash), we CANNOT retroactively compute pinLookup
 * for existing users.
 *
 * Existing users will need to re-enter their PIN on next login.
 * The loginWithPin function will fall back to the legacy O(n) scan
 * when pinLookup is NULL, and can optionally backfill pinLookup
 * upon successful login.
 *
 * Run: npx tsx prisma/migrations/20260201170000_p0_security_fiscal_performance/backfill-pinLookup.ts
 */

console.log(`
=================================================================
PIN LOOKUP MIGRATION NOTE
=================================================================

pinLookup column has been added to the User table.

Since we only store bcrypt hashes of PINs (not the raw PINs),
we cannot retroactively compute pinLookup for existing users.

The system will automatically populate pinLookup for each user
upon their next successful PIN login (graceful backfill).

New users registered after this migration will have pinLookup
set automatically during registration.

No manual action required.
=================================================================
`);
