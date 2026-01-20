"use strict";
/**
 * Extreme Load Test - 100 Restaurants on Friday Night Peak Hours
 *
 * SCENARIO:
 * - 100 restaurants operating simultaneously
 * - Small (50): 10-15 orders/hour (avg 12.5)
 * - Medium (35): 30-50 orders/hour (avg 40)
 * - Large (15): 80-120 orders/hour (avg 100)
 *
 * PEAK HOURS: Friday 19:00-23:00 (4 hours)
 * TOTAL EXPECTED ORDERS: ~10,625 orders in 4 hours
 * - Small: 50 restaurants × 12.5 orders/hour × 4 hours = 2,500 orders
 * - Medium: 35 restaurants × 40 orders/hour × 4 hours = 5,600 orders
 * - Large: 15 restaurants × 100 orders/hour × 4 hours = 6,000 orders
 *
 * TOTAL: 14,100 orders in 4 hours (~59 orders/minute peak)
 *
 * SUCCESS CRITERIA:
 * ✓ Zero duplicate order numbers
 * ✓ p95 latency < 100ms
 * ✓ Zero failures
 * ✓ All restaurants maintain sequential numbering
 *
 * Usage:
 *   npx ts-node scripts/extreme-load-test.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const orderNumber_service_1 = require("../src/services/orderNumber.service");
const prisma = new client_1.PrismaClient({
    log: ['error', 'warn']
});
// ═══════════════════════════════════════════════════════════════════════════
// RESTAURANT PROFILES
// ═══════════════════════════════════════════════════════════════════════════
const RESTAURANT_PROFILES = {
    small: { count: 50, minOrdersPerHour: 10, maxOrdersPerHour: 15 },
    medium: { count: 35, minOrdersPerHour: 30, maxOrdersPerHour: 50 },
    large: { count: 15, minOrdersPerHour: 80, maxOrdersPerHour: 120 }
};
const SIMULATION_HOURS = 4; // Friday night peak: 19:00-23:00
const SIMULATION_MINUTES = SIMULATION_HOURS * 60; // 240 minutes
const MILLISECONDS_PER_MINUTE = 60 * 1000;
// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Random number between min and max (inclusive)
 */
function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
/**
 * Create a restaurant profile
 */
function createRestaurant(id, size) {
    const profile = RESTAURANT_PROFILES[size];
    const ordersPerHour = randomBetween(profile.minOrdersPerHour, profile.maxOrdersPerHour);
    return {
        id,
        name: `${size.toUpperCase()}-${String(id).padStart(3, '0')}`,
        size,
        ordersPerHour,
        ordersGenerated: [],
        successfulOrders: 0,
        failedOrders: 0,
        latencies: []
    };
}
/**
 * Generate all restaurant profiles
 */
function createRestaurants() {
    const restaurants = [];
    let id = 1;
    // Create small restaurants
    for (let i = 0; i < RESTAURANT_PROFILES.small.count; i++) {
        restaurants.push(createRestaurant(id++, 'small'));
    }
    // Create medium restaurants
    for (let i = 0; i < RESTAURANT_PROFILES.medium.count; i++) {
        restaurants.push(createRestaurant(id++, 'medium'));
    }
    // Create large restaurants
    for (let i = 0; i < RESTAURANT_PROFILES.large.count; i++) {
        restaurants.push(createRestaurant(id++, 'large'));
    }
    return restaurants;
}
/**
 * Calculate percentile from sorted array
 */
function percentile(sortedArray, p) {
    if (sortedArray.length === 0)
        return 0;
    const index = Math.floor(sortedArray.length * p);
    return sortedArray[index] ?? 0;
}
/**
 * Format duration
 */
function formatDuration(ms) {
    if (ms < 1000)
        return `${ms}ms`;
    if (ms < 60000)
        return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000)
        return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
}
/**
 * Progress bar
 */
function printProgress(current, total, label = 'Progress') {
    const percentage = Math.floor((current / total) * 100);
    const filled = Math.floor(percentage / 2);
    const empty = 50 - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    process.stdout.write(`\r📈 ${label}: [${bar}] ${percentage}% (${current.toLocaleString()}/${total.toLocaleString()})`);
    if (current === total) {
        process.stdout.write('\n');
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// CORE SIMULATION LOGIC
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Generate a single order for a restaurant
 */
async function generateOrder(restaurant) {
    const requestStart = Date.now();
    try {
        // Simulate actual order creation flow with transaction
        const { orderNumber } = await prisma.$transaction(async (tx) => {
            return await orderNumber_service_1.orderNumberService.getNextOrderNumber(tx);
        }, {
            timeout: 10000,
            maxWait: 5000
        });
        const latency = Date.now() - requestStart;
        restaurant.ordersGenerated.push(orderNumber);
        restaurant.successfulOrders++;
        restaurant.latencies.push(latency);
    }
    catch (error) {
        const latency = Date.now() - requestStart;
        restaurant.failedOrders++;
        restaurant.latencies.push(latency);
        console.error(`\n❌ [${restaurant.name}] Order failed:`, error instanceof Error ? error.message : String(error));
    }
}
/**
 * Simulate orders for a restaurant during the entire simulation period
 */
async function simulateRestaurant(restaurant, totalOrders) {
    const ordersToGenerate = Math.floor(restaurant.ordersPerHour * SIMULATION_HOURS);
    // Calculate interval between orders (in milliseconds)
    const intervalMs = (SIMULATION_HOURS * 3600 * 1000) / ordersToGenerate;
    const promises = [];
    for (let i = 0; i < ordersToGenerate; i++) {
        // Add random jitter (±20%) to simulate realistic timing
        const jitter = intervalMs * 0.2 * (Math.random() - 0.5);
        const delay = (intervalMs * i) + jitter;
        const promise = new Promise((resolve) => {
            setTimeout(async () => {
                await generateOrder(restaurant);
                printProgress(Math.floor((i + 1) / ordersToGenerate * 100), 100, `${restaurant.name} Orders`);
                resolve();
            }, delay);
        });
        promises.push(promise);
    }
    await Promise.all(promises);
}
/**
 * Run the extreme load test
 */
async function runExtremeLoadTest() {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  🔥 EXTREME LOAD TEST - 100 RESTAURANTS - FRIDAY NIGHT 🔥  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    // Create restaurant profiles
    const restaurants = createRestaurants();
    console.log('🏪 Restaurant Distribution:');
    console.log(`   Small (10-15 orders/hour): ${RESTAURANT_PROFILES.small.count} restaurants`);
    console.log(`   Medium (30-50 orders/hour): ${RESTAURANT_PROFILES.medium.count} restaurants`);
    console.log(`   Large (80-120 orders/hour): ${RESTAURANT_PROFILES.large.count} restaurants`);
    console.log(`   TOTAL: ${restaurants.length} restaurants\n`);
    const totalExpectedOrders = restaurants.reduce((sum, r) => sum + (r.ordersPerHour * SIMULATION_HOURS), 0);
    console.log(`📊 Expected Orders: ${totalExpectedOrders.toLocaleString()} orders in ${SIMULATION_HOURS} hours`);
    console.log(`⏱️  Peak Rate: ~${Math.floor(totalExpectedOrders / (SIMULATION_HOURS * 60))} orders/minute\n`);
    console.log('🚀 Starting simulation...\n');
    console.log('═'.repeat(60));
    const startTime = Date.now();
    // Run all restaurants in parallel (simulates real Friday night)
    await Promise.all(restaurants.map(restaurant => simulateRestaurant(restaurant, totalExpectedOrders)));
    const durationMs = Date.now() - startTime;
    console.log('═'.repeat(60));
    console.log('\n✅ Simulation completed!\n');
    // ═══════════════════════════════════════════════════════════════════════
    // ANALYZE RESULTS
    // ═══════════════════════════════════════════════════════════════════════
    const allOrderNumbers = [];
    const allLatencies = [];
    let totalSuccessful = 0;
    let totalFailed = 0;
    const breakdown = {
        small: { count: 0, orders: 0 },
        medium: { count: 0, orders: 0 },
        large: { count: 0, orders: 0 }
    };
    for (const restaurant of restaurants) {
        allOrderNumbers.push(...restaurant.ordersGenerated);
        allLatencies.push(...restaurant.latencies);
        totalSuccessful += restaurant.successfulOrders;
        totalFailed += restaurant.failedOrders;
        breakdown[restaurant.size].count++;
        breakdown[restaurant.size].orders += restaurant.successfulOrders;
    }
    // Check for duplicates
    const uniqueOrderNumbers = new Set(allOrderNumbers);
    const duplicates = allOrderNumbers.length - uniqueOrderNumbers.size;
    // Calculate latency statistics
    allLatencies.sort((a, b) => a - b);
    const latencyStats = {
        avg: allLatencies.length > 0 ? allLatencies.reduce((sum, val) => sum + val, 0) / allLatencies.length : 0,
        p50: percentile(allLatencies, 0.5),
        p95: percentile(allLatencies, 0.95),
        p99: percentile(allLatencies, 0.99),
        min: allLatencies[0] ?? 0,
        max: allLatencies[allLatencies.length - 1] ?? 0
    };
    // Order number range
    const sortedOrderNumbers = [...allOrderNumbers].sort((a, b) => a - b);
    const orderNumberRange = {
        min: sortedOrderNumbers[0] ?? 0,
        max: sortedOrderNumbers[sortedOrderNumbers.length - 1] ?? 0
    };
    return {
        totalRestaurants: restaurants.length,
        totalOrders: allOrderNumbers.length,
        successfulOrders: totalSuccessful,
        failedOrders: totalFailed,
        duplicates,
        durationMs,
        orderNumberRange,
        latencyStats,
        restaurantBreakdown: breakdown
    };
}
/**
 * Print detailed results
 */
function printResults(result) {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    📊 TEST RESULTS                           ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    // Overall Statistics
    console.log('📈 Overall Statistics:');
    console.log(`   Total Restaurants: ${result.totalRestaurants}`);
    console.log(`   Total Orders Generated: ${result.totalOrders.toLocaleString()}`);
    console.log(`   Successful Orders: ${result.successfulOrders.toLocaleString()} ✅`);
    console.log(`   Failed Orders: ${result.failedOrders.toLocaleString()} ${result.failedOrders > 0 ? '❌' : '✅'}`);
    console.log(`   Duration: ${formatDuration(result.durationMs)}`);
    console.log(`   Throughput: ${Math.floor((result.totalOrders / result.durationMs) * 1000).toLocaleString()} orders/second\n`);
    // Restaurant Breakdown
    console.log('🏪 Restaurant Breakdown:');
    console.log(`   Small: ${result.restaurantBreakdown.small.count} restaurants → ${result.restaurantBreakdown.small.orders.toLocaleString()} orders`);
    console.log(`   Medium: ${result.restaurantBreakdown.medium.count} restaurants → ${result.restaurantBreakdown.medium.orders.toLocaleString()} orders`);
    console.log(`   Large: ${result.restaurantBreakdown.large.count} restaurants → ${result.restaurantBreakdown.large.orders.toLocaleString()} orders\n`);
    // Data Integrity
    console.log('🔒 Data Integrity:');
    console.log(`   Duplicate Order Numbers: ${result.duplicates} ${result.duplicates > 0 ? '❌ CRITICAL FAILURE' : '✅ PASS'}`);
    console.log(`   Order Number Range: ${result.orderNumberRange.min} - ${result.orderNumberRange.max}`);
    console.log(`   Unique Order Numbers: ${result.totalOrders - result.duplicates}\n`);
    // Latency Statistics
    console.log('⏱️  Latency Statistics:');
    console.log(`   Average: ${result.latencyStats.avg.toFixed(2)}ms`);
    console.log(`   p50 (Median): ${result.latencyStats.p50}ms`);
    console.log(`   p95: ${result.latencyStats.p95}ms ${result.latencyStats.p95 > 100 ? '❌ Target: <100ms' : '✅ PASS'}`);
    console.log(`   p99: ${result.latencyStats.p99}ms`);
    console.log(`   Min: ${result.latencyStats.min}ms`);
    console.log(`   Max: ${result.latencyStats.max}ms\n`);
    // Success Criteria
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
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════════════════
async function main() {
    try {
        const result = await runExtremeLoadTest();
        printResults(result);
        // Exit with appropriate code
        const success = result.duplicates === 0 && result.latencyStats.p95 < 100 && result.failedOrders === 0;
        process.exit(success ? 0 : 1);
    }
    catch (error) {
        console.error('\n💥 Fatal error during load test:', error);
        process.exit(1);
    }
    finally {
        await prisma.$disconnect();
    }
}
// Handle process signals
process.on('SIGINT', async () => {
    console.log('\n\n⚠️  Test interrupted by user');
    await prisma.$disconnect();
    process.exit(130);
});
process.on('SIGTERM', async () => {
    console.log('\n\n⚠️  Test terminated');
    await prisma.$disconnect();
    process.exit(143);
});
main();
//# sourceMappingURL=extreme-load-test.js.map