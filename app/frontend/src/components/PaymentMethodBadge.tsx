import { Badge } from '@/components/ui/badge';
import { getPaymentMethodLabel, isDiscontinuedPaymentMethod } from '@/lib/mockData';

export function PaymentMethodBadge({ code }: { code: string }) {
  const discontinued = isDiscontinuedPaymentMethod(code);
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant={discontinued ? 'secondary' : 'outline'}>{getPaymentMethodLabel(code)}</Badge>
      {discontinued && (
        <Badge variant="secondary" className="text-[10px]">
          Discontinued
        </Badge>
      )}
    </span>
  );
}
