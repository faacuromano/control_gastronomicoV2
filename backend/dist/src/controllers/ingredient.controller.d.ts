import { Request, Response } from 'express';
export declare const getIngredients: (req: Request, res: Response) => Promise<void>;
export declare const getIngredientById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const createIngredient: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateIngredient: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteIngredient: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=ingredient.controller.d.ts.map