'use client';

import { useState } from 'react';
import { Plus, Trash2, User, Mail, Phone, Calendar, AlertCircle, X, Eye, EyeOff } from 'lucide-react';
import { useCbtStaff, useCreateCbtStaff, useDeleteCbtStaff } from '@/hooks/use-cbt-staff';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@zendocx/types';
import { cn } from '@/lib/utils';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatLastSeen(iso: string | null) {
  if (!iso) return 'Never logged in';
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface CreateStaffFormProps {
  onClose: () => void;
}

function CreateStaffForm({ onClose }: CreateStaffFormProps) {
  const { mutate, isPending, error } = useCreateCbtStaff();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate(form, { onSuccess: onClose });
  };

  const field = (
    key: keyof typeof form,
    label: string,
    type = 'text',
    placeholder = '',
  ) => (
    <div>
      <label className="block text-xs font-medium text-brand-muted mb-1">{label}</label>
      {key === 'password' ? (
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={form[key]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            placeholder={placeholder}
            required
            className="w-full rounded-lg border border-brand-line bg-white px-3 py-2 pr-10 text-sm text-brand-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      ) : (
        <input
          type={type}
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          placeholder={placeholder}
          required
          className="w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
        />
      )}
    </div>
  );

  const errMsg =
    error instanceof Error
      ? error.message
      : error
        ? 'Failed to create staff account'
        : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-brand-line px-5 py-4">
          <h2 className="text-sm font-semibold text-brand-ink">Add Staff Account</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-brand-surface-soft">
            <X size={16} className="text-brand-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {field('firstName', 'First name', 'text', 'Ada')}
            {field('lastName', 'Last name', 'text', 'Obi')}
          </div>
          {field('email', 'Email address', 'email', 'staff@example.com')}
          {field('phone', 'Phone number', 'tel', '+2348000000000')}
          {field('password', 'Password', 'password')}

          {errMsg && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {errMsg}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-brand-line py-2.5 text-sm font-medium text-brand-muted hover:bg-brand-surface-soft"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-lg bg-brand-navy py-2.5 text-sm font-semibold text-white hover:bg-brand-navy-strong disabled:opacity-60"
            >
              {isPending ? 'Creating…' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StaffPage() {
  const user = useAuthStore((state) => state.user);
  const { data: staff, isLoading, error } = useCbtStaff();
  const { mutate: deleteStaff, isPending: deleting } = useDeleteCbtStaff();
  const [showForm, setShowForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Only CBT_CENTER owners can manage staff
  if (user?.role !== UserRole.CBT_CENTER) {
    return (
      <div className="p-6 text-center text-sm text-brand-muted">
        Staff management is only available to CBT center owners.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-brand-surface-soft" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-sm text-red-500">
        Failed to load staff list. Please try again.
      </div>
    );
  }

  const handleDelete = (staffId: string) => {
    deleteStaff(staffId, {
      onSuccess: () => setConfirmDeleteId(null),
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-brand-ink">Staff Accounts</h1>
          <p className="text-xs text-brand-muted mt-0.5">
            Operational staff who fulfill manual service orders on behalf of your center
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-strong"
        >
          <Plus size={15} />
          Add Staff
        </button>
      </div>

      {/* Staff list */}
      {!staff || staff.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-line bg-brand-surface-soft/40 p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
            <User size={22} className="text-brand-muted" />
          </div>
          <p className="text-sm font-medium text-brand-ink">No staff accounts yet</p>
          <p className="mt-1 text-xs text-brand-muted">
            Add staff members so they can pick up and fulfil manual service orders.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus size={14} />
            Add First Staff Member
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map((member) => {
            const isConfirming = confirmDeleteId === member.id;

            return (
              <div
                key={member.id}
                className="rounded-2xl border border-brand-line bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-navy">
                      <span className="text-xs font-bold text-white">
                        {member.firstName[0]}{member.lastName[0]}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-brand-ink">
                        {member.firstName} {member.lastName}
                      </p>
                      <span
                        className={cn(
                          'inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          member.isActive
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-500',
                        )}
                      >
                        {member.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  {isConfirming ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-red-600 font-medium">Remove?</span>
                      <button
                        onClick={() => handleDelete(member.id)}
                        disabled={deleting}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        {deleting ? 'Removing…' : 'Yes, remove'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-lg border border-brand-line px-3 py-1.5 text-xs font-medium text-brand-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(member.id)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Remove staff"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                  <div className="flex items-center gap-1.5 text-xs text-brand-muted">
                    <Mail size={12} />
                    <span className="truncate">{member.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-brand-muted">
                    <Phone size={12} />
                    <span>{member.phone}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-brand-muted">
                    <Calendar size={12} />
                    <span>Added {formatDate(member.joinedAt)}</span>
                  </div>
                </div>

                <p className="mt-2 text-[11px] text-slate-400">
                  Last login: {formatLastSeen(member.lastLoginAt)}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {showForm && <CreateStaffForm onClose={() => setShowForm(false)} />}
    </div>
  );
}
