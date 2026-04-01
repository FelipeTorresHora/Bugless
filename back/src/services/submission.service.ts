import prisma from "../database/prisma";
import {
    CreateSubmissionSchema,
    ListSubmissionsQuerySchema,
    SubmissionIdRule
} from "../schemas/submission.schema";
import { StatusSubmissionEnum, SubmissionModeEnum, AiProvider } from "../generated/prisma/enums";
import submissionWorker from "../workers/submission.worker"
import statusSubmissionService from "./status-submission.service";

class SubmissionService {
    private countMatches(source: string | null | undefined, pattern: RegExp): number {
        if (!source) return 0;
        const matches = source.match(pattern);
        return matches ? matches.length : 0;
    }

    private deriveIssueStats(detectedIssues: string | null | undefined) {
        const total =
            this.countMatches(detectedIssues, /\[!!\]|\[!\]|\[\*\]|\[i\]|^-|\*/gim) ||
            this.countMatches(detectedIssues, /\n/gm);

        return {
            totalIssues: total,
            securityIssues: this.countMatches(
                detectedIssues,
                /security|xss|sql|injection|token|credential|auth/i
            ),
            performanceIssues: this.countMatches(
                detectedIssues,
                /performance|slow|latency|memory|cache|cpu|n\+1/i
            ),
        };
    }

    private mapSubmissionModeToView(mode: SubmissionModeEnum) {
        switch (mode) {
            case SubmissionModeEnum.PR_DIFF:
                return "pr";
            case SubmissionModeEnum.UNCOMMITTED:
                return "uncommitted";
            case SubmissionModeEnum.COMMIT:
                return "commit";
            case SubmissionModeEnum.CUSTOM:
                return "custom";
            default:
                return "custom";
        }
    }

    private mapStatusToView(status: StatusSubmissionEnum) {
        switch (status) {
            case StatusSubmissionEnum.COMPLETED:
                return "completed";
            case StatusSubmissionEnum.FAILED:
                return "failed";
            case StatusSubmissionEnum.PENDING:
            default:
                return "in_progress";
        }
    }

    private mapSubmissionToListItem(submission: any) {
        const review = submission.reviews?.[0] ?? null;
        const issueStats = this.deriveIssueStats(review?.detectedIssues);
        const metadata = (submission.metadata && typeof submission.metadata === "object")
            ? submission.metadata as Record<string, any>
            : {};

        const processingMs = metadata.analytics?.processingMs;

        return {
            id: submission.id,
            reviewId: review?.id ?? null,
            title:
                review?.summary?.split("\n")[0] ||
                `Review ${submission.id.slice(0, 8)}`,
            repository:
                submission.project?.repositoryUrl ||
                submission.project?.name ||
                "unknown-repo",
            branch:
                metadata.baseBranch ||
                metadata.branch ||
                "default",
            status: this.mapStatusToView(submission.statusSubmission.name),
            mode: this.mapSubmissionModeToView(submission.submissionMode),
            preset: metadata.preset || "standard",
            issuesFound: issueStats.totalIssues,
            securityIssues: issueStats.securityIssues,
            performanceIssues: issueStats.performanceIssues,
            reviewTime: typeof processingMs === "number" ? `${(processingMs / 1000).toFixed(1)}s` : "-",
            createdAt: submission.createdAt,
            provider: submission.aiProvider,
            projectId: submission.projectId,
        };
    }

    async createSubmission(data: CreateSubmissionSchema) {
        const pendingStatus = await statusSubmissionService.getOrCreateStatusByName(
            StatusSubmissionEnum.PENDING
        );

        const submission = await prisma.submission.create({
            data: {
                codeContent: data.codeContent,
                submissionMode: data.submissionMode as SubmissionModeEnum,
                metadata: data.metadata,
                user: { connect: { id: data.userId } },
                project: { connect: { id: data.projectId } },
                statusSubmission: { connect: { id: pendingStatus.id } }
            }   
        });

        submissionWorker.processJob(submission);

        return submission;
    }

    async getSubmissionById(submissionData: SubmissionIdRule, userId?: string){
        const submission = await prisma.submission.findUnique({
            where: { id: submissionData },
            include: {
                statusSubmission: true,
                reviews: true,
                project: true,
            }
        });

        if (!submission) {
            return null;
        }

        if (userId && submission.userId !== userId) {
            return null;
        }

        const { statusSubmissionId, statusSubmission, reviews, ...submissionRest } = submission;

        const submissionResponse = {
            ...submissionRest,
            statusSubmission: statusSubmission.name,
            review: statusSubmission.name === StatusSubmissionEnum.COMPLETED ? (reviews[0] ?? null) : null
        }

        return submissionResponse;
    }

    async listSubmissions(userId: string, query: ListSubmissionsQuerySchema) {
        const where = {
            userId,
            ...(query.projectId ? { projectId: query.projectId } : {}),
            ...(query.status ? { statusSubmission: { name: query.status as StatusSubmissionEnum } } : {}),
            ...(query.provider ? { aiProvider: query.provider as AiProvider } : {}),
        };

        const [total, submissions] = await Promise.all([
            prisma.submission.count({ where }),
            prisma.submission.findMany({
                where,
                include: {
                    statusSubmission: true,
                    reviews: {
                        orderBy: { createdAt: "desc" },
                        take: 1,
                    },
                    project: true,
                },
                orderBy: { createdAt: "desc" },
                skip: (query.page - 1) * query.limit,
                take: query.limit,
            }),
        ]);

        return {
            items: submissions.map((submission) => this.mapSubmissionToListItem(submission)),
            pagination: {
                page: query.page,
                limit: query.limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / query.limit)),
            },
        };
    }

    async updateSubmissionStatus(submissionId: string, status: StatusSubmissionEnum) {
        const statusRecord = await statusSubmissionService.getOrCreateStatusByName(status);

        return await prisma.submission.update({
            where: { id: submissionId },
            data: { statusSubmissionId: statusRecord.id }
        });
    }
}

export default new SubmissionService();
