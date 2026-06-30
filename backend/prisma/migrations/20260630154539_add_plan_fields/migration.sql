-- AlterTable: adiciona campos de plano/assinatura ao modelo User
ALTER TABLE "User"
  ADD COLUMN "plan"                 TEXT NOT NULL DEFAULT 'TRIAL',
  ADD COLUMN "trialEndsAt"          TIMESTAMP(3),
  ADD COLUMN "planExpiresAt"        TIMESTAMP(3),
  ADD COLUMN "stripeCustomerId"     TEXT,
  ADD COLUMN "stripeSubscriptionId" TEXT;

-- CreateIndex: unicidade dos IDs do Stripe
CREATE UNIQUE INDEX "User_stripeCustomerId_key"     ON "User"("stripeCustomerId");
CREATE UNIQUE INDEX "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");
