'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import db from '@/lib/instant';
import Sidebar from '@/app/components/Sidebar';

// ─── Types ────────────────────────────────────────────────────────────────────

type VerifyMethod = 'Scan' | 'Manual Validation';
type VerifyStatus = 'Pending' | 'Verified' | 'Failed' | "Can't Verify";

interface VerifyForm {
  verificationMethod: VerifyMethod;
  verificationDate:   string;
  verificationStatus: VerifyStatus;
  notes:              string;
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const VERIFY_STATUS_CONFIG: Record<VerifyStatus, { style: string; icon: string; label: string; desc: string }> = {
  Pending:  { style: 'bg-slate-800 border-slate-600 text-slate-200',         icon: '○', label: 'Pending',  desc: 'Verification not yet started'     },
  Verified: { style: 'bg-green-500/10 border-green-500/50 text-green-400',   icon: '✓', label: 'Verified', desc: 'Fix confirmed, vulnerability closed' },
  Failed:        { style: 'bg-red-500/10 border-red-500/40 text-red-400',           icon: '✕', label: 'Failed',        desc: 'Fix did not resolve the issue'        },
  "Can't Verify": { style: 'bg-slate-600/20 border-slate-500/40 text-slate-300',    icon: '?', label: "Can't Verify",  desc: 'Unable to verify — blocked or no access' },
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
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
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

export default function ProductVerificationPage() {
  const router = useRouter();
  const { id: vulnInstantId, productName: encodedName } = useParams<{ id: string; productName: string }>();
  const productName = decodeURIComponent(encodedName);

  const { isLoading: authLoading, user } = db.useAuth();
  const { data: vulnData }   = db.useQuery({ vulnerabilities: { $: { where: { id: vulnInstantId } } } });
  const { data: triageData } = db.useQuery({ productTriages:  { $: { where: { vulnerabilityRef: vulnInstantId, productName } } } });
  const { data: remData }    = db.useQuery({ remediations:    { $: { where: { vulnerabilityRef: vulnInstantId, productName } } } });

  const [form, setForm] = useState<VerifyForm>({
    verificationMethod: 'Scan',
    verificationDate:   '',
    verificationStatus: 'Pending',
    notes:              '',
  });
  const [saved,  setSaved]  = useState(false);
  const [saving, setSaving] = useState(false);

  // Hydrate verification fields from the shared remediations record
  useEffect(() => {
    const existing = remData?.remediations?.[0];
    if (!existing) return;
    setForm({
      verificationMethod: (existing.verificationMethod as VerifyMethod) ?? 'Scan',
      verificationDate:   (existing.verificationDate   as string)       ?? '',
      verificationStatus: (existing.verificationStatus as VerifyStatus) ?? 'Pending',
      notes:              (existing.notes              as string)       ?? '',
    });
    if ((existing.verificationStatus as string) && (existing.verificationStatus as string) !== '') {
      setSaved(true);
    }
  }, [remData]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [authLoading, user, router]);

  if (authLoading || !user) return <Spinner />;
  const vuln     = vulnData?.vulnerabilities?.[0];
  const triage   = triageData?.productTriages?.[0];
  const existing = remData?.remediations?.[0];
  if (!vuln) return <Spinner />;

  function set<K extends keyof VerifyForm>(key: K, val: VerifyForm[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  }

  async function handleSave() {
    if (!existing) return; // must save remediation first
    setSaving(true);
    try {
      const rid = (existing as { id: string }).id;
      await db.transact(
        db.tx.remediations[rid].update({
          verificationMethod: form.verificationMethod,
          verificationDate:   form.verificationDate,
          verificationStatus: form.verificationStatus,
          notes:              form.notes,
          updatedAt:          Date.now(),
        })
      );
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const hasRemediation = !!existing;
  const verifyStatus   = form.verificationStatus;

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
            <Link href={`/remediation/${vulnInstantId}/product/${encodedName}`}       className="text-slate-400 hover:text-white transition">Remediation</Link>
            <span className="text-slate-700">/</span>
            <span className="text-slate-300">Verification</span>
          </div>

          {/* Page title */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Verification — {productName}</h1>
            <p className="text-slate-400 text-sm mt-1">Validate the fix and confirm the vulnerability is resolved.</p>
          </div>

          {/* No remediation record guard */}
          {!hasRemediation && (
            <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-6 mb-8 text-center">
              <p className="text-orange-400 font-medium text-sm mb-1">Remediation not yet saved</p>
              <p className="text-slate-400 text-xs mb-4">Complete the Remediation step before recording verification.</p>
              <Link href={`/remediation/${vulnInstantId}/product/${encodedName}`}
                className="inline-block text-sm bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg transition">
                ← Go to Remediation
              </Link>
            </div>
          )}

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
              {/* Current verification status badge */}
              <span className={`shrink-0 text-xs px-3 py-1 rounded-full border font-medium ${VERIFY_STATUS_CONFIG[verifyStatus].style}`}>
                {VERIFY_STATUS_CONFIG[verifyStatus].icon} {verifyStatus}
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
              {existing?.remediationPlan && (
                <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-700 border-slate-600 text-slate-300">
                  Plan: {existing.remediationPlan as string}
                </span>
              )}
              {existing?.etaForFix && (
                <span className="text-xs text-slate-400">
                  ETA: {new Date(existing.etaForFix as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── Left: form ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Verification Method */}
              <SectionCard title="Verification Method" desc="How will the fix be tested and confirmed?">
                <div className="grid grid-cols-2 gap-3">
                  {(['Scan', 'Manual Validation'] as VerifyMethod[]).map((m) => (
                    <OptionButton key={m} label={m} selected={form.verificationMethod === m}
                      activeClass="bg-blue-500/10 border-blue-500/50 text-blue-400"
                      onClick={() => set('verificationMethod', m)} />
                  ))}
                </div>
              </SectionCard>

              {/* Verification Date */}
              <SectionCard title="Verification Date" desc="When was or will the verification be performed?">
                <input type="date" value={form.verificationDate}
                  onChange={(e) => set('verificationDate', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition" />
                {form.verificationDate && (
                  <p className="mt-2 text-xs text-slate-400">
                    {new Date(form.verificationDate).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </SectionCard>

              {/* Notes */}
              <SectionCard title="Verification Notes" desc="Test results, evidence, root cause, or lessons learned.">
                <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={5}
                  placeholder="Describe what was tested, evidence found, any failed attempts, root cause analysis, or lessons learned…"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none" />
              </SectionCard>
            </div>

            {/* ── Right: Verification Status + actions ── */}
            <div className="space-y-5">

              {/* Verification Status — prominent selector */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-white font-semibold text-sm mb-1">Verification Status</h3>
                <p className="text-slate-400 text-xs mb-4">Select the outcome of this verification.</p>
                <div className="space-y-3">
                  {(['Pending', 'Verified', 'Failed', "Can't Verify"] as VerifyStatus[]).map((vs) => {
                    const cfg = VERIFY_STATUS_CONFIG[vs];
                    return (
                      <button key={vs} onClick={() => set('verificationStatus', vs)}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition ${
                          form.verificationStatus === vs ? cfg.style : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                        }`}>
                        <span className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold shrink-0 ${
                          form.verificationStatus === vs ? 'border-current' : 'border-slate-600 text-slate-500'
                        }`}>{cfg.icon}</span>
                        <div>
                          <p className={`text-sm font-semibold ${form.verificationStatus === vs ? '' : 'text-slate-300'}`}>{cfg.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{cfg.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Outcome hint */}
                {form.verificationStatus === 'Failed' && (
                  <div className="mt-4 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2.5 text-xs text-red-400">
                    ⚠ Failed verification will reopen the task for remediation.
                  </div>
                )}
                {form.verificationStatus === 'Verified' && (
                  <div className="mt-4 bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2.5 text-xs text-green-400">
                    ✓ Verified — this product can be moved to Closure.
                  </div>
                )}
                {form.verificationStatus === "Can't Verify" && (
                  <div className="mt-4 bg-slate-700/30 border border-slate-600/40 rounded-lg px-3 py-2.5 text-xs text-slate-300">
                    ? Unable to verify — document the blocker in the notes.
                  </div>
                )}
              </div>

              {/* Remediation summary */}
              {existing && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2 text-xs">
                  <h3 className="text-white font-semibold text-sm mb-3">Remediation Summary</h3>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Plan</span>
                    <span className="text-white">{existing.remediationPlan as string}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Patch Available</span>
                    <span className={existing.patchAvailable ? 'text-green-400' : 'text-slate-300'}>
                      {existing.patchAvailable ? 'Yes' : 'No'}
                    </span>
                  </div>
                  {existing.etaForFix && (
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">ETA</span>
                      <span className="text-white">
                        {new Date(existing.etaForFix as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Owner</span>
                    <span className="text-white">{(existing.remediationOwner as string) || '—'}</span>
                  </div>
                </div>
              )}

              {/* Save */}
              <button onClick={handleSave} disabled={saving || !hasRemediation}
                className="w-full py-3 text-sm font-medium rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-500 text-white">
                {saving
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                  : saved ? '✓ Saved' : 'Save Verification'}
              </button>

              {/* Post-save nav */}
              {saved && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center space-y-3">
                  <p className={`font-semibold text-sm ${
                    verifyStatus === 'Verified'     ? 'text-green-400'
                    : verifyStatus === 'Failed'      ? 'text-red-400'
                    : verifyStatus === "Can't Verify" ? 'text-slate-300'
                    : 'text-slate-400'
                  }`}>
                    {verifyStatus === 'Verified'      && '✓ Verification complete'}
                    {verifyStatus === 'Failed'        && '✕ Verification failed — remediation needed'}
                    {verifyStatus === 'Pending'       && '○ Verification pending'}
                    {verifyStatus === "Can't Verify"  && "? Can't Verify — blocked"}
                  </p>
                  {verifyStatus === 'Failed' && (
                    <Link href={`/remediation/${vulnInstantId}/product/${encodedName}`}
                      className="block w-full text-center text-sm bg-orange-600 hover:bg-orange-500 text-white font-medium py-2.5 rounded-lg transition">
                      ← Back to Remediation
                    </Link>
                  )}

                  <Link href="/products"
                    className="block w-full text-center text-sm bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 rounded-lg transition">
                    ⬡ Back to Products
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
