import type { TransactionContext } from '@shared/application/TransactionContext';
import type { CoBorrower } from '../../domain/CoBorrower';

export interface ICoBorrowerRepository {
  findById(id: string, ctx?: TransactionContext): Promise<CoBorrower | null>;
  save(coBorrower: CoBorrower, ctx?: TransactionContext): Promise<void>;
}
