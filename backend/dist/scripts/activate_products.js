"use strict";
const axios = require('axios');
const BASE_URL = 'http://localhost:3001/api';
async function run() {
    try {
        // Login
        const login = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'admin@pentium.com',
            password: '123456'
        });
        const token = login.data.data.token;
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        // Get Products
        const res = await axios.get(`${BASE_URL}/products`);
        const products = res.data.data;
        console.log(`Found ${products.length} products.`);
        for (const p of products) {
            console.log(`Product ${p.id} (${p.name}): Active=${p.isActive}`);
            if (!p.isActive) {
                console.log(`Activating product ${p.id}...`);
                await axios.patch(`${BASE_URL}/products/${p.id}/toggle`);
                console.log('Done.');
            }
        }
    }
    catch (e) {
        console.error(e.response?.data || e.message);
    }
}
run();
//# sourceMappingURL=activate_products.js.map