"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.screeningRouter = void 0;
const express_1 = require("express");
const screening_controller_1 = require("../controllers/screening.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
exports.screeningRouter = (0, express_1.Router)();
exports.screeningRouter.post("/", auth_middleware_1.requireAuth, screening_controller_1.completeScreening);
exports.screeningRouter.get("/", auth_middleware_1.requireAuth, screening_controller_1.listMyScreenings);
exports.screeningRouter.get("/:sessionId", auth_middleware_1.requireAuth, screening_controller_1.getMyScreening);
//# sourceMappingURL=screening.routes.js.map