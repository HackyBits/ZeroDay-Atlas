'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { id as instantId } from '@instantdb/react';
import db from '@/lib/instant';
import Sidebar from '@/app/components/Sidebar';

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity     = 'Critical' | 'High' | 'Medium' | 'Low';
type Priority     = 'P1' | 'P2' | 'P3' | 'P4';
type Decision     = 'Accept' | 'Reject' | 'Needs More Info' | 'Risk Accepted: Won\'t Fix';
type TriageStatus = 'New' | 'Accepted' | 'Rejected' | 'Needs Info' | 'Risk Accepted';

interface TriageForm {
  severity:             Severity;
  cvssScore:            string;
  priority:             Priority;
  assignedTeam:         string;
  assignedOwner:        string;
  notes:                string;
  rejectionReason:           string;
  needsMoreInfoDetails:      string;
  riskAcceptedJustification: string;
}

// ─── SLA rules ────────────────────────────────────────────────────────────────

const SLA_HOURS: Record<Severity, number> = {
  Critical: 360,   // 15 days
  High:     720,   // 30 days
  Medium:   2160,  // 90 days
  Low:      0,     // Best effort
};
const SLA_LABEL: Record<Severity, string> = {
  Critical: '15 days',
  High:     '30 days',
  Medium:   '90 days',
  Low:      'Best effort',
};

function calcSlaDeadline(severity: Severity) {
  if (severity === 'Low') return '';
  return new Date(Date.now() + SLA_HOURS[severity] * 3600000).toISOString();
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const SEVERITY_STYLE: Record<Severity, string> = {
  Critical: 'bg-red-500/10 border-red-500/40 text-red-400',
  High:     'bg-orange-500/10 border-orange-500/40 text-orange-400',
  Medium:   'bg-yellow-500/10 border-yellow-500/40 text-yellow-400',
  Low:      'bg-blue-500/10 border-blue-500/40 text-blue-400',
};
const SEVERITY_RING: Record<Severity, string> = {
  Critical: 'border-red-500', High: 'border-orange-500', Medium: 'border-yellow-500', Low: 'border-blue-500',
};
const PRIORITY_STYLE: Record<Priority, string> = {
  P1: 'bg-red-500/10 border-red-500/40 text-red-400',
  P2: 'bg-orange-500/10 border-orange-500/40 text-orange-400',
  P3: 'bg-yellow-500/10 border-yellow-500/40 text-yellow-400',
  P4: 'bg-slate-700 border-slate-600 text-slate-300',
};
const CVSS_COLOR = (n: number) =>
  n >= 9 ? 'text-red-400' : n >= 7 ? 'text-orange-400' : n >= 4 ? 'text-yellow-400' : 'text-blue-400';

const TEAMS = ['Security', 'Development', 'DevOps', 'CloudOps', 'Platform', 'QA', 'Compliance'];

// ─── Small shared components ──────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
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

function DecisionButton({
  label, desc, icon, selected, activeClass, onClick,
}: {
  label: string; desc: string; icon: string;
  selected: boolean; activeClass: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition ${
        selected ? activeClass : 'border-slate-700 bg-slate-800 hover:border-slate-600'
      }`}>
      <span className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${
        selected ? 'border-current' : 'border-slate-600 text-slate-400'
      }`}>{icon}</span>
      <div>
        <p className={`text-sm font-medium ${selected ? '' : 'text-slate-300'}`}>{label}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProductTriagePage() {
  const router = useRouter();
  const { id: vulnInstantId, productName: encodedName } = useParams<{ id: string; productName: string }>();
  const productName = decodeURIComponent(encodedName);

  const { isLoading: authLoading, user } = db.useAuth();
  const { data: vulnData }    = db.useQuery({ vulnerabilities:    { $: { where: { id: vulnInstantId } } } });
  const { data: pdData }      = db.useQuery({ productAssessments: { $: { where: { vulnerabilityRef: vulnInstantId, productName } } } });
  const { data: triageData }  = db.useQuery({ productTriages:     { $: { where: { vulnerabilityRef: vulnInstantId, productName } } } });

  const [form, setForm] = useState<TriageForm>({
    severity: 'High', cvssScore: '', priority: 'P2',
    assignedTeam: '', assignedOwner: '', notes: '', rejectionReason: '', needsMoreInfoDetails: '', riskAcceptedJustification: '',
  });
  const [decision,      setDecision]      = useState<Decision | null>(null);
  const [savedDecision, setSavedDecision] = useState<Decision | null>(null);
  const [saving,        setSaving]        = useState(false);

  // Hydrate from existing product triage
  useEffect(() => {
    const existing = triageData?.productTriages?.[0];
    if (existing) {
      setForm({
        severity:        (existing.severity        as Severity)  ?? 'High',
        cvssScore:       String(existing.cvssScore ?? ''),
        priority:        (existing.priority        as Priority)  ?? 'P2',
        assignedTeam:    (existing.assignedTeam    as string)    ?? '',
        assignedOwner:   (existing.assignedOwner   as string)    ?? '',
        notes:           (existing.notes           as string)    ?? '',
        rejectionReason:      (existing.rejectionReason      as string) ?? '',
        needsMoreInfoDetails:      (existing.needsMoreInfoDetails      as string | undefined) ?? '',
        riskAcceptedJustification: (existing.riskAcceptedJustification as string | undefined) ?? '',
      });
      setDecision((existing.decision  as Decision) ?? null);
      setSavedDecision((existing.decision as Decision) ?? null);
      return;
    }
    // Pre-fill from product assessment risk score
    const pa = pdData?.productAssessments?.[0];
    if (pa?.suggestedSeverity) {
      const sev = pa.suggestedSeverity as Severity;
      const priorityMap: Record<string, Priority> = { Critical: 'P1', High: 'P2', Medium: 'P3', Low: 'P4' };
      setForm((prev) => ({ ...prev, severity: sev, priority: priorityMap[sev] ?? 'P2' }));
    }
  }, [triageData, pdData]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [authLoading, user, router]);

  const cvssNum     = useMemo(() => parseFloat(form.cvssScore) || 0, [form.cvssScore]);
  const slaLabel    = useMemo(() => SLA_LABEL[form.severity],        [form.severity]);
  const slaDeadline = useMemo(() => calcSlaDeadline(form.severity),  [form.severity]);

  if (authLoading || !user) return <Spinner />;
  const vuln     = vulnData?.vulnerabilities?.[0];
  const pa       = pdData?.productAssessments?.[0];
  const existing = triageData?.productTriages?.[0];
  if (!vuln) return <Spinner />;

  function set<K extends keyof TriageForm>(key: K, val: TriageForm[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (savedDecision) setSavedDecision(null);
  }

  async function handleSubmit() {
    if (!decision) return;
    setSaving(true);

    const triageStatusMap: Record<Decision, TriageStatus> = {
      Accept: 'Accepted', Reject: 'Rejected', 'Needs More Info': 'Needs Info', 'Risk Accepted: Won\'t Fix': 'Risk Accepted',
    };

    try {
      const tid = existing ? (existing as { id: string }).id : instantId();
      await db.transact(
        db.tx.productTriages[tid].update({
          vulnerabilityRef: vulnInstantId,
          productName,
          severity:         form.severity,
          cvssScore:        parseFloat(form.cvssScore) || 0,
          priority:         form.priority,
          decision,
          assignedTeam:     form.assignedTeam,
          assignedOwner:    form.assignedOwner,
          notes:            form.notes,
          rejectionReason:           form.rejectionReason,
          needsMoreInfoDetails:      form.needsMoreInfoDetails,
          riskAcceptedJustification: form.riskAcceptedJustification,
          status:                    triageStatusMap[decision],
          slaHours:         SLA_HOURS[form.severity],
          slaDeadline,
          updatedAt:        Date.now(),
          createdAt:        existing ? (existing.createdAt as number) : Date.now(),
        })
      );
      setSavedDecision(decision);
    } finally {
      setSaving(false);
    }
  }

  const impactStatus = (pa?.impactStatus as string) ?? 'Unknown';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar />

      {/* Main */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-3xl mx-auto">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm mb-6 flex-wrap">
            <Link href="/dashboard"                                           className="text-slate-400 hover:text-white transition">Dashboard</Link>
            <span className="text-slate-700">/</span>
            <Link href={`/impact-assessment/${vulnInstantId}`}               className="text-slate-400 hover:text-white transition">Impact Assessment</Link>
            <span className="text-slate-700">/</span>
            <Link href={`/impact-assessment/${vulnInstantId}/product/${encodedName}`} className="text-slate-400 hover:text-white transition">{productName}</Link>
            <span className="text-slate-700">/</span>
            <span className="text-slate-300">Triage</span>
          </div>

          {/* Page title */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Triage — {productName}</h1>
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
              <span className="shrink-0 text-xs px-3 py-1 rounded-full border bg-slate-800 text-slate-300 border-slate-700">
                {vuln.status as string}
              </span>
            </div>

            {/* Product row */}
            <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
              <span className="text-xs text-slate-500">Product</span>
              <span className="text-white font-semibold text-sm">{productName}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                impactStatus === 'Impacted'
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-slate-700 border-slate-600 text-slate-300'
              }`}>{impactStatus}</span>
              {pa?.suggestedSeverity && (
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${SEVERITY_STYLE[pa.suggestedSeverity as Severity] ?? ''}`}>
                  Risk: {pa.suggestedSeverity as string}
                </span>
              )}
              {pa?.versionsImpacted && (pa.versionsImpacted as string[]).length > 0 && (
                <span className="text-xs text-slate-400">
                  Versions: {(pa.versionsImpacted as string[]).join(', ')}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── Left: form ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Severity */}
              <SectionCard title="Dev Triage Severity" desc="Set severity for this product specifically.">
                {pa?.suggestedSeverity && (
                  <div className="mb-4 flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2">
                    <span>Suggested by risk engine:</span>
                    <span className={`px-2 py-0.5 rounded-full border font-medium ${SEVERITY_STYLE[pa.suggestedSeverity as Severity] ?? ''}`}>
                      {pa.suggestedSeverity as string}
                    </span>
                    <span className="text-slate-500">· Score {pa.riskScore as number}/100</span>
                  </div>
                )}
                <div className="grid grid-cols-4 gap-2">
                  {(['Critical','High','Medium','Low'] as Severity[]).map((s) => (
                    <button key={s} onClick={() => {
                      set('severity', s);
                      const map: Record<Severity, Priority> = { Critical: 'P1', High: 'P2', Medium: 'P3', Low: 'P4' };
                      set('priority', map[s]);
                    }}
                      className={`py-2.5 text-sm font-medium rounded-lg border-2 transition ${
                        form.severity === s ? SEVERITY_STYLE[s] + ' ' + SEVERITY_RING[s] : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                      }`}>
                      {s}
                    </button>
                  ))}
                </div>
              </SectionCard>

              {/* CVSS + Priority */}
              <div className="grid sm:grid-cols-2 gap-5">
                <SectionCard title="CVSS Score" desc="Numeric score (0.0 – 10.0)">
                  <div className="relative">
                    <input type="number" min="0" max="10" step="0.1"
                      value={form.cvssScore} onChange={(e) => set('cvssScore', e.target.value)}
                      placeholder="e.g. 9.8"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition pr-16" />
                    {form.cvssScore && (
                      <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-lg font-bold ${CVSS_COLOR(cvssNum)}`}>
                        {cvssNum.toFixed(1)}
                      </span>
                    )}
                  </div>
                  {form.cvssScore && (
                    <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${
                        cvssNum >= 9 ? 'bg-red-500' : cvssNum >= 7 ? 'bg-orange-500' : cvssNum >= 4 ? 'bg-yellow-500' : 'bg-blue-500'
                      }`} style={{ width: `${(cvssNum / 10) * 100}%` }} />
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Priority" desc="Urgency for this product">
                  <div className="grid grid-cols-2 gap-2">
                    {(['P1','P2','P3','P4'] as Priority[]).map((p) => (
                      <button key={p} onClick={() => set('priority', p)}
                        className={`py-2.5 text-sm font-semibold rounded-lg border-2 transition ${
                          form.priority === p ? PRIORITY_STYLE[p] : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                        }`}>
                        {p}
                        <span className="block text-xs font-normal mt-0.5 opacity-70">
                          {p === 'P1' ? 'Immediate' : p === 'P2' ? 'High' : p === 'P3' ? 'Normal' : 'Low'}
                        </span>
                      </button>
                    ))}
                  </div>
                </SectionCard>
              </div>

              {/* Assignment */}
              <SectionCard title="Assignment" desc="Who owns remediation for this product?">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Assigned Team</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {TEAMS.map((t) => (
                        <button key={t} onClick={() => set('assignedTeam', t)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition ${
                            form.assignedTeam === t
                              ? 'bg-red-500/10 border-red-500/40 text-red-400'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                          }`}>
                          {t}
                        </button>
                      ))}
                    </div>
                    <input type="text" value={form.assignedTeam} onChange={(e) => set('assignedTeam', e.target.value)}
                      placeholder="Or type a custom team…"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Assigned Owner</label>
                    <input type="text" value={form.assignedOwner} onChange={(e) => set('assignedOwner', e.target.value)}
                      placeholder="Name or email of the responsible person…"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition" />
                  </div>
                </div>
              </SectionCard>

              {/* Notes */}
              <SectionCard title="Triage Notes" desc="Context or observations specific to this product.">
                <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3}
                  placeholder="Product-specific triage notes, references, or handling instructions…"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition resize-none" />
              </SectionCard>

              {/* Rejection reason */}
              {decision === 'Reject' && (
                <SectionCard title="Rejection Reason" desc="Required when rejecting.">
                  <textarea value={form.rejectionReason} onChange={(e) => set('rejectionReason', e.target.value)} rows={3}
                    placeholder="Explain why this is not applicable to this product…"
                    className="w-full bg-slate-800 border border-red-900/40 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition resize-none" />
                </SectionCard>
              )}

              {/* Risk Accepted justification */}
              {decision === "Risk Accepted: Won't Fix" && (
                <SectionCard title="Risk Acceptance Justification" desc="Required — document the business rationale for accepting this risk.">
                  <textarea
                    value={form.riskAcceptedJustification}
                    onChange={(e) => set('riskAcceptedJustification', e.target.value)}
                    rows={4}
                    placeholder="e.g. Risk is mitigated by compensating controls, exposure is limited to internal network, business impact assessed as acceptable…"
                    className="w-full bg-slate-800 border border-purple-900/40 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition resize-none"
                  />
                </SectionCard>
              )}

              {/* Needs More Info details */}
              {decision === 'Needs More Info' && (
                <SectionCard title="Information Required" desc="Describe what details are needed before this can be triaged.">
                  <textarea
                    value={form.needsMoreInfoDetails}
                    onChange={(e) => set('needsMoreInfoDetails', e.target.value)}
                    rows={4}
                    placeholder="e.g. Need confirmation of affected versions, reproduction steps, or network exposure details…"
                    className="w-full bg-slate-800 border border-yellow-900/40 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-yellow-500 transition resize-none"
                  />
                </SectionCard>
              )}
            </div>

            {/* ── Right: SLA + Decision ── */}
            <div className="space-y-4">

              {/* SLA */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-white font-semibold text-sm mb-4">SLA Deadline</h3>
                <div className={`text-center p-4 rounded-lg border mb-4 ${SEVERITY_STYLE[form.severity]}`}>
                  <p className="text-2xl font-bold mb-1">{slaLabel}</p>
                  <p className="text-xs opacity-70">from triage confirmation</p>
                </div>
                <div className="space-y-1.5 text-xs">
                  {(['Critical','High','Medium','Low'] as Severity[]).map((s) => (
                    <div key={s} className={`flex justify-between py-1 border-b border-slate-800 last:border-0 ${form.severity === s ? 'text-white' : 'text-slate-500'}`}>
                      <span>{s}</span><span>{SLA_LABEL[s]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Decision */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-white font-semibold text-sm mb-1">Triage Decision</h3>
                <p className="text-slate-400 text-xs mb-4">For <span className="text-white">{productName}</span></p>

                <div className="space-y-2 mb-5">
                  <DecisionButton label="Accept" desc="Proceed to remediation" icon="✓"
                    selected={decision === 'Accept'} activeClass="bg-green-500/10 border-green-500/50 text-green-400"
                    onClick={() => setDecision('Accept')} />
                  <DecisionButton label="Needs More Info" desc="Send back for clarification" icon="?"
                    selected={decision === 'Needs More Info'} activeClass="bg-yellow-500/10 border-yellow-500/50 text-yellow-400"
                    onClick={() => setDecision('Needs More Info')} />
                  <DecisionButton label="Reject" desc="Not applicable to this product" icon="✕"
                    selected={decision === 'Reject'} activeClass="bg-red-500/10 border-red-500/40 text-red-400"
                    onClick={() => setDecision('Reject')} />
                  <DecisionButton label="Risk Accepted: Won't Fix" desc="Known risk, accepted by the business" icon="⊘"
                    selected={decision === "Risk Accepted: Won't Fix"} activeClass="bg-purple-500/10 border-purple-500/40 text-purple-400"
                    onClick={() => setDecision("Risk Accepted: Won't Fix")} />
                </div>

                <button onClick={handleSubmit}
                  disabled={
                    !decision || saving ||
                    (decision === 'Reject' && !form.rejectionReason) ||
                    (decision === 'Needs More Info' && !form.needsMoreInfoDetails) ||
                    (decision === "Risk Accepted: Won't Fix" && !form.riskAcceptedJustification)
                  }
                  className="w-full py-3 text-sm font-medium rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed bg-red-600 hover:bg-red-500 text-white">
                  {saving
                    ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Confirming…</>
                    : decision === 'Needs More Info' ? 'Confirm Needs More Info'
                    : decision === "Risk Accepted: Won't Fix" ? "Confirm Risk Accepted"
                    : `Confirm ${decision ?? 'Decision'}`}
                </button>

                {decision === 'Reject' && !form.rejectionReason && (
                  <p className="text-center text-xs text-red-500/70 mt-2">Rejection reason required</p>
                )}
                {decision === 'Needs More Info' && !form.needsMoreInfoDetails && (
                  <p className="text-center text-xs text-yellow-500/70 mt-2">Details required</p>
                )}
                {decision === "Risk Accepted: Won't Fix" && !form.riskAcceptedJustification && (
                  <p className="text-center text-xs text-purple-500/70 mt-2">Justification required</p>
                )}
              </div>

              {/* Post-decision */}
              {savedDecision && (
                <div className={`rounded-xl border p-5 text-center space-y-3 ${
                  savedDecision === 'Accept'                  ? 'bg-green-500/5 border-green-500/30'
                  : savedDecision === 'Reject'                ? 'bg-red-500/5 border-red-500/30'
                  : savedDecision === "Risk Accepted: Won't Fix" ? 'bg-purple-500/5 border-purple-500/30'
                  : 'bg-yellow-500/5 border-yellow-500/30'
                }`}>
                  <p className={`font-semibold text-sm ${
                    savedDecision === 'Accept'                     ? 'text-green-400'
                    : savedDecision === 'Reject'                   ? 'text-red-400'
                    : savedDecision === "Risk Accepted: Won't Fix" ? 'text-purple-400'
                    : 'text-yellow-400'
                  }`}>
                    {savedDecision === 'Accept'                     ? `✓ ${productName} — Accepted`
                     : savedDecision === 'Reject'                   ? `✕ ${productName} — Rejected`
                     : savedDecision === "Risk Accepted: Won't Fix" ? `⊘ ${productName} — Risk Accepted (Won't Fix)`
                     : `? ${productName} — Needs More Info`}
                  </p>
                  {savedDecision === 'Accept' && (
                    <Link href={`/remediation/${vulnInstantId}/product/${encodedName}`}
                      className="block w-full text-center text-sm bg-orange-600 hover:bg-orange-500 text-white font-medium py-2.5 rounded-lg transition">
                      Next: Remediate {productName} →
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
