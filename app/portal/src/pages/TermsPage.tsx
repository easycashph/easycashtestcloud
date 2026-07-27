import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const CLAUSES = [
  {
    title: 'Client Information',
    lead: 'All information that you will share to Easycash is correct and up-to-date.',
    body: 'I declare and certify that all data and information stated in this application and the supportive documents are true, accurate and complete and are made for the purpose of obtaining loan/credit.',
  },
  {
    title: 'Data Collection',
    lead: 'Necessary information will be gathered to process your loan application.',
    body: 'I authorize Easycash Lending Company Inc. to obtain and or verify all information that are required to support this application and that the institutions/persons from which Easycash Lending Company Inc. may perform such acts are authorized to provide any information relative to this application for the purpose of establishing my credit worthiness.',
  },
  {
    title: 'Bank Data and Credit Reports Gathering',
    lead: 'Your bank data and credit information will be obtained from CIC for the purpose of establishing your creditworthiness.',
    body: 'I understand and I am fully informed that Easycash Lending Company Inc. will process all the information that I will disclose in my loan application and share the same information to CIC pursuant to Republic Act (R.A.) Number 9510 and its Implementing Rules and Regulations (IRR), creating the Credit Information Corporation (CIC). Easycash is mandated to submit my data, as well as any regular updates or corrections thereof, to the CIC for consolidation and disclosure as may be authorized by the CIC.',
  },
  {
    title: 'Sharing your Information with Banks and other Financial Institutions',
    lead: 'Easycash will share your information to credit bureaus, banks, financial institutions and other related entities.',
    body: 'I understand that my basic credit data may be shared with other lenders, financial and banking among other institutions authorized by the CIC, and other duly accredited credit reporting agencies in accordance with Republic Act (R.A.) Number 9510 and its Implementing Rules and Regulations (IRR), creating the Credit Information Corporation (CIC). I therefore authorize Easycash Lending Company Inc. to disclose and share all data and information I disclosed and indicated in my loan application together with particulars of my data and account(s) with Credit Information Corporation (CIC), accredited credit bureaus, banks, financial institutions and other related entities.',
  },
  {
    title: 'Loan Processing',
    lead: 'Easycash will regularly review your information.',
    body: 'I allow Easycash Lending Company Inc. to conduct reviews that may entail any above stated acts to determine if my existing loan/credit should be increased, decreased or remain unchanged or for the purpose of collecting my updated information.',
  },
  {
    title: 'Loan Decision',
    lead: 'Easycash has the right to approve or decline your application at its absolute discretion.',
    body: 'I understand that Easycash Lending Company Inc. has the right to approve or decline my application at its absolute discretion without stating any reasons.',
  },
  {
    title: 'Loan Application and Support Documents',
    lead: 'Any documents obtained will not be returned to you whatever the application result may be.',
    body: 'I understand that Easycash Lending Company Inc. has full discretion of not returning my application and supportive documents whether my loan is approved or declined.',
  },
  {
    title: 'Notifications and Announcements',
    lead: 'You will receive notifications about your loans and announcements through email, SMS, calls, and/or any electronic means.',
    body: 'I authorize Easycash Lending Company Inc. to send me messages, notices and announcements that Easycash Lending Company Inc. may deem proper including but not limited to information regarding the status of my loan application or for the purposes of collection, marketing, and product introduction through direct contact and or access through any electronic means including but not limited to use of telephone calls, emails, fax, multimedia or short message service, pre-recorded voice/video messages. I also agree to hold Easycash Lending Company Inc. not liable to any loss, injury or damage that I may suffer in relation to any message, notice, announcement sent by Easycash Lending Company Inc. to me in the format stated herein.',
  },
  {
    title: 'Approved Loan Proceeds',
    lead: 'Approved loan proceeds will only be used to the purpose stated.',
    body: 'I further certify that the proceeds of the loan/credit, if this application is approved, will be used solely for the purpose I indicated herewith.',
  },
];

export function TermsContent() {
  return (
    <div className="space-y-6">
      {CLAUSES.map((clause) => (
        <div key={clause.title} className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">{clause.title}</h2>
          <p className="mt-1 text-sm font-medium text-muted-foreground">{clause.lead}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{clause.body}</p>
        </div>
      ))}
    </div>
  );
}

export function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl py-10">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">Terms and Conditions</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Please make sure you review, understand, and agree with the following terms and conditions.
        </p>

        <div className="mt-8">
          <TermsContent />
        </div>
      </div>
    </div>
  );
}
