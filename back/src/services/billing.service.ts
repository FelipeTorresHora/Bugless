import prisma from "../database/prisma";
import { SubscriptionPlan, SubscriptionStatus } from "../generated/prisma/enums";
import {
  assertUsageWithinLimit,
  calculateRemainingReviews,
  getMonthlyPeriod,
  incrementReviewsCount,
  isUnlimitedLimit,
  resolveReviewsLimit,
  UsageSnapshot,
  UsageLimitReachedError,
} from "./billing.utils";

type CurrentUsageState = UsageSnapshot & {
  usageMetricId: string;
};

class BillingService {
  private async ensureSubscription(userId: string, referenceDate: Date) {
    const period = getMonthlyPeriod(referenceDate);

    return prisma.subscription.upsert({
      where: { userId },
      update: {
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
      },
      create: {
        userId,
        plan: SubscriptionPlan.FREE,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
      },
    });
  }

  private async ensureUsageMetric(
    userId: string,
    subscriptionId: string,
    plan: SubscriptionPlan,
    referenceDate: Date
  ) {
    const period = getMonthlyPeriod(referenceDate);
    const reviewsLimit = resolveReviewsLimit(plan);

    return prisma.usageMetric.upsert({
      where: {
        userId_periodStart: {
          userId,
          periodStart: period.start,
        },
      },
      update: {
        subscriptionId,
        periodEnd: period.end,
        reviewsLimit,
      },
      create: {
        userId,
        subscriptionId,
        periodStart: period.start,
        periodEnd: period.end,
        reviewsCount: 0,
        reviewsLimit,
      },
    });
  }

  private buildUsageState(params: {
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    usageMetricId: string;
    reviewsCount: number;
    reviewsLimit: number;
    periodStart: Date;
    periodEnd: Date;
  }): CurrentUsageState {
    const isUnlimited = isUnlimitedLimit(params.reviewsLimit);

    return {
      plan: params.plan,
      status: params.status,
      usageMetricId: params.usageMetricId,
      reviewsCount: params.reviewsCount,
      reviewsLimit: params.reviewsLimit,
      isUnlimited,
      remainingReviews: calculateRemainingReviews(
        params.reviewsCount,
        params.reviewsLimit
      ),
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
    };
  }

  private toUsageSnapshot(usage: CurrentUsageState): UsageSnapshot {
    const { usageMetricId, ...snapshot } = usage;
    return snapshot;
  }

  private async getCurrentUsageState(
    userId: string,
    referenceDate: Date = new Date()
  ): Promise<CurrentUsageState> {
    const subscription = await this.ensureSubscription(userId, referenceDate);
    const usageMetric = await this.ensureUsageMetric(
      userId,
      subscription.id,
      subscription.plan,
      referenceDate
    );

    return this.buildUsageState({
      plan: subscription.plan,
      status: subscription.status,
      usageMetricId: usageMetric.id,
      reviewsCount: usageMetric.reviewsCount,
      reviewsLimit: usageMetric.reviewsLimit,
      periodStart: usageMetric.periodStart,
      periodEnd: usageMetric.periodEnd,
    });
  }

  async getCurrentUsage(userId: string, referenceDate: Date = new Date()) {
    const usage = await this.getCurrentUsageState(userId, referenceDate);
    return this.toUsageSnapshot(usage);
  }

  async getCurrentSubscription(userId: string, referenceDate: Date = new Date()) {
    const usage = await this.getCurrentUsageState(userId, referenceDate);
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    return {
      id: subscription.id,
      plan: subscription.plan,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodStart: usage.periodStart,
      currentPeriodEnd: usage.periodEnd,
      reviewsLimit: usage.reviewsLimit,
      isUnlimited: usage.isUnlimited,
    };
  }

  async checkAndEnforceLimit(
    userId: string,
    referenceDate: Date = new Date()
  ): Promise<UsageSnapshot> {
    const usage = await this.getCurrentUsageState(userId, referenceDate);
    const snapshot = this.toUsageSnapshot(usage);
    assertUsageWithinLimit(snapshot);
    return snapshot;
  }

  async incrementUsage(userId: string, referenceDate: Date = new Date()) {
    const usage = await this.getCurrentUsageState(userId, referenceDate);
    const snapshot = this.toUsageSnapshot(usage);
    assertUsageWithinLimit(snapshot);

    if (usage.isUnlimited) {
      const updatedUsage = await prisma.usageMetric.update({
        where: { id: usage.usageMetricId },
        data: { reviewsCount: { increment: 1 } },
      });

      return this.toUsageSnapshot(
        this.buildUsageState({
          plan: usage.plan,
          status: usage.status,
          usageMetricId: updatedUsage.id,
          reviewsCount: updatedUsage.reviewsCount,
          reviewsLimit: updatedUsage.reviewsLimit,
          periodStart: updatedUsage.periodStart,
          periodEnd: updatedUsage.periodEnd,
        })
      );
    }

    const updated = await prisma.usageMetric.updateMany({
      where: {
        id: usage.usageMetricId,
        reviewsCount: { lt: usage.reviewsLimit },
      },
      data: {
        reviewsCount: { increment: 1 },
      },
    });

    if (!updated.count) {
      const latestUsage = await this.getCurrentUsage(userId, referenceDate);
      throw new UsageLimitReachedError(latestUsage);
    }

    return this.toUsageSnapshot({
      ...usage,
      reviewsCount: incrementReviewsCount(usage.reviewsCount),
      remainingReviews: calculateRemainingReviews(
        incrementReviewsCount(usage.reviewsCount),
        usage.reviewsLimit
      ),
    });
  }
}

export default new BillingService();
