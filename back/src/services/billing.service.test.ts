import assert from "node:assert/strict";
import { SubscriptionPlan, SubscriptionStatus } from "../generated/prisma/enums";
import {
  assertUsageWithinLimit,
  FREE_REVIEWS_LIMIT,
  getMonthlyPeriod,
  incrementReviewsCount,
} from "./billing.utils";

function runBillingServiceTests(): void {
  const period = getMonthlyPeriod(new Date("2026-03-15T10:20:30.000Z"));

  assert.equal(
    period.start.toISOString(),
    "2026-03-01T00:00:00.000Z",
    "period must start on first day of month in UTC"
  );
  assert.equal(
    period.end.toISOString(),
    "2026-04-01T00:00:00.000Z",
    "period must end on first day of next month in UTC"
  );

  assert.equal(
    incrementReviewsCount(9),
    10,
    "increment helper must advance usage counter by 1"
  );

  assert.doesNotThrow(
    () =>
      assertUsageWithinLimit({
        plan: SubscriptionPlan.FREE,
        status: SubscriptionStatus.ACTIVE,
        reviewsCount: FREE_REVIEWS_LIMIT - 1,
        reviewsLimit: FREE_REVIEWS_LIMIT,
        remainingReviews: 1,
        isUnlimited: false,
        periodStart: period.start,
        periodEnd: period.end,
      }),
    "free users below monthly limit must pass validation"
  );

  assert.throws(
    () =>
      assertUsageWithinLimit({
        plan: SubscriptionPlan.FREE,
        status: SubscriptionStatus.ACTIVE,
        reviewsCount: FREE_REVIEWS_LIMIT,
        reviewsLimit: FREE_REVIEWS_LIMIT,
        remainingReviews: 0,
        isUnlimited: false,
        periodStart: period.start,
        periodEnd: period.end,
      }),
    /Monthly review limit reached/,
    "free users at 10/10 must be blocked"
  );
}

runBillingServiceTests();
console.log("billing.service tests: ok");
