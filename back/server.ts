import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import statusSubmissionRouter from "./src/routes/status-submission.routes";
import envLoader from "./src/services/env-loader.service";
import authRouter from "./src/routes/auth.routes";
import projectRouter from "./src/routes/project.routes";
import submissionRouter from "./src/routes/submission.routes";
import githubWebhookRouter from "./src/routes/github-webhook.routes";
import userRouter from "./src/routes/user.routes";
import apiKeyRouter from "./src/routes/api-key.routes";
import billingRouter from "./src/routes/billing.routes";
import reviewRouter from "./src/routes/review.routes";
import analyticsRouter from "./src/routes/analytics.routes";
import cookieMiddleware from "./src/middleware/cookie.middleware";
import statusSubmissionService from "./src/services/status-submission.service";

const PORT = envLoader.getEnv("PORT") || "3000";
const FRONTEND_URL = envLoader.getEnv("FRONTEND_URL") || "http://localhost:3001";
const JSON_BODY_LIMIT = envLoader.getEnv("JSON_BODY_LIMIT") || "10mb";

const app = express();

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));

// GitHub webhook endpoint MUST come BEFORE express.json()
// This is because we need the raw body to verify the webhook signature
app.use(
  "/webhooks/github",
  express.raw({ type: "application/json" }),
  githubWebhookRouter
);

app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));
app.use(cookieMiddleware);

app.use("/status-submissions", statusSubmissionRouter);
app.use("/auth", authRouter);
app.use("/projects", projectRouter);
app.use("/submissions", submissionRouter);
app.use("/users", userRouter);
app.use("/api-keys", apiKeyRouter);
app.use("/billing", billingRouter);
app.use("/reviews", reviewRouter);
app.use("/analytics", analyticsRouter);

app.get("/health", async (req: Request, res: Response) => {
  return res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "bugless-back",
  });
});

app.get("/", async (req: Request, res: Response) => {
  res.send("API is running");
});

app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    (error as { type?: string }).type === "entity.too.large"
  ) {
    return res.status(413).json({
      success: false,
      message: `Payload too large. Reduce review scope or increase JSON_BODY_LIMIT (current: ${JSON_BODY_LIMIT}).`,
      code: "PAYLOAD_TOO_LARGE",
    });
  }

  if (
    error instanceof SyntaxError &&
    "body" in error
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON payload",
      code: "INVALID_JSON",
    });
  }

  return next(error);
});

statusSubmissionService
  .ensureDefaultStatuses()
  .then(() => {
    app.listen(PORT, () => {
      console.log("Server is running on http://localhost:" + PORT);
    });
  })
  .catch((error) => {
    console.error("[Startup] Failed to ensure submission statuses:", error);
    app.listen(PORT, () => {
      console.log("Server is running on http://localhost:" + PORT);
    });
  });
