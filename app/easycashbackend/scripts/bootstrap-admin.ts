/* eslint-disable no-console */
/**
 * Milestone 6 plan §6.6: guarded, one-time CLI bootstrap for the first
 * MIS (super-user) account. Deliberately NOT an HTTP endpoint — an
 * HTTP "create admin" route must never exist.
 *
 * Refuses to run if any user already holds the MIS role, preventing
 * accidental creation of a second/rogue super-user on re-run.
 *
 * Usage:
 *   BOOTSTRAP_ADMIN_EMAIL=admin@easycash.ph BOOTSTRAP_ADMIN_PASSWORD='...' \
 *     npx tsx scripts/bootstrap-admin.ts
 *
 * Requires `npx prisma db seed` to have already run (needs the seeded
 * "HQ" Branch and "MIS" Role — ADR-005, AUDIT-4, renamed per ADR-038 §1).
 */
import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { prisma } from '../src/shared/database/prismaClient';
import { PrismaUserRepository } from '../src/modules/identity/infrastructure/PrismaUserRepository';
import { BcryptPasswordHasher } from '../src/modules/identity/infrastructure/BcryptPasswordHasher';
import { PasswordPolicy } from '../src/modules/identity/domain/PasswordPolicy';
import { Email } from '../src/modules/identity/domain/Email';

const ADMIN_ROLE_NAME = 'MIS';
const PROVISIONAL_BRANCH_CODE = 'HQ';

async function promptIfMissing(envVar: string, question: string, hidden = false): Promise<string> {
  const fromEnv = process.env[envVar];
  if (fromEnv) return fromEnv;

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = hidden
    ? await rl.question(question) // Node's readline has no built-in mask; acceptable for a one-time local bootstrap script.
    : await rl.question(question);
  rl.close();
  return answer.trim();
}

async function main(): Promise<void> {
  const userRepository = new PrismaUserRepository();
  const passwordHasher = new BcryptPasswordHasher();

  const alreadyExists = await userRepository.hasAnyUserWithRole(ADMIN_ROLE_NAME);
  if (alreadyExists) {
    console.error(
      `Refusing to bootstrap: an "${ADMIN_ROLE_NAME}" account already exists. ` +
        'Use a future User Management flow to add more staff accounts.',
    );
    process.exitCode = 1;
    return;
  }

  const branch = await prisma.branch.findUnique({ where: { code: PROVISIONAL_BRANCH_CODE } });
  if (!branch) {
    console.error(
      `No Branch with code "${PROVISIONAL_BRANCH_CODE}" found. Run "npx prisma db seed" first (ADR-005).`,
    );
    process.exitCode = 1;
    return;
  }

  const rawEmail = await promptIfMissing('BOOTSTRAP_ADMIN_EMAIL', 'MIS account email: ');
  const email = Email.create(rawEmail);
  if (!email) {
    console.error('Invalid email address.');
    process.exitCode = 1;
    return;
  }

  const password = await promptIfMissing('BOOTSTRAP_ADMIN_PASSWORD', 'MIS account password: ', true);
  const violations = PasswordPolicy.validate(password);
  if (violations.length > 0) {
    console.error(`Password does not meet policy requirements: ${violations.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const firstName = (await promptIfMissing('BOOTSTRAP_ADMIN_FIRST_NAME', 'First name: ')) || 'Admin';
  const lastName = (await promptIfMissing('BOOTSTRAP_ADMIN_LAST_NAME', 'Last name: ')) || 'Account';

  const passwordHash = await passwordHasher.hash(password);
  const created = await userRepository.create({
    branchId: branch.id,
    email: email.value,
    passwordHash,
    firstName,
    lastName,
    roleNames: [ADMIN_ROLE_NAME],
  });

  console.log(`MIS account created: ${created.email} (id ${created.id}).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
