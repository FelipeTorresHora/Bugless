import prisma from "../database/prisma";
import { StatusSubmissionEnum } from "../generated/prisma/enums";

type AnalyticsRange = "7d" | "30d" | "90d";

function getRangeDays(range: AnalyticsRange): number {
  switch (range) {
    case "7d":
      return 7;
    case "90d":
      return 90;
    case "30d":
    default:
      return 30;
  }
}

class AnalyticsService {
  private countMatches(source: string | null | undefined, pattern: RegExp): number {
    if (!source) return 0;
    const matches = source.match(pattern);
    return matches ? matches.length : 0;
  }

  private parseIssueLines(detectedIssues: string | null | undefined): string[] {
    if (!detectedIssues) return [];
    return detectedIssues
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => line.replace(/^[-*]\s*/, ""))
      .filter((line) => line.length >= 4);
  }

  private getRangeStartDate(range: AnalyticsRange): Date {
    const now = new Date();
    const days = getRangeDays(range);
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  private extractProcessingMs(metadata: unknown): number | null {
    if (!metadata || typeof metadata !== "object") return null;
    const value = (metadata as Record<string, any>)?.analytics?.processingMs;
    return typeof value === "number" ? value : null;
  }

  private getDateLabel(date: Date): string {
    return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
  }

  async getSummary(userId: string, range: AnalyticsRange = "30d") {
    const startDate = this.getRangeStartDate(range);

    const submissions = await prisma.submission.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
      include: {
        statusSubmission: true,
        reviews: true,
        project: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const total = submissions.length;
    const completed = submissions.filter(
      (submission) => submission.statusSubmission.name === StatusSubmissionEnum.COMPLETED
    ).length;
    const failed = submissions.filter(
      (submission) => submission.statusSubmission.name === StatusSubmissionEnum.FAILED
    ).length;
    const inProgress = submissions.filter(
      (submission) => submission.statusSubmission.name === StatusSubmissionEnum.PENDING
    ).length;

    const processed = completed + failed;
    const successRate = processed > 0 ? Number(((completed / processed) * 100).toFixed(1)) : 0;
    const failureRate = processed > 0 ? Number(((failed / processed) * 100).toFixed(1)) : 0;

    const processingValues = submissions
      .map((submission) => this.extractProcessingMs(submission.metadata))
      .filter((value): value is number => value !== null);
    const avgProcessingMs = processingValues.length
      ? Math.round(processingValues.reduce((acc, value) => acc + value, 0) / processingValues.length)
      : 0;

    const codeVolume = submissions.reduce(
      (acc, submission) => acc + (submission.codeContent?.length || 0),
      0
    );

    const activityMap = new Map<string, { date: string; reviews: number; bugs: number }>();
    const issueCategoryMap = new Map<string, number>([
      ["Bugs", 0],
      ["Security", 0],
      ["Performance", 0],
      ["Style", 0],
    ]);
    const topIssuesMap = new Map<string, number>();

    for (const submission of submissions) {
      const label = this.getDateLabel(submission.createdAt);
      const current = activityMap.get(label) || { date: label, reviews: 0, bugs: 0 };
      current.reviews += 1;

      const review = submission.reviews[0];
      if (review?.detectedIssues) {
        const bugsCount = this.countMatches(review.detectedIssues, /\[!!\]|\[!\]|bug|error|fail|issue/gi);
        current.bugs += bugsCount;

        issueCategoryMap.set(
          "Security",
          (issueCategoryMap.get("Security") || 0) +
            this.countMatches(review.detectedIssues, /security|xss|sql|injection|token|credential|auth/gi)
        );
        issueCategoryMap.set(
          "Performance",
          (issueCategoryMap.get("Performance") || 0) +
            this.countMatches(review.detectedIssues, /performance|slow|latency|memory|cache|cpu|n\+1/gi)
        );
        issueCategoryMap.set(
          "Style",
          (issueCategoryMap.get("Style") || 0) +
            this.countMatches(review.detectedIssues, /style|format|lint|naming|refactor/gi)
        );
        issueCategoryMap.set(
          "Bugs",
          (issueCategoryMap.get("Bugs") || 0) +
            this.countMatches(review.detectedIssues, /bug|error|issue|null|undefined|race|exception/gi)
        );

        const issueLines = this.parseIssueLines(review.detectedIssues);
        for (const line of issueLines) {
          const normalized = line.slice(0, 96);
          topIssuesMap.set(normalized, (topIssuesMap.get(normalized) || 0) + 1);
        }
      }

      activityMap.set(label, current);
    }

    const activity = Array.from(activityMap.values());
    const issuesByType = Array.from(issueCategoryMap.entries()).map(([type, count]) => ({
      type,
      count,
      color:
        type === "Bugs"
          ? "#ef4444"
          : type === "Security"
          ? "#f59e0b"
          : type === "Performance"
          ? "#8b5cf6"
          : "#6b7280",
    }));

    const topIssues = Array.from(topIssuesMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([type, count], index) => ({
        id: `${index + 1}`,
        type,
        count,
        category: /security|xss|sql|injection|token|credential|auth/i.test(type)
          ? "security"
          : /performance|slow|latency|memory|cache|cpu|n\+1/i.test(type)
          ? "performance"
          : /style|format|lint|naming|refactor/i.test(type)
          ? "style"
          : "bug",
      }));

    const repositoryMap = new Map<
      string,
      { repo: string; reviews: number; bugs: number; security: number; performance: number }
    >();

    for (const submission of submissions) {
      const key = submission.project.repositoryUrl || submission.project.name;
      const repository =
        repositoryMap.get(key) || {
          repo: key,
          reviews: 0,
          bugs: 0,
          security: 0,
          performance: 0,
        };

      repository.reviews += 1;
      const detectedIssues = submission.reviews[0]?.detectedIssues;
      repository.bugs += this.countMatches(detectedIssues, /bug|error|issue|null|undefined|race|exception/gi);
      repository.security += this.countMatches(detectedIssues, /security|xss|sql|injection|token|credential|auth/gi);
      repository.performance += this.countMatches(detectedIssues, /performance|slow|latency|memory|cache|cpu|n\+1/gi);

      repositoryMap.set(key, repository);
    }

    const repositoryStats = Array.from(repositoryMap.values()).sort((a, b) => b.reviews - a.reviews);

    const kpis = [
      {
        id: "total-reviews",
        title: "Total Reviews",
        value: total,
        trend: successRate,
        trendDirection: successRate >= 50 ? "up" : "down",
        icon: "code",
        trendIsPositive: successRate >= 50,
      },
      {
        id: "bugs-caught",
        title: "Bugs Caught",
        value: issuesByType.find((issue) => issue.type === "Bugs")?.count || 0,
        trend: failureRate,
        trendDirection: failureRate > 20 ? "up" : "down",
        icon: "bug",
        trendIsPositive: failureRate <= 20,
      },
      {
        id: "avg-review-time",
        title: "Avg Review Time",
        value: `${(avgProcessingMs / 1000).toFixed(1)}s`,
        trend: avgProcessingMs > 20000 ? 10 : 5,
        trendDirection: avgProcessingMs > 20000 ? "up" : "down",
        icon: "clock",
        trendIsPositive: avgProcessingMs <= 20000,
      },
      {
        id: "security-issues",
        title: "Security Issues",
        value: issuesByType.find((issue) => issue.type === "Security")?.count || 0,
        trend: 8.5,
        trendDirection: "down",
        icon: "shield",
        trendIsPositive: true,
      },
    ];

    return {
      range,
      summary: {
        total,
        completed,
        failed,
        inProgress,
        successRate,
        failureRate,
        avgProcessingMs,
        codeVolume,
      },
      kpis,
      activity,
      issuesByType,
      topIssues,
      repositoryStats,
    };
  }

  async exportCsv(userId: string, range: AnalyticsRange = "30d") {
    const startDate = this.getRangeStartDate(range);

    const submissions = await prisma.submission.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
      include: {
        statusSubmission: true,
        project: true,
        reviews: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const headers = [
      "submission_id",
      "created_at",
      "status",
      "provider",
      "project",
      "code_length",
      "processing_ms",
      "summary",
    ];

    const rows = submissions.map((submission) => {
      const processingMs = this.extractProcessingMs(submission.metadata);
      const summary = submission.reviews[0]?.summary || "";
      const fields = [
        submission.id,
        submission.createdAt.toISOString(),
        submission.statusSubmission.name,
        submission.aiProvider || "",
        submission.project.repositoryUrl || submission.project.name,
        String(submission.codeContent?.length || 0),
        processingMs !== null ? String(processingMs) : "",
        summary.replace(/"/g, '""'),
      ];

      return `"${fields.join('","')}"`;
    });

    return [headers.join(","), ...rows].join("\n");
  }
}

export default new AnalyticsService();
