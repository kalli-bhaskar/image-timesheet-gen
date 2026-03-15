import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { localClient } from '@/api/localClient';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserPlus, Search, Trash2, User, Mail } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Employees() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [search, setSearch] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [savingTagId, setSavingTagId] = useState('');
  const [newTagCode, setNewTagCode] = useState('');
  const [newTagCounty, setNewTagCounty] = useState('');
  const [newTagLocation, setNewTagLocation] = useState('');

  if (!user?.setup_complete) return <Navigate to="/Setup" replace />;
  if (user.user_role !== 'manager') return <Navigate to="/Dashboard" replace />;

  const { data: employees = [] } = useQuery({
    queryKey: ['managed-users', user.email],
    queryFn: () => localClient.entities.User.filter({ manager_email: user.email }),
  });

  const { data: companyEmployees = [] } = useQuery({
    queryKey: ['company-employees', user.company_name],
    queryFn: async () => {
      if (!user.company_name) return [];
      return localClient.entities.User.filter({ company_name: user.company_name, user_role: 'employee' });
    },
  });

  const { data: locationTags = [] } = useQuery({
    queryKey: ['location-tags'],
    queryFn: () => localClient.locationTags.list({ includeInactive: true }),
  });

  const activeTags = locationTags.filter((tag) => tag.is_active);

  const handleAdd = async () => {
    if (!email.trim()) return;
    setAdding(true);
    try {
      await localClient.users.inviteUser(email.trim(), 'user');
      toast.success(`Invitation sent to ${email}`);
      setEmail('');
      queryClient.invalidateQueries({ queryKey: ['managed-users'] });
      queryClient.invalidateQueries({ queryKey: ['company-employees'] });
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    await localClient.entities.User.update(removeTarget.id, { manager_email: '' });
    toast.success(`${removeTarget.full_name} removed`);
    setRemoveTarget(null);
    queryClient.invalidateQueries({ queryKey: ['managed-users'] });
  };

  const handleAssignToMe = async (employee) => {
    if (!employee?.id) return;
    await localClient.entities.User.update(employee.id, {
      manager_email: user.email,
      company_name: user.company_name || employee.company_name || '',
    });
    toast.success(`${employee.full_name} added to your team`);
    queryClient.invalidateQueries({ queryKey: ['managed-users'] });
    queryClient.invalidateQueries({ queryKey: ['company-employees'] });
  };

  const handleTagSave = async (employee, nextTag) => {
    if (!employee?.id || !nextTag) return;
    setSavingTagId(employee.id);
    try {
      await localClient.entities.User.update(employee.id, { work_location_tag: nextTag });
      toast.success(`Location tag for ${employee.full_name} set to ${nextTag}`);
      queryClient.invalidateQueries({ queryKey: ['managed-users'] });
      queryClient.invalidateQueries({ queryKey: ['company-employees'] });
    } finally {
      setSavingTagId('');
    }
  };

  const handleCreateTag = async () => {
    const code = String(newTagCode || '').trim().toUpperCase();
    const county = String(newTagCounty || '').trim();
    const location = String(newTagLocation || '').trim();
    if (!code || !county) return;

    await localClient.locationTags.create({
      code,
      county_name: county,
      data_center_location: location,
      is_active: true,
    });

    setNewTagCode('');
    setNewTagCounty('');
    setNewTagLocation('');
    toast.success(`Location tag ${code} created`);
    queryClient.invalidateQueries({ queryKey: ['location-tags'] });
  };

  const handleTagMetaUpdate = async (code, patch) => {
    await localClient.locationTags.update(code, patch);
    queryClient.invalidateQueries({ queryKey: ['location-tags'] });
  };

  const filtered = employees.filter((e) =>
    (e.full_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const companyCandidates = companyEmployees
    .filter((e) => e.id !== user.id)
    .filter((e) => (e.manager_email || '') !== user.email)
    .filter((e) => (e.full_name || '').toLowerCase().includes(companySearch.toLowerCase()));

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Team</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage your employees</p>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-slate-100 space-y-3">
        <p className="text-sm font-medium text-slate-700">Add Employee by Email</p>
        <div className="flex gap-2">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="employee@email.com"
            type="email"
            className="flex-1"
          />
          <Button
            onClick={handleAdd}
            disabled={adding || !email.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {adding ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-slate-100 space-y-3">
        <p className="text-sm font-medium text-slate-700">Location Tags</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Input
            value={newTagCode}
            onChange={(e) => setNewTagCode(e.target.value.toUpperCase())}
            placeholder="Tag (e.g. ABC)"
          />
          <Input
            value={newTagCounty}
            onChange={(e) => setNewTagCounty(e.target.value)}
            placeholder="County"
          />
          <Input
            value={newTagLocation}
            onChange={(e) => setNewTagLocation(e.target.value)}
            placeholder="Location Name"
          />
        </div>
        <Button onClick={handleCreateTag} disabled={!newTagCode.trim() || !newTagCounty.trim()}>
          Add Tag
        </Button>
        <div className="space-y-2">
          {locationTags.map((tag) => (
            <div key={tag.code} className="border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">{tag.code}</p>
                <label className="text-xs text-slate-500 flex items-center gap-2">
                  Active
                  <input
                    type="checkbox"
                    checked={!!tag.is_active}
                    onChange={(e) => handleTagMetaUpdate(tag.code, { is_active: e.target.checked })}
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  value={tag.county_name || ''}
                  onChange={(e) => handleTagMetaUpdate(tag.code, { county_name: e.target.value })}
                  placeholder="County"
                />
                <Input
                  value={tag.data_center_location || ''}
                  onChange={(e) => handleTagMetaUpdate(tag.code, { data_center_location: e.target.value })}
                  placeholder="Location Name"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {user.company_name && (
        <div className="bg-white rounded-2xl p-4 border border-slate-100 space-y-3">
          <p className="text-sm font-medium text-slate-700">Search Employees In {user.company_name}</p>
          <Input
            value={companySearch}
            onChange={(e) => setCompanySearch(e.target.value)}
            placeholder="Search company employees by name..."
          />
          <div className="space-y-2 max-h-56 overflow-auto">
            {companyCandidates.length === 0 ? (
              <p className="text-xs text-slate-500">No available employees found for your company.</p>
            ) : (
              companyCandidates.map((emp) => (
                <div
                  key={emp.id}
                  className="border border-slate-200 rounded-xl px-3 py-2 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{emp.full_name}</p>
                    <p className="text-xs text-slate-500 truncate">{emp.email}</p>
                  </div>
                  <Button size="sm" onClick={() => handleAssignToMe(emp)}>
                    Add
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search employees..."
          className="pl-10"
        />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
            <User className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">
              {search ? 'No employees match your search' : 'No employees added yet'}
            </p>
          </div>
        ) : (
          filtered.map((emp) => (
            <div
              key={emp.id}
              className="bg-white rounded-xl p-4 border border-slate-100 flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 truncate">{emp.full_name}</p>
                  <div className="flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <p className="text-xs text-slate-500 truncate">{emp.email}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <p className="text-[11px] text-slate-500">Data Center Tag</p>
                    <select
                      value={emp.work_location_tag || ''}
                      onChange={(e) => handleTagSave(emp, e.target.value)}
                      disabled={savingTagId === emp.id}
                      className="text-xs border border-slate-300 rounded-md px-2 py-1 bg-white"
                    >
                      <option value="">Set tag</option>
                      {activeTags.map((tag) => (
                        <option key={tag.code} value={tag.code}>{tag.code}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:text-red-600 shrink-0"
                onClick={() => setRemoveTarget(emp)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      <AlertDialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {removeTarget?.full_name} from your team?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-red-600 hover:bg-red-700">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
