/**
 * Mirrors `app/backend/src/modules/identity/application/dtos/AuthDtos.ts`'s `AuthenticatedUserView`
 * and the auth endpoints' JSON response shapes. Kept as a small, hand-maintained mirror (not
 * generated) - see `apiClient.ts`'s own doc comment for why this pilot isn't using codegen yet.
 */
export interface AuthenticatedUserView {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  branchId: string;
  roles: string[];
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export interface LoginResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  user: AuthenticatedUserView;
}

export interface RefreshResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
}
