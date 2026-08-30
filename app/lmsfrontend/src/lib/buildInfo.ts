import { apiClient } from '@/lib/apiClient';

/** Mirrors `app/easycashbackend`'s `BuildInfo` (see that module's doc comment for why this
 * exists - cross-machine version drift detection, 2026-08-30 user request). */
export interface BuildInfo {
  commit: string;
  commitDate: string | null;
  commitMessage: string | null;
  builtAt: string | null;
  hostname: string;
}

/** Static asset written by `scripts/write-build-info.ps1`/`.sh` right before the Vite build, so
 * this reflects the frontend bundle actually served - fetched directly (not through apiClient),
 * with `cache: 'no-store'` since a stale service-worker/browser cache would otherwise defeat the
 * whole point of this check. No `hostname` on this half (a static asset can't know its own
 * server's hostname) - only the backend's `/build-info` response has it. */
export async function fetchFrontendBuildInfo(): Promise<Omit<BuildInfo, 'hostname'>> {
  const res = await fetch('/build-info.json', { cache: 'no-store' });
  return res.json();
}

export async function fetchBackendBuildInfo(): Promise<BuildInfo> {
  return apiClient.get<BuildInfo>('/build-info');
}
