import { Request, Response } from "express";
import { flattenError, ZodError } from "zod";
import HttpHelper from "../utils/http-helper";
import analyticsService from "../services/analytics.service";
import { analyticsQuerySchema } from "../schemas/analytics.schema";

class AnalyticsController {
  async getSummary(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return HttpHelper.unauthorized(res, "Unauthorized");
      }

      const query = analyticsQuerySchema.parse(req.query);
      const range = query.range || "30d";
      const summary = await analyticsService.getSummary(userId, range);

      return HttpHelper.success(res, summary, "Analytics fetched successfully");
    } catch (error) {
      if (error instanceof ZodError) {
        return HttpHelper.badRequest(res, "Validation error", flattenError(error));
      }
      console.error("Error fetching analytics summary:", error);
      return HttpHelper.serverError(res);
    }
  }

  async exportCsv(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return HttpHelper.unauthorized(res, "Unauthorized");
      }

      const query = analyticsQuerySchema.parse(req.query);
      const range = query.range || "30d";
      const csv = await analyticsService.exportCsv(userId, range);
      const dateLabel = new Date().toISOString().slice(0, 10);

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="bugless-analytics-${range}-${dateLabel}.csv"`
      );

      return res.status(200).send(csv);
    } catch (error) {
      if (error instanceof ZodError) {
        return HttpHelper.badRequest(res, "Validation error", flattenError(error));
      }
      console.error("Error exporting analytics CSV:", error);
      return HttpHelper.serverError(res);
    }
  }
}

export default new AnalyticsController();
