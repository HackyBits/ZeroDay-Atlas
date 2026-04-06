'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { id as instantId } from '@instantdb/react';
import db from '@/lib/instant';
import Sidebar from '@/app/components/Sidebar';

// ─── Types ────────────────────────────────────────────────────────────────────

type RemPlan   = 'Patch' | 'Code Fix' | 'Package Fix' | 'Config Change' | 'Workaround';
type RemStatus = 'In Progress' | 'Blocked' | 'Ready for Dev Review' | 'Done';

interface RemForm {
  remediationPlan:  RemPlan;
  patchAvailable:   boolean;
  etaForFix:        string;
  remediationOwner: string;
  status:           RemStatus;
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<RemStatus, string> = {
  'In Progress':      'bg-blue-500/10 border-blue-500/40 text-blue-400',
  'Blocked':          'bg-red-500/10 border-red-500/40 text-red-400',
  'Ready for Dev Review': 'bg-yellow-500/10 border-yellow-500/40 text-yellow-400',
  'Done':             'bg-green-500/10 border-green-500/40 text-green-400',
};

const SEVERITY_STYLE: Record<string, string> = {
  Critical: 'bg-red-500/10 border-red-500/40 text-red-400',
  High:     'bg-orange-500/10 border-orange-500/40 text-orange-400',
  Medium:   'bg-yellow-500/10 border-yellow-500/40 text-yellow-400',
  Low:      'bg-blue-500/10 border-blue-500/40 text-blue-400',
};

// ─── Small shared components ──────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function SectionCard({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="mb-5">
        <h3 className="text-white font-semibold text-sm">{title}</h3>
        {desc && <p className="text-slate-400 text-xs mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function OptionButton({ label, selected, activeClass, onClick }: {
  label: string; selected: boolean; activeClass: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`py-2.5 px-3 text-sm font-medium rounded-lg border-2 transition text-center ${
        selected ? activeClass : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
      }`}>
      {label}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProductRemediationPage() {
  const router = useRouter();
  const { id: vulnInstantId, productName: encodedName } = useParams<{ id: string; productName: string }>();
  const productName = decodeURIComponent(encodedName);

  const { isLoading: authLoading, user } = db.useAuth();
  const { data: vulnData }   = db.useQuery({ vulnerabilities: { $: { where: { id: vulnInstantId } } } });
  const { data: triageData } = db.useQuery({ productTriages:  { $: { where: { vulnerabilityRef: vulnInstantId, productName } } } });
  const { data: remData }    = db.useQuery({ remediations:    { $: { where: { vulnerabilityRef: vulnInstantId, productName } } } });

  const [resolvedAt, setResolvedAt] = useState<number | null>(null);

  const [form, setForm] = useState<RemForm>({
    remediationPlan:  'Patch',
    patchAvailable:   false,
    etaForFix:        '',
    remediationOwner: '',
    status:           'In Progress',
  });
  const [saved,  setSaved]  = useState(false);
  const [saving, setSaving] = useState(false);

  // Hydrate from existing record
  useEffect(() => {
    const existing = remData?.remediations?.[0];
    if (!existing) return;
    setForm({
      remediationPlan:  (existing.remediationPlan  as RemPlan)   ?? 'Patch',
      patchAvailable:   (existing.patchAvailable   as boolean)   ?? false,
      etaForFix:        (existing.etaForFix        as string)    ?? '',
      remediationOwner: (existing.remediationOwner as string)    ?? '',
      status:           (existing.status           as RemStatus) ?? 'In Progress',
    });
    setResolvedAt((existing.resolvedAt as number | null) ?? null);
    setSaved(true);
  }, [remData]);

  // Pre-fill owner from triage if no record yet
  useEffect(() => {
    const triage = triageData?.productTriages?.[0];
    if (triage?.assignedOwner && !remData?.remediations?.[0]) {
      setForm((prev) => ({ ...prev, remediationOwner: (triage.assignedOwner as string) ?? '' }));
    }
  }, [triageData, remData]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [authLoading, user, router]);

  if (authLoading || !user) return <Spinner />;
  const vuln     = vulnData?.vulnerabilities?.[0];
  const triage   = triageData?.productTriages?.[0];
  const existing = remData?.remediations?.[0];
  if (!vuln) return <Spinner />;

  function set<K extends keyof RemForm>(key: K, val: RemForm[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const rid = existing ? (existing as { id: string }).id : instantId();
      // Capture resolvedAt when status first becomes Done; clear if reverted
      const newResolvedAt = form.status === 'Done'
        ? (resolvedAt ?? Date.now())
        : null;
      await db.transact(
        db.tx.remediations[rid].update({
          vulnerabilityRef:  vulnInstantId,
          productName,
          remediationPlan:   form.remediationPlan,
          patchAvailable:    form.patchAvailable,
          etaForFix:         form.etaForFix,
          remediationOwner:  form.remediationOwner,
          status:            form.status,
          resolvedAt:        newResolvedAt ?? undefined,
          updatedAt:         Date.now(),
          createdAt:         existing ? (existing.createdAt as number) : Date.now(),
        })
      );
      setResolvedAt(newResolvedAt);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const slaDeadline = triage?.slaDeadline as string | undefined;
  const slaLabel    = triage?.slaHours === 0
    ? 'Best effort'
    : slaDeadline
      ? new Date(slaDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '—';
  const slaOverdue = slaDeadline && new Date(slaDeadline) < new Date();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar />

      {/* Main */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm mb-6 flex-wrap">
            <Link href="/dashboard"                                                    className="text-slate-400 hover:text-white transition">Dashboard</Link>
            <span className="text-slate-700">/</span>
            <Link href={`/impact-assessment/${vulnInstantId}`}                        className="text-slate-400 hover:text-white transition">Impact Assessment</Link>
            <span className="text-slate-700">/</span>
            <Link href={`/impact-assessment/${vulnInstantId}/product/${encodedName}`} className="text-slate-400 hover:text-white transition">{productName}</Link>
            <span className="text-slate-700">/</span>
            <Link href={`/triage/${vulnInstantId}/product/${encodedName}`}            className="text-slate-400 hover:text-white transition">Triage</Link>
            <span className="text-slate-700">/</span>
            <span className="text-slate-300">Remediation</span>
          </div>

          {/* Page title */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Remediation — {productName}</h1>
            <p className="text-slate-400 text-sm mt-1">Define the fix plan and ownership for this product.</p>
          </div>

          {/* Vulnerability + product header */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-8">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-slate-400 font-mono text-xs">{vuln.vulnerabilityId as string}</span>
                  {vuln.cveId && <span className="text-slate-500 text-xs">{vuln.cveId as string}</span>}
                  {vuln.isZeroDay && (
                    <span className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />Zero-Day
                    </span>
                  )}
                </div>
                <h2 className="text-white font-semibold text-base">{vuln.title as string}</h2>
              </div>
              <span className={`shrink-0 text-xs px-3 py-1 rounded-full border ${STATUS_STYLE[form.status]}`}>
                {form.status}
              </span>
            </div>
            <div className="flex items-center gap-3 pt-3 border-t border-slate-800 flex-wrap">
              <span className="text-xs text-slate-500">Product</span>
              <span className="text-white font-semibold text-sm">{productName}</span>
              {triage?.severity && (
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${SEVERITY_STYLE[triage.severity as string] ?? ''}`}>
                  {triage.severity as string}
                </span>
              )}
              {triage?.priority && (
                <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-700 border-slate-600 text-slate-300">
                  {triage.priority as string}
                </span>
              )}
              {triage?.assignedTeam && (
                <span className="text-xs text-slate-400">Team: {triage.assignedTeam as string}</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── Left: form ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Remediation Plan */}
              <SectionCard title="Remediation Plan" desc="How will this vulnerability be fixed?">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(['Patch', 'Code Fix', 'Package Fix', 'Config Change', 'Workaround'] as RemPlan[]).map((plan) => (
                    <OptionButton key={plan} label={plan} selected={form.remediationPlan === plan}
                      activeClass="bg-orange-500/10 border-orange-500/50 text-orange-400"
                      onClick={() => set('remediationPlan', plan)} />
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <button onClick={() => set('patchAvailable', !form.patchAvailable)}
                    className={`relative w-11 h-6 rounded-full transition ${form.patchAvailable ? 'bg-orange-500' : 'bg-slate-700'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.patchAvailable ? 'translate-x-5' : ''}`} />
                  </button>
                  <span className="text-sm text-slate-300">Patch available now</span>
                  {form.patchAvailable && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-400">Yes</span>
                  )}
                </div>
              </SectionCard>

              {/* ETA + Owner */}
              <div className="grid sm:grid-cols-2 gap-5">
                <SectionCard title="ETA for Fix" desc="Target date for completing the fix.">
                  <input type="date" value={form.etaForFix}
                    onChange={(e) => set('etaForFix', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition" />
                  {form.etaForFix && (
                    <p className="mt-2 text-xs text-slate-400">
                      {new Date(form.etaForFix).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </SectionCard>

                <SectionCard title="Remediation Owner" desc="Engineer responsible for the fix.">
                  <input type="text" value={form.remediationOwner}
                    onChange={(e) => set('remediationOwner', e.target.value)}
                    placeholder="Name or email…"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition" />
                </SectionCard>
              </div>

              {/* Lifecycle hint */}
              <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="text-orange-400 font-medium">Remediation</span>
                  <span>→</span>
                  <span className="text-slate-400">Verification</span>
                  <span>→</span>
                  <span className="text-slate-500">Closure</span>
                </div>
                <p className="ml-auto text-xs text-slate-500">
                  {form.status === 'Done' ? 'Verification unlocked ✓' : 'Set status to Done to unlock Verification'}
                </p>
              </div>

              {/* Resolved date (shown when Done) */}
              {form.status === 'Done' && resolvedAt && (
                <div className="bg-green-500/5 border border-green-500/20 rounded-xl px-5 py-3 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Resolved on</span>
                  <span className="text-xs font-medium text-green-400">
                    {new Date(resolvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              )}
            </div>

            {/* ── Right: Status + SLA ── */}
            <div className="space-y-5">

              {/* Status */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-white font-semibold text-sm mb-4">Remediation Status</h3>
                <div className="space-y-2">
                  {(['In Progress', 'Blocked', 'Ready for Dev Review', 'Done'] as RemStatus[]).map((s) => (
                    <button key={s} onClick={() => set('status', s)}
                      className={`w-full text-left px-4 py-3 rounded-lg border-2 text-sm font-medium transition ${
                        form.status === s ? STATUS_STYLE[s] : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                      }`}>
                      {s === 'In Progress'      && '⟳ '}
                      {s === 'Blocked'          && '⊘ '}
                      {s === 'Ready for Dev Review' && '◎ '}
                      {s === 'Done'             && '✓ '}
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* SLA from triage */}
              {triage && (
                <div className={`bg-slate-900 rounded-xl border p-5 space-y-3 ${slaOverdue ? 'border-red-500/40' : 'border-slate-800'}`}>
                  <h3 className="text-white font-semibold text-sm">SLA from Triage</h3>
                  <div className={`text-center p-3 rounded-lg border ${SEVERITY_STYLE[triage.severity as string] ?? 'border-slate-700 text-slate-300'}`}>
                    <p className="text-lg font-bold">{triage.severity as string}</p>
                    <p className="text-xs opacity-70 mt-0.5">Severity</p>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">SLA Window</span>
                      <span className="text-white">{triage.slaHours === 0 ? 'Best effort' : triage.slaHours + 'h'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Deadline</span>
                      <span className={slaOverdue ? 'text-red-400 font-medium' : 'text-white'}>
                        {triage.slaHours === 0 ? 'Best effort' : slaLabel}{slaOverdue && ' ⚠'}
                      </span>
                    </div>
                    {triage.assignedOwner && (
                      <div className="flex justify-between py-1 border-b border-slate-800">
                        <span className="text-slate-400">Assigned</span>
                        <span className="text-white">{triage.assignedOwner as string}</span>
                      </div>
                    )}
                    {triage.assignedTeam && (
                      <div className="flex justify-between py-1">
                        <span className="text-slate-400">Team</span>
                        <span className="text-white">{triage.assignedTeam as string}</span>
                      </div>
                    )}
                  </div>
                  {slaOverdue && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-center">
                      SLA deadline has passed
                    </p>
                  )}
                </div>
              )}

              {/* Save */}
              <button onClick={handleSave} disabled={saving}
                className="w-full py-3 text-sm font-medium rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-40 bg-orange-600 hover:bg-orange-500 text-white">
                {saving
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                  : saved ? '✓ Saved' : 'Save Remediation'}
              </button>

              {/* Post-save nav */}
              {saved && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center space-y-3">
                  <p className="text-green-400 text-sm font-semibold">✓ Remediation saved</p>
                  {form.status === 'Done' && (
                    <Link href={`/verification/${vulnInstantId}/product/${encodedName}`}
                      className="block w-full text-center text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition">
                      Next: Verification →
                    </Link>
                  )}
                  <Link href={`/triage/${vulnInstantId}/product/${encodedName}`}
                    className="block w-full text-center text-sm border border-slate-600 text-slate-300 hover:text-white py-2.5 rounded-lg transition">
                    ← Back to Triage
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
