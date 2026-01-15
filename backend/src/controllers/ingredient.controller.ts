
import { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { IngredientService } from '../services/ingredient.service';

const ingredientService = new IngredientService();

const ingredientSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  cost: z.number().min(0),
  stock: z.number().min(0),
  minStock: z.number().min(0).optional()
});

const updateIngredientSchema = ingredientSchema.partial();

export const getIngredients = async (req: Request, res: Response) => {
  try {
    const ingredients = await ingredientService.getAll();
    res.json({ success: true, data: ingredients });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch ingredients' });
  }
};

export const getIngredientById = async (req: Request, res: Response) => {
  try {
    const id = parseInt((req.params.id as string) || '0');
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });

    const ingredient = await ingredientService.getById(id);
    if (!ingredient) {
      return res.status(404).json({ success: false, error: 'Ingredient not found' });
    }
    res.json({ success: true, data: ingredient });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch ingredient' });
  }
};

export const createIngredient = async (req: Request, res: Response) => {
  try {
    const data = ingredientSchema.parse(req.body);
    const ingredient = await ingredientService.create({
        ...data,
        minStock: data.minStock ?? 0 
    });
    res.status(201).json({ success: true, data: ingredient });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, error: error.issues });
    }
    res.status(500).json({ success: false, error: 'Failed to create ingredient' });
  }
};

export const updateIngredient = async (req: Request, res: Response) => {
  try {
    const id = parseInt((req.params.id as string) || '0');
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });

    const data = updateIngredientSchema.parse(req.body);
    const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined)
    );

    const ingredient = await ingredientService.update(id, cleanData);
    res.json({ success: true, data: ingredient });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, error: error.issues });
    }
    res.status(500).json({ success: false, error: 'Failed to update ingredient' });
  }
};

export const deleteIngredient = async (req: Request, res: Response) => {
  try {
    const id = parseInt((req.params.id as string) || '0');
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });

    await ingredientService.delete(id);
    res.json({ success: true, message: 'Ingredient deleted' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Failed to delete ingredient' });
  }
};
