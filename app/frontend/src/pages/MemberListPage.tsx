import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Eye, EyeOff, Lock, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { PaginationControls } from '@/components/PaginationControls';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { RoleAbbr } from '@/components/RoleAbbr';
import { FieldLockToggle } from '@/components/FieldLockToggle';
import { ROLE_GLOSSARY, roleShortLabel } from '@/lib/roleGlossary';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { useSortableTable } from '@/lib/useSortableTable';
import { useCursorPagination } from '@/lib/useCursorPagination';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { apiClient } from '@/lib/apiClient';
import type { CreateUserRequest, UpdateUserRequest, User, UserStatus } from '@/lib/userApiTypes';
import type { ListRoleClassesResponse, RoleClass, RoleType } from '@/lib/roleClassApiTypes';
import type { LmsRole } from '@/lib/mockData';
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
  companyId: string;
  roleClassId: string;
}

function emptyDraft(): MemberDraft {
  return {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'Collection Officer',
    status: 'ACTIVE',
    companyId: '',
    roleClassId: '',
  };
}

function MemberForm({
  value,
  onChange,
  passwordMode,
  lockableFields = false,
}: {
  value: MemberDraft;
  onChange: (next: MemberDraft) => void;
  /** "required" for Add (a new account needs a password); "reset" for Edit (leave blank to keep the current password, fill in to reset it for a member who forgot theirs). */
  passwordMode: 'required' | 'reset';
  /** true on Edit - Email, Company ID, and Reset Password start locked and require an explicit click to unlock, to prevent accidental edits (e.g. typing into the wrong field). Always editable on Add - there's nothing to accidentally overwrite yet. */
  lockableFields?: boolean;
}) {
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const [unlocked, setUnlocked] = React.useState({ email: false, companyId: false, password: false });
  const toggleUnlock = (field: keyof typeof unlocked) => setUnlocked((u) => ({ ...u, [field]: !u[field] }));

  const emailEditable = !lockableFields || unlocked.email;
  const companyIdEditable = !lockableFields || unlocked.companyId;
  const passwordEditable = !lockableFields || unlocked.password;

  const roleClassesQuery = useQuery({
    queryKey: ['role-classes'],
    queryFn: () => apiClient.get<ListRoleClassesResponse>('/role-classes'),
  });
  const selectedRoleType = roleClassesQuery.data?.roleTypes.find((rt) => rt.name === value.role);
  const availableRoleClasses = selectedRoleType
    ? (roleClassesQuery.data?.roleClasses ?? []).filter((rc) => rc.roleId === selectedRoleType.id)
    : [];

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
        <div className="flex items-center justify-between">
          <Label>Email</Label>
          {lockableFields && <FieldLockToggle unlocked={unlocked.email} onToggle={() => toggleUnlock('email')} />}
        </div>
        <Input
          type="email"
          value={value.email}
          onChange={(e) => onChange({ ...value, email: e.target.value })}
          disabled={!emailEditable}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <div className="flex items-center justify-between">
          <Label>Company ID</Label>
          {lockableFields && <FieldLockToggle unlocked={unlocked.companyId} onToggle={() => toggleUnlock('companyId')} />}
        </div>
        <Input
          value={value.companyId}
          onChange={(e) => onChange({ ...value, companyId: e.target.value })}
          placeholder="e.g. EC-0042"
          disabled={!companyIdEditable}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <div className="flex items-center justify-between">
          <Label>{passwordMode === 'required' ? 'Temporary Password' : 'Reset Password (optional)'}</Label>
          {lockableFields && <FieldLockToggle unlocked={unlocked.password} onToggle={() => toggleUnlock('password')} />}
        </div>
        {passwordMode === 'reset' && (
          <p className="text-xs text-muted-foreground">
            Leave blank to keep the member's current password. Fill in to set a new temporary password for a member who forgot theirs.
          </p>
        )}
        <div className="relative">
          <Input
            type={passwordVisible ? 'text' : 'password'}
            value={value.password}
            onChange={(e) => onChange({ ...value, password: e.target.value })}
            className="pr-9"
            disabled={!passwordEditable}
          />
          <button
            type="button"
            onClick={() => setPasswordVisible((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={passwordVisible ? 'Hide password' : 'Show password'}
          >
            {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Role Type</Label>
        <Select
          value={value.role}
          onValueChange={(v) => onChange({ ...value, role: v as LmsRole, roleClassId: '' })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LMS_ROLES.map((r) => (
              <SelectItem key={r} value={r} title={ROLE_GLOSSARY[r]?.full}>
                {roleShortLabel(r)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Role Class</Label>
        <Select value={value.roleClassId} onValueChange={(v) => onChange({ ...value, roleClassId: v })} disabled={availableRoleClasses.length === 0}>
          <SelectTrigger>
            <SelectValue placeholder={availableRoleClasses.length === 0 ? 'None available' : 'Select'} />
          </SelectTrigger>
          <SelectContent>
            {availableRoleClasses.map((rc) => (
              <SelectItem key={rc.id} value={rc.id}>
                {rc.name}
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
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

interface RoleClassDraft {
  roleId: string;
  name: string;
}

/**
 * Organizational job-title labels under each Role Type (e.g. "MIS Manager" under MIS) - display/
 * organizational only, does not affect LMS access (real permissions remain governed by the six
 * Role Types themselves). Wired to the real backend (`GET/POST /role-classes`, `PATCH
 * /role-classes/:id`).
 */
function RolesTab({ canManageMembers }: { canManageMembers: boolean }) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = React.useState(false);
  const [addDraft, setAddDraft] = React.useState<RoleClassDraft>({ roleId: '', name: '' });
  const [editingClass, setEditingClass] = React.useState<RoleClass | null>(null);
  const [editName, setEditName] = React.useState('');

  const query = useQuery({
    queryKey: ['role-classes'],
    queryFn: () => apiClient.get<ListRoleClassesResponse>('/role-classes'),
  });

  const roleTypes = query.data?.roleTypes ?? [];
  const roleClasses = query.data?.roleClasses ?? [];
  const classesByRole = React.useMemo(() => {
    const map = new Map<string, RoleClass[]>();
    for (const rc of roleClasses) {
      const list = map.get(rc.roleId) ?? [];
      list.push(rc);
      map.set(rc.roleId, list);
    }
    return map;
  }, [roleClasses]);

  const createMutation = useMutation({
    mutationFn: () => apiClient.post<RoleClass>('/role-classes', { roleId: addDraft.roleId, name: addDraft.name }),
    onSuccess: () => {
      setAddOpen(false);
      queryClient.invalidateQueries({ queryKey: ['role-classes'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingClass) return Promise.reject(new Error('No Role Class selected'));
      return apiClient.patch<RoleClass>(`/role-classes/${editingClass.id}`, { name: editName });
    },
    onSuccess: () => {
      setEditingClass(null);
      queryClient.invalidateQueries({ queryKey: ['role-classes'] });
    },
  });

  const openAdd = (roleId?: string) => {
    setAddDraft({ roleId: roleId ?? roleTypes[0]?.id ?? '', name: '' });
    setAddOpen(true);
  };

  const openEdit = (roleClass: RoleClass) => {
    setEditingClass(roleClass);
    setEditName(roleClass.name);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Role Type - what a Role Class belongs under. Role Class - a job title within that Role Type. Organizational labels only; they
          do not change LMS access.
        </p>
        {canManageMembers && (
          <Button onClick={() => openAdd()}>
            <Plus className="mr-2 h-4 w-4" /> Add Role Class
          </Button>
        )}
      </div>

      {query.isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> Could not load Roles. Is the backend running?
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {roleTypes.map((roleType: RoleType) => (
          <Card key={roleType.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-1.5 text-base">
                  <RoleAbbr role={roleType.name} />
                </CardTitle>
                <CardDescription>Role Type</CardDescription>
              </div>
              {canManageMembers && (
                <Button variant="outline" size="sm" onClick={() => openAdd(roleType.id)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {(classesByRole.get(roleType.id) ?? []).map((rc) => (
                  <li key={rc.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                    <span>{rc.name}</span>
                    {canManageMembers && (
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(rc)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </li>
                ))}
                {(classesByRole.get(roleType.id) ?? []).length === 0 && !query.isLoading && (
                  <li className="py-2 text-center text-xs text-muted-foreground">No Role Classes yet.</li>
                )}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Role Class</DialogTitle>
            <DialogDescription>Creates a new job-title label under a Role Type.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label>Role Type</Label>
              <Select value={addDraft.roleId} onValueChange={(v) => setAddDraft((d) => ({ ...d, roleId: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleTypes.map((rt: RoleType) => (
                    <SelectItem key={rt.id} value={rt.id} title={ROLE_GLOSSARY[rt.name]?.full}>
                      {roleShortLabel(rt.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Role Class</Label>
              <Input value={addDraft.name} onChange={(e) => setAddDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. MIS Manager" />
            </div>
          </div>
          {createMutation.isError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {createMutation.error instanceof Error ? createMutation.error.message : 'Could not create the Role Class.'}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={!addDraft.roleId || !addDraft.name.trim() || createMutation.isPending}>
              Add Role Class
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editingClass !== null} onOpenChange={(open) => !open && setEditingClass(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role Class</DialogTitle>
            <DialogDescription>Renames this job-title label.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Role Class</Label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          {updateMutation.isError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {updateMutation.error instanceof Error ? updateMutation.error.message : 'Could not update the Role Class.'}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingClass(null)}>
              Cancel
            </Button>
            <Button onClick={() => updateMutation.mutate()} disabled={!editName.trim() || updateMutation.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Wired to the real backend (`GET/POST /users`, `PATCH /users/:id`). New members are created in
 * the signed-in admin's own branch - there's no branch-picker endpoint yet, so branch reassignment
 * isn't offered here either; only name, email, role, and status are editable per the backend's
 * current `UpdateUserInput` shape.
 */
export function MemberListPage() {
  useLogPageView('Members');
  const { canManageMembers, role, currentAccount } = useRole();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<MemberDraft>(emptyDraft());
  const [editingUser, setEditingUser] = React.useState<User | null>(null);
  const [deletingUser, setDeletingUser] = React.useState<User | null>(null);
  const [editDraft, setEditDraft] = React.useState<MemberDraft>(emptyDraft());
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [memberTab, setMemberTab] = React.useState<'members' | 'roles'>('members');

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
        companyId: draft.companyId || undefined,
        roleClassId: draft.roleClassId || undefined,
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
        companyId: editDraft.companyId || undefined,
        roleClassId: editDraft.roleClassId || null,
        ...(editDraft.email !== editingUser.email ? { email: editDraft.email } : {}),
        ...(editDraft.password ? { password: editDraft.password } : {}),
      } satisfies UpdateUserRequest);
    },
    onSuccess: () => {
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (user: User) => apiClient.patch<User>(`/users/${user.id}`, { status: 'INACTIVE' } satisfies UpdateUserRequest),
    onSuccess: () => {
      setDeletingUser(null);
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
      companyId: user.companyId ?? '',
      roleClassId: user.roleClassId ?? '',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Members</h2>
        <p className="text-sm text-muted-foreground">Staff accounts and organizational role classifications.</p>
      </div>

      <Tabs value={memberTab} onValueChange={(v) => setMemberTab(v as 'members' | 'roles')}>
        <TabsList className="grid w-full grid-cols-2 sm:w-64">
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>
      </Tabs>

      {memberTab === 'roles' ? (
        <RolesTab canManageMembers={canManageMembers} />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">{members.length} staff accounts on this page.</p>
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
                    <Badge variant={user.roles.includes('MIS') ? 'default' : 'outline'}>
                      {user.roles.length > 0
                        ? user.roles.map((r, i) => (
                            <React.Fragment key={r}>
                              {i > 0 && ', '}
                              <RoleAbbr role={r} />
                            </React.Fragment>
                          ))
                        : '-'}
                    </Badge>
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

      <RecentActivityPanel label="Members" entityTypes={['Members', 'Member Details', 'LmsMember']} />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
            <DialogDescription>Creates a real staff account in your branch.</DialogDescription>
          </DialogHeader>
          <MemberForm value={draft} onChange={setDraft} passwordMode="required" />
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
            <DialogDescription>
              Updates the real staff account. Branch cannot be changed here. Email, Company ID, and Reset Password start locked -
              click "Click to edit" next to a field to unlock it.
            </DialogDescription>
          </DialogHeader>
          {editingUser && <MemberForm value={editDraft} onChange={setEditDraft} passwordMode="reset" lockableFields />}
          {updateMutation.isError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {updateMutation.error instanceof Error ? updateMutation.error.message : 'Could not update the account.'}
            </div>
          )}
          <DialogFooter className="sm:justify-between">
            {editingUser && editingUser.status !== 'INACTIVE' && (
              <Button variant="destructive" onClick={() => setDeletingUser(editingUser)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete Member
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletingUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingUser(null);
            setEditingUser(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Member</DialogTitle>
            <DialogDescription>
              This deactivates {deletingUser?.fullName}'s account (status set to Inactive) - they will no longer be able to sign in.
              Their historical records (loan applications encoded, payments posted, attachments uploaded) are preserved, not removed,
              to protect the audit trail.
            </DialogDescription>
          </DialogHeader>
          {deleteMutation.isError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {deleteMutation.error instanceof Error ? deleteMutation.error.message : 'Could not delete the account.'}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingUser(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deletingUser && deleteMutation.mutate(deletingUser)} disabled={deleteMutation.isPending}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>
      )}
    </div>
  );
}
