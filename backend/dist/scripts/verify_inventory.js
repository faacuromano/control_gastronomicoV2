"use strict";
const axios = require('axios');
const BASE_URL = 'http://localhost:3001/api';
let ingredientId = null;
async function runVerification() {
    console.log('🧪 Starting Inventory Verification...');
    try {
        // 1. Create Ingredient
        console.log('\n📝 Creating Ingredient...');
        const resCreate = await axios.post(`${BASE_URL}/ingredients`, {
            name: 'Harina 0000',
            unit: 'kg',
            cost: 800,
            stock: 0,
            minStock: 10
        });
        console.log('✅ Created:', resCreate.data.data.name, 'ID:', resCreate.data.data.id);
        ingredientId = resCreate.data.data.id;
        if (!ingredientId)
            throw new Error("Ingredient ID is null/undefined");
        // 2. Register Purchase
        console.log('\n🛒 Registering Purchase (50kg)...');
        const resPurchase = await axios.post(`${BASE_URL}/stock-movements`, {
            ingredientId,
            type: 'PURCHASE',
            quantity: 50
        });
        console.log('✅ New Stock:', resPurchase.data.data.newStock);
        // 3. Register Usage (Sale/Waste)
        console.log('\n📉 Registering Waste (5kg)...');
        const resWaste = await axios.post(`${BASE_URL}/stock-movements`, {
            ingredientId,
            type: 'WASTE',
            quantity: 5
        });
        console.log('✅ New Stock (should be 45):', resWaste.data.data.newStock);
        // 4. Get History
        console.log('\n📜 Fetching History...');
        const resHistory = await axios.get(`${BASE_URL}/stock-movements?ingredientId=${ingredientId}`);
        console.log(`✅ Found ${resHistory.data.data.length} movements.`);
        // 5. Cleanup
        console.log('\n🗑️ Cleaning up...');
        await axios.delete(`${BASE_URL}/ingredients/${ingredientId}`);
        console.log('✅ Ingredient deleted.');
        console.log('\n🎉 Verification Passed!');
    }
    catch (error) {
        console.error('❌ Verification Failed:', error.response ? error.response.data : error.message);
        process.exit(1);
    }
}
runVerification();
//# sourceMappingURL=verify_inventory.js.map