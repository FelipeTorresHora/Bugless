import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import analyticsController from "../controllers/analytics.controller";

const analyticsRouter = Router();

analyticsRouter.get("/summary", authMiddleware, analyticsController.getSummary);
analyticsRouter.get("/export.csv", authMiddleware, analyticsController.exportCsv);

export default analyticsRouter;
