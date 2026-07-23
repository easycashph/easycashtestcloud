import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PortalHeader } from '@/components/PortalHeader';
import { LOAN_PRODUCTS } from '@/lib/loanProducts';

/** Lets a logged-in client browse loan products before applying - "Apply Now" on a card jumps
 * straight to the application form with that product pre-selected (see LoanApplicationFormPage's
 * `?category=` query param handling). */
export function LoanProductsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-secondary/30">
      <PortalHeader />

      <main className="container py-10">
        <h1 className="text-2xl font-bold tracking-tight">Loan Products</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pick the product that fits what you need, then apply in a few minutes.</p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {LOAN_PRODUCTS.map((product) => (
            <Card key={product.category} className="flex flex-col p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <product.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-base font-semibold">{product.category}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{product.blurb}</p>
              <p className="mt-2 text-xs text-muted-foreground">{product.details}</p>
              <Button className="mt-5" onClick={() => navigate(`/apply?category=${encodeURIComponent(product.category)}`)}>
                Apply Now
              </Button>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
