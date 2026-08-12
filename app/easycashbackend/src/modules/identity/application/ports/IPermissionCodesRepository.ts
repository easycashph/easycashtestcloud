/** Roles & Permissions feature (2026-08-06) — kept as its own tiny port (not a dependency on the
 * `access-control` module's own repository) so `identity` doesn't reach across module boundaries;
 * both read the same `Permission`/`RolePermission` tables independently, matching how `identity`
 * and every other module already treat Prisma as a shared infrastructure detail, not a
 * cross-module coupling. */
export interface IPermissionCodesRepository {
  /** The union of every `Permission.code` granted to any of the given role names, right now. */
  getGrantedPermissionCodes(roleNames: string[]): Promise<string[]>;
}
