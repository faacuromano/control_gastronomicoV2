import { Request, Response } from 'express';
import { modifierService } from '../services/modifier.service';
import { asyncHandler } from '../middleware/asyncHandler';

export const getGroups = asyncHandler(async (req: Request, res: Response) => {
  const groups = await modifierService.getAllGroups();
  res.json({ data: groups });
});

export const getGroup = asyncHandler(async (req: Request, res: Response) => {
  const group = await modifierService.getGroupById(Number(req.params.id));
  if (!group) return res.status(404).json({ error: 'Group not found' });
  res.json({ data: group });
});

export const createGroup = asyncHandler(async (req: Request, res: Response) => {
  const group = await modifierService.createGroup(req.body);
  res.status(201).json({ data: group });
});

export const updateGroup = asyncHandler(async (req: Request, res: Response) => {
  const group = await modifierService.updateGroup(Number(req.params.id), req.body);
  res.json({ data: group });
});

export const deleteGroup = asyncHandler(async (req: Request, res: Response) => {
  await modifierService.deleteGroup(Number(req.params.id));
  res.json({ success: true });
});

export const addOption = asyncHandler(async (req: Request, res: Response) => {
  const option = await modifierService.addOption(Number(req.params.groupId), req.body);
  res.status(201).json({ data: option });
});

export const updateOption = asyncHandler(async (req: Request, res: Response) => {
  const option = await modifierService.updateOption(Number(req.params.optionId), req.body);
  res.json({ data: option });
});

export const deleteOption = asyncHandler(async (req: Request, res: Response) => {
  await modifierService.deleteOption(Number(req.params.optionId));
  res.json({ success: true });
});
