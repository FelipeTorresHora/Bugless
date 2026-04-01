import { SubscriptionPlan, SubscriptionStatus } from "../generated/prisma/enums";

export const FREE_REVIEWS_LIMIT = 10;
export const UNLIMITED_REVIEWS_LIMIT = -1;

export type BillingPeriod = {
  start: Date;
  end: Date;
};

export type UsageSnapshot = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  reviewsCount: number;
  reviewsLimit: number;
  remainingReviews: number | null;
  isUnlimited: boolean;
  periodStart: Date;
  periodEnd: Date;
};

export class UsageLimitReachedError extends Error {
  readonly code = "USAGE_LIMIT_REACHED" as const;
  readonly statusCode = 429;

  constructor(public readonly usage: UsageSnapshot) {
    super("Monthly review limit reached for FREE plan");
    this.name = "UsageLimitReachedError";
  }
}

export function getMonthlyPeriod(referenceDate: Date = new Date()): BillingPeriod {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();

  return {
    start: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0)),
  };
}

export function resolveReviewsLimit(plan: SubscriptionPlan): number {
  return plan === SubscriptionPlan.PRO ? UNLIMITED_REVIEWS_LIMIT : FREE_REVIEWS_LIMIT;
}

export function isUnlimitedLimit(reviewsLimit: number): boolean {
  return reviewsLimit === UNLIMITED_REVIEWS_LIMIT;
}

export function incrementReviewsCount(reviewsCount: number): number {
  return reviewsCount + 1;
}

export function calculateRemainingReviews(
  reviewsCount: number,
  reviewsLimit: number
): number | null {
  if (isUnlimitedLimit(reviewsLimit)) {
    return null;
  }

  return Math.max(reviewsLimit - reviewsCount, 0);
}

export function hasReachedUsageLimit(
  reviewsCount: number,
  reviewsLimit: number
): boolean {
  if (isUnlimitedLimit(reviewsLimit)) {
    return false;
  }

  return reviewsCount >= reviewsLimit;
}

export function assertUsageWithinLimit(usage: UsageSnapshot): void {
  if (usage.plan === SubscriptionPlan.PRO) {
    return;
  }

  if (hasReachedUsageLimit(usage.reviewsCount, usage.reviewsLimit)) {
    throw new UsageLimitReachedError(usage);
  }
}
