"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_controller_1 = require("../controllers/client.controller");
const router = (0, express_1.Router)();
router.get('/search', client_controller_1.searchClients);
router.post('/', client_controller_1.createClient);
exports.default = router;
//# sourceMappingURL=client.routes.js.map