"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.iotRouter = void 0;
const express_1 = require("express");
const iot_controller_1 = require("../controllers/iot.controller");
const iot_middleware_1 = require("../middleware/iot.middleware");
const upload_1 = require("../utils/upload");
exports.iotRouter = (0, express_1.Router)();
function logIotHelloAttempt(req, _res, next) {
    const authSource = req.header("x-iot-key") ? "X-IoT-Key" : req.header("authorization") ? "Authorization" : "no key";
    console.log(`[iot] hello attempt from ${req.ip} (${authSource})`);
    next();
}
// Public health check — used by ESP32 firmware to confirm the URL/network.
exports.iotRouter.get("/health", iot_controller_1.iotHealth);
// Authenticated smoke test for microcontrollers before sending real media.
exports.iotRouter.post("/hello", logIotHelloAttempt, iot_middleware_1.requireIotKey, iot_controller_1.iotHello);
// Poll/set capture trigger command for camera/audio devices.
exports.iotRouter.post("/trigger", iot_middleware_1.requireIotKey, iot_controller_1.iotSetTrigger);
exports.iotRouter.get("/trigger", iot_middleware_1.requireIotKey, iot_controller_1.iotGetTrigger);
exports.iotRouter.post("/device-command", iot_middleware_1.requireIotKey, iot_controller_1.iotDeviceCommand);
exports.iotRouter.get("/device-command", iot_middleware_1.requireIotKey, iot_controller_1.iotGetDeviceCommand);
// All upload endpoints require the shared device key.
exports.iotRouter.post("/cough-recordings", iot_middleware_1.requireIotKey, upload_1.upload.single("file"), iot_controller_1.iotUploadCough);
exports.iotRouter.post("/sputum-images", iot_middleware_1.requireIotKey, upload_1.upload.single("file"), iot_controller_1.iotUploadSputum);
exports.iotRouter.get("/sputum-images/:sessionId/file", iot_middleware_1.requireIotKey, iot_controller_1.iotDownloadSputum);
//# sourceMappingURL=iot.routes.js.map