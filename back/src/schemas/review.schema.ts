import { z } from "zod";
import { submissionIdRule } from "./submission.schema";
import { ulidRule } from "./common.schema";

export const createReviewSchema = z.object({
    submissionId: submissionIdRule,
    summary: z.string(),
    detectedIssues: z.string(),
    suggestedChanges: z.string(),
});

export type CreateReviewSchema = z.infer<typeof createReviewSchema>;

export const reviewIdRule = ulidRule;

export type ReviewIdRule = z.infer<typeof reviewIdRule>;

