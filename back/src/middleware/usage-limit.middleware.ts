import { NextFunction, Request, Response } from "express";
import billingService from "../services/billing.service";
import HttpHelper from "../utils/http-helper";
import { UsageLimitReachedError } from "../services/billing.utils";

export async function usageLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const userId = req.user?.userId;

  if (!userId) {
    return HttpHelper.unauthorized(res, "Unauthorized");
  }

  try {
    await billingService.checkAndEnforceLimit(userId);
    return next();
  } catch (error) {
    if (error instanceof UsageLimitReachedError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
        data: error.usage,
      });
    }

    console.error("Error enforcing usage limit:", error);
    return HttpHelper.serverError(res);
  }
}

export default usageLimitMiddleware;
