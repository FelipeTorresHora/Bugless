import { Queue, Worker, Job } from "bullmq";
import prisma from "../database/prisma";
import { StatusSubmissionEnum } from "../generated/prisma/enums";
import { redisConnection } from "../config/redis.config";
import aiService, { AIAPIError } from "../services/ai.service";
import submissionService from "../services/submission.service";
import { Submission } from "../generated/prisma/client";
import reviewService from "../services/review.service";
import notifyService, { EventType } from "../services/notify.service";
import githubWebhookService from "../services/github-webhook.service";
import billingService from "../services/billing.service";
import apiKeyService from "../services/api-key.service";
import { UsageLimitReachedError } from "../services/billing.utils";

type WorkerFailureCode =
    | "NO_API_KEY"
    | "INVALID_KEY"
    | "LIMIT_REACHED"
    | "PROVIDER_ERROR";

class WorkerProcessingError extends Error {
    constructor(
        public readonly code: WorkerFailureCode,
        message: string
    ) {
        super(message);
        this.name = "WorkerProcessingError";
    }
}

class SubmissionWorker {
    private queue: Queue;
    private worker: Worker;

    constructor() {
        this.queue = new Queue("submission", { connection: redisConnection });
        
        this.worker = new Worker("submission", this.process.bind(this), { 
            connection: redisConnection 
        });
    }

    async process(job: Job) {
        const submissionId = job.data.submission.id;
        const startedAt = Date.now();
        let activeApiKeyId: string | null = null;
        let activeProvider: string | null = null;
        let currentSubmission: Awaited<ReturnType<typeof prisma.submission.findUnique>> = null;

        try {
            console.log(`[Worker] Processing submission: ${submissionId}`);
            const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
            if (!submission) throw new Error("Submission not found");
            currentSubmission = submission;

            const activeApiKey = await apiKeyService.getActiveApiKeyForUser(submission.userId);
            if (!activeApiKey) {
                throw new WorkerProcessingError(
                    "NO_API_KEY",
                    "No active API key found. Configure your key in /dashboard/settings/api-keys"
                );
            }

            activeApiKeyId = activeApiKey.id;
            activeProvider = activeApiKey.provider;

            const codeContentJson = JSON.stringify(submission.codeContent);

            const reviewData = await aiService.generateAnalysisStream(
                codeContentJson,
                submission.submissionMode,
                (chunk) => {
                    notifyService.notify(submissionId, {
                        type: EventType.PROCESSING,
                        data: { chunk }
                    });
                },
                { apiKey: activeApiKey.plainKey, provider: activeApiKey.provider }
            );
            
            const newReview = await reviewService.createReview({
                submissionId: submission.id,
                summary: reviewData.summary,
                detectedIssues: reviewData.detectedIssues,
                suggestedChanges: reviewData.suggestedChanges
            });

            if (!newReview) throw new Error("Review not created");
            console.log(`[Worker] Review created: ${newReview.id}`);

            await submissionService.updateSubmissionStatus(submission.id, StatusSubmissionEnum.COMPLETED);

            const baseMetadata =
                currentSubmission?.metadata && typeof currentSubmission.metadata === "object"
                    ? (currentSubmission.metadata as Record<string, unknown>)
                    : {};
            const currentAnalytics =
                baseMetadata.analytics && typeof baseMetadata.analytics === "object"
                    ? (baseMetadata.analytics as Record<string, unknown>)
                    : {};
            const processingMs = Date.now() - startedAt;

            await prisma.submission.update({
                where: { id: submission.id },
                data: {
                    aiProvider: activeApiKey.provider,
                    usedUserKey: true,
                    metadata: {
                        ...baseMetadata,
                        analytics: {
                            ...currentAnalytics,
                            status: "COMPLETED",
                            processingMs,
                            processedAt: new Date().toISOString(),
                            codeLength: submission.codeContent?.length || 0,
                            provider: activeApiKey.provider,
                        },
                    },
                },
            });
            await apiKeyService.markApiKeyAsUsed(activeApiKey.id).catch((usageError) => {
                console.error(`[Worker] Failed to update API key lastUsedAt:`, usageError);
            });
            await billingService.incrementUsage(submission.userId).catch((usageError) => {
                console.error(`[Worker] Failed to increment usage for user ${submission.userId}:`, usageError);
            });

            // notify the client that the review is completed
            notifyService.notify(submission.id, {
                type: EventType.REVIEW_COMPLETED,
                data: { review: newReview }
            }, true);

            // Post review comment to GitHub PR if this submission is from GitHub
            githubWebhookService.postReviewComment(submission.id, newReview).catch((error) => {
                console.error(`[Worker] Failed to post GitHub comment:`, error);
            });

        } catch (error) {
            console.error(`[Worker] Error processing submission ${submissionId}:`, error);
            await submissionService.updateSubmissionStatus(submissionId, StatusSubmissionEnum.FAILED);

            const failure = this.mapFailure(error);
            if (failure.code === "INVALID_KEY" && activeApiKeyId) {
                await apiKeyService.markApiKeyAsInvalid(activeApiKeyId).catch((invalidError) => {
                    console.error(`[Worker] Failed to mark API key as invalid:`, invalidError);
                });
            }

            const baseMetadata =
                currentSubmission?.metadata && typeof currentSubmission.metadata === "object"
                    ? (currentSubmission.metadata as Record<string, unknown>)
                    : {};
            const currentAnalytics =
                baseMetadata.analytics && typeof baseMetadata.analytics === "object"
                    ? (baseMetadata.analytics as Record<string, unknown>)
                    : {};
            const processingMs = Date.now() - startedAt;

            await prisma.submission
                .update({
                    where: { id: submissionId },
                    data: {
                        metadata: {
                            ...baseMetadata,
                            analytics: {
                                ...currentAnalytics,
                                status: "FAILED",
                                processingMs,
                                failedAt: new Date().toISOString(),
                                codeLength: currentSubmission?.codeContent?.length || 0,
                                ...(activeProvider ? { provider: activeProvider } : {}),
                            },
                            workerError: {
                                code: failure.code,
                                message: failure.message,
                                at: new Date().toISOString(),
                            },
                        },
                    },
                })
                .catch((metadataError) => {
                    console.error(`[Worker] Failed to persist worker error metadata:`, metadataError);
                });

            // notify the client that the review failed
            notifyService.notify(submissionId, {
                type: EventType.REVIEW_FAILED,
                data: {
                    error: failure.message,
                    code: failure.code,
                }
            }, true);

            // Mark GitHub Check Run as failed if this submission is from GitHub
            githubWebhookService.markReviewFailed(submissionId, failure.message).catch((err) => {
                console.error(`[Worker] Failed to mark GitHub check as failed:`, err);
            });
        }
    }

    private mapFailure(error: unknown): { code: WorkerFailureCode; message: string } {
        if (error instanceof WorkerProcessingError) {
            return { code: error.code, message: error.message };
        }

        if (error instanceof UsageLimitReachedError) {
            return {
                code: "LIMIT_REACHED",
                message: "Monthly review limit reached (10/10). Upgrade will be available in billing soon.",
            };
        }

        if (error instanceof AIAPIError) {
            if (error.statusCode === 401 || error.statusCode === 403) {
                return {
                    code: "INVALID_KEY",
                    message: "Your API key is invalid or expired. Update it in /dashboard/settings/api-keys.",
                };
            }

            return {
                code: "PROVIDER_ERROR",
                message: error.message || "AI provider error while processing review.",
            };
        }

        return {
            code: "PROVIDER_ERROR",
            message: "An unexpected provider error occurred during review.",
        };
    }

    async processJob(submission: Submission) {
        await this.queue.add("analyze-code", { submission });
    }
}

export default new SubmissionWorker();
