import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PreviewFooterNote } from '@/components/PreviewBanner';
import { COMPANY_INFO } from '@/lib/mockData';

/**
 * Static display only — no authentication flow exists in this preview
 * build. "Continue to Dashboard" bypasses login entirely; the form fields
 * below do not submit anywhere.
 */
export function LoginPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <img src="/logo-easycash.png" alt="EasyCash logo" className="mb-2 h-16 w-16 object-contain" />
          <CardTitle className="text-lg">{COMPANY_INFO.name}</CardTitle>
          <CardDescription>Enterprise Digital Lending Platform</CardDescription>
          <p className="text-xs text-muted-foreground">{COMPANY_INFO.address}</p>
          <Badge variant="warning" className="mt-2">
            Preview Mode
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@easycash.ph" disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="••••••••" disabled />
          </div>
          <p className="text-xs text-muted-foreground">
            Authentication is out of scope for this UI preview (Milestone 9.1) — this form is a static display only.
          </p>
          <Button className="w-full" onClick={() => navigate('/')}>
            Continue to Dashboard (Preview)
          </Button>
        </CardContent>
      </Card>
      <div className="w-full max-w-sm">
        <PreviewFooterNote />
      </div>
    </div>
  );
}
