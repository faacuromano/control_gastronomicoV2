"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const API_URL = 'http://localhost:3001/api';
async function runTest() {
    try {
        console.log('🔄 Authenticating...');
        const loginRes = await axios_1.default.post(`${API_URL}/auth/login`, {
            email: 'admin@pentium.com',
            password: '123456'
        });
        const token = loginRes.data.data.token;
        console.log('✅ Authenticated. Token received.');
        const headers = { Authorization: `Bearer ${token}` };
        // 1. Create Category
        console.log('🔄 Creating Category "Test Category"...');
        const catRes = await axios_1.default.post(`${API_URL}/categories`, {
            name: 'Test Category',
            printerId: 1
        }, { headers });
        const category = catRes.data.data;
        console.log('✅ Category Created:', category.id);
        // 2. Create Product
        console.log('🔄 Creating Product "Test Burger"...');
        const prodRes = await axios_1.default.post(`${API_URL}/products`, {
            categoryId: category.id,
            name: 'Test Burger',
            price: 1500,
            productType: 'SIMPLE',
            isStockable: true,
            description: 'Delicious testing burger'
        }, { headers });
        const product = prodRes.data.data;
        console.log('✅ Product Created:', product.id);
        // 3. List
        console.log('🔄 Listing Products...');
        const listRes = await axios_1.default.get(`${API_URL}/products?categoryId=${category.id}`, { headers });
        console.log(`✅ Found ${listRes.data.data.length} products.`);
        console.log('🎉 Verification Successful!');
    }
    catch (error) {
        console.error('❌ Verification Failed:', error.response?.data || error.message);
        process.exit(1);
    }
}
runTest();
//# sourceMappingURL=verify_menu.js.map