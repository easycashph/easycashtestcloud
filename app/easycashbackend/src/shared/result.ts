/**
 * Discriminated-union Result type. Expected business-rule failures (e.g.
 * "loan not found", "invalid state transition") are returned as typed
 * failures, not thrown — exceptions are reserved for truly exceptional
 * conditions (infrastructure failures, programming errors).
 */
export type Result<T, E> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function fail<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
