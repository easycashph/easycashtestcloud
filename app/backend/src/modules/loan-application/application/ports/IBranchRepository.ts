export interface BranchLocation {
  id: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** Narrow, scoped to what LoanApplicationPreQualificationService needs — not a general Branch
 * module port (no such module exists yet; Branch is otherwise read inline where needed today). */
export interface IBranchRepository {
  findById(id: string): Promise<BranchLocation | null>;
  updateCoordinates(id: string, latitude: number, longitude: number): Promise<void>;
}
