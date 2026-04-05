'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import db from '@/lib/instant';

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  Critical: '#ef4444',
  High:     '#f97316',
  Medium:   '#eab308',
  Low:      '#3b82f6',
};
const SEVERITY_BADGE: Record<string, string> = {
  Critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  High:     'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Medium:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  Low:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
};
const STATUS_BADGE: Record<string, string> = {
  Open:                   'bg-red-500/10 text-red-400 border-red-500/20',
  'In Progress':          'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Remediated:             'bg-green-500/10 text-green-400 border-green-500/20',
  'Pending Verification': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  Closed:                 'bg-slate-700 text-slate-300 border-slate-600',
};

const TIME_RANGES = [
  { label: '30d',  days: 30  },
  { label: '90d',  days: 90  },
  { label: '180d', days: 180 },
  { label: 'All',  days: 0   },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function msToDate(ms: number) { return new Date(ms); }

function monthKey(ms: number) {
  const d = msToDate(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
}

function last6MonthKeys() {
  const keys = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color, href,
}: {
  label: string; value: string | number; sub?: string; color: string; href?: string;
}) {
  const inner = (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition">
      <p className="text-slate-400 text-xs mb-2 font-medium uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1.5">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const { isLoading, user } = db.useAuth();
  const { data: vulnData }       = db.useQuery({ vulnerabilities: {} });
  const { data: triageData }     = db.useQuery({ triages: {} });
  const { data: assessmentData } = db.useQuery({ assessments: {} });
  const { data: remediationData } = db.useQuery({ remediations: {} });

  const [timeRange,       setTimeRange]       = useState(0);   // 0 = All
  const [filterSeverity,  setFilterSeverity]  = useState('');
  const [filterStatus,    setFilterStatus]    = useState('');

  useEffect(() => {
    if (!isLoading && !user) router.push('/');
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const allVulns      = vulnData?.vulnerabilities       ?? [];
  const allTriages    = triageData?.triages             ?? [];
  const allAssessments = assessmentData?.assessments   ?? [];

  // suggestedSeverity from assessments (fallback when no triage record exists)
  const assessSeverityByVuln: Record<string, string> = {};
  for (const a of allAssessments) {
    const ref = a.vulnerabilityRef as string;
    if (ref && a.suggestedSeverity) {
      assessSeverityByVuln[ref] = a.suggestedSeverity as string;
    }
  }

  // Severity lookup: triage takes precedence, assessment is fallback
  const severityByVuln: Record<string, string> = { ...assessSeverityByVuln };
  const triageByVuln:   Record<string, typeof allTriages[number]> = {};
  for (const t of allTriages) {
    const ref = t.vulnerabilityRef as string;
    if (t.severity) severityByVuln[ref] = t.severity as string;
    triageByVuln[ref] = t;
  }

  // ── Time filter cutoff (based on dateDiscovered) ─────────────────────────
  const cutoff = timeRange > 0 ? Date.now() - timeRange * 86_400_000 : 0;
  const vulns  = allVulns.filter((v) => {
    if (!cutoff) return true;
    const discovered = v.dateDiscovered
      ? new Date(v.dateDiscovered as string).getTime()
      : ((v.createdAt as number) ?? 0);
    return discovered >= cutoff;
  });

  // ── Filter for table ──────────────────────────────────────────────────────
  const tableVulns = [...vulns]
    .sort((a, b) => ((b.createdAt as number) ?? 0) - ((a.createdAt as number) ?? 0))
    .filter((v) => {
      const vid = (v as { id: string }).id;
      if (filterSeverity && severityByVuln[vid] !== filterSeverity) return false;
      if (filterStatus   && v.status !== filterStatus)               return false;
      return true;
    });

  const vulnById: Record<string, typeof allVulns[number]> = {};
  for (const v of allVulns) vulnById[(v as { id: string }).id] = v;

  // Remediation status map + full record map: latest remediation per vuln ID
  const allRemediations = remediationData?.remediations ?? [];
  const remStatusByVuln: Record<string, string> = {};
  const remByVuln: Record<string, typeof allRemediations[number]> = {};
  for (const r of allRemediations) {
    const ref = r.vulnerabilityRef as string;
    if (ref) { remStatusByVuln[ref] = r.status as string; remByVuln[ref] = r; }
  }

  // Effective "done" = vuln.status Remediated/Closed OR remediation.status Done
  function isEffectivelyRemediated(v: typeof allVulns[number]): boolean {
    const vid = (v as { id: string }).id;
    return v.status === 'Remediated' || v.status === 'Closed' || remStatusByVuln[vid] === 'Done';
  }

  // ── Summary metrics ───────────────────────────────────────────────────────
  const zeroDayActive   = vulns.filter((v) => v.isZeroDay && !isEffectivelyRemediated(v)).length;
  const remediatedCount = vulns.filter((v) => isEffectivelyRemediated(v)).length;

  // Verification Status: count from remediations entity + vulns in Pending Verification
  const verifiedCount   = allRemediations.filter((r) => r.verificationStatus === 'Verified').length;
  const pendingVerCount = allRemediations.filter((r) => r.verificationStatus === 'Pending').length
    + vulns.filter((v) => v.status === 'Pending Verification').length;
  const failedVerCount  = allRemediations.filter((r) => r.verificationStatus === 'Failed').length;

  // MTTR: avg days from vuln createdAt to best available resolution timestamp
  // Iterates all vulns (not just ones with triage records) so nothing is missed.
  // Resolution time priority: vuln.remediatedAt → remediation.completedAt/updatedAt → triage.updatedAt
  let mttrTotal = 0, mttrCount = 0;
  for (const v of allVulns) {
    if (!isEffectivelyRemediated(v)) continue;
    const vid     = (v as { id: string }).id;
    const created = (v.createdAt as number) ?? 0;
    if (!created) continue;
    const rem    = remByVuln[vid];
    const triage = triageByVuln[vid];
    const resolved =
      (v.remediatedAt as number | undefined) ??
      (rem    ? ((rem.completedDate   as number | undefined) ?? (rem.updatedAt    as number | undefined)) : undefined) ??
      (triage ? ((triage.updatedAt   as number | undefined))                                             : undefined) ??
      0;
    if (resolved > created) {
      mttrTotal += (resolved - created) / 86_400_000;
      mttrCount++;
    }
  }
  const mttr = mttrCount > 0 ? (mttrTotal / mttrCount).toFixed(1) : null;

  // ── Severity breakdown chart ──────────────────────────────────────────────
  const sevCounts: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  for (const v of vulns) {
    const vid = (v as { id: string }).id;
    const sev = severityByVuln[vid];
    if (sev && sevCounts[sev] !== undefined) sevCounts[sev]++;
  }
  const severityChartData = Object.entries(sevCounts)
    .filter(([, n]) => n > 0)
    .map(([name, value]) => ({ name, value }));

  // ── Monthly trend (last 6 months) ─────────────────────────────────────────
  const monthKeys    = last6MonthKeys();
  const openByMonth: Record<string, number>  = {};
  const fixedByMonth: Record<string, number> = {};
  for (const k of monthKeys) { openByMonth[k] = 0; fixedByMonth[k] = 0; }

  for (const v of allVulns) {
    // Use dateDiscovered (actual discovery date) for the "Logged" bar
    const discoveredMs = v.dateDiscovered
      ? new Date(v.dateDiscovered as string).getTime()
      : ((v.createdAt as number) ?? 0);
    if (!discoveredMs) continue;
    const mk = monthKey(discoveredMs);
    if (mk in openByMonth) openByMonth[mk]++;

    if (isEffectivelyRemediated(v)) {
      // Prefer remediatedAt on the vuln itself; fall back to triage.updatedAt
      const triage   = triageByVuln[(v as { id: string }).id];
      const resolved = (v.remediatedAt as number)
        ?? (triage ? ((triage.updatedAt as number) ?? 0) : 0);
      if (resolved) {
        const rmk = monthKey(resolved);
        if (rmk in fixedByMonth) fixedByMonth[rmk]++;
      }
    }
  }
  const trendData = monthKeys.map((k) => ({
    month:      monthLabel(k),
    Logged:     openByMonth[k],
    Remediated: fixedByMonth[k],
  }));

  // ── SLA overdue indicator ─────────────────────────────────────────────────
  const overdueVulnIds = new Set<string>();
  const now = Date.now();
  for (const t of allTriages) {
    if (!t.slaDeadline) continue;
    const vuln = vulnById[t.vulnerabilityRef as string];
    if (!vuln || isEffectivelyRemediated(vuln)) continue;
    if (new Date(t.slaDeadline as string).getTime() < now) {
      overdueVulnIds.add(t.vulnerabilityRef as string);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-56 border-r border-slate-800 flex flex-col px-4 py-6 gap-1 shrink-0">
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="w-7 h-7 bg-red-600 rounded flex items-center justify-center text-white font-bold text-xs">ZA</div>
          <span className="font-semibold text-white text-sm">Zero-Day Atlas</span>
        </div>
        {[
          { label: 'Dashboard',       href: '/dashboard',       icon: '◉', active: true },
          { label: 'Vulnerabilities', href: '/vulnerabilities', icon: '⚠' },
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
        <div className="max-w-6xl mx-auto space-y-8">

          {/* ── Header + filters ─────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-white">Dashboard</h1>
              <p className="text-slate-400 text-sm mt-0.5">Security posture overview</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Time range */}
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 gap-0.5">
                {TIME_RANGES.map((r) => (
                  <button key={r.label} onClick={() => setTimeRange(r.days)}
                    className={`px-3 py-1.5 text-xs rounded-md font-medium transition ${
                      timeRange === r.days ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                    }`}>
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Severity filter */}
              <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500 transition appearance-none">
                <option value="">All Severities</option>
                {['Critical','High','Medium','Low'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>

              {/* Status filter */}
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500 transition appearance-none">
                <option value="">All Statuses</option>
                {['Open','In Progress','Pending Verification','Remediated','Closed'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>

              <Link href="/log-vulnerability"
                className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition flex items-center gap-2">
                <span>+</span> Log Vulnerability
              </Link>
            </div>
          </div>

          {/* ── Summary cards ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <StatCard label="Zero-Day Active"        value={zeroDayActive}   color="text-red-500"    sub="Unresolved zero-days" />
            <StatCard label="Remediated"             value={remediatedCount} color="text-green-400"  sub="Fully resolved" />
            <StatCard
              label="Verification Status"
              value={verifiedCount > 0 || pendingVerCount > 0 || failedVerCount > 0 ? `${verifiedCount} Verified` : '—'}
              color={failedVerCount > 0 ? 'text-red-400' : verifiedCount > 0 ? 'text-green-400' : 'text-slate-500'}
              sub={verifiedCount + pendingVerCount + failedVerCount > 0
                ? `${pendingVerCount} pending · ${failedVerCount} failed`
                : 'No verification data yet'}
            />
            <StatCard
              label="Avg. Time to Remediate"
              value={mttr !== null ? `${mttr}d` : '—'}
              color={mttr !== null ? (Number(mttr) <= 15 ? 'text-green-400' : Number(mttr) <= 30 ? 'text-yellow-400' : 'text-red-400') : 'text-slate-500'}
              sub={mttrCount > 0 ? `Based on ${mttrCount} remediated` : 'No remediated vulns yet'}
            />
          </div>

          {/* ── Row 3: Charts ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* Severity breakdown donut */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-white font-semibold text-sm mb-1">Severity Breakdown</h2>
              <p className="text-slate-500 text-xs mb-4">Active vulnerabilities by severity</p>
              {severityChartData.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-slate-600 text-sm">No data yet</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={severityChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                        paddingAngle={3} dataKey="value">
                        {severityChartData.map((entry) => (
                          <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] ?? '#64748b'} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                        itemStyle={{ color: '#f1f5f9' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 justify-center">
                    {severityChartData.map((d) => (
                      <div key={d.name} className="flex items-center gap-1.5 text-xs text-slate-400">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: SEVERITY_COLORS[d.name] }} />
                        {d.name} <span className="text-white font-medium">({d.value})</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Monthly trend bar chart */}
            <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-white font-semibold text-sm mb-1">Vulnerability Trend</h2>
              <p className="text-slate-500 text-xs mb-4">Logged vs Remediated — last 6 months</p>
              {trendData.every((d) => d.Logged === 0 && d.Remediated === 0) ? (
                <div className="flex items-center justify-center h-40 text-slate-600 text-sm">No data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={trendData} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                      itemStyle={{ color: '#f1f5f9' }}
                      cursor={{ fill: '#334155', opacity: 0.4 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 8 }} />
                    <Bar dataKey="Logged"     fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Remediated" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── Row 4: Vulnerabilities table ──────────────────────────────── */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-white font-semibold text-sm">Vulnerabilities</h2>
              <div className="flex items-center gap-3">
                {overdueVulnIds.size > 0 && (
                  <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full">
                    {overdueVulnIds.size} SLA overdue
                  </span>
                )}
                <Link href="/vulnerabilities" className="text-xs text-slate-400 hover:text-white transition">
                  View all →
                </Link>
              </div>
            </div>

            {tableVulns.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="text-4xl mb-4">🛡</div>
                <h3 className="text-white font-semibold mb-2">No vulnerabilities logged yet</h3>
                <p className="text-slate-400 text-sm mb-6">Start by logging your first zero-day vulnerability.</p>
                <Link href="/log-vulnerability"
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition">
                  <span>+</span> Log Your First Vulnerability
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 text-xs">
                      <th className="text-left px-6 py-3 font-medium">ID</th>
                      <th className="text-left px-6 py-3 font-medium">Title</th>
                      <th className="text-left px-6 py-3 font-medium">Severity</th>
                      <th className="text-left px-6 py-3 font-medium">Status</th>
                      <th className="text-left px-6 py-3 font-medium">Tags</th>
                      <th className="text-left px-6 py-3 font-medium">Discovered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableVulns.map((v) => {
                      const vid      = (v as { id: string }).id;
                      const severity = severityByVuln[vid] ?? '';
                      return (
                        <tr key={vid} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                          <td className="px-6 py-3">
                            <Link href={`/vulnerabilities/${vid}`}
                              className="font-mono text-xs text-slate-400 hover:text-white transition">
                              {v.vulnerabilityId as string}
                            </Link>
                          </td>
                          <td className="px-6 py-3 max-w-xs">
                            <Link href={`/impact-assessment/${vid}`}
                              className="text-white hover:text-red-300 transition truncate block">
                              {v.title as string}
                            </Link>
                          </td>
                          <td className="px-6 py-3">
                            {severity ? (
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${SEVERITY_BADGE[severity] ?? ''}`}>
                                {severity}
                              </span>
                            ) : (
                              <span className="text-slate-600 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            {(() => {
                              const effectiveStatus = remStatusByVuln[vid] === 'Done'
                                ? 'Remediated'
                                : (v.status as string) ?? 'Open';
                              return (
                                <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGE[effectiveStatus] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                                  {effectiveStatus}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-1">
                              {v.isZeroDay && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">0-day</span>
                              )}
                              {v.exploitAvailability === 'Yes' && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">Exploit</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-3 text-slate-400 text-xs">{v.dateDiscovered as string}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
