export interface BranchLocation {
  id: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface BranchSummary {
  id: string;
  code: string;
  name: string;
  address: string | null;
}

/** Narrow, scoped to what LoanApplicationPreQualificationService needs — not a general Branch
 * module port (no such module exists yet; Branch is otherwise read inline where needed today).
 * `findAllActive` was added for the Easycash Portal's branch-picker (2026-07-23, Phase 2). */
export interface IBranchRepository {
  findById(id: string): Promise<BranchLocation | null>;
  updateCoordinates(id: string, latitude: number, longitude: number): Promise<void>;
  findAllActive(): Promise<BranchSummary[]>;
}
