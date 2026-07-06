import * as React from 'react';
import { Lock, Pencil, Plus } from 'lucide-react';
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
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { useSortableTable } from '@/lib/useSortableTable';
import { emptyDraftMember, logActivity, MOCK_ACTIVITY_LOGS, MOCK_LMS_MEMBERS, type LmsRole, type MockLmsMember } from '@/lib/mockData';
import { formatDate } from '@/lib/utils';

function getSortValue(member: MockLmsMember, key: string): string | number | Date | null | undefined {
  switch (key) {
    case 'name':
      return member.name;
    case 'role':
      return member.role;
    case 'branchName':
      return member.branchName;
    case 'email':
      return member.email;
    case 'status':
      return member.status;
    case 'lastLoginAt':
      return member.lastLoginAt ? new Date(member.lastLoginAt) : null;
    default:
      return undefined;
  }
}

function MemberForm({ value, onChange }: { value: MockLmsMember; onChange: (next: MockLmsMember) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Full Name</Label>
        <Input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input value={value.email} onChange={(e) => onChange({ ...value, email: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Role</Label>
        <Select value={value.role} onValueChange={(v) => onChange({ ...value, role: v as LmsRole })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MIS">MIS</SelectItem>
            <SelectItem value="Loan Operation Manager">Loan Operation Manager</SelectItem>
            <SelectItem value="CRM">CRM</SelectItem>
            <SelectItem value="Finance">Finance</SelectItem>
            <SelectItem value="Accounting">Accounting</SelectItem>
            <SelectItem value="Collection Officer">Collection Officer</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Status</Label>
        <Select value={value.status} onValueChange={(v) => onChange({ ...value, status: v as MockLmsMember['status'] })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="DISABLED">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function MemberListPage() {
  useLogPageView('Member Details');
  const { canManageMembers, role, currentAccount } = useRole();
  const [members, setMembers] = React.useState<MockLmsMember[]>(MOCK_LMS_MEMBERS);
  const [addOpen, setAddOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<MockLmsMember>(emptyDraftMember());
  const [editingMember, setEditingMember] = React.useState<MockLmsMember | null>(null);
  const { sorted, sort, toggleSort } = useSortableTable(members, getSortValue, { key: 'lastLoginAt', direction: 'desc' });

  const openAdd = () => {
    setDraft(emptyDraftMember());
    setAddOpen(true);
  };

  const saveNewMember = () => {
    setMembers((prev) => [...prev, draft]);
    setAddOpen(false);
    logActivity({
      userName: currentAccount.name,
      action: 'ADD_MEMBER',
      entityType: 'LmsMember',
      entityId: draft.email || draft.name,
      at: new Date().toISOString(),
    });
  };

  const saveEditedMember = () => {
    if (!editingMember) return;
    setMembers((prev) => prev.map((m) => (m.id === editingMember.id ? editingMember : m)));
    logActivity({
      userName: currentAccount.name,
      action: 'EDIT_MEMBER',
      entityType: 'LmsMember',
      entityId: editingMember.email,
      at: new Date().toISOString(),
    });
    setEditingMember(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">LMS Member Details</h2>
          <p className="text-sm text-muted-foreground">{members.length} staff accounts using the Loan Management System.</p>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staff Accounts</CardTitle>
          <CardDescription>
            Policy preview: use "Switch Account" in the top bar to see Add/Edit actions appear or disappear live.
          </CardDescription>
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
                <SortableTableHead sortKey="lastLoginAt" currentSort={sort} onSort={toggleSort} isDateColumn>
                  Last Login
                </SortableTableHead>
                {canManageMembers && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs">
                          {member.name
                            .split(' ')
                            .filter(Boolean)
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{member.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.role === 'MIS' ? 'default' : 'outline'}>{member.role}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{member.branchName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{member.email}</TableCell>
                  <TableCell>
                    <Badge variant={member.status === 'ACTIVE' ? 'success' : 'secondary'}>
                      {member.status === 'ACTIVE' ? 'Active' : 'Disabled'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {member.lastLoginAt ? formatDate(member.lastLoginAt) : 'Never'}
                  </TableCell>
                  {canManageMembers && (
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setEditingMember(member)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RecentActivityPanel entries={MOCK_ACTIVITY_LOGS.filter((l) => l.entityType === 'Member Details' || l.entityType === 'LmsMember')} title="Recent Activity — Member Details" />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
            <DialogDescription>Preview only — added members are held in this browser tab and are not saved anywhere.</DialogDescription>
          </DialogHeader>
          <MemberForm value={draft} onChange={setDraft} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveNewMember} disabled={!draft.name || !draft.email}>
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editingMember !== null} onOpenChange={(open) => !open && setEditingMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit / Customize Member Details</DialogTitle>
            <DialogDescription>Preview only — changes update this browser tab's in-memory copy and are not saved anywhere.</DialogDescription>
          </DialogHeader>
          {editingMember && <MemberForm value={editingMember} onChange={setEditingMember} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMember(null)}>
              Cancel
            </Button>
            <Button onClick={saveEditedMember}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
