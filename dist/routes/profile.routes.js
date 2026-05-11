"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileRouter = void 0;
const express_1 = require("express");
const profile_controller_1 = require("../controllers/profile.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const async_handler_1 = require("../utils/async-handler");
exports.profileRouter = (0, express_1.Router)();
exports.profileRouter.get("/me", auth_middleware_1.requireAuth, (0, async_handler_1.asyncHandler)(profile_controller_1.getMe));
exports.profileRouter.patch("/me/profile", auth_middleware_1.requireAuth, (0, async_handler_1.asyncHandler)(profile_controller_1.updateProfile));
//# sourceMappingURL=profile.routes.js.map