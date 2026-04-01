import { Router } from "express";
import submissionController from "../controllers/submission.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { usageLimitMiddleware } from "../middleware/usage-limit.middleware";

const submissionRouter = Router();

submissionRouter.get("/", authMiddleware, submissionController.listSubmissions);
submissionRouter.post(
  "/",
  authMiddleware,
  usageLimitMiddleware,
  submissionController.createSubmission
);
submissionRouter.get("/:id", authMiddleware, submissionController.getSubmissionById);
submissionRouter.get("/:id/events", authMiddleware, submissionController.getSubmissionEvents);

export default submissionRouter;
