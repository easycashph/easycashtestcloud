import { describe, expect, it } from 'vitest';
import { parseTrustProxy, validateTrustProxy } from '@shared/config/trustProxy';

describe('parseTrustProxy (audit finding C-02)', () => {
  it('parses "true"/"false" as booleans', () => {
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('false')).toBe(false);
  });

  it('parses a plain integer string as a hop count', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('2')).toBe(2);
  });

  it('passes through subnet keywords and CIDR/IP lists unchanged', () => {
    expect(parseTrustProxy('loopback')).toBe('loopback');
    expect(parseTrustProxy('10.0.0.0/8,172.16.0.0/12')).toBe('10.0.0.0/8,172.16.0.0/12');
  });

  it('trims surrounding whitespace', () => {
    expect(parseTrustProxy('  1  ')).toBe(1);
    expect(parseTrustProxy(' true ')).toBe(true);
  });
});

describe('validateTrustProxy (production-readiness review: fail-fast config)', () => {
  it('accepts boolean and numeric forms without needing proxy-addr at all', () => {
    expect(validateTrustProxy('true')).toBeNull();
    expect(validateTrustProxy('false')).toBeNull();
    expect(validateTrustProxy('1')).toBeNull();
    expect(validateTrustProxy('3')).toBeNull();
  });

  it('accepts valid subnet keywords', () => {
    expect(validateTrustProxy('loopback')).toBeNull();
    expect(validateTrustProxy('linklocal')).toBeNull();
    expect(validateTrustProxy('uniquelocal')).toBeNull();
  });

  it('accepts valid IP/CIDR lists (single and comma-separated)', () => {
    expect(validateTrustProxy('10.0.0.0/8')).toBeNull();
    expect(validateTrustProxy('127.0.0.1,10.0.0.0/8')).toBeNull();
    expect(validateTrustProxy('::1')).toBeNull();
  });

  it('rejects a malformed value with a clear, actionable message (not a crash deep in Express)', () => {
    const error = validateTrustProxy('banana');
    expect(error).not.toBeNull();
    expect(error).toContain('TRUST_PROXY');
    expect(error).toContain('banana');
  });

  it('rejects a malformed entry inside an otherwise-valid comma-separated list', () => {
    expect(validateTrustProxy('10.0.0.0/8,not-an-ip')).not.toBeNull();
  });
});
