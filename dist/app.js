"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const auth_routes_1 = require("./routes/auth.routes");
const user_routes_1 = require("./routes/user.routes");
const error_middleware_1 = require("./middleware/error.middleware");
const screening_routes_1 = require("./routes/screening.routes");
const iot_routes_1 = require("./routes/iot.routes");
const openapi_1 = require("./openapi");
exports.app = (0, express_1.default)();
exports.app.use((0, cors_1.default)());
// Let IoT devices send a simple "hello" probe with whatever Content-Type the
// microcontroller library attaches. This must run before the JSON parser.
exports.app.use("/iot/hello", express_1.default.text({ type: "*/*", limit: "1mb" }));
// Also parse regular text/plain requests elsewhere.
exports.app.use(express_1.default.text({ type: "text/plain", limit: "1mb" }));
// Large limit so IoT devices can POST audio/image as Base64 inside JSON when
// they can't do multipart. Multipart uploads bypass this limit via multer.
exports.app.use(express_1.default.json({ limit: "40mb" }));
exports.app.use(express_1.default.urlencoded({ extended: true, limit: "40mb" }));
exports.app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});
// Root is otherwise undefined → send visitors to the API docs so the bare
// Cloudflare URL doesn't show Express's default "Cannot GET /".
exports.app.get("/", (_req, res) => {
    res.redirect("/docs");
});
// Interactive API docs.
//  - /docs       → Swagger UI (try-it-out enabled)
//  - /docs.json  → raw OpenAPI 3 spec (paste into Postman/Insomnia/etc.)
exports.app.get("/docs.json", (_req, res) => {
    res.json(openapi_1.openApiSpec);
});
exports.app.use("/docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(openapi_1.openApiSpec, {
    customSiteTitle: "Tbhon Backend API Docs",
    swaggerOptions: {
        persistAuthorization: true,
        // If the token was pasted with a duplicate "Bearer " prefix, fix it before send.
        requestInterceptor: (req) => {
            const auth = req.headers?.Authorization ?? req.headers?.authorization;
            if (auth && /^Bearer\s+Bearer\s+/i.test(auth)) {
                const fixed = auth.replace(/^Bearer\s+/i, "");
                if (req.headers?.Authorization !== undefined)
                    req.headers.Authorization = fixed;
                if (req.headers?.authorization !== undefined)
                    req.headers.authorization = fixed;
            }
            return req;
        },
    },
}));
exports.app.use("/auth", auth_routes_1.authRouter);
exports.app.use("/users", user_routes_1.userRouter);
exports.app.use("/screenings", screening_routes_1.screeningRouter);
exports.app.use("/iot", iot_routes_1.iotRouter);
exports.app.use(error_middleware_1.errorHandler);
//# sourceMappingURL=app.js.map