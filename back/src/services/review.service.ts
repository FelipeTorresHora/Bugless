import prisma from "../database/prisma";
import { CreateReviewSchema, ReviewIdRule } from "../schemas/review.schema";

class ReviewService {
    async createReview(data: CreateReviewSchema) {
        const review = await prisma.review.create({
            data: {
                submission: { connect: { id: data.submissionId } },
                summary: data.summary,
                detectedIssues: data.detectedIssues,
                suggestedChanges: data.suggestedChanges
            }
        });

        if (!review) {
            return null;
        }

        return review;
    }

    async getReviewById(reviewId: ReviewIdRule, userId: string) {
        return prisma.review.findFirst({
            where: {
                id: reviewId,
                submission: {
                    userId,
                },
            },
            include: {
                submission: {
                    include: {
                        project: true,
                        statusSubmission: true,
                    },
                },
            },
        });
    }
}

export default new ReviewService();
