export interface MembershipUpsertInput {
  readonly organizationId: string;
  readonly userId: string;
  readonly role: string;
  readonly createdAt: Date;
}
