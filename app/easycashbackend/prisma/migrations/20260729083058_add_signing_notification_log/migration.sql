-- CreateEnum
CREATE TYPE "SigningNotificationType" AS ENUM ('LINK', 'OTP');

-- CreateTable
CREATE TABLE "signing_notification_logs" (
    "id" TEXT NOT NULL,
    "loanSigningSessionId" TEXT NOT NULL,
    "loanAccountId" TEXT NOT NULL,
    "type" "SigningNotificationType" NOT NULL,
    "partyType" "SigningPartyType" NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "signing_notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "signing_notification_logs_loanAccountId_idx" ON "signing_notification_logs"("loanAccountId");

-- CreateIndex
CREATE INDEX "signing_notification_logs_loanSigningSessionId_idx" ON "signing_notification_logs"("loanSigningSessionId");

-- AddForeignKey
ALTER TABLE "signing_notification_logs" ADD CONSTRAINT "signing_notification_logs_loanSigningSessionId_fkey" FOREIGN KEY ("loanSigningSessionId") REFERENCES "loan_signing_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signing_notification_logs" ADD CONSTRAINT "signing_notification_logs_loanAccountId_fkey" FOREIGN KEY ("loanAccountId") REFERENCES "loan_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
