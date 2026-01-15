"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tableService = exports.TableService = void 0;
const prisma_1 = require("../lib/prisma");
const errors_1 = require("../utils/errors");
class TableService {
    // --- AREAS ---
    async getAreas() {
        return prisma_1.prisma.area.findMany({
            include: {
                tables: {
                    orderBy: { id: 'asc' }
                }
            },
            orderBy: { id: 'asc' }
        });
    }
    async createArea(data) {
        if (!data.name)
            throw new errors_1.ValidationError('Area name is required');
        return prisma_1.prisma.area.create({ data });
    }
    async deleteArea(id) {
        // Check if area has tables
        const count = await prisma_1.prisma.table.count({ where: { areaId: id } });
        if (count > 0)
            throw new errors_1.ConflictError('Cannot delete area with tables');
        return prisma_1.prisma.area.delete({ where: { id } });
    }
    // --- TABLES ---
    async createTable(data) {
        const area = await prisma_1.prisma.area.findUnique({ where: { id: data.areaId } });
        if (!area)
            throw new errors_1.NotFoundError('Area not found');
        return prisma_1.prisma.table.create({
            data: {
                name: data.name,
                areaId: data.areaId,
                x: data.x || 0,
                y: data.y || 0,
                status: 'FREE'
            }
        });
    }
    async updateTablePosition(id, x, y) {
        return prisma_1.prisma.table.update({
            where: { id },
            data: { x, y }
        });
    }
    async getTable(id) {
        const table = await prisma_1.prisma.table.findUnique({
            where: { id },
            include: {
                orders: {
                    where: { status: 'OPEN' },
                    include: { items: true } // Basic info
                }
            }
        });
        if (!table)
            throw new errors_1.NotFoundError('Table not found');
        return table;
    }
    // --- OPERATIONS ---
    async openTable(id, orderId) {
        return prisma_1.prisma.table.update({
            where: { id },
            data: {
                status: 'OCCUPIED',
                currentOrderId: orderId
            }
        });
    }
    async closeTable(id) {
        return prisma_1.prisma.table.update({
            where: { id },
            data: {
                status: 'FREE',
                currentOrderId: null
            }
        });
    }
    // Used when an order is created with tableId
    async assignOrderToTable(tableId, orderId) {
        const table = await prisma_1.prisma.table.findUnique({ where: { id: tableId } });
        if (!table)
            throw new errors_1.NotFoundError('Table not found');
        if (table.status !== 'FREE' && table.status !== 'OCCUPIED') {
            // Maybe allow if occupied adding to same order? 
            // For simplicity, just update currentOrderId
        }
        return prisma_1.prisma.table.update({
            where: { id: tableId },
            data: {
                status: 'OCCUPIED',
                currentOrderId: orderId
            }
        });
    }
    async freeTableFromOrder(tableId) {
        return prisma_1.prisma.table.update({
            where: { id: tableId },
            data: {
                status: 'FREE',
                currentOrderId: null
            }
        });
    }
}
exports.TableService = TableService;
exports.tableService = new TableService();
//# sourceMappingURL=table.service.js.map