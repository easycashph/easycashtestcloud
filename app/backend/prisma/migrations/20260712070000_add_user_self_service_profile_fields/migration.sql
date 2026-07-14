-- Self-service profile fields, editable by staff themselves via PATCH /users/me - distinct from
-- the MIS-only admin fields (email/status/roles/companyId) on the existing PATCH /users/:id.
ALTER TABLE "users" ADD COLUMN "contactNumber" TEXT;
ALTER TABLE "users" ADD COLUMN "address" TEXT;
ALTER TABLE "users" ADD COLUMN "birthday" TIMESTAMP(3);
