import { Request, Response } from "express";
import HttpHelper from "../utils/http-helper";
import billingService from "../services/billing.service";

class BillingController {
  async getUsage(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return HttpHelper.unauthorized(res, "Unauthorized");
      }

      const usage = await billingService.getCurrentUsage(userId);
      return HttpHelper.success(res, usage, "Current usage fetched successfully");
    } catch (error) {
      console.error("Error fetching billing usage:", error);
      return HttpHelper.serverError(res);
    }
  }

  async getSubscription(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return HttpHelper.unauthorized(res, "Unauthorized");
      }

      const subscription = await billingService.getCurrentSubscription(userId);
      return HttpHelper.success(
        res,
        subscription,
        "Subscription fetched successfully"
      );
    } catch (error) {
      console.error("Error fetching subscription:", error);
      return HttpHelper.serverError(res);
    }
  }
}

export default new BillingController();
