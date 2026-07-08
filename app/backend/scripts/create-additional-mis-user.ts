/**
 * One-off, interactive-free script to create an ADDITIONAL MIS (super-user) account, for use
 * when `bootstrap-admin.ts` refuses because an MIS account already exists (its guard is meant to
 * prevent an accidental *second first-admin* bootstrap, not to cap the org at one MIS account
 * forever). Not registered as an npm script — deliberately not something meant to be rediscovered
 * and run casually; same "no HTTP create-admin route" reasoning as bootstrap-admin.ts applies.
 *
 * Usage:
 *   MIS_EMAIL=... MIS_PASSWORD=... MIS_FIRST_NAME=... MIS_LAST_NAME=... npx tsx scripts/create-additional-mis-user.ts
 */
import 'dotenv/config';
import { PrismaUserRepository } from '../src/modules/identity/infrastructure/PrismaUserRepository';
import { BcryptPasswordHasher } from '../src/modules/identity/infrastructure/BcryptPasswordHasher';
import { PasswordPolicy } from '../src/modules/identity/domain/PasswordPolicy';
import { Email } from '../src/modules/identity/domain/Email';
import { prisma } from '../src/shared/database/prismaClient';

const ADMIN_ROLE_NAME = 'MIS';
const PROVISIONAL_BRANCH_CODE = 'HQ';

async function main(): Promise<void> {
  const userRepository = new PrismaUserRepository();
  const passwordHasher = new BcryptPasswordHasher();

  const rawEmail = process.env.MIS_EMAIL ?? '';
  const emailObj = Email.create(rawEmail);
  if (!emailObj) {
    console.error('Invalid or missing MIS_EMAIL.');
    process.exitCode = 1;
    return;
  }
  const email = emailObj.toString();

  const existing = await userRepository.findByEmail(email);
  if (existing) {
    console.error(`Refusing: a user with email "${email}" already exists.`);
    process.exitCode = 1;
    return;
  }

  const password = process.env.MIS_PASSWORD ?? '';
  const violations = PasswordPolicy.validate(password);
  if (violations.length > 0) {
    console.error(`Password does not meet policy requirements: ${violations.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const branch = await prisma.branch.findUnique({ where: { code: PROVISIONAL_BRANCH_CODE } });
  if (!branch) {
    console.error(`No Branch with code "${PROVISIONAL_BRANCH_CODE}" found. Run "npx prisma db seed" first.`);
    process.exitCode = 1;
    return;
  }

  const firstName = process.env.MIS_FIRST_NAME || 'MIS';
  const lastName = process.env.MIS_LAST_NAME || 'User';
  const passwordHash = await passwordHasher.hash(password);

  const created = await userRepository.create({
    branchId: branch.id,
    email,
    passwordHash,
    firstName,
    lastName,
    roleNames: [ADMIN_ROLE_NAME],
  });

  console.log(`MIS account created: ${created.email} (id ${created.id}).`);
  await prisma.$disconnect();
}

main();
