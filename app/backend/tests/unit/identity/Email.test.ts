import { describe, expect, it } from 'vitest';
import { Email } from '@modules/identity/domain/Email';

describe('Email (audit finding H-02: single source of truth for normalization)', () => {
  describe('normalize', () => {
    it('trims and lowercases without validating format', () => {
      expect(Email.normalize('  Officer@EasyCash.PH  ')).toBe('officer@easycash.ph');
      // No format validation — normalize() alone accepts garbage input.
      expect(Email.normalize('  NOT-AN-EMAIL  ')).toBe('not-an-email');
    });
  });

  describe('create', () => {
    it('normalizes casing and whitespace for a valid email', () => {
      const email = Email.create('  Officer@EasyCash.PH  ');
      expect(email?.value).toBe('officer@easycash.ph');
    });

    it('returns null for an invalid format', () => {
      expect(Email.create('not-an-email')).toBeNull();
      expect(Email.create('missing-domain@')).toBeNull();
      expect(Email.create('')).toBeNull();
    });

    it('two differently-cased inputs normalize to the same value (prevents case-variant duplicates)', () => {
      const a = Email.create('Admin@EasyCash.ph');
      const b = Email.create('admin@easycash.ph');
      expect(a?.value).toBe(b?.value);
    });
  });
});
