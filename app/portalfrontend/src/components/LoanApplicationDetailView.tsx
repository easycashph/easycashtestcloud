import type { PortalLoanApplicationDetail } from '@/lib/portalApiTypes';
import { getLoanProductDisplayLabel } from '@/lib/loanProducts';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function formatAddress(detail: {
  houseUnitNumber?: string | null;
  street?: string | null;
  barangay?: string | null;
  cityMunicipality?: string | null;
  province?: string | null;
  zipCode?: string | null;
}) {
  return [detail.houseUnitNumber, detail.street, detail.barangay, detail.cityMunicipality, detail.province, detail.zipCode]
    .filter(Boolean)
    .join(', ');
}

export function LoanApplicationDetailView({ detail }: { detail: PortalLoanApplicationDetail }) {
  const address = formatAddress(detail) || detail.address;
  const previousAddress = detail.previousAddressSameAsPresent
    ? 'Same as present address'
    : formatAddress({
        houseUnitNumber: detail.previousHouseUnitNumber,
        street: detail.previousStreet,
        barangay: detail.previousBarangay,
        cityMunicipality: detail.previousCityMunicipality,
        province: detail.previousProvince,
        zipCode: detail.previousZipCode,
      }) || detail.previousAddress;

  return (
    <div className="space-y-5">
      <Section title="Loan Details">
        <Field label="Category" value={getLoanProductDisplayLabel(detail.requestedCategory)} />
        <Field label="Requested Amount" value={`₱${detail.requestedAmount.toLocaleString()}`} />
        <Field label="Term" value={`${detail.requestedTermMonths} months`} />
        <Field label="Account Type" value={detail.accountType} />
        <Field label="Loan Purpose" value={detail.loanPurpose} />
        <Field label="Referral Source" value={detail.referralSource} />
      </Section>

      <Section title="Personal Information">
        <Field label="Full Name" value={detail.applicantName} />
        <Field label="Age" value={detail.age} />
        <Field label="Gender" value={detail.gender} />
        <Field label="Civil Status" value={detail.civilStatus} />
        <Field label="Birth Date" value={detail.birthDate} />
        <Field label="Place of Birth" value={detail.placeOfBirth} />
        <Field label="Nationality" value={detail.nationality} />
        <Field label="Home Ownership" value={detail.homeOwnership} />
        <Field label="Mobile Phone" value={detail.mobilePhone} />
        <Field label="Email" value={detail.email} />
      </Section>

      <Section title="Address">
        <Field label="Present Address" value={address} />
        <Field label="Previous Address" value={previousAddress} />
      </Section>

      <Section title="Employment">
        <Field label="Monthly Income" value={detail.monthlyIncome != null ? `₱${detail.monthlyIncome.toLocaleString()}` : null} />
        <Field label="Employer" value={detail.employer} />
        <Field label="Occupation" value={detail.occupation} />
        <Field label="Office Address" value={detail.officeAddress} />
        <Field label="TIN Number" value={detail.tinNumber} />
        <Field label="SSS Number" value={detail.sssNumber} />
      </Section>

      {(detail.coBorrowerName || detail.coBorrowerEmployer || detail.coBorrowerContactNumber || detail.coBorrowerEmail || detail.coBorrowerAddress) && (
        <Section title="Co-Borrower">
          <Field label="Name" value={detail.coBorrowerName} />
          <Field label="Employer" value={detail.coBorrowerEmployer} />
          <Field label="Contact Number" value={detail.coBorrowerContactNumber} />
          <Field label="Email" value={detail.coBorrowerEmail} />
          <Field label="Address" value={detail.coBorrowerAddress} />
        </Section>
      )}

      {detail.dependants && detail.dependants.length > 0 && (
        <Section title="Dependants">
          {detail.dependants.map((dependant, index) => (
            <Field
              key={index}
              label={`Dependant ${index + 1}`}
              value={[dependant.name, dependant.age, dependant.relationship].filter(Boolean).join(' · ')}
            />
          ))}
        </Section>
      )}

      <Section title="References">
        <Field label="Reference 1" value={[detail.reference1Name, detail.reference1Mobile].filter(Boolean).join(' · ')} />
        <Field label="Reference 2" value={[detail.reference2Name, detail.reference2Mobile].filter(Boolean).join(' · ')} />
      </Section>

      {detail.note && (
        <Section title="Notes">
          <div className="sm:col-span-2">
            <p className="text-sm">{detail.note}</p>
          </div>
        </Section>
      )}
    </div>
  );
}
