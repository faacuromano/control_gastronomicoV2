"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteOption = exports.updateOption = exports.addOption = exports.deleteGroup = exports.updateGroup = exports.createGroup = exports.getGroup = exports.getGroups = void 0;
const modifier_service_1 = require("../services/modifier.service");
const asyncHandler_1 = require("../middleware/asyncHandler");
exports.getGroups = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const groups = await modifier_service_1.modifierService.getAllGroups();
    res.json({ data: groups });
});
exports.getGroup = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const group = await modifier_service_1.modifierService.getGroupById(Number(req.params.id));
    if (!group)
        return res.status(404).json({ error: 'Group not found' });
    res.json({ data: group });
});
exports.createGroup = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const group = await modifier_service_1.modifierService.createGroup(req.body);
    res.status(201).json({ data: group });
});
exports.updateGroup = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const group = await modifier_service_1.modifierService.updateGroup(Number(req.params.id), req.body);
    res.json({ data: group });
});
exports.deleteGroup = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await modifier_service_1.modifierService.deleteGroup(Number(req.params.id));
    res.json({ success: true });
});
exports.addOption = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const option = await modifier_service_1.modifierService.addOption(Number(req.params.groupId), req.body);
    res.status(201).json({ data: option });
});
exports.updateOption = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const option = await modifier_service_1.modifierService.updateOption(Number(req.params.optionId), req.body);
    res.json({ data: option });
});
exports.deleteOption = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await modifier_service_1.modifierService.deleteOption(Number(req.params.optionId));
    res.json({ success: true });
});
//# sourceMappingURL=modifier.controller.js.map