# Decimal Utilities Guide

## Why Use These Utilities?

JavaScript has floating-point precision issues that can cause errors in financial calculations:

```javascript
// ❌ DON'T DO THIS
0.1 + 0.2 // 0.30000000000000004
19.99 * 2 // 39.980000000000004
```

Our decimal utilities fix these issues by:
- Properly parsing decimal strings from API
- Rounding to correct precision
- Preventing floating-point errors

---

## Common Use Cases

### 1. Parsing API Response Values

Backend returns decimals as **strings** (Prisma Decimal type):

```typescript
import { parseDecimal } from '@/lib/decimalUtils';

// API returns: { price: "19.99", quantity: "2.5000" }
const product = {
    price: "19.99",
    quantity: "2.5000"
};

// ❌ Wrong
const total = parseFloat(product.price) * parseFloat(product.quantity);

// ✅ Correct
const total = multiplyDecimals(product.price, product.quantity);
// Result: 49.975 -> rounded to 49.98
```

### 2. Displaying Currency

```typescript
import { formatCurrency, formatDecimal } from '@/lib/decimalUtils';

// Display price with currency symbol
formatCurrency("19.99", "$") // "$19.99"
formatCurrency(19.5, "€") // "€19.50"

// Display without currency
formatDecimal("19.99") // "19.99"
formatDecimal(19.5, 2) // "19.50"
```

### 3. Calculating Order Totals

```typescript
import { sumDecimals, multiplyDecimals, addDecimals } from '@/lib/decimalUtils';

const orderItems = [
    { unitPrice: "19.99", quantity: 2 },
    { unitPrice: "5.50", quantity: 1 },
    { unitPrice: "10.00", quantity: 3 }
];

// Calculate line totals
const lineTotals = orderItems.map(item =>
    multiplyDecimals(item.unitPrice, item.quantity)
);

// Sum all items
const subtotal = sumDecimals(lineTotals);
// Result: 75.48
```

### 4. Applying Discounts

```typescript
import { applyDiscount, calculatePercentage } from '@/lib/decimalUtils';

const originalPrice = "100.00";

// Apply 10% discount
const discountedPrice = applyDiscount(originalPrice, 10);
// Result: 90.00

// Or calculate discount amount separately
const discountAmount = calculatePercentage(originalPrice, 10);
// Result: 10.00
```

### 5. Calculating Tax

```typescript
import { calculateTax, addDecimals } from '@/lib/decimalUtils';

const subtotal = "100.00";
const taxRate = 21; // 21% VAT

const taxAmount = calculateTax(subtotal, taxRate);
// Result: 21.00

const total = addDecimals(subtotal, taxAmount);
// Result: 121.00
```

### 6. Safe Arithmetic Operations

```typescript
import {
    addDecimals,
    subtractDecimals,
    multiplyDecimals,
    divideDecimals
} from '@/lib/decimalUtils';

// Addition
addDecimals("19.99", "5.01") // 25.00

// Subtraction
subtractDecimals("100.00", "19.99") // 80.01

// Multiplication
multiplyDecimals("19.99", "3") // 59.97

// Division (with zero protection)
divideDecimals("100", "3") // 33.3333
divideDecimals("100", "0") // 0 (safe, logs warning)
```

---

## Integration Examples

### Example 1: Order Item Component

```typescript
import { formatCurrency, multiplyDecimals } from '@/lib/decimalUtils';

interface OrderItemProps {
    product: { name: string; price: string }; // price from API
    quantity: number;
}

const OrderItem = ({ product, quantity }: OrderItemProps) => {
    const lineTotal = multiplyDecimals(product.price, quantity);

    return (
        <div>
            <span>{product.name}</span>
            <span>{quantity} x {formatCurrency(product.price)}</span>
            <span className="font-bold">{formatCurrency(lineTotal)}</span>
        </div>
    );
};
```

### Example 2: Checkout Summary

```typescript
import { sumDecimals, calculateTax, addDecimals, formatCurrency } from '@/lib/decimalUtils';

const CheckoutSummary = ({ items, taxRate = 0 }) => {
    // Calculate subtotal from all items
    const subtotal = sumDecimals(
        items.map(item => multiplyDecimals(item.unitPrice, item.quantity))
    );

    // Calculate tax if applicable
    const tax = taxRate > 0 ? calculateTax(subtotal, taxRate) : 0;

    // Calculate total
    const total = addDecimals(subtotal, tax);

    return (
        <div>
            <div>Subtotal: {formatCurrency(subtotal)}</div>
            {taxRate > 0 && <div>Tax ({taxRate}%): {formatCurrency(tax)}</div>}
            <div className="font-bold">Total: {formatCurrency(total)}</div>
        </div>
    );
};
```

### Example 3: Payment Processing

```typescript
import { toCents, fromCents, parseDecimal } from '@/lib/decimalUtils';

// Convert to cents for Stripe/payment gateway
const amount = "19.99";
const amountInCents = toCents(amount); // 1999

// API call to payment gateway
await stripe.charge({
    amount: amountInCents,
    currency: 'usd'
});

// Convert response back to decimal
const refundAmount = fromCents(1999); // 19.99
```

---

## Best Practices

### ✅ DO

```typescript
// Parse all decimal strings from API
const price = parseDecimal(product.price);

// Use utility functions for calculations
const total = multiplyDecimals(price, quantity);

// Format for display
<span>{formatCurrency(total, "$")}</span>
```

### ❌ DON'T

```typescript
// Don't use raw parseFloat
const price = parseFloat(product.price); // ❌

// Don't use direct arithmetic on floats
const total = price * quantity; // ❌ Precision issues

// Don't concatenate strings for display
<span>${total}</span> // ❌ Won't format decimals
```

---

## Migration Checklist

When updating existing code to use decimal utilities:

- [ ] Find all `parseFloat()` calls on API data → Replace with `parseDecimal()`
- [ ] Find all arithmetic operations (+, -, *, /) on money → Replace with utility functions
- [ ] Find all `.toFixed(2)` calls → Replace with `formatDecimal()` or `formatCurrency()`
- [ ] Check order total calculations → Use `sumDecimals()` + `multiplyDecimals()`
- [ ] Check tax calculations → Use `calculateTax()`
- [ ] Check discount logic → Use `applyDiscount()` or `calculatePercentage()`
- [ ] Test with edge cases: `0.1 + 0.2`, `19.99 * 3`, large numbers

---

## Testing

Test your calculations with these tricky cases:

```typescript
// Floating point edge cases
addDecimals(0.1, 0.2) // Should be exactly 0.3
multiplyDecimals(19.99, 3) // Should be exactly 59.97

// Null/undefined handling
parseDecimal(null, 0) // Should return 0
parseDecimal(undefined, 10) // Should return 10

// Division by zero
divideDecimals(100, 0) // Should return 0 and warn
```

---

## Performance Notes

These utilities are **lightweight** - no external dependencies, just safe JavaScript math.

For **high-volume** calculations (e.g., thousands of items), consider batching:

```typescript
// Good for normal use (< 1000 items)
const total = sumDecimals(items.map(i => i.price));

// Better for large datasets
const total = items.reduce((sum, item) => addDecimals(sum, item.price), 0);
```

---

## API Contract

Remember: **Backend sends decimals as strings**

```typescript
// API Response
{
  "order": {
    "subtotal": "99.99",    // ← String, not number
    "discount": "10.00",    // ← String
    "total": "89.99"        // ← String
  }
}

// Always parse before use
const total = parseDecimal(order.total);
```

---

## Questions?

- See inline JSDoc comments in `src/lib/decimalUtils.ts`
- Check API documentation section "Decimal Precision" (line 1288)
- Test in browser console: `import { addDecimals } from './lib/decimalUtils'`
