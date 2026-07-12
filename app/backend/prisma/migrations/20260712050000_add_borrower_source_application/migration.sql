-- Links a Borrower back to the LoanApplication it was created from via "Create Client Profile",
-- so the application detail page can tell a client already exists for it and stop offering to
-- create a duplicate. One application can produce at most one borrower (unique).
ALTER TABLE "borrowers" ADD COLUMN "sourceApplicationId" TEXT;

CREATE UNIQUE INDEX "borrowers_sourceApplicationId_key" ON "borrowers"("sourceApplicationId");

ALTER TABLE "borrowers" ADD CONSTRAINT "borrowers_sourceApplicationId_fkey"
  FOREIGN KEY ("sourceApplicationId") REFERENCES "loan_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
