import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Lock, Pencil, Plus, Search } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { PaginationControls } from '@/components/PaginationControls';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { useSortableTable } from '@/lib/useSortableTable';
import { useCursorPagination } from '@/lib/useCursorPagination';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { apiClient } from '@/lib/apiClient';
import type { CreateUserRequest, UpdateUserRequest, User, UserStatus } from '@/lib/userApiTypes';
import type { LmsRole } from '@/lib/mockData';
import { MOCK_ACTIVITY_LOGS } from '@/lib/mockData';
import { formatDate } from '@/lib/utils';

const LMS_ROLES: LmsRole[] = ['MIS', 'Loan Operation Manager', 'CRM', 'Finance', 'Accounting', 'Collection Officer'];
const PAGE_SIZE = 100;

function getSortValue(user: User, key: string): string | number | Date | null | undefined {
  switch (key) {
    case 'name':
      return user.fullName;
    case 'role':
      return user.roles[0] ?? '';
    case 'branchName':
      return user.branchName;
    case 'email':
      return user.email;
    case 'status':
      return user.status;
    case 'createdAt':
      return new Date(user.createdAt);
    default:
      return undefined;
  }
}

interface MemberDraft {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: LmsRole;
  status: UserStatus;
}

function emptyDraft(): MemberDraft {
  return { firstName: '', lastName: '', email: '', password: '', role: 'Collection Officer', status: 'ACTIVE' };
}

function MemberForm({ value, onChange, showPassword }: { value: MemberDraft; onChange: (next: MemberDraft) => void; showPassword: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>First Name</Label>
        <Input value={value.firstName} onChange={(e) => onChange({ ...value, firstName: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Last Name</Label>
        <Input value={value.lastName} onChange={(e) => onChange({ ...value, lastName: e.target.value })} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Email</Label>
        <Input type="email" value={value.email} onChange={(e) => onChange({ ...value, email: e.target.value })} />
      </div>
      {showPassword && (
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Temporary Password</Label>
          <Input type="password" value={value.password} onChange={(e) => onChange({ ...value, password: e.target.value })} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Role</Label>
        <Select value={value.role} onValueChange={(v) => onChange({ ...value, role: v as LmsRole })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LMS_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Status</Label>
        <Select value={value.status} onValueChange={(v) => onChange({ ...value, status: v as UserStatus })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/**
 * Wired to the real backend (`GET/POST /users`, `PATCH /users/:id`). New members are created in
 * the signed-in admin's own branch — there's no branch-picker endpoint yet, so branch reassignment
 * isn't offered here either; only name, email, role, and status are editable per the backend's
 * current `UpdateUserInput` shape.
 */
export function MemberListPage() {
  useLogPageView('Member Details');
  const { canManageMembers, role, currentAccount } = useRole();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<MemberDraft>(emptyDraft());
  const [editingUser, setEditingUser] = React.useState<User | null>(null);
  const [editDraft, setEditDraft] = React.useState<MemberDraft>(emptyDraft());
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search);

  const {
    items: members,
    query: usersQuery,
    pageNumber,
    hasNext,
    hasPrev,
    goNext,
    goPrev,
  } = useCursorPagination<User>(['users'], '/users', { search: debouncedSearch }, PAGE_SIZE);
  const { sorted, sort, toggleSort } = useSortableTable(members, getSortValue, { key: 'createdAt', direction: 'desc' });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.post<User>('/users', {
        branchId: currentAccount.branchId,
        email: draft.email,
        password: draft.password,
        firstName: draft.firstName,
        lastName: draft.lastName,
        roleNames: [draft.role],
      } satisfies CreateUserRequest),
    onSuccess: () => {
      setAddOpen(false);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingUser) return Promise.reject(new Error('No member selected'));
      return apiClient.patch<User>(`/users/${editingUser.id}`, {
        firstName: editDraft.firstName,
        lastName: editDraft.lastName,
        status: editDraft.status,
        roleNames: [editDraft.role],
      } satisfies UpdateUserRequest);
    },
    onSuccess: () => {
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const openAdd = () => {
    setDraft(emptyDraft());
    setAddOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setEditDraft({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: '',
      role: (user.roles[0] as LmsRole) ?? 'Collection Officer',
      status: user.status,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">LMS Member Details</h2>
          <p className="text-sm text-muted-foreground">{members.length} staff accounts on this page.</p>
        </div>
        {canManageMembers ? (
          <Button onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" /> Add Member
          </Button>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Only <span className="font-medium text-foreground">MIS</span> can add/edit members. Signed in as{' '}
            <span className="font-medium text-foreground">
              {currentAccount.name} ({role})
            </span>
            .
          </div>
        )}
      </div>

      {usersQuery.isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> Could not load staff accounts. Is the backend running?
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staff Accounts</CardTitle>
          <CardDescription>{usersQuery.isLoading ? 'Loading…' : `${members.length} accounts, sorted by newest first.`}</CardDescription>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name or email..."
              className="w-full pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="name" currentSort={sort} onSort={toggleSort}>
                  Name
                </SortableTableHead>
                <SortableTableHead sortKey="role" currentSort={sort} onSort={toggleSort}>
                  Role
                </SortableTableHead>
                <SortableTableHead sortKey="branchName" currentSort={sort} onSort={toggleSort}>
                  Branch
                </SortableTableHead>
                <SortableTableHead sortKey="email" currentSort={sort} onSort={toggleSort}>
                  Email
                </SortableTableHead>
                <SortableTableHead sortKey="status" currentSort={sort} onSort={toggleSort}>
                  Status
                </SortableTableHead>
                <SortableTableHead sortKey="createdAt" currentSort={sort} onSort={toggleSort} isDateColumn>
                  Created
                </SortableTableHead>
                {canManageMembers && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs">
                          {user.fullName
                            .split(' ')
                            .filter(Boolean)
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{user.fullName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.roles.includes('MIS') ? 'default' : 'outline'}>{user.roles.join(', ') || '—'}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user.branchName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.status === 'ACTIVE' ? 'success' : user.status === 'SUSPENDED' ? 'destructive' : 'secondary'}>
                      {user.status === 'ACTIVE' ? 'Active' : user.status === 'SUSPENDED' ? 'Suspended' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
                  {canManageMembers && (
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openEdit(user)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {sorted.length === 0 && !usersQuery.isLoading && (
                <TableRow>
                  <TableCell colSpan={canManageMembers ? 7 : 6} className="py-8 text-center text-sm text-muted-foreground">
                    No staff accounts found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <PaginationControls
            pageNumber={pageNumber}
            hasNext={hasNext}
            hasPrev={hasPrev}
            onNext={goNext}
            onPrev={goPrev}
            pageSize={PAGE_SIZE}
            itemCount={members.length}
          />
        </CardContent>
      </Card>

      <RecentActivityPanel entries={MOCK_ACTIVITY_LOGS.filter((l) => l.entityType === 'Member Details' || l.entityType === 'LmsMember')} title="Recent Activity — Member Details" />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
            <DialogDescription>Creates a real staff account in your branch.</DialogDescription>
          </DialogHeader>
          <MemberForm value={draft} onChange={setDraft} showPassword />
          {createMutation.isError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {createMutation.error instanceof Error ? createMutation.error.message : 'Could not create the account.'}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!draft.firstName || !draft.lastName || !draft.email || !draft.password || createMutation.isPending}
            >
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editingUser !== null} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Member Details</DialogTitle>
            <DialogDescription>Updates the real staff account. Email and branch cannot be changed here.</DialogDescription>
          </DialogHeader>
          {editingUser && <MemberForm value={editDraft} onChange={setEditDraft} showPassword={false} />}
          {updateMutation.isError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {updateMutation.error instanceof Error ? updateMutation.error.message : 'Could not update the account.'}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
