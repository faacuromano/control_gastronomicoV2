"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const orderNumber_service_1 = require("../src/services/orderNumber.service");
const prisma = new client_1.PrismaClient({
    log: ['error', 'warn']
});
// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════
const RESTAURANT_PROFILES = {
    small: { count: 50, minOrders: 40, maxOrders: 60 }, // 10-15 orders/hour × 4 hours
    medium: { count: 35, minOrders: 120, maxOrders: 200 }, // 30-50 orders/hour × 4 hours
    large: { count: 15, minOrders: 320, maxOrders: 480 } // 80-120 orders/hour × 4 hours
};
// Batch size for concurrent requests (prevents overwhelming DB)
const CONCURRENT_BATCH_SIZE = 100;
// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function percentile(sortedArray, p) {
    if (sortedArray.length === 0)
        return 0;
    const index = Math.floor(sortedArray.length * p);
    return sortedArray[index] ?? 0;
}
function formatDuration(ms) {
    if (ms < 1000)
        return `${ms}ms`;
    if (ms < 60000)
        return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
}
function printProgress(current, total) {
    const percentage = Math.floor((current / total) * 100);
    const filled = Math.floor(percentage / 2);
    const empty = 50 - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    process.stdout.write(`\r📈 Progress: [${bar}] ${percentage}% (${current.toLocaleString()}/${total.toLocaleString()})`);
    if (current === total) {
        process.stdout.write('\n');
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// RESTAURANT GENERATION
// ═══════════════════════════════════════════════════════════════════════════
function createRestaurants() {
    const restaurants = [];
    let id = 1;
    // Create small restaurants
    for (let i = 0; i < RESTAURANT_PROFILES.small.count; i++) {
        const totalOrders = randomBetween(RESTAURANT_PROFILES.small.minOrders, RESTAURANT_PROFILES.small.maxOrders);
        restaurants.push({
            id: id++,
            name: `SMALL-${String(i + 1).padStart(3, '0')}`,
            size: 'small',
            totalOrders
        });
    }
    // Create medium restaurants
    for (let i = 0; i < RESTAURANT_PROFILES.medium.count; i++) {
        const totalOrders = randomBetween(RESTAURANT_PROFILES.medium.minOrders, RESTAURANT_PROFILES.medium.maxOrders);
        restaurants.push({
            id: id++,
            name: `MEDIUM-${String(i + 1).padStart(3, '0')}`,
            size: 'medium',
            totalOrders
        });
    }
    // Create large restaurants
    for (let i = 0; i < RESTAURANT_PROFILES.large.count; i++) {
        const totalOrders = randomBetween(RESTAURANT_PROFILES.large.minOrders, RESTAURANT_PROFILES.large.maxOrders);
        restaurants.push({
            id: id++,
            name: `LARGE-${String(i + 1).padStart(3, '0')}`,
            size: 'large',
            totalOrders
        });
    }
    return restaurants;
}
// ═══════════════════════════════════════════════════════════════════════════
// ORDER GENERATION
// ═══════════════════════════════════════════════════════════════════════════
async function generateOrder(restaurantId) {
    const requestStart = Date.now();
    try {
        const { orderNumber } = await prisma.$transaction(async (tx) => {
            return await orderNumber_service_1.orderNumberService.getNextOrderNumber(tx);
        }, {
            timeout: 10000,
            maxWait: 5000
        });
        const latency = Date.now() - requestStart;
        return {
            success: true,
            orderNumber,
            latency,
            restaurantId
        };
    }
    catch (error) {
        const latency = Date.now() - requestStart;
        return {
            success: false,
            orderNumber: -1,
            latency,
            restaurantId
        };
    }
}
/**
 * Process orders in batches to avoid overwhelming the database
 */
async function processBatch(orders, startIndex, totalOrders) {
    const results = await Promise.all(orders);
    printProgress(Math.min(startIndex + orders.length, totalOrders), totalOrders);
    return results;
}
// ═══════════════════════════════════════════════════════════════════════════
// MAIN TEST EXECUTION
// ═══════════════════════════════════════════════════════════════════════════
async function runExtremeLoadTest() {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  🔥 EXTREME LOAD TEST - 100 RESTAURANTS - FRIDAY NIGHT 🔥  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    // Create restaurant profiles
    const restaurants = createRestaurants();
    const totalOrders = restaurants.reduce((sum, r) => sum + r.totalOrders, 0);
    console.log('🏪 Restaurant Distribution:');
    console.log(`   Small (40-60 orders): ${RESTAURANT_PROFILES.small.count} restaurants`);
    console.log(`   Medium (120-200 orders): ${RESTAURANT_PROFILES.medium.count} restaurants`);
    console.log(`   Large (320-480 orders): ${RESTAURANT_PROFILES.large.count} restaurants`);
    console.log(`   TOTAL: ${restaurants.length} restaurants\n`);
    console.log(`📊 Total Orders to Generate: ${totalOrders.toLocaleString()}`);
    console.log(`⚙️  Batch Size: ${CONCURRENT_BATCH_SIZE} concurrent requests\n`);
    console.log('🚀 Starting extreme load test...\n');
    console.log('═'.repeat(60));
    const startTime = Date.now();
    // Create all order promises
    const orderPromises = [];
    for (const restaurant of restaurants) {
        for (let i = 0; i < restaurant.totalOrders; i++) {
            orderPromises.push(generateOrder(restaurant.id));
        }
    }
    // Process in batches
    const allResults = [];
    for (let i = 0; i < orderPromises.length; i += CONCURRENT_BATCH_SIZE) {
        const batch = orderPromises.slice(i, i + CONCURRENT_BATCH_SIZE);
        const batchResults = await processBatch(batch, i, totalOrders);
        allResults.push(...batchResults);
    }
    const durationMs = Date.now() - startTime;
    console.log('\n' + '═'.repeat(60));
    console.log('\n✅ Load test completed!\n');
    // ═══════════════════════════════════════════════════════════════════════
    // ANALYZE RESULTS
    // ═══════════════════════════════════════════════════════════════════════
    const successfulResults = allResults.filter(r => r.success);
    const failedResults = allResults.filter(r => !r.success);
    const orderNumbers = successfulResults.map(r => r.orderNumber);
    const latencies = allResults.map(r => r.latency);
    // Check for duplicates
    const uniqueOrderNumbers = new Set(orderNumbers);
    const duplicates = orderNumbers.length - uniqueOrderNumbers.size;
    // Calculate breakdown by restaurant size
    const breakdown = {
        small: { count: 0, orders: 0 },
        medium: { count: 0, orders: 0 },
        large: { count: 0, orders: 0 }
    };
    for (const restaurant of restaurants) {
        const restaurantOrders = successfulResults.filter(r => r.restaurantId === restaurant.id).length;
        breakdown[restaurant.size].count++;
        breakdown[restaurant.size].orders += restaurantOrders;
    }
    // Calculate latency statistics
    latencies.sort((a, b) => a - b);
    const latencyStats = {
        avg: latencies.length > 0 ? latencies.reduce((sum, val) => sum + val, 0) / latencies.length : 0,
        p50: percentile(latencies, 0.5),
        p95: percentile(latencies, 0.95),
        p99: percentile(latencies, 0.99),
        min: latencies[0] ?? 0,
        max: latencies[latencies.length - 1] ?? 0
    };
    return {
        totalRestaurants: restaurants.length,
        totalOrders: allResults.length,
        successfulOrders: successfulResults.length,
        failedOrders: failedResults.length,
        duplicates,
        durationMs,
        latencyStats,
        breakdown
    };
}
function printResults(result) {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    📊 TEST RESULTS                           ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    console.log('📈 Overall Statistics:');
    console.log(`   Total Restaurants: ${result.totalRestaurants}`);
    console.log(`   Total Orders: ${result.totalOrders.toLocaleString()}`);
    console.log(`   Successful: ${result.successfulOrders.toLocaleString()} ✅`);
    console.log(`   Failed: ${result.failedOrders.toLocaleString()} ${result.failedOrders > 0 ? '❌' : '✅'}`);
    console.log(`   Duration: ${formatDuration(result.durationMs)}`);
    console.log(`   Throughput: ${Math.floor((result.totalOrders / result.durationMs) * 1000).toLocaleString()} orders/second\n`);
    console.log('🏪 Restaurant Breakdown:');
    console.log(`   Small: ${result.breakdown.small.count} restaurants → ${result.breakdown.small.orders.toLocaleString()} orders`);
    console.log(`   Medium: ${result.breakdown.medium.count} restaurants → ${result.breakdown.medium.orders.toLocaleString()} orders`);
    console.log(`   Large: ${result.breakdown.large.count} restaurants → ${result.breakdown.large.orders.toLocaleString()} orders\n`);
    console.log('🔒 Data Integrity:');
    console.log(`   Duplicates: ${result.duplicates} ${result.duplicates > 0 ? '❌ CRITICAL FAILURE' : '✅ PASS'}\n`);
    console.log('⏱️  Latency Statistics:');
    console.log(`   Average: ${result.latencyStats.avg.toFixed(2)}ms`);
    console.log(`   p50: ${result.latencyStats.p50}ms`);
    console.log(`   p95: ${result.latencyStats.p95}ms ${result.latencyStats.p95 > 100 ? '❌ Target: <100ms' : '✅ PASS'}`);
    console.log(`   p99: ${result.latencyStats.p99}ms`);
    console.log(`   Min: ${result.latencyStats.min}ms`);
    console.log(`   Max: ${result.latencyStats.max}ms\n`);
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                🎯 SUCCESS CRITERIA                           ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    const noDuplicates = result.duplicates === 0;
    const lowLatency = result.latencyStats.p95 < 100;
    const noFailures = result.failedOrders === 0;
    console.log(`   ${noDuplicates ? '✅' : '❌'} Zero duplicate order numbers`);
    console.log(`   ${lowLatency ? '✅' : '❌'} p95 latency < 100ms`);
    console.log(`   ${noFailures ? '✅' : '❌'} Zero failures\n`);
    const allPassed = noDuplicates && lowLatency && noFailures;
    if (allPassed) {
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║          🎉 ALL TESTS PASSED - SYSTEM IS READY! 🎉          ║');
        console.log('╚══════════════════════════════════════════════════════════════╝\n');
    }
    else {
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║         ❌ TESTS FAILED - REVIEW REQUIRED ❌                 ║');
        console.log('╚══════════════════════════════════════════════════════════════╝\n');
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
async function main() {
    try {
        const result = await runExtremeLoadTest();
        printResults(result);
        const success = result.duplicates === 0 && result.latencyStats.p95 < 100 && result.failedOrders === 0;
        process.exit(success ? 0 : 1);
    }
    catch (error) {
        console.error('\n💥 Fatal error:', error);
        process.exit(1);
    }
    finally {
        await prisma.$disconnect();
    }
}
process.on('SIGINT', async () => {
    console.log('\n\n⚠️  Test interrupted');
    await prisma.$disconnect();
    process.exit(130);
});
main();
//# sourceMappingURL=extreme-load-test-fast.js.map