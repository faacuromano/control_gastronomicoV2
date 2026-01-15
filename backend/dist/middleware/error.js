"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const response_1 = require("../utils/response");
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    if (err.name === 'ZodError') {
        return (0, response_1.sendError)(res, 'VALIDATION_ERROR', 'Invalid data', err.errors, 400);
    }
    return (0, response_1.sendError)(res, 'INTERNAL_SERVER_ERROR', 'Something went wrong', null, 500);
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=error.js.map