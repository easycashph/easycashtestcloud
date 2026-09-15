export interface NegativeAreaEntry {
  id: string;
  city: string;
  areaName: string;
}

export interface CreateNegativeAreaInput {
  city: string;
  areaName: string;
}

export interface INegativeAreaRepository {
  /** Every row, city then areaName ascending - both the admin management screen's list and the
   * pre-qualification Negative Area check's matching source (see LoanApplicationController's
   * `present`/`presentMany`, which fetch this list once per request, not once per application). */
  list(): Promise<NegativeAreaEntry[]>;
  create(input: CreateNegativeAreaInput): Promise<NegativeAreaEntry>;
  delete(id: string): Promise<void>;
}
