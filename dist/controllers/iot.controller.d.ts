import type { Request, Response } from "express";
/** POST /iot/cough-recordings */
export declare function iotUploadCough(req: Request, res: Response): Promise<void>;
/** POST /iot/sputum-images */
export declare function iotUploadSputum(req: Request, res: Response): Promise<void>;
/** GET /iot/health */
export declare function iotHealth(_req: Request, res: Response): void;
/** POST /iot/hello */
export declare function iotHello(req: Request, res: Response): void;
/** POST /iot/device-command */
export declare function iotDeviceCommand(req: Request, res: Response): void;
/** GET /iot/device-command */
export declare function iotGetDeviceCommand(req: Request, res: Response): void;
/** POST /iot/trigger */
export declare function iotSetTrigger(req: Request, res: Response): void;
/** GET /iot/trigger */
export declare function iotGetTrigger(req: Request, res: Response): void;
/** GET /iot/sputum-images/:sessionId/file?userId=... */
export declare function iotDownloadSputum(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=iot.controller.d.ts.map