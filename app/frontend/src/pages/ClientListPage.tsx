import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { MOCK_ACTIVITY_LOGS, MOCK_BORROWERS } from '@/lib/mockData';
import { formatPeso } from '@/lib/utils';

function initials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

export function ClientListPage() {
  const navigate = useNavigate();
  useLogPageView('Client Data');
  const [search, setSearch] = React.useState('');

  const filtered = MOCK_BORROWERS.filter((b) => {
    const query = search.trim().toLowerCase();
    return (
      query.length === 0 ||
      b.name.toLowerCase().includes(query) ||
      b.employer.toLowerCase().includes(query) ||
      b.homeBranchName.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Client Data</h2>
        <p className="text-sm text-muted-foreground">{MOCK_BORROWERS.length} sample borrower profiles.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Search Clients</CardTitle>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, employer, or branch..."
              className="w-full pl-8 sm:w-72"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Employer</TableHead>
                <TableHead>Home Branch</TableHead>
                <TableHead className="text-right">Loans</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b) => (
                <TableRow key={b.id} className="cursor-pointer" onClick={() => navigate(`/clients/${b.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={b.profilePictureUrl} alt={b.name} />
                        <AvatarFallback>{initials(b.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{b.name}</p>
                        <p className="text-xs text-muted-foreground">{formatPeso(b.monthlyIncome)}/mo income</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <p>{b.contactNumber}</p>
                    <p className="text-xs text-muted-foreground">{b.email}</p>
                  </TableCell>
                  <TableCell className="text-sm">
                    <p>{b.employer}</p>
                    <p className="text-xs text-muted-foreground">{b.position}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{b.homeBranchName}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline">{b.loanIds.length}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No sample clients match your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RecentActivityPanel entries={MOCK_ACTIVITY_LOGS.filter((l) => l.entityType === 'Client Data')} title="Recent Activity — Client Data" />
    </div>
  );
}
