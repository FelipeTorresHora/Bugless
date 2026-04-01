import { z } from "zod";
import { ulidRule } from "./common.schema";

export enum SubmissionMode {
    PR_DIFF = "PR_DIFF",
    UNCOMMITTED = "UNCOMMITTED",
    COMMIT = "COMMIT",
    CUSTOM = "CUSTOM",
}

export const submissionIdRule = ulidRule;

export type SubmissionIdRule = z.infer<typeof submissionIdRule>;

export const createSubmissionSchema = z.object({
    userId: ulidRule, 
    projectId: ulidRule,
    codeContent: z.string().min(1),
    submissionMode: z.enum(SubmissionMode).optional().default(SubmissionMode.UNCOMMITTED),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateSubmissionSchema = z.infer<typeof createSubmissionSchema>;

export const listSubmissionsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    projectId: ulidRule.optional(),
    status: z.enum(["PENDING", "COMPLETED", "FAILED"]).optional(),
    provider: z.enum(["GEMINI", "OPENAI", "CLAUDE"]).optional(),
});

export type ListSubmissionsQuerySchema = z.infer<typeof listSubmissionsQuerySchema>;

export const getByIdSubmissionSchema = z.object({
    id: submissionIdRule,
});

export type GetByIdSubmissionSchema = z.infer<typeof getByIdSubmissionSchema>;
