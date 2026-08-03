import type { IUserRepository } from '@modules/identity/application/ports/IUserRepository';

export interface ChatTransferCandidate {
  id: string;
  name: string;
  roles: string[];
  roleClassName: string | null;
}

export interface ListChatTransferCandidatesUseCaseDeps {
  userRepository: IUserRepository;
}

/** Backs the "pick who to transfer to" picker (2026-07-31 user request: "kahit sino" - any LMS
 * user, not role-restricted like claiming from the Waiting queue is). Any authenticated staff
 * member may call this (not MIS-only, unlike the oversight staff list) - it's just the roster
 * needed to fill in Role -> Role Class -> person. */
export class ListChatTransferCandidatesUseCase {
  constructor(private readonly deps: ListChatTransferCandidatesUseCaseDeps) {}

  async execute(): Promise<ChatTransferCandidate[]> {
    const staff = await this.deps.userRepository.findMany({ limit: 200 });
    return staff.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`, roles: s.roles, roleClassName: s.roleClassName }));
  }
}
