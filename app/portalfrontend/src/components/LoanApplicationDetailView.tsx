import type { PortalLoanApplicationDetail } from '@/lib/portalApiTypes';
import { getLoanProductDisplayLabel } from '@/lib/loanProducts';
import { useLanguage } from '@/lib/i18n/LanguageContext';

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
  const { t } = useLanguage();
  const address = formatAddress(detail) || detail.address;
  const previousAddress = detail.previousAddressSameAsPresent
    ? t.loanApplicationDetail.sameAsPresent
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
      <Section title={t.loanApplicationDetail.loanDetails}>
        <Field label={t.loanApplicationDetail.category} value={getLoanProductDisplayLabel(detail.requestedCategory)} />
        <Field label={t.loanApplicationDetail.requestedAmount} value={`₱${detail.requestedAmount.toLocaleString()}`} />
        <Field label={t.loanApplicationDetail.term} value={`${detail.requestedTermMonths} ${t.loanApplicationDetail.months}`} />
        <Field label={t.loanApplicationDetail.accountType} value={detail.accountType} />
        <Field label={t.loanApplicationDetail.loanPurpose} value={detail.loanPurpose} />
        <Field label={t.loanApplicationDetail.referralSource} value={detail.referralSource} />
      </Section>

      <Section title={t.loanApplicationDetail.personalInfo}>
        <Field label={t.loanApplicationDetail.fullName} value={detail.applicantName} />
        <Field label={t.loanApplicationDetail.age} value={detail.age} />
        <Field label={t.loanApplicationDetail.gender} value={detail.gender} />
        <Field label={t.loanApplicationDetail.civilStatus} value={detail.civilStatus} />
        <Field label={t.loanApplicationDetail.birthDate} value={detail.birthDate} />
        <Field label={t.loanApplicationDetail.placeOfBirth} value={detail.placeOfBirth} />
        <Field label={t.loanApplicationDetail.nationality} value={detail.nationality} />
        <Field label={t.loanApplicationDetail.homeOwnership} value={detail.homeOwnership} />
        <Field label={t.loanApplicationDetail.mobilePhone} value={detail.mobilePhone} />
        <Field label={t.loanApplicationDetail.email} value={detail.email} />
      </Section>

      <Section title={t.loanApplicationDetail.address}>
        <Field label={t.loanApplicationDetail.presentAddress} value={address} />
        <Field label={t.loanApplicationDetail.previousAddress} value={previousAddress} />
      </Section>

      <Section title={t.loanApplicationDetail.employment}>
        <Field
          label={t.loanApplicationDetail.monthlyIncome}
          value={detail.monthlyIncome != null ? `₱${detail.monthlyIncome.toLocaleString()}` : null}
        />
        <Field label={t.loanApplicationDetail.employer} value={detail.employer} />
        <Field label={t.loanApplicationDetail.occupation} value={detail.occupation} />
        <Field label={t.loanApplicationDetail.officeAddress} value={detail.officeAddress} />
        <Field label={t.loanApplicationDetail.tin} value={detail.tinNumber} />
        <Field label={t.loanApplicationDetail.sss} value={detail.sssNumber} />
      </Section>

      {(detail.coBorrowerName || detail.coBorrowerEmployer || detail.coBorrowerContactNumber || detail.coBorrowerEmail || detail.coBorrowerAddress) && (
        <Section title={t.loanApplicationDetail.coBorrower}>
          <Field label={t.loanApplicationDetail.coBorrowerName} value={detail.coBorrowerName} />
          <Field label={t.loanApplicationDetail.employer} value={detail.coBorrowerEmployer} />
          <Field label={t.loanApplicationDetail.contactNumber} value={detail.coBorrowerContactNumber} />
          <Field label={t.loanApplicationDetail.email} value={detail.coBorrowerEmail} />
          <Field label={t.loanApplicationDetail.address} value={detail.coBorrowerAddress} />
        </Section>
      )}

      {detail.dependants && detail.dependants.length > 0 && (
        <Section title={t.loanApplicationDetail.dependants}>
          {detail.dependants.map((dependant, index) => (
            <Field
              key={index}
              label={t.loanApplicationDetail.dependant.replace('{n}', String(index + 1))}
              value={[dependant.name, dependant.age, dependant.relationship].filter(Boolean).join(' · ')}
            />
          ))}
        </Section>
      )}

      <Section title={t.loanApplicationDetail.references}>
        <Field
          label={t.loanApplicationDetail.reference.replace('{n}', '1')}
          value={[detail.reference1Name, detail.reference1Mobile].filter(Boolean).join(' · ')}
        />
        <Field
          label={t.loanApplicationDetail.reference.replace('{n}', '2')}
          value={[detail.reference2Name, detail.reference2Mobile].filter(Boolean).join(' · ')}
        />
      </Section>

      {detail.note && (
        <Section title={t.loanApplicationDetail.notes}>
          <div className="sm:col-span-2">
            <p className="text-sm">{detail.note}</p>
          </div>
        </Section>
      )}
    </div>
  );
}
