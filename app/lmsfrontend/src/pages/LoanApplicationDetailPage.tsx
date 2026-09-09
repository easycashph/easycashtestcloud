import * as React from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableSection } from '@/components/SortableSection';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Cake,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Download,
  ExternalLink,
  Flag,
  Heart,
  Home,
  IdCard,
  Landmark,
  Lock,
  Mail,
  MapPin,
  MoreVertical,
  Loader2,
  Pencil,
  Phone,
  Plus,
  Printer,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  User as UserIcon,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/NumberInput';
import { computeAge } from '@/lib/computeAge';
import { PhoneInput } from '@/components/PhoneInput';
import { GroupedDigitsInput } from '@/components/GroupedDigitsInput';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { RoleAbbr } from '@/components/RoleAbbr';
import { AttachmentsPanel } from '@/components/AttachmentsPanel';
import { ProfileNotesPanel } from '@/components/ProfileNotesPanel';
import { ApplicantAvatar } from '@/components/ApplicantAvatar';
import { type AddressDraft, emptyAddressDraft, PsgcAddressPicker } from '@/components/PsgcAddressPicker';
import { ProfileActivityTimeline } from '@/components/ProfileActivityTimeline';
import { TermTip } from '@/components/TermTip';
import { LoanAccountForm } from '@/pages/LoanAccountCreatePage';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { apiClient, downloadFile, fetchAllPages, fetchFileBlob } from '@/lib/apiClient';
import type { Attachment } from '@/lib/documentApiTypes';
import { classifyProductType } from '@/lib/productTypeClassification';
import { productTypeLabel, useProductTypeLabels } from '@/lib/productTypeLabels';
import type {
  AgencyVerificationDetails,
  AiDocumentReviewResult,
  CreditBureauPartyCheck,
  DocumentVerificationEntry,
  DocumentVerificationStatus,
  LoanApplication,
  MitigationDetails,
  SubmitReviewReportRequest,
  UpdateLoanApplicationRequest,
} from '@/lib/loanApplicationApiTypes';
import type { Borrower, LoanProduct } from '@/lib/loanApiTypes';
import type { User } from '@/lib/userApiTypes';
import { STATUS_DISPLAY_LABEL } from '@/lib/loanApplicationStatusLabels';
import { cn, formatDate, formatMobileNumber, formatPeso, toProperCase } from '@/lib/utils';

/** 2026-07-26 (user request) - icon-labeled `<dt>` for the summary cards' dl/dt/dd fields,
 * matching the icon+label pattern already used on ClientProfilePage's client info card. */
function IconDt({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <dt className="flex items-center gap-1.5 text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {children}
    </dt>
  );
}

/** 2026-09-09 (user request) - groups Personal & Household Information's fields into labeled
 * sections (Personal/Residence/Employment & IDs) with a zebra-striped row treatment, instead of
 * one long flat two-column list - the card was hard to scan with 11 fields all reading the same. */
function PersonalInfoGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="grid gap-0.5">{children}</div>
    </div>
  );
}

function PersonalInfoRow({
  icon: Icon,
  label,
  value,
  tabularNums,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number | null | undefined;
  tabularNums?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded px-2 py-1.5 text-sm odd:bg-muted/40">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {label}
      </span>
      <span className={`font-medium ${tabularNums ? 'tabular-nums' : ''}`}>{value ?? '-'}</span>
    </div>
  );
}

/** 2026-09-09 (user request) - a visual pipeline stepper for the header, replacing the status
 * badge as the only progress indicator. Mirrors the same four stages the rest of this page already
 * gates on (isPreApprovalStage/isUnderReview/isPreApproval/isDecided) - purely presentational, no
 * new status logic. DECLINED renders as a failed fourth stage rather than a completed "Approved"
 * one; PREDECLINED (the system's advisory pre-check, not a real decline) still shows as stage 1
 * in progress, matching how it doesn't block Start Review elsewhere on this page. */
function PipelineStepper({ status }: { status: LoanApplication['status'] }) {
  const isDeclined = status === 'DECLINED';
  const stageIndex = status === 'APPROVED' || isDeclined ? 3 : status === 'PRE_APPROVAL' ? 2 : status === 'UNDER_REVIEW' ? 1 : 0;
  const stages = ['Pre-qualified', 'Under Review', 'Pre-approval', isDeclined ? 'Declined' : 'Approved'];
  return (
    <div className="mt-3 flex items-center">
      {stages.map((label, i) => (
        <React.Fragment key={label}>
          <div className="flex shrink-0 items-center gap-1.5">
            <div
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium',
                i < stageIndex && 'bg-primary text-primary-foreground',
                i === stageIndex && !isDeclined && 'bg-primary text-primary-foreground',
                i === stageIndex && isDeclined && 'bg-destructive text-destructive-foreground',
                i > stageIndex && 'bg-muted text-muted-foreground',
              )}
            >
              {i < stageIndex ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : i === stageIndex && isDeclined ? (
                <XCircle className="h-3 w-3" />
              ) : (
                i + 1
              )}
            </div>
            <span className={cn('text-xs', i <= stageIndex ? 'font-medium' : 'text-muted-foreground')}>{label}</span>
          </div>
          {i < stages.length - 1 && <div className={cn('mx-2 h-px flex-1', i < stageIndex ? 'bg-primary' : 'bg-border')} />}
        </React.Fragment>
      ))}
    </div>
  );
}

/** Best-effort split of a free-text full name into first/middle/last for the create-client
 * form's initial prefill - staff can still edit every field before submitting, so an imperfect
 * split (e.g. multi-word surnames) is never silently wrong, just a starting point. */
function splitApplicantName(fullName: string): { firstName: string; middleName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? '', middleName: '', lastName: '' };
  if (parts.length === 2) return { firstName: parts[0], middleName: '', lastName: parts[1] };
  return { firstName: parts[0], middleName: parts.slice(1, -1).join(' '), lastName: parts[parts.length - 1] };
}

/** The intake form stores the co-borrower as one combined string, e.g. "Jane Doe (spouse)" - this
 * splits it back into a name and relationship for the Create Client Profile review form. */
function parseCoBorrowerName(coBorrowerName: string): { name: string; relationship: string } {
  const match = coBorrowerName.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match) return { name: match[1].trim(), relationship: match[2].trim() };
  return { name: coBorrowerName.trim(), relationship: '' };
}

/**
 * Prefilled from the APPROVED application's own fields, including gender, civil status, present
 * address, employer, and monthly income (2026-07-14: `POST /borrowers` gained `addresses` and
 * `incomeDetail.monthlyIncome` support specifically so this dialog could stop dropping them).
 * Everything the application captured is editable here before creating the real record. If the
 * application recorded a co-borrower, offers to also create that person's real `CoBorrower` record
 * via `POST /co-borrowers` (ADR-015 leaves the borrower<->co-borrower linking mechanism open, so
 * this only creates the standalone person record, same as that endpoint always has).
 */
function CreateClientProfileDialog({
  open,
  onOpenChange,
  application,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: LoanApplication;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const initialSplit = React.useMemo(() => splitApplicantName(application.applicantName), [application.applicantName]);
  const [firstName, setFirstName] = React.useState(initialSplit.firstName);
  const [middleName, setMiddleName] = React.useState(initialSplit.middleName);
  const [lastName, setLastName] = React.useState(initialSplit.lastName);
  const [gender, setGender] = React.useState(application.gender ?? '');
  const [civilStatus, setCivilStatus] = React.useState(application.civilStatus ?? '');
  const [birthDate, setBirthDate] = React.useState(application.birthDate ? application.birthDate.slice(0, 10) : '');
  const [placeOfBirth, setPlaceOfBirth] = React.useState(application.placeOfBirth ?? '');
  const [nationality, setNationality] = React.useState(application.nationality ?? '');
  const [homeOwnership, setHomeOwnership] = React.useState(application.homeOwnership ?? '');
  const [mobilePhone1, setMobilePhone1] = React.useState(application.mobilePhone ?? '');
  const [email, setEmail] = React.useState(application.email ?? '');
  const [facebookLink, setFacebookLink] = React.useState(application.facebookLink ?? '');
  const [employer, setEmployer] = React.useState(application.employer ?? '');
  const [occupation, setOccupation] = React.useState(application.occupation ?? '');
  const [officeAddress, setOfficeAddress] = React.useState(application.officeAddress ?? '');
  const [monthlyIncome, setMonthlyIncome] = React.useState(String(application.monthlyIncome ?? ''));
  const [addressDraft, setAddressDraft] = React.useState<AddressDraft>({
    houseUnitNumber: application.houseUnitNumber ?? '',
    street: application.street ?? '',
    barangay: application.barangay ?? '',
    cityMunicipality: application.cityMunicipality ?? '',
    province: application.province ?? '',
    zipCode: application.zipCode ?? '',
  });
  // 2026-08-27 (user request): captured as separate Years/Months inputs (matching
  // ClientCreatePage.tsx's own convention), combined into total months on submit - not part of the
  // shared `AddressDraft` type since, like `homeOwnership` above, it's a top-level field here rather
  // than a PSGC-address concern.
  const [presentStayYears, setPresentStayYears] = React.useState(
    application.presentAddressLengthOfStayMonths != null ? String(Math.floor(application.presentAddressLengthOfStayMonths / 12)) : '',
  );
  const [presentStayMonths, setPresentStayMonths] = React.useState(
    application.presentAddressLengthOfStayMonths != null ? String(application.presentAddressLengthOfStayMonths % 12) : '',
  );
  const [tinNumber, setTinNumber] = React.useState(application.tinNumber ?? '');
  const [sssNumber, setSssNumber] = React.useState(application.sssNumber ?? '');
  const [dependants, setDependants] = React.useState(application.dependants);
  const [reference1Name, setReference1Name] = React.useState(application.reference1Name ?? '');
  const [reference1Mobile, setReference1Mobile] = React.useState(application.reference1Mobile ?? '');
  const [reference2Name, setReference2Name] = React.useState(application.reference2Name ?? '');
  const [reference2Mobile, setReference2Mobile] = React.useState(application.reference2Mobile ?? '');
  const [note, setNote] = React.useState(application.note ?? '');

  const coBorrowerParsed = React.useMemo(
    () => (application.coBorrowerName ? parseCoBorrowerName(application.coBorrowerName) : null),
    [application.coBorrowerName],
  );
  // Prefer the structured first/middle/last fields (2026-07-25+ intakes); fall back to splitting
  // the legacy combined "name (relationship)" string for older applications.
  const coBorrowerSplit = React.useMemo(
    () =>
      application.coBorrowerFirstName || application.coBorrowerLastName
        ? {
            firstName: application.coBorrowerFirstName ?? '',
            middleName: application.coBorrowerMiddleName ?? '',
            lastName: application.coBorrowerLastName ?? '',
          }
        : coBorrowerParsed
          ? splitApplicantName(coBorrowerParsed.name)
          : null,
    [application, coBorrowerParsed],
  );
  const [includeCoBorrower, setIncludeCoBorrower] = React.useState(Boolean(application.coBorrowerName));
  const [coBorrowerFirstName, setCoBorrowerFirstName] = React.useState(coBorrowerSplit?.firstName ?? '');
  const [coBorrowerMiddleName, setCoBorrowerMiddleName] = React.useState(coBorrowerSplit?.middleName ?? '');
  const [coBorrowerLastName, setCoBorrowerLastName] = React.useState(coBorrowerSplit?.lastName ?? '');
  const [coBorrowerRelationship, setCoBorrowerRelationship] = React.useState(coBorrowerParsed?.relationship ?? '');
  const [coBorrowerEmployer, setCoBorrowerEmployer] = React.useState(application.coBorrowerEmployer ?? '');
  const [coBorrowerPhoneNumber, setCoBorrowerPhoneNumber] = React.useState(application.coBorrowerContactNumber ?? '');
  const [coBorrowerEmail, setCoBorrowerEmail] = React.useState(application.coBorrowerEmail ?? '');
  const [coBorrowerAddressDraft, setCoBorrowerAddressDraft] = React.useState<AddressDraft>(emptyAddressDraft());

  React.useEffect(() => {
    if (!open) return;
    const split = splitApplicantName(application.applicantName);
    setFirstName(split.firstName);
    setMiddleName(split.middleName);
    setLastName(split.lastName);
    setGender(application.gender ?? '');
    setCivilStatus(application.civilStatus ?? '');
    setBirthDate(application.birthDate ? application.birthDate.slice(0, 10) : '');
    setPlaceOfBirth(application.placeOfBirth ?? '');
    setNationality(application.nationality ?? '');
    setHomeOwnership(application.homeOwnership ?? '');
    setPresentStayYears(
      application.presentAddressLengthOfStayMonths != null ? String(Math.floor(application.presentAddressLengthOfStayMonths / 12)) : '',
    );
    setPresentStayMonths(application.presentAddressLengthOfStayMonths != null ? String(application.presentAddressLengthOfStayMonths % 12) : '');
    setMobilePhone1(application.mobilePhone ?? '');
    setEmail(application.email ?? '');
    setFacebookLink(application.facebookLink ?? '');
    setEmployer(application.employer ?? '');
    setOccupation(application.occupation ?? '');
    setOfficeAddress(application.officeAddress ?? '');
    setMonthlyIncome(String(application.monthlyIncome ?? ''));
    setAddressDraft({
      houseUnitNumber: application.houseUnitNumber ?? '',
      street: application.street ?? '',
      barangay: application.barangay ?? '',
      cityMunicipality: application.cityMunicipality ?? '',
      province: application.province ?? '',
      zipCode: application.zipCode ?? '',
    });
    setTinNumber(application.tinNumber ?? '');
    setSssNumber(application.sssNumber ?? '');
    setDependants(application.dependants);
    setReference1Name(application.reference1Name ?? '');
    setReference1Mobile(application.reference1Mobile ?? '');
    setReference2Name(application.reference2Name ?? '');
    setReference2Mobile(application.reference2Mobile ?? '');
    setNote(application.note ?? '');

    const parsed = application.coBorrowerName ? parseCoBorrowerName(application.coBorrowerName) : null;
    const coSplit =
      application.coBorrowerFirstName || application.coBorrowerLastName
        ? {
            firstName: application.coBorrowerFirstName ?? '',
            middleName: application.coBorrowerMiddleName ?? '',
            lastName: application.coBorrowerLastName ?? '',
          }
        : parsed
          ? splitApplicantName(parsed.name)
          : null;
    setIncludeCoBorrower(Boolean(application.coBorrowerName));
    setCoBorrowerFirstName(coSplit?.firstName ?? '');
    setCoBorrowerMiddleName(coSplit?.middleName ?? '');
    setCoBorrowerLastName(coSplit?.lastName ?? '');
    setCoBorrowerRelationship(parsed?.relationship ?? '');
    setCoBorrowerEmployer(application.coBorrowerEmployer ?? '');
    setCoBorrowerPhoneNumber(application.coBorrowerContactNumber ?? '');
    setCoBorrowerEmail(application.coBorrowerEmail ?? '');
    setCoBorrowerAddressDraft(emptyAddressDraft());
  }, [open, application]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const references = [
        reference1Name.trim() ? { firstName: reference1Name.trim(), phoneNumber: reference1Mobile.trim() || undefined } : null,
        reference2Name.trim() ? { firstName: reference2Name.trim(), phoneNumber: reference2Mobile.trim() || undefined } : null,
      ].filter((r): r is { firstName: string; phoneNumber: string | undefined } => r !== null);

      const borrower = await apiClient.post<Borrower>('/borrowers', {
        branchId: application.branchId,
        sourceApplicationId: application.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        middleName: middleName.trim() || undefined,
        gender: gender || undefined,
        civilStatus: civilStatus || undefined,
        birthDate: birthDate || undefined,
        placeOfBirth: placeOfBirth.trim() || undefined,
        nationality: nationality.trim() || undefined,
        homeOwnership: homeOwnership || undefined,
        mobilePhone1: mobilePhone1.trim() || undefined,
        email: email.trim() || undefined,
        facebookLink: facebookLink.trim() || undefined,
        dependants: dependants && dependants.length > 0 ? dependants : undefined,
        note: note.trim() || undefined,
        incomeDetail:
          employer.trim() || occupation.trim() || officeAddress.trim() || Number(monthlyIncome) > 0
            ? {
                employerName: employer.trim() || undefined,
                position: occupation.trim() || undefined,
                employerAddress: officeAddress.trim() || undefined,
                monthlyIncome: Number(monthlyIncome) > 0 ? Number(monthlyIncome) : undefined,
              }
            : undefined,
        governmentId:
          tinNumber.trim() || sssNumber.trim() ? { tinNumber: tinNumber.trim() || undefined, sssNumber: sssNumber.trim() || undefined } : undefined,
        characterReferences: references.length > 0 ? references : undefined,
        addresses:
          Object.values(addressDraft).some((v) => v.trim()) || homeOwnership || presentStayYears.trim() || presentStayMonths.trim()
            ? [
                {
                  ...addressDraft,
                  ownershipStatus: homeOwnership || undefined,
                  lengthOfStayMonths:
                    presentStayYears.trim() || presentStayMonths.trim()
                      ? (Number.parseInt(presentStayYears, 10) || 0) * 12 + (Number.parseInt(presentStayMonths, 10) || 0)
                      : undefined,
                },
              ]
            : undefined,
      });

      // Best-effort: capturing the co-borrower is a separate write from creating the client
      // profile itself - a failure here must never block navigation to the newly-created client.
      if (includeCoBorrower && coBorrowerFirstName.trim() && coBorrowerLastName.trim()) {
        try {
          await apiClient.post('/co-borrowers', {
            borrowerId: borrower.id,
            firstName: coBorrowerFirstName.trim(),
            middleName: coBorrowerMiddleName.trim() || undefined,
            lastName: coBorrowerLastName.trim(),
            relationship: coBorrowerRelationship.trim() || undefined,
            employer: coBorrowerEmployer.trim() || undefined,
            phoneNumber: coBorrowerPhoneNumber.trim() || undefined,
            emailAddress: coBorrowerEmail.trim() || undefined,
            addresses: Object.values(coBorrowerAddressDraft).some((v) => v.trim()) ? [coBorrowerAddressDraft] : undefined,
          });
        } catch {
          // Swallowed - see comment above.
        }
      }

      return borrower;
    },
    onSuccess: (borrower) => {
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['loan-application', application.id] });
      navigate(`/clients/${borrower.id}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Client Profile</DialogTitle>
          <DialogDescription>
            Prefilled from {application.applicantName}'s approved application. Review before creating - this becomes the
            client's real record.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>
              First Name<span className="text-destructive"> *</span>
            </Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>
              Last Name<span className="text-destructive"> *</span>
            </Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Middle Name</Label>
            <Input value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Gender</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MALE">Male</SelectItem>
                <SelectItem value="FEMALE">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Civil Status</Label>
            <Select value={civilStatus} onValueChange={setCivilStatus}>
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
            <Label>Date of Birth</Label>
            <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            {computeAge(birthDate) !== null && <p className="text-xs text-muted-foreground">Age: {computeAge(birthDate)}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Place of Birth</Label>
            <Input value={placeOfBirth} onChange={(e) => setPlaceOfBirth(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Nationality</Label>
            <Input value={nationality} onChange={(e) => setNationality(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Home Ownership</Label>
            <Select value={homeOwnership} onValueChange={setHomeOwnership}>
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
            <Label>Length of Stay (Years)</Label>
            <Input type="number" min="0" value={presentStayYears} onChange={(e) => setPresentStayYears(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Length of Stay (Months)</Label>
            <Input type="number" min="0" max="11" value={presentStayMonths} onChange={(e) => setPresentStayMonths(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Contact Number</Label>
            <PhoneInput value={mobilePhone1} onChange={(e) => setMobilePhone1(e.target.value)} placeholder="917 XXX XXXX" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Facebook Link</Label>
            <Input value={facebookLink} onChange={(e) => setFacebookLink(e.target.value)} placeholder="https://facebook.com/username" />
          </div>
        </div>

        <div className="border-t pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Present Address</p>
          <PsgcAddressPicker value={addressDraft} onChange={(patch) => setAddressDraft((prev) => ({ ...prev, ...patch }))} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 border-t pt-3">
          <div className="sm:col-span-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Employment</div>
          <div className="space-y-1.5">
            <Label>Employer</Label>
            <Input value={employer} onChange={(e) => setEmployer(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Occupation</Label>
            <Input value={occupation} onChange={(e) => setOccupation(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Office Address</Label>
            <Input value={officeAddress} onChange={(e) => setOfficeAddress(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Monthly Income</Label>
            <NumberInput min="0" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <Label>TIN</Label>
            <GroupedDigitsInput value={tinNumber} onChange={(e) => setTinNumber(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>SSS No.</Label>
            <GroupedDigitsInput value={sssNumber} onChange={(e) => setSssNumber(e.target.value)} />
          </div>
        </div>

        {dependants && dependants.length > 0 && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dependants</p>
            {dependants.map((dep, i) => (
              <div key={i} className="grid grid-cols-3 gap-2">
                <Input
                  value={dep.name}
                  onChange={(e) =>
                    setDependants((prev) => (prev ?? []).map((d, j) => (j === i ? { ...d, name: e.target.value.toUpperCase() } : d)))
                  }
                  placeholder="Name"
                />
                <Input
                  value={dep.age ?? ''}
                  onChange={(e) => setDependants((prev) => (prev ?? []).map((d, j) => (j === i ? { ...d, age: e.target.value } : d)))}
                  placeholder="Age"
                />
                <Input
                  value={dep.relationship ?? ''}
                  onChange={(e) =>
                    setDependants((prev) => (prev ?? []).map((d, j) => (j === i ? { ...d, relationship: e.target.value } : d)))
                  }
                  placeholder="Relationship"
                />
              </div>
            ))}
          </div>
        )}

        {(reference1Name || reference2Name) && (
          <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
            <p className="sm:col-span-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Character References</p>
            <div className="space-y-1.5">
              <Label>1st Reference Name</Label>
              <Input value={reference1Name} onChange={(e) => setReference1Name(e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-1.5">
              <Label>1st Reference Contact Number</Label>
              <Input value={reference1Mobile} onChange={(e) => setReference1Mobile(e.target.value)} placeholder="09XX XXX XXXX" />
            </div>
            <div className="space-y-1.5">
              <Label>2nd Reference Name</Label>
              <Input value={reference2Name} onChange={(e) => setReference2Name(e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-1.5">
              <Label>2nd Reference Contact Number</Label>
              <Input value={reference2Mobile} onChange={(e) => setReference2Mobile(e.target.value)} placeholder="09XX XXX XXXX" />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Note</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </div>

        {coBorrowerParsed && (
          <div className="space-y-3 rounded-md border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={includeCoBorrower} onChange={(e) => setIncludeCoBorrower(e.target.checked)} />
              Also create this application's co-borrower ({coBorrowerParsed.name})
            </label>
            {includeCoBorrower && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>
                    Co-Borrower First Name<span className="text-destructive"> *</span>
                  </Label>
                  <Input value={coBorrowerFirstName} onChange={(e) => setCoBorrowerFirstName(e.target.value.toUpperCase())} />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    Co-Borrower Last Name<span className="text-destructive"> *</span>
                  </Label>
                  <Input value={coBorrowerLastName} onChange={(e) => setCoBorrowerLastName(e.target.value.toUpperCase())} />
                </div>
                <div className="space-y-1.5">
                  <Label>Co-Borrower Middle Name</Label>
                  <Input value={coBorrowerMiddleName} onChange={(e) => setCoBorrowerMiddleName(e.target.value.toUpperCase())} />
                </div>
                <div className="space-y-1.5">
                  <Label>Co-Borrower Phone Number</Label>
                  <PhoneInput value={coBorrowerPhoneNumber} onChange={(e) => setCoBorrowerPhoneNumber(e.target.value)} placeholder="917 XXX XXXX" />
                </div>
                <div className="space-y-1.5">
                  <Label>Co-Borrower Email</Label>
                  <Input type="email" value={coBorrowerEmail} onChange={(e) => setCoBorrowerEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Relationship to Applicant</Label>
                  <Input value={coBorrowerRelationship} onChange={(e) => setCoBorrowerRelationship(e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Co-Borrower Employer</Label>
                  <Input value={coBorrowerEmployer} onChange={(e) => setCoBorrowerEmployer(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Co-Borrower Address</p>
                  <PsgcAddressPicker
                    value={coBorrowerAddressDraft}
                    onChange={(patch) => setCoBorrowerAddressDraft((prev) => ({ ...prev, ...patch }))}
                  />
                </div>
              </div>
            )}
            {includeCoBorrower && (!coBorrowerFirstName.trim() || !coBorrowerLastName.trim()) && (
              <p className="text-sm text-destructive">
                Co-Borrower First Name and Last Name are required to save the co-borrower - leave both blank (or uncheck the box) to skip
                creating one, otherwise fill them in.
              </p>
            )}
          </div>
        )}

        <div className="rounded-md border bg-secondary/30 p-3 text-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            From the application (reference only - add via "Edit Client Details" after creating)
          </p>
          <dl className="grid grid-cols-2 gap-y-1.5">
            <dt className="text-muted-foreground">Age</dt>
            <dd className="text-right">{application.age ?? '-'}</dd>
            <dt className="text-muted-foreground">Address</dt>
            <dd className="text-right">{toProperCase(application.address) || '-'}</dd>
            <dt className="text-muted-foreground">Employer</dt>
            <dd className="text-right">{application.employer ?? '-'}</dd>
            <dt className="text-muted-foreground">Monthly income</dt>
            <dd className="text-right">{application.monthlyIncome !== null ? formatPeso(application.monthlyIncome) : '-'}</dd>
          </dl>
        </div>

        {createMutation.isError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {createMutation.error instanceof Error ? createMutation.error.message : 'Could not create the client profile.'}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={
              !firstName.trim() ||
              !lastName.trim() ||
              (includeCoBorrower && (!coBorrowerFirstName.trim() || !coBorrowerLastName.trim())) ||
              createMutation.isPending
            }
          >
            Create Client Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const LOAN_TYPE_OPTIONS = ['Business Loan', 'Salary Loan', 'Seafarer Loan'] as const;
type LoanTypeOption = (typeof LOAN_TYPE_OPTIONS)[number];

// 2026-07-25 (user request, same pattern as LoanDetailPage/ClientProfilePage's cardOrder): every
// section on this page is drag-to-reorder - each staff member's own arrangement, saved per-user in
// localStorage. Applicant/Co-Borrower/Requested Loan render inside the same 2-column grid as the
// rest (see the grid wrapper around the SortableContext below), so they can be dragged just like
// any other section despite sharing that layout. AI document review/underwriting/notes are only
// shown once a manual review has actually started - they're still in this ideal ordering, but
// `cardsById` only gets an entry for them when applicable, and the render below filters cardOrder
// down to whatever's actually present, so a hidden section leaves no dangling empty slot.
const DEFAULT_CARD_ORDER = [
  'applicantDetails',
  'requestedLoan',
  'personalHousehold',
  'coBorrowerDetails',
  'attachments',
  'aiReview',
  'underwriting',
  'notes',
  'activityTimeline',
  'recentActivity',
];
// 2026-09-09 (user request): ".v4" forces every officer onto the new default order below
// (Recent Loan Application Activity Logs moved to the very bottom, past Activity Timeline) - same
// key-version-bump technique ClientProfilePage.tsx used for its own default-order change, so it
// applies even to an officer who already has a saved custom order under an older key.
const CARD_ORDER_KEY_PREFIX = 'lms.loanApplicationDetailCardOrder.v4';
function cardOrderKey(userId: string): string {
  return `${CARD_ORDER_KEY_PREFIX}:${userId}`;
}

/** Mirrors LoanApplicationsPage's STATUS_BADGE_VARIANT - kept local since this file doesn't
 * otherwise import from that page. */
const DETAIL_STATUS_BADGE_VARIANT: Record<LoanApplication['status'], 'secondary' | 'warning' | 'success' | 'destructive'> = {
  PREAPPROVED: 'secondary',
  PREDECLINED: 'warning',
  UNDER_REVIEW: 'secondary',
  PRE_APPROVAL: 'secondary',
  APPROVED: 'success',
  DECLINED: 'destructive',
};

/**
 * 2026-07-16: previously a hand-maintained whitelist confirmed with the business 2026-07-10 - it
 * went stale (new active product classes like SML-Max/SML-Lite/SML-Deluxe etc. never appeared
 * here, and some it did list - e.g. SML-Quick Cash - had drifted out of sync with which products
 * are actually still active). Replaced with a live derivation from the same `/loan-products`
 * catalog + `classifyProductType` grouping the Create Loan Account form already uses, so this can
 * never go stale again. Still still-real-but-legacy products marked "discontinued" (no longer
 * offered to new applicants, but still assignable so existing loans under them stay usable) - kept
 * as a small static hint set rather than re-deriving it (nothing in the product catalog encodes
 * that distinction), so a name only needs to be added here if/when the business discontinues it.
 */
const KNOWN_DISCONTINUED_PRODUCT_NAMES = new Set([
  'SL-Snap-A',
  'SL-Snap-B',
  'SL-Online',
  'SL-Online_New',
  'SL-Lazada',
  'SL-Lazada -New',
  'SL-Lazada-Promo',
  'SML-Kaborrow',
  'SML-PDC',
  'SML-Co-Borrower Allotment',
  'SML-Self Allotment',
]);

function findLoanTypeForProductName(productName: string): LoanTypeOption | null {
  const type = classifyProductType(productName);
  return (LOAN_TYPE_OPTIONS as readonly string[]).includes(type) ? (type as LoanTypeOption) : null;
}

/** One pass/fail row of the decision-scoring breakdown - mirrors the backend's
 * `PreQualificationCheck` shape exactly (label + detail text already composed server-side). */
function DecisionScoringRow({ passed, label, detail }: { passed: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-2 py-1">
      {passed ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

/**
 * "Create Loan Account" dialog - moved here from the Client Profile page (2026-07-14) so it's
 * gated per-application (visible once this application's client exists, clickable once this
 * specific application is Approved) rather than per-client. Wraps the same full `LoanAccountForm`
 * used by the standalone `/loans/new` page (MIS Nomer's origination-fees/net-proceeds/schedule-
 * preview build) - copied here as dialog content rather than a stripped-down form, so staff get
 * the exact same computations regardless of which entry point they used.
 */
function CreateLoanAccountDialog({
  open,
  onOpenChange,
  borrower,
  requestedTermMonths,
  applicationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  borrower: Borrower;
  requestedTermMonths?: number;
  applicationId: string;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Loan Account</DialogTitle>
          <DialogDescription>From {borrower.fullName}&apos;s approved application. Review before submitting.</DialogDescription>
        </DialogHeader>
        {open && (
          <LoanAccountForm
            lockedBorrower={borrower}
            prefillTermMonths={requestedTermMonths}
            sourceApplicationId={applicationId}
            showChrome={false}
            onCreated={(loan) => {
              onOpenChange(false);
              queryClient.invalidateQueries({ queryKey: ['loan-accounts', 'all'] });
              queryClient.invalidateQueries({ queryKey: ['loan-application', 'all'] });
              navigate(`/loans/${loan.id}`);
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** General lending-industry rule of thumb (not an Easycash-specific policy, and not a hard
 * pass/fail gate here - purely informational context for the underwriter, same posture as every
 * other advisory figure on this card). */
function dtiBandClass(dtiPercent: number): string {
  if (dtiPercent <= 30) return 'text-success';
  if (dtiPercent <= 40) return 'text-warning';
  return 'text-destructive';
}

/** 2026-09-09 (user request) - a visual gauge for the DTI figure above, replacing a plain percentage
 * with something scannable at a glance. Colored via `dtiBandClass` on the wrapping element so the
 * arc/text inherit it through `currentColor` - one color decision, not two. */
function DtiGauge({ percent }: { percent: number }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(percent, 100));
  const offset = circumference * (1 - clamped / 100);
  return (
    <svg width="72" height="72" viewBox="0 0 90 90" role="img" aria-label={`Debt to income ratio ${percent.toFixed(1)} percent`}>
      <circle cx="45" cy="45" r={radius} fill="none" className="stroke-muted" strokeWidth="8" />
      <circle
        cx="45"
        cy="45"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 45 45)"
      />
      <text x="45" y="41" textAnchor="middle" fontSize="15" fontWeight="600" fill="currentColor">
        {percent.toFixed(1)}%
      </text>
      <text x="45" y="55" textAnchor="middle" fontSize="9" className="fill-muted-foreground">
        DTI
      </text>
    </svg>
  );
}

const CREDIT_BUREAU_PARTY_FIELDS: { key: keyof CreditBureauPartyCheck; label: string }[] = [
  { key: 'cmap', label: 'CMAP' },
  { key: 'kyc', label: 'KYC' },
  { key: 'myscore', label: 'Myscore' },
];

const MITIGATION_FIELDS: { key: keyof MitigationDetails; label: string }[] = [
  { key: 'bank', label: 'Bank' },
  { key: 'branch', label: 'Branch' },
  { key: 'accountName', label: 'Account name' },
  { key: 'accountNumber', label: 'Account number' },
  { key: 'atmCardNumber', label: 'ATM card number' },
  { key: 'allotmentAmount', label: 'Assigned allotment amount' },
];

/** 2026-07-25 (user decision): agencyName/position/vessel are no longer required to Tag as Pre
 * Approval - the backend's matching gate (`MissingAgencyVerificationError` in
 * `TagLoanApplicationPreApprovalUseCase`) was removed at the same time. Fields remain on the form
 * for staff who choose to fill them in, just no longer block progression when left blank. */
const AGENCY_CORE_FIELDS: { key: keyof AgencyVerificationDetails; label: string; required?: boolean }[] = [
  { key: 'agencyName', label: 'Agency name' },
  { key: 'position', label: 'Position' },
  { key: 'vessel', label: 'Vessel' },
  { key: 'agencyContactNumbers', label: 'Agency contact number/s' },
  { key: 'agencyAddress', label: 'Agency address' },
];

/**
 * 2026-07-23: everything past the 3 required fields (+ contact/address) used to render as one
 * flat 27-field grid, all expanded at once whenever the section was opened - felt like "fill in
 * everything" even though only 3 fields ever block Pre Approval. Regrouped into collapsible
 * sections (rendered below AGENCY_CORE_FIELDS) so only a handful of fields show by default; no
 * field was renamed, removed, or made required/optional differently than before.
 */
const AGENCY_FIELD_GROUPS: { key: string; label: string; fields: { key: keyof AgencyVerificationDetails; label: string }[] }[] = [
  {
    key: 'employment',
    label: 'Employment and contract',
    fields: [
      { key: 'yearsWithAgency', label: 'Years with agency' },
      { key: 'basicMonthlySalary', label: 'Basic monthly salary' },
      { key: 'contractDuration', label: 'Contract duration' },
      { key: 'joiningPort', label: 'Joining port' },
      { key: 'dateOfDeparture', label: 'Date of departure' },
      { key: 'departureStatus', label: 'Departure details (Ticketed/Booked/For booking/Tentative)' },
      { key: 'expectedSignOffDate', label: 'Expected date of sign-off' },
      { key: 'monthlySalary', label: 'Monthly salary' },
    ],
  },
  {
    key: 'allotment',
    label: 'Allotment and payroll',
    fields: [
      { key: 'allottee1Name', label: 'Allottee 1 - name' },
      { key: 'allottee1Bank', label: 'Allottee 1 - bank / branch' },
      { key: 'allottee1AccountNumber', label: 'Allottee 1 - account number' },
      { key: 'allottee1Amount', label: 'Allottee 1 - allotment amount' },
      { key: 'allottee2Name', label: 'Allottee 2 - name (optional)' },
      { key: 'allottee2Bank', label: 'Allottee 2 - bank / branch' },
      { key: 'allottee2AccountNumber', label: 'Allottee 2 - account number' },
      { key: 'allottee2Amount', label: 'Allottee 2 - allotment amount' },
      { key: 'payrollSchedule', label: 'Payroll / allotment schedule' },
      { key: 'firstFullAllotmentDate', label: 'First full allotment date' },
    ],
  },
  {
    key: 'cashAdvance',
    label: 'Cash advance and source',
    fields: [
      { key: 'cashAdvance', label: 'Cash advance/s' },
      { key: 'mannerOfDeduction', label: 'Manner of deduction of CA' },
      { key: 'sourceName', label: 'Source/s name' },
      { key: 'sourcePosition', label: 'Position' },
    ],
  },
];

/** Flat view of every agency-verification field (core + every group) - used only for the
 * "does this application already have any agency data on file" check below. */
const AGENCY_VERIFICATION_FIELDS: { key: keyof AgencyVerificationDetails; label: string; required?: boolean }[] = [
  ...AGENCY_CORE_FIELDS,
  ...AGENCY_FIELD_GROUPS.flatMap((g) => g.fields),
];

/**
 * Underwriting (2026-07-20 rework, user request - "gusto ko mag karoon ng underwriter features",
 * consolidating the old separate "Risk Management Summary" and "Review Report" cards into one).
 * Combines:
 * - The system's PREAPPROVED/PREDECLINED decision-scoring breakdown (age/income/distance, each
 *   pass/fail) plus a Debt-to-Income ratio derived from the same estimated amortization - both
 *   still purely advisory context, never a gate.
 * - The editable inputs that feed pre-qualification (income, credit score, properties owned) -
 *   editable any time by canEditRisk, same as the old RiskManagementSummaryCard.
 * - The CRM/credit-risk team's Review Report, redesigned 2026-07-21 against the legacy Credit
 *   Evaluation Report (CER) template (`legacy/reports/Credit Evaluation Report Template/CER.docx`):
 *   per-party CMAP/KYC/Myscore, an optional Mode of Payment/Mitigation section, an Agency/Contract/
 *   Allotment verification section required only for Seafarer Loans, and Conditions for Approval +
 *   CRM Recommendation - editable only while UNDER_REVIEW by canEditReview, same as the old
 *   ReviewReportCard.
 * - New underwriter fields (risk grade, recommendation + conditions, collateral, co-maker
 *   assessment) - same UNDER_REVIEW-only editability as the Review Report, since they're findings
 *   from that same review pass. All advisory: the officer's real Approve/Decline call below is
 *   what actually counts, same disclosure as everything else on this card.
 */
/** "Assist" card shown above the Credit Evaluation Report. Triggered on demand (never automatic)
 * by whoever can edit the review - calls the backend's MOCKED ai-document-review endpoint (see
 * `AiDocumentReviewResult`'s doc comment: no real model is wired up yet, every field is a
 * deterministic placeholder). The officer can edit the draft before inserting it into CRM
 * recommendation via `onInsert` - nothing here saves on its own. */
/** 2026-09-09 (user request): "Add Co-Borrower" on the application itself, same purpose as
 * ClientProfilePage's CoBorrowersCard - a focused dialog scoped to just these fields, instead of
 * routing staff through the full "Edit Application" form for a one-field addition. Writes through
 * the same `PATCH /loan-applications/:id/intake` endpoint the full edit form already uses (see
 * loanApplicationSchemas.ts's updateLoanApplicationIntakeSchema), so the status guard
 * (PREAPPROVED/PREDECLINED/UNDER_REVIEW only) is enforced identically either way - `canEdit` here
 * just mirrors that same condition to decide whether the button renders at all. */
function CoBorrowerDetailsCard({ application, canEdit }: { application: LoanApplication; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const coBorrowerParsed = React.useMemo(
    () => (application.coBorrowerName ? parseCoBorrowerName(application.coBorrowerName) : null),
    [application.coBorrowerName],
  );
  const coBorrowerSplit = React.useMemo(
    () =>
      application.coBorrowerFirstName || application.coBorrowerLastName
        ? {
            firstName: application.coBorrowerFirstName ?? '',
            middleName: application.coBorrowerMiddleName ?? '',
            lastName: application.coBorrowerLastName ?? '',
          }
        : coBorrowerParsed
          ? splitApplicantName(coBorrowerParsed.name)
          : null,
    [application, coBorrowerParsed],
  );

  const [firstName, setFirstName] = React.useState('');
  const [middleName, setMiddleName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [relationship, setRelationship] = React.useState('');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [employer, setEmployer] = React.useState('');
  const [address, setAddress] = React.useState('');

  const openDialog = () => {
    setFirstName(coBorrowerSplit?.firstName ?? '');
    setMiddleName(coBorrowerSplit?.middleName ?? '');
    setLastName(coBorrowerSplit?.lastName ?? '');
    setRelationship(coBorrowerParsed?.relationship ?? '');
    setPhoneNumber(application.coBorrowerContactNumber ?? '');
    setEmail(application.coBorrowerEmail ?? '');
    setEmployer(application.coBorrowerEmployer ?? '');
    setAddress(application.coBorrowerAddress ?? '');
    setSubmitError(null);
    setEditOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      apiClient.patch<LoanApplication>(`/loan-applications/${application.id}/intake`, {
        coBorrowerName: `${[firstName.trim(), middleName.trim(), lastName.trim()].filter(Boolean).join(' ')}${
          relationship.trim() ? ` (${relationship.trim().toLowerCase()})` : ''
        }`,
        coBorrowerFirstName: firstName.trim(),
        coBorrowerMiddleName: middleName.trim() || undefined,
        coBorrowerLastName: lastName.trim(),
        coBorrowerContactNumber: phoneNumber.trim() || undefined,
        coBorrowerEmail: email.trim() || undefined,
        coBorrowerEmployer: employer.trim() || undefined,
        coBorrowerAddress: address.trim() || undefined,
      }),
    onSuccess: () => {
      setEditOpen(false);
      setSubmitError(null);
      void queryClient.invalidateQueries({ queryKey: ['loan-application', application.id] });
    },
    onError: (error: unknown) => {
      setSubmitError(error instanceof Error ? error.message : 'Could not reach the server. Check your connection and try again.');
    },
  });

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Co-Borrower Details</CardTitle>
          <CardDescription>
            {application.coBorrowerName ? 'Named on this loan application.' : 'None named on this loan application.'}
          </CardDescription>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={openDialog}>
            {application.coBorrowerName ? (
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
      <CardContent>
        {application.coBorrowerName ? (
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <IconDt icon={UserIcon}>Name</IconDt>
            <dd className="text-right font-medium">{application.coBorrowerName}</dd>
            <IconDt icon={Phone}>Contact Number</IconDt>
            <dd className="text-right font-medium">{formatMobileNumber(application.coBorrowerContactNumber)}</dd>
            <IconDt icon={Mail}>Email</IconDt>
            <dd className="text-right font-medium">{application.coBorrowerEmail ?? '-'}</dd>
            <IconDt icon={Briefcase}>Employer</IconDt>
            <dd className="text-right font-medium">{application.coBorrowerEmployer ?? '-'}</dd>
            <IconDt icon={MapPin}>Address</IconDt>
            <dd className="text-right font-medium">{toProperCase(application.coBorrowerAddress) || '-'}</dd>
          </dl>
        ) : (
          <p className="py-2 text-center text-sm text-muted-foreground">No co-borrower on record for this application.</p>
        )}
      </CardContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{application.coBorrowerName ? 'Edit Co-Borrower' : 'Add Co-Borrower'}</DialogTitle>
            <DialogDescription>Saved directly on this loan application&apos;s intake record.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>
                First Name<span className="text-destructive"> *</span>
              </Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-1.5">
              <Label>
                Last Name<span className="text-destructive"> *</span>
              </Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-1.5">
              <Label>Middle Name</Label>
              <Input value={middleName} onChange={(e) => setMiddleName(e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-1.5">
              <Label>Relationship</Label>
              <Input placeholder="e.g. Spouse" value={relationship} onChange={(e) => setRelationship(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone Number</Label>
              <PhoneInput value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="917 XXX XXXX" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Employer</Label>
              <Input value={employer} onChange={(e) => setEmployer(e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
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
              disabled={!firstName.trim() || !lastName.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving…' : application.coBorrowerName ? 'Save Changes' : 'Add Co-Borrower'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AiDocumentReviewCard({ application, onInsert }: { application: LoanApplication; onInsert: (text: string) => void }) {
  const [result, setResult] = React.useState<AiDocumentReviewResult | null>(null);
  const [draft, setDraft] = React.useState('');
  const [inserted, setInserted] = React.useState(false);

  const assistMutation = useMutation({
    mutationFn: () => apiClient.post<AiDocumentReviewResult>(`/loan-applications/${application.id}/ai-document-review`, {}),
    onSuccess: (data) => {
      setResult(data);
      setDraft(data.recommendation);
      setInserted(false);
    },
  });

  const riskBadgeVariant = result?.riskLevel === 'HIGH' ? 'destructive' : result?.riskLevel === 'LOW' ? 'success' : 'outline';

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-1.5 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> AI-assisted document review
            </CardTitle>
            <CardDescription>Draft only - a placeholder preview until a model is wired up. Always review before using.</CardDescription>
          </div>
          <Button size="sm" variant="outline" disabled={assistMutation.isPending} onClick={() => assistMutation.mutate()}>
            {assistMutation.isPending ? 'Assisting…' : result ? 'Re-run assist' : 'Assist'}
          </Button>
        </div>
      </CardHeader>
      {result && (
        <CardContent className="space-y-4">
          {assistMutation.isError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              {assistMutation.error instanceof Error ? assistMutation.error.message : 'Could not generate a draft. Try again.'}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md bg-background p-3 text-center">
              <p className="text-xs text-muted-foreground">Risk level (preview)</p>
              <Badge variant={riskBadgeVariant} className="mt-1">
                {result.riskLevel}
              </Badge>
            </div>
            <div className="rounded-md bg-background p-3 text-center">
              <p className="text-xs text-muted-foreground">Documents on file</p>
              <p className="mt-1 text-sm font-medium">{result.documentChecklist.length}</p>
            </div>
          </div>

          {result.crossChecks.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Cross-checks against the application</Label>
              <ul className="divide-y rounded-md border text-sm">
                {result.crossChecks.map((c) => (
                  <li key={c.label} className="flex items-center justify-between p-2">
                    <span>{c.label}</span>
                    <span className={c.flagged ? 'text-destructive' : 'text-muted-foreground'}>{c.result}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.keyFactors.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Key factors</Label>
              <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                {result.keyFactors.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Draft recommendation</Label>
            <Textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Edit before inserting" />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  onInsert(draft);
                  setInserted(true);
                }}
              >
                Insert into credit evaluation report
              </Button>
              {inserted && <span className="self-center text-xs text-muted-foreground">Inserted into CRM recommendation below.</span>}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/** Imperative handle so a sibling component (the AI Assist card, rendered above this one) can
 * insert a draft into the CRM recommendation field without lifting all of this card's other
 * review-report state up to the parent - see `AiDocumentReviewCard`. */
export interface UnderwritingCardHandle {
  /** Appends to the existing CRM recommendation text if it's non-empty, otherwise replaces it
   * (2026-07-22 user instruction). Does not save - the officer still reviews/edits, then clicks
   * "Save Underwriting Details" like any other change to this card. */
  insertCrmRecommendation: (text: string) => void;
}

const UnderwritingCard = React.forwardRef<
  UnderwritingCardHandle,
  {
    application: LoanApplication;
    canEditRisk: boolean;
    canEditReview: boolean;
    /** 2026-07-29 - unlike canEditReview, NOT gated on isUnderReview: whoever can review
     * applications can still set the mitigation account owner on an already-Active loan's
     * application. See `SetMitigationAccountOwnerUseCase`'s doc comment for why this one field
     * stays editable past the Review Report's normal lock. */
    canEditAccountOwner: boolean;
    /** Review Report + Underwriter Assessment only make sense once a manual review has actually
     * started - matches the old ReviewReportCard's own visibility rule (Under Review, Pre Approval,
     * or already decided with a report on file). Decision scoring/DTI and the risk-input fields
     * above them stay visible at every stage, unchanged from the old RiskManagementSummaryCard. */
    showReview: boolean;
    /** Drives the Agency/Contract/Allotment verification section's "required for Seafarer Loan" gate. */
    assignedProductName: string | null;
    /** Display name for the Document checklist's "Verified by X" footer - resolved at page level, same
     * pattern as encodedByName/reviewedByName. */
    documentsVerifiedByName: string | null;
  }
>(function UnderwritingCard(
  { application, canEditRisk, canEditReview, canEditAccountOwner, showReview, assignedProductName, documentsVerifiedByName },
  ref,
) {
  const queryClient = useQueryClient();

  /** 2026-09-09 (user request): "Preview CRM Report" - same "open a tab synchronously, load the PDF
   * into it once ready" pattern as the header's Print Application (`generateFormMutation`) - see
   * that mutation's own doc comment for why the tab has to open in the click handler itself. */
  const crmReportPreviewWindowRef = React.useRef<Window | null>(null);
  const generateCrmReportMutation = useMutation({
    mutationFn: () => apiClient.post<Attachment>(`/loan-applications/${application.id}/crm-report`, {}),
    onSuccess: async (attachment) => {
      queryClient.invalidateQueries({ queryKey: ['attachments', 'LOAN_APPLICATION', application.id] });
      const blob = await fetchFileBlob(`/attachments/${attachment.id}/download`);
      const url = URL.createObjectURL(blob);
      if (crmReportPreviewWindowRef.current && !crmReportPreviewWindowRef.current.closed) {
        crmReportPreviewWindowRef.current.location.href = url;
      } else {
        window.open(url, '_blank');
      }
    },
    onError: () => {
      crmReportPreviewWindowRef.current?.close();
    },
  });

  /** 2026-09-09 (user request): separate "Download" action, straight to disk instead of a preview
   * tab - same generate step as the Preview button above, just handed to `downloadFile` instead of
   * opened. `downloadFile` reads the real fileName off the response's Content-Disposition header
   * (set from the Attachment's own `fileName`, i.e. GenerateCrmReportUseCase's
   * `CRM-Report-<Applicant-Name>-<id8>.pdf` convention) - the name built here is only the fallback
   * for the rare case that header is missing. */
  const downloadCrmReportMutation = useMutation({
    mutationFn: () => apiClient.post<Attachment>(`/loan-applications/${application.id}/crm-report`, {}),
    onSuccess: async (attachment) => {
      queryClient.invalidateQueries({ queryKey: ['attachments', 'LOAN_APPLICATION', application.id] });
      const fallbackFileName = `CRM-Report-${application.applicantName.replace(/\s+/g, '-')}-${application.id.slice(0, 8)}.pdf`;
      await downloadFile(`/attachments/${attachment.id}/download`, fallbackFileName);
    },
  });

  const [editingRisk, setEditingRisk] = React.useState(false);
  const [monthlyIncome, setMonthlyIncome] = React.useState(String(application.monthlyIncome ?? ''));
  const [creditScore, setCreditScore] = React.useState(String(application.creditScore ?? ''));
  const [propertiesOwned, setPropertiesOwned] = React.useState(application.propertiesOwned.join(', '));

  const resetRiskDraft = () => {
    setMonthlyIncome(String(application.monthlyIncome ?? ''));
    setCreditScore(String(application.creditScore ?? ''));
    setPropertiesOwned(application.propertiesOwned.join(', '));
  };

  const saveRiskMutation = useMutation({
    mutationFn: () =>
      apiClient.patch<LoanApplication>(`/loan-applications/${application.id}`, {
        monthlyIncome: Number(monthlyIncome) > 0 ? Number(monthlyIncome) : undefined,
        creditScore: Number(creditScore) || undefined,
        propertiesOwned: propertiesOwned
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean),
      } satisfies UpdateLoanApplicationRequest),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan-application', application.id] });
      setEditingRisk(false);
    },
  });

  const report = application.reviewReport;
  const [creditBureauBorrower, setCreditBureauBorrower] = React.useState<CreditBureauPartyCheck>(report?.creditBureauBorrower ?? {});
  const [creditBureauCoBorrower, setCreditBureauCoBorrower] = React.useState<CreditBureauPartyCheck>(
    report?.creditBureauCoBorrower ?? {},
  );
  const [mitigation, setMitigation] = React.useState<MitigationDetails>(report?.mitigation ?? {});
  const [agencyVerification, setAgencyVerification] = React.useState<AgencyVerificationDetails>(report?.agencyVerification ?? {});
  const [conditionsForApproval, setConditionsForApproval] = React.useState(report?.conditionsForApproval ?? '');
  const [crmRecommendation, setCrmRecommendation] = React.useState(report?.crmRecommendation ?? '');
  React.useImperativeHandle(
    ref,
    (): UnderwritingCardHandle => ({
      insertCrmRecommendation: (text) =>
        setCrmRecommendation((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text)),
    }),
    [],
  );
  const [documentVerifications, setDocumentVerifications] = React.useState<Record<string, DocumentVerificationEntry>>(
    report?.documentVerifications ?? {},
  );

  /** 2026-09-09 (user request): the CRM Report PDF reads the SAVED review report from the DB, not
   * this component's live draft state - Preview/Download must be blocked while there are unsaved
   * edits, or staff could generate/download a report that silently doesn't match what they just
   * typed. Snapshot of the last-saved values (mitigation excluded - it saves immediately through
   * its own separate endpoints below, never goes stale relative to this snapshot). Updated in
   * saveReviewMutation's onSuccess, not on every keystroke. */
  const lastSavedReviewSnapshot = React.useRef(
    JSON.stringify({
      creditBureauBorrower: report?.creditBureauBorrower ?? {},
      creditBureauCoBorrower: report?.creditBureauCoBorrower ?? {},
      agencyVerification: report?.agencyVerification ?? {},
      conditionsForApproval: report?.conditionsForApproval ?? '',
      crmRecommendation: report?.crmRecommendation ?? '',
      documentVerifications: report?.documentVerifications ?? {},
    }),
  );
  const isReviewReportDirty =
    JSON.stringify({
      creditBureauBorrower,
      creditBureauCoBorrower,
      agencyVerification,
      conditionsForApproval,
      crmRecommendation,
      documentVerifications,
    }) !== lastSavedReviewSnapshot.current;
  const isSeafarerLoan = assignedProductName ? classifyProductType(assignedProductName) === 'Seafarer Loan' : false;
  const hasMitigationData = MITIGATION_FIELDS.some((f) => mitigation[f.key]?.trim());
  // 2026-07-29: only meaningful (and only required) when there's actually a co-borrower to
  // disambiguate against - CreateLoanSigningSessionUseCase reads this to decide whether "Deed of
  // Assignment - Co-Borrower" belongs in the co-borrower's e-signature batch.
  const mitigationOwnerRequired = hasMitigationData && Boolean(application.coBorrowerName);
  const mitigationOwnerMissing = mitigationOwnerRequired && !mitigation.accountOwner;
  const hasAgencyData = AGENCY_VERIFICATION_FIELDS.some((f) => agencyVerification[f.key]?.trim());
  /** 2026-09-09 (user request) - collapsed-state summary so staff don't have to expand the section
   * (now collapsed by default on every visit, see agencyOpen below) just to see whether it's already
   * filled in or still needs attention. */
  const filledAgencyFieldsCount = AGENCY_VERIFICATION_FIELDS.filter((f) => agencyVerification[f.key]?.trim()).length;
  const agencyCoreFieldsIncomplete = isSeafarerLoan && AGENCY_CORE_FIELDS.some((f) => f.required && !agencyVerification[f.key]?.trim());
  const [mitigationOpen, setMitigationOpen] = React.useState(hasMitigationData);
  // 2026-08-13 (user request): Client Profile's read-only mitigation card links back here to edit -
  // deep-links via `?section=mitigation` so staff land straight on the section instead of having to
  // find it themselves on a long page.
  const location = useLocation();
  const mitigationSectionRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (new URLSearchParams(location.search).get('section') !== 'mitigation') return;
    setMitigationOpen(true);
    const id = window.setTimeout(() => mitigationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);
  // 2026-09-09 (user request): always starts collapsed on every visit to this page - previously
  // auto-opened whenever hasAgencyData or isSeafarerLoan was true, which read as the section
  // "remembering" a manual expand across navigation (it wasn't - it's a fresh mount every time, the
  // auto-open condition just kept re-triggering for the same application).
  const [agencyOpen, setAgencyOpen] = React.useState(false);
  /** 2026-07-23: per-group collapse state for AGENCY_FIELD_GROUPS - each group starts open only if
   * it already has data on file (e.g. loaded from an existing review report), collapsed otherwise. */
  const [openAgencyGroups, setOpenAgencyGroups] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(AGENCY_FIELD_GROUPS.map((g) => [g.key, g.fields.some((f) => agencyVerification[f.key]?.trim())])),
  );
  const toggleAgencyGroup = (key: string) => setOpenAgencyGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const setDocumentStatus = (doc: string, status: DocumentVerificationStatus, reason?: string) => {
    setDocumentVerifications((prev) => ({ ...prev, [doc]: { status, reason } }));
  };
  const clearDocumentStatus = (doc: string) => {
    setDocumentVerifications((prev) => {
      const next = { ...prev };
      delete next[doc];
      return next;
    });
  };
  const verifiedCount = application.submittedDocuments.filter((d) => documentVerifications[d]?.status === 'VERIFIED').length;

  const saveReviewMutation = useMutation({
    mutationFn: () =>
      apiClient.patch<LoanApplication>(`/loan-applications/${application.id}/review-report`, {
        creditBureauBorrower,
        creditBureauCoBorrower,
        mitigation,
        agencyVerification,
        conditionsForApproval: conditionsForApproval.trim() || undefined,
        crmRecommendation: crmRecommendation.trim() || undefined,
        documentVerifications,
      } satisfies SubmitReviewReportRequest),
    onSuccess: () => {
      lastSavedReviewSnapshot.current = JSON.stringify({
        creditBureauBorrower,
        creditBureauCoBorrower,
        agencyVerification,
        conditionsForApproval,
        crmRecommendation,
        documentVerifications,
      });
      queryClient.invalidateQueries({ queryKey: ['loan-application', application.id] });
    },
  });

  // 2026-07-29: separate, status-unrestricted endpoint - see SetMitigationAccountOwnerUseCase's
  // doc comment. Saves immediately on click (no separate "Save" button) since it's a single toggle,
  // not a multi-field draft like the rest of the Review Report.
  const setAccountOwnerMutation = useMutation({
    mutationFn: (accountOwner: 'BORROWER' | 'CO_BORROWER') => {
      setMitigation((prev) => ({ ...prev, accountOwner }));
      return apiClient.patch<LoanApplication>(`/loan-applications/${application.id}/mitigation-account-owner`, { accountOwner });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['loan-application', application.id] }),
  });

  // 2026-08-10 (user request) - separate, status-unrestricted endpoint for the rest of the
  // mitigation fields (bank/branch/accountName/accountNumber/atmCardNumber/allotmentAmount), same
  // pattern as setAccountOwnerMutation above - see SetMitigationDetailsUseCase's doc comment. Own
  // "Save" button (unlike accountOwner's immediate-on-click) since it's several free-text fields,
  // not a single toggle.
  const setMitigationDetailsMutation = useMutation({
    mutationFn: () =>
      apiClient.patch<LoanApplication>(`/loan-applications/${application.id}/mitigation-details`, {
        bank: mitigation.bank,
        branch: mitigation.branch,
        accountName: mitigation.accountName,
        accountNumber: mitigation.accountNumber,
        atmCardNumber: mitigation.atmCardNumber,
        allotmentAmount: mitigation.allotmentAmount,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['loan-application', application.id] }),
  });

  const breakdown = application.preQualificationBreakdown;
  const dtiPercent =
    breakdown && application.monthlyIncome ? (breakdown.estimatedMonthlyAmortization / application.monthlyIncome) * 100 : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Underwriting
        </CardTitle>
        <CardDescription>
          System pre-qualification, credit investigation, and the underwriter's own risk assessment - all advisory. The officer's
          Approve/Decline decision below is what actually counts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {breakdown && (
          <div className="rounded-md border p-3">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Decision scoring</p>
            <DecisionScoringRow {...breakdown.checks.age} />
            <DecisionScoringRow {...breakdown.checks.income} />
            {/* 2026-09-09 (user request): replaced the old address-proximity check, which almost
                never had real data to evaluate. `breakdown.checks.employment` is guarded because an
                application classified before this change still has the old `distance`-shaped
                breakdown stored until it's next edited/reverted (re-triggers classification) - shown
                blank rather than a broken/undefined row until then. */}
            {breakdown.checks.employment && <DecisionScoringRow {...breakdown.checks.employment} />}
            {dtiPercent !== null && (
              <div className={cn('mt-2 flex items-center gap-4 rounded-md bg-muted/40 p-3', dtiBandClass(dtiPercent))}>
                <DtiGauge percent={dtiPercent} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-foreground">Debt-to-Income ratio</p>
                    <TermTip
                      term="DTI"
                      definition="Estimated monthly loan amortization as a share of monthly income. A common lending-industry rule of thumb: under ~30% is comfortable, 30-40% warrants a closer look, above 40% is high - not an Easycash policy threshold, informational only."
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Estimated ₱{breakdown.estimatedMonthlyAmortization.toFixed(2)}/month amortization vs. ₱
                    {application.monthlyIncome!.toFixed(2)} monthly income.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <Separator />

        {saveRiskMutation.isError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {saveRiskMutation.error instanceof Error ? saveRiskMutation.error.message : 'Could not save these values.'}
          </div>
        )}
        {editingRisk ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Monthly income (₱)</Label>
              <NumberInput min="0" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Credit score (from CB report)</Label>
              <NumberInput min="0" max="1000" value={creditScore} onChange={(e) => setCreditScore(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Properties owned</Label>
              <Input
                value={propertiesOwned}
                onChange={(e) => setPropertiesOwned(e.target.value)}
                placeholder="Comma-separated"
              />
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Monthly income</dt>
            <dd className="text-right font-medium">
              {application.monthlyIncome !== null ? formatPeso(application.monthlyIncome) : '-'}
            </dd>
            <dt className="text-muted-foreground">Credit score</dt>
            <dd className="text-right font-medium">{application.creditScore ?? '-'}</dd>
            <dt className="text-muted-foreground">Properties owned</dt>
            <dd className="text-right font-medium">
              {application.propertiesOwned.length === 0 ? 'None on record' : application.propertiesOwned.join(', ')}
            </dd>
          </dl>
        )}

        {canEditRisk && (
          <div className="flex items-center gap-2">
            {editingRisk ? (
              <>
                <Button size="sm" disabled={saveRiskMutation.isPending} onClick={() => saveRiskMutation.mutate()}>
                  {saveRiskMutation.isPending ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    resetRiskDraft();
                    setEditingRisk(false);
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEditingRisk(true)}>
                Edit
              </Button>
            )}
          </div>
        )}

        {showReview && (
          <>
        <Separator />

        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Credit Evaluation Report</p>
          <p className="text-xs text-muted-foreground">Credit Investigation, Credit Bureau checking, and document verification.</p>
        </div>

        {saveReviewMutation.isError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {saveReviewMutation.error instanceof Error ? saveReviewMutation.error.message : 'Could not save the underwriting details.'}
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs">Credit bureau check</Label>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/30">
                  <th className="p-2 text-left text-xs font-medium text-muted-foreground"></th>
                  <th className="p-2 text-left text-xs font-medium text-muted-foreground">Borrower</th>
                  <th className="p-2 text-left text-xs font-medium text-muted-foreground">Co-borrower</th>
                </tr>
              </thead>
              <tbody>
                {CREDIT_BUREAU_PARTY_FIELDS.map((f) => (
                  <tr key={f.key} className="border-b last:border-0">
                    <td className="p-2 text-xs text-muted-foreground">{f.label}</td>
                    <td className="p-2">
                      {canEditReview ? (
                        <Input
                          className="h-8"
                          value={creditBureauBorrower[f.key] ?? ''}
                          onChange={(e) => setCreditBureauBorrower((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        />
                      ) : (
                        <span>{creditBureauBorrower[f.key] || '-'}</span>
                      )}
                    </td>
                    <td className="p-2">
                      {canEditReview ? (
                        <Input
                          className="h-8"
                          value={creditBureauCoBorrower[f.key] ?? ''}
                          onChange={(e) => setCreditBureauCoBorrower((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        />
                      ) : (
                        <span>{creditBureauCoBorrower[f.key] || '-'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div ref={mitigationSectionRef} className="space-y-2 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Mode of payment and mitigation</Label>
            <Badge variant="outline" className="text-[10px]">
              Optional
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">Only if the borrower is surrendering an ATM/allotment as security.</p>
          {(canEditAccountOwner || hasMitigationData) && (
            <button
              type="button"
              onClick={() => setMitigationOpen((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-primary"
            >
              {mitigationOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {mitigationOpen ? 'Hide bank / ATM details' : 'Add bank / ATM details'}
            </button>
          )}
          {mitigationOpen && (
            <div className="grid gap-3 pt-1 sm:grid-cols-2">
              {MITIGATION_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{f.label}</Label>
                  {canEditAccountOwner ? (
                    <Input
                      value={mitigation[f.key] ?? ''}
                      onChange={(e) => setMitigation((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    />
                  ) : (
                    <p className="text-sm">{mitigation[f.key] || '-'}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* 2026-08-10 (user request): bank/branch/account fields are now editable regardless of
              review status (see setMitigationDetailsMutation above), unlike the rest of the Review
              Report which saves via the single "Save Underwriting Details" button below - so this
              section needs its own explicit Save action. */}
          {mitigationOpen && canEditAccountOwner && (
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" disabled={setMitigationDetailsMutation.isPending} onClick={() => setMitigationDetailsMutation.mutate()}>
                {setMitigationDetailsMutation.isPending ? 'Saving…' : 'Save bank / ATM details'}
              </Button>
              {setMitigationDetailsMutation.isSuccess && !setMitigationDetailsMutation.isPending && (
                <span className="text-xs text-muted-foreground">Saved.</span>
              )}
            </div>
          )}
          {mitigationOpen && application.coBorrowerName && (
            <div className="border-t pt-3">
              <Label className="text-xs text-muted-foreground">
                Whose name is this account under?
                <span className="ml-0.5 text-destructive">*</span>
              </Label>
              {canEditAccountOwner ? (
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={setAccountOwnerMutation.isPending}
                    onClick={() => setAccountOwnerMutation.mutate('BORROWER')}
                    className={cn(
                      'rounded-md border py-2 text-sm font-medium transition-colors',
                      mitigation.accountOwner === 'BORROWER'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-transparent bg-muted/60 text-muted-foreground hover:bg-muted',
                    )}
                  >
                    Borrower
                  </button>
                  <button
                    type="button"
                    disabled={setAccountOwnerMutation.isPending}
                    onClick={() => setAccountOwnerMutation.mutate('CO_BORROWER')}
                    className={cn(
                      'rounded-md border py-2 text-sm font-medium transition-colors',
                      mitigation.accountOwner === 'CO_BORROWER'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-transparent bg-muted/60 text-muted-foreground hover:bg-muted',
                    )}
                  >
                    Co-borrower
                  </button>
                </div>
              ) : (
                <p className="mt-1 text-sm">
                  {mitigation.accountOwner === 'CO_BORROWER' ? 'Co-borrower' : mitigation.accountOwner === 'BORROWER' ? 'Borrower' : '-'}
                </p>
              )}
              <p className="mt-1.5 text-xs text-muted-foreground">
                Determines whether "Deed of Assignment - Co-Borrower" is included when sending e-signature documents to the co-borrower.
              </p>
              {canEditAccountOwner && mitigationOwnerMissing && (
                <p className="mt-1.5 text-xs text-destructive">Required - please select who this account belongs to.</p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Agency / contract / allotment verification</Label>
            {isSeafarerLoan && (
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-[10px] text-primary">
                Seafarer loan
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {isSeafarerLoan
              ? 'Assigned product is a Seaman/OFW loan - fill in if available, optional.'
              : 'Shown for Seaman/OFW loans only - not applicable to this product.'}
          </p>
          {(canEditReview || hasAgencyData) && (
            <button
              type="button"
              onClick={() => setAgencyOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-primary"
            >
              {agencyOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {agencyOpen ? 'Hide section' : 'Expand section (vessel, contract dates, allottees)'}
              {!agencyOpen && agencyCoreFieldsIncomplete && (
                <Badge variant="warning" className="text-[10px]">
                  <AlertTriangle className="mr-1 h-2.5 w-2.5" /> Incomplete
                </Badge>
              )}
              {!agencyOpen && !agencyCoreFieldsIncomplete && hasAgencyData && (
                <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                  {filledAgencyFieldsCount} of {AGENCY_VERIFICATION_FIELDS.length} filled
                </Badge>
              )}
            </button>
          )}
          {agencyOpen && (
            <div className="space-y-1 pt-1">
              <div className="grid gap-3 border-b pb-3 sm:grid-cols-2">
                {AGENCY_CORE_FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {f.label}
                      {f.required && isSeafarerLoan && <span className="ml-0.5 text-destructive">*</span>}
                    </Label>
                    {canEditReview ? (
                      <Input
                        value={agencyVerification[f.key] ?? ''}
                        onChange={(e) => setAgencyVerification((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        className={f.required && isSeafarerLoan && !agencyVerification[f.key]?.trim() ? 'border-destructive/50' : undefined}
                      />
                    ) : (
                      <p className="text-sm">{agencyVerification[f.key] || '-'}</p>
                    )}
                  </div>
                ))}
              </div>
              {/* 2026-07-23: optional detail fields, grouped and collapsed by default so the
               * section doesn't read as "26 required-looking boxes" when only the 3 core fields
               * above ever gate Pre Approval - see AGENCY_FIELD_GROUPS' own doc comment. */}
              {AGENCY_FIELD_GROUPS.map((group) => (
                <div key={group.key} className="border-b py-1 last:border-0">
                  <button
                    type="button"
                    onClick={() => toggleAgencyGroup(group.key)}
                    className="flex w-full items-center gap-1.5 py-1.5 text-xs font-medium"
                  >
                    {openAgencyGroups[group.key] ? (
                      <ChevronUp className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    )}
                    {group.label}
                    <span className="ml-auto text-[10px] font-normal text-muted-foreground">{group.fields.length} fields</span>
                  </button>
                  {openAgencyGroups[group.key] && (
                    <div className="grid gap-3 pb-2 sm:grid-cols-2">
                      {group.fields.map((f) => (
                        <div key={f.key} className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{f.label}</Label>
                          {canEditReview ? (
                            <Input
                              value={agencyVerification[f.key] ?? ''}
                              onChange={(e) => setAgencyVerification((prev) => ({ ...prev, [f.key]: e.target.value }))}
                            />
                          ) : (
                            <p className="text-sm">{agencyVerification[f.key] || '-'}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {isSeafarerLoan && canEditReview && (
                <p className="pt-2 text-xs text-muted-foreground">
                  <span className="text-destructive">*</span> Required before this application can be tagged Pre Approval
                </p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <Label className="text-xs">Conditions and recommendation</Label>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Conditions for approval</Label>
            {canEditReview ? (
              <Textarea
                rows={2}
                value={conditionsForApproval}
                onChange={(e) => setConditionsForApproval(e.target.value)}
                placeholder="Conditions/considerations before this can be approved"
              />
            ) : (
              <p className="text-sm">{conditionsForApproval || 'None on record.'}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">CRM recommendation</Label>
            {canEditReview ? (
              <Textarea
                rows={2}
                value={crmRecommendation}
                onChange={(e) => setCrmRecommendation(e.target.value)}
                placeholder="Final recommendation for the approving officer"
              />
            ) : (
              <p className="text-sm">{crmRecommendation || 'None on record.'}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Document checklist</Label>
            {application.submittedDocuments.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {verifiedCount} of {application.submittedDocuments.length} verified
              </span>
            )}
          </div>
          {application.submittedDocuments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents were recorded as submitted at intake.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {application.submittedDocuments.map((doc) => {
                const entry = documentVerifications[doc];
                return (
                  <li key={doc} className="space-y-1.5 p-2.5">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="flex-1">{doc}</span>
                      {canEditReview ? (
                        <div className="flex gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant={entry?.status === 'VERIFIED' ? 'default' : 'outline'}
                            className="h-7 px-2 text-xs"
                            onClick={() => (entry?.status === 'VERIFIED' ? clearDocumentStatus(doc) : setDocumentStatus(doc, 'VERIFIED'))}
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Verified
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={entry?.status === 'REJECTED' ? 'destructive' : 'outline'}
                            className="h-7 px-2 text-xs"
                            onClick={() =>
                              entry?.status === 'REJECTED' ? clearDocumentStatus(doc) : setDocumentStatus(doc, 'REJECTED', entry?.reason)
                            }
                          >
                            <XCircle className="mr-1 h-3 w-3" /> Rejected
                          </Button>
                        </div>
                      ) : entry?.status === 'VERIFIED' ? (
                        <Badge variant="success" className="text-[10px]">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Verified
                        </Badge>
                      ) : entry?.status === 'REJECTED' ? (
                        <Badge variant="destructive" className="text-[10px]">
                          <XCircle className="mr-1 h-3 w-3" /> Rejected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Not reviewed
                        </Badge>
                      )}
                    </div>
                    {entry?.status === 'REJECTED' &&
                      (canEditReview ? (
                        <Input
                          className="h-8 text-xs"
                          value={entry.reason ?? ''}
                          onChange={(e) => setDocumentStatus(doc, 'REJECTED', e.target.value)}
                          placeholder="Why was this rejected? (e.g. only 1 month submitted)"
                        />
                      ) : (
                        entry.reason && <p className="text-xs text-destructive">{entry.reason}</p>
                      ))}
                  </li>
                );
              })}
            </ul>
          )}
          {documentsVerifiedByName && (
            <p className="text-xs text-muted-foreground">
              Last verified by {documentsVerifiedByName}
              {report?.documentsVerifiedAt ? ` · ${formatDate(report.documentsVerifiedAt)}` : ''}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {canEditReview && (
            <Button size="sm" disabled={saveReviewMutation.isPending} onClick={() => saveReviewMutation.mutate()}>
              {saveReviewMutation.isPending ? 'Saving…' : 'Save Underwriting Details'}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={generateCrmReportMutation.isPending || isReviewReportDirty}
            title={isReviewReportDirty ? 'Save Underwriting Details first - the report reads the saved data, not unsaved edits.' : undefined}
            onClick={() => {
              crmReportPreviewWindowRef.current = window.open('', '_blank');
              generateCrmReportMutation.mutate();
            }}
          >
            {generateCrmReportMutation.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Printer className="mr-1.5 h-3.5 w-3.5" />
            )}
            {generateCrmReportMutation.isPending ? 'Generating…' : 'Preview CRM Report'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={downloadCrmReportMutation.isPending || isReviewReportDirty}
            title={isReviewReportDirty ? 'Save Underwriting Details first - the report reads the saved data, not unsaved edits.' : undefined}
            onClick={() => downloadCrmReportMutation.mutate()}
          >
            {downloadCrmReportMutation.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-3.5 w-3.5" />
            )}
            {downloadCrmReportMutation.isPending ? 'Generating…' : 'Download CRM Report'}
          </Button>
        </div>
        {isReviewReportDirty && (
          <p className="text-xs text-muted-foreground">
            You have unsaved changes - save them first so the CRM Report reflects what you just entered.
          </p>
        )}
          </>
        )}
      </CardContent>
    </Card>
  );
});

/**
 * Wired to the real backend Loan Applications module (`GET/POST /loan-applications/:id/...`).
 * Every application starts system-classified PREAPPROVED/PREDECLINED (backend's
 * `LoanApplicationPreQualificationService`, added 2026-07-11 - advisory only). Approve/decline
 * work from either system verdict, requiring a product version to be assigned first - mirrors the
 * backend's `ProductNotAssignedError` gate. Only MIS can revert a decided application back to a
 * freshly recomputed system verdict (accidental-click safety net), matching
 * `canRevertLoanApplicationDecision`.
 *
 * The Create-Loan-Account bridge has no backend equivalent yet (converting an APPROVED application
 * into a LoanAccount is a deliberately separate concern - see the backend module's own design
 * notes) and is intentionally left out here. Create Client Profile is different: `POST /borrowers`
 * is real, so an APPROVED application can create a real client, prefilled from its own fields (see
 * `CreateClientProfileDialog`).
 */
export function LoanApplicationDetailPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // Set by LoanApplicationCreatePage when one or more best-effort attachment auto-saves failed
  // (AI Auto-fill document and/or Applicant Document slots) - the application itself was still
  // created successfully.
  const failedDocumentLabels = (location.state as { failedDocumentLabels?: string[] } | null)?.failedDocumentLabels ?? [];
  const queryClient = useQueryClient();
  const {
    canAccessLoanApplications,
    canRevertLoanApplicationDecision,
    canReviewLoanApplication,
    canUseAiDocumentReview,
    canApproveLoanApplication,
    canDeleteLoanApplication,
    currentAccount,
  } = useRole();
  const [decisionNote, setDecisionNote] = React.useState('');
  const [confirmAction, setConfirmAction] = React.useState<'APPROVED' | 'DECLINED' | 'REVERT' | 'PRE_APPROVAL' | 'UNDO_PRE_APPROVAL' | null>(null);
  const [createClientOpen, setCreateClientOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = React.useState('');
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
  const [createLoanOpen, setCreateLoanOpen] = React.useState(false);
  const underwritingCardRef = React.useRef<UnderwritingCardHandle>(null);

  useLogPageView('Loan Application Detail', applicationId);

  const applicationQuery = useQuery({
    queryKey: ['loan-application', applicationId],
    queryFn: () => apiClient.get<LoanApplication>(`/loan-applications/${applicationId}`),
    enabled: canAccessLoanApplications && Boolean(applicationId),
    retry: false,
  });
  const application = applicationQuery.data;

  // "Create Loan Account" (moved here from the Client Profile page, 2026-07-14) - only fetched
  // once this application's client actually exists.
  const clientBorrowerQuery = useQuery({
    queryKey: ['borrower', application?.createdBorrowerId],
    queryFn: () => apiClient.get<Borrower>(`/borrowers/${application!.createdBorrowerId}`),
    enabled: canAccessLoanApplications && Boolean(application?.createdBorrowerId),
  });
  const clientLoansQuery = useQuery({
    queryKey: ['loan-accounts', 'all'],
    queryFn: () => fetchAllPages<{ id: string; borrowerId: string; status: string }>('/loan-accounts'),
    enabled: canAccessLoanApplications && Boolean(application?.createdBorrowerId),
  });
  const hasActiveLoan = (clientLoansQuery.data ?? []).some(
    (l) =>
      l.borrowerId === application?.createdBorrowerId &&
      l.status !== 'CLOSED' &&
      l.status !== 'CLOSED_WRITTEN_OFF' &&
      l.status !== 'CLOSED_REJECTED' &&
      l.status !== 'CLOSED_RESTRUCTURED' &&
      l.status !== 'CLOSED_ADJUSTED',
  );
  // Once the loan account created from this application has been Activated (disbursed - status
  // past PENDING_APPROVAL/APPROVED), the decision that produced it can no longer be reverted -
  // there's a real, live loan on the books behind it.
  const createdLoanAccount = (clientLoansQuery.data ?? []).find((l) => l.id === application?.createdLoanAccountId);
  const isCreatedLoanAccountActivated = createdLoanAccount
    ? createdLoanAccount.status !== 'PENDING_APPROVAL' && createdLoanAccount.status !== 'APPROVED'
    : false;
  // Created but not yet Activated - the loan account itself shows as "For Disbursement" (see
  // StatusBadge.tsx's LOAN_STATUS_STYLE) in this state, so this application's own status display
  // matches it instead of still saying "Approved".
  const isCreatedLoanAccountAwaitingDisbursement = Boolean(createdLoanAccount) && !isCreatedLoanAccountActivated;

  const productsQuery = useQuery({
    queryKey: ['loan-products', 'all'],
    queryFn: () => fetchAllPages<LoanProduct>('/loan-products'),
    enabled: canAccessLoanApplications,
  });
  const activeVersionOptions = React.useMemo(
    () =>
      (productsQuery.data ?? []).flatMap((product) =>
        product.versions
          .filter((v) => v.isActive)
          .map((v) => ({ id: v.id, productName: product.name, label: `${product.name} (v${v.versionNumber})` })),
      ),
    [productsQuery.data],
  );
  const productNameByVersionId = React.useMemo(
    () => new Map(activeVersionOptions.map((v) => [v.id, v.productName])),
    [activeVersionOptions],
  );

  const assignedProductName = application?.assignedLoanProductVersionId
    ? (productNameByVersionId.get(application.assignedLoanProductVersionId) ?? null)
    : null;

  // 2026-07-21: mirrors the backend's TagLoanApplicationPreApprovalUseCase gate - a Seafarer Loan
  // can't be tagged Pre Approval until Agency Verification's 3 required fields are filled in.
  const agencyVerificationRequired = assignedProductName ? classifyProductType(assignedProductName) === 'Seafarer Loan' : false;
  const agency = application?.reviewReport?.agencyVerification;
  const agencyVerificationMissing =
    agencyVerificationRequired && !(agency?.agencyName?.trim() && agency?.position?.trim() && agency?.vessel?.trim());

  // Local UI-only step - narrows which product classes the second dropdown offers. Initialized
  // from whatever the application is currently assigned to, if it falls under one of the 3 curated
  // types; otherwise starts unset so staff picks a type first.
  const [selectedProductType, setSelectedProductType] = React.useState<LoanTypeOption | ''>('');
  const productTypeLabelsQuery = useProductTypeLabels();
  React.useEffect(() => {
    if (assignedProductName) {
      const resolvedType = findLoanTypeForProductName(assignedProductName);
      if (resolvedType) setSelectedProductType(resolvedType);
    }
    // Only re-derive when the application itself (or its assignment) changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [application?.id, assignedProductName]);

  const productClassOptions = React.useMemo(() => {
    if (!selectedProductType) return [];
    return activeVersionOptions
      .filter((v) => classifyProductType(v.productName) === selectedProductType)
      .map((v) => ({ name: v.productName, versionId: v.id, discontinued: KNOWN_DISCONTINUED_PRODUCT_NAMES.has(v.productName) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedProductType, activeVersionOptions]);

  // Resolves encodedByUserId/reviewedByUserId (raw LMS account ids) into display names for the
  // "encoded by" / "reviewed by" indicators below - same join pattern used elsewhere (e.g.
  // LoanListPage's borrower/product name join).
  const usersQuery = useQuery({ queryKey: ['users', 'all'], queryFn: () => fetchAllPages<User>('/users') });
  const userNameById = React.useMemo(() => new Map((usersQuery.data ?? []).map((u) => [u.id, u.fullName])), [usersQuery.data]);
  const encodedByName = application?.encodedByUserId ? (userNameById.get(application.encodedByUserId) ?? 'Unknown account') : null;
  const reviewedByName = application?.reviewedByUserId ? (userNameById.get(application.reviewedByUserId) ?? 'Unknown account') : null;
  const documentsVerifiedByName = application?.reviewReport?.documentsVerifiedByUserId
    ? (userNameById.get(application.reviewReport.documentsVerifiedByUserId) ?? 'Unknown account')
    : null;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['loan-application', applicationId] });
    queryClient.invalidateQueries({ queryKey: ['loan-applications', 'all'] });
  };

  const assignProductMutation = useMutation({
    mutationFn: (loanProductVersionId: string) =>
      apiClient.post<LoanApplication>(`/loan-applications/${applicationId}/assign-product`, { loanProductVersionId }),
    onSuccess: invalidate,
  });

  /** 2026-08-21 (user request): "Print Application" - generates the PDF, saves it as an Attachment
   * on the application (auto-shows in the Attachments tab below without a manual upload), then
   * opens it in a new tab so staff can preview it before printing/saving - not a forced download.
   * The tab is opened synchronously in the button's onClick (see `previewWindowRef` below), before
   * any awaiting happens, since browsers block `window.open` calls made outside a direct click
   * handler - the fetched PDF is then loaded into that already-open tab once ready. */
  const previewWindowRef = React.useRef<Window | null>(null);
  const generateFormMutation = useMutation({
    mutationFn: () => apiClient.post<Attachment>(`/loan-applications/${applicationId}/generate-form`, {}),
    onSuccess: async (attachment) => {
      queryClient.invalidateQueries({ queryKey: ['attachments', 'LOAN_APPLICATION', applicationId] });
      const blob = await fetchFileBlob(`/attachments/${attachment.id}/download`);
      const url = URL.createObjectURL(blob);
      if (previewWindowRef.current && !previewWindowRef.current.closed) {
        previewWindowRef.current.location.href = url;
      } else {
        window.open(url, '_blank');
      }
    },
    onError: () => {
      previewWindowRef.current?.close();
    },
  });

  const decideMutation = useMutation({
    mutationFn: (decision: 'APPROVED' | 'DECLINED') =>
      apiClient.post<LoanApplication>(`/loan-applications/${applicationId}/${decision === 'APPROVED' ? 'approve' : 'decline'}`, {
        decisionNote: decisionNote.trim() || undefined,
      }),
    onSuccess: () => {
      setDecisionNote('');
      setConfirmAction(null);
      invalidate();
    },
  });

  const revertMutation = useMutation({
    mutationFn: () => apiClient.post<LoanApplication>(`/loan-applications/${applicationId}/revert`),
    onSuccess: () => {
      setConfirmAction(null);
      invalidate();
    },
  });

  const startReviewMutation = useMutation({
    mutationFn: () => apiClient.post<LoanApplication>(`/loan-applications/${applicationId}/start-review`),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.delete<void>(`/loan-applications/${applicationId}`),
    onSuccess: () => {
      setDeleteOpen(false);
      navigate('/applications');
    },
  });

  const tagPreApprovalMutation = useMutation({
    mutationFn: () => apiClient.post<LoanApplication>(`/loan-applications/${applicationId}/tag-pre-approval`),
    onSuccess: () => {
      setConfirmAction(null);
      invalidate();
    },
  });

  /** 2026-09-09 (user request) - "Undo" for Tag as Pre Approval, one step back to UNDER_REVIEW
   * (see UndoLoanApplicationPreApprovalUseCase's doc comment for why this exists alongside the
   * broader revertMutation above). */
  const undoPreApprovalMutation = useMutation({
    mutationFn: () => apiClient.post<LoanApplication>(`/loan-applications/${applicationId}/undo-pre-approval`),
    onSuccess: () => {
      setConfirmAction(null);
      invalidate();
    },
  });

  if (!canAccessLoanApplications) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Lock className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">
              Restricted to <RoleAbbr role="MIS" />, <RoleAbbr role="Loan Operation Manager" />, and <RoleAbbr role="CRM" /> accounts
            </p>
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{currentAccount.name}</span> ({currentAccount.role}).
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (applicationQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <p className="text-sm text-muted-foreground">Loading application…</p>
      </div>
    );
  }

  if (applicationQuery.isError || !application) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> Application not found: {applicationId}
        </div>
      </div>
    );
  }

  const initials = application.applicantName
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const isPreApprovalStage = application.status === 'PREAPPROVED' || application.status === 'PREDECLINED';
  const isUnderReview = application.status === 'UNDER_REVIEW';
  const isPreApproval = application.status === 'PRE_APPROVAL';
  const isDecided = application.status === 'APPROVED' || application.status === 'DECLINED';
  const mutationError =
    assignProductMutation.error ||
    decideMutation.error ||
    revertMutation.error ||
    startReviewMutation.error ||
    tagPreApprovalMutation.error ||
    undoPreApprovalMutation.error;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="mb-1 -ml-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ApplicantAvatar ownerType="LOAN_APPLICATION" ownerId={application.id} initials={initials} />
            <div>
              <div className="flex items-center gap-3">
                {application.createdBorrowerId ? (
                  <Link
                    to={`/clients/${application.createdBorrowerId}`}
                    className="text-2xl font-semibold tracking-tight text-primary underline-offset-4 hover:underline"
                  >
                    {application.applicantName}
                  </Link>
                ) : (
                  <h2 className="text-2xl font-semibold tracking-tight">{application.applicantName}</h2>
                )}
                <Badge
                  variant={
                    application.status === 'APPROVED' && (isCreatedLoanAccountActivated || isCreatedLoanAccountAwaitingDisbursement)
                      ? 'success'
                      : DETAIL_STATUS_BADGE_VARIANT[application.status]
                  }
                >
                  {application.status === 'APPROVED' && isCreatedLoanAccountActivated
                    ? 'Disbursed'
                    : application.status === 'APPROVED' && isCreatedLoanAccountAwaitingDisbursement
                      ? 'For Disbursement'
                      : STATUS_DISPLAY_LABEL[application.status]}
                </Badge>
                {application.createdLoanAccountId && (
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/loans/${application.createdLoanAccountId}`} className="inline-flex items-center gap-1.5">
                      <Landmark className="h-3.5 w-3.5" />
                      Loan Account Created
                      {application.createdLoanAccountCode && (
                        <span className="font-mono text-xs text-muted-foreground">({application.createdLoanAccountCode})</span>
                      )}
                    </Link>
                  </Button>
                )}
              </div>
              <p className="font-mono text-xs text-muted-foreground">
                {productTypeLabel(productTypeLabelsQuery.data?.productTypeLabels, application.requestedCategory)} · Submitted{' '}
                {formatDate(application.createdAt)}
                {encodedByName ? ` · Encoded by ${encodedByName}` : ''}
                {application.submissionLatitude !== null && application.submissionLongitude !== null && (
                  <>
                    {' · '}
                    <a
                      href={`https://www.google.com/maps?q=${application.submissionLatitude},${application.submissionLongitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-dotted underline-offset-2 hover:text-foreground"
                    >
                      View submission location
                    </a>
                  </>
                )}
              </p>
              {isPreApprovalStage && (
                <p className="text-xs text-muted-foreground">
                  System pre-qualification -{' '}
                  {application.status === 'PREDECLINED' && application.preQualificationBreakdown
                    ? Object.values(application.preQualificationBreakdown.checks)
                        .filter((check) => !check.passed)
                        .map((check) => `${check.label.toLowerCase()} failed (${check.detail})`)
                        .join('; ') || 'did not meet requirements'
                    : application.distanceFromBranchKm !== null
                      ? `${application.distanceFromBranchKm} km from branch`
                      : 'distance from branch could not be verified'}
                  .
                </p>
              )}
            </div>
          </div>
          {canAccessLoanApplications && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {/* 2026-08-21 (user request): prints the application intake as a PDF, auto-saved to
                  the Attachments tab. Outlined (not filled) since it's optional/repeatable, unlike
                  Create Client Profile / Create Loan Account below which are one-time transitions.
                  Available once the application has a decision - nothing meaningful to print while
                  still under review. */}
              {(application.status === 'APPROVED' || application.status === 'DECLINED') && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-primary/50 text-primary hover:bg-primary/5"
                  disabled={generateFormMutation.isPending}
                  onClick={() => {
                    previewWindowRef.current = window.open('', '_blank');
                    generateFormMutation.mutate();
                  }}
                >
                  {generateFormMutation.isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Printer className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Print Application
                </Button>
              )}
              {!application.createdBorrowerId && (
                <Button
                  size="sm"
                  disabled={application.status !== 'APPROVED'}
                  onClick={() => setCreateClientOpen(true)}
                  title={application.status !== 'APPROVED' ? 'Only available once the application is Approved' : undefined}
                >
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Create Client Profile
                </Button>
              )}
              {/* Visible only once this application has a real client (createdBorrowerId set) and hasn't
                  already produced a loan account (that's now shown next to the applicant's name/status
                  above) - clickable only once this specific application is Approved, and the client has
                  no other active loan open (2026-07-14, moved from the Client Profile page so it's gated
                  per-application, not per-client). */}
              {application.createdBorrowerId && !application.createdLoanAccountId && (
                <Button
                  size="sm"
                  disabled={application.status !== 'APPROVED' || hasActiveLoan}
                  onClick={() => setCreateLoanOpen(true)}
                  title={
                    application.status !== 'APPROVED'
                      ? 'Only available once the application is Approved'
                      : hasActiveLoan
                        ? 'This client already has an active (or in-arrears) loan account'
                        : undefined
                  }
                >
                  <Landmark className="mr-1.5 h-3.5 w-3.5" /> Create Loan Account
                </Button>
              )}
              {/* 2026-08-16 (user request): Edit Application moved in here from its own button,
                  alongside Delete Application - both are secondary/less-frequent actions relative
                  to Create Client Profile / Create Loan Account, which stay as visible buttons. */}
              {((isPreApprovalStage || isUnderReview) || canDeleteLoanApplication) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="h-9 w-9 p-0" aria-label="More actions">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {/* 2026-08-12 (user request/bug fix): full intake-field edit, mirrors the backend's
                        updateStaffIntake() guard (PREAPPROVED/PREDECLINED/UNDER_REVIEW only) - see
                        UpdateLoanApplicationIntakeUseCase's doc comment. */}
                    {(isPreApprovalStage || isUnderReview) && (
                      <DropdownMenuItem onSelect={() => navigate(`/applications/${application.id}/edit`)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit Application
                      </DropdownMenuItem>
                    )}
                    {(isPreApprovalStage || isUnderReview) && canDeleteLoanApplication && <DropdownMenuSeparator />}
                    {canDeleteLoanApplication && (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        disabled={Boolean(application.createdBorrowerId) || Boolean(application.createdLoanAccountId)}
                        onSelect={() => {
                          setDeleteConfirmName('');
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete Application
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>
        <PipelineStepper status={application.status} />
      </div>

      {mutationError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {mutationError instanceof Error ? mutationError.message : 'Something went wrong.'}
        </div>
      )}

      {failedDocumentLabels.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" /> The application was created, but the following document(s) could not be
          saved as attachments automatically: {failedDocumentLabels.join(', ')}. Please upload them manually below.
        </div>
      )}

      {(() => {
        // 2026-07-25: everything from here to Activity Timeline is drag-to-reorder (see cardOrder
        // state above) - each section's JSX lives as one entry in this map so it can be rendered
        // in whatever order the current user saved, instead of a fixed sequence. Applicant
        // Details/Co-Borrower Details/Requested Loan share one 2-column grid and move together as
        // a single unit, since splitting them would break that shared layout.
        const cardsById: Record<string, React.ReactNode> = {};

        cardsById.applicantDetails = (
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Applicant Details</CardTitle>
            <CardDescription>
              {encodedByName
                ? `Walk-in applicant - encoded by ${encodedByName} from the paper form (ECLC-LOFN01)`
                : 'Submitted via the (not yet built) public loan application website'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <IconDt icon={UserIcon}>Age</IconDt>
              <dd className="text-right font-medium">{application.age ?? '-'}</dd>
              <IconDt icon={MapPin}>Address</IconDt>
              <dd className="text-right font-medium">{toProperCase(application.address) || '-'}</dd>
              <IconDt icon={MapPin}>Previous address</IconDt>
              <dd className="text-right font-medium">
                {application.previousAddressSameAsPresent ? 'Same as present address' : toProperCase(application.previousAddress) || '-'}
              </dd>
              <IconDt icon={Phone}>Contact Number</IconDt>
              <dd className="text-right font-medium">{formatMobileNumber(application.mobilePhone)}</dd>
              <IconDt icon={Mail}>Email</IconDt>
              <dd className="text-right font-medium">{application.email ?? '-'}</dd>
              <IconDt icon={Briefcase}>Employer</IconDt>
              <dd className="text-right font-medium">{application.employer ?? '-'}</dd>
              <IconDt icon={ExternalLink}>Facebook</IconDt>
              <dd className="text-right font-medium">
                {application.facebookLink ? (
                  <a
                    href={application.facebookLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    View profile
                  </a>
                ) : (
                  '-'
                )}
              </dd>
            </dl>
          </CardContent>
        </Card>
        );

        cardsById.coBorrowerDetails = (
          <CoBorrowerDetailsCard application={application} canEdit={canAccessLoanApplications && (isPreApprovalStage || isUnderReview)} />
        );

        cardsById.requestedLoan = (
        <Card>
          <CardHeader>
            <CardTitle>Requested Loan</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <IconDt icon={Landmark}>Category</IconDt>
              <dd className="text-right font-medium">{productTypeLabel(productTypeLabelsQuery.data?.productTypeLabels, application.requestedCategory)}</dd>
              <IconDt icon={CreditCard}>Requested amount</IconDt>
              <dd className="text-right font-medium">{formatPeso(application.requestedAmount)}</dd>
              <IconDt icon={Calendar}>Requested term</IconDt>
              <dd className="text-right font-medium">{application.requestedTermMonths} months</dd>
              {application.accountType && (
                <>
                  <IconDt icon={RotateCcw}>Type of account</IconDt>
                  <dd className="text-right font-medium">{application.accountType === 'NEW' ? 'New' : 'Renewal'}</dd>
                </>
              )}
              {application.loanPurpose && (
                <>
                  <IconDt icon={Flag}>Loan purpose</IconDt>
                  <dd className="text-right font-medium">{application.loanPurpose}</dd>
                </>
              )}
              {application.referralSource && (
                <>
                  <IconDt icon={UserPlus}>Found Easycash via</IconDt>
                  <dd className="text-right font-medium">{application.referralSource}</dd>
                </>
              )}
            </dl>

            {/* 2026-07-21 (user request) - same "not until a review has actually started" gate as
                the Underwriting card/Notes panel below; product type/class assignment is a
                reviewer task, not something relevant while the application is still just
                PREAPPROVED/PREDECLINED. Doesn't block Start Review itself (see the button below,
                only gated on canReviewLoanApplication) - it reappears the moment the review starts. */}
            {Boolean(application.reviewStartedAt) && (
            <>
            <Separator className="my-4" />

            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                The client only selects a category when applying - staff assigns the specific product type and class here.
              </p>
              {!isDecided ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Assigned product type</Label>
                    <Select
                      value={selectedProductType}
                      onValueChange={(v) => setSelectedProductType(v as LoanTypeOption)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product type" />
                      </SelectTrigger>
                      <SelectContent>
                        {LOAN_TYPE_OPTIONS.map((type) => (
                          <SelectItem key={type} value={type}>
                            {productTypeLabel(productTypeLabelsQuery.data?.productTypeLabels, type)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Assigned product class</Label>
                    <Select
                      value={application.assignedLoanProductVersionId ?? ''}
                      onValueChange={(v) => assignProductMutation.mutate(v)}
                      disabled={!selectedProductType || assignProductMutation.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={selectedProductType ? 'Select product class' : 'Select a product type first'} />
                      </SelectTrigger>
                      <SelectContent>
                        {productClassOptions.map((c) => (
                          <SelectItem key={c.versionId} value={c.versionId} disabled={c.discontinued}>
                            <span className="flex items-center gap-2">
                              {c.name}
                              {c.discontinued && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                  title="Discontinued - no longer offered to new applicants, not selectable here"
                                >
                                  Discontinued
                                </Badge>
                              )}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Assigned product type</p>
                    <p className="font-medium">
                      {selectedProductType ? productTypeLabel(productTypeLabelsQuery.data?.productTypeLabels, selectedProductType) : 'Not assigned'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Assigned product class</p>
                    <p className="font-mono">{assignedProductName ?? 'Not assigned'}</p>
                  </div>
                  {application.createdLoanAccountId && (
                    <div>
                      <p className="text-xs text-muted-foreground">Loan Account</p>
                      <Link
                        to={`/loans/${application.createdLoanAccountId}`}
                        className="inline-flex items-center gap-1.5 font-mono text-primary hover:underline"
                      >
                        <Landmark className="h-3.5 w-3.5" />
                        {application.createdLoanAccountCode ?? application.createdLoanAccountId}
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
            </>
            )}

            <Separator className="my-4" />

            {isPreApprovalStage && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="decision-note">Decision note (optional)</Label>
                  <Textarea
                    id="decision-note"
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    placeholder="e.g. Verified via phone call, proceeding as recommended..."
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => startReviewMutation.mutate()} disabled={!canReviewLoanApplication || startReviewMutation.isPending}>
                    {startReviewMutation.isPending ? 'Starting…' : 'Start Review'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmAction('DECLINED')}
                    disabled={!canReviewLoanApplication || decideMutation.isPending}
                  >
                    Decline Application
                  </Button>
                </div>
              </div>
            )}

            {isUnderReview && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => setConfirmAction('PRE_APPROVAL')}
                    disabled={!canReviewLoanApplication || tagPreApprovalMutation.isPending || agencyVerificationMissing}
                    title={agencyVerificationMissing ? 'Complete Agency Verification in the Review Report first (Seafarer Loan)' : undefined}
                  >
                    Tag as Pre Approval
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmAction('DECLINED')}
                    disabled={!canReviewLoanApplication || decideMutation.isPending}
                  >
                    Decline Application
                  </Button>
                  {/* 2026-09-09 (user request): same "Revert to AI Pre-Qualification" action already
                      available once Approved/Declined, now also reachable from Under Review - the
                      backend's revert() already supported this (it only blocks reverting FROM
                      PREAPPROVED/PREDECLINED), the frontend just never surfaced a button for it
                      here. Same MIS-only gate as the existing one below. */}
                  {canRevertLoanApplicationDecision && (
                    <Button
                      variant="ghost"
                      onClick={() => setConfirmAction('REVERT')}
                      disabled={revertMutation.isPending}
                      title="Move this application back to Pre-Qualification"
                    >
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Revert to Pre-Qualification
                    </Button>
                  )}
                </div>
              </div>
            )}

            {isPreApproval && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="decision-note">Decision note (optional)</Label>
                  <Textarea
                    id="decision-note"
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    placeholder="e.g. Verified via phone call, proceeding as recommended..."
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setConfirmAction('APPROVED')}
                    disabled={!application.assignedLoanProductVersionId || !canApproveLoanApplication || decideMutation.isPending}
                  >
                    Approve Application
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmAction('DECLINED')}
                    disabled={!canReviewLoanApplication || decideMutation.isPending}
                  >
                    Decline Application
                  </Button>
                  {/* 2026-09-09 (user request): "Undo" - one step back to Under Review, so a
                      Pre-Approval-stage correction doesn't need the broader revert() detour back
                      to system pre-qualification. */}
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmAction('UNDO_PRE_APPROVAL')}
                    disabled={!canReviewLoanApplication || undoPreApprovalMutation.isPending}
                    title="Move this application back to Under Review"
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Undo to Under Review
                  </Button>
                </div>
                {!application.assignedLoanProductVersionId && (
                  <p className="text-xs text-muted-foreground">Assign a product version above before approving.</p>
                )}
                {!canApproveLoanApplication && (
                  <p className="text-xs text-muted-foreground">
                    Only <RoleAbbr role="MIS" /> and <RoleAbbr role="Loan Operation Manager" /> can give the final approval.
                  </p>
                )}
              </div>
            )}

            {isDecided && (
              <div className="space-y-3">
                <div className="rounded-md border p-3 text-sm">
                  <p className="font-medium">
                    {application.status === 'APPROVED'
                      ? isCreatedLoanAccountActivated
                        ? 'Disbursed'
                        : isCreatedLoanAccountAwaitingDisbursement
                          ? 'For Disbursement'
                          : 'Approved'
                      : 'Declined'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {application.reviewedAt && formatDate(application.reviewedAt)}
                    {reviewedByName ? ` · by ${reviewedByName}` : ''}
                  </p>
                  {application.decisionNote && <p className="mt-2 text-sm text-muted-foreground">{application.decisionNote}</p>}
                </div>
                {canRevertLoanApplicationDecision ? (
                  isCreatedLoanAccountActivated ? (
                    <p className="text-xs text-muted-foreground">
                      This application's loan account has already been Activated - the decision can no longer be reverted.
                    </p>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmAction('REVERT')}
                      disabled={revertMutation.isPending}
                    >
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Revert to Pre-Qualification
                    </Button>
                  )
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Only MIS can revert a decided application back to AI pre-qualification (accidental-click safety net).
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        );

        cardsById.personalHousehold = (
      <Card>
        <CardHeader>
          <CardTitle>Personal &amp; Household Information</CardTitle>
          <CardDescription>Everything else captured on the application form - not shown above to keep the summary cards short.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-[1.5fr_1fr]">
          <div className="space-y-5">
            <PersonalInfoGroup label="Personal">
              <PersonalInfoRow icon={UserIcon} label="Gender" value={application.gender} />
              <PersonalInfoRow icon={Heart} label="Civil Status" value={application.civilStatus} />
              <PersonalInfoRow
                icon={Cake}
                label="Birth Date"
                value={
                  application.birthDate
                    ? `${formatDate(application.birthDate)} (${computeAge(application.birthDate)})`
                    : null
                }
              />
              <PersonalInfoRow icon={MapPin} label="Place of Birth" value={application.placeOfBirth} />
              <PersonalInfoRow icon={Flag} label="Nationality" value={application.nationality} />
            </PersonalInfoGroup>

            <PersonalInfoGroup label="Residence">
              <PersonalInfoRow icon={Home} label="Home Ownership" value={application.homeOwnership} />
              <PersonalInfoRow
                icon={Calendar}
                label="Length of Stay"
                value={
                  application.presentAddressLengthOfStayMonths != null
                    ? `${Math.floor(application.presentAddressLengthOfStayMonths / 12)} yr${Math.floor(application.presentAddressLengthOfStayMonths / 12) === 1 ? '' : 's'} ${application.presentAddressLengthOfStayMonths % 12} mo`
                    : null
                }
              />
            </PersonalInfoGroup>

            <PersonalInfoGroup label="Employment & IDs">
              <PersonalInfoRow icon={Briefcase} label="Occupation" value={application.occupation} />
              <PersonalInfoRow icon={MapPin} label="Office Address" value={application.officeAddress} />
              <PersonalInfoRow icon={IdCard} label="TIN" value={application.tinNumber} tabularNums />
              <PersonalInfoRow icon={CreditCard} label="SSS" value={application.sssNumber} tabularNums />
            </PersonalInfoGroup>
          </div>

          <div className="grid content-start gap-3">
            <div className="rounded-md border-l-2 border-primary bg-muted/40 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Dependants ({application.dependants.length})
              </p>
              {application.dependants.length === 0 ? (
                <p className="text-sm text-muted-foreground">None on record.</p>
              ) : (
                <ul className="space-y-1.5">
                  {application.dependants.map((d, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-medium">{d.name}</span>
                      <span className="text-muted-foreground">
                        {d.age ? ` · ${d.age} yrs old` : ''}
                        {d.relationship ? ` · ${d.relationship}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-md bg-muted/40 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <IdCard className="h-3.5 w-3.5" /> Character References
              </p>
              {!application.reference1Name && !application.reference2Name ? (
                <p className="text-sm text-muted-foreground">None on record.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {application.reference1Name && (
                    <li>
                      <span className="font-medium">{application.reference1Name}</span>
                      <span className="text-muted-foreground">
                        {application.reference1Mobile ? ` · ${formatMobileNumber(application.reference1Mobile)}` : ''}
                      </span>
                    </li>
                  )}
                  {application.reference2Name && (
                    <li>
                      <span className="font-medium">{application.reference2Name}</span>
                      <span className="text-muted-foreground">
                        {application.reference2Mobile ? ` · ${formatMobileNumber(application.reference2Mobile)}` : ''}
                      </span>
                    </li>
                  )}
                </ul>
              )}
            </div>

            {application.note && (
              <div className="rounded-md bg-muted/40 p-3">
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Note</p>
                <p className="text-sm">{application.note}</p>
                {encodedByName && <p className="mt-1 text-xs text-muted-foreground">Encoded by {encodedByName}</p>}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
        );

        // 2026-07-21 (user request) - underwriter features (Decision Scoring/DTI, risk-input
        // fields, review report) shouldn't be visible at all until a manual review has actually
        // started - PREAPPROVED/PREDECLINED is only the system's advisory pre-qualification
        // verdict, not a real underwriting pass yet. Only added to cardsById when applicable, so
        // they join the draggable set while shown but leave no dangling slot when hidden (see the
        // cardOrder.filter in the render below).
        if (isUnderReview && canUseAiDocumentReview) {
          cardsById.aiReview = (
            <AiDocumentReviewCard
              application={application}
              onInsert={(text) => underwritingCardRef.current?.insertCrmRecommendation(text)}
            />
          );
        }
        if (application.reviewStartedAt) {
          cardsById.underwriting = (
            <UnderwritingCard
              ref={underwritingCardRef}
              application={application}
              canEditRisk={canAccessLoanApplications}
              canEditReview={isUnderReview && canReviewLoanApplication}
              canEditAccountOwner={canReviewLoanApplication}
              showReview={isUnderReview || isPreApproval || (isDecided && Boolean(application.reviewReport))}
              assignedProductName={assignedProductName}
              documentsVerifiedByName={documentsVerifiedByName}
            />
          );
          // same "not until a review has actually started" gate as the Underwriting card above
          cardsById.notes = <ProfileNotesPanel ownerType="LOAN_APPLICATION" ownerId={application.id} />;
        }

        cardsById.attachments = <AttachmentsPanel ownerType="LOAN_APPLICATION" ownerId={application.id} canUpload={canAccessLoanApplications} />;

        cardsById.recentActivity = <RecentActivityPanel label="Loan Application" entityId={application.id} />;

        cardsById.activityTimeline = (
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>
            Log of all actions taken on this application by loan officers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileActivityTimeline
            profileType="LOAN_APPLICATION"
            profileId={application.id}
            showDetailsToggle={false}
          />
        </CardContent>
      </Card>
        );

        const dialogs = (
          <>
      <Dialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Confirm{' '}
              {confirmAction === 'REVERT'
                ? 'revert'
                : confirmAction === 'APPROVED'
                  ? 'approval'
                  : confirmAction === 'PRE_APPROVAL'
                    ? 'pre approval'
                    : confirmAction === 'UNDO_PRE_APPROVAL'
                      ? 'undo'
                      : 'decline'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === 'REVERT' &&
                `This will revert ${application.applicantName}'s application back to a freshly recomputed pre-qualification and clear the previous decision.`}
              {confirmAction === 'PRE_APPROVAL' &&
                `This will tag ${application.applicantName}'s application as Pre Approval and lock the Review Report. It will then be ready for the final Approve/Decline.`}
              {confirmAction === 'UNDO_PRE_APPROVAL' &&
                `This will move ${application.applicantName}'s application back to Under Review, unlocking the Review Report for editing again.`}
              {(confirmAction === 'APPROVED' || confirmAction === 'DECLINED') &&
                `Are you sure you want to ${confirmAction === 'APPROVED' ? 'approve' : 'decline'} ${application.applicantName}'s application? This is a safety-net confirmation to prevent an accidental click.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (confirmAction === 'REVERT') revertMutation.mutate();
                else if (confirmAction === 'PRE_APPROVAL') tagPreApprovalMutation.mutate();
                else if (confirmAction === 'UNDO_PRE_APPROVAL') undoPreApprovalMutation.mutate();
                else if (confirmAction === 'APPROVED' || confirmAction === 'DECLINED') decideMutation.mutate(confirmAction);
              }}
            >
              Yes, confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateClientProfileDialog open={createClientOpen} onOpenChange={setCreateClientOpen} application={application} />
      {clientBorrowerQuery.data && (
        <CreateLoanAccountDialog
          open={createLoanOpen}
          onOpenChange={setCreateLoanOpen}
          borrower={clientBorrowerQuery.data}
          requestedTermMonths={application.requestedTermMonths}
          applicationId={application.id}
        />
      )}

      <Dialog open={deleteOpen} onOpenChange={(open) => !open && !deleteMutation.isPending && setDeleteOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this application</DialogTitle>
            <DialogDescription>
              This permanently removes {application.applicantName}&apos;s application. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="delete-confirm-name">Type the applicant&apos;s name to confirm</Label>
            <Input
              id="delete-confirm-name"
              placeholder={application.applicantName}
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              disabled={deleteMutation.isPending}
            />
          </div>
          {deleteMutation.error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{deleteMutation.error instanceof Error ? deleteMutation.error.message : 'Something went wrong.'}</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending || deleteConfirmName.trim() !== application.applicantName}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete Application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
          </>
        );

        const visibleCardOrder = cardOrder.filter((id) => cardsById[id] !== undefined);

        return (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleCardDragEnd}>
                <SortableContext items={visibleCardOrder} strategy={verticalListSortingStrategy}>
                  {visibleCardOrder.map((id) => (
                    <SortableSection
                      key={id}
                      id={id}
                      fullWidth={
                        id === 'coBorrowerDetails' ||
                        id === 'underwriting' ||
                        id === 'notes' ||
                        id === 'personalHousehold' ||
                        id === 'attachments' ||
                        id === 'recentActivity' ||
                        id === 'activityTimeline'
                      }
                    >
                      {cardsById[id]}
                    </SortableSection>
                  ))}
                </SortableContext>
              </DndContext>
            </div>
            {dialogs}
          </>
        );
      })()}
    </div>
  );
}
