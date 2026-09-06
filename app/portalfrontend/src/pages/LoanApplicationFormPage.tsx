import * as React from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Camera, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { Dialog } from '@/components/ui/Dialog';
import { apiClient, ApiError } from '@/lib/apiClient';
import { LOAN_PRODUCTS } from '@/lib/loanProducts';
import { DOCUMENT_LABELS, DOCUMENT_SLOTS, type UploadableDocumentCategory } from '@/lib/loanRequirements';
import { PortalAddressPicker, emptyAddressDraft, type AddressDraft } from '@/components/PortalAddressPicker';
import { NumberInput } from '@/components/NumberInput';
import { GroupedDigitsInput } from '@/components/GroupedDigitsInput';
import { PhoneInput } from '@/components/PhoneInput';
import { TermsContent } from '@/pages/TermsPage';
import { PrivacyContent } from '@/pages/PrivacyPolicyPage';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type {
  PortalBranch,
  PortalDocumentCategory,
  PortalLoanApplicationDetail,
  PortalLoanApplicationSummary,
  PortalProfile,
  SubmitLoanApplicationRequest,
  UpdatePortalProfileRequest,
  UploadedDocument,
} from '@/lib/portalApiTypes';

const LOAN_CATEGORIES = LOAN_PRODUCTS.map((p) => p.category);
const GENDER_OPTIONS = ['Female', 'Male'];
const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widower', 'Separated'];
const HOME_OWNERSHIP_OPTIONS = ['Owned', 'Renting', 'Living with family'];
const REFERRAL_OPTIONS = ['Walk-in', 'Website', 'Facebook', 'Internet', 'Flyers/Signages/Streamers', 'Agent/Referral', 'Others'];

/* DOCUMENT_LABELS and DOCUMENT_SLOTS moved to @/lib/loanRequirements on 2026-07-28 so the public
 * Requirements page reads the same definitions this form does, and the two can never drift. */

/** Numbered section, matching the internal LMS staff-facing form's convention (mirrors the
 * printed loan application form, Form No. ECLC-LOFN01). 2026-07-24 (user request): expanded to
 * the full field set the staff form captures - only AI Auto-fill, "use a previous co-borrower"
 * (a cross-client history lookup - data-leak risk if public), and encodedByUserId (no staff
 * encoder for a self-service submission) are excluded. See PortalLoanApplicationDtos.ts's doc
 * comment on the backend for the same list. */
function SectionCard({ number, title, description, children }: { number: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <div>
        <h2 className="text-sm font-semibold text-primary">
          <span className="mr-2 font-mono text-xs text-muted-foreground">{number}.</span>
          {title}
        </h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5${className ? ` ${className}` : ''}`}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface DependantRow {
  name: string;
  age: string;
  relationship: string;
}

interface FormState {
  // §1 Referral
  referralSource: string;
  referralDetail: string;
  // §2 Loan Information
  accountType: 'NEW' | 'RENEWAL';
  branchId: string;
  requestedCategory: string;
  requestedAmount: string;
  requestedTermMonths: string;
  loanPurpose: string;
  // §3 Personal Information
  firstName: string;
  middleName: string;
  lastName: string;
  gender: string;
  civilStatus: string;
  nationality: string;
  birthDate: string;
  placeOfBirth: string;
  presentAddress: AddressDraft;
  sameAsPresentAddress: boolean;
  previousAddress: AddressDraft;
  homeOwnership: string;
  mobilePhone: string;
  email: string;
  // §4 Employment Information
  employer: string;
  occupation: string;
  officeAddress: string;
  monthlyIncome: string;
  tinNumber: string;
  sssNumber: string;
  // §5 Dependants
  dependants: DependantRow[];
  // §6 Spouse (shown only when civilStatus === 'Married')
  spouseName: string;
  spouseEmployer: string;
  // §7 Co-Borrower
  hasCoBorrower: boolean;
  coBorrowerName: string;
  coBorrowerRelationship: string;
  coBorrowerEmployer: string;
  coBorrowerContactNumber: string;
  coBorrowerEmail: string;
  coBorrowerAddress: string;
  // §8 Character References
  reference1Name: string;
  reference1Mobile: string;
  reference2Name: string;
  reference2Mobile: string;
  // §9 Note
  note: string;
  // §10 Terms & Consent
  agreedToTerms: boolean;
}

const INITIAL_FORM: FormState = {
  referralSource: 'Website',
  referralDetail: '',
  accountType: 'NEW',
  branchId: '',
  requestedCategory: '',
  requestedAmount: '',
  requestedTermMonths: '',
  loanPurpose: '',
  firstName: '',
  middleName: '',
  lastName: '',
  gender: '',
  civilStatus: '',
  nationality: 'Filipino',
  birthDate: '',
  placeOfBirth: '',
  presentAddress: emptyAddressDraft(),
  sameAsPresentAddress: true,
  previousAddress: emptyAddressDraft(),
  homeOwnership: '',
  mobilePhone: '',
  email: '',
  employer: '',
  occupation: '',
  officeAddress: '',
  monthlyIncome: '',
  tinNumber: '',
  sssNumber: '',
  dependants: [],
  spouseName: '',
  spouseEmployer: '',
  hasCoBorrower: false,
  coBorrowerName: '',
  coBorrowerRelationship: '',
  coBorrowerEmployer: '',
  coBorrowerContactNumber: '',
  coBorrowerEmail: '',
  coBorrowerAddress: '',
  reference1Name: '',
  reference1Mobile: '',
  reference2Name: '',
  reference2Mobile: '',
  note: '',
  agreedToTerms: false,
};

function addressToRequestFields(address: AddressDraft) {
  return {
    houseUnitNumber: address.houseUnitNumber.trim() || undefined,
    street: address.street.trim() || undefined,
    barangay: address.barangay.trim() || undefined,
    cityMunicipality: address.cityMunicipality.trim() || undefined,
    province: address.province.trim() || undefined,
    zipCode: address.zipCode.trim() || undefined,
  };
}

function addressToText(address: AddressDraft): string {
  return [address.houseUnitNumber, address.street, address.barangay, address.cityMunicipality, address.province]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(', ');
}

/** Splits a stored combined applicant name back into the form's separate first/middle/last
 * inputs when prefilling an edit - a plain heuristic (first token / last token / everything
 * between), matching the internal LMS's own splitFullName() convention. */
function splitFullName(fullName: string): { firstName: string; middleName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? '', middleName: '', lastName: '' };
  if (parts.length === 2) return { firstName: parts[0]!, middleName: '', lastName: parts[1]! };
  return { firstName: parts[0]!, middleName: parts.slice(1, -1).join(' '), lastName: parts[parts.length - 1]! };
}

/** Reverses the "Name (relationship)" convention handleSubmit's coBorrowerName combines - used to
 * prefill the edit form's separate name/relationship inputs. */
function parseCoBorrowerName(coBorrowerName: string): { name: string; relationship: string } {
  const match = coBorrowerName.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match) return { name: match[1]!.trim(), relationship: match[2]!.trim() };
  return { name: coBorrowerName.trim(), relationship: '' };
}

function detailToFormState(detail: PortalLoanApplicationDetail): FormState {
  const name = splitFullName(detail.applicantName);
  const coBorrower = detail.coBorrowerName ? parseCoBorrowerName(detail.coBorrowerName) : { name: '', relationship: '' };
  const [referralSource, ...referralDetailParts] = (detail.referralSource ?? 'Website').split(' - ');
  return {
    ...INITIAL_FORM,
    referralSource: referralSource || 'Website',
    referralDetail: referralDetailParts.join(' - '),
    accountType: detail.accountType ?? 'NEW',
    branchId: detail.branchId,
    requestedCategory: detail.requestedCategory,
    requestedAmount: String(detail.requestedAmount),
    requestedTermMonths: String(detail.requestedTermMonths),
    loanPurpose: detail.loanPurpose ?? '',
    firstName: name.firstName,
    middleName: name.middleName,
    lastName: name.lastName,
    gender: detail.gender ?? '',
    civilStatus: detail.civilStatus ?? '',
    nationality: detail.nationality ?? 'Filipino',
    birthDate: detail.birthDate ? detail.birthDate.slice(0, 10) : '',
    placeOfBirth: detail.placeOfBirth ?? '',
    presentAddress: {
      houseUnitNumber: detail.houseUnitNumber ?? '',
      street: detail.street ?? '',
      barangay: detail.barangay ?? '',
      cityMunicipality: detail.cityMunicipality ?? '',
      province: detail.province ?? '',
      zipCode: detail.zipCode ?? '',
    },
    sameAsPresentAddress: detail.previousAddressSameAsPresent,
    previousAddress: {
      houseUnitNumber: detail.previousHouseUnitNumber ?? '',
      street: detail.previousStreet ?? '',
      barangay: detail.previousBarangay ?? '',
      cityMunicipality: detail.previousCityMunicipality ?? '',
      province: detail.previousProvince ?? '',
      zipCode: detail.previousZipCode ?? '',
    },
    homeOwnership: detail.homeOwnership ?? '',
    mobilePhone: detail.mobilePhone ?? '',
    email: detail.email ?? '',
    employer: detail.employer ?? '',
    occupation: detail.occupation ?? '',
    officeAddress: detail.officeAddress ?? '',
    monthlyIncome: detail.monthlyIncome ? String(detail.monthlyIncome) : '',
    tinNumber: detail.tinNumber ?? '',
    sssNumber: detail.sssNumber ?? '',
    dependants: (detail.dependants ?? []).map((d) => ({ name: d.name, age: d.age ?? '', relationship: d.relationship ?? '' })),
    hasCoBorrower: Boolean(detail.coBorrowerName),
    coBorrowerName: coBorrower.name,
    coBorrowerRelationship: coBorrower.relationship,
    coBorrowerEmployer: detail.coBorrowerEmployer ?? '',
    coBorrowerContactNumber: detail.coBorrowerContactNumber ?? '',
    coBorrowerEmail: detail.coBorrowerEmail ?? '',
    coBorrowerAddress: detail.coBorrowerAddress ?? '',
    reference1Name: detail.reference1Name ?? '',
    reference1Mobile: detail.reference1Mobile ?? '',
    reference2Name: detail.reference2Name ?? '',
    reference2Mobile: detail.reference2Mobile ?? '',
    note: detail.note ?? '',
  };
}

/** 2026-07-31 (user request): prefills a brand-new application from whatever the applicant has
 * already saved on My Profile - only fills fields the form doesn't already have a value for
 * (e.g. from a `?category=` deep link), never overwrites something the applicant already typed. */
function applyProfilePrefill(prev: FormState, profile: PortalProfile): FormState {
  const presentAddress = profile.addresses[0];
  const next = { ...prev };
  const fillIfEmpty = <K extends keyof FormState>(key: K, value: FormState[K] | null | undefined) => {
    if (value === null || value === undefined || value === '') return;
    const current = next[key];
    if (typeof current === 'string' && current.trim()) return;
    next[key] = value;
  };
  fillIfEmpty('firstName', profile.firstName);
  fillIfEmpty('middleName', profile.middleName ?? '');
  fillIfEmpty('lastName', profile.lastName);
  fillIfEmpty('gender', profile.gender ?? '');
  fillIfEmpty('civilStatus', profile.civilStatus ?? '');
  fillIfEmpty('nationality', profile.nationality ?? '');
  fillIfEmpty('birthDate', profile.birthDate ? profile.birthDate.slice(0, 10) : '');
  fillIfEmpty('placeOfBirth', profile.placeOfBirth ?? '');
  fillIfEmpty('homeOwnership', profile.homeOwnership ?? '');
  fillIfEmpty('mobilePhone', profile.mobilePhone1 ?? '');
  fillIfEmpty('email', profile.email ?? '');
  fillIfEmpty('employer', profile.employer ?? '');
  fillIfEmpty('occupation', profile.occupation ?? '');
  fillIfEmpty('officeAddress', profile.officeAddress ?? '');
  fillIfEmpty('tinNumber', profile.tinNumber ?? '');
  fillIfEmpty('sssNumber', profile.sssNumber ?? '');
  fillIfEmpty('monthlyIncome', profile.monthlyIncome !== null ? String(profile.monthlyIncome) : '');
  fillIfEmpty('reference1Name', profile.reference1Name ?? '');
  fillIfEmpty('reference1Mobile', profile.reference1Mobile ?? '');
  fillIfEmpty('reference2Name', profile.reference2Name ?? '');
  fillIfEmpty('reference2Mobile', profile.reference2Mobile ?? '');
  if (next.dependants.length === 0 && profile.dependants.length > 0) {
    next.dependants = profile.dependants.map((d) => ({ name: d.name, age: d.age ?? '', relationship: d.relationship ?? '' }));
  }
  if (presentAddress) {
    const hasTypedAddress = Object.values(next.presentAddress).some((v) => v.trim());
    if (!hasTypedAddress) {
      next.presentAddress = {
        houseUnitNumber: presentAddress.houseUnitNumber ?? '',
        street: presentAddress.street ?? '',
        barangay: presentAddress.barangay ?? '',
        cityMunicipality: presentAddress.cityMunicipality ?? '',
        province: presentAddress.province ?? '',
        zipCode: presentAddress.zipCode ?? '',
      };
    }
  }
  return next;
}

/** 2026-07-31 (user request): the "Other" slot's idle-state hint explains its dual purpose - a
 * home for supporting documents that don't fit any specific category, and the place to re-upload
 * a corrected replacement for something already uploaded wrong (name the file so it's clear it's
 * a correction, e.g. "Valid ID - corrected"). */
function documentSlotHint(
  category: UploadableDocumentCategory,
  status: 'idle' | 'uploading' | 'done' | 'error' | undefined,
  t: import('@/lib/i18n/translations').Translations,
): string {
  if (status === 'done') return t.loanApplicationForm.uploaded;
  if (status === 'uploading') return t.loanApplicationForm.uploading;
  if (status === 'error') return t.loanApplicationForm.uploadFailed;
  if (category === 'OTHER_SUPPORTING_DOCUMENT') {
    return t.loanApplicationForm.otherDocumentHint;
  }
  return t.loanApplicationForm.documentFileNote;
}

/** One document upload row - shared by the two `visibleDocumentSlots.map(...)` render sites
 * (right after a NEW submission, and revisiting an editable application later) so the "Take Photo"
 * addition below only needs to exist once. 2026-09-06 (user request, mockup-approved): a phone/
 * laptop applicant can now snap a photo directly instead of finding a saved file first - reuses
 * the same `onCapture` callback shape as a plain file input's `onChange`. */
function DocumentSlotRow({
  category,
  status,
  onCapture,
  onFileSelected,
}: {
  category: UploadableDocumentCategory;
  status: 'idle' | 'uploading' | 'done' | 'error' | undefined;
  onCapture: () => void;
  onFileSelected: (file: File | undefined) => void;
}) {
  const { t } = useLanguage();
  const disabled = status === 'uploading' || status === 'done';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
      <div>
        <p className="text-sm font-medium">{DOCUMENT_LABELS[category]}</p>
        <p className="text-xs text-muted-foreground">{documentSlotHint(category, status, t)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onCapture}>
          <Camera className="mr-1.5 h-3.5 w-3.5" /> Take Photo
        </Button>
        <Input
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          className="w-auto"
          disabled={disabled}
          onChange={(e) => onFileSelected(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}

/** 2026-07-31 (user request): the reverse direction of applyProfilePrefill - after a NEW
 * application is submitted, mirror whatever the applicant just typed back onto My Profile, but
 * ONLY for fields still empty there. Never overwrites a field the applicant already filled in on
 * Profile directly - "hindi ireplace ni loan application form ang mga fields na meron na naka
 * encoded sa my profile". */
function buildProfileBackfill(profile: PortalProfile, form: FormState): UpdatePortalProfileRequest {
  const backfill: UpdatePortalProfileRequest = {};
  const fillIfEmpty = <K extends keyof UpdatePortalProfileRequest>(key: K, currentValue: unknown, newValue: UpdatePortalProfileRequest[K]) => {
    const isEmpty = currentValue === null || currentValue === undefined || currentValue === '';
    if (!isEmpty) return;
    if (newValue === undefined || newValue === '') return;
    backfill[key] = newValue;
  };

  fillIfEmpty('firstName', profile.firstName, form.firstName.trim() || undefined);
  fillIfEmpty('middleName', profile.middleName, form.middleName.trim() || undefined);
  fillIfEmpty('lastName', profile.lastName, form.lastName.trim() || undefined);
  fillIfEmpty('gender', profile.gender, form.gender || undefined);
  fillIfEmpty('birthDate', profile.birthDate, form.birthDate || undefined);
  fillIfEmpty('placeOfBirth', profile.placeOfBirth, form.placeOfBirth.trim() || undefined);
  fillIfEmpty('nationality', profile.nationality, form.nationality.trim() || undefined);
  fillIfEmpty('civilStatus', profile.civilStatus, form.civilStatus || undefined);
  fillIfEmpty('homeOwnership', profile.homeOwnership, form.homeOwnership || undefined);
  fillIfEmpty('mobilePhone1', profile.mobilePhone1, form.mobilePhone.trim() || undefined);
  fillIfEmpty('email', profile.email, form.email.trim() || undefined);
  fillIfEmpty('occupation', profile.occupation, form.occupation.trim() || undefined);
  fillIfEmpty('employer', profile.employer, form.employer.trim() || undefined);
  fillIfEmpty('officeAddress', profile.officeAddress, form.officeAddress.trim() || undefined);
  fillIfEmpty('tinNumber', profile.tinNumber, form.tinNumber.trim() || undefined);
  fillIfEmpty('sssNumber', profile.sssNumber, form.sssNumber.trim() || undefined);
  fillIfEmpty('monthlyIncome', profile.monthlyIncome, form.monthlyIncome ? Number(form.monthlyIncome) : undefined);
  fillIfEmpty('reference1Name', profile.reference1Name, form.reference1Name.trim() || undefined);
  fillIfEmpty('reference1Mobile', profile.reference1Mobile, form.reference1Mobile.trim() || undefined);
  fillIfEmpty('reference2Name', profile.reference2Name, form.reference2Name.trim() || undefined);
  fillIfEmpty('reference2Mobile', profile.reference2Mobile, form.reference2Mobile.trim() || undefined);

  if ((!profile.dependants || profile.dependants.length === 0) && form.dependants.some((d) => d.name.trim())) {
    backfill.dependants = form.dependants.filter((d) => d.name.trim()).map((d) => ({ name: d.name.trim(), age: d.age.trim() || undefined, relationship: d.relationship.trim() || undefined }));
  }

  const hasProfileAddress = profile.addresses[0] && Object.values(profile.addresses[0]).some((v) => v);
  if (!hasProfileAddress && Object.values(form.presentAddress).some((v) => v.trim())) {
    backfill.addresses = [form.presentAddress];
  }

  return backfill;
}

function computeAge(birthDate: string): number | null {
  if (!birthDate) return null;
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let value = now.getFullYear() - dob.getFullYear();
  if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) value -= 1;
  return value;
}

/** 2026-07-24 (user request) — best-effort device GPS capture at submission time via the
 * browser's Geolocation API. Deliberately never blocks/delays submission on a denial, timeout, or
 * unsupported browser - resolves null in every failure case instead of rejecting, so callers can
 * just await it and move on. A short 5s timeout keeps a slow/stuck GPS fix from stalling the whole
 * form; `maximumAge` allows a recently-cached fix instead of always forcing a fresh one. */
function getBestEffortGeolocation(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 },
    );
  });
}

/** Client-facing loan application form (Phase 2, 2026-07-23; expanded to the full field set
 * 2026-07-24) - the same fields the staff-facing form captures (app/frontend's
 * LoanApplicationCreatePage.tsx), following the same section numbering/grouping/order, minus what
 * genuinely can't apply to public self-service (see SectionCard's own doc comment). Two steps in
 * one page: submit the application, then (optionally) attach supporting documents to the
 * freshly-created record. */
const EDITABLE_STATUSES = new Set(['PREAPPROVED', 'PREDECLINED']);

/** Strips the full-page chrome (min-h-screen background, container width) when rendered inside a
 * Dialog - the Dialog already supplies its own box/scroll/padding. */
function PageShell({ embedded, children }: { embedded: boolean; children: React.ReactNode }) {
  if (embedded) return <>{children}</>;
  return (
    <div className="min-h-screen bg-secondary/30 py-10">
      <div className="container max-w-2xl">{children}</div>
    </div>
  );
}

/** 2026-07-31 (user request): when opened as a Dialog (edit-only - see PortalDialogHost), the
 * caller supplies the application id and a close handler directly instead of this reading them
 * off the route (`/apply/:id` still works standalone for direct links/bookmarks). Only editing is
 * ever embedded - a brand-new application is a longer, deliberate multi-step flow (Terms &amp;
 * Consent, geolocation capture) that stays a full page. */
interface LoanApplicationFormPageProps {
  embeddedEditId?: string;
  onEmbeddedClose?: () => void;
}

export function LoanApplicationFormPage({ embeddedEditId, onEmbeddedClose }: LoanApplicationFormPageProps = {}) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { id: routeEditId } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const editId = embeddedEditId ?? routeEditId;
  const isEmbedded = Boolean(embeddedEditId);
  const isEditMode = Boolean(editId);
  const goToDashboard = () => {
    if (isEmbedded) onEmbeddedClose?.();
    else navigate('/dashboard');
  };
  const [branches, setBranches] = React.useState<PortalBranch[]>([]);
  // Pre-selects the product when arriving from LoanProductsPage's "Apply Now" (?category=...) -
  // only honored if it's a real, currently-offered category, never trusted blindly from the URL.
  const [form, setForm] = React.useState<FormState>(() => {
    const requestedCategory = searchParams.get('category');
    return requestedCategory && (LOAN_CATEGORIES as string[]).includes(requestedCategory)
      ? { ...INITIAL_FORM, requestedCategory }
      : INITIAL_FORM;
  });
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showTerms, setShowTerms] = React.useState(false);
  const [showPrivacy, setShowPrivacy] = React.useState(false);
  const [submitted, setSubmitted] = React.useState<PortalLoanApplicationSummary | null>(null);
  const [uploadState, setUploadState] = React.useState<Partial<Record<PortalDocumentCategory, 'idle' | 'uploading' | 'done' | 'error'>>>({});
  // Camera capture for document slots (2026-09-06 user request) - generic, same shape as the
  // internal LMS's own camera dialog: `openCamera(onCapture)` stores the callback, so every slot's
  // "Take Photo" button can request one without duplicating the getUserMedia/canvas plumbing.
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const cameraStreamRef = React.useRef<MediaStream | null>(null);
  const cameraCaptureCallbackRef = React.useRef<((file: File) => void) | null>(null);
  // Edit mode only: null while loading, 'not-editable' once loaded but status has moved past
  // PREAPPROVED/PREDECLINED (mirrors the backend's own updateSelfServiceIntake() guard), 'ready'
  // once the fetched record has been mapped into `form`.
  const [editState, setEditState] = React.useState<'loading' | 'not-editable' | 'ready' | 'error'>(isEditMode ? 'loading' : 'ready');
  const [editSaved, setEditSaved] = React.useState(false);

  React.useEffect(() => {
    apiClient
      .get<PortalBranch[]>('/portal/branches')
      .then(setBranches)
      .catch(() => setBranches([]));
  }, []);

  React.useEffect(() => {
    if (!editId) return;
    apiClient
      .get<PortalLoanApplicationDetail>(`/portal/loan-applications/${editId}`)
      .then((detail) => {
        if (!EDITABLE_STATUSES.has(detail.status)) {
          setEditState('not-editable');
          return;
        }
        setForm(detailToFormState(detail));
        setEditState('ready');
      })
      .catch(() => setEditState('error'));
  }, [editId]);

  // 2026-07-31 (user request): while the form is still editable, an applicant can come back to
  // finish uploading documents they skipped at submission - prefill which slots are already
  // uploaded so re-visiting doesn't show them as empty.
  React.useEffect(() => {
    if (!editId) return;
    apiClient
      .get<UploadedDocument[]>(`/portal/loan-applications/${editId}/documents`)
      .then((documents) => {
        setUploadState((prev) => {
          const next = { ...prev };
          for (const doc of documents) {
            if (doc.documentCategory) next[doc.documentCategory] = 'done';
          }
          return next;
        });
      })
      .catch(() => {});
  }, [editId]);

  // 2026-07-31 (user request): a brand-new application prefills from My Profile if the applicant
  // already filled that in first - never runs in edit mode (detailToFormState already owns that
  // prefill) and is a one-shot best-effort fetch, silently skipped if it fails or the account has
  // no profile data yet.
  React.useEffect(() => {
    if (isEditMode) return;
    apiClient
      .get<PortalProfile>('/portal/profile')
      .then((profile) => setForm((prev) => applyProfilePrefill(prev, profile)))
      .catch(() => {});
  }, [isEditMode]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const age = React.useMemo(() => computeAge(form.birthDate), [form.birthDate]);

  const visibleDocumentSlots = React.useMemo(
    () => DOCUMENT_SLOTS.filter((slot) => !slot.showWhen || slot.showWhen({ loanCategory: form.requestedCategory, hasCoBorrower: form.hasCoBorrower })),
    [form.requestedCategory, form.hasCoBorrower],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const applicantName = [form.firstName, form.middleName, form.lastName].map((p) => p.trim()).filter(Boolean).join(' ');
    const requestedAmount = Number(form.requestedAmount);
    const requestedTermMonths = Number(form.requestedTermMonths);

    if (!applicantName) {
      setError(t.loanApplicationForm.validation.applicantName);
      return;
    }
    if (!form.branchId) {
      setError(t.loanApplicationForm.validation.branch);
      return;
    }
    if (!requestedAmount || requestedAmount <= 0) {
      setError(t.loanApplicationForm.validation.amount);
      return;
    }
    if (!requestedTermMonths || requestedTermMonths <= 0) {
      setError(t.loanApplicationForm.validation.term);
      return;
    }
    if (!isEditMode && !form.agreedToTerms) {
      setError(t.loanApplicationForm.validation.terms);
      return;
    }
    // 2026-07-30 (user request): hard eligibility gate - applicants under 18 or over 59 cannot
    // submit at all. Only blocks when age is actually known; the backend enforces this too
    // (CreateLoanApplicationUseCase) since client-side validation alone is never a real safeguard.
    if (age !== null && (age < 18 || age > 59)) {
      setError(t.loanApplicationForm.validation.age.replace('{age}', String(age)));
      return;
    }

    setIsSubmitting(true);
    try {
      // Skipped entirely on an edit (PATCH) - the geotag is a one-time "where were they when they
      // first applied" signal, not something re-captured on every save. Never blocks/delays a new
      // submission for longer than the geolocation helper's own 5s timeout.
      const geolocation = isEditMode ? null : await getBestEffortGeolocation();
      const body: SubmitLoanApplicationRequest = {
        branchId: form.branchId,
        applicantName,
        age: age ?? undefined,
        submissionLatitude: geolocation?.latitude,
        submissionLongitude: geolocation?.longitude,
        birthDate: form.birthDate || undefined,
        gender: form.gender || undefined,
        civilStatus: form.civilStatus || undefined,
        nationality: form.nationality.trim() || undefined,
        placeOfBirth: form.placeOfBirth.trim() || undefined,
        homeOwnership: form.homeOwnership || undefined,
        address: addressToText(form.presentAddress) || undefined,
        ...addressToRequestFields(form.presentAddress),
        previousAddressSameAsPresent: form.sameAsPresentAddress,
        ...(form.sameAsPresentAddress
          ? {}
          : {
              previousAddress: addressToText(form.previousAddress) || undefined,
              previousHouseUnitNumber: form.previousAddress.houseUnitNumber.trim() || undefined,
              previousStreet: form.previousAddress.street.trim() || undefined,
              previousBarangay: form.previousAddress.barangay.trim() || undefined,
              previousCityMunicipality: form.previousAddress.cityMunicipality.trim() || undefined,
              previousProvince: form.previousAddress.province.trim() || undefined,
              previousZipCode: form.previousAddress.zipCode.trim() || undefined,
            }),
        mobilePhone: form.mobilePhone.trim() || undefined,
        email: form.email.trim() || undefined,
        employer: form.employer.trim() || undefined,
        occupation: form.occupation.trim() || undefined,
        officeAddress: form.officeAddress.trim() || undefined,
        monthlyIncome: form.monthlyIncome ? Number(form.monthlyIncome) : undefined,
        tinNumber: form.tinNumber.trim() || undefined,
        sssNumber: form.sssNumber.trim() || undefined,
        dependants: form.dependants
          .filter((d) => d.name.trim())
          .map((d) => ({ name: d.name.trim(), age: d.age.trim() || undefined, relationship: d.relationship.trim() || undefined })),
        coBorrowerName:
          form.hasCoBorrower && form.coBorrowerName.trim()
            ? `${form.coBorrowerName.trim()}${form.coBorrowerRelationship.trim() ? ` (${form.coBorrowerRelationship.trim().toLowerCase()})` : ''}`
            : undefined,
        coBorrowerEmployer: form.hasCoBorrower && form.coBorrowerEmployer.trim() ? form.coBorrowerEmployer.trim() : undefined,
        coBorrowerContactNumber: form.hasCoBorrower && form.coBorrowerContactNumber.trim() ? form.coBorrowerContactNumber.trim() : undefined,
        coBorrowerEmail: form.hasCoBorrower && form.coBorrowerEmail.trim() ? form.coBorrowerEmail.trim() : undefined,
        coBorrowerAddress: form.hasCoBorrower && form.coBorrowerAddress.trim() ? form.coBorrowerAddress.trim() : undefined,
        reference1Name: form.reference1Name.trim() || undefined,
        reference1Mobile: form.reference1Mobile.trim() || undefined,
        reference2Name: form.reference2Name.trim() || undefined,
        reference2Mobile: form.reference2Mobile.trim() || undefined,
        note: form.note.trim() || undefined,
        referralSource: form.referralDetail.trim() ? `${form.referralSource} - ${form.referralDetail.trim()}` : form.referralSource,
        accountType: form.accountType,
        loanPurpose: form.loanPurpose.trim() || undefined,
        requestedCategory: form.requestedCategory,
        requestedAmount,
        requestedTermMonths,
      };
      if (isEditMode) {
        await apiClient.patch<PortalLoanApplicationDetail>(`/portal/loan-applications/${editId}`, body, true);
        setEditSaved(true);
      } else {
        const result = await apiClient.post<PortalLoanApplicationSummary>('/portal/loan-applications', body, true);
        setSubmitted(result);
        // 2026-07-31 (user request): the reverse direction of the profile<->application sync -
        // some applicants fill out the application before ever touching My Profile, so mirror
        // whatever they just entered back onto the profile. Best-effort/fire-and-forget: never
        // blocks or fails the (already-successful) application submission, and the backend itself
        // only actually applies this while the account is unlinked (UpdatePortalProfileUseCase).
        // 2026-07-31 (user request, refined): must NEVER overwrite a field the applicant already
        // filled in on My Profile directly - re-fetches the current profile first and only
        // includes still-empty fields in the sync, rather than blindly overwriting with whatever
        // the application form happens to hold.
        apiClient
          .get<PortalProfile>('/portal/profile')
          .then((profile) => {
            const backfill = buildProfileBackfill(profile, form);
            if (Object.keys(backfill).length > 0) {
              return apiClient.patch('/portal/profile', backfill, true);
            }
          })
          .catch(() => {});
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : isEditMode
            ? t.loanApplicationForm.validation.genericSave
            : t.loanApplicationForm.validation.genericSubmit,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpload = async (category: PortalDocumentCategory, file: File | undefined) => {
    const applicationId = submitted?.id ?? editId;
    if (!file || !applicationId) return;
    setUploadState((prev) => ({ ...prev, [category]: 'uploading' }));
    try {
      await apiClient.postFile(`/portal/loan-applications/${applicationId}/documents`, file, { documentCategory: category });
      setUploadState((prev) => ({ ...prev, [category]: 'done' }));
    } catch {
      setUploadState((prev) => ({ ...prev, [category]: 'error' }));
    }
  };

  const stopCameraStream = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
  };

  const openCamera = async (onCapture: (file: File) => void) => {
    cameraCaptureCallbackRef.current = onCapture;
    setCameraError(null);
    setCameraOpen(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('This browser does not support camera capture here (navigator.mediaDevices.getUserMedia is unavailable). Please choose a file instead.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      cameraStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      // 2026-09-06 (user-reported real-device failure): the previous generic message gave no way
      // to tell a denied-permission error apart from a hardware/constraint error like
      // NotFoundError or NotReadableError - surfacing the actual DOMException name/message so the
      // next report says exactly what's wrong instead of re-guessing.
      const name = err instanceof DOMException ? err.name : 'Error';
      const detail = err instanceof Error ? err.message : String(err);
      setCameraError(`Could not access the camera (${name}: ${detail}). Check your browser/device camera permission, or choose a file instead.`);
    }
  };

  const closeCamera = () => {
    stopCameraStream();
    setCameraOpen(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const onCapture = cameraCaptureCallbackRef.current;
        closeCamera();
        onCapture?.(file);
      },
      'image/jpeg',
      0.92,
    );
  };

  React.useEffect(() => stopCameraStream, []);

  if (isEditMode && editState === 'loading') {
    return (
      <PageShell embedded={isEmbedded}>
        <Card className="p-8 text-center text-sm text-muted-foreground">{t.loanApplicationForm.loading}</Card>
      </PageShell>
    );
  }

  if (isEditMode && editState === 'not-editable') {
    return (
      <PageShell embedded={isEmbedded}>
        <Card className="p-8">
          <Alert>{t.loanApplicationForm.notEditable}</Alert>
          <Button className="mt-6 w-full" onClick={goToDashboard}>
            {t.loanApplicationForm.goToDashboard}
          </Button>
        </Card>
      </PageShell>
    );
  }

  if (isEditMode && editState === 'error') {
    return (
      <PageShell embedded={isEmbedded}>
        <Card className="p-8">
          <Alert>{t.loanApplicationForm.loadError}</Alert>
          <Button className="mt-6 w-full" onClick={goToDashboard}>
            {t.loanApplicationForm.goToDashboard}
          </Button>
        </Card>
      </PageShell>
    );
  }

  if (isEditMode && editSaved) {
    return (
      <PageShell embedded={isEmbedded}>
        <Card className="p-8">
          <Alert tone="success">{t.loanApplicationForm.changesSaved}</Alert>
          <Button className="mt-6 w-full" onClick={goToDashboard}>
            {t.loanApplicationForm.goToDashboard}
          </Button>
        </Card>
      </PageShell>
    );
  }

  if (submitted) {
    return (
      <PageShell embedded={isEmbedded}>
        <Card className="p-8">
          <Alert tone="success">{t.loanApplicationForm.submitted}</Alert>
          <h1 className="mt-6 text-lg font-bold tracking-tight">{t.loanApplicationForm.documentsTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.loanApplicationForm.documentsIntro}</p>
          <div className="mt-5 space-y-4">
            {visibleDocumentSlots.map((slot) => (
              <DocumentSlotRow
                key={slot.category}
                category={slot.category}
                status={uploadState[slot.category]}
                onCapture={() => openCamera((file) => handleUpload(slot.category, file))}
                onFileSelected={(file) => handleUpload(slot.category, file)}
              />
            ))}
          </div>
          <Button className="mt-6 w-full" onClick={goToDashboard}>
            {t.loanApplicationForm.goToDashboard}
          </Button>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell embedded={isEmbedded}>
      <>
        {!isEmbedded && (
          <Link to="/dashboard" className="mb-6 flex items-center gap-2.5">
            <img src="./logo-easycash.png" alt="Easycash" className="h-8 w-8 rounded-lg object-contain" />
            <span className="text-base font-bold tracking-tight">Easycash Portal</span>
          </Link>
        )}
        <Card className="p-8">
          {!isEmbedded && (
            <>
              <h1 className="text-xl font-bold tracking-tight">
                {isEditMode ? t.loanApplicationForm.editTitle : t.loanApplicationForm.newTitle}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{t.loanApplicationForm.requiredNote}</p>
            </>
          )}

          <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
            {error && <Alert>{error}</Alert>}

            <SectionCard number="1" title={t.loanApplicationForm.section1.title}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t.loanApplicationForm.section1.source}>
                  <Select value={form.referralSource} onChange={(e) => update('referralSource', e.target.value)}>
                    {REFERRAL_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </Field>
                {(form.referralSource === 'Agent/Referral' || form.referralSource === 'Others') && (
                  <Field
                    label={
                      form.referralSource === 'Agent/Referral'
                        ? t.loanApplicationForm.section1.agentReferrerName
                        : t.loanApplicationForm.section1.pleaseSpecify
                    }
                  >
                    <Input value={form.referralDetail} onChange={(e) => update('referralDetail', e.target.value)} />
                  </Field>
                )}
              </div>
            </SectionCard>

            <SectionCard number="2" title={t.loanApplicationForm.section2.title}>
              <div className="space-y-1.5">
                <Label htmlFor="branchId">{t.loanApplicationForm.section2.nearestBranch}</Label>
                <Select id="branchId" required value={form.branchId} onChange={(e) => update('branchId', e.target.value)}>
                  <option value="">{t.loanApplicationForm.section2.selectBranch}</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                      {branch.address ? ` - ${branch.address}` : ''}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t.loanApplicationForm.section2.typeOfAccount}>
                  <Select value={form.accountType} onChange={(e) => update('accountType', e.target.value as 'NEW' | 'RENEWAL')}>
                    <option value="NEW">{t.loanApplicationForm.section2.new}</option>
                    <option value="RENEWAL">{t.loanApplicationForm.section2.renewal}</option>
                  </Select>
                </Field>
                <Field label={t.loanApplicationForm.section2.typeOfLoan}>
                  <Select id="requestedCategory" required value={form.requestedCategory} onChange={(e) => update('requestedCategory', e.target.value)}>
                    <option value="">{t.loanApplicationForm.section2.select}</option>
                    {LOAN_PRODUCTS.map((product) => (
                      <option key={product.category} value={product.category}>
                        {product.displayLabel}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t.loanApplicationForm.section2.desiredAmount}>
                  <NumberInput id="requestedAmount" min="0" required value={form.requestedAmount} onChange={(e) => update('requestedAmount', e.target.value)} />
                </Field>
                <Field label={t.loanApplicationForm.section2.preferredTerm}>
                  <Input id="requestedTermMonths" type="number" min={1} required value={form.requestedTermMonths} onChange={(e) => update('requestedTermMonths', e.target.value)} />
                </Field>
              </div>
              <Field label={t.loanApplicationForm.section2.loanPurpose}>
                <Textarea id="loanPurpose" rows={2} value={form.loanPurpose} onChange={(e) => update('loanPurpose', e.target.value)} />
              </Field>
            </SectionCard>

            <SectionCard number="3" title={t.loanApplicationForm.section3.title}>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={t.loanApplicationForm.section3.firstName}>
                  <Input id="firstName" required value={form.firstName} onChange={(e) => update('firstName', e.target.value.toUpperCase())} />
                </Field>
                <Field label={t.loanApplicationForm.section3.middleName}>
                  <Input id="middleName" value={form.middleName} onChange={(e) => update('middleName', e.target.value.toUpperCase())} />
                </Field>
                <Field label={t.loanApplicationForm.section3.lastName}>
                  <Input id="lastName" required value={form.lastName} onChange={(e) => update('lastName', e.target.value.toUpperCase())} />
                </Field>
                <Field label={t.loanApplicationForm.section3.gender}>
                  <Select value={form.gender} onChange={(e) => update('gender', e.target.value)}>
                    <option value="">{t.loanApplicationForm.section2.select}</option>
                    {GENDER_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t.loanApplicationForm.section3.civilStatus}>
                  <Select value={form.civilStatus} onChange={(e) => update('civilStatus', e.target.value)}>
                    <option value="">{t.loanApplicationForm.section2.select}</option>
                    {CIVIL_STATUS_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label={t.loanApplicationForm.section3.dateOfBirth}
                  hint={age !== null ? t.loanApplicationForm.section3.age.replace('{age}', String(age)) : undefined}
                >
                  <Input id="birthDate" type="date" required value={form.birthDate} onChange={(e) => update('birthDate', e.target.value)} />
                </Field>
                <Field label={t.loanApplicationForm.section3.placeOfBirth}>
                  <Input value={form.placeOfBirth} onChange={(e) => update('placeOfBirth', e.target.value)} />
                </Field>
                <Field label={t.loanApplicationForm.section3.nationality}>
                  <Input value={form.nationality} onChange={(e) => update('nationality', e.target.value)} />
                </Field>
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <Label>{t.loanApplicationForm.section3.presentAddress}</Label>
                <PortalAddressPicker value={form.presentAddress} onChange={(patch) => update('presentAddress', { ...form.presentAddress, ...patch })} />
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <Label>{t.loanApplicationForm.section3.previousAddress}</Label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={form.sameAsPresentAddress}
                      onChange={(e) => update('sameAsPresentAddress', e.target.checked)}
                    />
                    {t.loanApplicationForm.section3.sameAsPresent}
                  </label>
                </div>
                {!form.sameAsPresentAddress && (
                  <PortalAddressPicker value={form.previousAddress} onChange={(patch) => update('previousAddress', { ...form.previousAddress, ...patch })} />
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t.loanApplicationForm.section3.homeOwnership}>
                  <Select value={form.homeOwnership} onChange={(e) => update('homeOwnership', e.target.value)}>
                    <option value="">{t.loanApplicationForm.section2.select}</option>
                    {HOME_OWNERSHIP_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t.loanApplicationForm.section3.contactNumber}>
                  <PhoneInput id="mobilePhone" value={form.mobilePhone} onChange={(e) => update('mobilePhone', e.target.value)} placeholder="09XX XXX XXXX" />
                </Field>
                <Field label={t.loanApplicationForm.section3.email} className="sm:col-span-2" hint={t.loanApplicationForm.section3.emailHint}>
                  <Input id="email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
                </Field>
              </div>
            </SectionCard>

            <SectionCard number="4" title={t.loanApplicationForm.section4.title} description={t.loanApplicationForm.section4.description}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t.loanApplicationForm.section4.employer}>
                  <Input id="employer" value={form.employer} onChange={(e) => update('employer', e.target.value)} />
                </Field>
                <Field label={t.loanApplicationForm.section4.occupation}>
                  <Input id="occupation" value={form.occupation} onChange={(e) => update('occupation', e.target.value)} />
                </Field>
                <Field label={t.loanApplicationForm.section4.officeAddress} className="sm:col-span-2">
                  <Input id="officeAddress" value={form.officeAddress} onChange={(e) => update('officeAddress', e.target.value)} />
                </Field>
                <Field label={t.loanApplicationForm.section4.monthlyIncome}>
                  <NumberInput id="monthlyIncome" min="0" value={form.monthlyIncome} onChange={(e) => update('monthlyIncome', e.target.value)} placeholder="0.00" />
                </Field>
                <Field label={t.loanApplicationForm.section4.tin}>
                  <GroupedDigitsInput value={form.tinNumber} onChange={(e) => update('tinNumber', e.target.value)} />
                </Field>
                <Field label={t.loanApplicationForm.section4.sss}>
                  <GroupedDigitsInput value={form.sssNumber} onChange={(e) => update('sssNumber', e.target.value)} />
                </Field>
              </div>
            </SectionCard>

            <SectionCard number="5" title={t.loanApplicationForm.section5.title}>
              <div className="space-y-2">
                {form.dependants.map((row, i) => (
                  <div key={i} className="flex flex-wrap items-end gap-2">
                    <div className="min-w-40 flex-1 space-y-1.5">
                      <Label>{t.loanApplicationForm.section5.name}</Label>
                      <Input
                        value={row.name}
                        onChange={(e) => update('dependants', form.dependants.map((r, j) => (j === i ? { ...r, name: e.target.value.toUpperCase() } : r)))}
                      />
                    </div>
                    <div className="w-20 space-y-1.5">
                      <Label>{t.loanApplicationForm.section5.age}</Label>
                      <Input
                        type="number"
                        value={row.age}
                        onChange={(e) => update('dependants', form.dependants.map((r, j) => (j === i ? { ...r, age: e.target.value } : r)))}
                      />
                    </div>
                    <div className="w-36 space-y-1.5">
                      <Label>{t.loanApplicationForm.section5.relationship}</Label>
                      <Input
                        value={row.relationship}
                        onChange={(e) => update('dependants', form.dependants.map((r, j) => (j === i ? { ...r, relationship: e.target.value } : r)))}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={t.loanApplicationForm.section5.remove}
                      onClick={() => update('dependants', form.dependants.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => update('dependants', [...form.dependants, { name: '', age: '', relationship: '' }])}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> {t.loanApplicationForm.section5.add}
                </Button>
              </div>
            </SectionCard>

            {form.civilStatus === 'Married' && (
              <SectionCard number="6" title={t.loanApplicationForm.section6.title} description={t.loanApplicationForm.section6.description}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t.loanApplicationForm.section6.spouseName}>
                    <Input value={form.spouseName} onChange={(e) => update('spouseName', e.target.value)} />
                  </Field>
                  <Field label={t.loanApplicationForm.section6.spouseEmployer}>
                    <Input value={form.spouseEmployer} onChange={(e) => update('spouseEmployer', e.target.value)} />
                  </Field>
                </div>
              </SectionCard>
            )}

            <SectionCard number="7" title={t.loanApplicationForm.section7.title}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={form.hasCoBorrower}
                  onChange={(e) => update('hasCoBorrower', e.target.checked)}
                />
                {t.loanApplicationForm.section7.hasCoBorrower}
              </label>
              {form.hasCoBorrower && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label={t.loanApplicationForm.section7.fullName}>
                    <Input value={form.coBorrowerName} onChange={(e) => update('coBorrowerName', e.target.value.toUpperCase())} />
                  </Field>
                  <Field label={t.loanApplicationForm.section7.relationship}>
                    <Input
                      placeholder={t.loanApplicationForm.section7.relationshipPlaceholder}
                      value={form.coBorrowerRelationship}
                      onChange={(e) => update('coBorrowerRelationship', e.target.value)}
                    />
                  </Field>
                  <Field label={t.loanApplicationForm.section7.employer}>
                    <Input value={form.coBorrowerEmployer} onChange={(e) => update('coBorrowerEmployer', e.target.value)} />
                  </Field>
                  <Field label={t.loanApplicationForm.section7.contactNumber}>
                    <PhoneInput value={form.coBorrowerContactNumber} onChange={(e) => update('coBorrowerContactNumber', e.target.value)} placeholder="09XX XXX XXXX" />
                  </Field>
                  <Field label={t.loanApplicationForm.section7.email}>
                    <Input type="email" value={form.coBorrowerEmail} onChange={(e) => update('coBorrowerEmail', e.target.value)} />
                  </Field>
                  <Field label={t.loanApplicationForm.section7.address} className="sm:col-span-3">
                    <Input value={form.coBorrowerAddress} onChange={(e) => update('coBorrowerAddress', e.target.value)} />
                  </Field>
                </div>
              )}
            </SectionCard>

            <SectionCard number="8" title={t.loanApplicationForm.section8.title}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t.loanApplicationForm.section8.name1}>
                  <Input value={form.reference1Name} onChange={(e) => update('reference1Name', e.target.value.toUpperCase())} />
                </Field>
                <Field label={t.loanApplicationForm.section8.contact1}>
                  <PhoneInput value={form.reference1Mobile} onChange={(e) => update('reference1Mobile', e.target.value)} placeholder="09XX XXX XXXX" />
                </Field>
                <Field label={t.loanApplicationForm.section8.name2}>
                  <Input value={form.reference2Name} onChange={(e) => update('reference2Name', e.target.value.toUpperCase())} />
                </Field>
                <Field label={t.loanApplicationForm.section8.contact2}>
                  <PhoneInput value={form.reference2Mobile} onChange={(e) => update('reference2Mobile', e.target.value)} placeholder="09XX XXX XXXX" />
                </Field>
              </div>
            </SectionCard>

            <SectionCard number="9" title={t.loanApplicationForm.section9.title} description={t.loanApplicationForm.section9.description}>
              <Textarea rows={3} value={form.note} onChange={(e) => update('note', e.target.value)} placeholder={t.loanApplicationForm.section9.placeholder} />
            </SectionCard>

            {isEditMode && (
              <SectionCard number="10" title={t.loanApplicationForm.section10Documents.title} description={t.loanApplicationForm.section10Documents.description}>
                <div className="space-y-4">
                  {visibleDocumentSlots.map((slot) => (
                    <DocumentSlotRow
                      key={slot.category}
                      category={slot.category}
                      status={uploadState[slot.category]}
                      onCapture={() => openCamera((file) => handleUpload(slot.category, file))}
                      onFileSelected={(file) => handleUpload(slot.category, file)}
                    />
                  ))}
                </div>
              </SectionCard>
            )}

            {!isEditMode && (
              <SectionCard number="10" title={t.loanApplicationForm.section10Terms.title}>
                <label className="flex items-start gap-3 rounded-lg border border-border p-4 text-sm">
                  <input
                    type="checkbox"
                    required
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-input"
                    checked={form.agreedToTerms}
                    onChange={(e) => update('agreedToTerms', e.target.checked)}
                  />
                  <span>
                    {t.loanApplicationForm.section10Terms.consentPrefix}{' '}
                    <button
                      type="button"
                      onClick={() => setShowTerms(true)}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {t.loanApplicationForm.section10Terms.termsLink}
                    </button>{' '}
                    {t.loanApplicationForm.section10Terms.and}{' '}
                    <button
                      type="button"
                      onClick={() => setShowPrivacy(true)}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {t.loanApplicationForm.section10Terms.privacyLink}
                    </button>
                    {t.loanApplicationForm.section10Terms.consentSuffix}
                  </span>
                </label>
              </SectionCard>
            )}

            {!isEditMode && <p className="text-center text-xs text-muted-foreground">{t.loanApplicationForm.geolocationNote}</p>}

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting
                ? isEditMode
                  ? t.loanApplicationForm.saving
                  : t.loanApplicationForm.submitting
                : isEditMode
                  ? t.loanApplicationForm.save
                  : t.loanApplicationForm.submit}
            </Button>
          </form>
        </Card>

        {/* Terms/Privacy dialog titles and content deliberately stay English - see
            translations.ts's own doc comment: legally-binding consent text, not translated without
            professional/legal review. */}
        <Dialog open={showTerms} onClose={() => setShowTerms(false)} title="Terms and Conditions">
          <TermsContent />
        </Dialog>
        <Dialog open={showPrivacy} onClose={() => setShowPrivacy(false)} title="Data Privacy Statement and Consent Form">
          <PrivacyContent />
        </Dialog>
        <Dialog open={cameraOpen} onClose={closeCamera} title="Take a photo of the document">
          {cameraError ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{cameraError}</p>
          ) : (
            <div className="relative overflow-hidden rounded-md bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} autoPlay playsInline muted className="aspect-[4/3] w-full object-cover" />
              <div className="pointer-events-none absolute inset-4 rounded-md border-2 border-dashed border-white/70" />
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeCamera}>
              Cancel
            </Button>
            <Button type="button" onClick={capturePhoto} disabled={!!cameraError}>
              <Camera className="mr-2 h-4 w-4" /> Capture
            </Button>
          </div>
        </Dialog>
      </>
    </PageShell>
  );
}
