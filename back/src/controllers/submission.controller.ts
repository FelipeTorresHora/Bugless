import { Request, Response } from "express";
import {
    createSubmissionSchema,
    listSubmissionsQuerySchema,
    submissionIdRule
} from "../schemas/submission.schema";
import { ZodError, flattenError } from "zod";
import submissionService from "../services/submission.service";
import HttpHelper from "../utils/http-helper";
import notifyService, { EventType } from "../services/notify.service";
import { StatusSubmissionEnum } from "../generated/prisma/enums";

class SubmissionController {
    async createSubmission(req: Request, res: Response){
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return HttpHelper.unauthorized(res, "Unauthorized");
            }

            console.log("\n========================================");
            console.log("[Submission] 📥 Nova submissão recebida");
            console.log("[Submission] User:", req.user?.email);
            console.log("[Submission] Mode:", req.body.submissionMode);
            console.log("[Submission] Code length:", req.body.codeContent?.length || 0, "chars");
            console.log("========================================\n");

            const dataSubmission = createSubmissionSchema.parse({
                ...req.body,
                userId,
            });

            const submission = await submissionService.createSubmission(dataSubmission);

            if (!submission) {
                return HttpHelper.notFound(res, "Submission not found");
            }

            console.log("[Submission] ✅ Criada com ID:", submission.id);
            console.log("[Submission] 📤 Enviando para fila de processamento...\n");

            return HttpHelper.created(res, submission, "Submission created successfully");
        } catch (error) {
            console.error("[Submission] ❌ Erro completo:");
            console.error(error);
            if (error instanceof ZodError) {
                return HttpHelper.badRequest(res, "Validation error", flattenError(error));
            }
            if (error instanceof Error) {
                return HttpHelper.serverError(res, error.message);
            }
            return HttpHelper.serverError(res);
        }
    }

    async listSubmissions(req: Request, res: Response) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return HttpHelper.unauthorized(res, "Unauthorized");
            }

            const query = listSubmissionsQuerySchema.parse(req.query);
            const response = await submissionService.listSubmissions(userId, query);

            return HttpHelper.success(res, response, "Submissions fetched successfully");
        } catch (error) {
            if (error instanceof ZodError) {
                return HttpHelper.badRequest(res, "Validation error", flattenError(error));
            }
            console.error("[Submission] ❌ Error listing submissions:", error);
            return HttpHelper.serverError(res);
        }
    }


    async getSubmissionById(req: Request, res: Response){
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return HttpHelper.unauthorized(res, "Unauthorized");
            }

            const submissionId = submissionIdRule.parse(req.params.id);

            const submission = await submissionService.getSubmissionById(submissionId, userId);

            if (!submission) {
                return HttpHelper.notFound(res, "Submission not found");
            }

            return HttpHelper.success(res, submission, "Submission fetched successfully");
        } catch (error) {
            if (error instanceof ZodError) {
                return HttpHelper.badRequest(res, "Validation error", flattenError(error));
            }
            return HttpHelper.serverError(res);
        }
    }

    async getSubmissionEvents(req: Request, res: Response) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return HttpHelper.unauthorized(res, "Unauthorized");
            }

            const submissionId = submissionIdRule.parse(req.params.id);
            console.log("[SSE] 🔌 Cliente conectado para submission:", submissionId);

            const submission = await submissionService.getSubmissionById(submissionId, userId);

            // if the submission is completed, send SSE event immediately and close
            if (submission && submission.statusSubmission === StatusSubmissionEnum.COMPLETED) {
                console.log("[SSE] ✅ Review já completo, enviando via SSE imediatamente");

                // Set up SSE headers
                notifyService.setupHeaders(res);

                // Send completed event in SSE format
                notifyService.sendEvent(res, {
                    type: EventType.REVIEW_COMPLETED,
                    data: { review: submission.review }
                });

                // Close connection
                res.end();
                return;
            }

            if (submission && submission.statusSubmission === StatusSubmissionEnum.FAILED) {
                console.log("[SSE] ❌ Review já falhou, enviando erro via SSE imediatamente");

                const workerError =
                    submission.metadata &&
                    typeof submission.metadata === "object" &&
                    "workerError" in submission.metadata
                        ? (submission.metadata as Record<string, any>).workerError
                        : null;

                notifyService.setupHeaders(res);
                notifyService.sendEvent(res, {
                    type: EventType.REVIEW_FAILED,
                    data: {
                        error: workerError?.message ?? "An error occurred during review",
                        code: workerError?.code ?? "PROVIDER_ERROR",
                    },
                });
                res.end();
                return;
            }

            console.log("[SSE] ⏳ Aguardando processamento...");
            // if the submission is not completed, add the client to the queue
            notifyService.addClient(submissionId, res);
        } catch (error) {
            console.error("[SSE] ❌ Erro:", error);
            if (error instanceof ZodError) {
                res.status(400).json({ error: "Invalid submission ID" });
                return;
            }
            res.status(500).end();
        }
    }
}

export default new SubmissionController();
