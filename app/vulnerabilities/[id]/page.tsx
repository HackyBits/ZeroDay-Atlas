'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import db from '@/lib/instant';

// ─── Types ────────────────────────────────────────────────────────────────────

type ExploitAvailability = 'Yes' | 'No' | 'Unknown';
type VulnStatus = 'Open' | 'In Progress' | 'Remediated' | 'Pending Verification' | 'Closed';

interface EditForm {
  title:               string;
  cveId:               string;
  description:         string;
  dateDiscovered:      string;
  exploitAvailability: ExploitAvailability | '';
  source:              string;
  isZeroDay:           boolean;
  status:              VulnStatus | '';
}

type Attachment = { name: string; size: number; type: string; dataUrl?: string };

// ─── Style maps ───────────────────────────────────────────────────────────────

const EXPLOIT_STYLE: Record<string, string> = {
  Yes:     'bg-red-500/10 text-red-400 border-red-500/30',
  No:      'bg-green-500/10 text-green-400 border-green-500/30',
  Unknown: 'bg-slate-700 text-slate-400 border-slate-600',
};

const STATUS_STYLE: Record<string, string> = {
  Open:                   'bg-red-500/10 text-red-400 border-red-500/30',
  'In Progress':          'bg-blue-500/10 text-blue-400 border-blue-500/30',
  Remediated:             'bg-green-500/10 text-green-400 border-green-500/30',
  'Pending Verification': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  Closed:                 'bg-slate-700 text-slate-400 border-slate-600',
};

// ─── Small shared components ──────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <div className="text-slate-200 text-sm">{children}</div>
    </div>
  );
}

const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition';
const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5';

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VulnerabilityDetailPage() {
  const router = useRouter();
  const { id: vulnId } = useParams<{ id: string }>();

  const { isLoading: authLoading, user } = db.useAuth();
  const { data } = db.useQuery({ vulnerabilities: { $: { where: { id: vulnId } } } });

  const [isEditing, setIsEditing] = useState(false);
  const [form,      setForm]      = useState<EditForm | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [authLoading, user, router]);

  const vuln = data?.vulnerabilities?.[0];

  // Hydrate form when entering edit mode
  function startEdit() {
    if (!vuln) return;
    setForm({
      title:               (vuln.title               as string)              ?? '',
      cveId:               (vuln.cveId               as string)              ?? '',
      description:         (vuln.description         as string)              ?? '',
      dateDiscovered:      (vuln.dateDiscovered       as string)              ?? '',
      exploitAvailability: (vuln.exploitAvailability  as ExploitAvailability) ?? '',
      source:              (vuln.source               as string)              ?? '',
      isZeroDay:           (vuln.isZeroDay            as boolean)             ?? false,
      status:              (vuln.status               as VulnStatus)          ?? 'Open',
    });
    setAttachments((vuln.attachments as Attachment[] | null) ?? []);
    setSaved(false);
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
    setForm(null);
    setSaved(false);
  }

  function setField<K extends keyof EditForm>(key: K, val: EditForm[K]) {
    setForm((prev) => prev ? { ...prev, [key]: val } : prev);
    setSaved(false);
  }

  function handleFileAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setAttachments((prev) => [...prev, { name: f.name, size: f.size, type: f.type, dataUrl }]);
        setSaved(false);
      };
      reader.readAsDataURL(f);
    });
    e.target.value = '';
  }

  function downloadAttachment(file: Attachment) {
    if (!file.dataUrl) return;
    const a = document.createElement('a');
    a.href = file.dataUrl;
    a.download = file.name;
    a.click();
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    try {
      const vuln = data?.vulnerabilities?.[0];
      const prevStatus = vuln?.status as string | undefined;
      const newStatus  = form.status || 'Open';
      const remediatedAt =
        newStatus === 'Remediated' && prevStatus !== 'Remediated'
          ? Date.now()
          : newStatus !== 'Remediated'
          ? null
          : undefined; // keep existing value if already Remediated

      const updatePayload: Record<string, unknown> = {
        title:               form.title,
        cveId:               form.cveId,
        description:         form.description,
        dateDiscovered:      form.dateDiscovered,
        exploitAvailability: form.exploitAvailability,
        source:              form.source,
        isZeroDay:           form.isZeroDay,
        status:              newStatus,
        attachments,
      };
      if (remediatedAt !== undefined) updatePayload.remediatedAt = remediatedAt;

      await db.transact(db.tx.vulnerabilities[vulnId].update(updatePayload));
      setSaved(true);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !user) return <Spinner />;
  if (!vuln) return <Spinner />;

  const currentAttachments = (vuln.attachments as Attachment[] | null) ?? [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-56 border-r border-slate-800 flex flex-col px-4 py-6 gap-1 shrink-0">
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="w-7 h-7 bg-red-600 rounded flex items-center justify-center text-white font-bold text-xs">ZA</div>
          <span className="font-semibold text-white text-sm">Zero-Day Atlas</span>
        </div>
        {[
          { label: 'Dashboard',       href: '/dashboard',       icon: '◉' },
          { label: 'Vulnerabilities', href: '/vulnerabilities', icon: '⚠', active: true },
          { label: 'Products',        href: '/products',        icon: '⬡' },
          { label: 'Reports',         href: '/reports',         icon: '📊' },
          { label: 'Settings',        href: '/settings',        icon: '⚙' },
        ].map((item) => (
          <Link key={item.label} href={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
              item.active ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}>
            <span className="text-base">{item.icon}</span>{item.label}
          </Link>
        ))}
        <div className="mt-auto pt-6 border-t border-slate-800">
          <button onClick={() => db.auth.signOut()}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 transition">
            <span>↩</span> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-3xl mx-auto">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm mb-6">
            <Link href="/vulnerabilities" className="text-slate-400 hover:text-white transition">Vulnerabilities</Link>
            <span className="text-slate-700">/</span>
            <span className="text-slate-300 font-mono text-xs">{vuln.vulnerabilityId as string}</span>
          </div>

          {/* Header card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="font-mono text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    {vuln.vulnerabilityId as string}
                  </span>
                  {vuln.cveId && (
                    <span className="font-mono text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {vuln.cveId as string}
                    </span>
                  )}
                  {vuln.isZeroDay && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />Zero-Day
                    </span>
                  )}
                </div>
                <h1 className="text-xl font-bold text-white leading-snug">{vuln.title as string}</h1>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs px-3 py-1 rounded-full border font-medium ${
                  STATUS_STYLE[vuln.status as string] ?? 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {(vuln.status as string) ?? 'Open'}
                </span>
                {!isEditing && (
                  <button onClick={startEdit}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:text-white hover:border-slate-400 transition flex items-center gap-1.5">
                    ✎ Edit
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 pt-4 border-t border-slate-800 flex-wrap text-xs text-slate-400">
              <span>Discovered: <span className="text-white">{vuln.dateDiscovered as string}</span></span>
              <span>Source: <span className="text-white">{(vuln.source as string) || '—'}</span></span>
              <span>Logged by: <span className="text-white">{(vuln.createdBy as string) || 'Unknown'}</span></span>
              {saved && <span className="text-green-400 font-medium">✓ Saved</span>}
            </div>
          </div>

          {/* ── VIEW MODE ──────────────────────────────────────────────────────── */}
          {!isEditing && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-5">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Description</p>
                  <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">
                    {(vuln.description as string) || 'No description provided.'}
                  </p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                    Attachments {currentAttachments.length > 0 && <span className="text-slate-400 normal-case">({currentAttachments.length})</span>}
                  </p>
                  {currentAttachments.length === 0 ? (
                    <p className="text-slate-600 text-sm">No attachments uploaded.</p>
                  ) : (
                    <div className="space-y-2">
                      {currentAttachments.map((file, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg">
                          <span className="text-slate-400 text-lg">📎</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-white text-sm truncate">{file.name}</p>
                            <p className="text-slate-500 text-xs mt-0.5">
                              {file.type || 'Unknown type'} · {file.size ? `${(file.size / 1024).toFixed(1)} KB` : '—'}
                            </p>
                          </div>
                          {file.dataUrl && (
                            <button onClick={() => downloadAttachment(file)}
                              className="text-xs px-2.5 py-1 rounded border border-slate-600 text-slate-400 hover:text-white hover:border-slate-400 transition shrink-0">
                              ↓ Download
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-5">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Details</p>
                  <Field label="Source">{(vuln.source as string) || '—'}</Field>
                  <Field label="Exploit Availability">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${EXPLOIT_STYLE[(vuln.exploitAvailability as string)] ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                      {(vuln.exploitAvailability as string) || 'Unknown'}
                    </span>
                  </Field>
                  <Field label="Date Discovered">{(vuln.dateDiscovered as string) || '—'}</Field>
                  <Field label="Zero-Day">
                    {vuln.isZeroDay ? <span className="text-red-400">Yes</span> : <span className="text-slate-400">No</span>}
                  </Field>
                  <Field label="CVE ID">{(vuln.cveId as string) || 'Not assigned'}</Field>
                  <Field label="Status">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[vuln.status as string] ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                      {(vuln.status as string) || 'Open'}
                    </span>
                  </Field>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Actions</p>
                  <Link href={`/impact-assessment/${vulnId}`}
                    className="block w-full text-center text-sm bg-red-600 hover:bg-red-500 text-white font-medium py-2.5 rounded-lg transition">
                    Start Impact Assessment →
                  </Link>
                  <Link href="/vulnerabilities"
                    className="block w-full text-center text-sm border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-lg transition">
                    ← Back to Vulnerabilities
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* ── EDIT MODE ──────────────────────────────────────────────────────── */}
          {isEditing && form && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-5">

                {/* Title */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                  <div>
                    <label className={labelCls}>Title <span className="text-red-500">*</span></label>
                    <input type="text" value={form.title}
                      onChange={(e) => setField('title', e.target.value)}
                      className={inputCls} placeholder="Vulnerability title…" />
                  </div>
                  <div>
                    <label className={labelCls}>CVE ID</label>
                    <input type="text" value={form.cveId}
                      onChange={(e) => setField('cveId', e.target.value)}
                      className={inputCls} placeholder="CVE-2024-XXXXX" />
                  </div>
                </div>

                {/* Description */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <label className={labelCls}>Description <span className="text-red-500">*</span></label>
                  <textarea value={form.description} rows={6}
                    onChange={(e) => setField('description', e.target.value)}
                    className={`${inputCls} resize-none`}
                    placeholder="Describe the vulnerability, its attack vector, and potential impact…" />
                </div>

                {/* Attachments */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Attachments {attachments.length > 0 && <span className="text-slate-400 normal-case">({attachments.length})</span>}
                    </p>
                    <label className="cursor-pointer text-xs px-3 py-1.5 rounded-lg border border-dashed border-slate-600 text-slate-400 hover:text-white hover:border-slate-400 transition flex items-center gap-1.5">
                      <span>+</span> Add Files
                      <input type="file" multiple className="hidden" onChange={handleFileAdd} />
                    </label>
                  </div>
                  {attachments.length === 0 ? (
                    <p className="text-slate-600 text-sm text-center py-4">No attachments. Click "Add Files" to upload.</p>
                  ) : (
                    <div className="space-y-2">
                      {attachments.map((file, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg">
                          <span className="text-slate-400 text-lg">📎</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-white text-sm truncate">{file.name}</p>
                            <p className="text-slate-500 text-xs mt-0.5">
                              {file.type || 'Unknown type'} · {file.size ? `${(file.size / 1024).toFixed(1)} KB` : '—'}
                            </p>
                          </div>
                          {file.dataUrl && (
                            <button onClick={() => downloadAttachment(file)}
                              className="text-xs px-2.5 py-1 rounded border border-slate-600 text-slate-400 hover:text-white hover:border-slate-400 transition shrink-0">
                              ↓ Download
                            </button>
                          )}
                          <button onClick={() => removeAttachment(i)}
                            className="text-slate-500 hover:text-red-400 transition text-lg shrink-0 px-1">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: fields + save */}
              <div className="space-y-5">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Details</p>

                  <div>
                    <label className={labelCls}>Source</label>
                    <select value={form.source} onChange={(e) => setField('source', e.target.value)}
                      className={inputCls}>
                      <option value="">Select source…</option>
                      {['Internal Report','CVE Feed','Vendor Advisory','Bug Bounty','Penetration Test'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelCls}>Exploit Availability</label>
                    <select value={form.exploitAvailability}
                      onChange={(e) => setField('exploitAvailability', e.target.value as ExploitAvailability)}
                      className={inputCls}>
                      <option value="">Select…</option>
                      {['Yes','No','Unknown'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelCls}>Date Discovered</label>
                    <input type="date" value={form.dateDiscovered}
                      onChange={(e) => setField('dateDiscovered', e.target.value)}
                      className={inputCls} />
                  </div>

                  <div>
                    <label className={labelCls}>Status</label>
                    <select value={form.status} onChange={(e) => setField('status', e.target.value as VulnStatus)}
                      className={inputCls}>
                      {['Open','In Progress','Remediated','Pending Verification','Closed'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <button onClick={() => setField('isZeroDay', !form.isZeroDay)}
                      className={`relative w-11 h-6 rounded-full transition ${form.isZeroDay ? 'bg-red-600' : 'bg-slate-700'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isZeroDay ? 'translate-x-5' : ''}`} />
                    </button>
                    <span className="text-sm text-slate-300">Zero-Day</span>
                    {form.isZeroDay && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400">Yes</span>
                    )}
                  </div>
                </div>

                {/* Save / Cancel */}
                <button onClick={handleSave} disabled={saving || !form.title}
                  className="w-full py-3 text-sm font-medium rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-40 bg-red-600 hover:bg-red-500 text-white">
                  {saving
                    ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                    : '✓ Save Changes'}
                </button>
                <button onClick={cancelEdit}
                  className="w-full py-2.5 text-sm rounded-xl border border-slate-700 text-slate-400 hover:text-white transition">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
