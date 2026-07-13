/**
 * Organizational job-title label under a Role (Role Type) - e.g. "MIS Manager" under "MIS".
 * Display/organizational only; does not participate in access-control decisions (those remain
 * governed entirely by the existing Role/Permission tables per ADR-043's flat role model).
 */
export interface RoleClassProps {
  id: string;
  roleId: string;
  roleName: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export class RoleClass {
  private constructor(private readonly props: RoleClassProps) {}

  static fromRecord(props: RoleClassProps): RoleClass {
    return new RoleClass(props);
  }

  get id(): string {
    return this.props.id;
  }

  get roleId(): string {
    return this.props.roleId;
  }

  get roleName(): string {
    return this.props.roleName;
  }

  get name(): string {
    return this.props.name;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toProps(): RoleClassProps {
    return { ...this.props };
  }
}
