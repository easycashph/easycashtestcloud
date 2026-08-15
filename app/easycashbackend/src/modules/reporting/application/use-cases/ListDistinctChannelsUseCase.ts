import type { ChannelOption, IReportingRepository } from '../ports/IReportingRepository';

export class ListDistinctChannelsUseCase {
  constructor(private readonly deps: { reportingRepository: IReportingRepository }) {}

  async execute(): Promise<ChannelOption[]> {
    return this.deps.reportingRepository.listDistinctChannels();
  }
}
