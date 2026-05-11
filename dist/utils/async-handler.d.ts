import type { NextFunction, Request, RequestHandler, Response } from "express";
export declare function asyncHandler<TRequest extends Request = Request>(handler: (req: TRequest, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler;
//# sourceMappingURL=async-handler.d.ts.map