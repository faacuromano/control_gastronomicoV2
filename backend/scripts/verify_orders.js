
const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';
let productId = null;
let ingredientId = null;
let token = null;

async function runVerification() {
    console.log('🧪 Starting Order Verification...');

    try {
        // 0. Authenticate
        console.log('🔄 Authenticating...');
        try {
            // Try login default admin (Email/Pass as verified in menu script)
            const login = await axios.post(`${BASE_URL}/auth/login`, {
                email: 'admin@pentium.com',
                password: '123456'
            });
            token = login.data.data.token;
        } catch (e) {
            console.log('Login failed, trying register...');
             const register = await axios.post(`${BASE_URL}/auth/register`, {
                name: 'Admin',
                email: 'admin@pentium.com',
                password: '123456',
                role: 'ADMIN' 
            });
            token = register.data.data.token;
        }
        console.log('✅ Authenticated.');
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        // 0.5. Create Category
        console.log('\n📂 Creating Category...');
        let categoryId;
        try {
            const resCat = await axios.post(`${BASE_URL}/categories`, { name: 'Burgers' });
            categoryId = resCat.data.data.id;
            console.log('✅ Category Created:', categoryId);
        } catch (e) {
             console.error('❌ Failed creating category:', e.response?.data || e.message);
             throw e;
        }

        // 1. Create Ingredient
        console.log('\n📝 Creating Ingredient for Recipe...');
        try {
            const resIng = await axios.post(`${BASE_URL}/ingredients`, {
                name: 'Burger Patty',
                unit: 'unit',
                cost: 100,
                stock: 100, // Initial Stock
                minStock: 10
            });
            ingredientId = resIng.data.data.id;
            console.log('✅ Ingredient Created:', resIng.data.data.name, 'Stock:', resIng.data.data.stock);
        } catch (e) {
            console.error('❌ Failed creating ingredient:', e.response?.data || e.message);
            throw e;
        }

        // 2. Create Product with Recipe
        console.log('\n🍔 Creating Product (Burger) with Recipe...');
        try {
            const resProd = await axios.post(`${BASE_URL}/products`, {
                categoryId: categoryId,
                name: 'Classic Burger',
                price: 1500,
                productType: 'RECIPE',
                ingredients: [
                    { ingredientId, quantity: 1 } // Use 1 patty per burger
                ]
            });
            productId = resProd.data.data.id;
            console.log('✅ Product Created:', resProd.data.data.name);
        } catch (e) {
            console.error('❌ Failed creating product:', JSON.stringify(e.response?.data || e.message));
            throw e;
        }

        // 3. Create Order
        console.log('\n🛒 Creating Order (2 Burgers)...');
        try {
            const resOrder = await axios.post(`${BASE_URL}/orders`, {
                items: [
                    { productId, quantity: 2, notes: 'No pickles' }
                ]
            });
            console.log('✅ Order Created. Order Number:', resOrder.data.data.orderNumber);
            console.log('   Total:', resOrder.data.data.total);
        } catch (e) {
            console.error('❌ Failed creating order:');
            if (e.response) {
                console.error('Status:', e.response.status);
                console.error('Data:', JSON.stringify(e.response.data, null, 2));
            } else {
                console.error('Error:', e.message);
            }
            throw e;
        }

        // 4. Verify Stock Deduction
        console.log('\n📉 Verifying Stock Deduction...');
        const resHistory = await axios.get(`${BASE_URL}/stock-movements?ingredientId=${ingredientId}`);
        const movements = resHistory.data.data;
        const lastMove = movements[movements.length - 1];
        
        console.log('   Last Stock Movement Type:', lastMove.type);
        console.log('   Quantity Change:', lastMove.quantity);

        if (lastMove.type === 'SALE' && Number(lastMove.quantity) === -2) {
             console.log('✅ Stock verification PASSED: -2 quantity recorded.');
        } else {
             console.error('❌ Stock verification FAILED. Expected -2 SALE.');
             // Check current stock
             const resIngCheck = await axios.get(`${BASE_URL}/ingredients/${ingredientId}`);
             console.log('   Current Stock:', resIngCheck.data.data.stock);
        }

        // 5. Cleanup
        console.log('\n🗑️ Cleaning up...');
        // Order cannot be easily deleted if we enforce FK constraints strictly without cascade, 
        // but explicit cleanup is good practice.
        // For now, leave data for manual inspection or rely on DB reset.

        console.log('\n🎉 Verification Flow Complete!');

    } catch (error) {
        console.error('❌ Verification Process Aborted.');
    }
}

runVerification();
