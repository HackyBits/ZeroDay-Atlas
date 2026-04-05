'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import db from '@/lib/instant';
import Sidebar from '@/app/components/Sidebar';

// ─── Constants ────────────────────────────────────────────────────────────────

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

const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'] as const;

const SLA_DAYS: Record<string, number> = { Critical: 7, High: 30, Medium: 90, Low: 180 };

const SEV_COLORS: Record<string, string> = {
  Critical: '#ef4444', High: '#f97316', Medium: '#eab308', Low: '#3b82f6',
};
const SEV_BADGE: Record<string, string> = {
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
const TRIAGE_STATUS_BADGE: Record<string, string> = {
  Accepted:        'bg-green-500/10 text-green-400 border-green-500/20',
  Rejected:        'bg-red-500/10 text-red-400 border-red-500/20',
  'Needs Info':    'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  'Risk Accepted': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  New:             'bg-slate-700 text-slate-300 border-slate-600',
};
const REM_STATUS_BADGE: Record<string, string> = {
  'In Progress':          'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Blocked:                'bg-red-500/10 text-red-400 border-red-500/20',
  'Ready for Dev Review': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  'Ready for Review':     'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  Done:                   'bg-green-500/10 text-green-400 border-green-500/20',
};
const VERIFY_STATUS_BADGE: Record<string, string> = {
  Verified:       'bg-green-500/10 text-green-400 border-green-500/20',
  Failed:         'bg-red-500/10 text-red-400 border-red-500/20',
  Pending:        'bg-slate-700 text-slate-300 border-slate-600',
  "Can't Verify": 'bg-slate-700 text-slate-300 border-slate-600',
};
const AGE_BUCKET_STYLE: Record<string, string> = {
  '< 30d':   'bg-green-500/10 text-green-400 border-green-500/20',
  '30–60d':  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  '60–90d':  'bg-orange-500/10 text-orange-400 border-orange-500/20',
  '> 90d':   'bg-red-500/10 text-red-400 border-red-500/20',
};

type ActiveReport =
  | 'prod-vuln-report'
  | 'prod-sev-status'
  | 'prod-exec'
  | 'vuln-products'
  | 'vuln-sev-status'
  | 'vuln-exec'
  | 'metrics-mttr'
  | 'metrics-sla'
  | 'metrics-aging'
  | 'metrics-trends'
  | 'metrics-top-risk';

const REPORT_NAV: { group: string; items: { id: ActiveReport; label: string }[] }[] = [
  {
    group: 'Products',
    items: [
      { id: 'prod-vuln-report', label: 'Product Vulnerability Report' },
      { id: 'prod-sev-status',  label: 'Severity & Status Breakdown' },
      { id: 'prod-exec',        label: 'Product Exec Summary' },
    ],
  },
  {
    group: 'Vulnerabilities',
    items: [
      { id: 'vuln-products',    label: 'Vulnerability → Products' },
      { id: 'vuln-sev-status',  label: 'Severity & Status Report' },
      { id: 'vuln-exec',        label: 'Executive Summary' },
    ],
  },
  {
    group: 'Metrics',
    items: [
      { id: 'metrics-mttr',     label: 'MTTR by Product' },
      { id: 'metrics-sla',      label: 'SLA Compliance' },
      { id: 'metrics-aging',    label: 'Vulnerability Aging' },
      { id: 'metrics-trends',   label: 'Remediation Trends' },
      { id: 'metrics-top-risk', label: 'Top Riskiest Products' },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthKey(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(key: string) {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
}
function lastNMonthKeys(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}
function downloadCSV(rows: (string | number)[][], filename: string) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function mttrColor(days: number | null): string {
  if (days === null) return 'text-slate-500';
  if (days > 30) return 'text-red-400';
  if (days > 15) return 'text-yellow-400';
  return 'text-green-400';
}
function medianOf(arr: number[]): number | null {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}
function ageBucket(days: number): string {
  if (days < 30)  return '< 30d';
  if (days < 60)  return '30–60d';
  if (days < 90)  return '60–90d';
  return '> 90d';
}
function daysOpen(createdAt: number, resolvedAt?: number): number {
  return Math.floor(((resolvedAt ?? Date.now()) - createdAt) / 86_400_000);
}

// ─── Small components ─────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
      <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1.5">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}
function ChartCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      <h3 className="text-white font-semibold text-sm mb-0.5">{title}</h3>
      {sub && <p className="text-slate-500 text-xs mb-4">{sub}</p>}
      {children}
    </div>
  );
}
const tooltipStyle = {
  contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 },
  itemStyle: { color: '#f1f5f9' },
  cursor: { fill: '#334155', opacity: 0.4 },
};
const axisProps = { tick: { fill: '#64748b', fontSize: 11 }, axisLine: false, tickLine: false };

function Badge({ label, style }: { label: string; style?: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${style ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
      {label}
    </span>
  );
}
function Dash() { return <span className="text-slate-600 text-xs">—</span>; }
function ExportBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white text-xs px-3 py-2 rounded-lg transition flex items-center gap-1.5">
      ↓ Export CSV
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const router = useRouter();
  const { isLoading, user } = db.useAuth();

  const { data: vulnData }   = db.useQuery({ vulnerabilities:    {} });
  const { data: assessData } = db.useQuery({ assessments:        {} });
  const { data: paData }     = db.useQuery({ productAssessments: {} });
  const { data: ptData }     = db.useQuery({ productTriages:     {} });
  const { data: remData }    = db.useQuery({ remediations:       {} });

  // Report nav state
  const [activeReport, setActiveReport] = useState<ActiveReport>('prod-vuln-report');

  // Per-report filter states
  const [selProduct,    setSelProduct]    = useState(PLANVIEW_PRODUCTS[0].name);
  const [selVulnId,     setSelVulnId]     = useState('');

  // Global filter state
  const [gDatePreset, setGDatePreset] = useState<'30' | '90' | '180' | 'ytd' | 'all'>('all');
  const [gSeverity,   setGSeverity]   = useState('');
  const [gStatus,     setGStatus]     = useState('');
  const [gZeroDay,    setGZeroDay]    = useState(false);

  useEffect(() => { if (!isLoading && !user) router.push('/'); }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const allVulns  = vulnData?.vulnerabilities    ?? [];
  const allAssess = assessData?.assessments      ?? [];
  const allPAs    = paData?.productAssessments   ?? [];
  const allPTs    = ptData?.productTriages       ?? [];
  const allRems   = remData?.remediations        ?? [];

  // ── Global lookups ─────────────────────────────────────────────────────────

  const vulnById: Record<string, typeof allVulns[number]> = {};
  for (const v of allVulns) vulnById[(v as { id: string }).id] = v;

  const globalSevByVuln: Record<string, string> = {};
  for (const a of allAssess) {
    const ref = a.vulnerabilityRef as string;
    if (!globalSevByVuln[ref] && a.suggestedSeverity) globalSevByVuln[ref] = a.suggestedSeverity as string;
  }
  for (const pt of allPTs) {
    const ref = pt.vulnerabilityRef as string;
    if (pt.severity) globalSevByVuln[ref] = pt.severity as string;
  }

  function getPT(vulnId: string, product: string) {
    return allPTs.find(x => (x.vulnerabilityRef as string) === vulnId && (x.productName as string) === product) ?? null;
  }
  function getRem(vulnId: string, product: string) {
    return allRems.find(x => (x.vulnerabilityRef as string) === vulnId && (x.productName as string) === product) ?? null;
  }

  const impactedProductsByVuln: Record<string, string[]> = {};
  for (const pa of allPAs) {
    if ((pa.impactStatus as string) !== 'Impacted') continue;
    const ref = pa.vulnerabilityRef as string;
    if (!impactedProductsByVuln[ref]) impactedProductsByVuln[ref] = [];
    impactedProductsByVuln[ref].push(pa.productName as string);
  }

  const sortedVulns = [...allVulns].sort((a, b) => ((b.createdAt as number) ?? 0) - ((a.createdAt as number) ?? 0));
  const effectiveVulnId = selVulnId || ((sortedVulns[0] as { id: string } | undefined)?.id ?? '');

  // ── Global filter ──────────────────────────────────────────────────────────

  function getGlobalCutoff(): number {
    const now = Date.now();
    if (gDatePreset === '30')  return now - 30  * 86_400_000;
    if (gDatePreset === '90')  return now - 90  * 86_400_000;
    if (gDatePreset === '180') return now - 180 * 86_400_000;
    if (gDatePreset === 'ytd') return new Date(new Date().getFullYear(), 0, 1).getTime();
    return 0;
  }

  const cutoff = getGlobalCutoff();
  const globallyFiltered = allVulns.filter(v => {
    const vid = (v as { id: string }).id;
    if (cutoff && ((v.createdAt as number) ?? 0) < cutoff) return false;
    if (gSeverity && globalSevByVuln[vid] !== gSeverity) return false;
    if (gStatus   && (v.status as string) !== gStatus)   return false;
    if (gZeroDay  && !v.isZeroDay)                        return false;
    return true;
  });

  const hasGlobalFilter = gDatePreset !== 'all' || gSeverity || gStatus || gZeroDay;

  // ── REPORT RENDERERS ───────────────────────────────────────────────────────

  // ── 1: Products — Product Vulnerability Report ────────────────────────────
  function renderProdVulnReport() {
    const filteredVulnIds = new Set(globallyFiltered.map(v => (v as { id: string }).id));
    const rows = allPAs
      .filter(pa =>
        (pa.productName as string) === selProduct &&
        (pa.impactStatus as string) === 'Impacted' &&
        filteredVulnIds.has(pa.vulnerabilityRef as string)
      )
      .map(pa => {
        const vulnId  = pa.vulnerabilityRef as string;
        const vuln    = vulnById[vulnId];
        const pt      = getPT(vulnId, selProduct);
        const rem     = getRem(vulnId, selProduct);
        const sev     = (pt?.severity as string) ?? (pa.suggestedSeverity as string) ?? null;
        const cvss    = (pt?.cvssScore as number) ?? null;
        const assignedTo = (pt?.assignedOwner as string) || null;
        const versions   = ((pa.versionsImpacted as string[]) ?? []).join(', ') || null;
        const resolved   = vuln && (vuln.status === 'Remediated' || vuln.status === 'Closed')
          ? ((rem?.updatedAt as number) ?? (vuln.remediatedAt as number) ?? undefined)
          : undefined;
        const days = vuln ? daysOpen(vuln.createdAt as number, resolved) : 0;
        return { vulnId, vuln, pt, rem, sev, cvss, assignedTo, versions, days };
      })
      .filter(r => !!r.vuln);

    function exportCSV() {
      const csv: (string | number)[][] = [
        ['Vuln ID','Title','CVE','Severity','CVSS','Status','Triage','Remediation','Verification','Versions','Assigned To','Days Open'],
      ];
      for (const r of rows) {
        csv.push([
          r.vuln.vulnerabilityId as string, r.vuln.title as string,
          (r.vuln.cveId as string) ?? '—', r.sev ?? '—',
          r.cvss ?? '—', (r.vuln.status as string) ?? 'Open',
          (r.pt?.status as string) ?? '—', (r.rem?.status as string) ?? '—',
          (r.rem?.verificationStatus as string) ?? '—',
          r.versions ?? '—', r.assignedTo ?? '—', r.days,
        ]);
      }
      downloadCSV(csv, `${selProduct}-vulnerabilities.csv`);
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-bold text-lg">Product Vulnerability Report</h2>
            <p className="text-slate-400 text-sm mt-0.5">All vulnerabilities impacting the selected product</p>
          </div>
          <div className="flex items-center gap-3">
            <select value={selProduct} onChange={e => setSelProduct(e.target.value)}
              className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-red-500 transition">
              {PLANVIEW_PRODUCTS.map(p => <option key={p.name} value={p.name}>{p.icon} {p.name}</option>)}
            </select>
            <ExportBtn onClick={exportCSV} />
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
            <p className="text-slate-400 text-sm">{selProduct} has no impacted vulnerabilities matching the current filters.</p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs">
                  {['Vuln ID','Title','CVE','Severity','CVSS','Status','Triage','Remediation','Verification','Versions','Assigned To','Days Open'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.vulnId} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-mono text-xs text-slate-400 whitespace-nowrap">{r.vuln.vulnerabilityId as string}</td>
                    <td className="px-4 py-3 text-white text-xs max-w-[180px] truncate">{r.vuln.title as string}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{(r.vuln.cveId as string) ?? <Dash />}</td>
                    <td className="px-4 py-3">{r.sev ? <Badge label={r.sev} style={SEV_BADGE[r.sev]} /> : <Dash />}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{r.cvss ?? <Dash />}</td>
                    <td className="px-4 py-3"><Badge label={(r.vuln.status as string) ?? 'Open'} style={STATUS_BADGE[(r.vuln.status as string) ?? 'Open']} /></td>
                    <td className="px-4 py-3">{r.pt?.status ? <Badge label={r.pt.status as string} style={TRIAGE_STATUS_BADGE[r.pt.status as string]} /> : <Dash />}</td>
                    <td className="px-4 py-3">{r.rem?.status ? <Badge label={r.rem.status as string} style={REM_STATUS_BADGE[r.rem.status as string]} /> : <Dash />}</td>
                    <td className="px-4 py-3">{r.rem?.verificationStatus ? <Badge label={r.rem.verificationStatus as string} style={VERIFY_STATUS_BADGE[r.rem.verificationStatus as string]} /> : <Dash />}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{r.versions ?? <Dash />}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{r.assignedTo ?? <Dash />}</td>
                    <td className={`px-4 py-3 text-xs font-medium ${r.days > 90 ? 'text-red-400' : r.days > 30 ? 'text-yellow-400' : 'text-slate-400'}`}>{r.days}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── 2: Products — Severity & Status Breakdown ─────────────────────────────
  function renderProdSevStatus() {
    const filteredVulnIds = new Set(globallyFiltered.map(v => (v as { id: string }).id));
    const rows = allPAs
      .filter(pa =>
        (pa.productName as string) === selProduct &&
        (pa.impactStatus as string) === 'Impacted' &&
        filteredVulnIds.has(pa.vulnerabilityRef as string)
      )
      .map(pa => {
        const vulnId = pa.vulnerabilityRef as string;
        const vuln   = vulnById[vulnId];
        const pt     = getPT(vulnId, selProduct);
        const rem    = getRem(vulnId, selProduct);
        const sev    = (pt?.severity as string) ?? (pa.suggestedSeverity as string) ?? null;
        return { vulnId, vuln, sev, rem };
      })
      .filter(r => !!r.vuln);

    const sevCounts: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    const statusCounts: Record<string, number> = { Open: 0, 'In Progress': 0, 'Pending Verification': 0, Remediated: 0, Closed: 0 };
    let openCount = 0, remCount = 0;
    for (const r of rows) {
      if (r.sev && r.sev in sevCounts) sevCounts[r.sev]++;
      const st = (r.vuln.status as string) ?? 'Open';
      if (st in statusCounts) statusCounts[st]++;
      if (st === 'Open' || st === 'In Progress') openCount++;
      if (st === 'Remediated' || st === 'Closed') remCount++;
    }

    // Trend data: 6 months, logged vs remediated for this product
    const monthKeys = lastNMonthKeys(6);
    const loggedByMonth: Record<string, number>  = {};
    const remByMonth:    Record<string, number>  = {};
    for (const k of monthKeys) { loggedByMonth[k] = 0; remByMonth[k] = 0; }
    for (const r of rows) {
      const mk = monthKey((r.vuln.createdAt as number) ?? 0);
      if (mk in loggedByMonth) loggedByMonth[mk]++;
      if (r.rem && (r.rem.status as string) === 'Done') {
        const rmk = monthKey((r.rem.updatedAt as number) ?? 0);
        if (rmk in remByMonth) remByMonth[rmk]++;
      }
    }
    const trendData = monthKeys.map(k => ({ month: monthLabel(k), Discovered: loggedByMonth[k], Remediated: remByMonth[k] }));

    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-bold text-lg">Severity & Status Breakdown</h2>
            <p className="text-slate-400 text-sm mt-0.5">Distribution of impacted vulnerabilities by severity and status</p>
          </div>
          <select value={selProduct} onChange={e => setSelProduct(e.target.value)}
            className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-red-500 transition">
            {PLANVIEW_PRODUCTS.map(p => <option key={p.name} value={p.name}>{p.icon} {p.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <KpiCard label="Impacted Vulns" value={rows.length}         color="text-white" />
          <KpiCard label="Open"           value={openCount}           color="text-red-400" />
          <KpiCard label="Remediated"     value={remCount}            color="text-green-400" />
          <KpiCard label="Critical"       value={sevCounts.Critical}  color="text-red-400" />
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <ChartCard title="Severity Distribution">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={Object.entries(sevCounts).filter(([,n])=>n>0).map(([name,value])=>({name,value}))}
                  cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {Object.entries(sevCounts).filter(([,n])=>n>0).map(([name]) => <Cell key={name} fill={SEV_COLORS[name] ?? '#64748b'} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Status Distribution">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={Object.entries(statusCounts).filter(([,n])=>n>0).map(([name,value])=>({name,value}))} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="value" fill="#ef4444" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <ChartCard title="Discovered vs Remediated over Time" sub={`Last 6 months — ${selProduct}`}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              <Line type="monotone" dataKey="Discovered" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Remediated" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {rows.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mt-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs">
                  <th className="text-left px-5 py-3 font-medium">Vuln ID</th>
                  <th className="text-left px-5 py-3 font-medium">Title</th>
                  <th className="text-left px-5 py-3 font-medium">Severity</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.vulnId} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                    <td className="px-5 py-3 font-mono text-xs text-slate-400">{r.vuln.vulnerabilityId as string}</td>
                    <td className="px-5 py-3 text-white text-xs truncate max-w-xs">{r.vuln.title as string}</td>
                    <td className="px-5 py-3">{r.sev ? <Badge label={r.sev} style={SEV_BADGE[r.sev]} /> : <Dash />}</td>
                    <td className="px-5 py-3"><Badge label={(r.vuln.status as string) ?? 'Open'} style={STATUS_BADGE[(r.vuln.status as string) ?? 'Open']} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── 3: Products — Product Exec Summary ───────────────────────────────────
  function renderProdExec() {
    const filteredVulnIds = new Set(globallyFiltered.map(v => (v as { id: string }).id));
    const productRows = PLANVIEW_PRODUCTS.map(p => {
      const pas = allPAs.filter(pa =>
        (pa.productName as string) === p.name &&
        (pa.impactStatus as string) === 'Impacted' &&
        filteredVulnIds.has(pa.vulnerabilityRef as string)
      );
      let critical = 0, high = 0, medium = 0, low = 0, open = 0, remediated = 0;
      for (const pa of pas) {
        const vulnId = pa.vulnerabilityRef as string;
        const vuln   = vulnById[vulnId];
        const pt     = getPT(vulnId, p.name);
        const sev    = (pt?.severity as string) ?? (pa.suggestedSeverity as string) ?? '';
        if (sev === 'Critical') critical++;
        else if (sev === 'High') high++;
        else if (sev === 'Medium') medium++;
        else if (sev === 'Low') low++;
        const st = vuln ? ((vuln.status as string) ?? 'Open') : 'Open';
        if (st === 'Open' || st === 'In Progress') open++;
        if (st === 'Remediated' || st === 'Closed') remediated++;
      }
      return { name: p.name, icon: p.icon, impacted: pas.length, critical, high, medium, low, open, remediated };
    }).sort((a, b) => b.impacted - a.impacted);

    return (
      <div>
        <div className="mb-5">
          <h2 className="text-white font-bold text-lg">Product Exec Summary</h2>
          <p className="text-slate-400 text-sm mt-0.5">Vulnerability exposure across all products</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs">
                <th className="text-left px-5 py-3 font-medium">Product</th>
                <th className="text-right px-5 py-3 font-medium">Impacted</th>
                <th className="text-right px-5 py-3 font-medium text-red-400">Critical</th>
                <th className="text-right px-5 py-3 font-medium text-orange-400">High</th>
                <th className="text-right px-5 py-3 font-medium text-yellow-400">Medium</th>
                <th className="text-right px-5 py-3 font-medium text-blue-400">Low</th>
                <th className="text-right px-5 py-3 font-medium">Open</th>
                <th className="text-right px-5 py-3 font-medium text-green-400">Remediated</th>
              </tr>
            </thead>
            <tbody>
              {productRows.map(r => (
                <tr key={r.name} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                  <td className="px-5 py-3"><div className="flex items-center gap-2"><span>{r.icon}</span><span className="text-white text-xs font-medium">{r.name}</span></div></td>
                  <td className="px-5 py-3 text-right"><span className={`font-semibold text-sm ${r.impacted > 0 ? 'text-white' : 'text-slate-600'}`}>{r.impacted}</span></td>
                  <td className="px-5 py-3 text-right text-xs">{r.critical > 0 ? <span className="text-red-400 font-semibold">{r.critical}</span> : <span className="text-slate-600">—</span>}</td>
                  <td className="px-5 py-3 text-right text-xs">{r.high > 0 ? <span className="text-orange-400 font-semibold">{r.high}</span> : <span className="text-slate-600">—</span>}</td>
                  <td className="px-5 py-3 text-right text-xs">{r.medium > 0 ? <span className="text-yellow-400 font-semibold">{r.medium}</span> : <span className="text-slate-600">—</span>}</td>
                  <td className="px-5 py-3 text-right text-xs">{r.low > 0 ? <span className="text-blue-400 font-semibold">{r.low}</span> : <span className="text-slate-600">—</span>}</td>
                  <td className="px-5 py-3 text-right text-xs">{r.open > 0 ? <span className="text-red-400">{r.open}</span> : <span className="text-slate-600">—</span>}</td>
                  <td className="px-5 py-3 text-right text-xs">{r.remediated > 0 ? <span className="text-green-400">{r.remediated}</span> : <span className="text-slate-600">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── 4: Vulnerabilities — Vulnerability → Products ─────────────────────────
  function renderVulnProducts() {
    const selectedVuln = effectiveVulnId ? vulnById[effectiveVulnId] : null;
    const rows = allPAs
      .filter(pa => (pa.vulnerabilityRef as string) === effectiveVulnId && (pa.impactStatus as string) === 'Impacted')
      .map(pa => {
        const product    = pa.productName as string;
        const pt         = getPT(effectiveVulnId, product);
        const rem        = getRem(effectiveVulnId, product);
        const icon       = PLANVIEW_PRODUCTS.find(p => p.name === product)?.icon ?? '⬡';
        const versions   = ((pa.versionsImpacted as string[]) ?? []).join(', ') || null;
        const assignedTo = (pt?.assignedOwner as string) || null;
        return { product, icon, pa, pt, rem, versions, assignedTo };
      });

    function exportCSV() {
      const csv: (string | number)[][] = [
        ['Product','Impact','Triage Decision','Triage Severity','Versions','Assigned To','Remediation Status','Verification'],
      ];
      for (const r of rows) {
        csv.push([r.product,'Impacted',(r.pt?.decision as string)??'—',(r.pt?.severity as string)??'—',r.versions??'—',r.assignedTo??'—',(r.rem?.status as string)??'—',(r.rem?.verificationStatus as string)??'—']);
      }
      downloadCSV(csv, `vuln-products-${effectiveVulnId}.csv`);
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-bold text-lg">Vulnerability → Products Report</h2>
            <p className="text-slate-400 text-sm mt-0.5">All products impacted by the selected vulnerability</p>
          </div>
          <div className="flex items-center gap-3">
            <select value={effectiveVulnId} onChange={e => setSelVulnId(e.target.value)}
              className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-red-500 transition max-w-xs">
              {sortedVulns.map(v => (
                <option key={(v as { id: string }).id} value={(v as { id: string }).id}>
                  {v.vulnerabilityId as string} — {(v.title as string).slice(0, 40)}
                </option>
              ))}
            </select>
            <ExportBtn onClick={exportCSV} />
          </div>
        </div>

        {selectedVuln && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-5 flex items-center gap-4 flex-wrap">
            <span className="font-mono text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">{selectedVuln.vulnerabilityId as string}</span>
            {selectedVuln.isZeroDay && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400">Zero-Day</span>}
            <span className="text-white text-sm font-medium flex-1 min-w-0 truncate">{selectedVuln.title as string}</span>
            <Badge label={(selectedVuln.status as string) ?? 'Open'} style={STATUS_BADGE[(selectedVuln.status as string) ?? 'Open']} />
            {rows.length > 0 && <span className="text-slate-400 text-xs">{rows.length} product{rows.length !== 1 ? 's' : ''} impacted — blast radius</span>}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
            <p className="text-slate-400 text-sm">No products are recorded as Impacted for this vulnerability.</p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs">
                  {['Product','Impact','Triage Decision','Severity','Versions','Assigned To','Remediation','Verification'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.product} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><span>{r.icon}</span><span className="text-white text-xs font-medium">{r.product}</span></div></td>
                    <td className="px-4 py-3"><Badge label="Impacted" style="bg-red-500/10 text-red-400 border-red-500/20" /></td>
                    <td className="px-4 py-3">{r.pt?.decision ? <Badge label={r.pt.decision as string} style={TRIAGE_STATUS_BADGE[r.pt.decision as string]} /> : <Dash />}</td>
                    <td className="px-4 py-3">{r.pt?.severity ? <Badge label={r.pt.severity as string} style={SEV_BADGE[r.pt.severity as string]} /> : <Dash />}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{r.versions ?? <Dash />}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{r.assignedTo ?? <Dash />}</td>
                    <td className="px-4 py-3">{r.rem?.status ? <Badge label={r.rem.status as string} style={REM_STATUS_BADGE[r.rem.status as string]} /> : <Dash />}</td>
                    <td className="px-4 py-3">{r.rem?.verificationStatus ? <Badge label={r.rem.verificationStatus as string} style={VERIFY_STATUS_BADGE[r.rem.verificationStatus as string]} /> : <Dash />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── 5: Vulnerabilities — Severity & Status Report ─────────────────────────
  function renderVulnSevStatus() {
    const sevStatusData = SEVERITIES.map(sev => {
      const sevRows = globallyFiltered.filter(v => globalSevByVuln[(v as { id: string }).id] === sev);
      return {
        sev,
        Open:       sevRows.filter(v => v.status === 'Open').length,
        'In Prog':  sevRows.filter(v => v.status === 'In Progress').length,
        Remediated: sevRows.filter(v => v.status === 'Remediated' || v.status === 'Closed').length,
      };
    }).filter(d => d.Open + d['In Prog'] + d.Remediated > 0);

    const total      = globallyFiltered.length;
    const critical   = globallyFiltered.filter(v => globalSevByVuln[(v as { id: string }).id] === 'Critical').length;
    const open       = globallyFiltered.filter(v => v.status === 'Open' || v.status === 'In Progress').length;
    const remediated = globallyFiltered.filter(v => v.status === 'Remediated' || v.status === 'Closed').length;
    const zdActive   = globallyFiltered.filter(v => v.isZeroDay && v.status !== 'Remediated' && v.status !== 'Closed').length;

    return (
      <div>
        <div className="mb-5">
          <h2 className="text-white font-bold text-lg">Severity & Status Report</h2>
          <p className="text-slate-400 text-sm mt-0.5">Cross-cutting view — use global filters to narrow</p>
        </div>

        <div className="grid grid-cols-5 gap-4 mb-6">
          <KpiCard label="Total"        value={total}      color="text-white" />
          <KpiCard label="Critical"     value={critical}   color="text-red-400" />
          <KpiCard label="Open"         value={open}       color="text-orange-400" />
          <KpiCard label="Remediated"   value={remediated} color="text-green-400" />
          <KpiCard label="Active 0-Day" value={zdActive}   color="text-red-400" />
        </div>

        {sevStatusData.length > 0 && (
          <ChartCard title="Severity × Status" sub="Stacked by Open / In Progress / Remediated">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sevStatusData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="sev" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="Open"       fill="#ef4444" radius={[0,0,0,0]} stackId="a" />
                <Bar dataKey="In Prog"    fill="#f97316" radius={[0,0,0,0]} stackId="a" />
                <Bar dataKey="Remediated" fill="#22c55e" radius={[2,2,0,0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto mt-6">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs">
                {['Vuln ID','Title','CVE','Severity','Status','Products Impacted','Days Open','Discovered'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...globallyFiltered].sort((a,b) => ((b.createdAt as number)??0) - ((a.createdAt as number)??0)).map(v => {
                const vid = (v as { id: string }).id;
                const sev = globalSevByVuln[vid];
                const isResolved = v.status === 'Remediated' || v.status === 'Closed';
                const days = daysOpen(v.createdAt as number, isResolved ? ((v.remediatedAt as number) ?? undefined) : undefined);
                const impactedCount = (impactedProductsByVuln[vid] ?? []).length;
                const topProds = (impactedProductsByVuln[vid] ?? []).slice(0, 2).join(', ');
                return (
                  <tr key={vid} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-mono text-xs text-slate-400 whitespace-nowrap">{v.vulnerabilityId as string}</td>
                    <td className="px-4 py-3 text-white text-xs max-w-[160px] truncate">{v.title as string}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{(v.cveId as string) ?? <Dash />}</td>
                    <td className="px-4 py-3">{sev ? <Badge label={sev} style={SEV_BADGE[sev]} /> : <Dash />}</td>
                    <td className="px-4 py-3"><Badge label={(v.status as string) ?? 'Open'} style={STATUS_BADGE[(v.status as string) ?? 'Open']} /></td>
                    <td className="px-4 py-3 text-xs text-slate-400">{impactedCount > 0 ? <span title={topProds}>{impactedCount} ({topProds}{impactedCount > 2 ? '…' : ''})</span> : <Dash />}</td>
                    <td className={`px-4 py-3 text-xs font-medium ${days > 90 ? 'text-red-400' : days > 30 ? 'text-yellow-400' : 'text-slate-400'}`}>{days}d</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{v.dateDiscovered as string}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── 6: Vulnerabilities — Executive Summary ────────────────────────────────
  function renderVulnExec() {
    const total     = globallyFiltered.length;
    const openCrit  = globallyFiltered.filter(v => globalSevByVuln[(v as { id: string }).id] === 'Critical' && (v.status === 'Open' || v.status === 'In Progress')).length;
    const zdActive  = globallyFiltered.filter(v => v.isZeroDay && v.status !== 'Remediated' && v.status !== 'Closed').length;

    const riskScores: number[] = [];
    for (const a of allPAs) { if (a.riskScore != null) riskScores.push(a.riskScore as number); }
    const avgRisk = riskScores.length > 0 ? Math.round(riskScores.reduce((a,b) => a+b, 0) / riskScores.length) : null;

    let slaTotal = 0, slaOnTime = 0;
    for (const pt of allPTs) {
      if (!pt.slaDeadline) continue;
      const vuln = vulnById[pt.vulnerabilityRef as string];
      if (!vuln) continue;
      slaTotal++;
      const deadline = new Date(pt.slaDeadline as string).getTime();
      if (vuln.status === 'Remediated' || vuln.status === 'Closed') {
        const rem = allRems.find(r => (r.vulnerabilityRef as string) === (pt.vulnerabilityRef as string));
        const resolvedAt = (rem?.updatedAt as number) ?? (vuln.remediatedAt as number) ?? Date.now();
        if (resolvedAt <= deadline) slaOnTime++;
      }
    }
    const slaPct = slaTotal > 0 ? Math.round((slaOnTime / slaTotal) * 100) : null;

    const sevCounts: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    for (const v of globallyFiltered) {
      const sev = globalSevByVuln[(v as { id: string }).id];
      if (sev && sev in sevCounts) sevCounts[sev]++;
    }
    const sevPie = Object.entries(sevCounts).filter(([,n])=>n>0).map(([name,value])=>({name,value}));

    const monthKeys = lastNMonthKeys(6);
    const byMonth: Record<string,number> = {};
    for (const k of monthKeys) byMonth[k] = 0;
    for (const v of globallyFiltered) {
      const mk = monthKey((v.createdAt as number) ?? 0);
      if (mk in byMonth) byMonth[mk]++;
    }
    const monthData = monthKeys.map(k => ({ month: monthLabel(k), Logged: byMonth[k] }));

    const productImpact = PLANVIEW_PRODUCTS.map(p => ({
      name: p.name, icon: p.icon,
      count: allPAs.filter(pa => (pa.productName as string) === p.name && (pa.impactStatus as string) === 'Impacted').length,
    })).sort((a,b) => b.count - a.count).slice(0, 5);

    return (
      <div>
        <div className="mb-5">
          <h2 className="text-white font-bold text-lg">Executive Summary</h2>
          <p className="text-slate-400 text-sm mt-0.5">One-page security posture overview</p>
        </div>
        <div className="grid grid-cols-5 gap-4 mb-6">
          <KpiCard label="Total Vulns"      value={total}                   color="text-white" />
          <KpiCard label="Open Critical"    value={openCrit}                color="text-red-400" />
          <KpiCard label="Active Zero-Days" value={zdActive}                color="text-red-400" />
          <KpiCard label="Avg Risk Score"   value={avgRisk ?? '—'}          color={avgRisk != null && avgRisk >= 76 ? 'text-red-400' : avgRisk != null && avgRisk >= 51 ? 'text-orange-400' : 'text-yellow-400'} />
          <KpiCard label="SLA Compliance"   value={slaPct != null ? `${slaPct}%` : '—'} color={slaPct != null && slaPct >= 80 ? 'text-green-400' : 'text-red-400'} sub={slaTotal > 0 ? `${slaOnTime}/${slaTotal} on time` : undefined} />
        </div>
        <div className="grid grid-cols-2 gap-6 mb-6">
          <ChartCard title="Severity Distribution">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={sevPie} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {sevPie.map(e => <Cell key={e.name} fill={SEV_COLORS[e.name] ?? '#64748b'} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Monthly Vulnerability Intake" sub="Last 6 months">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="Logged" fill="#ef4444" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800"><h3 className="text-white font-semibold text-sm">Top 5 Most Impacted Products</h3></div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-800 text-slate-400 text-xs"><th className="text-left px-5 py-3 font-medium">Product</th><th className="text-right px-5 py-3 font-medium">Impacted Vulnerabilities</th></tr></thead>
            <tbody>
              {productImpact.map(p => (
                <tr key={p.name} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                  <td className="px-5 py-3"><div className="flex items-center gap-2"><span>{p.icon}</span><span className="text-white text-xs font-medium">{p.name}</span></div></td>
                  <td className="px-5 py-3 text-right"><span className={`font-semibold text-sm ${p.count > 0 ? 'text-white' : 'text-slate-600'}`}>{p.count}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── 7: Metrics — MTTR by Product (enhanced) ───────────────────────────────
  function renderMetricsMTTR() {
    type MRow = { name: string; icon: string; overall: number | null; median: number | null; min: number | null; max: number | null; bySev: Record<string, number | null>; count: number };

    const rows: MRow[] = PLANVIEW_PRODUCTS.map(p => {
      const allDays: number[] = [];
      const bySevDays: Record<string, number[]> = { Critical: [], High: [], Medium: [], Low: [] };
      const pas = allPAs.filter(pa => (pa.productName as string) === p.name && (pa.impactStatus as string) === 'Impacted');
      for (const pa of pas) {
        const vulnId = pa.vulnerabilityRef as string;
        const vuln   = vulnById[vulnId];
        const rem    = getRem(vulnId, p.name);
        if (!vuln || !rem || (rem.status as string) !== 'Done') continue;
        const pt  = getPT(vulnId, p.name);
        const sev = (pt?.severity as string) ?? (pa.suggestedSeverity as string) ?? '';
        const created  = (vuln.createdAt as number) ?? 0;
        const resolved = (rem.updatedAt as number) ?? 0;
        if (!created || resolved <= created) continue;
        const d = (resolved - created) / 86_400_000;
        allDays.push(d);
        if (sev in bySevDays) bySevDays[sev].push(d);
      }
      const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length * 10)/10 : null;
      return {
        name: p.name, icon: p.icon,
        overall: avg(allDays),
        median:  medianOf(allDays) !== null ? Math.round(medianOf(allDays)! * 10) / 10 : null,
        min:     allDays.length ? Math.round(Math.min(...allDays) * 10)/10 : null,
        max:     allDays.length ? Math.round(Math.max(...allDays) * 10)/10 : null,
        bySev: { Critical: avg(bySevDays.Critical), High: avg(bySevDays.High), Medium: avg(bySevDays.Medium), Low: avg(bySevDays.Low) },
        count:   allDays.length,
      };
    }).sort((a,b) => (b.overall ?? -1) - (a.overall ?? -1));

    let totalSum = 0, totalCount = 0;
    for (const r of rows) { if (r.overall !== null) { totalSum += r.overall * r.count; totalCount += r.count; } }
    const overallMTTR = totalCount > 0 ? (totalSum / totalCount).toFixed(1) : null;

    const chartData = rows.filter(r => r.overall !== null).map(r => ({ name: r.name, 'Avg Days': r.overall as number }));

    return (
      <div>
        <div className="mb-5">
          <h2 className="text-white font-bold text-lg">MTTR by Product</h2>
          <p className="text-slate-400 text-sm mt-0.5">Mean time to remediate — logged to Done, by product and severity</p>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <KpiCard label="Overall MTTR"      value={overallMTTR ? `${overallMTTR}d` : '—'} color={mttrColor(overallMTTR ? parseFloat(overallMTTR) : null)} sub="Across all products" />
          <KpiCard label="Products Tracked"  value={rows.filter(r=>r.overall!==null).length} color="text-white" />
          <KpiCard label="Total Remediated"  value={totalCount} color="text-green-400" sub="Vulns with remediation Done" />
        </div>
        {chartData.length > 0 && (
          <ChartCard title="Average Days to Remediate by Product" sub="Sorted by longest first">
            <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 36)}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 40, left: 60, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" {...axisProps} allowDecimals={false} />
                <YAxis type="category" dataKey="name" {...axisProps} width={80} />
                <Tooltip {...tooltipStyle} formatter={(v: unknown) => [`${v}d`, 'Avg MTTR']} />
                <Bar dataKey="Avg Days" radius={[0,4,4,0]}>
                  {chartData.map(e => <Cell key={e.name} fill={e['Avg Days'] > 30 ? '#ef4444' : e['Avg Days'] > 15 ? '#eab308' : '#22c55e'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
        <div className="flex items-center gap-4 mt-4 mb-3 text-xs text-slate-500 px-1">
          <span>Color key:</span>
          <span className="text-green-400">≤ 15d Good</span>
          <span className="text-yellow-400">16–30d Warning</span>
          <span className="text-red-400">&gt; 30d Critical</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs">
                <th className="text-left px-5 py-3 font-medium">Product</th>
                <th className="text-right px-5 py-3 font-medium">Avg MTTR</th>
                <th className="text-right px-5 py-3 font-medium">Median</th>
                <th className="text-right px-5 py-3 font-medium">Min</th>
                <th className="text-right px-5 py-3 font-medium">Max</th>
                <th className="text-right px-5 py-3 font-medium text-red-400">Critical</th>
                <th className="text-right px-5 py-3 font-medium text-orange-400">High</th>
                <th className="text-right px-5 py-3 font-medium text-yellow-400">Medium</th>
                <th className="text-right px-5 py-3 font-medium text-blue-400">Low</th>
                <th className="text-right px-5 py-3 font-medium">Remediated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.name} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                  <td className="px-5 py-3"><div className="flex items-center gap-2"><span>{r.icon}</span><span className="text-white text-xs font-medium">{r.name}</span></div></td>
                  <td className={`px-5 py-3 text-right text-sm font-semibold ${mttrColor(r.overall)}`}>{r.overall !== null ? `${r.overall}d` : <span className="text-slate-600 font-normal text-xs">—</span>}</td>
                  <td className={`px-5 py-3 text-right text-xs ${mttrColor(r.median)}`}>{r.median !== null ? `${r.median}d` : <span className="text-slate-600">—</span>}</td>
                  <td className="px-5 py-3 text-right text-xs text-slate-400">{r.min !== null ? `${r.min}d` : <span className="text-slate-600">—</span>}</td>
                  <td className="px-5 py-3 text-right text-xs text-slate-400">{r.max !== null ? `${r.max}d` : <span className="text-slate-600">—</span>}</td>
                  {SEVERITIES.map(sev => (
                    <td key={sev} className={`px-5 py-3 text-right text-xs font-medium ${mttrColor(r.bySev[sev])}`}>{r.bySev[sev] !== null ? `${r.bySev[sev]}d` : <span className="text-slate-600 font-normal">—</span>}</td>
                  ))}
                  <td className="px-5 py-3 text-right text-xs text-slate-400">{r.count > 0 ? r.count : <span className="text-slate-600">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── 8: Metrics — SLA Compliance (NEW) ────────────────────────────────────
  function renderMetricsSLA() {
    const now = Date.now();
    type SLARow = {
      vulnId: string; vulnRef: string; title: string; product: string; sev: string | null;
      slaDeadline: string; isResolved: boolean; isOnTime: boolean; isBreach: boolean;
      daysToDeadline: number; status: string;
    };
    const slaRows: SLARow[] = [];
    for (const pt of allPTs) {
      if (!pt.slaDeadline) continue;
      const vulnRef = pt.vulnerabilityRef as string;
      const vuln    = vulnById[vulnRef];
      if (!vuln) continue;
      const product    = pt.productName as string;
      const sev        = (pt.severity as string) || null;
      const deadline   = new Date(pt.slaDeadline as string).getTime();
      const rem        = getRem(vulnRef, product);
      const isResolved = (rem?.status as string) === 'Done' || vuln.status === 'Remediated' || vuln.status === 'Closed';
      const resolvedAt = isResolved ? ((rem?.updatedAt as number) ?? (vuln.remediatedAt as number) ?? now) : null;
      const isOnTime   = isResolved && resolvedAt !== null && resolvedAt <= deadline;
      const isBreach   = !isResolved && now > deadline;
      const daysToDeadline = Math.round((deadline - now) / 86_400_000);
      slaRows.push({
        vulnId: (vuln.vulnerabilityId as string),
        vulnRef, title: (vuln.title as string), product, sev,
        slaDeadline: pt.slaDeadline as string, isResolved, isOnTime, isBreach,
        daysToDeadline, status: (vuln.status as string) ?? 'Open',
      });
    }

    const total     = slaRows.length;
    const compliant = slaRows.filter(r => r.isOnTime).length;
    const breaches  = slaRows.filter(r => r.isBreach).length;
    const pending   = total - compliant - breaches;
    const compPct   = total > 0 ? Math.round((compliant / total) * 100) : null;

    const compliancePie = [
      { name: 'Compliant', value: compliant },
      { name: 'Breached',  value: breaches },
      { name: 'Pending',   value: pending },
    ].filter(d => d.value > 0);
    const pieColors: Record<string, string> = { Compliant: '#22c55e', Breached: '#ef4444', Pending: '#64748b' };

    const slaBySev: Record<string, { total: number; onTime: number }> = { Critical: {total:0,onTime:0}, High:{total:0,onTime:0}, Medium:{total:0,onTime:0}, Low:{total:0,onTime:0} };
    for (const r of slaRows) {
      if (r.sev && r.sev in slaBySev) { slaBySev[r.sev].total++; if (r.isOnTime) slaBySev[r.sev].onTime++; }
    }
    const sevCompData = Object.entries(slaBySev).filter(([,d])=>d.total>0).map(([name,d])=>({ name, 'Compliance %': Math.round((d.onTime/d.total)*100) }));

    function exportCSV() {
      const csv: (string | number)[][] = [['Vuln ID','Title','Product','Severity','SLA Deadline','Status','Days to Deadline','Compliant']];
      for (const r of slaRows) {
        csv.push([r.vulnId, r.title, r.product, r.sev ?? '—', r.slaDeadline, r.status, r.daysToDeadline, r.isOnTime ? 'Yes' : r.isBreach ? 'Breach' : 'Pending']);
      }
      downloadCSV(csv, 'sla-compliance.csv');
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-bold text-lg">SLA Compliance</h2>
            <p className="text-slate-400 text-sm mt-0.5">SLA thresholds — Critical: {SLA_DAYS.Critical}d | High: {SLA_DAYS.High}d | Medium: {SLA_DAYS.Medium}d | Low: {SLA_DAYS.Low}d</p>
          </div>
          <ExportBtn onClick={exportCSV} />
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <KpiCard label="Overall Compliance" value={compPct !== null ? `${compPct}%` : '—'} color={compPct !== null && compPct >= 80 ? 'text-green-400' : 'text-red-400'} />
          <KpiCard label="Total Tracked"      value={total}     color="text-white" />
          <KpiCard label="Compliant"           value={compliant} color="text-green-400" />
          <KpiCard label="SLA Breaches"        value={breaches}  color={breaches > 0 ? 'text-red-400' : 'text-slate-400'} />
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <ChartCard title="Compliance Status">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={compliancePie} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {compliancePie.map(e => <Cell key={e.name} fill={pieColors[e.name] ?? '#64748b'} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Compliance % by Severity">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sevCompData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} domain={[0,100]} />
                <Tooltip {...tooltipStyle} formatter={(v: unknown) => [`${v}%`]} />
                <Bar dataKey="Compliance %" radius={[4,4,0,0]}>
                  {sevCompData.map(e => <Cell key={e.name} fill={SEV_COLORS[e.name] ?? '#64748b'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {slaRows.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs">
                  {['Vuln ID','Title','Product','Severity','SLA Deadline','Status','Days','Result'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...slaRows].sort((a,b) => a.daysToDeadline - b.daysToDeadline).map((r, i) => (
                  <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.vulnId}</td>
                    <td className="px-4 py-3 text-white text-xs max-w-[140px] truncate">{r.title}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{r.product}</td>
                    <td className="px-4 py-3">{r.sev ? <Badge label={r.sev} style={SEV_BADGE[r.sev]} /> : <Dash />}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{r.slaDeadline}</td>
                    <td className="px-4 py-3"><Badge label={r.status} style={STATUS_BADGE[r.status]} /></td>
                    <td className={`px-4 py-3 text-xs font-medium ${r.isBreach ? 'text-red-400' : r.daysToDeadline < 7 ? 'text-yellow-400' : 'text-slate-400'}`}>
                      {r.isBreach ? `${Math.abs(r.daysToDeadline)}d overdue` : r.daysToDeadline >= 0 ? `${r.daysToDeadline}d left` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {r.isOnTime ? <Badge label="Compliant" style="bg-green-500/10 text-green-400 border-green-500/20" />
                        : r.isBreach ? <Badge label="Breach" style="bg-red-500/10 text-red-400 border-red-500/20" />
                        : <Badge label="Pending" style="bg-slate-700 text-slate-300 border-slate-600" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── 9: Metrics — Vulnerability Aging (NEW) ────────────────────────────────
  function renderMetricsAging() {
    const openVulns = globallyFiltered.filter(v => v.status !== 'Remediated' && v.status !== 'Closed');
    const BUCKETS = ['< 30d', '30–60d', '60–90d', '> 90d'] as const;
    const BUCKET_COLORS: Record<string, string> = { '< 30d': '#22c55e', '30–60d': '#eab308', '60–90d': '#f97316', '> 90d': '#ef4444' };

    const total = openVulns.length;
    const gt30  = openVulns.filter(v => daysOpen(v.createdAt as number) > 30).length;
    const gt60  = openVulns.filter(v => daysOpen(v.createdAt as number) > 60).length;
    const gt90  = openVulns.filter(v => daysOpen(v.createdAt as number) > 90).length;

    // By product stacked bar
    const productChartData = PLANVIEW_PRODUCTS.map(p => {
      const row: Record<string, number | string> = { name: p.name };
      for (const b of BUCKETS) row[b] = 0;
      const pas = allPAs.filter(pa => (pa.productName as string) === p.name && (pa.impactStatus as string) === 'Impacted');
      for (const pa of pas) {
        const vuln = vulnById[pa.vulnerabilityRef as string];
        if (!vuln || vuln.status === 'Remediated' || vuln.status === 'Closed') continue;
        // Check if in globally filtered
        if (!openVulns.find(v => (v as { id: string }).id === (pa.vulnerabilityRef as string))) continue;
        const d = daysOpen(vuln.createdAt as number);
        const b = ageBucket(d);
        (row[b] as number)++;
      }
      return row;
    }).filter(r => BUCKETS.some(b => (r[b] as number) > 0));

    // By severity stacked bar
    const sevChartData = SEVERITIES.map(sev => {
      const row: Record<string, number | string> = { name: sev };
      for (const b of BUCKETS) row[b] = 0;
      for (const v of openVulns) {
        if (globalSevByVuln[(v as { id: string }).id] !== sev) continue;
        const d = daysOpen(v.createdAt as number);
        (row[ageBucket(d)] as number)++;
      }
      return row;
    }).filter(r => BUCKETS.some(b => (r[b] as number) > 0));

    const tableRows = [...openVulns]
      .sort((a,b) => daysOpen(a.createdAt as number) < daysOpen(b.createdAt as number) ? 1 : -1)
      .map(v => {
        const vid  = (v as { id: string }).id;
        const days = daysOpen(v.createdAt as number);
        const sev  = globalSevByVuln[vid];
        return { v, vid, days, sev, bucket: ageBucket(days), impactedCount: (impactedProductsByVuln[vid] ?? []).length };
      });

    return (
      <div>
        <div className="mb-5">
          <h2 className="text-white font-bold text-lg">Vulnerability Aging</h2>
          <p className="text-slate-400 text-sm mt-0.5">How long open vulnerabilities have been unresolved</p>
        </div>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <KpiCard label="Total Open"  value={total} color="text-white" />
          <KpiCard label="> 30 days"   value={gt30}  color={gt30  > 0 ? 'text-yellow-400' : 'text-slate-400'} />
          <KpiCard label="> 60 days"   value={gt60}  color={gt60  > 0 ? 'text-orange-400' : 'text-slate-400'} />
          <KpiCard label="> 90 days"   value={gt90}  color={gt90  > 0 ? 'text-red-400'    : 'text-slate-400'} />
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {productChartData.length > 0 && (
            <ChartCard title="Age Buckets by Product" sub="Open vulnerabilities only">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={productChartData} margin={{ top: 4, right: 8, left: -16, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" {...axisProps} angle={-30} textAnchor="end" />
                  <YAxis {...axisProps} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} />
                  {BUCKETS.map(b => <Bar key={b} dataKey={b} stackId="a" fill={BUCKET_COLORS[b]} radius={b === '> 90d' ? [2,2,0,0] : [0,0,0,0]} />)}
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
          {sevChartData.length > 0 && (
            <ChartCard title="Age Buckets by Severity">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sevChartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" {...axisProps} />
                  <YAxis {...axisProps} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                  {BUCKETS.map(b => <Bar key={b} dataKey={b} stackId="a" fill={BUCKET_COLORS[b]} />)}
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>

        {tableRows.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs">
                  {['Vuln ID','Title','Severity','Status','Products Impacted','Days Open','Age Bucket'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map(r => (
                  <tr key={r.vid} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.v.vulnerabilityId as string}</td>
                    <td className="px-4 py-3 text-white text-xs max-w-[180px] truncate">{r.v.title as string}</td>
                    <td className="px-4 py-3">{r.sev ? <Badge label={r.sev} style={SEV_BADGE[r.sev]} /> : <Dash />}</td>
                    <td className="px-4 py-3"><Badge label={(r.v.status as string) ?? 'Open'} style={STATUS_BADGE[(r.v.status as string) ?? 'Open']} /></td>
                    <td className="px-4 py-3 text-xs text-slate-400">{r.impactedCount > 0 ? r.impactedCount : <Dash />}</td>
                    <td className={`px-4 py-3 text-xs font-semibold ${r.days > 90 ? 'text-red-400' : r.days > 60 ? 'text-orange-400' : r.days > 30 ? 'text-yellow-400' : 'text-slate-400'}`}>{r.days}d</td>
                    <td className="px-4 py-3"><Badge label={r.bucket} style={AGE_BUCKET_STYLE[r.bucket]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── 10: Metrics — Remediation Trends (NEW) ────────────────────────────────
  function renderMetricsTrends() {
    const monthKeys = lastNMonthKeys(12);
    const newByMonth: Record<string,number>  = {};
    const remByMonth: Record<string,number>  = {};
    const mttrByMonth: Record<string, number[]> = {};
    for (const k of monthKeys) { newByMonth[k] = 0; remByMonth[k] = 0; mttrByMonth[k] = []; }

    for (const v of globallyFiltered) {
      const mk = monthKey((v.createdAt as number) ?? 0);
      if (mk in newByMonth) newByMonth[mk]++;
    }
    for (const rem of allRems) {
      if ((rem.status as string) !== 'Done') continue;
      const mk = monthKey((rem.updatedAt as number) ?? 0);
      if (!(mk in remByMonth)) continue;
      remByMonth[mk]++;
      const vuln = vulnById[rem.vulnerabilityRef as string];
      if (vuln) {
        const days = ((rem.updatedAt as number) - (vuln.createdAt as number)) / 86_400_000;
        if (days > 0) mttrByMonth[mk].push(days);
      }
    }

    const trendData = monthKeys.map(k => ({
      month: monthLabel(k),
      New:         newByMonth[k],
      Remediated:  remByMonth[k],
    }));
    const mttrTrendData = monthKeys.map(k => ({
      month: monthLabel(k),
      'MTTR (days)': mttrByMonth[k].length > 0
        ? Math.round(mttrByMonth[k].reduce((a,b)=>a+b,0) / mttrByMonth[k].length * 10) / 10
        : null,
    }));

    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const newThisMonth = newByMonth[thisMonthKey] ?? 0;
    const remThisMonth = remByMonth[thisMonthKey] ?? 0;
    const mttrThisMonth = mttrByMonth[thisMonthKey]?.length > 0
      ? Math.round(mttrByMonth[thisMonthKey].reduce((a,b)=>a+b,0)/mttrByMonth[thisMonthKey].length * 10)/10
      : null;
    const netChange = remThisMonth - newThisMonth;

    return (
      <div>
        <div className="mb-5">
          <h2 className="text-white font-bold text-lg">Remediation Trends</h2>
          <p className="text-slate-400 text-sm mt-0.5">New vulnerabilities vs remediations over the last 12 months</p>
        </div>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <KpiCard label="New This Month"        value={newThisMonth}                     color="text-white" />
          <KpiCard label="Remediated This Month" value={remThisMonth}                     color="text-green-400" />
          <KpiCard label="Net Change"            value={netChange >= 0 ? `+${netChange}` : `${netChange}`} color={netChange <= 0 ? 'text-green-400' : 'text-red-400'} sub={netChange <= 0 ? 'Reducing backlog' : 'Backlog growing'} />
          <KpiCard label="Monthly MTTR"          value={mttrThisMonth ? `${mttrThisMonth}d` : '—'} color={mttrColor(mttrThisMonth)} />
        </div>

        <ChartCard title="New vs Remediated over Time" sub="Last 12 months">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              <Line type="monotone" dataKey="New"        stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Remediated" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="mt-6">
          <ChartCard title="Monthly MTTR Trend" sub="Average days to remediate per month">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={mttrTrendData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip {...tooltipStyle} formatter={(v: unknown) => v ? [`${v}d`, 'Avg MTTR'] : ['—', 'Avg MTTR']} />
                <Line type="monotone" dataKey="MTTR (days)" stroke="#f97316" strokeWidth={2} dot={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>
    );
  }

  // ── 11: Metrics — Top Riskiest Products (NEW) ─────────────────────────────
  function renderMetricsTopRisk() {
    const filteredVulnIds = new Set(globallyFiltered.map(v => (v as { id: string }).id));

    const productRows = PLANVIEW_PRODUCTS.map((p, idx) => {
      let riskScore = 0, openVulns = 0, critical = 0, high = 0, medium = 0, low = 0, remediatedCount = 0, total = 0;
      const pas = allPAs.filter(pa => (pa.productName as string) === p.name && (pa.impactStatus as string) === 'Impacted');
      for (const pa of pas) {
        const vulnId = pa.vulnerabilityRef as string;
        if (!filteredVulnIds.has(vulnId)) continue;
        const vuln = vulnById[vulnId];
        if (!vuln) continue;
        total++;
        const isOpen = vuln.status !== 'Remediated' && vuln.status !== 'Closed';
        if (isOpen) {
          riskScore += (pa.riskScore as number) ?? 0;
          openVulns++;
          const pt  = getPT(vulnId, p.name);
          const sev = (pt?.severity as string) ?? (pa.suggestedSeverity as string) ?? '';
          if (sev === 'Critical') critical++;
          else if (sev === 'High') high++;
          else if (sev === 'Medium') medium++;
          else if (sev === 'Low') low++;
        } else {
          remediatedCount++;
        }
      }
      const remPct = total > 0 ? Math.round((remediatedCount / total) * 100) : 0;
      return { rank: idx + 1, name: p.name, icon: p.icon, riskScore, openVulns, critical, high, medium, low, remediatedCount, total, remPct };
    }).sort((a, b) => b.riskScore - a.riskScore).map((r, i) => ({ ...r, rank: i + 1 }));

    const totalOpenCrit = productRows.reduce((s, r) => s + r.critical, 0);
    const prodsWithCrit = productRows.filter(r => r.critical > 0).length;
    const topProd       = productRows[0];

    const chartData = productRows.filter(r => r.riskScore > 0).map(r => ({ name: r.name, 'Risk Score': r.riskScore }));

    return (
      <div>
        <div className="mb-5">
          <h2 className="text-white font-bold text-lg">Top Riskiest Products</h2>
          <p className="text-slate-400 text-sm mt-0.5">Products ranked by cumulative open risk score</p>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <KpiCard label="Most At-Risk Product"       value={topProd?.riskScore > 0 ? topProd.name : '—'} color="text-red-400" sub={topProd?.riskScore > 0 ? `Risk score: ${topProd.riskScore}` : undefined} />
          <KpiCard label="Total Open Critical Vulns"  value={totalOpenCrit}   color={totalOpenCrit > 0 ? 'text-red-400' : 'text-slate-400'} />
          <KpiCard label="Products with Critical"     value={prodsWithCrit}   color={prodsWithCrit > 0 ? 'text-orange-400' : 'text-slate-400'} />
        </div>

        {chartData.length > 0 && (
          <ChartCard title="Risk Score by Product" sub="Sum of open vulnerability risk scores">
            <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 36)}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 40, left: 70, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" {...axisProps} />
                <YAxis type="category" dataKey="name" {...axisProps} width={80} />
                <Tooltip {...tooltipStyle} formatter={(v: unknown) => [String(v), 'Risk Score']} />
                <Bar dataKey="Risk Score" fill="#ef4444" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs">
                <th className="text-left px-5 py-3 font-medium">#</th>
                <th className="text-left px-5 py-3 font-medium">Product</th>
                <th className="text-right px-5 py-3 font-medium">Risk Score</th>
                <th className="text-right px-5 py-3 font-medium">Open Vulns</th>
                <th className="text-right px-5 py-3 font-medium text-red-400">Critical</th>
                <th className="text-right px-5 py-3 font-medium text-orange-400">High</th>
                <th className="text-right px-5 py-3 font-medium text-yellow-400">Medium</th>
                <th className="text-right px-5 py-3 font-medium text-blue-400">Low</th>
                <th className="text-right px-5 py-3 font-medium text-green-400">Remediated %</th>
              </tr>
            </thead>
            <tbody>
              {productRows.map(r => (
                <tr key={r.name} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                  <td className="px-5 py-3 text-slate-500 text-xs font-medium">{r.rank}</td>
                  <td className="px-5 py-3"><div className="flex items-center gap-2"><span>{r.icon}</span><span className="text-white text-xs font-medium">{r.name}</span></div></td>
                  <td className={`px-5 py-3 text-right font-semibold text-sm ${r.riskScore > 0 ? 'text-red-400' : 'text-slate-600'}`}>{r.riskScore || <Dash />}</td>
                  <td className="px-5 py-3 text-right text-xs text-white">{r.openVulns > 0 ? r.openVulns : <span className="text-slate-600">—</span>}</td>
                  <td className="px-5 py-3 text-right text-xs">{r.critical > 0 ? <span className="text-red-400 font-semibold">{r.critical}</span> : <span className="text-slate-600">—</span>}</td>
                  <td className="px-5 py-3 text-right text-xs">{r.high > 0 ? <span className="text-orange-400 font-semibold">{r.high}</span> : <span className="text-slate-600">—</span>}</td>
                  <td className="px-5 py-3 text-right text-xs">{r.medium > 0 ? <span className="text-yellow-400 font-semibold">{r.medium}</span> : <span className="text-slate-600">—</span>}</td>
                  <td className="px-5 py-3 text-right text-xs">{r.low > 0 ? <span className="text-blue-400 font-semibold">{r.low}</span> : <span className="text-slate-600">—</span>}</td>
                  <td className={`px-5 py-3 text-right text-xs font-medium ${r.remPct >= 80 ? 'text-green-400' : r.remPct > 0 ? 'text-yellow-400' : 'text-slate-600'}`}>{r.total > 0 ? `${r.remPct}%` : <Dash />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Report dispatch ────────────────────────────────────────────────────────

  function renderReport() {
    switch (activeReport) {
      case 'prod-vuln-report': return renderProdVulnReport();
      case 'prod-sev-status':  return renderProdSevStatus();
      case 'prod-exec':        return renderProdExec();
      case 'vuln-products':    return renderVulnProducts();
      case 'vuln-sev-status':  return renderVulnSevStatus();
      case 'vuln-exec':        return renderVulnExec();
      case 'metrics-mttr':     return renderMetricsMTTR();
      case 'metrics-sla':      return renderMetricsSLA();
      case 'metrics-aging':    return renderMetricsAging();
      case 'metrics-trends':   return renderMetricsTrends();
      case 'metrics-top-risk': return renderMetricsTopRisk();
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-slate-800 px-8 py-5 shrink-0">
          <h1 className="text-xl font-bold text-white">Reports</h1>
          <p className="text-slate-400 text-sm mt-0.5">Products · Vulnerabilities · Metrics</p>
        </div>

        {/* Global filter bar */}
        <div className="border-b border-slate-800 bg-slate-900/40 px-8 py-3 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-slate-500 text-xs font-medium shrink-0">Global Filters:</span>
            <div className="flex gap-1">
              {([['30d','30'],['90d','90'],['180d','180'],['YTD','ytd'],['All','all']] as const).map(([label, val]) => (
                <button key={val} onClick={() => setGDatePreset(val)}
                  className={`px-2.5 py-1 text-xs rounded border transition ${gDatePreset === val ? 'bg-red-500/10 border-red-500/40 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </div>
            <select value={gSeverity} onChange={e => setGSeverity(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2.5 py-1 focus:outline-none focus:border-red-500 transition">
              <option value="">All Severities</option>
              {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={gStatus} onChange={e => setGStatus(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2.5 py-1 focus:outline-none focus:border-red-500 transition">
              <option value="">All Statuses</option>
              {['Open','In Progress','Pending Verification','Remediated','Closed'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => setGZeroDay(!gZeroDay)}
              className={`px-2.5 py-1 text-xs rounded border transition ${gZeroDay ? 'bg-red-500/10 border-red-500/40 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
              Zero-Day only
            </button>
            {hasGlobalFilter && (
              <button onClick={() => { setGDatePreset('all'); setGSeverity(''); setGStatus(''); setGZeroDay(false); }}
                className="text-xs text-slate-500 hover:text-slate-300 transition ml-1">
                Clear ✕
              </button>
            )}
            <span className="ml-auto text-slate-600 text-xs">{globallyFiltered.length} / {allVulns.length} vulns</span>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Report nav */}
          <nav className="w-56 border-r border-slate-800 px-3 py-5 shrink-0 overflow-y-auto">
            {REPORT_NAV.map(group => (
              <div key={group.group} className="mb-5">
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider px-3 mb-2">{group.group}</p>
                {group.items.map(item => (
                  <button key={item.id} onClick={() => setActiveReport(item.id)}
                    className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition mb-0.5 ${
                      activeReport === item.id
                        ? 'bg-slate-800 text-white font-medium'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}>
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          {/* Report content */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            {renderReport()}
          </div>
        </div>
      </main>
    </div>
  );
}
