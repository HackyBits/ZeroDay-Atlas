'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { id as instantId } from '@instantdb/react';
import db from '@/lib/instant';
import Sidebar from '@/app/components/Sidebar';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TEAMS = ['Security', 'Development', 'DevOps', 'CloudOps', 'Platform', 'QA', 'Compliance'];

type Severity   = 'Critical' | 'High' | 'Medium' | 'Low';
type Priority   = 'P1' | 'P2' | 'P3' | 'P4';
type Decision   = 'Accept' | 'Reject' | 'Needs More Info';
type TriageStatus = 'New' | 'Accepted' | 'Rejected' | 'Needs Info';

interface TriageForm {
  severity: Severity;
  cvssScore: string;           // kept as string for controlled input, parsed on save
  priority: Priority;
  assignedTeam: string;
  assignedOwner: string;
  notes: string;
  rejectionReason: string;
}

// ─── SLA rules ─────────────────────────────────────────────────────────────────

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

function calcSlaDeadline(severity: Severity): string {
  if (severity === 'Low') return '';   // best effort — no deadline
  const ms = SLA_HOURS[severity] * 60 * 60 * 1000;
  return new Date(Date.now() + ms).toISOString();
}

// ─── Visual helpers ─────────────────────────────────────────────────────────────

const SEVERITY_STYLE: Record<Severity, string> = {
  Critical: 'bg-red-500/10 border-red-500/40 text-red-400',
  High:     'bg-orange-500/10 border-orange-500/40 text-orange-400',
  Medium:   'bg-yellow-500/10 border-yellow-500/40 text-yellow-400',
  Low:      'bg-blue-500/10 border-blue-500/40 text-blue-400',
};

const SEVERITY_RING: Record<Severity, string> = {
  Critical: 'border-red-500',
  High:     'border-orange-500',
  Medium:   'border-yellow-500',
  Low:      'border-blue-500',
};

const PRIORITY_STYLE: Record<Priority, string> = {
  P1: 'bg-red-500/10 border-red-500/40 text-red-400',
  P2: 'bg-orange-500/10 border-orange-500/40 text-orange-400',
  P3: 'bg-yellow-500/10 border-yellow-500/40 text-yellow-400',
  P4: 'bg-slate-700 border-slate-600 text-slate-300',
};

const CVSS_COLOR = (score: number) => {
  if (score >= 9)   return 'text-red-400';
  if (score >= 7)   return 'text-orange-400';
  if (score >= 4)   return 'text-yellow-400';
  return 'text-blue-400';
};

// ─── Shared primitives ──────────────────────────────────────────────────────────

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

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label className="block text-sm font-medium text-slate-300 mb-1.5">
      {children}
      {hint && <span className="text-slate-500 font-normal ml-1.5 text-xs">{hint}</span>}
    </label>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────────

export default function TriagePage() {
  const router = useRouter();
  const { id: vulnInstantId } = useParams<{ id: string }>();

  const { isLoading: authLoading, user } = db.useAuth();
  const { data: vulnData }   = db.useQuery({ vulnerabilities: { $: { where: { id: vulnInstantId } } } });
  const { data: assessData } = db.useQuery({ assessments: { $: { where: { vulnerabilityRef: vulnInstantId } } } });
  const { data: triageData } = db.useQuery({ triages: { $: { where: { vulnerabilityRef: vulnInstantId } } } });

  const [form, setForm] = useState<TriageForm>({
    severity:        'High',
    cvssScore:       '',
    priority:        'P2',
    assignedTeam:    '',
    assignedOwner:   '',
    notes:           '',
    rejectionReason: '',
  });

  const [decision, setDecision]   = useState<Decision | null>(null);
  const [saving, setSaving]       = useState(false);
  const [savedDecision, setSavedDecision] = useState<Decision | null>(null);

  // Hydrate from suggested severity (assessment) and existing triage
  useEffect(() => {
    const suggested = assessData?.assessments?.[0]?.suggestedSeverity as Severity | undefined;
    const existing  = triageData?.triages?.[0];

    if (existing) {
      setForm({
        severity:        (existing.severity as Severity)   ?? 'High',
        cvssScore:       String(existing.cvssScore ?? ''),
        priority:        (existing.priority as Priority)   ?? 'P2',
        assignedTeam:    existing.assignedTeam  ?? '',
        assignedOwner:   existing.assignedOwner ?? '',
        notes:           existing.notes         ?? '',
        rejectionReason: existing.rejectionReason ?? '',
      });
      setDecision((existing.decision as Decision) ?? null);
      setSavedDecision((existing.decision as Decision) ?? null);
    } else if (suggested && ['Critical','High','Medium','Low'].includes(suggested)) {
      const priority: Record<string, Priority> = {
        Critical: 'P1', High: 'P2', Medium: 'P3', Low: 'P4',
      };
      setForm((prev) => ({
        ...prev,
        severity: suggested as Severity,
        priority: priority[suggested] ?? 'P2',
      }));
    }
  }, [assessData, triageData]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [authLoading, user, router]);

  const slaLabel    = useMemo(() => SLA_LABEL[form.severity],        [form.severity]);
  const slaDeadline = useMemo(() => calcSlaDeadline(form.severity),  [form.severity]);
  const cvssNum     = useMemo(() => parseFloat(form.cvssScore) || 0, [form.cvssScore]);

  if (authLoading || !user) return <Spinner />;

  const vuln      = vulnData?.vulnerabilities?.[0];
  const assessment = assessData?.assessments?.[0];
  const existingTriage = triageData?.triages?.[0];

  if (!vuln) return <Spinner />;

  // ── Helpers

  function set<K extends keyof TriageForm>(key: K, val: TriageForm[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (savedDecision) setSavedDecision(null);
  }

  async function handleSubmit() {
    if (!decision) return;
    setSaving(true);

    const triageStatus: Record<Decision, TriageStatus> = {
      'Accept':          'Accepted',
      'Reject':          'Rejected',
      'Needs More Info': 'Needs Info',
    };

    const vulnStatus: Record<Decision, string> = {
      'Accept':          'In Progress',
      'Reject':          'Closed',
      'Needs More Info': 'Needs Info',
    };

    try {
      const triageId = existingTriage ? (existingTriage as { id: string }).id : instantId();

      await db.transact([
        db.tx.triages[triageId].update({
          vulnerabilityRef:  vulnInstantId,
          severity:          form.severity,
          cvssScore:         parseFloat(form.cvssScore) || 0,
          priority:          form.priority,
          decision,
          assignedTeam:      form.assignedTeam,
          assignedOwner:     form.assignedOwner,
          notes:             form.notes,
          rejectionReason:   form.rejectionReason,
          status:            triageStatus[decision],
          slaHours:          SLA_HOURS[form.severity],
          slaDeadline,
          updatedAt:         Date.now(),
          createdAt:         existingTriage ? (existingTriage.createdAt as number) : Date.now(),
        }),
        db.tx.vulnerabilities[vulnInstantId].update({
          status: vulnStatus[decision],
        }),
      ]);

      setSavedDecision(decision);
    } finally {
      setSaving(false);
    }
  }

  // ── Render

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-3xl mx-auto">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm mb-6">
            <Link href="/dashboard" className="text-slate-400 hover:text-white transition">Dashboard</Link>
            <span className="text-slate-700">/</span>
            <span className="text-slate-400 font-mono text-xs">{vuln.vulnerabilityId}</span>
            <span className="text-slate-700">/</span>
            <Link href={`/impact-assessment/${vulnInstantId}`} className="text-slate-400 hover:text-white transition">Impact Assessment</Link>
            <span className="text-slate-700">/</span>
            <span className="text-slate-300">Triage</span>
          </div>

          {/* Vulnerability summary */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-8 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-slate-400 font-mono text-xs">{vuln.vulnerabilityId}</span>
                {vuln.cveId && <span className="text-slate-500 text-xs">{vuln.cveId}</span>}
                {vuln.isZeroDay && (
                  <span className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                    Zero-Day
                  </span>
                )}
              </div>
              <h2 className="text-white font-semibold text-base">{vuln.title}</h2>
              <p className="text-slate-400 text-xs mt-1">
                {vuln.vulnerabilityType} · Exploit: {vuln.exploitAvailability} · Discovered {vuln.dateDiscovered}
              </p>
            </div>
            <span className="shrink-0 text-xs px-3 py-1 rounded-full border bg-slate-800 text-slate-300 border-slate-700">
              {vuln.status}
            </span>
          </div>

          {/* Lifecycle steps */}
          <LifecycleBar active={2} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">

            {/* ── Left: form ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Severity */}
              <SectionCard
                title="Severity"
                desc="Validate or override the suggested severity from Impact Assessment."
              >
                {assessment && (
                  <div className="mb-4 flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2">
                    <span>Suggested by risk engine:</span>
                    <span className={`px-2 py-0.5 rounded-full border font-medium ${SEVERITY_STYLE[assessment.suggestedSeverity as Severity] ?? ''}`}>
                      {assessment.suggestedSeverity}
                    </span>
                    <span className="text-slate-500">· Risk score {assessment.riskScore as number}/100</span>
                  </div>
                )}
                <div className="grid grid-cols-4 gap-2">
                  {(['Critical','High','Medium','Low'] as Severity[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        set('severity', s);
                        const map: Record<Severity, Priority> = { Critical:'P1', High:'P2', Medium:'P3', Low:'P4' };
                        set('priority', map[s]);
                      }}
                      className={`py-2.5 text-sm font-medium rounded-lg border-2 transition ${
                        form.severity === s ? SEVERITY_STYLE[s] + ' ' + SEVERITY_RING[s] : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </SectionCard>

              {/* CVSS Score + Priority */}
              <div className="grid sm:grid-cols-2 gap-5">
                <SectionCard title="CVSS Score" desc="NVD numeric score (0.0 – 10.0)">
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={form.cvssScore}
                      onChange={(e) => set('cvssScore', e.target.value)}
                      placeholder="e.g. 9.8"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition pr-16"
                    />
                    {form.cvssScore && (
                      <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-lg font-bold ${CVSS_COLOR(cvssNum)}`}>
                        {cvssNum.toFixed(1)}
                      </span>
                    )}
                  </div>
                  {form.cvssScore && (
                    <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          cvssNum >= 9 ? 'bg-red-500' : cvssNum >= 7 ? 'bg-orange-500' : cvssNum >= 4 ? 'bg-yellow-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${(cvssNum / 10) * 100}%` }}
                      />
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Priority" desc="Urgency relative to other issues">
                  <div className="grid grid-cols-2 gap-2">
                    {(['P1','P2','P3','P4'] as Priority[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => set('priority', p)}
                        className={`py-2.5 text-sm font-semibold rounded-lg border-2 transition ${
                          form.priority === p ? PRIORITY_STYLE[p] : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                        }`}
                      >
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
              <SectionCard title="Assignment" desc="Assign the vulnerability to a team and owner for remediation.">
                <div className="space-y-4">
                  <div>
                    <Label>Assigned Team</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {TEAMS.map((t) => (
                        <button
                          key={t}
                          onClick={() => set('assignedTeam', t)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition ${
                            form.assignedTeam === t
                              ? 'bg-red-500/10 border-red-500/40 text-red-400'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={form.assignedTeam}
                      onChange={(e) => set('assignedTeam', e.target.value)}
                      placeholder="Or type a custom team name…"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition"
                    />
                  </div>
                  <div>
                    <Label>Assigned Owner</Label>
                    <input
                      type="text"
                      value={form.assignedOwner}
                      onChange={(e) => set('assignedOwner', e.target.value)}
                      placeholder="Name or email of the responsible person…"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition"
                    />
                  </div>
                </div>
              </SectionCard>

              {/* Notes */}
              <SectionCard title="Triage Notes" desc="Add context, observations, or links relevant to this triage decision.">
                <textarea
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  rows={4}
                  placeholder="Describe triage findings, references, or special handling instructions…"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition resize-none"
                />
              </SectionCard>

              {/* Rejection reason — shown only when Reject is selected */}
              {decision === 'Reject' && (
                <SectionCard title="Rejection Reason" desc="Required when closing a vulnerability as rejected.">
                  <textarea
                    value={form.rejectionReason}
                    onChange={(e) => set('rejectionReason', e.target.value)}
                    rows={3}
                    placeholder="Explain why this vulnerability is being rejected or closed (e.g. duplicate, out of scope, risk accepted)…"
                    className="w-full bg-slate-800 border border-red-900/40 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition resize-none"
                  />
                </SectionCard>
              )}
            </div>

            {/* ── Right: decision panel ── */}
            <div className="space-y-4">

              {/* SLA card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-white font-semibold text-sm mb-4">SLA Deadline</h3>
                <div className={`text-center p-4 rounded-lg border mb-4 ${SEVERITY_STYLE[form.severity]}`}>
                  <p className="text-2xl font-bold mb-1">{slaLabel}</p>
                  <p className="text-xs opacity-70">from triage confirmation</p>
                </div>
                <div className="space-y-1.5 text-xs">
                  {(['Critical','High','Medium','Low'] as Severity[]).map((s) => (
                    <div key={s} className={`flex justify-between py-1 border-b border-slate-800 last:border-0 ${form.severity === s ? 'text-white' : 'text-slate-500'}`}>
                      <span>{s}</span>
                      <span>{SLA_LABEL[s]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Triage decision */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-white font-semibold text-sm mb-1">Triage Decision</h3>
                <p className="text-slate-400 text-xs mb-4">Select a decision then confirm.</p>

                <div className="space-y-2 mb-5">
                  <DecisionButton
                    label="Accept"
                    desc="Proceed to remediation"
                    icon="✓"
                    selected={decision === 'Accept'}
                    activeClass="bg-green-500/10 border-green-500/50 text-green-400"
                    onClick={() => setDecision('Accept')}
                  />
                  <DecisionButton
                    label="Needs More Info"
                    desc="Send back for clarification"
                    icon="?"
                    selected={decision === 'Needs More Info'}
                    activeClass="bg-yellow-500/10 border-yellow-500/50 text-yellow-400"
                    onClick={() => setDecision('Needs More Info')}
                  />
                  <DecisionButton
                    label="Reject"
                    desc="Close with reason"
                    icon="✕"
                    selected={decision === 'Reject'}
                    activeClass="bg-red-500/10 border-red-500/40 text-red-400"
                    onClick={() => setDecision('Reject')}
                  />
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!decision || saving || (decision === 'Reject' && !form.rejectionReason)}
                  className="w-full py-3 text-sm font-medium rounded-xl border transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed bg-red-600 hover:bg-red-500 border-red-600 text-white"
                >
                  {saving ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Confirming…</>
                  ) : (
                    `Confirm ${decision ?? 'Decision'}`
                  )}
                </button>

                {!decision && (
                  <p className="text-center text-xs text-slate-600 mt-2">Select a decision above</p>
                )}
                {decision === 'Reject' && !form.rejectionReason && (
                  <p className="text-center text-xs text-red-500/70 mt-2">Rejection reason required</p>
                )}
              </div>

              {/* Post-decision status */}
              {savedDecision && (
                <div className={`rounded-xl border p-5 text-center space-y-3 ${
                  savedDecision === 'Accept'          ? 'bg-green-500/5 border-green-500/30'
                  : savedDecision === 'Reject'        ? 'bg-red-500/5 border-red-500/30'
                  : 'bg-yellow-500/5 border-yellow-500/30'
                }`}>
                  <p className={`font-semibold text-sm ${
                    savedDecision === 'Accept' ? 'text-green-400' : savedDecision === 'Reject' ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {savedDecision === 'Accept'          ? '✓ Accepted — Ready for Task Creation'
                     : savedDecision === 'Reject'        ? '✕ Rejected — Vulnerability Closed'
                     : '? Needs More Info — Sent Back'}
                  </p>
                  {savedDecision === 'Accept' && (
                    <Link
                      href={`/tasks/${vulnInstantId}`}
                      className="block w-full text-center text-sm bg-green-600 hover:bg-green-500 text-white py-2.5 rounded-lg transition"
                    >
                      Continue to Task Creation →
                    </Link>
                  )}
                  <Link href="/dashboard" className="block text-slate-400 hover:text-white text-xs transition">
                    ← Back to Dashboard
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

// ─── Sub-components ─────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
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
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition ${
        selected ? activeClass : 'border-slate-700 bg-slate-800 hover:border-slate-600'
      }`}
    >
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

function LifecycleBar({ active }: { active: number }) {
  const steps = ['Log Vulnerability', 'Impact Assessment', 'Triage', 'Task Creation', 'Remediation'];
  return (
    <div className="flex items-center gap-0 overflow-x-auto">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center shrink-0">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
              i < active  ? 'border-green-500 bg-green-500/10 text-green-400'
              : i === active ? 'border-red-500 bg-red-500 text-white'
              : 'border-slate-700 bg-slate-800 text-slate-500'
            }`}>
              {i < active ? '✓' : i + 1}
            </div>
            <span className={`text-xs whitespace-nowrap hidden sm:block ${i === active ? 'text-white' : 'text-slate-500'}`}>{s}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px w-10 mx-1 mb-4 ${i < active ? 'bg-green-500/40' : 'bg-slate-700'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

