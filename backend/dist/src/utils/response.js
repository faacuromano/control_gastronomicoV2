"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendError = exports.sendSuccess = void 0;
const sendSuccess = (res, data, meta, statusCode = 200) => {
    const response = {
        success: true,
        data,
        meta,
    };
    return res.status(statusCode).json(response);
};
exports.sendSuccess = sendSuccess;
const sendError = (res, code, message, details, statusCode = 400) => {
    const response = {
        success: false,
        error: {
            code,
            message,
            details: details || undefined,
        },
    };
    return res.status(statusCode).json(response);
};
exports.sendError = sendError;
//# sourceMappingURL=response.js.map