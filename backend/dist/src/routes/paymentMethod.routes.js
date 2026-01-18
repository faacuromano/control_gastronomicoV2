"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const PaymentMethodController = __importStar(require("../controllers/paymentMethod.controller"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public route for POS - get active methods only
router.get('/active', auth_1.authenticate, PaymentMethodController.getActive);
// Admin routes
router.get('/', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), PaymentMethodController.getAll);
router.get('/:id', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), PaymentMethodController.getById);
router.post('/', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), PaymentMethodController.create);
router.put('/:id', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), PaymentMethodController.update);
router.patch('/:id/toggle', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), PaymentMethodController.toggleActive);
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), PaymentMethodController.remove);
// Seed defaults (admin only, for initial setup)
router.post('/seed', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), PaymentMethodController.seedDefaults);
exports.default = router;
//# sourceMappingURL=paymentMethod.routes.js.map