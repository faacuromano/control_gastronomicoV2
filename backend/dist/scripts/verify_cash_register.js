"use strict";
const axios = require('axios');
const BASE_URL = 'http://localhost:3001/api';
async function run() {
    try {
        console.log("=== SPRINT B6 VERIFICATION ===");
        // 1. Login
        console.log("\n1. Logging in...");
        const login = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'admin@pentium.com',
            password: '123456'
        });
        const token = login.data.data.token;
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        console.log("   Logged in.");
        // 2. Ensure No Shift is Open (Force Close if any)
        try {
            await axios.post(`${BASE_URL}/cash-shifts/close`, { endAmount: 0 });
            console.log("   Closed any existing shift.");
        }
        catch (e) {
            // Include message if failed (likely no open shift, which is fine)
            // console.log("   (No open shift to close)");
        }
        // 3. Try to Create Order (Should Fail)
        console.log("\n2. Attempting Order WITHOUT Shift...");
        try {
            await axios.post(`${BASE_URL}/orders`, {
                items: [{ productId: 4, quantity: 1 }] // Assuming Classic Burger ID 4
            });
            console.error("   ❌ FAILED: Order created unexpectedly!");
        }
        catch (e) {
            if (e.response && e.response.status === 500 && e.response.data.error === 'NO_OPEN_SHIFT') {
                console.log("   ✅ PASSED: Order blocked correctly (NO_OPEN_SHIFT).");
            }
            else if (e.response?.data?.message?.includes('NO_OPEN_SHIFT')) {
                console.log("   ✅ PASSED: Order blocked correctly (Message match).");
            }
            else {
                console.log("   ⚠️ Unexpected Error:", e.response?.data || e.message);
            }
        }
        // 4. Open Shift
        console.log("\n3. Opening Shift...");
        const openRes = await axios.post(`${BASE_URL}/cash-shifts/open`, { startAmount: 5000 });
        console.log("   ✅ Shift Opened. ID:", openRes.data.data.id);
        // 5. Try to Create Order (Should Succeed)
        console.log("\n4. Attempting Order WITH Shift...");
        const orderRes = await axios.post(`${BASE_URL}/orders`, {
            items: [{ productId: 4, quantity: 1, notes: "Test Order B6" }]
        });
        console.log("   ✅ Order Created. ID:", orderRes.data.data.orderNumber);
        // 6. Close Shift
        console.log("\n5. Closing Shift...");
        const closeRes = await axios.post(`${BASE_URL}/cash-shifts/close`, { endAmount: 6500 }); // +1500 from burger?
        console.log("   ✅ Shift Closed. End Amount:", closeRes.data.data.endAmount);
        // 7. Verify again (Should Fail)
        console.log("\n6. Attempting Order AFTER Shift Close...");
        try {
            await axios.post(`${BASE_URL}/orders`, {
                items: [{ productId: 4, quantity: 1 }]
            });
            console.error("   ❌ FAILED: Order created unexpectedly!");
        }
        catch (e) {
            console.log("   ✅ PASSED: Order blocked correctly.");
        }
    }
    catch (e) {
        console.error("Script Error Detailed:", e);
        if (e.response) {
            console.error("Response Status:", e.response.status);
            console.error("Response Data:", JSON.stringify(e.response.data, null, 2));
        }
    }
}
run();
//# sourceMappingURL=verify_cash_register.js.map