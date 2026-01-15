/**
 * Jest Setup File
 * Runs before each test suite
 */

import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment defaults
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_key_for_testing_only';

// Global test timeout
jest.setTimeout(10000);

// Suppress console logs during tests (optional, comment out for debugging)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };

// Cleanup after all tests
afterAll(async () => {
  // Add any global cleanup here if needed
  // e.g., close database connections
});
