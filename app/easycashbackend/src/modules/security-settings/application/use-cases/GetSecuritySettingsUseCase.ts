import type { ISecuritySettingsRepository, SecuritySettings } from '../ports/ISecuritySettingsRepository';

export class GetSecuritySettingsUseCase {
  constructor(private readonly deps: { securitySettingsRepository: ISecuritySettingsRepository }) {}

  async execute(): Promise<SecuritySettings> {
    return this.deps.securitySettingsRepository.get();
  }
}
