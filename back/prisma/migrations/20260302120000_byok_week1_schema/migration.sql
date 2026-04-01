-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('GEMINI', 'OPENAI', 'CLAUDE');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PRO');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELED', 'PAST_DUE', 'TRIALING');

-- DropForeignKey
ALTER TABLE "plan" DROP CONSTRAINT "plan_id_status_plan_fkey";

-- DropForeignKey
ALTER TABLE "subscription" DROP CONSTRAINT "subscription_id_plan_fkey";

-- AlterTable
ALTER TABLE "submission" ADD COLUMN     "ai_provider" "AiProvider",
ADD COLUMN     "used_user_key" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "subscription" DROP COLUMN "end_date",
DROP COLUMN "id_plan",
DROP COLUMN "price",
DROP COLUMN "start_date",
ADD COLUMN     "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "current_period_end" TIMESTAMP(3),
ADD COLUMN     "current_period_start" TIMESTAMP(3),
ADD COLUMN     "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "stripe_customer_id" TEXT,
ADD COLUMN     "stripe_price_id" TEXT,
ADD COLUMN     "stripe_subscription_id" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE';

-- DropTable
DROP TABLE "plan";

-- DropTable
DROP TABLE "status_plan";

-- CreateTable
CREATE TABLE "usage_metric" (
    "id" TEXT NOT NULL,
    "id_user" TEXT NOT NULL,
    "id_subscription" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "reviews_count" INTEGER NOT NULL DEFAULT 0,
    "reviews_limit" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_metric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_key" (
    "id" TEXT NOT NULL,
    "id_user" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "encrypted_key" TEXT NOT NULL,
    "key_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_valid" BOOLEAN NOT NULL DEFAULT true,
    "last_validated_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_key_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usage_metric_id_user_period_start_idx" ON "usage_metric"("id_user", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "usage_metric_id_user_period_start_key" ON "usage_metric"("id_user", "period_start");

-- CreateIndex
CREATE INDEX "api_key_id_user_idx" ON "api_key"("id_user");

-- CreateIndex
CREATE UNIQUE INDEX "api_key_id_user_provider_key" ON "api_key"("id_user", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_id_user_key" ON "subscription"("id_user");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_stripe_customer_id_key" ON "subscription"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_stripe_subscription_id_key" ON "subscription"("stripe_subscription_id");

-- AddForeignKey
ALTER TABLE "usage_metric" ADD CONSTRAINT "usage_metric_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_metric" ADD CONSTRAINT "usage_metric_id_subscription_fkey" FOREIGN KEY ("id_subscription") REFERENCES "subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
