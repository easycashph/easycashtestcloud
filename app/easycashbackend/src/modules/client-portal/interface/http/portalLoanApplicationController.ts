import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from '@shared/errors/DomainError';
import type { LoanApplication } from '@modules/loan-application/domain/LoanApplication';
import type { SubmitLoanApplicationUseCase } from '../../application/use-cases/SubmitLoanApplicationUseCase';
import type { ListPortalLoanApplicationsUseCase } from '../../application/use-cases/ListPortalLoanApplicationsUseCase';
import type { GetPortalLoanApplicationUseCase } from '../../application/use-cases/GetPortalLoanApplicationUseCase';
import type { UpdatePortalLoanApplicationUseCase } from '../../application/use-cases/UpdatePortalLoanApplicationUseCase';
import type { ListPortalBranchesUseCase } from '../../application/use-cases/ListPortalBranchesUseCase';
import type { UploadPortalLoanApplicationDocumentUseCase } from '../../application/use-cases/UploadPortalLoanApplicationDocumentUseCase';
import type { ListPortalLoanApplicationDocumentsUseCase } from '../../application/use-cases/ListPortalLoanApplicationDocumentsUseCase';
import type { DownloadPortalLoanApplicationDocumentUseCase } from '../../application/use-cases/DownloadPortalLoanApplicationDocumentUseCase';
import type { GetPortalLoanApplicationStatusTimelineUseCase } from '../../application/use-cases/GetPortalLoanApplicationStatusTimelineUseCase';
import type { SearchLicensedRecruitmentAgenciesUseCase } from '@modules/licensed-recruitment-agency/application/use-cases/SearchLicensedRecruitmentAgenciesUseCase';
import { presentLicensedRecruitmentAgency } from '@modules/licensed-recruitment-agency/interface/http/presenters/LicensedRecruitmentAgencyPresenter';
import { getCurrentPortalAccount } from './requirePortalAuth';
import type {
  SubmitLoanApplicationRequestBody,
  UpdateLoanApplicationRequestBody,
  UploadPortalLoanApplicationDocumentRequestBody,
} from './portalLoanApplicationSchemas';
import { uploadPortalLoanApplicationDocumentSchema } from './portalLoanApplicationSchemas';

export interface PortalLoanApplicationControllerDeps {
  submitLoanApplicationUseCase: SubmitLoanApplicationUseCase;
  listPortalLoanApplicationsUseCase: ListPortalLoanApplicationsUseCase;
  getPortalLoanApplicationUseCase: GetPortalLoanApplicationUseCase;
  updatePortalLoanApplicationUseCase: UpdatePortalLoanApplicationUseCase;
  listPortalBranchesUseCase: ListPortalBranchesUseCase;
  uploadPortalLoanApplicationDocumentUseCase: UploadPortalLoanApplicationDocumentUseCase;
  listPortalLoanApplicationDocumentsUseCase: ListPortalLoanApplicationDocumentsUseCase;
  downloadPortalLoanApplicationDocumentUseCase: DownloadPortalLoanApplicationDocumentUseCase;
  getPortalLoanApplicationStatusTimelineUseCase: GetPortalLoanApplicationStatusTimelineUseCase;
  /** 2026-09-15 (user request): backs the Seafarer Loan Agency name field's dropdown - same
   * DMW-licensed-agency search the LMS staff side uses (AgencyNameCombobox), just reachable under
   * portal auth instead of staff auth. Read-only, no portal-specific business logic, so reusing
   * the identical use case instance app.ts already built for the staff route is safe. */
  searchLicensedRecruitmentAgenciesUseCase: SearchLicensedRecruitmentAgenciesUseCase;
}

/** The full self-service-editable shape - same field set updateSelfServiceIntake() accepts, plus
 * id/status/createdAt/updatedAt for display. Shared by `get` (prefill) and `submit` responses so
 * the portal frontend can reuse one type for both. */
function presentFullApplication(application: LoanApplication) {
  const p = application.toProps();
  return {
    id: p.id,
    branchId: p.branchId,
    status: p.status,
    applicantName: p.applicantName,
    age: p.age,
    gender: p.gender,
    civilStatus: p.civilStatus,
    birthDate: p.birthDate,
    placeOfBirth: p.placeOfBirth,
    nationality: p.nationality,
    homeOwnership: p.homeOwnership,
    address: p.address,
    houseUnitNumber: p.houseUnitNumber,
    street: p.street,
    barangay: p.barangay,
    cityMunicipality: p.cityMunicipality,
    province: p.province,
    zipCode: p.zipCode,
    previousAddressSameAsPresent: p.previousAddressSameAsPresent,
    previousAddress: p.previousAddress,
    previousHouseUnitNumber: p.previousHouseUnitNumber,
    previousStreet: p.previousStreet,
    previousBarangay: p.previousBarangay,
    previousCityMunicipality: p.previousCityMunicipality,
    previousProvince: p.previousProvince,
    previousZipCode: p.previousZipCode,
    monthlyIncome: p.monthlyIncome,
    employer: p.employer,
    occupation: p.occupation,
    officeAddress: p.officeAddress,
    tinNumber: p.tinNumber,
    sssNumber: p.sssNumber,
    coBorrowerName: p.coBorrowerName,
    coBorrowerEmployer: p.coBorrowerEmployer,
    coBorrowerContactNumber: p.coBorrowerContactNumber,
    coBorrowerEmail: p.coBorrowerEmail,
    coBorrowerAddress: p.coBorrowerAddress,
    mobilePhone: p.mobilePhone,
    email: p.email,
    dependants: p.dependants,
    reference1Name: p.reference1Name,
    reference1Mobile: p.reference1Mobile,
    reference2Name: p.reference2Name,
    reference2Mobile: p.reference2Mobile,
    note: p.note,
    referralSource: p.referralSource,
    accountType: p.accountType,
    loanPurpose: p.loanPurpose,
    requestedCategory: p.requestedCategory,
    requestedAmount: p.requestedAmount,
    requestedTermMonths: p.requestedTermMonths,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    locationVerification: presentLocationVerification(p),
  };
}

/** 2026-09-14 (user request: "Geotagging / Location Verification feature" - "Do not expose
 * latitude/longitude publicly" / "Do NOT display the user's exact coordinates prominently in the
 * client UI") - deliberately excludes `submissionLatitude`/`submissionLongitude` from every portal
 * response; only the internal LMS's own presenter (LoanApplicationPresenter.ts, an
 * authorized-staff-only surface) returns the raw coordinates. `captured` is derived from
 * `permissionStatus` rather than stored as its own column - "GRANTED" already means "captured",
 * so a separate boolean would just be a second source of truth that could drift from it. */
function presentLocationVerification(p: ReturnType<LoanApplication['toProps']>) {
  return {
    captured: p.submissionLocationPermissionStatus === 'GRANTED',
    accuracyMeters: p.submissionLocationAccuracyMeters ?? null,
    capturedAt: p.submissionLocationCapturedAt ?? null,
    permissionStatus: p.submissionLocationPermissionStatus ?? null,
  };
}

/** Thin controller only — no business logic here (CLAUDE.md §Architecture), matching every other module's controller shape. */
export class PortalLoanApplicationController {
  constructor(private readonly deps: PortalLoanApplicationControllerDeps) {}

  submit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const body = req.body as SubmitLoanApplicationRequestBody;
      const application = await this.deps.submitLoanApplicationUseCase.execute(account.sub, body);
      const props = application.toProps();
      res.status(201).json({
        id: props.id,
        branchId: props.branchId,
        status: props.status,
        requestedCategory: props.requestedCategory,
        requestedAmount: props.requestedAmount,
        requestedTermMonths: props.requestedTermMonths,
        createdAt: props.createdAt,
        locationVerification: presentLocationVerification(props),
      });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const applications = await this.deps.listPortalLoanApplicationsUseCase.execute(account.sub);
      res.status(200).json(applications);
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const application = await this.deps.getPortalLoanApplicationUseCase.execute(account.sub, req.params.id as string);
      res.status(200).json(presentFullApplication(application));
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const body = req.body as UpdateLoanApplicationRequestBody;
      const application = await this.deps.updatePortalLoanApplicationUseCase.execute(account.sub, req.params.id as string, body);
      res.status(200).json(presentFullApplication(application));
    } catch (error) {
      next(error);
    }
  };

  listBranches = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const branches = await this.deps.listPortalBranchesUseCase.execute();
      res.status(200).json(branches);
    } catch (error) {
      next(error);
    }
  };

  /** 2026-09-15 (user request): backs the Seafarer Loan Agency name field's searchable dropdown
   * on the portal's own loan application form - same DMW-licensed-agency directory the LMS staff
   * side searches, just under portal auth. */
  searchAgencies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const entries = await this.deps.searchLicensedRecruitmentAgenciesUseCase.execute(q);
      res.status(200).json({ items: entries.map(presentLicensedRecruitmentAgency) });
    } catch (error) {
      next(error);
    }
  };

  uploadDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        throw new ValidationError('No file was uploaded (expected multipart field "file").');
      }
      const account = getCurrentPortalAccount(req);
      const body = uploadPortalLoanApplicationDocumentSchema.parse(req.body) as UploadPortalLoanApplicationDocumentRequestBody;
      const attachment = await this.deps.uploadPortalLoanApplicationDocumentUseCase.execute({
        portalAccountId: account.sub,
        loanApplicationId: req.params.id as string,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        data: req.file.buffer,
        documentCategory: body.documentCategory ?? null,
      });
      res.status(201).json({ id: attachment.id, fileName: attachment.fileName, documentCategory: attachment.documentCategory });
    } catch (error) {
      next(error);
    }
  };

  listDocuments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const attachments = await this.deps.listPortalLoanApplicationDocumentsUseCase.execute(account.sub, req.params.id as string);
      res.status(200).json(attachments.map((a) => ({ id: a.id, fileName: a.fileName, documentCategory: a.documentCategory })));
    } catch (error) {
      next(error);
    }
  };

  getStatusTimeline = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const timeline = await this.deps.getPortalLoanApplicationStatusTimelineUseCase.execute(account.sub, req.params.id as string);
      res.status(200).json(timeline);
    } catch (error) {
      next(error);
    }
  };

  downloadDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const { record, data } = await this.deps.downloadPortalLoanApplicationDocumentUseCase.execute(
        account.sub,
        req.params.id as string,
        req.params.documentId as string,
      );
      res.setHeader('Content-Type', record.fileType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(record.fileName)}"`);
      res.status(200).send(data);
    } catch (error) {
      next(error);
    }
  };
}
