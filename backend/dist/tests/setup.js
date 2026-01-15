"use strict";
/**
 * Jest Setup File
 * Runs before each test suite
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
// Load test environment variables
dotenv_1.default.config({ path: '.env.test' });
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
//# sourceMappingURL=setup.js.map