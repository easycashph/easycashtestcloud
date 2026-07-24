import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from '@shared/errors/DomainError';
import type { LoanApplication } from '@modules/loan-application/domain/LoanApplication';
import type { SubmitLoanApplicationUseCase } from '../../application/use-cases/SubmitLoanApplicationUseCase';
import type { ListPortalLoanApplicationsUseCase } from '../../application/use-cases/ListPortalLoanApplicationsUseCase';
import type { GetPortalLoanApplicationUseCase } from '../../application/use-cases/GetPortalLoanApplicationUseCase';
import type { UpdatePortalLoanApplicationUseCase } from '../../application/use-cases/UpdatePortalLoanApplicationUseCase';
import type { ListPortalBranchesUseCase } from '../../application/use-cases/ListPortalBranchesUseCase';
import type { UploadPortalLoanApplicationDocumentUseCase } from '../../application/use-cases/UploadPortalLoanApplicationDocumentUseCase';
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
}
