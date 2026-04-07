'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import db from '@/lib/instant';
import Sidebar from '@/app/components/Sidebar';
import { ShieldAlert, Boxes, BarChart3 } from 'lucide-react';


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
  '< 30d':  'bg-green-500/10 text-green-400 border-green-500/20',
  '30–60d': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  '60–90d': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  '> 90d':  'bg-red-500/10 text-red-400 border-red-500/20',
};

// ─── Navigation types ─────────────────────────────────────────────────────────

type ActiveSection = 'products' | 'vulnerabilities' | 'kpis';
type ActiveReport  =
  | 'prod-vuln-report' | 'prod-sev-status'  | 'prod-exec'
  | 'vuln-products'    | 'vuln-sev-status'  | 'vuln-exec'
  | 'metrics-mttr'     | 'metrics-sla-product' | 'metrics-sla-severity'
  | 'metrics-aging'    | 'metrics-trends'   | 'metrics-top-risk';

const SECTION_LABELS: Record<ActiveSection, string> = {
  products:       '🏢  Products',
  vulnerabilities: '⚠  Vulnerabilities',
  kpis:           '📊  KPIs',
};
const SECTION_REPORTS: Record<ActiveSection, { id: ActiveReport; label: string }[]> = {
  products: [
    { id: 'prod-vuln-report', label: 'Executive Summary' },
  ],
  vulnerabilities: [
    { id: 'vuln-products',   label: 'Executive Summary' },
  ],
  kpis: [
    { id: 'metrics-mttr',         label: 'MTTR by Product' },
    { id: 'metrics-sla-product',  label: 'SLA Compliance by Product' },
    { id: 'metrics-sla-severity', label: 'SLA Compliance by Severity' },
    { id: 'metrics-aging',        label: 'Open Vulnerability Aging' },
    { id: 'metrics-trends',       label: 'Remediation Trends' },
    { id: 'metrics-top-risk',     label: 'Top Riskiest Products' },
  ],
};

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
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url; a.download = filename; a.click();
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
  if (days < 30) return '< 30d';
  if (days < 60) return '30–60d';
  if (days < 90) return '60–90d';
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
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${style ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>{label}</span>;
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
function ExportPdfBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="bg-red-900/30 hover:bg-red-900/50 border border-red-800/50 text-red-300 hover:text-red-200 text-xs px-3 py-2 rounded-lg transition flex items-center gap-1.5">
      ↓ Export PDF
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

  // ── Section & report state ─────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState<ActiveSection>('products');
  const [activeReport,  setActiveReport]  = useState<ActiveReport>('prod-vuln-report');
  const [openSection,   setOpenSection]   = useState<ActiveSection | null>(null);

  // ── Products section filters ───────────────────────────────────────────────
  const [pProduct,  setPProduct]  = useState(PLANVIEW_PRODUCTS[0].name);
  const [pSeverity, setPSeverity] = useState('');
  const [pStatus,   setPStatus]   = useState('');

  // ── Vulnerabilities section filters ───────────────────────────────────────
  const [vVulnId,   setVVulnId]   = useState('');
  const [vSeverity, setVSeverity] = useState('');
  const [vStatus,   setVStatus]   = useState('');
  const [vZeroDay,  setVZeroDay]  = useState(false);

  useEffect(() => { if (!isLoading && !user) router.push('/'); }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const allVulns  = (vulnData?.vulnerabilities    ?? []).filter((v: { archived?: boolean }) => !v.archived);
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

  // ── Section-specific filtered sets ────────────────────────────────────────

  const ONE_YEAR_CUTOFF = Date.now() - 365 * 86_400_000;

  function filterVulns(severity: string, status: string, zeroDay: boolean) {
    return allVulns.filter(v => {
      const vid = (v as { id: string }).id;
      if (((v.createdAt as number) ?? 0) < ONE_YEAR_CUTOFF) return false;
      if (severity && globalSevByVuln[vid] !== severity) return false;
      if (status   && (v.status as string) !== status)   return false;
      if (zeroDay  && !v.isZeroDay)                       return false;
      return true;
    });
  }

  const prodFiltered = filterVulns(pSeverity, pStatus, false);
  const vulnFiltered = filterVulns(vSeverity, vStatus, vZeroDay);
  const kpiFiltered  = filterVulns('', '', false);

  const effectiveVulnId = vVulnId || ((sortedVulns[0] as { id: string } | undefined)?.id ?? '');

  // ── Section switch ─────────────────────────────────────────────────────────
  function switchSection(s: ActiveSection) {
    if (openSection === s) {
      setOpenSection(null);
    } else {
      setOpenSection(s);
      setActiveSection(s);
      setActiveReport(SECTION_REPORTS[s][0].id);
    }
  }

  // ── SLA rows computation (shared between two SLA reports) ─────────────────
  type SLARow = {
    vulnId: string; vulnRef: string; title: string; product: string; sev: string | null;
    slaDeadline: string; isResolved: boolean; isOnTime: boolean; isBreach: boolean;
    daysToDeadline: number; status: string;
  };
  function computeSLARows(): SLARow[] {
    const now = Date.now();
    const rows: SLARow[] = [];
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
      rows.push({
        vulnId: (vuln.vulnerabilityId as string), vulnRef, title: (vuln.title as string),
        product, sev, slaDeadline: pt.slaDeadline as string,
        isResolved, isOnTime, isBreach, daysToDeadline, status: (vuln.status as string) ?? 'Open',
      });
    }
    return rows;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REPORT RENDERERS
  // ─────────────────────────────────────────────────────────────────────────

  // ── Products: Product Vulnerability Report ────────────────────────────────
  function renderProdVulnReport() {
    const filteredVulnIds = new Set(prodFiltered.map(v => (v as { id: string }).id));
    const rows = allPAs
      .filter(pa =>
        (pa.productName as string) === pProduct &&
        (pa.impactStatus as string) === 'Impacted' &&
        filteredVulnIds.has(pa.vulnerabilityRef as string)
      )
      .map(pa => {
        const vulnId = pa.vulnerabilityRef as string;
        const vuln   = vulnById[vulnId];
        const pt     = getPT(vulnId, pProduct);
        const rem    = getRem(vulnId, pProduct);
        const sev    = (pt?.severity as string) ?? (pa.suggestedSeverity as string) ?? null;
        const cvss   = (pt?.cvssScore as number) ?? null;
        const assignedTo = (pt?.assignedOwner as string) || null;
        const versions   = ((pa.versionsImpacted as string[]) ?? []).join(', ') || null;
        const resolved   = vuln && (vuln.status === 'Remediated' || vuln.status === 'Closed')
          ? ((rem?.updatedAt as number) ?? (vuln.remediatedAt as number) ?? undefined) : undefined;
        const days = vuln ? daysOpen(vuln.createdAt as number, resolved) : 0;
        return { vulnId, vuln, pa, pt, rem, sev, cvss, assignedTo, versions, days };
      }).filter(r => !!r.vuln);

    function exportCSV() {
      const csv: (string | number)[][] = [['Vuln ID','Title','CVE','Severity','CVSS','Status','Triage','Remediation','Verification','Versions','Assigned To','Days Open']];
      for (const r of rows) {
        csv.push([r.vuln.vulnerabilityId as string, r.vuln.title as string, (r.vuln.cveId as string) ?? '—', r.sev ?? '—', r.cvss ?? '—', (r.vuln.status as string) ?? 'Open', (r.pt?.status as string) ?? '—', (r.rem?.status as string) ?? '—', (r.rem?.verificationStatus as string) ?? '—', r.versions ?? '—', r.assignedTo ?? '—', r.days]);
      }
      downloadCSV(csv, `${pProduct}-vulnerabilities.csv`);
    }

    async function exportPDF() {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 14;
      let y = margin;
      const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

      const SEV_FILL: Record<string, [number, number, number]> = {
        Critical: [254, 226, 226], High: [255, 237, 213], Medium: [254, 249, 195], Low: [219, 234, 254],
      };
      const SEV_TEXT: Record<string, [number, number, number]> = {
        Critical: [185, 28, 28], High: [194, 65, 12], Medium: [161, 98, 7], Low: [29, 78, 216],
      };

      // Header band
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text('Executive Summary', margin, 12);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(`Product: ${pProduct}`, margin, 19);
      doc.text(`Generated: ${now}`, pageW - margin, 19, { align: 'right' });
      y = 33;

      // Summary table
      const sevCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
      for (const r of rows) {
        if (r.sev && r.sev in sevCounts) sevCounts[r.sev as keyof typeof sevCounts]++;
      }
      autoTable(doc, {
        startY: y,
        head: [['Total Vulnerabilities', 'Critical', 'High', 'Medium', 'Low']],
        body: [[rows.length, sevCounts.Critical, sevCounts.High, sevCounts.Medium, sevCounts.Low]],
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, halign: 'center' },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        didParseCell: (data: any) => {
          if (data.section === 'body') {
            if (data.column.index === 1) { data.cell.styles.textColor = SEV_TEXT.Critical; data.cell.styles.fontStyle = 'bold'; }
            if (data.column.index === 2) { data.cell.styles.textColor = SEV_TEXT.High;     data.cell.styles.fontStyle = 'bold'; }
            if (data.column.index === 3) { data.cell.styles.textColor = SEV_TEXT.Medium;   data.cell.styles.fontStyle = 'bold'; }
            if (data.column.index === 4) { data.cell.styles.textColor = SEV_TEXT.Low;       data.cell.styles.fontStyle = 'bold'; }
          }
        },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

      // Per-vulnerability sections
      for (const r of rows) {
        const fill = SEV_FILL[r.sev ?? ''] ?? [241, 245, 249];
        const text = SEV_TEXT[r.sev ?? ''] ?? [30, 41, 59];

        autoTable(doc, {
          startY: y,
          head: [[{
            content: `${r.vuln.vulnerabilityId as string}  |  ${r.sev ?? '—'}  |  CVE: ${(r.vuln.cveId as string) ?? 'N/A'}`,
            colSpan: 4,
            styles: { fillColor: fill, textColor: text, fontStyle: 'bold', fontSize: 9 },
          }]],
          body: [
            [{ content: r.vuln.title as string, colSpan: 4, styles: { fontStyle: 'bold', fontSize: 10 } }],
            ['Severity',       r.sev ?? '—',                                               'CVSS Score',        String(r.cvss ?? '—')],
            ['Risk Score',     String((r.pa?.riskScore as number) ?? '—'),                  'Status',            (r.vuln.status as string) ?? 'Open'],
            ['Triage Status',  (r.pt?.status as string) ?? '—',                            'Remediation',       (r.rem?.status as string) ?? '—'],
            ['Verification',   (r.rem?.verificationStatus as string) ?? '—',               'Days Open',         `${r.days}d`],
            ['Assigned Owner', r.assignedTo ?? '—',                                         'SLA Deadline',      (r.pt?.slaDeadline as string) ?? '—'],
            ['Priority',       (r.pt?.priority as string) ?? '—',                          'Exploit Available', (r.vuln.exploitAvailability as string) ?? '—'],
            ['Versions Impacted', { content: r.versions ?? '—', colSpan: 3 }],
            [{ content: 'Description', colSpan: 4, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
            [{ content: (r.vuln.description as string) || 'No description available.', colSpan: 4, styles: { fontSize: 8 } }],
            [{ content: 'Impact Assessment', colSpan: 4, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
            ['Business Impact', (r.pa?.businessImpact as string) ?? '—',                   'Data Sensitivity',  (r.pa?.dataSensitivity as string) ?? '—'],
            ['Exposure Level',  { content: (r.pa?.exposureLevel as string) ?? '—', colSpan: 3 }],
            [{ content: 'Remediation Details', colSpan: 4, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
            ['Plan',           (r.rem?.remediationPlan as string) ?? '—',                   'Patch Available',   (r.rem?.patchAvailable as boolean) ? 'Yes' : (r.rem ? 'No' : '—')],
            ['Fix Version',    (r.rem?.fixVersion as string) ?? '—',                        'ETA',               (r.rem?.etaForFix as string) ?? '—'],
          ],
          columnStyles: {
            0: { cellWidth: 38, fontStyle: 'bold', textColor: [71, 85, 105] },
            1: { cellWidth: 57 },
            2: { cellWidth: 38, fontStyle: 'bold', textColor: [71, 85, 105] },
            3: { cellWidth: 57 },
          },
          margin: { left: margin, right: margin },
          styles: { fontSize: 8, cellPadding: 2.5 },
          theme: 'grid',
        });
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
      }

      doc.save(`${pProduct}-vulnerability-report.pdf`);
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sky-400 font-bold text-lg">Executive Summary</h2>
            <p className="text-slate-400 text-sm mt-0.5">All vulnerabilities impacting <span className="text-white font-medium">{pProduct}</span></p>
          </div>
          <div className="flex items-center gap-2">
            <ExportBtn onClick={exportCSV} />
            <ExportPdfBtn onClick={() => { void exportPDF(); }} />
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
            <p className="text-slate-400 text-sm">{pProduct} has no impacted vulnerabilities matching the current filters.</p>
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

  // ── Products: Severity & Status Breakdown ─────────────────────────────────
  function renderProdSevStatus() {
    const filteredVulnIds = new Set(prodFiltered.map(v => (v as { id: string }).id));
    const rows = allPAs
      .filter(pa => (pa.productName as string) === pProduct && (pa.impactStatus as string) === 'Impacted' && filteredVulnIds.has(pa.vulnerabilityRef as string))
      .map(pa => {
        const vulnId = pa.vulnerabilityRef as string;
        const vuln   = vulnById[vulnId];
        const pt     = getPT(vulnId, pProduct);
        const rem    = getRem(vulnId, pProduct);
        const sev    = (pt?.severity as string) ?? (pa.suggestedSeverity as string) ?? null;
        return { vulnId, vuln, sev, rem };
      }).filter(r => !!r.vuln);

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

    const monthKeys = lastNMonthKeys(6);
    const loggedByMonth: Record<string, number> = {};
    const remByMonth:    Record<string, number> = {};
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
        <div className="mb-5">
          <h2 className="text-white font-bold text-lg">Severity & Status Breakdown</h2>
          <p className="text-slate-400 text-sm mt-0.5">Distribution of impacted vulnerabilities for <span className="text-white font-medium">{pProduct}</span></p>
        </div>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <KpiCard label="Impacted Vulns" value={rows.length}        color="text-white" />
          <KpiCard label="Open"           value={openCount}          color="text-red-400" />
          <KpiCard label="Remediated"     value={remCount}           color="text-green-400" />
          <KpiCard label="Critical"       value={sevCounts.Critical} color="text-red-400" />
        </div>
        <div className="grid grid-cols-2 gap-6 mb-6">
          <ChartCard title="Severity Distribution">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={Object.entries(sevCounts).filter(([,n])=>n>0).map(([name,value])=>({name,value}))} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
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
        <ChartCard title="Discovered vs Remediated over Time" sub={`Last 6 months — ${pProduct}`}>
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
                  {['Vuln ID','Title','Severity','Status'].map(h => <th key={h} className="text-left px-5 py-3 font-medium">{h}</th>)}
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

  // ── Products: Executive Summary ───────────────────────────────────────────
  function renderProdExec() {
    const filteredVulnIds = new Set(prodFiltered.map(v => (v as { id: string }).id));

    // Per-selected-product KPIs
    const selPAs = allPAs.filter(pa => (pa.productName as string) === pProduct && (pa.impactStatus as string) === 'Impacted' && filteredVulnIds.has(pa.vulnerabilityRef as string));
    let selCrit = 0, selHigh = 0, selOpen = 0, selRem = 0;
    for (const pa of selPAs) {
      const vulnId = pa.vulnerabilityRef as string;
      const vuln   = vulnById[vulnId];
      const pt     = getPT(vulnId, pProduct);
      const sev    = (pt?.severity as string) ?? (pa.suggestedSeverity as string) ?? '';
      if (sev === 'Critical') selCrit++;
      if (sev === 'High')     selHigh++;
      const st = vuln ? ((vuln.status as string) ?? 'Open') : 'Open';
      if (st === 'Open' || st === 'In Progress') selOpen++;
      if (st === 'Remediated' || st === 'Closed') selRem++;
    }

    // All-products table
    const productRows = PLANVIEW_PRODUCTS.map(p => {
      const pas = allPAs.filter(pa => (pa.productName as string) === p.name && (pa.impactStatus as string) === 'Impacted' && filteredVulnIds.has(pa.vulnerabilityRef as string));
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
          <h2 className="text-white font-bold text-lg">Executive Summary</h2>
          <p className="text-slate-400 text-sm mt-0.5">Security posture for <span className="text-white font-medium">{pProduct}</span> and all products</p>
        </div>

        {/* Selected product KPIs */}
        <div className="mb-2">
          <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-3">{pProduct} — snapshot</p>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <KpiCard label="Impacted Vulns" value={selPAs.length} color="text-white" />
            <KpiCard label="Critical"       value={selCrit}       color={selCrit > 0 ? 'text-red-400' : 'text-slate-400'} />
            <KpiCard label="High"           value={selHigh}       color={selHigh > 0 ? 'text-orange-400' : 'text-slate-400'} />
            <KpiCard label="Open"           value={selOpen}       color={selOpen > 0 ? 'text-red-400' : 'text-slate-400'}
              sub={selRem > 0 ? `${selRem} remediated` : undefined} />
          </div>
        </div>

        {/* All-products table */}
        <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-3">All Products Overview</p>
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
                <tr key={r.name} className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition ${r.name === pProduct ? 'bg-slate-800/20' : ''}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span>{r.icon}</span>
                      <span className={`text-xs font-medium ${r.name === pProduct ? 'text-red-300' : 'text-white'}`}>{r.name}</span>
                      {r.name === pProduct && <span className="text-xs text-red-500/70 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">selected</span>}
                    </div>
                  </td>
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

  // ── Vulnerabilities: Vulnerability → Products ─────────────────────────────
  function renderVulnProducts() {
    const selectedVuln = effectiveVulnId ? vulnById[effectiveVulnId] : null;

    // productAssessments records for this vulnerability (created on per-product detail pages)
    const paForVuln = allPAs.filter(pa =>
      (pa.vulnerabilityRef as string) === effectiveVulnId && (pa.impactStatus as string) === 'Impacted'
    );
    const paByProduct: Record<string, typeof paForVuln[number]> = {};
    for (const pa of paForVuln) paByProduct[pa.productName as string] = pa;

    // assessments.affectedProducts is the source of truth for which products are Impacted
    // (set on the main /impact-assessment/[id] page; productAssessments are only created
    // when the user drills into each product's detail page)
    const parentAssess = allAssess.find(a => (a.vulnerabilityRef as string) === effectiveVulnId);
    const globalImpacted: string[] = ((parentAssess?.affectedProducts as { name: string; impactStatus: string }[]) ?? [])
      .filter(p => p.impactStatus === 'Impacted')
      .map(p => p.name);

    // Union: all impacted product names from either source
    const allImpactedNames = Array.from(new Set([
      ...Object.keys(paByProduct),
      ...globalImpacted,
    ]));

    const rows = allImpactedNames.map(product => {
      const pa         = paByProduct[product] ?? null;
      const pt         = getPT(effectiveVulnId, product);
      const rem        = getRem(effectiveVulnId, product);
      const icon       = PLANVIEW_PRODUCTS.find(p => p.name === product)?.icon ?? '⬡';
      const versions   = pa ? (((pa.versionsImpacted as string[]) ?? []).join(', ') || null) : null;
      const assignedTo = (pt?.assignedOwner as string) || null;
      return { product, icon, pa, pt, rem, versions, assignedTo };
    });

    function exportCSV() {
      const csv: (string | number)[][] = [['Product','Impact','Triage Decision','Triage Severity','Versions','Assigned To','Remediation Status','Verification']];
      for (const r of rows) {
        csv.push([r.product,'Impacted',(r.pt?.decision as string)??'—',(r.pt?.severity as string)??'—',r.versions??'—',r.assignedTo??'—',(r.rem?.status as string)??'—',(r.rem?.verificationStatus as string)??'—']);
      }
      downloadCSV(csv, `vuln-products-${effectiveVulnId}.csv`);
    }

    async function exportPDF() {
      if (!selectedVuln) return;
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 14;
      const colW   = pageW - margin * 2;
      let y = margin;
      const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

      const SEV_FILL: Record<string, [number,number,number]> = {
        Critical: [254,226,226], High: [255,237,213], Medium: [254,249,195], Low: [219,234,254],
      };
      const SEV_TEXT: Record<string, [number,number,number]> = {
        Critical: [185,28,28], High: [194,65,12], Medium: [161,98,7], Low: [29,78,216],
      };

      const vulnSev = globalSevByVuln[effectiveVulnId] ?? null;

      // ── Header band ──────────────────────────────────────────────────────────
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text('Executive Summary', margin, 12);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(`${selectedVuln.vulnerabilityId as string}  —  ${(selectedVuln.title as string).slice(0, 70)}`, margin, 20);
      doc.text(`Generated: ${now}`, pageW - margin, 20, { align: 'right' });
      y = 35;

      // ── Vulnerability details ─────────────────────────────────────────────────
      autoTable(doc, {
        startY: y,
        head: [[{ content: 'Vulnerability Details', colSpan: 4,
          styles: { fillColor: [30, 41, 59], textColor: [255,255,255], fontStyle: 'bold', fontSize: 9 } }]],
        body: [
          ['ID',                 selectedVuln.vulnerabilityId as string,
           'CVE',                (selectedVuln.cveId as string) || '—'],
          ['Status',             (selectedVuln.status as string) ?? 'Open',
           'Severity',           vulnSev ?? '—'],
          ['Exploit Available',  (selectedVuln.exploitAvailability as string) ?? '—',
           'Zero-Day',           selectedVuln.isZeroDay ? 'Yes' : 'No'],
          ['Source',             (selectedVuln.source as string) || '—',
           'Date Discovered',    (selectedVuln.dateDiscovered as string) || '—'],
          [{ content: 'Title', styles: { fontStyle: 'bold', textColor: [71,85,105] } },
           { content: selectedVuln.title as string, colSpan: 3, styles: { fontStyle: 'bold' } }],
          [{ content: 'Description', colSpan: 4, styles: { fontStyle: 'bold', fillColor: [241,245,249] } }],
          [{ content: (selectedVuln.description as string) || 'No description available.', colSpan: 4, styles: { fontSize: 8 } }],
        ],
        columnStyles: {
          0: { cellWidth: 38, fontStyle: 'bold', textColor: [71,85,105] },
          1: { cellWidth: colW / 2 - 38 },
          2: { cellWidth: 38, fontStyle: 'bold', textColor: [71,85,105] },
          3: { cellWidth: colW / 2 - 38 },
        },
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2.5 },
        theme: 'grid',
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

      // ── Global assessment metrics ─────────────────────────────────────────────
      if (parentAssess) {
        const affectedComps = ((parentAssess.affectedComponents as string[]) ?? []).join(', ') || '—';
        autoTable(doc, {
          startY: y,
          head: [[{ content: 'Risk & Assessment', colSpan: 4,
            styles: { fillColor: [30,41,59], textColor: [255,255,255], fontStyle: 'bold', fontSize: 9 } }]],
          body: [
            ['CVSS Score',      String((parentAssess.cvssScore as number) ?? '—'),
             'Risk Score',      String((parentAssess.riskScore as number) ?? '—')],
            ['Business Impact', (parentAssess.businessImpact as string) ?? '—',
             'Data Sensitivity',(parentAssess.dataSensitivity as string) ?? '—'],
            ['Exposure Level',  (parentAssess.exposureLevel as string) ?? '—',
             'Suggested Sev.',  (parentAssess.suggestedSeverity as string) ?? '—'],
            [{ content: 'Affected Components', styles: { fontStyle: 'bold', textColor: [71,85,105] } },
             { content: affectedComps, colSpan: 3 }],
          ],
          columnStyles: {
            0: { cellWidth: 38, fontStyle: 'bold', textColor: [71,85,105] },
            1: { cellWidth: colW / 2 - 38 },
            2: { cellWidth: 38, fontStyle: 'bold', textColor: [71,85,105] },
            3: { cellWidth: colW / 2 - 38 },
          },
          margin: { left: margin, right: margin },
          styles: { fontSize: 8, cellPadding: 2.5 },
          theme: 'grid',
        });
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
      }

      // ── Blast radius summary ──────────────────────────────────────────────────
      const sevCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
      for (const r of rows) {
        const s = (r.pt?.severity as string) ?? (r.pa?.suggestedSeverity as string) ?? '';
        if (s in sevCounts) sevCounts[s as keyof typeof sevCounts]++;
      }
      autoTable(doc, {
        startY: y,
        head: [['Impacted Products', 'Critical', 'High', 'Medium', 'Low']],
        body: [[rows.length, sevCounts.Critical, sevCounts.High, sevCounts.Medium, sevCounts.Low]],
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, halign: 'center' },
        headStyles: { fillColor: [30,41,59], textColor: [255,255,255] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        didParseCell: (data: any) => {
          if (data.section === 'body') {
            if (data.column.index === 1) { data.cell.styles.textColor = SEV_TEXT.Critical; data.cell.styles.fontStyle = 'bold'; }
            if (data.column.index === 2) { data.cell.styles.textColor = SEV_TEXT.High;     data.cell.styles.fontStyle = 'bold'; }
            if (data.column.index === 3) { data.cell.styles.textColor = SEV_TEXT.Medium;   data.cell.styles.fontStyle = 'bold'; }
            if (data.column.index === 4) { data.cell.styles.textColor = SEV_TEXT.Low;      data.cell.styles.fontStyle = 'bold'; }
          }
        },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

      // ── Per-product detail sections ───────────────────────────────────────────
      for (const r of rows) {
        const sev  = (r.pt?.severity as string) ?? (r.pa?.suggestedSeverity as string) ?? null;
        const fill = SEV_FILL[sev ?? ''] ?? [241,245,249];
        const text = SEV_TEXT[sev ?? ''] ?? [30,41,59];

        autoTable(doc, {
          startY: y,
          head: [[{
            content: `${r.product}  ${r.icon}`,
            colSpan: 4,
            styles: { fillColor: fill, textColor: text, fontStyle: 'bold', fontSize: 10 },
          }]],
          body: [
            ['Severity',         sev ?? '—',
             'CVSS Score',       String((r.pt?.cvssScore as number) ?? (r.pa?.cvssScore as number) ?? '—')],
            ['Risk Score',       String((r.pa?.riskScore as number) ?? '—'),
             'Triage Decision',  (r.pt?.decision as string) ?? '—'],
            ['Triage Status',    (r.pt?.status as string) ?? '—',
             'Priority',         (r.pt?.priority as string) ?? '—'],
            ['Assigned Team',    (r.pt?.assignedTeam as string) ?? '—',
             'Assigned Owner',   r.assignedTo ?? '—'],
            ['SLA Deadline',     (r.pt?.slaDeadline as string) ?? '—',
             'Versions',         r.versions ?? '—'],
            ['Business Impact',  (r.pa?.businessImpact as string) ?? '—',
             'Data Sensitivity', (r.pa?.dataSensitivity as string) ?? '—'],
            ['Exposure Level',   { content: (r.pa?.exposureLevel as string) ?? '—', colSpan: 3 }],
            [{ content: 'Remediation', colSpan: 4,
               styles: { fontStyle: 'bold', fillColor: [241,245,249] } }],
            ['Rem. Status',      (r.rem?.status as string) ?? '—',
             'Plan',             (r.rem?.remediationPlan as string) ?? '—'],
            ['Patch Available',  (r.rem?.patchAvailable as boolean) ? 'Yes' : (r.rem ? 'No' : '—'),
             'ETA',              (r.rem?.etaForFix as string) ?? '—'],
            ['Fix Version',      (r.rem?.fixVersion as string) ?? '—',
             'Verification',     (r.rem?.verificationStatus as string) ?? '—'],
          ],
          columnStyles: {
            0: { cellWidth: 38, fontStyle: 'bold', textColor: [71,85,105] },
            1: { cellWidth: colW / 2 - 38 },
            2: { cellWidth: 38, fontStyle: 'bold', textColor: [71,85,105] },
            3: { cellWidth: colW / 2 - 38 },
          },
          margin: { left: margin, right: margin },
          styles: { fontSize: 8, cellPadding: 2.5 },
          theme: 'grid',
        });
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
      }

      doc.save(`${selectedVuln.vulnerabilityId as string}-impact-report.pdf`);
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sky-400 font-bold text-lg">Executive Summary</h2>
            <p className="text-slate-400 text-sm mt-0.5">All products impacted by the selected vulnerability</p>
          </div>
          <div className="flex items-center gap-2">
            <ExportBtn onClick={exportCSV} />
            <ExportPdfBtn onClick={() => { void exportPDF(); }} />
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

  // ── Vulnerabilities: Severity & Status Report ─────────────────────────────
  function renderVulnSevStatus() {
    const sevStatusData = SEVERITIES.map(sev => {
      const sevRows = vulnFiltered.filter(v => globalSevByVuln[(v as { id: string }).id] === sev);
      return { sev, Open: sevRows.filter(v => v.status === 'Open').length, 'In Prog': sevRows.filter(v => v.status === 'In Progress').length, Remediated: sevRows.filter(v => v.status === 'Remediated' || v.status === 'Closed').length };
    }).filter(d => d.Open + d['In Prog'] + d.Remediated > 0);

    const total      = vulnFiltered.length;
    const critical   = vulnFiltered.filter(v => globalSevByVuln[(v as { id: string }).id] === 'Critical').length;
    const open       = vulnFiltered.filter(v => v.status === 'Open' || v.status === 'In Progress').length;
    const remediated = vulnFiltered.filter(v => v.status === 'Remediated' || v.status === 'Closed').length;
    const zdActive   = vulnFiltered.filter(v => v.isZeroDay && v.status !== 'Remediated' && v.status !== 'Closed').length;

    return (
      <div>
        <div className="mb-5">
          <h2 className="text-white font-bold text-lg">Severity & Status Report</h2>
          <p className="text-slate-400 text-sm mt-0.5">Cross-cutting view across all vulnerabilities</p>
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
                <Bar dataKey="Open"       fill="#ef4444" stackId="a" />
                <Bar dataKey="In Prog"    fill="#f97316" stackId="a" />
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
              {[...vulnFiltered].sort((a,b) => ((b.createdAt as number)??0) - ((a.createdAt as number)??0)).map(v => {
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

  // ── Vulnerabilities: Executive Summary ────────────────────────────────────
  function renderVulnExec() {
    const total    = vulnFiltered.length;
    const openCrit = vulnFiltered.filter(v => globalSevByVuln[(v as { id: string }).id] === 'Critical' && (v.status === 'Open' || v.status === 'In Progress')).length;
    const zdActive = vulnFiltered.filter(v => v.isZeroDay && v.status !== 'Remediated' && v.status !== 'Closed').length;

    const riskScores: number[] = [];
    for (const a of allPAs) { if (a.riskScore != null) riskScores.push(a.riskScore as number); }
    const avgRisk = riskScores.length > 0 ? Math.round(riskScores.reduce((a,b)=>a+b,0)/riskScores.length) : null;

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
    for (const v of vulnFiltered) {
      const sev = globalSevByVuln[(v as { id: string }).id];
      if (sev && sev in sevCounts) sevCounts[sev]++;
    }
    const sevPie = Object.entries(sevCounts).filter(([,n])=>n>0).map(([name,value])=>({name,value}));

    const monthKeys = lastNMonthKeys(12);
    const byMonth: Record<string,number> = {};
    for (const k of monthKeys) byMonth[k] = 0;
    for (const v of vulnFiltered) {
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
          <p className="text-slate-400 text-sm mt-0.5">One-page security posture overview — use filters to narrow time range</p>
        </div>
        <div className="grid grid-cols-5 gap-4 mb-6">
          <KpiCard label="Total Vulns"      value={total}                        color="text-white" />
          <KpiCard label="Open Critical"    value={openCrit}                     color="text-red-400" />
          <KpiCard label="Active Zero-Days" value={zdActive}                     color="text-red-400" />
          <KpiCard label="Avg Risk Score"   value={avgRisk ?? '—'}               color={avgRisk != null && avgRisk >= 76 ? 'text-red-400' : avgRisk != null && avgRisk >= 51 ? 'text-orange-400' : 'text-yellow-400'} />
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
          <ChartCard title="Monthly Vulnerability Intake" sub={`Last ${monthKeys.length} months`}>
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

  // ── KPI: MTTR by Product ──────────────────────────────────────────────────
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
        // Prefer resolvedAt (set when status first became Done); fall back to updatedAt for older records
        const resolved = (rem.resolvedAt as number | undefined) ?? (rem.updatedAt as number) ?? 0;
        if (!created || resolved <= created) continue;
        const d = (resolved - created) / 86_400_000;
        allDays.push(d);
        if (sev in bySevDays) bySevDays[sev].push(d);
      }
      const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length * 10)/10 : null;
      return {
        name: p.name, icon: p.icon,
        overall: avg(allDays),
        median:  medianOf(allDays) !== null ? Math.round(medianOf(allDays)! * 10)/10 : null,
        min:     allDays.length ? Math.round(Math.min(...allDays)*10)/10 : null,
        max:     allDays.length ? Math.round(Math.max(...allDays)*10)/10 : null,
        bySev:   { Critical: avg(bySevDays.Critical), High: avg(bySevDays.High), Medium: avg(bySevDays.Medium), Low: avg(bySevDays.Low) },
        count:   allDays.length,
      };
    }).sort((a,b) => (b.overall ?? -1) - (a.overall ?? -1));

    let totalSum = 0, totalCount = 0;
    for (const r of rows) { if (r.overall !== null) { totalSum += r.overall * r.count; totalCount += r.count; } }
    const overallMTTR = totalCount > 0 ? (totalSum / totalCount).toFixed(1) : null;
    const chartData = rows.filter(r => r.overall !== null).map(r => ({ name: r.name, 'Avg Days': r.overall as number }));

    // Build per-vulnerability MTTR detail rows (used by both UI drill-down and PDF)
    type VulnMTTRRow = {
      product: string; vulnId: string; title: string; sev: string;
      dateLogged: string; dateRemediated: string; days: number;
    };
    const vulnMTTRRows: VulnMTTRRow[] = [];
    for (const p of PLANVIEW_PRODUCTS) {
      const pas = allPAs.filter(pa => (pa.productName as string) === p.name && (pa.impactStatus as string) === 'Impacted');
      for (const pa of pas) {
        const vulnId = pa.vulnerabilityRef as string;
        const vuln   = vulnById[vulnId];
        const rem    = getRem(vulnId, p.name);
        if (!vuln || !rem || (rem.status as string) !== 'Done') continue;
        const pt      = getPT(vulnId, p.name);
        const sev     = (pt?.severity as string) ?? (pa.suggestedSeverity as string) ?? '—';
        const created  = (vuln.createdAt as number) ?? 0;
        const resolved = (rem.resolvedAt as number | undefined) ?? (rem.updatedAt as number) ?? 0;
        if (!created || resolved <= created) continue;
        const days = Math.round(((resolved - created) / 86_400_000) * 10) / 10;
        vulnMTTRRows.push({
          product:        p.name,
          vulnId:         (vuln.vulnerabilityId as string) ?? vulnId,
          title:          (vuln.title as string) ?? '',
          sev,
          dateLogged:     new Date(created).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }),
          dateRemediated: new Date(resolved).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }),
          days,
        });
      }
    }

    async function exportPDF() {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW  = doc.internal.pageSize.getWidth();
      const margin = 14;
      let y = margin;
      const now = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
      const getY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

      const mttrFill = (d: number | null): [number,number,number] =>
        d === null ? [100,116,139] : d > 30 ? [239,68,68] : d > 15 ? [234,179,8] : [34,197,94];

      // ── Header ──────────────────────────────────────────────────────────────
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, 28, 'F');
      doc.setTextColor(255,255,255);
      doc.setFontSize(14); doc.setFont('helvetica','bold');
      doc.text('MTTR Report — Mean Time to Remediate', margin, 12);
      doc.setFontSize(9); doc.setFont('helvetica','normal');
      doc.text('Vulnerability logged → remediation Done, by product', margin, 20);
      doc.text(`Generated: ${now}`, pageW - margin, 20, { align: 'right' });
      y = 33;

      // ── Overall KPIs ─────────────────────────────────────────────────────────
      autoTable(doc, {
        startY: y,
        head: [['Overall MTTR', 'Products Tracked', 'Total Remediated Vulns']],
        body: [[
          overallMTTR ? `${overallMTTR}d` : '—',
          rows.filter(r => r.overall !== null).length,
          totalCount,
        ]],
        margin: { left: margin, right: margin },
        styles: { fontSize: 10, halign: 'center', fontStyle: 'bold' },
        headStyles: { fillColor: [30,41,59], textColor: [255,255,255] },
      });
      y = getY() + 7;

      // ── Product Summary Table ─────────────────────────────────────────────────
      autoTable(doc, {
        startY: y,
        head: [['Product','Avg MTTR','Median','Min','Max','Critical','High','Medium','Low','# Fixed']],
        body: rows.map(r => [
          r.name,
          r.overall !== null ? `${r.overall}d` : '—',
          r.median  !== null ? `${r.median}d`  : '—',
          r.min     !== null ? `${r.min}d`      : '—',
          r.max     !== null ? `${r.max}d`      : '—',
          r.bySev.Critical !== null ? `${r.bySev.Critical}d` : '—',
          r.bySev.High     !== null ? `${r.bySev.High}d`     : '—',
          r.bySev.Medium   !== null ? `${r.bySev.Medium}d`   : '—',
          r.bySev.Low      !== null ? `${r.bySev.Low}d`      : '—',
          r.count > 0 ? r.count : '—',
        ]),
        margin: { left: margin, right: margin },
        styles: { fontSize: 7.5, cellPadding: 2 },
        headStyles: { fillColor: [30,41,59], textColor: [255,255,255], fontSize: 7.5 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        didParseCell: (data: any) => {
          if (data.section !== 'body') return;
          // colour the Avg MTTR column (index 1) by threshold
          if (data.column.index === 1) {
            const val = parseFloat(String(data.cell.raw).replace('d',''));
            if (!isNaN(val)) data.cell.styles.textColor = mttrFill(val);
            data.cell.styles.fontStyle = 'bold';
          }
        },
        theme: 'grid',
      });
      y = getY() + 8;

      // ── Per-product vulnerability breakdown ───────────────────────────────────
      const SEV_TEXT: Record<string, [number,number,number]> = {
        Critical: [185,28,28], High: [194,65,12], Medium: [161,98,7], Low: [29,78,216],
      };
      const SEV_FILL: Record<string, [number,number,number]> = {
        Critical: [254,226,226], High: [255,237,213], Medium: [254,249,195], Low: [219,234,254],
      };

      for (const p of PLANVIEW_PRODUCTS) {
        const pRows = vulnMTTRRows.filter(v => v.product === p.name);
        if (pRows.length === 0) continue;

        const avgDays = Math.round(pRows.reduce((s,r)=>s+r.days,0)/pRows.length * 10)/10;

        autoTable(doc, {
          startY: y,
          head: [[{
            content: `${p.icon}  ${p.name}   —   Avg MTTR: ${avgDays}d   (${pRows.length} vulnerabilit${pRows.length===1?'y':'ies'} remediated)`,
            colSpan: 6,
            styles: { fillColor: [30,41,59], textColor: [255,255,255], fontStyle: 'bold', fontSize: 9 },
          }],
          ['Vuln ID','Title','Severity','Logged','Remediated','Days']],
          body: pRows
            .sort((a,b) => b.days - a.days)
            .map(v => [
              v.vulnId,
              v.title.length > 45 ? v.title.slice(0,45) + '…' : v.title,
              v.sev,
              v.dateLogged,
              v.dateRemediated,
              `${v.days}d`,
            ]),
          columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 68 },
            2: { cellWidth: 20 },
            3: { cellWidth: 22 },
            4: { cellWidth: 24 },
            5: { cellWidth: 16, halign: 'right', fontStyle: 'bold' },
          },
          margin: { left: margin, right: margin },
          styles: { fontSize: 7.5, cellPadding: 2 },
          headStyles: { fillColor: [51,65,85], textColor: [203,213,225], fontSize: 7.5 },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          didParseCell: (data: any) => {
            if (data.section !== 'body') return;
            // Severity column colour
            if (data.column.index === 2) {
              const s = String(data.cell.raw);
              if (SEV_TEXT[s]) {
                data.cell.styles.textColor = SEV_TEXT[s];
                data.cell.styles.fillColor = SEV_FILL[s];
                data.cell.styles.fontStyle = 'bold';
              }
            }
            // Days column colour by threshold
            if (data.column.index === 5) {
              const d = parseFloat(String(data.cell.raw).replace('d',''));
              if (!isNaN(d)) data.cell.styles.textColor = mttrFill(d);
            }
          },
          theme: 'grid',
        });
        y = getY() + 5;
      }

      doc.save('mttr-by-product-report.pdf');
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
          <h2 className="text-white font-bold text-lg">MTTR by Product</h2>
          <p className="text-slate-400 text-sm mt-0.5">Mean time to remediate — logged to Done, by product and severity</p>
          </div>
          <ExportPdfBtn onClick={() => { void exportPDF(); }} />
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <KpiCard label="Overall MTTR"     value={overallMTTR ? `${overallMTTR}d` : '—'} color={mttrColor(overallMTTR ? parseFloat(overallMTTR) : null)} sub="Across all products" />
          <KpiCard label="Products Tracked" value={rows.filter(r=>r.overall!==null).length} color="text-white" />
          <KpiCard label="Total Remediated" value={totalCount} color="text-green-400" sub="Vulns with remediation Done" />
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

        {/* Per-product vulnerability breakdown */}
        {vulnMTTRRows.length > 0 && (
          <div className="mt-8 space-y-4">
            <h3 className="text-white font-semibold text-sm px-1">Vulnerability Breakdown by Product</h3>
            {PLANVIEW_PRODUCTS.map(p => {
              const pRows = vulnMTTRRows.filter(v => v.product === p.name).sort((a,b) => b.days - a.days);
              if (pRows.length === 0) return null;
              const avg = Math.round(pRows.reduce((s,r)=>s+r.days,0)/pRows.length * 10)/10;
              return (
                <div key={p.name} className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
                  <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-800">
                    <span>{p.icon}</span>
                    <span className="text-white text-xs font-semibold">{p.name}</span>
                    <span className={`text-xs font-bold ml-1 ${mttrColor(avg)}`}>Avg: {avg}d</span>
                    <span className="text-slate-500 text-xs ml-auto">{pRows.length} remediated</span>
                  </div>
                  <table className="w-full text-xs min-w-[600px]">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800">
                        <th className="text-left px-5 py-2 font-medium">Vuln ID</th>
                        <th className="text-left px-5 py-2 font-medium">Title</th>
                        <th className="text-left px-5 py-2 font-medium">Severity</th>
                        <th className="text-left px-5 py-2 font-medium">Logged</th>
                        <th className="text-left px-5 py-2 font-medium">Remediated</th>
                        <th className="text-right px-5 py-2 font-medium">Days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pRows.map(v => (
                        <tr key={v.vulnId} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                          <td className="px-5 py-2 font-mono text-slate-400">{v.vulnId}</td>
                          <td className="px-5 py-2 text-white max-w-[220px] truncate">{v.title}</td>
                          <td className="px-5 py-2"><Badge label={v.sev} style={SEV_BADGE[v.sev]} /></td>
                          <td className="px-5 py-2 text-slate-400">{v.dateLogged}</td>
                          <td className="px-5 py-2 text-slate-400">{v.dateRemediated}</td>
                          <td className={`px-5 py-2 text-right font-semibold ${mttrColor(v.days)}`}>{v.days}d</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── KPI: SLA Compliance by Product ───────────────────────────────────────
  function renderMetricsSLAProduct() {
    const slaRows = computeSLARows();
    const now = Date.now();

    // Group by product
    const byProduct: Record<string, { total: number; onTime: number; breaches: number; pending: number }> = {};
    for (const p of PLANVIEW_PRODUCTS) byProduct[p.name] = { total: 0, onTime: 0, breaches: 0, pending: 0 };
    for (const r of slaRows) {
      const pb = byProduct[r.product];
      if (!pb) continue;
      pb.total++;
      if (r.isOnTime) pb.onTime++;
      else if (r.isBreach) pb.breaches++;
      else pb.pending++;
    }

    const productRows = PLANVIEW_PRODUCTS.map(p => {
      const d    = byProduct[p.name];
      const pct  = d.total > 0 ? Math.round((d.onTime / d.total) * 100) : null;
      return { ...p, ...d, pct };
    }).filter(r => r.total > 0).sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101));

    const overallTotal     = slaRows.length;
    const overallCompliant = slaRows.filter(r => r.isOnTime).length;
    const overallBreaches  = slaRows.filter(r => r.isBreach).length;
    const overallPct       = overallTotal > 0 ? Math.round((overallCompliant / overallTotal) * 100) : null;

    const worstProduct = productRows[0];
    const chartData = [...productRows].sort((a,b) => (a.pct ?? 0) - (b.pct ?? 0))
      .map(r => ({ name: r.name, 'Compliance %': r.pct ?? 0 }));

    function exportCSV() {
      const csv: (string | number)[][] = [['Product','Total Tracked','Compliant','Breaches','Pending','Compliance %']];
      for (const r of productRows) csv.push([r.name, r.total, r.onTime, r.breaches, r.pending, r.pct ?? 0]);
      downloadCSV(csv, 'sla-by-product.csv');
    }

    // Enrich SLA rows with daysOpen and breachOverdue for UI and PDF
    const nowMs = Date.now();
    type EnrichedSLARow = typeof slaRows[number] & { daysOpen: number; breachOverdue: number | null };
    const enrichedRows: EnrichedSLARow[] = slaRows.map(r => {
      const vuln     = vulnById[r.vulnRef];
      const created  = (vuln?.createdAt as number) ?? 0;
      const daysOpen = created ? Math.round((nowMs - created) / 86_400_000) : 0;
      const breachOverdue = r.isBreach ? Math.abs(r.daysToDeadline) : null;
      return { ...r, daysOpen, breachOverdue };
    });

    async function exportPDF() {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW  = doc.internal.pageSize.getWidth();
      const margin = 14;
      let y = margin;
      const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const getY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

      const SEV_TEXT: Record<string, [number,number,number]> = {
        Critical:[185,28,28], High:[194,65,12], Medium:[161,98,7], Low:[29,78,216],
      };
      const SEV_FILL: Record<string, [number,number,number]> = {
        Critical:[254,226,226], High:[255,237,213], Medium:[254,249,195], Low:[219,234,254],
      };

      // ── Header ──────────────────────────────────────────────────────────────
      doc.setFillColor(15,23,42);
      doc.rect(0, 0, pageW, 30, 'F');
      doc.setTextColor(255,255,255);
      doc.setFontSize(14); doc.setFont('helvetica','bold');
      doc.text('SLA Compliance Report — By Product', margin, 12);
      doc.setFontSize(9); doc.setFont('helvetica','normal');
      doc.text(`Critical ≤ 15d · High ≤ 30d · Medium ≤ 90d`, margin, 21);
      doc.text(`Generated: ${dateStr}`, pageW - margin, 21, { align: 'right' });
      y = 35;

      // ── Overall KPIs ─────────────────────────────────────────────────────────
      autoTable(doc, {
        startY: y,
        head: [['Overall Compliance', 'Total SLA Breaches', 'Worst Product']],
        body: [[
          overallPct !== null ? `${overallPct}%  (${overallCompliant}/${overallTotal} on time)` : '—',
          overallBreaches,
          worstProduct ? `${worstProduct.name}  —  ${worstProduct.pct ?? 0}%` : '—',
        ]],
        margin: { left: margin, right: margin },
        styles: { fontSize: 10, halign: 'center', fontStyle: 'bold' },
        headStyles: { fillColor: [30,41,59], textColor: [255,255,255] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        didParseCell: (data: any) => {
          if (data.section === 'body') {
            if (data.column.index === 0) data.cell.styles.textColor = overallPct !== null && overallPct >= 80 ? [34,197,94] : [239,68,68];
            if (data.column.index === 1) data.cell.styles.textColor = overallBreaches > 0 ? [239,68,68] : [100,116,139];
            if (data.column.index === 2) data.cell.styles.textColor = [249,115,22];
          }
        },
      });
      y = getY() + 7;

      // ── Product Summary Table ─────────────────────────────────────────────────
      autoTable(doc, {
        startY: y,
        head: [['Product', 'Tracked', 'Compliant', 'Breaches', 'Pending', 'Compliance %']],
        body: productRows.map(r => [
          r.name,
          r.total,
          r.onTime,
          r.breaches,
          r.pending,
          r.pct !== null ? `${r.pct}%` : '—',
        ]),
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [30,41,59], textColor: [255,255,255] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        didParseCell: (data: any) => {
          if (data.section !== 'body') return;
          if (data.column.index === 2) data.cell.styles.textColor = [34,197,94];
          if (data.column.index === 3 && Number(data.cell.raw) > 0) {
            data.cell.styles.textColor = [239,68,68];
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.column.index === 5) {
            const pct = parseFloat(String(data.cell.raw));
            data.cell.styles.textColor = pct >= 80 ? [34,197,94] : pct >= 50 ? [234,179,8] : [239,68,68];
            data.cell.styles.fontStyle = 'bold';
          }
        },
        theme: 'grid',
      });
      y = getY() + 8;

      // ── Per-product SLA detail ────────────────────────────────────────────────
      for (const p of PLANVIEW_PRODUCTS) {
        const pRows = enrichedRows
          .filter(r => r.product === p.name)
          .sort((a, b) => {
            // Breaches first (worst first), then pending by deadline, then compliant
            if (a.isBreach && !b.isBreach) return -1;
            if (!a.isBreach && b.isBreach) return 1;
            return a.daysToDeadline - b.daysToDeadline;
          });
        if (pRows.length === 0) continue;

        const pBreaches  = pRows.filter(r => r.isBreach).length;
        const pCompliant = pRows.filter(r => r.isOnTime).length;
        const pPct       = Math.round((pCompliant / pRows.length) * 100);
        const pctFill: [number,number,number] = pPct >= 80 ? [220,252,231] : pPct >= 50 ? [254,249,195] : [254,226,226];
        const pctText: [number,number,number] = pPct >= 80 ? [22,101,52]  : pPct >= 50 ? [113,63,18]    : [153,27,27];

        autoTable(doc, {
          startY: y,
          head: [
            [{
              content: `${p.name}   —   ${pPct}% Compliant  |  ${pBreaches} Breach${pBreaches !== 1 ? 'es' : ''}  |  ${pRows.length} Tracked`,
              colSpan: 7,
              styles: { fillColor: pctFill, textColor: pctText, fontStyle: 'bold', fontSize: 9 },
            }],
            ['Vuln ID', 'Title', 'Severity', 'SLA Deadline', 'Days Open', 'Breach Overdue', 'Result'],
          ],
          body: pRows.map(r => [
            r.vulnId,
            r.title.length > 38 ? r.title.slice(0, 38) + '…' : r.title,
            r.sev ?? '—',
            r.slaDeadline ? new Date(r.slaDeadline).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }) : '—',
            `${r.daysOpen}d`,
            r.breachOverdue !== null ? `${r.breachOverdue}d overdue` : '—',
            r.isOnTime ? 'Compliant' : r.isBreach ? 'BREACH' : 'Pending',
          ]),
          columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 52 },
            2: { cellWidth: 18 },
            3: { cellWidth: 24 },
            4: { cellWidth: 18, halign: 'right' },
            5: { cellWidth: 24, halign: 'right' },
            6: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
          },
          margin: { left: margin, right: margin },
          styles: { fontSize: 7.5, cellPadding: 2 },
          headStyles: { fillColor: [51,65,85], textColor: [203,213,225], fontSize: 7.5 },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          didParseCell: (data: any) => {
            if (data.section !== 'body') return;
            // Severity colour
            if (data.column.index === 2) {
              const s = String(data.cell.raw);
              if (SEV_TEXT[s]) { data.cell.styles.textColor = SEV_TEXT[s]; data.cell.styles.fillColor = SEV_FILL[s]; data.cell.styles.fontStyle = 'bold'; }
            }
            // Days open: red if > SLA threshold
            if (data.column.index === 4) {
              const d = parseFloat(String(data.cell.raw));
              const rowData = pRows[data.row.index];
              const threshold = SLA_DAYS[rowData?.sev ?? ''] ?? 999;
              if (!rowData?.isResolved && d > threshold) data.cell.styles.textColor = [239,68,68];
            }
            // Breach overdue — always red
            if (data.column.index === 5 && String(data.cell.raw) !== '—') {
              data.cell.styles.textColor = [239,68,68];
              data.cell.styles.fontStyle = 'bold';
            }
            // Result column colour
            if (data.column.index === 6) {
              const v = String(data.cell.raw);
              if (v === 'Compliant') data.cell.styles.textColor = [34,197,94];
              else if (v === 'BREACH') { data.cell.styles.textColor = [239,68,68]; data.cell.styles.fillColor = [254,226,226]; }
              else data.cell.styles.textColor = [148,163,184];
            }
          },
          theme: 'grid',
        });
        y = getY() + 5;
      }

      doc.save('sla-by-product-report.pdf');
    }

    // Breach detail rows for the selected product (if any) — show all breaches
    const breachRows = enrichedRows.filter(r => r.isBreach || r.isOnTime).sort((a,b) => a.daysToDeadline - b.daysToDeadline);

    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-bold text-lg">SLA Compliance by Product</h2>
            <p className="text-slate-400 text-sm mt-0.5">SLA thresholds — Critical: {SLA_DAYS.Critical}d · High: {SLA_DAYS.High}d · Medium: {SLA_DAYS.Medium}d · Low: {SLA_DAYS.Low}d</p>
          </div>
          <div className="flex items-center gap-2">
            <ExportBtn onClick={exportCSV} />
            <ExportPdfBtn onClick={() => { void exportPDF(); }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <KpiCard label="Overall Compliance" value={overallPct !== null ? `${overallPct}%` : '—'} color={overallPct !== null && overallPct >= 80 ? 'text-green-400' : 'text-red-400'} sub={`${overallCompliant}/${overallTotal} on time`} />
          <KpiCard label="Total SLA Breaches" value={overallBreaches} color={overallBreaches > 0 ? 'text-red-400' : 'text-slate-400'} />
          <KpiCard label="Worst Product" value={worstProduct?.name ?? '—'} color="text-orange-400" sub={worstProduct ? `${worstProduct.pct ?? 0}% compliance` : undefined} />
        </div>

        {chartData.length > 0 && (
          <ChartCard title="Compliance % by Product" sub="Sorted worst to best — green ≥ 80%">
            <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 36)}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 50, left: 70, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" {...axisProps} domain={[0,100]} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="name" {...axisProps} width={90} />
                <Tooltip {...tooltipStyle} formatter={(v: unknown) => [`${v}%`, 'Compliance']} />
                <Bar dataKey="Compliance %" radius={[0,4,4,0]}>
                  {chartData.map(e => <Cell key={e.name} fill={e['Compliance %'] >= 80 ? '#22c55e' : e['Compliance %'] >= 50 ? '#eab308' : '#ef4444'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Product summary table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mt-6">
          <div className="px-5 py-4 border-b border-slate-800"><h3 className="text-white font-semibold text-sm">Per-Product Summary</h3></div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs">
                <th className="text-left px-5 py-3 font-medium">Product</th>
                <th className="text-right px-5 py-3 font-medium">Tracked</th>
                <th className="text-right px-5 py-3 font-medium text-green-400">Compliant</th>
                <th className="text-right px-5 py-3 font-medium text-red-400">Breaches</th>
                <th className="text-right px-5 py-3 font-medium text-slate-400">Pending</th>
                <th className="text-right px-5 py-3 font-medium">Compliance %</th>
              </tr>
            </thead>
            <tbody>
              {productRows.map(r => (
                <tr key={r.name} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                  <td className="px-5 py-3"><div className="flex items-center gap-2"><span>{r.icon}</span><span className="text-white text-xs font-medium">{r.name}</span></div></td>
                  <td className="px-5 py-3 text-right text-xs text-white">{r.total}</td>
                  <td className="px-5 py-3 text-right text-xs text-green-400 font-medium">{r.onTime}</td>
                  <td className="px-5 py-3 text-right text-xs">{r.breaches > 0 ? <span className="text-red-400 font-semibold">{r.breaches}</span> : <span className="text-slate-600">—</span>}</td>
                  <td className="px-5 py-3 text-right text-xs text-slate-400">{r.pending > 0 ? r.pending : <span className="text-slate-600">—</span>}</td>
                  <td className={`px-5 py-3 text-right text-sm font-semibold ${r.pct !== null && r.pct >= 80 ? 'text-green-400' : r.pct !== null && r.pct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {r.pct !== null ? `${r.pct}%` : <span className="text-slate-600 font-normal text-xs">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Per-product SLA breakdown */}
        {PLANVIEW_PRODUCTS.map(p => {
          const pRows = enrichedRows
            .filter(r => r.product === p.name)
            .sort((a,b) => {
              if (a.isBreach && !b.isBreach) return -1;
              if (!a.isBreach && b.isBreach) return 1;
              return a.daysToDeadline - b.daysToDeadline;
            });
          if (pRows.length === 0) return null;
          const pIcon    = PLANVIEW_PRODUCTS.find(x => x.name === p.name)?.icon ?? '';
          const pBreaches  = pRows.filter(r => r.isBreach).length;
          const pCompliant = pRows.filter(r => r.isOnTime).length;
          const pPct       = Math.round((pCompliant / pRows.length) * 100);
          return (
            <div key={p.name} className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto mt-5">
              <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-3 flex-wrap">
                <span>{pIcon}</span>
                <span className="text-white text-xs font-semibold">{p.name}</span>
                <span className={`text-xs font-bold ${pPct >= 80 ? 'text-green-400' : pPct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{pPct}% compliant</span>
                {pBreaches > 0 && <span className="text-xs text-red-400 font-semibold">{pBreaches} breach{pBreaches !== 1 ? 'es' : ''}</span>}
                <span className="ml-auto text-xs text-slate-500">{pRows.length} tracked</span>
              </div>
              <table className="w-full text-xs min-w-[750px]">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    {['Vuln ID','Title','Severity','SLA Deadline','Days Open','Breach Overdue','Result'].map(h => (
                      <th key={h} className="text-left px-4 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pRows.map((r, i) => (
                    <tr key={i} className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition ${r.isBreach ? 'bg-red-500/5' : ''}`}>
                      <td className="px-4 py-2 font-mono text-slate-400">{r.vulnId}</td>
                      <td className="px-4 py-2 text-white max-w-[180px] truncate">{r.title}</td>
                      <td className="px-4 py-2">{r.sev ? <Badge label={r.sev} style={SEV_BADGE[r.sev]} /> : <Dash />}</td>
                      <td className="px-4 py-2 text-slate-400 whitespace-nowrap">
                        {r.slaDeadline ? new Date(r.slaDeadline).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }) : '—'}
                      </td>
                      <td className={`px-4 py-2 font-medium ${!r.isResolved && r.daysOpen > (SLA_DAYS[r.sev ?? ''] ?? 999) ? 'text-red-400' : 'text-slate-400'}`}>
                        {r.daysOpen}d
                      </td>
                      <td className="px-4 py-2 font-semibold">
                        {r.breachOverdue !== null
                          ? <span className="text-red-400">{r.breachOverdue}d overdue</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-2">
                        {r.isOnTime
                          ? <Badge label="Compliant" style="bg-green-500/10 text-green-400 border-green-500/20" />
                          : r.isBreach
                          ? <Badge label="BREACH" style="bg-red-500/20 text-red-300 border-red-500/40" />
                          : <Badge label="Pending" style="bg-slate-700 text-slate-300 border-slate-600" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    );
  }

  // ── KPI: SLA Compliance by Severity ──────────────────────────────────────
  function renderMetricsSLASeverity() {
    const slaRows = computeSLARows();

    const total     = slaRows.length;
    const compliant = slaRows.filter(r => r.isOnTime).length;
    const breaches  = slaRows.filter(r => r.isBreach).length;
    const pending   = total - compliant - breaches;
    const compPct   = total > 0 ? Math.round((compliant / total) * 100) : null;

    const compliancePie = [
      { name: 'Compliant', value: compliant },
      { name: 'Breached',  value: breaches  },
      { name: 'Pending',   value: pending   },
    ].filter(d => d.value > 0);
    const pieColors: Record<string, string> = { Compliant: '#22c55e', Breached: '#ef4444', Pending: '#64748b' };

    const slaBySev: Record<string, { total: number; onTime: number }> = { Critical: {total:0,onTime:0}, High:{total:0,onTime:0}, Medium:{total:0,onTime:0}, Low:{total:0,onTime:0} };
    for (const r of slaRows) {
      if (r.sev && r.sev in slaBySev) { slaBySev[r.sev].total++; if (r.isOnTime) slaBySev[r.sev].onTime++; }
    }
    const sevCompData = Object.entries(slaBySev).filter(([,d])=>d.total>0).map(([name,d])=>({ name, 'Compliance %': Math.round((d.onTime/d.total)*100) }));

    // SLA thresholds per severity (days): Critical=15, High=30, Medium=90, Low=best-effort
    const SLA_THRESHOLD: Record<string, number> = { Critical: 15, High: 30, Medium: 90, Low: 9999 };

    // Enrich with daysOpen and breachOverdue
    const nowMs2 = Date.now();
    type ESRow = typeof slaRows[number] & { daysOpen: number; breachOverdue: number | null };
    const enrichedSevRows: ESRow[] = slaRows.map(r => {
      const vuln     = vulnById[r.vulnRef];
      const created  = (vuln?.createdAt as number) ?? 0;
      const daysOpen = created ? Math.round((nowMs2 - created) / 86_400_000) : 0;
      const breachOverdue = r.isBreach ? Math.abs(r.daysToDeadline) : null;
      return { ...r, daysOpen, breachOverdue };
    });

    function exportCSV() {
      const csv: (string | number)[][] = [['Vuln ID','Title','Product','Severity','SLA Deadline','Days Open','Breach Overdue','Result']];
      for (const r of enrichedSevRows) csv.push([r.vulnId, r.title, r.product, r.sev ?? '—', r.slaDeadline, `${r.daysOpen}d`, r.breachOverdue !== null ? `${r.breachOverdue}d overdue` : '—', r.isOnTime ? 'Compliant' : r.isBreach ? 'BREACH' : 'Pending']);
      downloadCSV(csv, 'sla-by-severity.csv');
    }

    async function exportPDF() {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW  = doc.internal.pageSize.getWidth();
      const margin = 14;
      let y = margin;
      const dateStr = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
      const getY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

      const SEV_TEXT_PDF: Record<string, [number,number,number]> = {
        Critical:[185,28,28], High:[194,65,12], Medium:[161,98,7], Low:[29,78,216],
      };
      const SEV_FILL_PDF: Record<string, [number,number,number]> = {
        Critical:[254,226,226], High:[255,237,213], Medium:[254,249,195], Low:[219,234,254],
      };
      const SEV_HEADER_FILL: Record<string, [number,number,number]> = {
        Critical:[220,38,38], High:[234,88,12], Medium:[202,138,4], Low:[37,99,235],
      };

      // ── Header ──────────────────────────────────────────────────────────────
      doc.setFillColor(15,23,42);
      doc.rect(0, 0, pageW, 30, 'F');
      doc.setTextColor(255,255,255);
      doc.setFontSize(14); doc.setFont('helvetica','bold');
      doc.text('SLA Compliance Report — By Severity', margin, 12);
      doc.setFontSize(9); doc.setFont('helvetica','normal');
      doc.text('Critical ≤ 15d · High ≤ 30d · Medium ≤ 90d · Low — Best effort', margin, 21);
      doc.text(`Generated: ${dateStr}`, pageW - margin, 21, { align: 'right' });
      y = 35;

      // ── Overall KPIs ─────────────────────────────────────────────────────────
      autoTable(doc, {
        startY: y,
        head: [['Overall Compliance', 'Total Tracked', 'Compliant', 'SLA Breaches']],
        body: [[
          compPct !== null ? `${compPct}%` : '—',
          total, compliant, breaches,
        ]],
        margin: { left: margin, right: margin },
        styles: { fontSize: 10, halign: 'center', fontStyle: 'bold' },
        headStyles: { fillColor: [30,41,59], textColor: [255,255,255] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        didParseCell: (data: any) => {
          if (data.section !== 'body') return;
          if (data.column.index === 0) data.cell.styles.textColor = compPct !== null && compPct >= 80 ? [34,197,94] : [239,68,68];
          if (data.column.index === 2) data.cell.styles.textColor = [34,197,94];
          if (data.column.index === 3) data.cell.styles.textColor = breaches > 0 ? [239,68,68] : [100,116,139];
        },
      });
      y = getY() + 7;

      // ── Per-severity summary row ──────────────────────────────────────────────
      autoTable(doc, {
        startY: y,
        head: [['Severity', 'SLA Threshold', 'Tracked', 'Compliant', 'Breaches', 'Compliance %']],
        body: (['Critical','High','Medium','Low'] as const).map(sev => {
          const d   = slaBySev[sev];
          const pct = d.total > 0 ? Math.round((d.onTime / d.total) * 100) : null;
          return [sev, `${SLA_THRESHOLD[sev] === 9999 ? 'Best effort' : SLA_THRESHOLD[sev] + 'd'}`, d.total, d.onTime, d.total - d.onTime, pct !== null ? `${pct}%` : '—'];
        }),
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [30,41,59], textColor: [255,255,255] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        didParseCell: (data: any) => {
          if (data.section !== 'body') return;
          const sev = ['Critical','High','Medium','Low'][data.row.index];
          if (data.column.index === 0 && sev) {
            data.cell.styles.textColor = SEV_TEXT_PDF[sev];
            data.cell.styles.fillColor = SEV_FILL_PDF[sev];
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.column.index === 4 && Number(data.cell.raw) > 0) {
            data.cell.styles.textColor = [239,68,68]; data.cell.styles.fontStyle = 'bold';
          }
          if (data.column.index === 5) {
            const pct = parseFloat(String(data.cell.raw));
            data.cell.styles.textColor = pct >= 80 ? [34,197,94] : pct >= 50 ? [234,179,8] : [239,68,68];
            data.cell.styles.fontStyle = 'bold';
          }
        },
        theme: 'grid',
      });
      y = getY() + 8;

      // ── Per-severity detailed breakdown ───────────────────────────────────────
      for (const sev of ['Critical','High','Medium','Low'] as const) {
        const sevRows = enrichedSevRows
          .filter(r => r.sev === sev)
          .sort((a,b) => {
            if (a.isBreach && !b.isBreach) return -1;
            if (!a.isBreach && b.isBreach) return 1;
            return a.daysToDeadline - b.daysToDeadline;
          });
        if (sevRows.length === 0) continue;

        const sevCompliant = sevRows.filter(r => r.isOnTime).length;
        const sevBreaches  = sevRows.filter(r => r.isBreach).length;
        const sevPct       = Math.round((sevCompliant / sevRows.length) * 100);
        const threshold    = SLA_THRESHOLD[sev];

        autoTable(doc, {
          startY: y,
          head: [
            [{
              content: `${sev}   —   SLA: ${threshold === 9999 ? 'Best effort' : threshold + 'd'}   |   ${sevPct}% Compliant  |  ${sevBreaches} Breach${sevBreaches !== 1 ? 'es' : ''}  |  ${sevRows.length} Tracked`,
              colSpan: 7,
              styles: { fillColor: SEV_HEADER_FILL[sev], textColor: [255,255,255], fontStyle: 'bold', fontSize: 9 },
            }],
            ['Vuln ID','Title','Product','SLA Deadline','Days Open','Breach Overdue','Result'],
          ],
          body: sevRows.map(r => [
            r.vulnId,
            r.title.length > 38 ? r.title.slice(0,38) + '…' : r.title,
            r.product,
            r.slaDeadline ? new Date(r.slaDeadline).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }) : '—',
            `${r.daysOpen}d`,
            r.breachOverdue !== null ? `${r.breachOverdue}d overdue` : '—',
            r.isOnTime ? 'Compliant' : r.isBreach ? 'BREACH' : 'Pending',
          ]),
          columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 52 },
            2: { cellWidth: 22 },
            3: { cellWidth: 24 },
            4: { cellWidth: 16, halign: 'right' },
            5: { cellWidth: 24, halign: 'right' },
            6: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
          },
          margin: { left: margin, right: margin },
          styles: { fontSize: 7.5, cellPadding: 2 },
          headStyles: { fillColor: [51,65,85], textColor: [203,213,225], fontSize: 7.5 },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          didParseCell: (data: any) => {
            if (data.section !== 'body') return;
            if (data.column.index === 4) {
              const d = parseFloat(String(data.cell.raw));
              const row = sevRows[data.row.index];
              if (!row?.isResolved && !isNaN(d) && d > threshold) data.cell.styles.textColor = [239,68,68];
            }
            if (data.column.index === 5 && String(data.cell.raw) !== '—') {
              data.cell.styles.textColor = [239,68,68]; data.cell.styles.fontStyle = 'bold';
            }
            if (data.column.index === 6) {
              const v = String(data.cell.raw);
              if (v === 'Compliant') data.cell.styles.textColor = [34,197,94];
              else if (v === 'BREACH') { data.cell.styles.textColor = [239,68,68]; data.cell.styles.fillColor = [254,226,226]; }
              else data.cell.styles.textColor = [148,163,184];
            }
          },
          theme: 'grid',
        });
        y = getY() + 5;
      }

      doc.save('sla-by-severity-report.pdf');
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-bold text-lg">SLA Compliance by Severity</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              Thresholds — Critical: 15d · High: 30d · Medium: 90d · Low: Best effort
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExportBtn onClick={exportCSV} />
            <ExportPdfBtn onClick={() => { void exportPDF(); }} />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <KpiCard label="Overall Compliance" value={compPct !== null ? `${compPct}%` : '—'} color={compPct !== null && compPct >= 80 ? 'text-green-400' : 'text-red-400'} />
          <KpiCard label="Total Tracked"      value={total}     color="text-white" />
          <KpiCard label="Compliant"          value={compliant} color="text-green-400" />
          <KpiCard label="SLA Breaches"       value={breaches}  color={breaches > 0 ? 'text-red-400' : 'text-slate-400'} />
        </div>

        {/* Per-severity summary cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {Object.entries(slaBySev).filter(([,d])=>d.total>0).map(([sev, d]) => {
            const pct = Math.round((d.onTime / d.total) * 100);
            return (
              <div key={sev} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge label={sev} style={SEV_BADGE[sev]} />
                  <span className="text-slate-500 text-xs">SLA: {SLA_DAYS[sev]}d</span>
                </div>
                <p className={`text-xl font-bold ${pct >= 80 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{pct}%</p>
                <p className="text-slate-500 text-xs mt-0.5">{d.onTime}/{d.total} on time</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <ChartCard title="Overall Compliance Status">
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

        {/* Per-severity breakdown */}
        {(['Critical','High','Medium','Low'] as const).map(sev => {
          const sevRows = enrichedSevRows
            .filter(r => r.sev === sev)
            .sort((a,b) => { if (a.isBreach && !b.isBreach) return -1; if (!a.isBreach && b.isBreach) return 1; return a.daysToDeadline - b.daysToDeadline; });
          if (sevRows.length === 0) return null;
          const sevCompliant = sevRows.filter(r => r.isOnTime).length;
          const sevBreaches  = sevRows.filter(r => r.isBreach).length;
          const sevPct       = Math.round((sevCompliant / sevRows.length) * 100);
          const threshold    = SLA_THRESHOLD[sev];
          return (
            <div key={sev} className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto mt-5">
              <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-3 flex-wrap">
                <Badge label={sev} style={SEV_BADGE[sev]} />
                <span className="text-slate-400 text-xs">SLA: {threshold === 9999 ? 'Best effort' : `${threshold}d`}</span>
                <span className={`text-xs font-bold ${sevPct >= 80 ? 'text-green-400' : sevPct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{sevPct}% compliant</span>
                {sevBreaches > 0 && <span className="text-xs text-red-400 font-semibold">{sevBreaches} breach{sevBreaches !== 1 ? 'es' : ''}</span>}
                <span className="ml-auto text-xs text-slate-500">{sevRows.length} tracked</span>
              </div>
              <table className="w-full text-xs min-w-[750px]">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    {['Vuln ID','Title','Product','SLA Deadline','Days Open','Breach Overdue','Result'].map(h => (
                      <th key={h} className="text-left px-4 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sevRows.map((r, i) => (
                    <tr key={i} className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition ${r.isBreach ? 'bg-red-500/5' : ''}`}>
                      <td className="px-4 py-2 font-mono text-slate-400">{r.vulnId}</td>
                      <td className="px-4 py-2 text-white max-w-[180px] truncate">{r.title}</td>
                      <td className="px-4 py-2 text-slate-400">{r.product}</td>
                      <td className="px-4 py-2 text-slate-400 whitespace-nowrap">
                        {r.slaDeadline ? new Date(r.slaDeadline).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }) : '—'}
                      </td>
                      <td className={`px-4 py-2 font-medium ${!r.isResolved && r.daysOpen > threshold ? 'text-red-400' : 'text-slate-400'}`}>
                        {r.daysOpen}d
                      </td>
                      <td className="px-4 py-2 font-semibold">
                        {r.breachOverdue !== null
                          ? <span className="text-red-400">{r.breachOverdue}d overdue</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-2">
                        {r.isOnTime
                          ? <Badge label="Compliant" style="bg-green-500/10 text-green-400 border-green-500/20" />
                          : r.isBreach
                          ? <Badge label="BREACH" style="bg-red-500/20 text-red-300 border-red-500/40" />
                          : <Badge label="Pending" style="bg-slate-700 text-slate-300 border-slate-600" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    );
  }

  // ── KPI: Open Vulnerability Aging ─────────────────────────────────────────
  function renderMetricsAging() {
    const openVulns = kpiFiltered.filter(v => v.status !== 'Remediated' && v.status !== 'Closed');
    const BUCKETS = ['< 30d', '30–60d', '60–90d', '> 90d'] as const;
    const BUCKET_COLORS: Record<string, string> = { '< 30d': '#22c55e', '30–60d': '#eab308', '60–90d': '#f97316', '> 90d': '#ef4444' };

    const total = openVulns.length;
    const gt30  = openVulns.filter(v => daysOpen(v.createdAt as number) > 30).length;
    const gt60  = openVulns.filter(v => daysOpen(v.createdAt as number) > 60).length;
    const gt90  = openVulns.filter(v => daysOpen(v.createdAt as number) > 90).length;

    const productChartData = PLANVIEW_PRODUCTS.map(p => {
      const row: Record<string, number | string> = { name: p.name };
      for (const b of BUCKETS) row[b] = 0;
      const pas = allPAs.filter(pa => (pa.productName as string) === p.name && (pa.impactStatus as string) === 'Impacted');
      for (const pa of pas) {
        const vuln = vulnById[pa.vulnerabilityRef as string];
        if (!vuln || vuln.status === 'Remediated' || vuln.status === 'Closed') continue;
        if (!openVulns.find(v => (v as { id: string }).id === (pa.vulnerabilityRef as string))) continue;
        const d = daysOpen(vuln.createdAt as number);
        (row[ageBucket(d)] as number)++;
      }
      return row;
    }).filter(r => BUCKETS.some(b => (r[b] as number) > 0));

    const sevChartData = SEVERITIES.map(sev => {
      const row: Record<string, number | string> = { name: sev };
      for (const b of BUCKETS) row[b] = 0;
      for (const v of openVulns) {
        if (globalSevByVuln[(v as { id: string }).id] !== sev) continue;
        (row[ageBucket(daysOpen(v.createdAt as number))] as number)++;
      }
      return row;
    }).filter(r => BUCKETS.some(b => (r[b] as number) > 0));

    const tableRows = [...openVulns]
      .sort((a,b) => daysOpen(a.createdAt as number) < daysOpen(b.createdAt as number) ? 1 : -1)
      .map(v => {
        const vid  = (v as { id: string }).id;
        const days = daysOpen(v.createdAt as number);
        const products = impactedProductsByVuln[vid] ?? [];
        return { v, vid, days, sev: globalSevByVuln[vid], bucket: ageBucket(days), products };
      });

    // Per-product breakdown: which open vulns are open for each product and how long
    const perProductRows = PLANVIEW_PRODUCTS.map(p => {
      const rows = allPAs
        .filter(pa => (pa.productName as string) === p.name && (pa.impactStatus as string) === 'Impacted')
        .flatMap(pa => {
          const vuln = vulnById[pa.vulnerabilityRef as string];
          if (!vuln || vuln.status === 'Remediated' || vuln.status === 'Closed') return [];
          if (!openVulns.find(v => (v as { id: string }).id === (pa.vulnerabilityRef as string))) return [];
          const days = daysOpen(vuln.createdAt as number);
          const sev  = globalSevByVuln[(pa.vulnerabilityRef as string)];
          return [{ vuln, days, sev, bucket: ageBucket(days) }];
        })
        .sort((a,b) => b.days - a.days);
      return { ...p, rows };
    }).filter(p => p.rows.length > 0);

    async function exportPDF() {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW  = doc.internal.pageSize.getWidth();
      const margin = 14;
      let y = margin;
      const dateStr = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
      const getY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

      const BUCKET_PDF_FILL: Record<string, [number,number,number]> = {
        '< 30d':  [220,252,231], '30–60d': [254,249,195],
        '60–90d': [255,237,213], '> 90d':  [254,226,226],
      };
      const BUCKET_PDF_TEXT: Record<string, [number,number,number]> = {
        '< 30d':  [22,101,52],  '30–60d': [113,63,18],
        '60–90d': [154,52,18],  '> 90d':  [153,27,27],
      };
      const SEV_TEXT_PDF: Record<string, [number,number,number]> = {
        Critical:[185,28,28], High:[194,65,12], Medium:[161,98,7], Low:[29,78,216],
      };
      const SEV_FILL_PDF: Record<string, [number,number,number]> = {
        Critical:[254,226,226], High:[255,237,213], Medium:[254,249,195], Low:[219,234,254],
      };

      // ── Header ──────────────────────────────────────────────────────────────
      doc.setFillColor(15,23,42);
      doc.rect(0, 0, pageW, 28, 'F');
      doc.setTextColor(255,255,255);
      doc.setFontSize(14); doc.setFont('helvetica','bold');
      doc.text('Open Vulnerability Aging Report', margin, 12);
      doc.setFontSize(9); doc.setFont('helvetica','normal');
      doc.text(`${total} open vulnerabilities — last 12 months`, margin, 20);
      doc.text(`Generated: ${dateStr}`, pageW - margin, 20, { align: 'right' });
      y = 33;

      // ── Overall KPIs ─────────────────────────────────────────────────────────
      autoTable(doc, {
        startY: y,
        head: [['Total Open', '> 30 Days', '> 60 Days', '> 90 Days']],
        body: [[total, gt30, gt60, gt90]],
        margin: { left: margin, right: margin },
        styles: { fontSize: 11, halign: 'center', fontStyle: 'bold' },
        headStyles: { fillColor: [30,41,59], textColor: [255,255,255] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        didParseCell: (data: any) => {
          if (data.section !== 'body') return;
          if (data.column.index === 1 && gt30  > 0) data.cell.styles.textColor = [234,179,8];
          if (data.column.index === 2 && gt60  > 0) data.cell.styles.textColor = [249,115,22];
          if (data.column.index === 3 && gt90  > 0) data.cell.styles.textColor = [239,68,68];
        },
      });
      y = getY() + 8;

      // ── Section 1: Age Buckets by Product ────────────────────────────────────
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(30,41,59);
      doc.text('Age Buckets by Product', margin, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        head: [['Product', '< 30d', '30–60d', '60–90d', '> 90d', 'Total Open']],
        body: PLANVIEW_PRODUCTS.map(p => {
          const pData = productChartData.find(r => r.name === p.name);
          const c1 = (pData?.['< 30d']  as number) ?? 0;
          const c2 = (pData?.['30–60d'] as number) ?? 0;
          const c3 = (pData?.['60–90d'] as number) ?? 0;
          const c4 = (pData?.['> 90d']  as number) ?? 0;
          const tot = c1 + c2 + c3 + c4;
          return [p.name, c1 || '—', c2 || '—', c3 || '—', c4 || '—', tot || '—'];
        }).filter(r => r[5] !== '—'),
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2.5, halign: 'center' },
        columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
        headStyles: { fillColor: [30,41,59], textColor: [255,255,255] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        didParseCell: (data: any) => {
          if (data.section !== 'body' || data.column.index === 0 || data.cell.raw === '—') return;
          const buckets = ['< 30d','30–60d','60–90d','> 90d'];
          const b = buckets[data.column.index - 1];
          if (b && Number(data.cell.raw) > 0) {
            data.cell.styles.textColor = BUCKET_PDF_TEXT[b];
            data.cell.styles.fillColor = BUCKET_PDF_FILL[b];
            data.cell.styles.fontStyle = 'bold';
          }
        },
        theme: 'grid',
      });
      y = getY() + 8;

      // ── Section 2: Age Buckets by Severity ───────────────────────────────────
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(30,41,59);
      doc.text('Age Buckets by Severity', margin, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        head: [['Severity', '< 30d', '30–60d', '60–90d', '> 90d', 'Total Open']],
        body: SEVERITIES.map(sev => {
          const sData = sevChartData.find(r => r.name === sev);
          const c1 = (sData?.['< 30d']  as number) ?? 0;
          const c2 = (sData?.['30–60d'] as number) ?? 0;
          const c3 = (sData?.['60–90d'] as number) ?? 0;
          const c4 = (sData?.['> 90d']  as number) ?? 0;
          const tot = c1 + c2 + c3 + c4;
          return [sev, c1 || '—', c2 || '—', c3 || '—', c4 || '—', tot || '—'];
        }).filter(r => r[5] !== '—'),
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2.5, halign: 'center' },
        columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
        headStyles: { fillColor: [30,41,59], textColor: [255,255,255] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        didParseCell: (data: any) => {
          if (data.section !== 'body') return;
          // Severity column
          if (data.column.index === 0) {
            const sev = String(data.cell.raw);
            if (SEV_TEXT_PDF[sev]) { data.cell.styles.textColor = SEV_TEXT_PDF[sev]; data.cell.styles.fillColor = SEV_FILL_PDF[sev]; data.cell.styles.fontStyle = 'bold'; }
          }
          if (data.column.index > 0 && data.cell.raw !== '—') {
            const buckets = ['< 30d','30–60d','60–90d','> 90d'];
            const b = buckets[data.column.index - 1];
            if (b && Number(data.cell.raw) > 0) {
              data.cell.styles.textColor = BUCKET_PDF_TEXT[b];
              data.cell.styles.fillColor = BUCKET_PDF_FILL[b];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
        theme: 'grid',
      });
      y = getY() + 10;

      // ── Section 3: Per-Product Open Vulnerability Detail ─────────────────────
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(30,41,59);
      doc.text('Open Vulnerabilities by Product', margin, y);
      y += 5;

      for (const p of perProductRows) {
        const oldest = p.rows[0]?.days ?? 0;
        const agingColor: [number,number,number] = oldest > 90 ? [239,68,68] : oldest > 60 ? [249,115,22] : oldest > 30 ? [234,179,8] : [34,197,94];

        autoTable(doc, {
          startY: y,
          head: [
            [{
              content: `${p.icon}  ${p.name}   —   ${p.rows.length} open vulnerabilit${p.rows.length===1?'y':'ies'}   |   Oldest: ${oldest}d`,
              colSpan: 5,
              styles: { fillColor: [30,41,59], textColor: agingColor, fontStyle: 'bold', fontSize: 9 },
            }],
            ['Vuln ID', 'Title', 'Severity', 'Status', 'Days Open'],
          ],
          body: p.rows.map(r => [
            r.vuln.vulnerabilityId as string,
            (r.vuln.title as string).length > 55 ? (r.vuln.title as string).slice(0,55) + '…' : r.vuln.title as string,
            r.sev ?? '—',
            (r.vuln.status as string) ?? 'Open',
            `${r.days}d  [${r.bucket}]`,
          ]),
          columnStyles: {
            0: { cellWidth: 24 },
            1: { cellWidth: 76 },
            2: { cellWidth: 20 },
            3: { cellWidth: 28 },
            4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
          },
          margin: { left: margin, right: margin },
          styles: { fontSize: 7.5, cellPadding: 2 },
          headStyles: { fillColor: [51,65,85], textColor: [203,213,225], fontSize: 7.5 },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          didParseCell: (data: any) => {
            if (data.section !== 'body') return;
            if (data.column.index === 2) {
              const sev = String(data.cell.raw);
              if (SEV_TEXT_PDF[sev]) { data.cell.styles.textColor = SEV_TEXT_PDF[sev]; data.cell.styles.fillColor = SEV_FILL_PDF[sev]; data.cell.styles.fontStyle = 'bold'; }
            }
            if (data.column.index === 4) {
              const d = parseFloat(String(data.cell.raw));
              data.cell.styles.textColor = d > 90 ? [239,68,68] : d > 60 ? [249,115,22] : d > 30 ? [234,179,8] : [34,197,94];
            }
          },
          theme: 'grid',
        });
        y = getY() + 4;
      }

      doc.save('open-vulnerability-aging-report.pdf');
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
          <h2 className="text-white font-bold text-lg">Open Vulnerability Aging</h2>
          <p className="text-slate-400 text-sm mt-0.5">How long open vulnerabilities have been unresolved</p>
          </div>
          <ExportPdfBtn onClick={() => { void exportPDF(); }} />
        </div>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <KpiCard label="Total Open" value={total} color="text-white" />
          <KpiCard label="> 30 days"  value={gt30}  color={gt30  > 0 ? 'text-yellow-400' : 'text-slate-400'} />
          <KpiCard label="> 60 days"  value={gt60}  color={gt60  > 0 ? 'text-orange-400' : 'text-slate-400'} />
          <KpiCard label="> 90 days"  value={gt90}  color={gt90  > 0 ? 'text-red-400'    : 'text-slate-400'} />
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
                  {['Vuln ID','Title','Severity','Status','Products Impacted','Days Open','Age Bucket'].map(h => <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {tableRows.map(r => (
                  <tr key={r.vid} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.v.vulnerabilityId as string}</td>
                    <td className="px-4 py-3 text-white text-xs max-w-[180px] truncate">{r.v.title as string}</td>
                    <td className="px-4 py-3">{r.sev ? <Badge label={r.sev} style={SEV_BADGE[r.sev]} /> : <Dash />}</td>
                    <td className="px-4 py-3"><Badge label={(r.v.status as string) ?? 'Open'} style={STATUS_BADGE[(r.v.status as string) ?? 'Open']} /></td>
                    <td className="px-4 py-3 text-xs text-slate-400">{r.products.length > 0 ? r.products.length : <Dash />}</td>
                    <td className={`px-4 py-3 text-xs font-semibold ${r.days > 90 ? 'text-red-400' : r.days > 60 ? 'text-orange-400' : r.days > 30 ? 'text-yellow-400' : 'text-slate-400'}`}>{r.days}d</td>
                    <td className="px-4 py-3"><Badge label={r.bucket} style={AGE_BUCKET_STYLE[r.bucket]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {perProductRows.length > 0 && (
          <div className="mt-6 space-y-4">
            <h3 className="text-white font-semibold text-sm">Open Vulnerabilities by Product</h3>
            {perProductRows.map(p => (
              <div key={p.name} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-800/40">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{p.icon}</span>
                    <span className="text-white font-semibold text-sm">{p.name}</span>
                    <span className="text-slate-400 text-xs ml-1">{p.rows.length} open</span>
                  </div>
                  <span className={`text-xs font-semibold ${p.rows[0]?.days > 90 ? 'text-red-400' : p.rows[0]?.days > 60 ? 'text-orange-400' : p.rows[0]?.days > 30 ? 'text-yellow-400' : 'text-slate-400'}`}>
                    Oldest: {p.rows[0]?.days ?? 0}d
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs">
                      {['Vuln ID','Title','Severity','Status','Days Open','Age Bucket'].map(h => (
                        <th key={h} className="text-left px-4 py-2 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {p.rows.map((r, i) => (
                      <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                        <td className="px-4 py-2 font-mono text-xs text-slate-400">{r.vuln.vulnerabilityId as string}</td>
                        <td className="px-4 py-2 text-white text-xs max-w-[200px] truncate">{r.vuln.title as string}</td>
                        <td className="px-4 py-2">{r.sev ? <Badge label={r.sev} style={SEV_BADGE[r.sev]} /> : <Dash />}</td>
                        <td className="px-4 py-2"><Badge label={(r.vuln.status as string) ?? 'Open'} style={STATUS_BADGE[(r.vuln.status as string) ?? 'Open']} /></td>
                        <td className={`px-4 py-2 text-xs font-semibold ${r.days > 90 ? 'text-red-400' : r.days > 60 ? 'text-orange-400' : r.days > 30 ? 'text-yellow-400' : 'text-slate-400'}`}>{r.days}d</td>
                        <td className="px-4 py-2"><Badge label={r.bucket} style={AGE_BUCKET_STYLE[r.bucket]} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── KPI: Remediation Trends ───────────────────────────────────────────────
  function renderMetricsTrends() {
    const monthKeys = lastNMonthKeys(12);
    const newByMonth:  Record<string, number>   = {};
    const remByMonth:  Record<string, number>   = {};
    const mttrByMonth: Record<string, number[]> = {};
    for (const k of monthKeys) { newByMonth[k] = 0; remByMonth[k] = 0; mttrByMonth[k] = []; }

    for (const v of kpiFiltered) {
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

    const trendData  = monthKeys.map(k => ({ month: monthLabel(k), New: newByMonth[k], Remediated: remByMonth[k] }));
    const mttrTrendData = monthKeys.map(k => ({
      month: monthLabel(k),
      'MTTR (days)': mttrByMonth[k].length > 0 ? Math.round(mttrByMonth[k].reduce((a,b)=>a+b,0)/mttrByMonth[k].length * 10)/10 : null,
    }));

    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const newThisMonth  = newByMonth[thisMonthKey] ?? 0;
    const remThisMonth  = remByMonth[thisMonthKey] ?? 0;
    const mttrThisMonth = mttrByMonth[thisMonthKey]?.length > 0
      ? Math.round(mttrByMonth[thisMonthKey].reduce((a,b)=>a+b,0)/mttrByMonth[thisMonthKey].length*10)/10 : null;
    const netChange = remThisMonth - newThisMonth;

    return (
      <div>
        <div className="mb-5">
          <h2 className="text-white font-bold text-lg">Remediation Trends</h2>
          <p className="text-slate-400 text-sm mt-0.5">New vulnerabilities vs remediations over the last 12 months</p>
        </div>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <KpiCard label="New This Month"        value={newThisMonth}  color="text-white" />
          <KpiCard label="Remediated This Month" value={remThisMonth}  color="text-green-400" />
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

  // ── KPI: Top Riskiest Products ────────────────────────────────────────────
  function renderMetricsTopRisk() {
    const filteredVulnIds = new Set(kpiFiltered.map(v => (v as { id: string }).id));
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
    }).sort((a,b) => b.riskScore - a.riskScore).map((r,i) => ({ ...r, rank: i + 1 }));

    const totalOpenCrit = productRows.reduce((s,r) => s + r.critical, 0);
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
          <KpiCard label="Most At-Risk Product"      value={topProd?.riskScore > 0 ? topProd.name : '—'} color="text-red-400" sub={topProd?.riskScore > 0 ? `Risk score: ${topProd.riskScore}` : undefined} />
          <KpiCard label="Total Open Critical Vulns" value={totalOpenCrit} color={totalOpenCrit > 0 ? 'text-red-400' : 'text-slate-400'} />
          <KpiCard label="Products with Critical"    value={prodsWithCrit} color={prodsWithCrit > 0 ? 'text-orange-400' : 'text-slate-400'} />
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
      case 'prod-vuln-report':      return renderProdVulnReport();
      case 'prod-sev-status':       return renderProdSevStatus();
      case 'prod-exec':             return renderProdExec();
      case 'vuln-products':         return renderVulnProducts();
      case 'vuln-sev-status':       return renderVulnSevStatus();
      case 'vuln-exec':             return renderVulnExec();
      case 'metrics-mttr':          return renderMetricsMTTR();
      case 'metrics-sla-product':   return renderMetricsSLAProduct();
      case 'metrics-sla-severity':  return renderMetricsSLASeverity();
      case 'metrics-aging':         return renderMetricsAging();
      case 'metrics-trends':        return renderMetricsTrends();
      case 'metrics-top-risk':      return renderMetricsTopRisk();
    }
  }

  // ── Contextual filter strips ───────────────────────────────────────────────
  function renderProductFilters() {
    const hasFilter = pProduct !== PLANVIEW_PRODUCTS[0].name || pSeverity || pStatus;
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <select value={pProduct} onChange={e => setPProduct(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-red-500 transition">
          {PLANVIEW_PRODUCTS.map(p => <option key={p.name} value={p.name}>{p.icon} {p.name}</option>)}
        </select>
        <select value={pSeverity} onChange={e => setPSeverity(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-red-500 transition">
          <option value="">All Severities</option>
          {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={pStatus} onChange={e => setPStatus(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-red-500 transition">
          <option value="">All Statuses</option>
          {['Open','In Progress','Pending Verification','Remediated','Closed'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {hasFilter && (
          <button onClick={() => { setPProduct(PLANVIEW_PRODUCTS[0].name); setPSeverity(''); setPStatus(''); }}
            className="text-xs text-slate-500 hover:text-slate-300 transition">Clear ✕</button>
        )}
        <span className="ml-auto text-slate-600 text-xs">{prodFiltered.length} / {allVulns.length} vulns</span>
      </div>
    );
  }

  function renderVulnFilters() {
    const hasFilter = vVulnId || vSeverity || vStatus || vZeroDay;
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <select value={effectiveVulnId} onChange={e => setVVulnId(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-red-500 transition max-w-[220px]">
          {sortedVulns.map(v => (
            <option key={(v as { id: string }).id} value={(v as { id: string }).id}>
              {v.vulnerabilityId as string} — {(v.title as string).slice(0, 35)}
            </option>
          ))}
        </select>
        <select value={vSeverity} onChange={e => setVSeverity(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-red-500 transition">
          <option value="">All Severities</option>
          {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={vStatus} onChange={e => setVStatus(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-red-500 transition">
          <option value="">All Statuses</option>
          {['Open','In Progress','Pending Verification','Remediated','Closed'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => setVZeroDay(!vZeroDay)}
          className={`px-2.5 py-1 text-xs rounded border transition ${vZeroDay ? 'bg-red-500/10 border-red-500/40 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
          Zero-Day only
        </button>
        {hasFilter && (
          <button onClick={() => { setVVulnId(''); setVSeverity(''); setVStatus(''); setVZeroDay(false); }}
            className="text-xs text-slate-500 hover:text-slate-300 transition">Clear ✕</button>
        )}
        <span className="ml-auto text-slate-600 text-xs">{vulnFiltered.length} / {allVulns.length} vulns</span>
      </div>
    );
  }

  function renderKpiFilters() {
    return (
      <div className="flex items-center gap-3">
        <span className="text-slate-500 text-xs">Showing last 12 months</span>
        <span className="ml-auto text-slate-600 text-xs">{kpiFiltered.length} / {allVulns.length} vulns</span>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // Section icons – matching main nav icons
  const SECTION_ICONS: Record<ActiveSection, ReactNode> = {
    products:        <Boxes       size={16} className="shrink-0" />,
    vulnerabilities: <ShieldAlert size={16} className="shrink-0" />,
    kpis:            <BarChart3   size={16} className="shrink-0" />,
  };

  // Section descriptions shown in the filter bar header
  const ACTIVE_REPORT_LABEL = SECTION_REPORTS[activeSection].find(r => r.id === activeReport)?.label ?? '';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar />

      <main className="flex-1 flex overflow-hidden">

        {/* ── Reports navigation panel ────────────────────────────────── */}
        <nav className="w-64 border-r border-slate-800 flex flex-col shrink-0 bg-slate-900/20">

          {/* Panel header */}
          <div className="px-5 pt-6 pb-4 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2.5 mb-0.5">
              <div className="w-6 h-6 bg-red-600/20 border border-red-600/30 rounded-md flex items-center justify-center text-red-400 text-xs">
                ▤
              </div>
              <h1 className="text-sm font-bold text-white tracking-tight">Reports</h1>
            </div>
            <p className="text-slate-500 text-xs pl-8">Analytics &amp; Insights</p>
          </div>

          {/* Accordion sections */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
            {(['products', 'vulnerabilities', 'kpis'] as ActiveSection[]).map(section => {
              const isOpen = openSection === section;
              return (
                <div key={section}>
                  {/* Section header */}
                  <button
                    onClick={() => switchSection(section)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                      isOpen
                        ? 'bg-red-600/15 text-red-300 border-red-600/30 shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/70 border-transparent hover:border-slate-700/50'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      {SECTION_ICONS[section]}
                      <span>{section === 'products' ? 'Products' : section === 'vulnerabilities' ? 'Vulnerabilities' : 'KPIs'}</span>
                    </span>
                    <span className={`text-slate-400 text-xs font-normal transition-transform duration-200 ${isOpen ? 'rotate-90 text-red-400' : ''}`}>
                      ›
                    </span>
                  </button>

                  {/* Sub-menu items */}
                  {isOpen && (
                    <div className="mt-1 ml-3 pl-3 border-l-2 border-slate-700/60 space-y-0.5">
                      {SECTION_REPORTS[section].map(item => (
                        <button
                          key={item.id}
                          onClick={() => setActiveReport(item.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all border ${
                            activeReport === item.id
                              ? 'bg-sky-500/10 text-sky-400 border-sky-500/20 font-medium'
                              : 'text-slate-300 hover:text-white hover:bg-slate-800/50 border-transparent'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Panel footer – quick stats */}
          <div className="px-4 py-4 border-t border-slate-800 shrink-0">
            <p className="text-slate-600 text-xs text-center">{allVulns.length} vulnerabilities tracked</p>
          </div>
        </nav>

        {/* ── Main content column ──────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Breadcrumb + filter strip */}
          <div className="border-b border-slate-800 bg-slate-900/40 px-6 py-3 shrink-0">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2.5">
              <span>Reports</span>
              <span>›</span>
              <span className={activeSection === 'products' ? 'text-slate-300' : activeSection === 'vulnerabilities' ? 'text-slate-300' : 'text-slate-300'}>
                {activeSection === 'products' ? 'Products' : activeSection === 'vulnerabilities' ? 'Vulnerabilities' : 'KPIs'}
              </span>
              <span>›</span>
              <span className="text-red-400 font-medium">{ACTIVE_REPORT_LABEL}</span>
            </div>

            {/* Contextual filters */}
            {activeSection === 'products'        && renderProductFilters()}
            {activeSection === 'vulnerabilities' && renderVulnFilters()}
            {activeSection === 'kpis'            && renderKpiFilters()}
          </div>

          {/* Report content */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            {renderReport()}
          </div>

        </div>
      </main>
    </div>
  );
}
