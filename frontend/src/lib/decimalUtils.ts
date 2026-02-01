/**
 * Decimal Utilities for Financial Calculations
 *
 * Handles precision-safe decimal operations for money/quantity values.
 * Backend returns decimals as strings (Prisma Decimal type) to preserve precision.
 *
 * @module lib/decimalUtils
 */

/**
 * Parse a decimal string or number to a float with proper precision
 *
 * @param value - Decimal value (string from API or number)
 * @param defaultValue - Fallback if value is null/undefined
 * @returns Parsed float
 *
 * @example
 * parseDecimal("19.99") // 19.99
 * parseDecimal("19.990") // 19.99
 * parseDecimal(null, 0) // 0
 */
export const parseDecimal = (
    value: string | number | null | undefined,
    defaultValue = 0
): number => {
    if (value === null || value === undefined || value === '') {
        return defaultValue;
    }

    const parsed = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(parsed)) {
        console.warn(`[decimalUtils] Invalid decimal value: ${value}, using default: ${defaultValue}`);
        return defaultValue;
    }

    return parsed;
};

/**
 * Format a decimal for display with currency
 *
 * @param value - Decimal value
 * @param currencySymbol - Currency symbol (default: "$")
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string
 *
 * @example
 * formatCurrency("19.99", "$") // "$19.99"
 * formatCurrency(19.5, "€", 2) // "€19.50"
 */
export const formatCurrency = (
    value: string | number | null | undefined,
    currencySymbol = '$',
    decimals = 2
): string => {
    const num = parseDecimal(value, 0);
    return `${currencySymbol}${num.toFixed(decimals)}`;
};

/**
 * Format a decimal for display without currency
 *
 * @param value - Decimal value
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string
 *
 * @example
 * formatDecimal("19.99") // "19.99"
 * formatDecimal(19.5, 2) // "19.50"
 */
export const formatDecimal = (
    value: string | number | null | undefined,
    decimals = 2
): string => {
    const num = parseDecimal(value, 0);
    return num.toFixed(decimals);
};

/**
 * Add two decimal values with precision
 *
 * @param a - First value
 * @param b - Second value
 * @returns Sum
 *
 * @example
 * addDecimals("19.99", "5.01") // 25.00
 * addDecimals(0.1, 0.2) // 0.3 (not 0.30000000000000004)
 */
export const addDecimals = (
    a: string | number | null | undefined,
    b: string | number | null | undefined
): number => {
    const numA = parseDecimal(a, 0);
    const numB = parseDecimal(b, 0);

    // Use toFixed to avoid floating point errors
    return parseFloat((numA + numB).toFixed(4));
};

/**
 * Subtract two decimal values with precision
 *
 * @param a - First value
 * @param b - Second value to subtract
 * @returns Difference
 */
export const subtractDecimals = (
    a: string | number | null | undefined,
    b: string | number | null | undefined
): number => {
    const numA = parseDecimal(a, 0);
    const numB = parseDecimal(b, 0);

    return parseFloat((numA - numB).toFixed(4));
};

/**
 * Multiply two decimal values with precision
 *
 * @param a - First value
 * @param b - Second value
 * @returns Product
 *
 * @example
 * multiplyDecimals("19.99", "2") // 39.98
 * multiplyDecimals(price, quantity)
 */
export const multiplyDecimals = (
    a: string | number | null | undefined,
    b: string | number | null | undefined
): number => {
    const numA = parseDecimal(a, 0);
    const numB = parseDecimal(b, 0);

    return parseFloat((numA * numB).toFixed(4));
};

/**
 * Divide two decimal values with precision
 *
 * @param a - Dividend
 * @param b - Divisor
 * @returns Quotient
 *
 * @example
 * divideDecimals("100", "3") // 33.3333
 */
export const divideDecimals = (
    a: string | number | null | undefined,
    b: string | number | null | undefined
): number => {
    const numA = parseDecimal(a, 0);
    const numB = parseDecimal(b, 0);

    if (numB === 0) {
        console.warn('[decimalUtils] Division by zero, returning 0');
        return 0;
    }

    return parseFloat((numA / numB).toFixed(4));
};

/**
 * Calculate sum of array of decimal values
 *
 * @param values - Array of decimal values
 * @returns Sum
 *
 * @example
 * sumDecimals(["19.99", "5.01", "10.00"]) // 35.00
 * sumDecimals(orderItems.map(item => item.subtotal))
 */
export const sumDecimals = (
    values: (string | number | null | undefined)[]
): number => {
    return values.reduce((sum, value) => addDecimals(sum, value), 0);
};

/**
 * Round a decimal to specified precision
 *
 * @param value - Decimal value
 * @param decimals - Number of decimal places (default: 2 for money)
 * @returns Rounded number
 *
 * @example
 * roundDecimal(19.996, 2) // 20.00
 * roundDecimal(19.994, 2) // 19.99
 */
export const roundDecimal = (
    value: string | number | null | undefined,
    decimals = 2
): number => {
    const num = parseDecimal(value, 0);
    const multiplier = Math.pow(10, decimals);
    return Math.round(num * multiplier) / multiplier;
};

/**
 * Calculate percentage of a value
 *
 * @param value - Base value
 * @param percentage - Percentage (e.g., 10 for 10%)
 * @returns Percentage amount
 *
 * @example
 * calculatePercentage(100, 10) // 10.00
 * calculatePercentage("50.00", 20) // 10.00
 */
export const calculatePercentage = (
    value: string | number | null | undefined,
    percentage: number
): number => {
    const num = parseDecimal(value, 0);
    return roundDecimal((num * percentage) / 100, 2);
};

/**
 * Apply discount to a value
 *
 * @param value - Original value
 * @param discountPercent - Discount percentage (e.g., 10 for 10% off)
 * @returns Value after discount
 *
 * @example
 * applyDiscount(100, 10) // 90.00
 * applyDiscount("50.00", 20) // 40.00
 */
export const applyDiscount = (
    value: string | number | null | undefined,
    discountPercent: number
): number => {
    const num = parseDecimal(value, 0);
    const discount = calculatePercentage(num, discountPercent);
    return subtractDecimals(num, discount);
};

/**
 * Calculate tax amount
 *
 * @param value - Base value (pre-tax)
 * @param taxPercent - Tax percentage (e.g., 21 for 21% VAT)
 * @returns Tax amount
 *
 * @example
 * calculateTax(100, 21) // 21.00
 */
export const calculateTax = (
    value: string | number | null | undefined,
    taxPercent: number
): number => {
    return calculatePercentage(value, taxPercent);
};

/**
 * Convert decimal to cents (for payment processing)
 *
 * @param value - Decimal value
 * @returns Integer cents
 *
 * @example
 * toCents("19.99") // 1999
 * toCents(5.5) // 550
 */
export const toCents = (value: string | number | null | undefined): number => {
    const num = parseDecimal(value, 0);
    return Math.round(num * 100);
};

/**
 * Convert cents to decimal
 *
 * @param cents - Integer cents
 * @returns Decimal value
 *
 * @example
 * fromCents(1999) // 19.99
 * fromCents(550) // 5.50
 */
export const fromCents = (cents: number): number => {
    return roundDecimal(cents / 100, 2);
};
