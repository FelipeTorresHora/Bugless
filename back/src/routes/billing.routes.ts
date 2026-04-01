import { Router } from "express";
import billingController from "../controllers/billing.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const billingRouter = Router();

billingRouter.get("/usage", authMiddleware, billingController.getUsage);
billingRouter.get("/subscription", authMiddleware, billingController.getSubscription);

export default billingRouter;
