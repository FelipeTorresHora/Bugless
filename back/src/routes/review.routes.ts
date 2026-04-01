import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import reviewController from "../controllers/review.controller";

const reviewRouter = Router();

reviewRouter.get("/:id", authMiddleware, reviewController.getReviewById);

export default reviewRouter;
