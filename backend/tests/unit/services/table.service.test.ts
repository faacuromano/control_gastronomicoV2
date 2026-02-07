/**
 * Unit tests for TableService
 * Tests: Area CRUD, Table CRUD, table operations (open/close/position)
 */

// --- Mocks MUST come before imports ---

const mockArea = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
};

const mockTable = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
};

const mockTransaction = jest.fn();

jest.mock('../../../src/lib/prisma', () => ({
    prisma: {
        area: mockArea,
        table: mockTable,
        $transaction: (...args: any[]) => mockTransaction(...args),
    },
}));

jest.mock('../../../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/utils/businessDate', () => ({
    getBusinessDate: jest.fn().mockReturnValue(new Date('2026-02-07')),
}));

// --- Imports after mocks ---

import { TableService } from '../../../src/services/table.service';

const service = new TableService();
const TENANT_ID = 1;

const createMockArea = (overrides = {}) => ({
    id: 1,
    name: 'Salón Principal',
    tenantId: TENANT_ID,
    tables: [],
    ...overrides,
});

const createMockTable = (overrides = {}) => ({
    id: 1,
    name: 'Mesa 1',
    areaId: 1,
    tenantId: TENANT_ID,
    status: 'FREE',
    currentOrderId: null,
    x: 0,
    y: 0,
    ...overrides,
});

describe('TableService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ==================== AREAS ====================

    describe('getAreas', () => {
        it('returns all areas with tables', async () => {
            const areas = [createMockArea({ tables: [createMockTable()] })];
            mockArea.findMany.mockResolvedValue(areas);

            const result = await service.getAreas(TENANT_ID);

            expect(result).toEqual(areas);
            expect(mockArea.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { tenantId: TENANT_ID },
                    include: { tables: expect.any(Object) },
                })
            );
        });
    });

    describe('createArea', () => {
        it('creates a new area', async () => {
            const area = createMockArea({ name: 'Terraza' });
            mockArea.create.mockResolvedValue(area);

            const result = await service.createArea(TENANT_ID, { name: 'Terraza' });

            expect(result.name).toBe('Terraza');
            expect(mockArea.create).toHaveBeenCalledWith({
                data: { name: 'Terraza', tenantId: TENANT_ID },
            });
        });

        it('throws ValidationError for empty name', async () => {
            await expect(service.createArea(TENANT_ID, { name: '' })).rejects.toThrow(
                'Area name is required'
            );
        });
    });

    describe('updateArea', () => {
        it('updates area name', async () => {
            mockArea.findFirst.mockResolvedValue(createMockArea());
            mockArea.updateMany.mockResolvedValue({ count: 1 });

            await service.updateArea(1, TENANT_ID, { name: 'VIP' });

            expect(mockArea.updateMany).toHaveBeenCalledWith({
                where: { id: 1, tenantId: TENANT_ID },
                data: { name: 'VIP' },
            });
        });

        it('throws NotFoundError for non-existent area', async () => {
            mockArea.findFirst.mockResolvedValue(null);

            await expect(service.updateArea(999, TENANT_ID, { name: 'X' })).rejects.toThrow(
                'Area not found'
            );
        });
    });

    describe('deleteArea', () => {
        it('deletes area and its tables', async () => {
            mockArea.findFirst.mockResolvedValue(createMockArea());
            mockTable.count.mockResolvedValue(0);
            mockTable.deleteMany.mockResolvedValue({ count: 2 });
            mockArea.deleteMany.mockResolvedValue({ count: 1 });

            await service.deleteArea(1, TENANT_ID);

            expect(mockTable.deleteMany).toHaveBeenCalledWith({
                where: { areaId: 1, tenantId: TENANT_ID },
            });
            expect(mockArea.deleteMany).toHaveBeenCalledWith({
                where: { id: 1, tenantId: TENANT_ID },
            });
        });

        it('throws NotFoundError for non-existent area', async () => {
            mockArea.findFirst.mockResolvedValue(null);
            await expect(service.deleteArea(999, TENANT_ID)).rejects.toThrow('Area not found');
        });

        it('throws ConflictError when area has occupied tables', async () => {
            mockArea.findFirst.mockResolvedValue(createMockArea());
            mockTable.count.mockResolvedValue(2);

            await expect(service.deleteArea(1, TENANT_ID)).rejects.toThrow(
                /occupied tables/
            );
        });
    });

    // ==================== TABLES ====================

    describe('createTable', () => {
        it('creates a table in an existing area', async () => {
            mockArea.findFirst.mockResolvedValue(createMockArea());
            const table = createMockTable({ name: 'Mesa 5' });
            mockTable.create.mockResolvedValue(table);

            const result = await service.createTable(TENANT_ID, { name: 'Mesa 5', areaId: 1 });

            expect(result.name).toBe('Mesa 5');
            expect(mockTable.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    tenantId: TENANT_ID,
                    name: 'Mesa 5',
                    areaId: 1,
                    status: 'FREE',
                }),
            });
        });

        it('throws NotFoundError for non-existent area', async () => {
            mockArea.findFirst.mockResolvedValue(null);

            await expect(
                service.createTable(TENANT_ID, { name: 'Mesa 1', areaId: 999 })
            ).rejects.toThrow('Area not found');
        });
    });

    describe('updateTable', () => {
        it('updates table name and position', async () => {
            mockTable.findFirst.mockResolvedValue(createMockTable());
            mockTable.updateMany.mockResolvedValue({ count: 1 });

            await service.updateTable(1, TENANT_ID, { name: 'Mesa VIP', x: 100, y: 200 });

            expect(mockTable.updateMany).toHaveBeenCalledWith({
                where: { id: 1, tenantId: TENANT_ID },
                data: { name: 'Mesa VIP', x: 100, y: 200 },
            });
        });

        it('throws NotFoundError for non-existent table', async () => {
            mockTable.findFirst.mockResolvedValue(null);
            await expect(service.updateTable(999, TENANT_ID, { name: 'X' })).rejects.toThrow(
                'Table not found'
            );
        });
    });

    describe('deleteTable', () => {
        it('deletes a free table', async () => {
            mockTable.findFirst.mockResolvedValue(createMockTable());
            mockTable.deleteMany.mockResolvedValue({ count: 1 });

            await service.deleteTable(1, TENANT_ID);

            expect(mockTable.deleteMany).toHaveBeenCalledWith({
                where: { id: 1, tenantId: TENANT_ID },
            });
        });

        it('throws ConflictError for occupied table', async () => {
            mockTable.findFirst.mockResolvedValue(createMockTable({ status: 'OCCUPIED' }));

            await expect(service.deleteTable(1, TENANT_ID)).rejects.toThrow(
                'Cannot delete occupied table'
            );
        });

        it('throws NotFoundError for non-existent table', async () => {
            mockTable.findFirst.mockResolvedValue(null);
            await expect(service.deleteTable(999, TENANT_ID)).rejects.toThrow('Table not found');
        });
    });

    // ==================== TABLE OPERATIONS ====================

    describe('openTable', () => {
        it('marks table as occupied with order', async () => {
            mockTable.findFirst.mockResolvedValue(createMockTable());
            mockTable.updateMany.mockResolvedValue({ count: 1 });

            await service.openTable(1, 100, TENANT_ID);

            expect(mockTable.updateMany).toHaveBeenCalledWith({
                where: { id: 1, tenantId: TENANT_ID },
                data: { status: 'OCCUPIED', currentOrderId: 100 },
            });
        });

        it('throws NotFoundError for missing table', async () => {
            mockTable.findFirst.mockResolvedValue(null);
            await expect(service.openTable(999, 100, TENANT_ID)).rejects.toThrow('Table not found');
        });
    });

    describe('closeTable', () => {
        it('frees an occupied table', async () => {
            mockTable.findFirst.mockResolvedValue(createMockTable({ status: 'OCCUPIED' }));
            mockTable.updateMany.mockResolvedValue({ count: 1 });

            await service.closeTable(1, TENANT_ID);

            expect(mockTable.updateMany).toHaveBeenCalledWith({
                where: { id: 1, tenantId: TENANT_ID },
                data: { status: 'FREE', currentOrderId: null },
            });
        });
    });

    describe('getTable', () => {
        it('returns table with open orders', async () => {
            const table = createMockTable({
                status: 'OCCUPIED',
                orders: [{ id: 1, status: 'OPEN', items: [] }],
            });
            mockTable.findFirst.mockResolvedValue(table);

            const result = await service.getTable(1, TENANT_ID);

            expect(result).toEqual(table);
            expect(mockTable.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 1, tenantId: TENANT_ID },
                    include: { orders: expect.any(Object) },
                })
            );
        });

        it('throws NotFoundError for missing table', async () => {
            mockTable.findFirst.mockResolvedValue(null);
            await expect(service.getTable(999, TENANT_ID)).rejects.toThrow('Table not found');
        });
    });

    describe('updateTablePosition', () => {
        it('updates X/Y position', async () => {
            mockTable.findFirst.mockResolvedValue(createMockTable());
            mockTable.updateMany.mockResolvedValue({ count: 1 });

            await service.updateTablePosition(1, TENANT_ID, 150, 300);

            expect(mockTable.updateMany).toHaveBeenCalledWith({
                where: { id: 1, tenantId: TENANT_ID },
                data: { x: 150, y: 300 },
            });
        });
    });

    describe('updatePositions (batch)', () => {
        it('updates multiple table positions in a transaction', async () => {
            const txTable = { updateMany: jest.fn().mockResolvedValue({ count: 1 }) };
            mockTransaction.mockImplementation(async (fn: any) => fn({ table: txTable }));

            await service.updatePositions(TENANT_ID, [
                { id: 1, x: 10, y: 20 },
                { id: 2, x: 30, y: 40 },
            ]);

            expect(txTable.updateMany).toHaveBeenCalledTimes(2);
            expect(txTable.updateMany).toHaveBeenCalledWith({
                where: { id: 1, tenantId: TENANT_ID },
                data: { x: 10, y: 20 },
            });
            expect(txTable.updateMany).toHaveBeenCalledWith({
                where: { id: 2, tenantId: TENANT_ID },
                data: { x: 30, y: 40 },
            });
        });
    });

    describe('assignOrderToTable', () => {
        it('assigns order and sets table to OCCUPIED', async () => {
            mockTable.findFirst.mockResolvedValue(createMockTable());
            mockTable.updateMany.mockResolvedValue({ count: 1 });

            await service.assignOrderToTable(1, 50, TENANT_ID);

            expect(mockTable.updateMany).toHaveBeenCalledWith({
                where: { id: 1, tenantId: TENANT_ID },
                data: { status: 'OCCUPIED', currentOrderId: 50 },
            });
        });

        it('throws NotFoundError for non-existent table', async () => {
            mockTable.findFirst.mockResolvedValue(null);
            await expect(service.assignOrderToTable(999, 50, TENANT_ID)).rejects.toThrow(
                'Table not found'
            );
        });
    });

    describe('freeTableFromOrder', () => {
        it('sets table to FREE and clears currentOrderId', async () => {
            mockTable.findFirst.mockResolvedValue(createMockTable({ status: 'OCCUPIED', currentOrderId: 50 }));
            mockTable.updateMany.mockResolvedValue({ count: 1 });

            await service.freeTableFromOrder(1, TENANT_ID);

            expect(mockTable.updateMany).toHaveBeenCalledWith({
                where: { id: 1, tenantId: TENANT_ID },
                data: { status: 'FREE', currentOrderId: null },
            });
        });

        it('throws NotFoundError for non-existent table', async () => {
            mockTable.findFirst.mockResolvedValue(null);
            await expect(service.freeTableFromOrder(999, TENANT_ID)).rejects.toThrow(
                'Table not found'
            );
        });
    });
});
