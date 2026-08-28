import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Cake,
  Calendar,
  Clock,
  Copy,
  FilePlus2,
  Flag,
  Heart,
  Home,
  IdCard,
  KeyRound,
  Landmark,
  Link2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Receipt,
  ShieldCheck,
  Users,
  VenusAndMars,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableSection } from '@/components/SortableSection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/PhoneInput';
import { Label } from '@/components/ui/label';
import { FieldTooltip } from '@/components/FieldTooltip';
import { FieldLockToggle } from '@/components/FieldLockToggle';
import { RoleAbbr } from '@/components/RoleAbbr';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { LoanStatusBadge } from '@/components/StatusBadge';
import { NumberInput } from '@/components/NumberInput';
import { computeAge } from '@/lib/computeAge';
import { ApplicantAvatar } from '@/components/ApplicantAvatar';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { ProfileActivityTimeline } from '@/components/ProfileActivityTimeline';
import { type AddressDraft, emptyAddressDraft, PsgcAddressPicker } from '@/components/PsgcAddressPicker';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { apiClient, ApiError, fetchAllPages, uploadFile } from '@/lib/apiClient';
import { ATTACHMENT_ACCEPTED_MIME, ATTACHMENT_ACCEPTED_TYPES, ATTACHMENT_MAX_FILE_SIZE_BYTES } from '@/lib/documentApiTypes';
import type { Borrower as RealBorrower, CoBorrower, LoanAccount, LoanAccountStatus, LoanProduct } from '@/lib/loanApiTypes';
import type { LoanApplication } from '@/lib/loanApplicationApiTypes';
import { LoanApplicationForm } from '@/pages/LoanApplicationCreatePage';
import { LoanAccountForm } from '@/pages/LoanAccountCreatePage';
import type { BorrowerRiskSummary, RiskLevel } from '@/lib/riskAssessmentApiTypes';
import type { MitigationDetails } from '@/lib/loanApplicationApiTypes';
import { formatDate, formatMobileNumber, formatPeso, toProperCase } from '@/lib/utils';

interface RealEditDraft {
  firstName: string;
  lastName: string;
  middleName: string;
  gender: string;
  birthDate: string;
  placeOfBirth: string;
  nationality: string;
  homeOwnership: string;
  mobilePhone1: string;
  email: string;
  facebookLink: string;
  civilStatus: string;
  occupation: string;
  employer: string;
  monthlyIncome: string;
  tinNumber: string;
  sssNumber: string;
  address: AddressDraft;
  // 2026-08-27 (user request): same Years/Months split convention as ClientCreatePage.tsx - not
  // part of `AddressDraft` for the same reason `homeOwnership` above isn't (see that field's doc
  // comment), just written into `addresses[0].lengthOfStayMonths` on save.
  lengthOfStayYears: string;
  lengthOfStayMonths: string;
}

function draftFromBorrower(borrower: RealBorrower): RealEditDraft {
  const existing = borrower.addresses[0];
  return {
    firstName: borrower.firstName,
    lastName: borrower.lastName,
    middleName: borrower.middleName ?? '',
    gender: borrower.gender ?? '',
    // `borrower.birthDate` is a full ISO datetime string ("...T00:00:00.000Z") from the API, but
    // `<input type="date">` only accepts an exact "YYYY-MM-DD" value - anything else renders blank
    // even though real data exists underneath.
    birthDate: borrower.birthDate ? borrower.birthDate.slice(0, 10) : '',
    placeOfBirth: borrower.placeOfBirth ?? '',
    nationality: borrower.nationality ?? '',
    mobilePhone1: borrower.mobilePhone1 ?? '',
    email: borrower.email ?? '',
    facebookLink: borrower.facebookLink ?? '',
    // 2026-08-27 (user-reported: "Home Ownership" always blank for legacy-migrated clients):
    // `Borrower.homeOwnership` IS real and used - populated from a LoanApplication's own intake
    // field for natively-created clients (see CreateBorrowerUseCase) - but SDevTech's own
    // client_accounts export never captured an equivalent concept, so every one of the ~4,610
    // legacy-migrated borrowers has it blank. Their actual home-ownership data lives instead on the
    // address record (`Address.ownershipStatus`, "Owned"/"Rented"/"Owned by Parents"/"Owned by
    // Relatives" - 700 addresses have it, from SDevTech's own `addresses.status` field). Falls back
    // to that when the Borrower-level field is empty, so neither population ever sees this field
    // wrongly blank; save writes both fields in sync (see the mutationFn below).
    homeOwnership: borrower.homeOwnership || existing?.ownershipStatus || '',
    lengthOfStayYears: existing?.lengthOfStayMonths != null ? String(Math.floor(existing.lengthOfStayMonths / 12)) : '',
    lengthOfStayMonths: existing?.lengthOfStayMonths != null ? String(existing.lengthOfStayMonths % 12) : '',
    // 2026-08-27 (user-reported: civil status showing blank in the edit form despite having real
    // data): a handful of legacy-migrated records (7, per direct DB check) have the same "divorced
    // or separated" status spelled in reverse word order ("SEPARATED/DIVORCED" instead of the
    // canonical "DIVORCED/SEPARATED") - same status, just an inconsistent legacy spelling. Normalize
    // it here so the dropdown shows the match instead of appearing empty; saving the form corrects
    // the record's spelling going forward.
    civilStatus: borrower.civilStatus === 'SEPARATED/DIVORCED' ? 'DIVORCED/SEPARATED' : (borrower.civilStatus ?? ''),
    occupation: borrower.incomeDetail?.position ?? '',
    employer: borrower.incomeDetail?.employerName ?? '',
    monthlyIncome: borrower.incomeDetail?.monthlyIncome != null ? String(borrower.incomeDetail.monthlyIncome) : '',
    tinNumber: borrower.governmentId?.tinNumber ?? '',
    sssNumber: borrower.governmentId?.sssNumber ?? '',
    address: existing
      ? {
          houseUnitNumber: existing.houseUnitNumber ?? '',
          street: existing.street ?? '',
          barangay: existing.barangay ?? '',
          cityMunicipality: existing.cityMunicipality ?? '',
          province: existing.province ?? '',
          zipCode: existing.zipCode ?? '',
        }
      : emptyAddressDraft(),
  };
}

/**
 * Real edit dialog for a migrated (CP12) client - wired to `PATCH /borrowers/:id`. Address entry
 * uses the cascading `PsgcAddressPicker` instead of free text, so a saved address can never again
 * end up as a raw PSGC code (see scripts/fix-coded-addresses.ts). The picker can't pre-select the
 * client's existing address into its dropdowns (no name->code reverse lookup - see the picker's own
 * doc comment), so the current address is shown as read-only context above it; leaving the picker
 * untouched keeps the existing address unchanged.
 */
function RealEditClientDialog({
  open,
  onOpenChange,
  borrower,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  borrower: RealBorrower;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = React.useState<RealEditDraft>(() => draftFromBorrower(borrower));
  const [addressTouched, setAddressTouched] = React.useState(false);
  const [unlocked, setUnlocked] = React.useState({
    firstName: false,
    lastName: false,
    middleName: false,
    gender: false,
    birthDate: false,
    placeOfBirth: false,
    nationality: false,
    homeOwnership: false,
    mobilePhone1: false,
    email: false,
    facebookLink: false,
    civilStatus: false,
    occupation: false,
    employer: false,
    monthlyIncome: false,
    tinNumber: false,
    sssNumber: false,
    address: false,
  });
  const toggleUnlock = (field: keyof typeof unlocked) => setUnlocked((u) => ({ ...u, [field]: !u[field] }));

  const queryKeyForAvatar = ['attachments', 'BORROWER', borrower.id];
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = React.useState<string | null>(null);
  const uploadPhotoMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('ownerType', 'BORROWER');
      formData.append('ownerId', borrower.id);
      formData.append('documentCategory', 'PROFILE_PICTURE');
      return uploadFile('/attachments', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeyForAvatar });
    },
  });
  const handlePhotoFileSelected = (file: File) => {
    if (!ATTACHMENT_ACCEPTED_MIME.has(file.type)) {
      setPhotoError('Unsupported file type. Allowed: PDF, JPEG, PNG.');
      return;
    }
    if (file.size > ATTACHMENT_MAX_FILE_SIZE_BYTES) {
      setPhotoError(`File exceeds the ${ATTACHMENT_MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB limit.`);
      return;
    }
    setPhotoError(null);
    uploadPhotoMutation.mutate(file);
  };

  React.useEffect(() => {
    if (open) {
      setDraft(draftFromBorrower(borrower));
      setAddressTouched(false);
      setPhotoError(null);
      setUnlocked({
        firstName: false,
        lastName: false,
        middleName: false,
        gender: false,
        birthDate: false,
        placeOfBirth: false,
        nationality: false,
        homeOwnership: false,
        mobilePhone1: false,
        email: false,
        facebookLink: false,
        civilStatus: false,
        occupation: false,
        employer: false,
        monthlyIncome: false,
        tinNumber: false,
        sssNumber: false,
        address: false,
      });
    }
  }, [open, borrower]);

  const existingAddress = borrower.addresses[0];
  const existingAddressLine = existingAddress
    ? toProperCase(
        [existingAddress.houseUnitNumber, existingAddress.street, existingAddress.barangay, existingAddress.cityMunicipality, existingAddress.province]
          .filter(Boolean)
          .join(', '),
      )
    : 'None on file';

  const updateMutation = useMutation({
    mutationFn: () =>
      apiClient.patch<RealBorrower>(`/borrowers/${borrower.id}`, {
        firstName: draft.firstName,
        lastName: draft.lastName,
        middleName: draft.middleName || undefined,
        gender: draft.gender || undefined,
        birthDate: draft.birthDate || undefined,
        placeOfBirth: draft.placeOfBirth || undefined,
        nationality: draft.nationality || undefined,
        homeOwnership: draft.homeOwnership || undefined,
        mobilePhone1: draft.mobilePhone1 || undefined,
        email: draft.email || undefined,
        facebookLink: draft.facebookLink || undefined,
        civilStatus: draft.civilStatus || undefined,
        occupation: draft.occupation || undefined,
        employer: draft.employer || undefined,
        monthlyIncome: draft.monthlyIncome.trim() ? Number(draft.monthlyIncome) : undefined,
        tinNumber: draft.tinNumber || undefined,
        sssNumber: draft.sssNumber || undefined,
        ...(addressTouched
          ? {
              addresses: [
                {
                  houseUnitNumber: draft.address.houseUnitNumber || undefined,
                  street: draft.address.street || undefined,
                  barangay: draft.address.barangay || undefined,
                  cityMunicipality: draft.address.cityMunicipality || undefined,
                  province: draft.address.province || undefined,
                  zipCode: draft.address.zipCode || undefined,
                  ownershipStatus: draft.homeOwnership || undefined,
                  lengthOfStayMonths:
                    draft.lengthOfStayYears.trim() || draft.lengthOfStayMonths.trim()
                      ? (Number.parseInt(draft.lengthOfStayYears, 10) || 0) * 12 + (Number.parseInt(draft.lengthOfStayMonths, 10) || 0)
                      : undefined,
                },
              ],
            }
          : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['borrower', borrower.id] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Client Details</DialogTitle>
          <DialogDescription>
            Updates the real client record. Every field starts locked - click "Click to edit" next to a field to unlock it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 border-b pb-4">
          <ApplicantAvatar
            ownerType="BORROWER"
            ownerId={borrower.id}
            initials={((borrower.firstName[0] ?? '') + (borrower.lastName[0] ?? '')).toUpperCase()}
            className="h-14 w-14"
          />
          <div className="space-y-1">
            <input
              ref={photoInputRef}
              type="file"
              accept={ATTACHMENT_ACCEPTED_TYPES}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePhotoFileSelected(file);
                e.target.value = '';
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadPhotoMutation.isPending}
              onClick={() => photoInputRef.current?.click()}
            >
              {uploadPhotoMutation.isPending ? 'Uploading…' : 'Upload Profile Picture'}
            </Button>
            {photoError && <p className="text-xs text-destructive">{photoError}</p>}
            {uploadPhotoMutation.isError && !photoError && (
              <p className="text-xs text-destructive">Could not upload the photo. Please try again.</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                First Name <FieldTooltip text="Client's legal first name, as shown on a valid ID." />
              </Label>
              <FieldLockToggle unlocked={unlocked.firstName} onToggle={() => toggleUnlock('firstName')} />
            </div>
            <Input
              value={draft.firstName}
              onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
              disabled={!unlocked.firstName}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Last Name <FieldTooltip text="Client's legal surname, as shown on a valid ID." />
              </Label>
              <FieldLockToggle unlocked={unlocked.lastName} onToggle={() => toggleUnlock('lastName')} />
            </div>
            <Input
              value={draft.lastName}
              onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
              disabled={!unlocked.lastName}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Middle Name <FieldTooltip text="Client's legal middle name, if any." />
              </Label>
              <FieldLockToggle unlocked={unlocked.middleName} onToggle={() => toggleUnlock('middleName')} />
            </div>
            <Input
              value={draft.middleName}
              onChange={(e) => setDraft({ ...draft, middleName: e.target.value })}
              disabled={!unlocked.middleName}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Contact Number <FieldTooltip text="Client's active mobile number for SMS/call follow-ups." />
              </Label>
              <FieldLockToggle unlocked={unlocked.mobilePhone1} onToggle={() => toggleUnlock('mobilePhone1')} />
            </div>
            <PhoneInput
              value={draft.mobilePhone1}
              onChange={(e) => setDraft({ ...draft, mobilePhone1: e.target.value })}
              placeholder="917 XXX XXXX"
              disabled={!unlocked.mobilePhone1}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Email <FieldTooltip text="Client's email, used for document copies or notices." />
              </Label>
              <FieldLockToggle unlocked={unlocked.email} onToggle={() => toggleUnlock('email')} />
            </div>
            <Input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} disabled={!unlocked.email} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Facebook Link <FieldTooltip text="Client's Facebook profile/page URL, if available." />
              </Label>
              <FieldLockToggle unlocked={unlocked.facebookLink} onToggle={() => toggleUnlock('facebookLink')} />
            </div>
            <Input
              value={draft.facebookLink}
              onChange={(e) => setDraft({ ...draft, facebookLink: e.target.value })}
              placeholder="https://facebook.com/username"
              disabled={!unlocked.facebookLink}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Civil Status <FieldTooltip text="Client's current civil status." />
              </Label>
              <FieldLockToggle unlocked={unlocked.civilStatus} onToggle={() => toggleUnlock('civilStatus')} />
            </div>
            <Select
              value={draft.civilStatus}
              onValueChange={(v) => setDraft({ ...draft, civilStatus: v })}
              disabled={!unlocked.civilStatus}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SINGLE">Single</SelectItem>
                <SelectItem value="MARRIED">Married</SelectItem>
                <SelectItem value="WIDOWED">Widowed</SelectItem>
                <SelectItem value="DIVORCED/SEPARATED">Divorced/Separated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Gender <FieldTooltip text="Client's gender." />
              </Label>
              <FieldLockToggle unlocked={unlocked.gender} onToggle={() => toggleUnlock('gender')} />
            </div>
            <Select value={draft.gender} onValueChange={(v) => setDraft({ ...draft, gender: v })} disabled={!unlocked.gender}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FEMALE">Female</SelectItem>
                <SelectItem value="MALE">Male</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Birth Date <FieldTooltip text="Client's date of birth." />
              </Label>
              <FieldLockToggle unlocked={unlocked.birthDate} onToggle={() => toggleUnlock('birthDate')} />
            </div>
            <Input
              type="date"
              value={draft.birthDate}
              onChange={(e) => setDraft({ ...draft, birthDate: e.target.value })}
              disabled={!unlocked.birthDate}
            />
            {computeAge(draft.birthDate) !== null && (
              <p className="text-xs text-muted-foreground">Age: {computeAge(draft.birthDate)}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Place of Birth <FieldTooltip text="Client's place of birth." />
              </Label>
              <FieldLockToggle unlocked={unlocked.placeOfBirth} onToggle={() => toggleUnlock('placeOfBirth')} />
            </div>
            <Input
              value={draft.placeOfBirth}
              onChange={(e) => setDraft({ ...draft, placeOfBirth: e.target.value })}
              disabled={!unlocked.placeOfBirth}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Nationality <FieldTooltip text="Client's nationality." />
              </Label>
              <FieldLockToggle unlocked={unlocked.nationality} onToggle={() => toggleUnlock('nationality')} />
            </div>
            <Input
              value={draft.nationality}
              onChange={(e) => setDraft({ ...draft, nationality: e.target.value })}
              disabled={!unlocked.nationality}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Home Ownership <FieldTooltip text="Client's home ownership status - stored on their address record." />
              </Label>
              <FieldLockToggle unlocked={unlocked.homeOwnership} onToggle={() => toggleUnlock('homeOwnership')} />
            </div>
            <Select
              value={draft.homeOwnership}
              onValueChange={(v) => {
                setAddressTouched(true);
                setDraft({ ...draft, homeOwnership: v });
              }}
              disabled={!unlocked.homeOwnership}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Owned">Owned</SelectItem>
                <SelectItem value="Rented">Rented</SelectItem>
                <SelectItem value="Owned by Parents">Owned by Parents</SelectItem>
                <SelectItem value="Owned by Relatives">Owned by Relatives</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Length of Stay <FieldTooltip text="How long the client has lived at their current address." />
              </Label>
              <FieldLockToggle unlocked={unlocked.homeOwnership} onToggle={() => toggleUnlock('homeOwnership')} />
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                placeholder="Years"
                value={draft.lengthOfStayYears}
                onChange={(e) => {
                  setAddressTouched(true);
                  setDraft({ ...draft, lengthOfStayYears: e.target.value });
                }}
                disabled={!unlocked.homeOwnership}
              />
              <Input
                type="number"
                min="0"
                max="11"
                placeholder="Months"
                value={draft.lengthOfStayMonths}
                onChange={(e) => {
                  setAddressTouched(true);
                  setDraft({ ...draft, lengthOfStayMonths: e.target.value });
                }}
                disabled={!unlocked.homeOwnership}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Occupation <FieldTooltip text="Client's job title/occupation." />
              </Label>
              <FieldLockToggle unlocked={unlocked.occupation} onToggle={() => toggleUnlock('occupation')} />
            </div>
            <Input
              value={draft.occupation}
              onChange={(e) => setDraft({ ...draft, occupation: e.target.value })}
              disabled={!unlocked.occupation}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Employer <FieldTooltip text="Client's current employer." />
              </Label>
              <FieldLockToggle unlocked={unlocked.employer} onToggle={() => toggleUnlock('employer')} />
            </div>
            <Input
              value={draft.employer}
              onChange={(e) => setDraft({ ...draft, employer: e.target.value })}
              disabled={!unlocked.employer}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Monthly Income <FieldTooltip text="Client's gross monthly income." />
              </Label>
              <FieldLockToggle unlocked={unlocked.monthlyIncome} onToggle={() => toggleUnlock('monthlyIncome')} />
            </div>
            <NumberInput
              min="0"
              value={draft.monthlyIncome}
              onChange={(e) => setDraft({ ...draft, monthlyIncome: e.target.value })}
              disabled={!unlocked.monthlyIncome}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                TIN <FieldTooltip text="Client's Tax Identification Number." />
              </Label>
              <FieldLockToggle unlocked={unlocked.tinNumber} onToggle={() => toggleUnlock('tinNumber')} />
            </div>
            <Input
              value={draft.tinNumber}
              onChange={(e) => setDraft({ ...draft, tinNumber: e.target.value })}
              disabled={!unlocked.tinNumber}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                SSS <FieldTooltip text="Client's Social Security System number." />
              </Label>
              <FieldLockToggle unlocked={unlocked.sssNumber} onToggle={() => toggleUnlock('sssNumber')} />
            </div>
            <Input
              value={draft.sssNumber}
              onChange={(e) => setDraft({ ...draft, sssNumber: e.target.value })}
              disabled={!unlocked.sssNumber}
            />
          </div>
        </div>

        <div className="space-y-1.5 border-t pt-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1">
              Address <FieldTooltip text="Replacing this replaces the client's entire address on file - leave untouched to keep the current one." />
            </Label>
            <FieldLockToggle unlocked={unlocked.address} onToggle={() => toggleUnlock('address')} />
          </div>
          <p className="text-xs text-muted-foreground">
            Current on file: <span className="font-medium text-foreground">{existingAddressLine}</span>. Select below to replace it -
            leave untouched to keep the current address.
          </p>
          <fieldset disabled={!unlocked.address} className="disabled:opacity-50">
            <PsgcAddressPicker
              value={draft.address}
              onChange={(patch) => {
                setAddressTouched(true);
                setDraft((prev) => ({ ...prev, address: { ...prev.address, ...patch } }));
              }}
            />
          </fieldset>
        </div>

        {updateMutation.isError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {updateMutation.error instanceof Error ? updateMutation.error.message : 'Could not save changes.'}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/**
 * Frontend↔Backend Wiring Pilot, extended 2026-07-09 after CP12. `getMockBorrower()` only knows
 * hand-authored mock clients - a borrower id from `ClientListPage`'s now-real list (a UUID,
 * migrated from legacy data) doesn't exist there and would otherwise hit this page's "not found"
 * state. Deliberately minimal, same scope decision as `LoanDetailPage.tsx`'s `RealLoanDetailView`:
 * personal info + real loan history. Editing is now real (`RealEditClientDialog`). "Create Loan
 * Account" moved to the Loan Applicant Profile page (2026-07-14) - it's gated per-application
 * there (`application.createdBorrowerId` set + `status === 'APPROVED'`), not per-client. Attachments
 * stay mock-only.
 */
const RISK_BADGE_VARIANT: Record<RiskLevel, 'success' | 'warning' | 'destructive'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'destructive',
};
const RISK_LEVEL_LABEL: Record<RiskLevel, string> = { LOW: 'Low Risk', MEDIUM: 'Medium Risk', HIGH: 'High Risk' };

/**
 * Deterministic, rule-based summary computed by the LMS itself (backend's
 * `BorrowerRiskSummaryService`) from this client's real loan/repayment history across every loan
 * they've ever had - no external AI model. Advisory only.
 */
function RiskPaymentSummaryCard({ borrowerId }: { borrowerId: string }) {
  const query = useQuery({
    queryKey: ['borrower-risk-summary', borrowerId],
    queryFn: () => apiClient.get<BorrowerRiskSummary>(`/borrowers/${borrowerId}/risk-summary`),
  });
  const summary = query.data;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm">Risk &amp; Payment Summary</CardTitle>
        </div>
        {summary && <Badge variant={RISK_BADGE_VARIANT[summary.riskLevel]}>{RISK_LEVEL_LABEL[summary.riskLevel]}</Badge>}
      </CardHeader>
      <CardContent className="flex-1 space-y-2 p-4 pt-0">
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading risk summary…</p>
        ) : !summary ? (
          <p className="text-sm text-muted-foreground">Could not load the risk summary.</p>
        ) : (
          <>
            {/* 2026-08-06 (user request): one row per field, full width, instead of the
                2/4-column grid a half-width card forced - matches the approved mockup. */}
            <dl className="divide-y divide-border border-t text-xs">
              <div className="flex items-center justify-between py-2">
                <dt className="text-muted-foreground">Active loans</dt>
                <dd className="font-medium">{summary.activeLoanCount}</dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-muted-foreground">Total exposure</dt>
                <dd className="font-medium">{formatPeso(Number(summary.totalExposure))}</dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-muted-foreground">Worst days past due</dt>
                <dd className="font-medium">{summary.worstDaysPastDue}</dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-muted-foreground">Late payments (lifetime)</dt>
                <dd className="font-medium">{summary.lifetimeLateInstallmentCount}</dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-muted-foreground">On-time payment rate</dt>
                <dd className="font-medium">
                  {summary.onTimePaymentRate === null ? 'No payment history yet' : `${Math.round(summary.onTimePaymentRate * 100)}%`}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">{summary.recommendation}</p>
            <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary">
              Computed by the LMS from this client's real loan/repayment history - a deterministic rule-based calculation, not an
              external AI model.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface BorrowerMitigationDetailsResult {
  mitigation: MitigationDetails;
  sourceApplicationId: string;
  sourceApplicationUpdatedAt: string;
}

const MITIGATION_FIELD_LABELS: Array<[keyof MitigationDetails, string]> = [
  ['bank', 'Bank'],
  ['branch', 'Branch'],
  ['accountName', 'Account Name'],
  ['accountNumber', 'Account Number'],
  ['atmCardNumber', 'ATM Card Number'],
  ['allotmentAmount', 'Allotment Amount'],
];

const MITIGATION_ACCOUNT_OWNER_LABEL: Record<'BORROWER' | 'CO_BORROWER', string> = {
  BORROWER: 'Borrower',
  CO_BORROWER: 'Co-Borrower',
};

/** 2026-08-13 (user request): read-only view of the ATM/bank mitigation details captured on
 * whichever of this client's loan applications has them on file. Editing stays exclusively on the
 * Loan Application page (`SetMitigationDetailsUseCase`) - this card only links there. */
function MitigationDetailsCard({ borrowerId }: { borrowerId: string }) {
  const query = useQuery({
    queryKey: ['borrower-mitigation', borrowerId],
    queryFn: () => apiClient.get<BorrowerMitigationDetailsResult | null>(`/borrowers/${borrowerId}/mitigation`),
  });
  const result = query.data;

  if (!query.isLoading && !result) return null;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm">Bank / ATM Details</CardTitle>
        </div>
        {result && (
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
            <Link to={`/applications/${result.sourceApplicationId}?section=mitigation`}>Edit on Loan Application</Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 space-y-2 p-4 pt-0">
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading bank/ATM details…</p>
        ) : (
          result && (
            <dl className="divide-y divide-border border-t text-xs">
              {MITIGATION_FIELD_LABELS.map(([key, label]) => (
                <div key={key} className="flex items-center justify-between py-2">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{result.mitigation[key] || '-'}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between py-2">
                <dt className="text-muted-foreground">Account Owner</dt>
                <dd className="font-medium">
                  {result.mitigation.accountOwner ? MITIGATION_ACCOUNT_OWNER_LABEL[result.mitigation.accountOwner] : '-'}
                </dd>
              </div>
            </dl>
          )
        )}
      </CardContent>
    </Card>
  );
}

interface CoBorrowerDraft {
  firstName: string;
  middleName: string;
  lastName: string;
  phoneNumber: string;
  emailAddress: string;
  relationship: string;
  employer: string;
}

const EMPTY_CO_BORROWER_DRAFT: CoBorrowerDraft = {
  firstName: '',
  middleName: '',
  lastName: '',
  phoneNumber: '',
  emailAddress: '',
  relationship: '',
  employer: '',
};

function draftFromCoBorrower(cb: CoBorrower): CoBorrowerDraft {
  return {
    firstName: cb.firstName,
    middleName: cb.middleName ?? '',
    lastName: cb.lastName,
    phoneNumber: cb.phoneNumber ?? '',
    emailAddress: cb.emailAddress ?? '',
    relationship: cb.relationship ?? '',
    employer: cb.employer ?? '',
  };
}

function addressDraftFromCoBorrower(cb: CoBorrower): AddressDraft {
  const addr = cb.addresses[0];
  return addr
    ? {
        houseUnitNumber: addr.houseUnitNumber ?? '',
        street: addr.street ?? '',
        barangay: addr.barangay ?? '',
        cityMunicipality: addr.cityMunicipality ?? '',
        province: addr.province ?? '',
        zipCode: addr.zipCode ?? '',
      }
    : emptyAddressDraft();
}

function formatCoBorrowerAddress(cb: CoBorrower): string {
  const addr = cb.addresses[0];
  if (!addr) return '-';
  return (
    [addr.houseUnitNumber, addr.street, addr.barangay, addr.cityMunicipality, addr.province, addr.zipCode].filter(Boolean).join(', ') || '-'
  );
}

/** 2026-07-25 - shows this client's co-borrower (ADR-015: per-Borrower, applies to every one of
 * their loans) sourced from whichever loan application named one. Deliberately edit-only once a
 * co-borrower exists - CRM decision (2026-07-25): a client's co-borrower must always be traceable
 * back to what was verified on an application, so staff correct/replace the existing record
 * in place (e.g. when the person named at intake doesn't pass verification) rather than adding
 * an unrelated second one. "Add" only appears while none exists yet - for older applications
 * that never captured a co-borrower, or clients created without one. */
function CoBorrowersCard({ borrowerId }: { borrowerId: string }) {
  // 2026-08-06 (user-reported gap): Add/Edit Co-Borrower posts through the same `borrower.write`
  // permission the backend already gates (POST/PATCH /co-borrowers - see borrowerRouter.ts), but
  // this button itself was never wired to it, so every role saw it regardless of their Roles &
  // Permissions setting.
  const { canManageClients } = useRole();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<CoBorrowerDraft>({ ...EMPTY_CO_BORROWER_DRAFT });
  const [addressDraft, setAddressDraft] = React.useState<AddressDraft>(emptyAddressDraft());
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const query = useQuery({
    queryKey: ['co-borrowers', borrowerId],
    queryFn: () => apiClient.get<{ items: CoBorrower[] }>(`/borrowers/${borrowerId}/co-borrowers`),
  });
  const coBorrowers = query.data?.items ?? [];
  const existing = coBorrowers[0] ?? null;

  const openDialog = () => {
    setDraft(existing ? draftFromCoBorrower(existing) : { ...EMPTY_CO_BORROWER_DRAFT });
    setAddressDraft(existing ? addressDraftFromCoBorrower(existing) : emptyAddressDraft());
    setSubmitError(null);
    setEditOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        firstName: draft.firstName.trim(),
        middleName: draft.middleName.trim() || undefined,
        lastName: draft.lastName.trim(),
        phoneNumber: draft.phoneNumber.trim() || undefined,
        emailAddress: draft.emailAddress.trim() || undefined,
        relationship: draft.relationship.trim() || undefined,
        employer: draft.employer.trim() || undefined,
        addresses: Object.values(addressDraft).some((v) => v.trim()) ? [addressDraft] : undefined,
      };
      return existing
        ? apiClient.patch<CoBorrower>(`/co-borrowers/${existing.id}`, payload)
        : apiClient.post<CoBorrower>('/co-borrowers', { ...payload, borrowerId });
    },
    onSuccess: () => {
      setEditOpen(false);
      setSubmitError(null);
      void queryClient.invalidateQueries({ queryKey: ['co-borrowers', borrowerId] });
    },
    onError: (error: unknown) => {
      setSubmitError(error instanceof ApiError ? error.message : 'Could not reach the server. Check your connection and try again.');
    },
  });

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm">Co-Borrower</CardTitle>
        </div>
        {canManageClients && (
          <Button size="sm" onClick={openDialog}>
            {existing ? (
              <>
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
              </>
            ) : (
              <>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Co-Borrower
              </>
            )}
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {query.isLoading ? (
          <p className="py-2 text-center text-xs text-muted-foreground">Loading…</p>
        ) : !existing ? (
          <p className="py-2 text-center text-xs text-muted-foreground">No co-borrower on record for this client.</p>
        ) : (
          <div className="rounded-md border p-3 text-sm">
            <p className="font-medium">{existing.fullName}</p>
            <p className="mb-2.5 text-xs text-muted-foreground">{existing.relationship || 'Relationship not set'}</p>
            <dl className="grid grid-cols-2 gap-y-1.5 text-xs">
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="text-right font-medium">{existing.phoneNumber ? formatMobileNumber(existing.phoneNumber) : '-'}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="text-right font-medium">{existing.emailAddress ?? '-'}</dd>
              <dt className="text-muted-foreground">Employer</dt>
              <dd className="text-right font-medium">{existing.employer ?? '-'}</dd>
              <dt className="text-muted-foreground">Address</dt>
              <dd className="text-right font-medium">{formatCoBorrowerAddress(existing)}</dd>
            </dl>
          </div>
        )}
      </CardContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{existing ? 'Edit Co-Borrower' : 'Add Co-Borrower'}</DialogTitle>
            <DialogDescription>Attaches to this client directly - applies to every one of their loans, not just one.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>
                First Name<span className="text-destructive"> *</span>
              </Label>
              <Input value={draft.firstName} onChange={(e) => setDraft((prev) => ({ ...prev, firstName: e.target.value.toUpperCase() }))} />
            </div>
            <div className="space-y-1.5">
              <Label>
                Last Name<span className="text-destructive"> *</span>
              </Label>
              <Input value={draft.lastName} onChange={(e) => setDraft((prev) => ({ ...prev, lastName: e.target.value.toUpperCase() }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Middle Name</Label>
              <Input value={draft.middleName} onChange={(e) => setDraft((prev) => ({ ...prev, middleName: e.target.value.toUpperCase() }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone Number</Label>
              <PhoneInput
                value={draft.phoneNumber}
                onChange={(e) => setDraft((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                placeholder="917 XXX XXXX"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={draft.emailAddress} onChange={(e) => setDraft((prev) => ({ ...prev, emailAddress: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Relationship</Label>
              <Input value={draft.relationship} onChange={(e) => setDraft((prev) => ({ ...prev, relationship: e.target.value.toUpperCase() }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Employer</Label>
              <Input value={draft.employer} onChange={(e) => setDraft((prev) => ({ ...prev, employer: e.target.value.toUpperCase() }))} />
            </div>
          </div>
          <div className="border-t pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Address</p>
            <PsgcAddressPicker value={addressDraft} onChange={(patch) => setAddressDraft((prev) => ({ ...prev, ...patch }))} />
          </div>
          {submitError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {submitError}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!draft.firstName.trim() || !draft.lastName.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving…' : existing ? 'Save Changes' : 'Add Co-Borrower'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/** A loan account is "active" for the "one active loan at a time" rule if it hasn't reached any closed state yet. */
const ACTIVE_LOAN_STATUSES: ReadonlySet<LoanAccountStatus> = new Set(['PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'ACTIVE_IN_ARREARS']);

// 2026-07-25 (user request, same pattern as LoanDetailPage's cardOrder): everything below the
// client info header is drag-to-reorder - each staff member's own arrangement, saved per-user in
// localStorage (same key style as the sidebar-collapse preference in AppLayout.tsx), so one
// officer's preferred layout doesn't affect anyone else logged into the same shared machine.
// 2026-08-06 (user request): default order updated to match MIS Nomer's own current arrangement
// (Loan Applications, Co-Borrower, Loan History, Risk & Payment Summary, Activity Timeline,
// Recent Activity). 2026-08-06 follow-up (user-confirmed): applied to EVERY user, not just those
// without a saved preference - the localStorage key itself was bumped (v2) so any
// already-saved order under the old key is orphaned/ignored, and every user reads this new
// default on next load. A user who then personally re-drags again still only affects their own
// saved order going forward, same as before.
const DEFAULT_CARD_ORDER = ['loanApplications', 'coBorrower', 'mitigation', 'loanHistory', 'riskSummary', 'activityTimeline', 'recentActivity'];
const CARD_ORDER_KEY_PREFIX = 'lms.clientProfileCardOrder.v2';
function cardOrderKey(userId: string): string {
  return `${CARD_ORDER_KEY_PREFIX}:${userId}`;
}

/** Mirrors app/easycashbackend's GetBorrowerPortalAccountStatusUseCase response shape (2026-08-06,
 * Bind existing Client data to Portal) - hand-maintained, same reasoning as this codebase's other
 * apiClient DTO mirrors (see apiClient.ts's own doc comment). */
interface PortalAccountSummary {
  id: string;
  email: string;
  status: 'PENDING_VERIFICATION' | 'ACTIVE' | 'DELETED';
  mustChangePassword: boolean;
  createdAt: string;
}
interface BorrowerPortalAccountStatus {
  linked: PortalAccountSummary | null;
  unlinkedMatchByEmail: PortalAccountSummary | null;
}

/**
 * "Portal Account" panel (2026-08-06 user request, MIS-only) - lets staff create a Portal account
 * for an existing client (issuing the shared temp password, `easycashportal123`, forced to change
 * on first login) or bind an already-existing-but-unlinked Portal account to this client, so their
 * real loan data appears once they access the portal. Read-only status once linked.
 */
function PortalAccountPanel({ borrowerId, hasEmail }: { borrowerId: string; hasEmail: boolean }) {
  const queryClient = useQueryClient();
  const [issuedPassword, setIssuedPassword] = React.useState<{ email: string; password: string; mode: 'created' | 'reset' } | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ['borrower-portal-account', borrowerId],
    queryFn: () => apiClient.get<BorrowerPortalAccountStatus>(`/borrowers/${borrowerId}/portal-account`),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['borrower-portal-account', borrowerId] });

  const createMutation = useMutation({
    mutationFn: () => apiClient.post<{ email: string; temporaryPassword: string }>(`/borrowers/${borrowerId}/portal-account`),
    onSuccess: (result) => {
      setActionError(null);
      setIssuedPassword({ email: result.email, password: result.temporaryPassword, mode: 'created' });
      invalidate();
    },
    onError: (err) => setActionError(err instanceof ApiError ? err.message : 'Could not create the Portal account.'),
  });

  // 2026-08-13 (user request) - lets MIS unlock a client who's locked out of/can't complete
  // self-service Portal password recovery, mirroring createMutation's shape but issuing a fresh
  // random one-time password (never the shared STAFF_ISSUED_TEMP_PASSWORD) - see
  // ResetPortalAccountPasswordUseCase's doc comment.
  const resetMutation = useMutation({
    mutationFn: () => apiClient.post<{ email: string; temporaryPassword: string }>(`/borrowers/${borrowerId}/portal-account/reset-password`),
    onSuccess: (result) => {
      setActionError(null);
      setIssuedPassword({ email: result.email, password: result.temporaryPassword, mode: 'reset' });
      invalidate();
    },
    onError: (err) => setActionError(err instanceof ApiError ? err.message : 'Could not reset the Portal password.'),
  });

  const bindMutation = useMutation({
    mutationFn: () => apiClient.post(`/borrowers/${borrowerId}/portal-account/bind`),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (err) => setActionError(err instanceof ApiError ? err.message : 'Could not bind the Portal account.'),
  });

  const handleCopy = (password: string) => {
    void navigator.clipboard.writeText(password);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const status = statusQuery.data;

  return (
    <Card>
      <CardHeader className="p-4">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <Link2 className="h-3.5 w-3.5" /> Portal Account
        </CardTitle>
        <CardDescription className="text-xs">Client Easycash Portal access, linked to this client's real loan data.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0 text-xs">
        {actionError && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">{actionError}</p>}

        {issuedPassword && (
          <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-primary">
            <p>
              {issuedPassword.mode === 'created' ? 'Portal account created' : 'Portal password reset'} for{' '}
              <span className="font-medium">{issuedPassword.email}</span>. Share this temporary password with the client - they must
              change it on first login.
            </p>
            <div className="flex items-center gap-2">
              <code className="rounded bg-background px-2 py-1 font-mono text-[13px]">{issuedPassword.password}</code>
              <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => handleCopy(issuedPassword.password)}>
                <Copy className="h-3 w-3" /> {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        )}

        {statusQuery.isLoading && <p className="text-muted-foreground">Loading…</p>}

        {!statusQuery.isLoading && status?.linked && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div className="col-span-2 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> {status.linked.email}
            </div>
            <div>
              <span className="text-muted-foreground">Status: </span>
              <Badge variant="outline" className="text-[11px]">
                {status.linked.status === 'ACTIVE' ? 'Active' : status.linked.status === 'DELETED' ? 'Deleted by client' : 'Pending Verification'}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Linked: </span>
              {formatDate(status.linked.createdAt)}
            </div>
            {status.linked.status === 'DELETED' && (
              <div className="col-span-2 text-muted-foreground">
                This Portal login was deleted (self-service, Security tab) - client/loan data here is unaffected.
              </div>
            )}
            {status.linked.mustChangePassword && status.linked.status !== 'DELETED' && (
              <div className="col-span-2 text-warning">Client has not yet changed their temporary password.</div>
            )}
            {status.linked.status !== 'DELETED' && (
              <div className="col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  disabled={resetMutation.isPending}
                  onClick={() => resetMutation.mutate()}
                >
                  <KeyRound className="h-3 w-3" /> {resetMutation.isPending ? 'Resetting…' : 'Reset Password'}
                </Button>
              </div>
            )}
          </dl>
        )}

        {!statusQuery.isLoading && !status?.linked && !hasEmail && (
          <p className="text-muted-foreground">This client has no email address on file - add one (Edit) before creating a Portal account.</p>
        )}

        {!statusQuery.isLoading && !status?.linked && hasEmail && status?.unlinkedMatchByEmail && (
          <div className="space-y-2">
            <p className="text-muted-foreground">
              An existing, unlinked Portal account was found for <span className="font-medium">{status.unlinkedMatchByEmail.email}</span>.
            </p>
            <Button type="button" size="sm" disabled={bindMutation.isPending} onClick={() => bindMutation.mutate()}>
              <Link2 className="mr-1.5 h-3.5 w-3.5" /> {bindMutation.isPending ? 'Binding…' : 'Bind Existing Portal Account'}
            </Button>
          </div>
        )}

        {!statusQuery.isLoading && !status?.linked && hasEmail && !status?.unlinkedMatchByEmail && (
          <div className="space-y-2">
            <p className="text-muted-foreground">No Portal account yet for this client.</p>
            <Button type="button" size="sm" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
              <KeyRound className="mr-1.5 h-3.5 w-3.5" /> {createMutation.isPending ? 'Creating…' : 'Create Portal Account'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RealClientProfileView({ borrowerId }: { borrowerId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canAccessLoanApplications, canManageMembers, currentAccount } = useRole();
  const [editOpen, setEditOpen] = React.useState(false);
  const [createApplicationOpen, setCreateApplicationOpen] = React.useState(false);
  const [createLoanAccountOpen, setCreateLoanAccountOpen] = React.useState(false);
  const [cardOrder, setCardOrder] = React.useState<string[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_CARD_ORDER;
    try {
      const saved = window.localStorage.getItem(cardOrderKey(currentAccount.id));
      if (!saved) return DEFAULT_CARD_ORDER;
      const parsed = JSON.parse(saved) as string[];
      const isValid = Array.isArray(parsed) && DEFAULT_CARD_ORDER.every((id) => parsed.includes(id)) && parsed.length === DEFAULT_CARD_ORDER.length;
      return isValid ? parsed : DEFAULT_CARD_ORDER;
    } catch {
      return DEFAULT_CARD_ORDER;
    }
  });
  React.useEffect(() => {
    window.localStorage.setItem(cardOrderKey(currentAccount.id), JSON.stringify(cardOrder));
  }, [cardOrder, currentAccount.id]);
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const handleCardDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setCardOrder((order) => {
      const oldIndex = order.indexOf(String(active.id));
      const newIndex = order.indexOf(String(over.id));
      return oldIndex === -1 || newIndex === -1 ? order : arrayMove(order, oldIndex, newIndex);
    });
  };

  const borrowerQuery = useQuery({
    queryKey: ['borrower', borrowerId],
    queryFn: () => apiClient.get<RealBorrower>(`/borrowers/${borrowerId}`),
    retry: false,
  });
  const borrower = borrowerQuery.data;

  const loansQuery = useQuery({
    queryKey: ['loan-accounts', 'all'],
    queryFn: () => fetchAllPages<LoanAccount>('/loan-accounts'),
  });
  const rawProductsQuery = useQuery({
    // Deliberately NOT ['loan-products', 'all'] - that key is shared by every other page that
    // caches the plain LoanProduct[] array under different assumptions about shape/freshness.
    queryKey: ['loan-products', 'all', 'clientProfilePage'],
    queryFn: () => fetchAllPages<LoanProduct>('/loan-products'),
  });
  const versionToProductName = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of rawProductsQuery.data ?? []) {
      for (const v of p.versions ?? []) map.set(v.id, p.name);
    }
    return map;
  }, [rawProductsQuery.data]);

  const applicationsQuery = useQuery({
    queryKey: ['loan-applications', 'all', 'clientProfilePage'],
    queryFn: () => fetchAllPages<LoanApplication>('/loan-applications'),
  });

  const loans = (loansQuery.data ?? []).filter((l) => l.borrowerId === borrowerId);
  const hasActiveLoan = loans.some((l) => ACTIVE_LOAN_STATUSES.has(l.status));
  // This client's own applications - either the walk-in flow that later converted INTO this
  // client (createdBorrowerId, via Borrower.sourceApplicationId), or a renewal application
  // started directly FROM this client's profile (borrowerId, the "Create Loan Application" flow
  // added 2026-07-14). Newest first, for prefill and display.
  const myApplications = (applicationsQuery.data ?? [])
    .filter((a) => a.createdBorrowerId === borrowerId || a.borrowerId === borrowerId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  // A client cannot have 2 loan applications going at once: a new (renewal) application cannot be
  // started while an earlier one is anything other than DECLINED and hasn't yet produced a loan
  // account (2026-07-14: previously only blocked on PREAPPROVED/PREDECLINED, which let a second
  // application be started while an APPROVED-but-not-yet-converted one was still "waiting to
  // become a loan account" - closed that gap). Mirrors the backend's own check in
  // CreateLoanApplicationUseCase (belt-and-suspenders: this is just the UI gate).
  const hasPendingApplication = myApplications.some((a) => a.status !== 'DECLINED' && !a.createdLoanAccountId);
  const canCreateLoanApplicationNow = canAccessLoanApplications && !hasActiveLoan && !hasPendingApplication;
  // Clickable only once the client has no active/in-arrears loan account AND has an Approved
  // application that hasn't already produced a loan account (mirrors the "Create Loan Account"
  // dialog gating on the Loan Application Detail page, just keyed off the client instead of a
  // single application).
  const approvedApplicationAwaitingLoanAccount = myApplications.find((a) => a.status === 'APPROVED' && !a.createdLoanAccountId);
  const canCreateLoanAccountNow = !hasActiveLoan && approvedApplicationAwaitingLoanAccount !== undefined;

  if (borrowerQuery.isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading client…</p>;
  }

  if (!borrower) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <p className="text-sm text-muted-foreground">Client not found: {borrowerId}</p>
      </div>
    );
  }

  const address = borrower.addresses[0];
  const addressLine = address
    ? toProperCase(
        [address.houseUnitNumber, address.street, address.barangay, address.cityMunicipality, address.province].filter(Boolean).join(', '),
      )
    : '-';
  const num = (v: string) => Number.parseFloat(v) || 0;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
        Real client, migrated from legacy data (CP12) - details, loan history, and Create Loan Account below are live.
      </div>

      {/* Tile grid - two compact columns on large screens */}
      <div className="grid gap-4 lg:grid-cols-2">
      {/* Client basic info tile */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
          <div className="flex items-center gap-3">
            <ApplicantAvatar
              ownerType="BORROWER"
              ownerId={borrower.id}
              initials={((borrower.firstName[0] ?? '') + (borrower.lastName[0] ?? '')).toUpperCase()}
              className="h-10 w-10 shrink-0"
              fallbackClassName="text-sm"
            />
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">{borrower.fullName}</CardTitle>
                <Badge variant="outline" className="text-xs">
                  {borrower.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Loan cycle {borrower.loanCycle}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
          </Button>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> {formatMobileNumber(borrower.mobilePhone1)}
            </div>
            <div className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> {borrower.email ?? '-'}
            </div>
            <div className="col-span-2 flex items-center gap-1.5">
              <Home className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> {addressLine}
            </div>
            {(borrower.addresses[0]?.lengthOfStayMonths != null || borrower.homeOwnership || borrower.addresses[0]?.ownershipStatus) && (
              <div className="col-span-2 -mt-1 flex items-center gap-1.5 pl-5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                {borrower.addresses[0]?.lengthOfStayMonths != null
                  ? `At this address for ${Math.floor(borrower.addresses[0].lengthOfStayMonths / 12)} yr${Math.floor(borrower.addresses[0].lengthOfStayMonths / 12) === 1 ? '' : 's'} ${borrower.addresses[0].lengthOfStayMonths % 12} mo`
                  : 'At this address'}
                {(borrower.homeOwnership || borrower.addresses[0]?.ownershipStatus) && (
                  <> · {borrower.homeOwnership || borrower.addresses[0]?.ownershipStatus}</>
                )}
              </div>
            )}
            <div className="col-span-2 flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {borrower.incomeDetail?.position ?? '-'}, {borrower.incomeDetail?.employerName ?? '-'}
            </div>
            <div className="flex items-center gap-1.5">
              <Landmark className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">Income: </span>
              {borrower.incomeDetail?.monthlyIncome != null ? formatPeso(borrower.incomeDetail.monthlyIncome) : '-'}
            </div>
            <div className="flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">Civil status: </span>
              {toProperCase(borrower.civilStatus) || '-'}
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">DOB: </span>
              {borrower.birthDate ? formatDate(borrower.birthDate) : '-'}
            </div>
            <div className="flex items-center gap-1.5">
              <Cake className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">Age: </span>
              {computeAge(borrower.birthDate) ?? '-'}
            </div>
            <div className="flex items-center gap-1.5">
              <VenusAndMars className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">Gender: </span>
              {toProperCase(borrower.gender) || '-'}
            </div>
            <div className="flex items-center gap-1.5">
              <Flag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">Nationality: </span>
              {toProperCase(borrower.nationality) || '-'}
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">Place of birth: </span>
              {toProperCase(borrower.placeOfBirth) || '-'}
            </div>
            <div className="flex items-center gap-1.5">
              <IdCard className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">SSS: </span>
              {borrower.governmentId?.sssNumber || '-'}
            </div>
            <div className="flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">TIN: </span>
              {borrower.governmentId?.tinNumber || '-'}
            </div>
          </dl>
        </CardContent>
      </Card>

      {canManageMembers && <PortalAccountPanel borrowerId={borrower.id} hasEmail={!!borrower.email} />}

      {(() => {
        // 2026-07-25: everything from here to Recent Activity is drag-to-reorder (see cardOrder
        // state above) - each section's JSX lives as one entry in this map so it can be rendered
        // in whatever order the current user saved, instead of a fixed sequence.
        const cardsById: Record<string, React.ReactNode> = {};

        cardsById.loanApplications = (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
          <CardTitle className="text-sm">Loan Applications</CardTitle>
          {canAccessLoanApplications ? (
            <Button size="sm" disabled={!canCreateLoanApplicationNow} onClick={() => setCreateApplicationOpen(true)}>
              <FilePlus2 className="mr-1.5 h-3.5 w-3.5" /> Create Loan Application
            </Button>
          ) : (
            <Badge variant="outline" className="text-xs">
              Only <RoleAbbr role="MIS" />, <RoleAbbr role="Loan Operation Manager" />, or <RoleAbbr role="CRM" /> can create loan applications
            </Badge>
          )}
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {hasActiveLoan && canAccessLoanApplications && (
            <p className="mb-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              This client still has an active (or in-arrears) loan account - a new application can be started once it's closed.
            </p>
          )}
          {!hasActiveLoan && hasPendingApplication && canAccessLoanApplications && (
            <p className="mb-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              This client already has a loan application that isn't Declined yet and hasn't produced a loan account - only one can
              be open at a time.
            </p>
          )}
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell className="font-medium text-muted-foreground">Date</TableCell>
                <TableCell className="font-medium text-muted-foreground">Category</TableCell>
                <TableCell className="text-right font-medium text-muted-foreground">Requested Amount</TableCell>
                <TableCell className="font-medium text-muted-foreground">Status</TableCell>
                <TableCell className="font-medium text-muted-foreground">Loan Account</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myApplications.map((application) => (
                <TableRow key={application.id} className="cursor-pointer" onClick={() => navigate(`/applications/${application.id}`)}>
                  <TableCell className="text-xs">{formatDate(application.createdAt)}</TableCell>
                  <TableCell>{application.requestedCategory}</TableCell>
                  <TableCell className="text-right">{formatPeso(application.requestedAmount)}</TableCell>
                  <TableCell>
                    <Badge variant={application.status === 'APPROVED' ? 'success' : application.status === 'DECLINED' ? 'destructive' : 'outline'}>
                      {application.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {application.createdLoanAccountId ? (
                      <Link
                        to={`/loans/${application.createdLoanAccountId}`}
                        className="inline-flex items-center gap-1 font-mono text-xs text-primary underline-offset-2 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Landmark className="h-3 w-3" /> {application.createdLoanAccountCode ?? 'View'}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {myApplications.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    No loan applications on record for this client.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
        );

        cardsById.coBorrower = <CoBorrowersCard borrowerId={borrowerId} />;

        cardsById.riskSummary = <RiskPaymentSummaryCard borrowerId={borrowerId} />;

        cardsById.mitigation = <MitigationDetailsCard borrowerId={borrowerId} />;

        cardsById.loanHistory = (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
          <div>
            <CardTitle className="text-sm">Loan History</CardTitle>
            <CardDescription className="text-xs">
              {canCreateLoanAccountNow
                ? 'Ready to originate - the client has an approved application and no active loan.'
                : hasActiveLoan
                  ? "This client still has an active (or in-arrears) loan account."
                  : myApplications.length === 0
                    ? 'This client has no loan application on record yet.'
                    : 'This client has no Approved loan application awaiting a loan account.'}
            </CardDescription>
          </div>
          <Button size="sm" disabled={!canCreateLoanAccountNow} onClick={() => setCreateLoanAccountOpen(true)}>
            <Landmark className="mr-1.5 h-3.5 w-3.5" /> Create Loan Account
          </Button>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell className="font-medium text-muted-foreground">Loan Code</TableCell>
                <TableCell className="font-medium text-muted-foreground">Product</TableCell>
                <TableCell className="font-medium text-muted-foreground">Status</TableCell>
                <TableCell className="text-right font-medium text-muted-foreground">Principal Balance</TableCell>
                <TableCell className="text-right font-medium text-muted-foreground">Interest Balance</TableCell>
                <TableCell className="text-right font-medium text-muted-foreground">Penalty Balance</TableCell>
                <TableCell className="text-right font-medium text-muted-foreground">Fees Balance</TableCell>
                <TableCell className="text-right font-medium text-muted-foreground">Collections Balance</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loans.map((loan) => (
                <TableRow key={loan.id} className="cursor-pointer" onClick={() => navigate(`/loans/${loan.id}`)}>
                  <TableCell className="font-mono text-xs">{loan.loanCode}</TableCell>
                  <TableCell>{versionToProductName.get(loan.loanProductVersionId) ?? '-'}</TableCell>
                  <TableCell>
                    <LoanStatusBadge status={loan.status} isMatured={loan.isMatured} />
                  </TableCell>
                  {(() => {
                    // Not yet Activated - every balance column is genuinely 0 only because the
                    // amortization schedule hasn't been generated yet, not because there's no
                    // obligation. "—" avoids that reading as "nothing owed"/"fully paid". Uses
                    // loan.balances (the remaining balance), not loan.principalAmount (the
                    // original loan amount) - see the Principal Balance display fix.
                    const notYetActivated = loan.status === 'PENDING_APPROVAL' || loan.status === 'APPROVED';
                    return (
                      <>
                        <TableCell className="text-right">{notYetActivated ? '—' : formatPeso(num(loan.balances.principalBalance))}</TableCell>
                        <TableCell className="text-right">{notYetActivated ? '—' : formatPeso(num(loan.balances.interestBalance))}</TableCell>
                        <TableCell className="text-right">{notYetActivated ? '—' : formatPeso(num(loan.balances.penaltyBalance))}</TableCell>
                        <TableCell className="text-right">{notYetActivated ? '—' : formatPeso(num(loan.balances.feesBalance))}</TableCell>
                        <TableCell className="text-right">{notYetActivated ? '—' : formatPeso(num(loan.collectionsBalance))}</TableCell>
                      </>
                    );
                  })()}
                </TableRow>
              ))}
              {loansQuery.isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                    Loading loans…
                  </TableCell>
                </TableRow>
              )}
              {!loansQuery.isLoading && loans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                    No loans on record for this client.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
        );

        // 2026-07-26 (user request): the client-level Attachments card was removed entirely - its
        // documents (plus the merged-in Loan Application ones) already surface on the Loan
        // Account's own Attachments card (LoanDetailPage.tsx), so this was pure duplication with
        // no distinct capability worth keeping. Profile picture upload (above) is unaffected -
        // ApplicantAvatar has its own independent `/attachments?ownerType=BORROWER` query, not tied
        // to this card's rendering.

        cardsById.activityTimeline = (
      <Card>
        <CardHeader className="p-4">
          <CardTitle className="text-sm">Activity Timeline</CardTitle>
          <CardDescription className="text-xs">Log of all actions taken on this client profile by loan officers</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <ProfileActivityTimeline profileType="BORROWER" profileId={borrowerId} showDetailsToggle={false} />
        </CardContent>
      </Card>
        );

        cardsById.recentActivity = <RecentActivityPanel label="Client Profile" entityId={borrowerId} />;

        // 2026-07-26: a staff member's already-saved localStorage cardOrder may still list a
        // since-removed card id (e.g. 'attachments') - filter down to whatever's actually present
        // so it doesn't render an empty draggable slot (same pattern as LoanApplicationDetailPage).
        const visibleCardOrder = cardOrder.filter((id) => cardsById[id] !== undefined);

        return (
          <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleCardDragEnd}>
            <SortableContext items={visibleCardOrder} strategy={verticalListSortingStrategy}>
              {visibleCardOrder.map((id) => (
                <SortableSection
                  key={id}
                  id={id}
                  // 2026-07-26 (user request): Loan History's 8-column balance table was cramped
                  // into a half-width column, forcing horizontal scroll - full-width gives it room
                  // to breathe, same reasoning as Activity Timeline/Recent Activity below.
                  // 2026-08-06 (user request): Risk & Payment Summary made full-width too, one row
                  // per field instead of the cramped 2/4-column grid a half-width card forced.
                  fullWidth={id === 'loanHistory' || id === 'activityTimeline' || id === 'recentActivity' || id === 'riskSummary'}
                >
                  {cardsById[id]}
                </SortableSection>
              ))}
            </SortableContext>
          </DndContext>
        );
      })()}
      </div>

      <RealEditClientDialog open={editOpen} onOpenChange={setEditOpen} borrower={borrower} />

      <Dialog open={createApplicationOpen} onOpenChange={setCreateApplicationOpen}>
        <DialogContent className="max-h-[85vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Loan Application</DialogTitle>
            <DialogDescription>
              Prefilled from {borrower.fullName}&apos;s most recent loan application, as a renewal. Review and edit before submitting.
            </DialogDescription>
          </DialogHeader>
          {createApplicationOpen && (
            <LoanApplicationForm
              prefillFrom={myApplications[0]}
              lockedBorrowerId={borrowerId}
              showChrome={false}
              onCreated={(application) => {
                setCreateApplicationOpen(false);
                navigate(`/applications/${application.id}`);
              }}
              onCancel={() => setCreateApplicationOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={createLoanAccountOpen} onOpenChange={setCreateLoanAccountOpen}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Loan Account</DialogTitle>
            <DialogDescription>For {borrower.fullName}. Review before submitting.</DialogDescription>
          </DialogHeader>
          {createLoanAccountOpen && (
            <LoanAccountForm
              lockedBorrower={borrower}
              prefillTermMonths={approvedApplicationAwaitingLoanAccount?.requestedTermMonths}
              sourceApplicationId={approvedApplicationAwaitingLoanAccount?.id}
              showChrome={false}
              onCreated={(loan) => {
                setCreateLoanAccountOpen(false);
                queryClient.invalidateQueries({ queryKey: ['loan-accounts', 'all'] });
                queryClient.invalidateQueries({ queryKey: ['loan-application', 'all'] });
                navigate(`/loans/${loan.id}`);
              }}
              onCancel={() => setCreateLoanAccountOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ClientProfilePage() {
  const { borrowerId } = useParams<{ borrowerId: string }>();
  const navigate = useNavigate();

  useLogPageView('Client Profile', borrowerId);

  if (!borrowerId) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <p className="text-sm text-muted-foreground">No client specified.</p>
      </div>
    );
  }

  return <RealClientProfileView borrowerId={borrowerId} />;
}
