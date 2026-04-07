'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { id as instantId } from '@instantdb/react';
import {
  Shield,
  Users,
  ClipboardList,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  ChevronRight,
  Lock,
  CheckSquare,
  Square,
  Check,
  Mail,
  UserPlus,
} from 'lucide-react';
import Sidebar from '@/app/components/Sidebar';
import db from '@/lib/instant';

// ─── Products ────────────────────────────────────────────────────────────────

const PLANVIEW_PRODUCTS = [
  { name: 'Agileplace',   icon: '⬛' },
  { name: 'Portfolios',   icon: '📁' },
  { name: 'Adaptivework', icon: '🔁' },
  { name: 'Anvi',         icon: '🧠' },
  { name: 'Projectplace', icon: '📋' },
  { name: 'LeanKit',      icon: '📌' },
  { name: 'Spigit',       icon: '💡' },
  { name: 'Tasktop',      icon: '🔗' },
];

// ─── Permission Modules ──────────────────────────────────────────────────────

const PERMISSION_MODULES = [
  { key: 'vulnerabilities', label: 'Vulnerabilities',   actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'assessment',      label: 'Impact Assessment', actions: ['view', 'create', 'edit'] },
  { key: 'triage',          label: 'Triage',            actions: ['view', 'create', 'edit'] },
  { key: 'remediation',     label: 'Remediation',       actions: ['view', 'create', 'edit'] },
  { key: 'reports',         label: 'Reports',           actions: ['view', 'export'] },
  { key: 'products',        label: 'Products',          actions: ['view'] },
  { key: 'verification',    label: 'Verification',      actions: ['view', 'create', 'edit'] },
  { key: 'settings',        label: 'Settings',          actions: ['access', 'modify'] },
];

type Permissions = Record<string, Record<string, boolean>>;

function buildPermissions(grant: 'all' | 'none' | Partial<Record<string, string[]>>): Permissions {
  const perms: Permissions = {};
  for (const mod of PERMISSION_MODULES) {
    perms[mod.key] = {};
    for (const action of mod.actions) {
      if (grant === 'all') {
        perms[mod.key][action] = true;
      } else if (grant === 'none') {
        perms[mod.key][action] = false;
      } else {
        perms[mod.key][action] = (grant[mod.key] ?? []).includes(action);
      }
    }
  }
  return perms;
}

const DEFAULT_ROLES = [
  {
    name: 'Admin',
    description: 'Full access to all modules and settings.',
    permissions: buildPermissions('all'),
    isSystem: true,
  },
  {
    name: 'Security Analyst',
    description: 'Logs, triages, and verifies vulnerabilities.',
    permissions: buildPermissions({
      vulnerabilities: ['view', 'create', 'edit', 'delete'],
      assessment: ['view'],
      triage: ['view', 'create', 'edit'],
      remediation: ['view'],
      reports: ['view'],
      products: ['view'],
      verification: ['view', 'create', 'edit'],
      settings: [],
    }),
    isSystem: true,
  },
  {
    name: 'Product Owner',
    description: 'Assesses impact and manages remediation tasks.',
    permissions: buildPermissions({
      vulnerabilities: ['view'],
      assessment: ['view', 'create', 'edit'],
      triage: ['view'],
      remediation: ['view', 'create', 'edit'],
      reports: ['view'],
      products: ['view'],
      verification: ['view'],
      settings: [],
    }),
    isSystem: true,
  },
  {
    name: 'Compliance Officer',
    description: 'Reviews audit trail and approves closures.',
    permissions: buildPermissions({
      vulnerabilities: ['view'],
      assessment: ['view'],
      triage: ['view'],
      remediation: ['view'],
      reports: ['view', 'export'],
      products: ['view'],
      verification: ['view'],
      settings: ['access'],
    }),
    isSystem: true,
  },
  {
    name: 'Executive',
    description: 'Read-only access to dashboards and reports.',
    permissions: buildPermissions({
      vulnerabilities: ['view'],
      assessment: [],
      triage: [],
      remediation: [],
      reports: ['view'],
      products: ['view'],
      verification: [],
      settings: [],
    }),
    isSystem: true,
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permissions;
  isSystem: boolean;
  createdAt: number;
  updatedAt: number;
}

interface UserRole {
  id: string;
  email: string;
  roleId: string;
  roleName: string;
  assignedAt: number;
  assignedBy?: string;
  products?: string[];
}

interface AuditLog {
  id: string;
  action: string;
  targetEmail?: string;
  roleName: string;
  performedBy: string;
  timestamp: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function countPerms(permissions: Permissions): number {
  return Object.values(permissions).reduce(
    (sum, actions) => sum + Object.values(actions).filter(Boolean).length,
    0
  );
}

function formatTs(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const ACTION_LABELS: Record<string, string> = {
  ROLE_CREATED:  'Role created',
  ROLE_UPDATED:  'Role updated',
  ROLE_DELETED:  'Role deleted',
  USER_ASSIGNED: 'User assigned',
};

// ─── Permissions Matrix Component ────────────────────────────────────────────

function PermissionsMatrix({
  permissions,
  onChange,
  readonly,
}: {
  permissions: Permissions;
  onChange?: (mod: string, action: string, val: boolean) => void;
  readonly: boolean;
}) {
  return (
    <div className="space-y-1">
      {/* Header row */}
      <div className="grid gap-2 pb-2 border-b border-slate-800" style={{ gridTemplateColumns: '1fr repeat(4, auto)' }}>
        <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Module</span>
        {['View', 'Create / Export', 'Edit / Access', 'Delete / Modify'].map(h => (
          <span key={h} className="text-xs text-slate-500 font-medium uppercase tracking-wide text-center w-20">{h}</span>
        ))}
      </div>

      {PERMISSION_MODULES.map(mod => (
        <div key={mod.key} className="grid gap-2 py-1.5 hover:bg-slate-800/30 rounded px-1 transition" style={{ gridTemplateColumns: '1fr repeat(4, auto)' }}>
          <span className="text-sm text-slate-300">{mod.label}</span>
          {[
            mod.actions[0],           // view
            mod.actions[1],           // create / export
            mod.actions[2],           // edit / access
            mod.actions[3],           // delete / modify
          ].map((action, colIdx) => {
            const hasAction = !!action;
            const checked = hasAction && !!permissions[mod.key]?.[action];
            return (
              <div key={colIdx} className="flex items-center justify-center w-20">
                {hasAction ? (
                  readonly ? (
                    checked
                      ? <CheckSquare size={16} className="text-red-400" />
                      : <Square size={16} className="text-slate-700" />
                  ) : (
                    <button
                      onClick={() => onChange?.(mod.key, action, !checked)}
                      className="p-0.5 rounded transition hover:opacity-80"
                    >
                      {checked
                        ? <CheckSquare size={16} className="text-red-400" />
                        : <Square size={16} className="text-slate-600 hover:text-slate-400" />}
                    </button>
                  )
                ) : (
                  <span className="w-4 h-4 block" />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Role Modal ───────────────────────────────────────────────────────────────

function RoleModal({
  role,
  onClose,
  onSave,
}: {
  role: Partial<Role> | null;
  onClose: () => void;
  onSave: (data: { name: string; description: string; permissions: Permissions }) => void;
}) {
  const isEdit = !!role?.id;
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [permissions, setPermissions] = useState<Permissions>(
    role?.permissions ?? buildPermissions('none')
  );
  const [showPreview, setShowPreview] = useState(false);

  function togglePerm(mod: string, action: string, val: boolean) {
    setPermissions(prev => ({
      ...prev,
      [mod]: { ...prev[mod], [action]: val },
    }));
  }

  const isSystemRole = role?.isSystem === true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-white font-semibold text-base">
            {isEdit ? 'Edit Role' : 'Create Role'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Name & Description */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Role Name</label>
              {isSystemRole ? (
                <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5">
                  <Lock size={14} className="text-slate-500" />
                  <span className="text-sm text-slate-300">{name}</span>
                </div>
              ) : (
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Security Lead"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
                />
              )}
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Description <span className="text-slate-600">(optional)</span></label>
              {isSystemRole ? (
                <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5">
                  <Lock size={14} className="text-slate-500" />
                  <span className="text-sm text-slate-400">{description || '—'}</span>
                </div>
              ) : (
                <input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Brief description of this role's responsibilities"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
                />
              )}
            </div>
          </div>

          {/* Permissions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs text-slate-400 font-medium">Permissions</label>
              {!isSystemRole && (
                <div className="flex gap-2">
                  <button onClick={() => setPermissions(buildPermissions('all'))}
                    className="text-xs text-red-400 hover:text-red-300 transition">Grant All</button>
                  <span className="text-slate-700">·</span>
                  <button onClick={() => setPermissions(buildPermissions('none'))}
                    className="text-xs text-slate-500 hover:text-slate-300 transition">Clear All</button>
                </div>
              )}
            </div>
            <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-800">
              <PermissionsMatrix
                permissions={permissions}
                onChange={isSystemRole ? undefined : togglePerm}
                readonly={false}
              />
            </div>
          </div>

          {/* Preview */}
          {showPreview && (
            <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 space-y-2">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-3">Role Preview</p>
              <p className="text-sm text-white font-medium">{name || '(unnamed)'}</p>
              {description && <p className="text-sm text-slate-400">{description}</p>}
              <p className="text-xs text-slate-500 mt-2">
                {countPerms(permissions)} permission{countPerms(permissions) !== 1 ? 's' : ''} granted across{' '}
                {Object.values(permissions).filter(a => Object.values(a).some(Boolean)).length} modules
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800">
          <button onClick={() => setShowPreview(p => !p)}
            className="text-xs text-slate-500 hover:text-slate-300 transition">
            {showPreview ? 'Hide Preview' : 'Preview Role'}
          </button>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition">
              Cancel
            </button>
            <button
              onClick={() => onSave({ name: name.trim(), description: description.trim(), permissions })}
              disabled={!name.trim()}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-medium rounded-lg transition">
              {isEdit ? 'Save Changes' : 'Create Role'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

function DeleteConfirm({ roleName, onConfirm, onCancel }: { roleName: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
        <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
          <Trash2 size={18} className="text-red-400" />
        </div>
        <div>
          <h3 className="text-white font-semibold text-base">Delete Role</h3>
          <p className="text-slate-400 text-sm mt-1">
            Are you sure you want to delete <span className="text-white font-medium">"{roleName}"</span>?
            Users with this role will be unassigned. This action cannot be undone.
          </p>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onCancel}
            className="flex-1 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2 text-sm bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition">
            Delete Role
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Onboard User Modal (Admin only) ─────────────────────────────────────────

function OnboardUserModal({
  roles,
  existingEmail,
  existingRoleId,
  existingProducts,
  onClose,
  onSave,
}: {
  roles: Role[];
  existingEmail?: string;
  existingRoleId?: string;
  existingProducts?: string[];
  onClose: () => void;
  onSave: (email: string, roleId: string, roleName: string, products: string[]) => void;
}) {
  const isChangeRole = !!existingEmail;
  const [step, setStep]           = useState<'details' | 'confirm'>('details');
  const [email, setEmail]         = useState(existingEmail ?? '');
  const [roleId, setRoleId]       = useState(existingRoleId ?? '');
  const [products, setProducts]   = useState<string[]>(existingProducts ?? []);
  const [savedEmail, setSavedEmail] = useState('');
  const [sending, setSending]     = useState(false);
  const [inviteError, setInviteError] = useState('');

  const selectedRole = roles.find(r => r.id === roleId);

  function toggleProduct(name: string) {
    setProducts(prev =>
      prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name]
    );
  }

  function toggleAll() {
    setProducts(prev =>
      prev.length === PLANVIEW_PRODUCTS.length ? [] : PLANVIEW_PRODUCTS.map(p => p.name)
    );
  }

  async function handleSave() {
    if (!selectedRole) return;
    const trimmed = email.trim();
    onSave(trimmed, roleId, selectedRole.name, products);
    if (isChangeRole) {
      onClose();
      return;
    }
    setSending(true);
    setSavedEmail(trimmed);
    try {
      await db.auth.sendMagicCode({ email: trimmed });
    } catch {
      setInviteError('User was added, but the invite email could not be sent. You can share the app URL with them directly.');
    } finally {
      setSending(false);
      setStep('confirm');
    }
  }

  // ── Step 2: Confirmation ────────────────────────────────────────────────
  if (step === 'confirm') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold text-base">User Onboarded</h2>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition">
              <X size={18} />
            </button>
          </div>

          {/* User added */}
          <div className="flex items-center gap-3 bg-green-500/5 border border-green-500/20 rounded-xl px-4 py-3">
            <div className="w-7 h-7 bg-green-500/15 rounded-full flex items-center justify-center shrink-0">
              <Check size={14} className="text-green-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-white font-medium">{savedEmail}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Added as <span className="text-white">{selectedRole?.name}</span>
              </p>
              {products.length > 0 && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Products: {products.join(', ')}
                </p>
              )}
            </div>
          </div>

          {/* Invite status */}
          {inviteError ? (
            <div className="flex items-start gap-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3">
              <Mail size={15} className="text-yellow-400 mt-0.5 shrink-0" />
              <p className="text-xs text-yellow-300">{inviteError}</p>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3">
              <Mail size={15} className="text-slate-400 shrink-0" />
              <p className="text-xs text-slate-400">
                An invitation email with a magic sign-in link has been sent to{' '}
                <span className="text-slate-200">{savedEmail}</span>.
              </p>
            </div>
          )}

          <button onClick={onClose}
            className="w-full py-2 text-sm bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition">
            Done
          </button>
        </div>
      </div>
    );
  }

  // ── Step 1: Details ─────────────────────────────────────────────────────
  const allSelected = products.length === PLANVIEW_PRODUCTS.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col" style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div>
            <h2 className="text-white font-semibold text-base">
              {isChangeRole ? 'Edit User Access' : 'Add New User'}
            </h2>
            {!isChangeRole && (
              <p className="text-slate-500 text-xs mt-0.5">Add a team member, assign their role and product access.</p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Email */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">User Email</label>
            {isChangeRole ? (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-300">
                {existingEmail}
              </div>
            ) : (
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                type="email"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
              />
            )}
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Role</label>
            <select
              value={roleId}
              onChange={e => setRoleId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 transition appearance-none"
            >
              <option value="">Select a role…</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            {selectedRole && (
              <div className="mt-2 bg-slate-800/40 rounded-lg px-3 py-2 space-y-0.5">
                <p className="text-xs text-slate-400">{selectedRole.description ?? 'No description.'}</p>
                <p className="text-xs text-slate-600">{countPerms(selectedRole.permissions)} permissions granted</p>
              </div>
            )}
          </div>

          {/* Product Access */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-400 font-medium">
                Product Access
                <span className="text-slate-600 ml-1 font-normal">— select which products this user can access</span>
              </label>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs text-red-400 hover:text-red-300 transition shrink-0"
              >
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {PLANVIEW_PRODUCTS.map(({ name, icon }) => {
                const selected = products.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleProduct(name)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all text-left ${
                      selected
                        ? 'bg-red-600/15 border-red-600/40 text-red-300'
                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                    }`}
                  >
                    <span className="text-base shrink-0 select-none">{icon}</span>
                    <span className="truncate text-xs">{name}</span>
                    {selected && <Check size={12} className="ml-auto shrink-0 text-red-400" />}
                  </button>
                );
              })}
            </div>
            {products.length === 0 && (
              <p className="text-xs text-slate-600 mt-1.5 px-1">
                No products selected — user will have no product-level access.
              </p>
            )}
            {products.length > 0 && (
              <p className="text-xs text-slate-500 mt-1.5 px-1">
                {products.length} product{products.length > 1 ? 's' : ''} selected
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-800 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!email.trim() || !roleId || sending}
            className="flex-1 py-2 text-sm bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-medium rounded-lg transition flex items-center justify-center gap-2">
            {isChangeRole ? (
              'Save Changes'
            ) : sending ? (
              'Sending invite…'
            ) : (
              <><UserPlus size={14} /> Add User</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const { isLoading: authLoading, user } = db.useAuth();

  const { data } = db.useQuery({ roles: {}, userRoles: {}, auditLogs: {} });

  const roles: Role[]     = (data?.roles     as Role[])     ?? [];
  const userRoles: UserRole[] = (data?.userRoles as UserRole[]) ?? [];
  const auditLogs: AuditLog[] = (data?.auditLogs as AuditLog[]) ?? [];

  const [activeTab,        setActiveTab]        = useState<'roles' | 'users' | 'audit'>('roles');
  const [selectedRoleId,   setSelectedRoleId]   = useState<string | null>(null);
  const [search,           setSearch]           = useState('');
  const [showModal,        setShowModal]        = useState(false);
  const [editingRole,      setEditingRole]      = useState<Role | null>(null);
  const [showDeleteConfirm,setShowDeleteConfirm] = useState(false);
  const [showAssignModal,  setShowAssignModal]  = useState(false);
  const [editingUserRole,  setEditingUserRole]  = useState<UserRole | null>(null);
  const [seeded,           setSeeded]           = useState(false);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.replace('/');
  }, [authLoading, user, router]);

  // Seed default roles once
  useEffect(() => {
    if (!authLoading && user && !seeded && data && roles.length === 0) {
      setSeeded(true);
      const txns = DEFAULT_ROLES.map(r => {
        const newId = instantId();
        const now = Date.now();
        return db.tx.roles[newId].update({ ...r, createdAt: now, updatedAt: now });
      });
      db.transact(txns);
    }
  }, [authLoading, user, data, roles.length, seeded]);

  // Auto-select first role
  useEffect(() => {
    if (!selectedRoleId && roles.length > 0) setSelectedRoleId(roles[0].id);
  }, [roles, selectedRoleId]);

  const selectedRole = roles.find(r => r.id === selectedRoleId) ?? null;

  const filteredRoles = roles.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  // ── Mutations ────────────────────────────────────────────────────────────

  function saveRole(data: { name: string; description: string; permissions: Permissions }) {
    const now = Date.now();
    if (editingRole) {
      db.transact([
        db.tx.roles[editingRole.id].update({ ...data, updatedAt: now }),
        db.tx.auditLogs[instantId()].update({
          action: 'ROLE_UPDATED', roleName: data.name,
          performedBy: user?.email ?? 'unknown', timestamp: now,
        }),
      ]);
    } else {
      const newId = instantId();
      db.transact([
        db.tx.roles[newId].update({ ...data, isSystem: false, createdAt: now, updatedAt: now }),
        db.tx.auditLogs[instantId()].update({
          action: 'ROLE_CREATED', roleName: data.name,
          performedBy: user?.email ?? 'unknown', timestamp: now,
        }),
      ]);
      setSelectedRoleId(newId);
    }
    closeModal();
  }

  function deleteRole() {
    if (!selectedRole || selectedRole.isSystem) return;
    const now = Date.now();
    const affectedUserRoles = userRoles.filter(ur => ur.roleId === selectedRole.id);
    db.transact([
      db.tx.roles[selectedRole.id].delete(),
      ...affectedUserRoles.map(ur => db.tx.userRoles[ur.id].delete()),
      db.tx.auditLogs[instantId()].update({
        action: 'ROLE_DELETED', roleName: selectedRole.name,
        performedBy: user?.email ?? 'unknown', timestamp: now,
      }),
    ]);
    setSelectedRoleId(null);
    setShowDeleteConfirm(false);
  }

  function assignRole(email: string, roleId: string, roleName: string, products: string[]) {
    const now = Date.now();
    const existing = userRoles.find(ur => ur.email === email);
    if (existing) {
      db.transact([
        db.tx.userRoles[existing.id].update({ roleId, roleName, assignedAt: now, assignedBy: user?.email, products }),
        db.tx.auditLogs[instantId()].update({
          action: 'USER_ASSIGNED', targetEmail: email, roleName,
          performedBy: user?.email ?? 'unknown', timestamp: now,
        }),
      ]);
    } else {
      db.transact([
        db.tx.userRoles[instantId()].update({ email, roleId, roleName, assignedAt: now, assignedBy: user?.email, products }),
        db.tx.auditLogs[instantId()].update({
          action: 'USER_ASSIGNED', targetEmail: email, roleName,
          performedBy: user?.email ?? 'unknown', timestamp: now,
        }),
      ]);
    }
    // Modal handles its own close (new user goes to invite step, change role closes via onClose)
  }

  function closeModal() {
    setShowModal(false);
    setEditingRole(null);
  }

  function openEditModal(role: Role) {
    setEditingRole(role);
    setShowModal(true);
  }

  if (authLoading || !user) return null;

  // Admin if no users exist yet (bootstrap) or current user has Admin role
  const isAdmin =
    userRoles.length === 0 ||
    userRoles.some(ur => ur.email === user.email && ur.roleName === 'Admin');

  const sortedAuditLogs = [...auditLogs].sort((a, b) => b.timestamp - a.timestamp);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Page header */}
          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <span>Settings</span>
              <ChevronRight size={12} />
              <span>Security</span>
              <ChevronRight size={12} />
              <span className="text-slate-300">Access Control</span>
            </div>
            <h1 className="text-white text-xl font-semibold">Roles & Permissions</h1>
            <p className="text-slate-500 text-sm mt-0.5">Manage roles and control what each role can access.</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
            {([
              { key: 'roles', label: 'Roles & Permissions', Icon: Shield },
              { key: 'users', label: 'Users',               Icon: Users },
              { key: 'audit', label: 'Audit Log',           Icon: ClipboardList },
            ] as const).map(({ key, label, Icon }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === key
                    ? 'bg-slate-700 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}>
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          {/* ── Tab: Roles & Permissions ────────────────────────────────────── */}
          {activeTab === 'roles' && (
            <div className="flex gap-4 items-start">

              {/* Left panel — roles list */}
              <div className="w-64 shrink-0 space-y-3">
                {/* Top bar */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search roles…"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
                    />
                  </div>
                  <button
                    onClick={() => { setEditingRole(null); setShowModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg transition shrink-0">
                    <Plus size={13} />
                    Add
                  </button>
                </div>

                {/* Role cards */}
                <div className="space-y-1">
                  {filteredRoles.length === 0 && (
                    <p className="text-slate-600 text-xs px-2 py-4 text-center">No roles found.</p>
                  )}
                  {filteredRoles.map(role => {
                    const userCount = userRoles.filter(ur => ur.roleId === role.id).length;
                    const isSelected = role.id === selectedRoleId;
                    return (
                      <button key={role.id} onClick={() => setSelectedRoleId(role.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-red-600/10 border-red-600/25 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                        }`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{role.name}</span>
                          {role.isSystem && (
                            <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded shrink-0">System</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500 truncate">{role.description ?? 'No description'}</span>
                        </div>
                        <div className="mt-1.5">
                          <span className="text-xs text-slate-600">
                            {userCount} user{userCount !== 1 ? 's' : ''} · {countPerms(role.permissions)} permissions
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right panel — role detail */}
              <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl">
                {!selectedRole ? (
                  <div className="flex items-center justify-center h-64 text-slate-600 text-sm">
                    Select a role to view details
                  </div>
                ) : (
                  <>
                    {/* Role header */}
                    <div className="flex items-start justify-between px-6 py-5 border-b border-slate-800">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h2 className="text-white font-semibold text-base">{selectedRole.name}</h2>
                          {selectedRole.isSystem && (
                            <span className="flex items-center gap-1 text-[11px] text-slate-500 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full">
                              <Lock size={10} /> System
                            </span>
                          )}
                        </div>
                        <p className="text-slate-500 text-sm mt-0.5">
                          {selectedRole.description ?? 'No description'}
                        </p>
                        <p className="text-slate-600 text-xs mt-1">
                          {userRoles.filter(ur => ur.roleId === selectedRole.id).length} user(s) assigned ·{' '}
                          {countPerms(selectedRole.permissions)} permissions · Updated {formatTs(selectedRole.updatedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        <button onClick={() => openEditModal(selectedRole)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-lg border border-slate-700 transition">
                          <Edit2 size={12} /> Edit
                        </button>
                        {!selectedRole.isSystem && (
                          <button onClick={() => setShowDeleteConfirm(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 hover:text-red-300 text-xs font-medium rounded-lg border border-red-600/20 transition">
                            <Trash2 size={12} /> Delete
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Permissions matrix — readonly view */}
                    <div className="px-6 py-5">
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-4">Permissions Matrix</p>
                      <PermissionsMatrix
                        permissions={selectedRole.permissions}
                        readonly={true}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Tab: Users ──────────────────────────────────────────────────── */}
          {activeTab === 'users' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                <div>
                  <h2 className="text-white font-semibold text-sm">User Assignments</h2>
                  <p className="text-slate-500 text-xs mt-0.5">{userRoles.length} user{userRoles.length !== 1 ? 's' : ''} assigned</p>
                </div>
                {isAdmin && (
                  <button onClick={() => { setEditingUserRole(null); setShowAssignModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg transition">
                    <UserPlus size={13} /> Add User
                  </button>
                )}
              </div>

              {userRoles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Users size={32} className="text-slate-700 mb-3" />
                  <p className="text-slate-500 text-sm">No users assigned yet.</p>
                  {isAdmin && (
                    <p className="text-slate-600 text-xs mt-1">Click "Add User" to onboard a team member.</p>
                  )}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left px-6 py-3 text-xs text-slate-500 font-medium">Email</th>
                      <th className="text-left px-6 py-3 text-xs text-slate-500 font-medium">Role</th>
                      <th className="text-left px-6 py-3 text-xs text-slate-500 font-medium">Products</th>
                      <th className="text-left px-6 py-3 text-xs text-slate-500 font-medium">Assigned</th>
                      {isAdmin && (
                        <th className="text-left px-6 py-3 text-xs text-slate-500 font-medium">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {userRoles.map(ur => {
                      const assignedProducts: string[] = Array.isArray(ur.products) ? ur.products : [];
                      return (
                        <tr key={ur.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                          <td className="px-6 py-3 text-slate-200">{ur.email}</td>
                          <td className="px-6 py-3">
                            <span className="bg-red-600/10 text-red-400 border border-red-600/20 text-xs px-2 py-0.5 rounded-full">
                              {ur.roleName}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            {assignedProducts.length === 0 ? (
                              <span className="text-slate-700 text-xs">—</span>
                            ) : assignedProducts.length === PLANVIEW_PRODUCTS.length ? (
                              <span className="text-xs text-slate-400 italic">All products</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {assignedProducts.map(p => {
                                  const prod = PLANVIEW_PRODUCTS.find(x => x.name === p);
                                  return (
                                    <span key={p} className="inline-flex items-center gap-1 bg-slate-800 border border-slate-700 text-slate-300 text-xs px-1.5 py-0.5 rounded">
                                      <span className="text-xs">{prod?.icon}</span>
                                      {p}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-3 text-slate-500 text-xs">{formatTs(ur.assignedAt)}</td>
                          {isAdmin && (
                            <td className="px-6 py-3">
                              <button
                                onClick={() => { setEditingUserRole(ur); setShowAssignModal(true); }}
                                className="text-xs text-slate-500 hover:text-white transition">
                                Edit
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Tab: Audit Log ────────────────────────────────────────────── */}
          {activeTab === 'audit' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800">
                <h2 className="text-white font-semibold text-sm">Audit Log</h2>
                <p className="text-slate-500 text-xs mt-0.5">All role and permission changes are recorded here.</p>
              </div>

              {sortedAuditLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <ClipboardList size={32} className="text-slate-700 mb-3" />
                  <p className="text-slate-500 text-sm">No activity recorded yet.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left px-6 py-3 text-xs text-slate-500 font-medium">Action</th>
                      <th className="text-left px-6 py-3 text-xs text-slate-500 font-medium">Role</th>
                      <th className="text-left px-6 py-3 text-xs text-slate-500 font-medium">User</th>
                      <th className="text-left px-6 py-3 text-xs text-slate-500 font-medium">Performed By</th>
                      <th className="text-left px-6 py-3 text-xs text-slate-500 font-medium">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAuditLogs.map(log => (
                      <tr key={log.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                        <td className="px-6 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                            log.action === 'ROLE_DELETED'
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : log.action === 'ROLE_CREATED'
                              ? 'bg-green-500/10 text-green-400 border-green-500/20'
                              : 'bg-slate-700/50 text-slate-400 border-slate-700'
                          }`}>
                            {ACTION_LABELS[log.action] ?? log.action}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-slate-200">{log.roleName}</td>
                        <td className="px-6 py-3 text-slate-400 text-xs">{log.targetEmail ?? '—'}</td>
                        <td className="px-6 py-3 text-slate-400 text-xs">{log.performedBy}</td>
                        <td className="px-6 py-3 text-slate-500 text-xs">{formatTs(log.timestamp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {showModal && (
        <RoleModal
          role={editingRole}
          onClose={closeModal}
          onSave={saveRole}
        />
      )}
      {showDeleteConfirm && selectedRole && (
        <DeleteConfirm
          roleName={selectedRole.name}
          onConfirm={deleteRole}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
      {showAssignModal && isAdmin && (
        <OnboardUserModal
          roles={roles}
          existingEmail={editingUserRole?.email}
          existingRoleId={editingUserRole?.roleId}
          existingProducts={editingUserRole?.products}
          onClose={() => { setShowAssignModal(false); setEditingUserRole(null); }}
          onSave={assignRole}
        />
      )}
    </div>
  );
}
