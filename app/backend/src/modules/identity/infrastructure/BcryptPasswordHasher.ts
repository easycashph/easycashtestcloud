import bcrypt from 'bcrypt';
import type { IPasswordHasher } from '../application/ports/IPasswordHasher';

/** Milestone 6 plan §4: bcrypt, cost factor 12 (CLAUDE.md mandates bcrypt for password hashing). */
const COST_FACTOR = 12;

export class BcryptPasswordHasher implements IPasswordHasher {
  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, COST_FACTOR);
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
