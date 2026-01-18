"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClient = exports.searchClients = void 0;
const prisma_1 = require("../lib/prisma");
const zod_1 = require("zod");
const asyncHandler_1 = require("../middleware/asyncHandler");
const createClientSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    phone: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    address: zod_1.z.string().optional(),
    taxId: zod_1.z.string().optional()
});
exports.searchClients = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { q } = req.query;
    // If no query, return recent clients (e.g. last 20)
    if (!q || typeof q !== 'string' || !q.trim()) {
        const recentClients = await prisma_1.prisma.client.findMany({
            take: 20,
            orderBy: { id: 'desc' }
        });
        return res.json(recentClients);
    }
    const clients = await prisma_1.prisma.client.findMany({
        where: {
            OR: [
                { name: { contains: q } },
                { phone: { contains: q } }
            ]
        },
        take: 20
    });
    res.json(clients);
});
exports.createClient = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = createClientSchema.parse(req.body);
    // Check if phone exists
    if (data.phone) {
        const existing = await prisma_1.prisma.client.findUnique({ where: { phone: data.phone } });
        if (existing) {
            // For POS convenience, let's update address if provided
            const updated = await prisma_1.prisma.client.update({
                where: { id: existing.id },
                data: {
                    address: data.address || existing.address,
                    name: data.name // Update name if changed?
                }
            });
            return res.json(updated);
        }
    }
    const client = await prisma_1.prisma.client.create({
        data: {
            name: data.name,
            phone: data.phone || null,
            email: data.email || null,
            address: data.address || null,
            taxId: data.taxId || null
        }
    });
    res.json(client);
});
//# sourceMappingURL=client.controller.js.map