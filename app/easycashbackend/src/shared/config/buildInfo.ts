import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * 2026-08-30 (user request, "may sanity check ba tayo?"): this platform runs on three separate
 * machines (Office Server PC, Macbook Nomer, Laptop Nomer), each with its own database and its own
 * independently-rebuilt Docker deployment - so it's possible for one machine to be running older
 * code than the others while showing data that looks otherwise identical. `build-info.json` is
 * generated at `scripts/write-build-info.ps1` (run right before `docker compose up -d --build`,
 * copied into the image by `backend.Dockerfile`) and records exactly which commit is running.
 * `hostname` distinguishes machines automatically without needing separate per-machine config.
 */
export interface BuildInfo {
  commit: string;
  commitDate: string | null;
  commitMessage: string | null;
  builtAt: string | null;
  hostname: string;
}

const BUILD_INFO_PATH = path.resolve(process.cwd(), 'build-info.json');

export function getBuildInfo(): BuildInfo {
  const fallback = { commit: 'unknown', commitDate: null, commitMessage: null, builtAt: null };
  let fromFile: Omit<BuildInfo, 'hostname'> = fallback;
  try {
    const raw = fs.readFileSync(BUILD_INFO_PATH, 'utf-8');
    fromFile = { ...fallback, ...JSON.parse(raw) };
  } catch {
    // Not generated (e.g. local `npm run dev` without running the script first) - fallback stands.
  }
  return { ...fromFile, hostname: os.hostname() };
}
