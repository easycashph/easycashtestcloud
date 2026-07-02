import { describe, expect, it } from 'vitest';
import { BcryptPasswordHasher } from '@modules/identity/infrastructure/BcryptPasswordHasher';

describe('BcryptPasswordHasher', () => {
  const hasher = new BcryptPasswordHasher();

  it('round-trips: hash then compare succeeds for the correct password', async () => {
    const hash = await hasher.hash('correct horse battery staple');
    await expect(hasher.compare('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password against a real hash', async () => {
    const hash = await hasher.hash('correct horse battery staple');
    await expect(hasher.compare('wrong password', hash)).resolves.toBe(false);
  });

  it('produces a well-formed bcrypt hash (used as the fixed dummy-hash constant in LoginUseCase)', async () => {
    const hash = await hasher.hash('anything');
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$.{53}$/);
  });

  it('the hard-coded LoginUseCase DUMMY_HASH is a valid, comparable bcrypt hash', async () => {
    // Regression guard for the exact constant embedded in LoginUseCase —
    // if it were malformed, bcrypt.compare would throw instead of
    // returning false, breaking the timing-attack mitigation.
    const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO0Ku4CU9jGkxN.zn.b3F2hAtBcqfNjGO';
    await expect(hasher.compare('anything', DUMMY_HASH)).resolves.toBe(false);
  });
});
