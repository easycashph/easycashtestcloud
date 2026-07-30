/** Mirrors `SigningNotificationLogPresenter`'s output. One row per signing-link or OTP send (SMS
 * or Email), across every loan - see the backend `SigningNotificationLog` model's own doc comment. */
export interface SigningNotificationLog {
  id: string;
  loanAccountId: string;
  loanCode: string;
  branchId: string;
  borrowerName: string;
  type: 'LINK' | 'OTP';
  partyType: 'BORROWER' | 'CO_BORROWER';
  channel: string;
  recipient: string;
  sentAt: string;
  verifiedAt: string | null;
}
