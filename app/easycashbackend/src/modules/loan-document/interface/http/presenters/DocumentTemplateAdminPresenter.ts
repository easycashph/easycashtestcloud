import type { DocumentTemplateAdminResult } from '../../../application/use-cases/ListDocumentTemplatesForAdminUseCase';
import type { DocumentTemplate } from '../../../domain/DocumentTemplate';

function presentDocumentTemplate(template: DocumentTemplate) {
  return {
    id: template.id,
    code: template.code,
    name: template.name,
    isRequired: template.isRequired,
    sortIndex: template.sortIndex,
    requiresBorrowerSignature: template.requiresBorrowerSignature,
    requiresCoBorrowerSignature: template.requiresCoBorrowerSignature,
  };
}

export function presentDocumentTemplateAdminResult(result: DocumentTemplateAdminResult) {
  return {
    templates: result.templates.map(presentDocumentTemplate),
    loanProducts: result.loanProducts,
    mappings: result.mappings,
  };
}
