import { DomainError } from '@shared/errors/DomainError';

export class InvalidPersonNameError extends DomainError {
  constructor(reason: string) {
    super('INVALID_PERSON_NAME', `Invalid person name: ${reason}`, undefined, 400);
    this.name = 'InvalidPersonNameError';
  }
}
