import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient, ApiError } from '@/lib/apiClient';
import type {
  LoanProduct,
  FeeCalculationMethod,
  FeeTriggerEvent,
  FeeApplicationType,
  PenaltyCalculationMethod,
} from '@/lib/loanApiTypes';

/**
 * 2026-08-09 (Loan Products admin config, user request): "paano mag dagdag ng product at mag
 * edit dito?" — the backend has had working `POST /loan-products`/`POST
 * /loan-products/:id/versions`/`POST /loan-products/:id/versions/:versionId/activate` endpoints
 * all along; this file is the first UI that calls them. There is deliberately no "edit" form here
 * - a `LoanProductVersion` is immutable once created (LPV-1/LPV-2/LPV-3: editing a product must
 * never affect historical loans that already reference its exact rules) - "editing" a product
 * means creating a brand-new version with the new values, then explicitly activating it.
 */

export function AddLoanProductDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const reset = () => {
    setCode('');
    setName('');
    setDescription('');
    setError(null);
  };

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.post<LoanProduct>('/loan-products', {
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan-products', 'all'] });
      reset();
      onOpenChange(false);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not create this Loan Product.'),
  });

  const handleOpenChange = (next: boolean) => {
    if (mutation.isPending) return;
    if (!next) reset();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Loan Product</DialogTitle>
          <DialogDescription>
            Creates the product itself only — no interest rate, fees, or amount range yet. Add a Version next to configure those.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="new-product-code">Code</Label>
            <Input id="new-product-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. SML-NEW" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-product-name">Name</Label>
            <Input id="new-product-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SML-New Product" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-product-description">Description (optional)</Label>
            <Textarea id="new-product-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={!code.trim() || !name.trim() || mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface FeeRuleDraft {
  key: string;
  name: string;
  calculationMethod: FeeCalculationMethod;
  triggerEvent: FeeTriggerEvent;
  applicationType: FeeApplicationType;
  flatAmount: string;
  percentage: string;
}

function newFeeRuleDraft(): FeeRuleDraft {
  return {
    key: crypto.randomUUID(),
    name: '',
    calculationMethod: 'FLAT',
    triggerEvent: 'DISBURSEMENT',
    applicationType: 'REQUIRED',
    flatAmount: '',
    percentage: '',
  };
}

export function AddLoanProductVersionDialog({
  open,
  onOpenChange,
  loanProductId,
  loanProductName,
  nextVersionNumber,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanProductId: string;
  loanProductName: string;
  nextVersionNumber: number;
}) {
  const queryClient = useQueryClient();
  const [versionNumber, setVersionNumber] = React.useState(nextVersionNumber);
  const [effectiveFrom, setEffectiveFrom] = React.useState('');
  const [effectiveTo, setEffectiveTo] = React.useState('');
  const [interestCalculationMethod, setInterestCalculationMethod] = React.useState<
    'FLAT' | 'DECLINING_BALANCE' | 'DECLINING_BALANCE_DISCOUNTED'
  >('DECLINING_BALANCE');
  const [defaultInterestRate, setDefaultInterestRate] = React.useState('');
  const [minInterestRate, setMinInterestRate] = React.useState('');
  const [maxInterestRate, setMaxInterestRate] = React.useState('');
  const [loanAmountMin, setLoanAmountMin] = React.useState('');
  const [loanAmountMax, setLoanAmountMax] = React.useState('');
  const [loanAmountDefault, setLoanAmountDefault] = React.useState('');
  const [installmentCountMin, setInstallmentCountMin] = React.useState('');
  const [installmentCountMax, setInstallmentCountMax] = React.useState('');
  const [installmentCountDefault, setInstallmentCountDefault] = React.useState('');
  const [gracePeriodDefaultDays, setGracePeriodDefaultDays] = React.useState('0');
  const [roundingMethod, setRoundingMethod] = React.useState<'NO_ROUNDING' | 'ROUND_REMAINDER_INTO_LAST_REPAYMENT'>('NO_ROUNDING');
  const [configurePenalty, setConfigurePenalty] = React.useState(false);
  const [penaltyCalculationMethod, setPenaltyCalculationMethod] = React.useState<PenaltyCalculationMethod>('OVERDUE_BALANCE_AND_INTEREST');
  const [penaltyRatePercent, setPenaltyRatePercent] = React.useState('');
  const [penaltyCapPercent, setPenaltyCapPercent] = React.useState('');
  const [penaltyGracePeriodDays, setPenaltyGracePeriodDays] = React.useState('0');
  const [feeRules, setFeeRules] = React.useState<FeeRuleDraft[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) setVersionNumber(nextVersionNumber);
  }, [open, nextVersionNumber]);

  const reset = () => {
    setEffectiveFrom('');
    setEffectiveTo('');
    setInterestCalculationMethod('DECLINING_BALANCE');
    setDefaultInterestRate('');
    setMinInterestRate('');
    setMaxInterestRate('');
    setLoanAmountMin('');
    setLoanAmountMax('');
    setLoanAmountDefault('');
    setInstallmentCountMin('');
    setInstallmentCountMax('');
    setInstallmentCountDefault('');
    setGracePeriodDefaultDays('0');
    setRoundingMethod('NO_ROUNDING');
    setConfigurePenalty(false);
    setPenaltyCalculationMethod('OVERDUE_BALANCE_AND_INTEREST');
    setPenaltyRatePercent('');
    setPenaltyCapPercent('');
    setPenaltyGracePeriodDays('0');
    setFeeRules([]);
    setError(null);
  };

  const addFeeRule = () => setFeeRules((prev) => [...prev, newFeeRuleDraft()]);
  const removeFeeRule = (key: string) => setFeeRules((prev) => prev.filter((f) => f.key !== key));
  const updateFeeRule = (key: string, patch: Partial<FeeRuleDraft>) =>
    setFeeRules((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.post<LoanProduct>(`/loan-products/${loanProductId}/versions`, {
        versionNumber,
        effectiveFrom,
        effectiveTo: effectiveTo || undefined,
        interestCalculationMethod,
        loanAmountMin,
        loanAmountMax: loanAmountMax || undefined,
        loanAmountDefault: loanAmountDefault || undefined,
        installmentCountMin: Number(installmentCountMin),
        installmentCountMax: installmentCountMax ? Number(installmentCountMax) : undefined,
        installmentCountDefault: installmentCountDefault ? Number(installmentCountDefault) : undefined,
        gracePeriodDefaultDays: gracePeriodDefaultDays ? Number(gracePeriodDefaultDays) : undefined,
        roundingMethod,
        defaultInterestRate: defaultInterestRate || undefined,
        minInterestRate: minInterestRate || undefined,
        maxInterestRate: maxInterestRate || undefined,
        penaltyRule: configurePenalty
          ? {
              calculationMethod: penaltyCalculationMethod,
              ratePercent: penaltyRatePercent || undefined,
              capPercent: penaltyCapPercent || undefined,
              gracePeriodDays: penaltyGracePeriodDays ? Number(penaltyGracePeriodDays) : undefined,
            }
          : undefined,
        feeRules:
          feeRules.length > 0
            ? feeRules.map((f) => ({
                name: f.name.trim(),
                calculationMethod: f.calculationMethod,
                triggerEvent: f.triggerEvent,
                applicationType: f.applicationType,
                flatAmount: f.calculationMethod === 'FLAT' ? f.flatAmount || undefined : undefined,
                percentage: f.calculationMethod === 'PERCENTAGE_OF_LOAN_AMOUNT' ? f.percentage || undefined : undefined,
              }))
            : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan-products', 'all'] });
      reset();
      onOpenChange(false);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not create this Version.'),
  });

  const canSubmit =
    !!effectiveFrom &&
    !!loanAmountMin &&
    !!installmentCountMin &&
    feeRules.every((f) => f.name.trim() && (f.calculationMethod === 'FLAT' ? f.flatAmount : f.percentage));

  const handleOpenChange = (next: boolean) => {
    if (mutation.isPending) return;
    if (!next) reset();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Version — {loanProductName}</DialogTitle>
          <DialogDescription>
            A new, inactive version. It won't take effect until you activate it — the current active version keeps applying to new
            loans until then. Once created, this version can never be edited.
          </DialogDescription>
        </DialogHeader>
        <form
          className="max-h-[65vh] space-y-5 overflow-y-auto pr-1"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="version-number">Version #</Label>
              <Input id="version-number" type="number" min={1} value={versionNumber} onChange={(e) => setVersionNumber(Number(e.target.value))} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="effective-from">Effective From</Label>
              <Input id="effective-from" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="effective-to">Effective To (optional)</Label>
              <Input id="effective-to" type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Interest</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Calculation Method</Label>
                <Select value={interestCalculationMethod} onValueChange={(v) => setInterestCalculationMethod(v as typeof interestCalculationMethod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DECLINING_BALANCE">Declining Balance</SelectItem>
                    <SelectItem value="DECLINING_BALANCE_DISCOUNTED">Declining Balance Discounted</SelectItem>
                    <SelectItem value="FLAT">Flat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="default-rate">Default Rate %</Label>
                <Input id="default-rate" value={defaultInterestRate} onChange={(e) => setDefaultInterestRate(e.target.value)} placeholder="3.50" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="min-rate">Min Rate %</Label>
                <Input id="min-rate" value={minInterestRate} onChange={(e) => setMinInterestRate(e.target.value)} placeholder="3.00" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max-rate">Max Rate %</Label>
                <Input id="max-rate" value={maxInterestRate} onChange={(e) => setMaxInterestRate(e.target.value)} placeholder="5.00" />
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Loan Amount</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="amount-min">Minimum</Label>
                <Input id="amount-min" value={loanAmountMin} onChange={(e) => setLoanAmountMin(e.target.value)} placeholder="5000.00" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amount-max">Maximum (optional)</Label>
                <Input id="amount-max" value={loanAmountMax} onChange={(e) => setLoanAmountMax(e.target.value)} placeholder="50000.00" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amount-default">Default (optional)</Label>
                <Input id="amount-default" value={loanAmountDefault} onChange={(e) => setLoanAmountDefault(e.target.value)} placeholder="10000.00" />
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Installments</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="inst-min">Min</Label>
                <Input id="inst-min" type="number" min={1} value={installmentCountMin} onChange={(e) => setInstallmentCountMin(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inst-max">Max (optional)</Label>
                <Input id="inst-max" type="number" min={1} value={installmentCountMax} onChange={(e) => setInstallmentCountMax(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inst-default">Default (optional)</Label>
                <Input id="inst-default" type="number" min={1} value={installmentCountDefault} onChange={(e) => setInstallmentCountDefault(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="grace-days">Grace Period (days)</Label>
                <Input id="grace-days" type="number" min={0} value={gracePeriodDefaultDays} onChange={(e) => setGracePeriodDefaultDays(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5 sm:w-1/2">
              <Label>Rounding Method</Label>
              <Select value={roundingMethod} onValueChange={(v) => setRoundingMethod(v as typeof roundingMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NO_ROUNDING">No Rounding</SelectItem>
                  <SelectItem value="ROUND_REMAINDER_INTO_LAST_REPAYMENT">Round Remainder Into Last Repayment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <input type="checkbox" checked={configurePenalty} onChange={(e) => setConfigurePenalty(e.target.checked)} />
              Configure a Penalty Rule
            </label>
            {configurePenalty && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Calculation Method</Label>
                  <Select value={penaltyCalculationMethod} onValueChange={(v) => setPenaltyCalculationMethod(v as PenaltyCalculationMethod)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OVERDUE_BALANCE_AND_INTEREST">Overdue Balance &amp; Interest</SelectItem>
                      <SelectItem value="ON_REPAYMENT">On Repayment</SelectItem>
                      <SelectItem value="NONE">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="penalty-rate">Rate %</Label>
                  <Input id="penalty-rate" value={penaltyRatePercent} onChange={(e) => setPenaltyRatePercent(e.target.value)} placeholder="2.00" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="penalty-cap">Cap %</Label>
                  <Input id="penalty-cap" value={penaltyCapPercent} onChange={(e) => setPenaltyCapPercent(e.target.value)} placeholder="20.00" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="penalty-grace">Grace (days)</Label>
                  <Input id="penalty-grace" type="number" min={0} value={penaltyGracePeriodDays} onChange={(e) => setPenaltyGracePeriodDays(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fee Rules</p>
              <Button type="button" variant="outline" size="sm" onClick={addFeeRule}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add Fee
              </Button>
            </div>
            {feeRules.length === 0 && <p className="text-xs text-muted-foreground">No fee rules on this version.</p>}
            {feeRules.map((fee) => (
              <div key={fee.key} className="space-y-2 rounded-md border p-2.5">
                <div className="flex items-center gap-2">
                  <Input
                    value={fee.name}
                    onChange={(e) => updateFeeRule(fee.key, { name: e.target.value })}
                    placeholder="Fee name (e.g. Processing Fee)"
                    className="flex-1"
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeFeeRule(fee.key)} aria-label="Remove fee">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Select value={fee.calculationMethod} onValueChange={(v) => updateFeeRule(fee.key, { calculationMethod: v as FeeCalculationMethod })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FLAT">Flat Amount</SelectItem>
                      <SelectItem value="PERCENTAGE_OF_LOAN_AMOUNT">% of Loan Amount</SelectItem>
                    </SelectContent>
                  </Select>
                  {fee.calculationMethod === 'FLAT' ? (
                    <Input
                      value={fee.flatAmount}
                      onChange={(e) => updateFeeRule(fee.key, { flatAmount: e.target.value })}
                      placeholder="500.00"
                    />
                  ) : (
                    <Input
                      value={fee.percentage}
                      onChange={(e) => updateFeeRule(fee.key, { percentage: e.target.value })}
                      placeholder="2.00"
                    />
                  )}
                  <Select value={fee.triggerEvent} onValueChange={(v) => updateFeeRule(fee.key, { triggerEvent: v as FeeTriggerEvent })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DISBURSEMENT">Disbursement</SelectItem>
                      <SelectItem value="MANUAL">Manual</SelectItem>
                      <SelectItem value="CAPITALIZED_DISBURSEMENT">Capitalized Disbursement</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={fee.applicationType} onValueChange={(v) => updateFeeRule(fee.key, { applicationType: v as FeeApplicationType })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REQUIRED">Required</SelectItem>
                      <SelectItem value="OPTIONAL">Optional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending ? 'Creating…' : 'Create Version'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
