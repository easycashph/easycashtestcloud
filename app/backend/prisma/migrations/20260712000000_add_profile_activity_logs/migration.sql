-- ADR-050: Profile Activity Timeline — track loan officer actions on profiles

CREATE TYPE "ProfileType" AS ENUM ('LOAN_APPLICATION', 'BORROWER', 'LOAN_ACCOUNT');

CREATE TABLE "profile_activity_logs" (
  "id" TEXT NOT NULL,
  "profileType" "ProfileType" NOT NULL,
  "profileId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "details" JSONB NOT NULL,
  "visibilityRestricted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedByMisAt" TIMESTAMP(3),

  CONSTRAINT "profile_activity_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "profile_activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Indexes for querying activities per profile
CREATE INDEX "profile_activity_logs_profile_idx" ON "profile_activity_logs"("profileType", "profileId");
CREATE INDEX "profile_activity_logs_user_id_idx" ON "profile_activity_logs"("userId");
CREATE INDEX "profile_activity_logs_created_at_idx" ON "profile_activity_logs"("createdAt" DESC);
