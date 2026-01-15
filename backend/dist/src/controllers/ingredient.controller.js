"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteIngredient = exports.updateIngredient = exports.createIngredient = exports.getIngredientById = exports.getIngredients = void 0;
const zod_1 = require("zod");
const ingredient_service_1 = require("../services/ingredient.service");
const ingredientService = new ingredient_service_1.IngredientService();
const ingredientSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    unit: zod_1.z.string().min(1),
    cost: zod_1.z.number().min(0),
    stock: zod_1.z.number().min(0),
    minStock: zod_1.z.number().min(0).optional()
});
const updateIngredientSchema = ingredientSchema.partial().omit({ stock: true });
const getIngredients = async (req, res) => {
    try {
        const ingredients = await ingredientService.getAll();
        res.json({ success: true, data: ingredients });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch ingredients' });
    }
};
exports.getIngredients = getIngredients;
const getIngredientById = async (req, res) => {
    try {
        const id = parseInt(req.params.id || '0');
        if (isNaN(id))
            return res.status(400).json({ success: false, error: 'Invalid ID' });
        const ingredient = await ingredientService.getById(id);
        if (!ingredient) {
            return res.status(404).json({ success: false, error: 'Ingredient not found' });
        }
        res.json({ success: true, data: ingredient });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch ingredient' });
    }
};
exports.getIngredientById = getIngredientById;
const createIngredient = async (req, res) => {
    try {
        const data = ingredientSchema.parse(req.body);
        const ingredient = await ingredientService.create({
            ...data,
            minStock: data.minStock ?? 0
        });
        res.status(201).json({ success: true, data: ingredient });
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return res.status(400).json({ success: false, error: error.issues });
        }
        res.status(500).json({ success: false, error: 'Failed to create ingredient' });
    }
};
exports.createIngredient = createIngredient;
const updateIngredient = async (req, res) => {
    try {
        const id = parseInt(req.params.id || '0');
        if (isNaN(id))
            return res.status(400).json({ success: false, error: 'Invalid ID' });
        const data = updateIngredientSchema.parse(req.body);
        const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
        const ingredient = await ingredientService.update(id, cleanData);
        res.json({ success: true, data: ingredient });
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return res.status(400).json({ success: false, error: error.issues });
        }
        res.status(500).json({ success: false, error: 'Failed to update ingredient' });
    }
};
exports.updateIngredient = updateIngredient;
const deleteIngredient = async (req, res) => {
    try {
        const id = parseInt(req.params.id || '0');
        if (isNaN(id))
            return res.status(400).json({ success: false, error: 'Invalid ID' });
        await ingredientService.delete(id);
        res.json({ success: true, message: 'Ingredient deleted' });
    }
    catch (error) {
        res.status(400).json({ success: false, error: error.message || 'Failed to delete ingredient' });
    }
};
exports.deleteIngredient = deleteIngredient;
//# sourceMappingURL=ingredient.controller.js.map