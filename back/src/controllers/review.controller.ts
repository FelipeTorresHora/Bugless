import { Request, Response } from "express";
import { ZodError, flattenError } from "zod";
import HttpHelper from "../utils/http-helper";
import reviewService from "../services/review.service";
import { reviewIdRule } from "../schemas/review.schema";

class ReviewController {
  async getReviewById(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return HttpHelper.unauthorized(res, "Unauthorized");
      }

      const reviewId = reviewIdRule.parse(req.params.id);
      const review = await reviewService.getReviewById(reviewId, userId);

      if (!review) {
        return HttpHelper.notFound(res, "Review not found");
      }

      return HttpHelper.success(res, review, "Review fetched successfully");
    } catch (error) {
      if (error instanceof ZodError) {
        return HttpHelper.badRequest(res, "Validation error", flattenError(error));
      }
      console.error("Error fetching review:", error);
      return HttpHelper.serverError(res);
    }
  }
}

export default new ReviewController();
