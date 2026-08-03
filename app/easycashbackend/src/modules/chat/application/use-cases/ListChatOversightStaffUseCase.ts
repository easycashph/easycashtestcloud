import type { IUserRepository } from '@modules/identity/application/ports/IUserRepository';
import { ChatNotEligibleError } from '../../domain/errors/ChatErrors';

export interface ChatOversightStaffSummary {
  id: string;
  name: string;
  roles: string[];
}

export interface ListChatOversightStaffUseCaseDeps {
  userRepository: IUserRepository;
}

/** MIS-only "Staff Chat Oversight" list (2026-07-31 user request) - every LMS user, so MIS can
 * open any one of them and review their chat history. Not restricted to claim-eligible roles -
 * MIS wants visibility into the whole staff list, not just who's currently allowed to answer. */
export class ListChatOversightStaffUseCase {
  constructor(private readonly deps: ListChatOversightStaffUseCaseDeps) {}

  async execute(userId: string): Promise<ChatOversightStaffSummary[]> {
    const user = await this.deps.userRepository.findById(userId);
    if (!user || !user.roles.includes('MIS')) throw new ChatNotEligibleError();

    const staff = await this.deps.userRepository.findMany({ limit: 200 });
    return staff.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`, roles: s.roles }));
  }
}
