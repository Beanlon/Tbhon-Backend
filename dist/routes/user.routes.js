"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRouter = void 0;
const express_1 = require("express");
const user_controller_1 = require("../controllers/user.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
exports.userRouter = (0, express_1.Router)();
exports.userRouter.get("/me", auth_middleware_1.requireAuth, user_controller_1.getMe);
exports.userRouter.patch("/me", auth_middleware_1.requireAuth, user_controller_1.updateMe);
exports.userRouter.put("/me/profile", auth_middleware_1.requireAuth, user_controller_1.upsertMyProfile);
//# sourceMappingURL=user.routes.js.map