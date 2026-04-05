'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import db from '@/lib/instant';

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

// ─── Style maps ───────────────────────────────────────────────────────────────

const IMPACT_STYLE: Record<string, string> = {
  Impacted:       'bg-red-500/10 text-red-400 border-red-500/30',
  'Not-Impacted': 'bg-green-500/10 text-green-400 border-green-500/30',
  Unknown:        'bg-slate-700 text-slate-400 border-slate-600',
};
const IMPACT_DOT: Record<string, string> = {
  Impacted: 'bg-red-500', 'Not-Impacted': 'bg-green-500', Unknown: 'bg-slate-500',
};
const SEVERITY_STYLE: Record<string, string> = {
  Critical: 'bg-red-500/10 text-red-400 border-red-500/30',
  High:     'bg-orange-500/10 text-orange-400 border-orange-500/30',
  Medium:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  Low:      'bg-blue-500/10 text-blue-400 border-blue-500/30',
};
const STATUS_BADGE: Record<string, string> = {
  Open:                   'bg-red-500/10 text-red-400 border-red-500/20',
  'In Progress':          'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Remediated:             'bg-green-500/10 text-green-400 border-green-500/20',
  'Pending Verification': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  Closed:                 'bg-slate-700 text-slate-400 border-slate-600',
};
const TRIAGE_STATUS_STYLE: Record<string, string> = {
  Accepted:         'bg-green-500/10 text-green-400 border-green-500/30',
  Rejected:         'bg-red-500/10 text-red-400 border-red-500/30',
  'Needs Info':     'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  'Risk Accepted':  'bg-purple-500/10 text-purple-400 border-purple-500/30',
  New:              'bg-slate-700 text-slate-400 border-slate-600',
};
const REM_STATUS_STYLE: Record<string, string> = {
  'In Progress':          'bg-blue-500/10 text-blue-400 border-blue-500/30',
  Blocked:                'bg-red-500/10 text-red-400 border-red-500/30',
  'Ready for Review':     'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  'Ready for Dev Review': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  Done:                   'bg-green-500/10 text-green-400 border-green-500/30',
};
const VERIFY_STATUS_STYLE: Record<string, string> = {
  Verified:      'bg-green-500/10 text-green-400 border-green-500/30',
  Failed:        'bg-red-500/10 text-red-400 border-red-500/30',
  Pending:       'bg-slate-700 text-slate-400 border-slate-600',
  "Can't Verify": 'bg-slate-700 text-slate-400 border-slate-600',
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar() {
  return (
    <aside className="w-56 border-r border-slate-800 flex flex-col px-4 py-6 gap-1 shrink-0">
      <div className="flex items-center gap-2 mb-8 px-2">
        <div className="w-7 h-7 bg-red-600 rounded flex items-center justify-center text-white font-bold text-xs">ZA</div>
        <span className="font-semibold text-white text-sm">Zero-Day Atlas</span>
      </div>
      {[
        { label: 'Dashboard',       href: '/dashboard',       icon: '◉' },
        { label: 'Vulnerabilities', href: '/vulnerabilities', icon: '⚠' },
        { label: 'Products',        href: '/products',        icon: '⬡', active: true },
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
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const router = useRouter();
  const { isLoading, user } = db.useAuth();

  const { data: vulnData }    = db.useQuery({ vulnerabilities:    {} });
  const { data: assessData }  = db.useQuery({ assessments:        {} });
  const { data: paData }      = db.useQuery({ productAssessments: {} });
  const { data: ptData }      = db.useQuery({ productTriages:     {} });
  const { data: remData }     = db.useQuery({ remediations:       {} });

  // Two-step selection: first pick a vulnerability, then pick a product
  const [selectedVulnId, setSelectedVulnId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState(PLANVIEW_PRODUCTS[0].name);

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

  const vulns     = vulnData?.vulnerabilities    ?? [];
  const allAssess = assessData?.assessments      ?? [];
  const allPAs    = paData?.productAssessments   ?? [];
  const allPTs    = ptData?.productTriages       ?? [];
  const allRems   = remData?.remediations        ?? [];

  const vulnById: Record<string, typeof vulns[number]> = {};
  for (const v of vulns) vulnById[(v as { id: string }).id] = v;

  // Sort vulns: zero-days first, then by createdAt desc
  const sortedVulns = [...vulns].sort((a, b) => {
    if ((b.isZeroDay as boolean) !== (a.isZeroDay as boolean)) return (b.isZeroDay ? 1 : 0) - (a.isZeroDay ? 1 : 0);
    return ((b.createdAt as number) ?? 0) - ((a.createdAt as number) ?? 0);
  });

  // ── Scoped to selected vulnerability ──────────────────────────────────────

  // Returns impact status for a given product in the context of one vulnerability
  function productStatusForVuln(productName: string, vulnId: string): string {
    const pa = allPAs.find(
      (p) => (p.vulnerabilityRef as string) === vulnId && (p.productName as string) === productName
    );
    if (pa) return pa.impactStatus as string;

    for (const a of allAssess) {
      if ((a.vulnerabilityRef as string) !== vulnId) continue;
      const products = (a.affectedProducts as { name: string; impactStatus: string }[] | null) ?? [];
      const match = products.find((p) => p.name === productName);
      if (match) return match.impactStatus;
    }
    return 'Unknown';
  }

  // Selected vuln object
  const selectedVuln = selectedVulnId ? vulnById[selectedVulnId] : null;

  // Snapshot cards scoped to selected vuln
  const impactedProducts    = PLANVIEW_PRODUCTS.filter((p) => selectedVulnId && productStatusForVuln(p.name, selectedVulnId) === 'Impacted');
  const notImpactedProducts = PLANVIEW_PRODUCTS.filter((p) => selectedVulnId && productStatusForVuln(p.name, selectedVulnId) === 'Not-Impacted');
  const unknownProducts     = PLANVIEW_PRODUCTS.filter((p) => selectedVulnId && productStatusForVuln(p.name, selectedVulnId) === 'Unknown');

  // Build the single product row for the selected vuln + selected product
  type VulnRow = {
    instantId:        string;
    vulnerabilityId:  string;
    title:            string;
    isZeroDay:        boolean;
    vulnInstantId:    string;
    impactStatus:     string;
    versionsImpacted: string[];
    triage:           typeof allPTs[number] | null;
    remediation:      typeof allRems[number] | null;
  };

  const vulnRows: VulnRow[] = [];

  if (selectedVulnId) {
    const pa = allPAs.find(
      (p) => (p.vulnerabilityRef as string) === selectedVulnId && (p.productName as string) === selectedProduct
    );
    const vuln = vulnById[selectedVulnId];
    const triage = allPTs.find(
      (pt) => (pt.vulnerabilityRef as string) === selectedVulnId && (pt.productName as string) === selectedProduct
    ) ?? null;
    const remediation = allRems.find(
      (r) => (r.vulnerabilityRef as string) === selectedVulnId && (r.productName as string) === selectedProduct
    ) ?? null;

    if (pa) {
      vulnRows.push({
        instantId:        (pa as { id: string }).id,
        vulnerabilityId:  vuln ? (vuln.vulnerabilityId as string) : '—',
        title:            vuln ? (vuln.title as string) : 'Unknown',
        isZeroDay:        vuln ? (vuln.isZeroDay as boolean) : false,
        vulnInstantId:    selectedVulnId,
        impactStatus:     pa.impactStatus as string,
        versionsImpacted: (pa.versionsImpacted as string[]) ?? [],
        triage,
        remediation,
      });
    } else {
      // Fallback: check assessments.affectedProducts
      for (const a of allAssess) {
        if ((a.vulnerabilityRef as string) !== selectedVulnId) continue;
        const products = (a.affectedProducts as { name: string; impactStatus: string }[] | null) ?? [];
        const match = products.find((p) => p.name === selectedProduct);
        if (match) {
          vulnRows.push({
            instantId:        (a as { id: string }).id,
            vulnerabilityId:  vuln ? (vuln.vulnerabilityId as string) : '—',
            title:            vuln ? (vuln.title as string) : 'Unknown',
            isZeroDay:        vuln ? (vuln.isZeroDay as boolean) : false,
            vulnInstantId:    selectedVulnId,
            impactStatus:     match.impactStatus,
            versionsImpacted: [],
            triage,
            remediation,
          });
          break;
        }
      }
    }
  }

  const encodedProduct      = encodeURIComponent(selectedProduct);
  const selectedProductIcon = PLANVIEW_PRODUCTS.find((p) => p.name === selectedProduct)?.icon ?? '⬡';
  const selectedProductStatus = selectedVulnId ? productStatusForVuln(selectedProduct, selectedVulnId) : 'Unknown';

  // ── STEP 1: Vulnerability list ─────────────────────────────────────────────

  if (!selectedVulnId) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex">
        <Sidebar />
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            <div className="mb-8">
              <h1 className="text-xl font-bold text-white">Products</h1>
              <p className="text-slate-400 text-sm mt-0.5">Select a vulnerability to view product exposure</p>
            </div>

            {sortedVulns.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-16 text-center">
                <div className="text-4xl mb-4">⚠</div>
                <h2 className="text-white font-semibold mb-2">No vulnerabilities logged yet</h2>
                <p className="text-slate-400 text-sm mb-6">Log a vulnerability first to track product exposure.</p>
                </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                  <h2 className="text-white font-semibold text-sm">Vulnerabilities</h2>
                  <span className="text-slate-500 text-xs">{sortedVulns.length} total — click to view product exposure</span>
                </div>
                <div className="divide-y divide-slate-800">
                  {sortedVulns.map((v) => {
                    const vid = (v as { id: string }).id;
                    return (
                      <button key={vid} onClick={() => setSelectedVulnId(vid)}
                        className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-800/40 transition text-left group">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-mono text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded group-hover:text-white transition">
                              {v.vulnerabilityId as string}
                            </span>
                            {v.isZeroDay && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />Zero-Day
                              </span>
                            )}
                            {v.cveId && (
                              <span className="text-xs text-slate-500 font-mono">{v.cveId as string}</span>
                            )}
                          </div>
                          <p className="text-white text-sm font-medium truncate group-hover:text-red-300 transition">
                            {v.title as string}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGE[v.status as string] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                            {(v.status as string) ?? 'Open'}
                          </span>
                          <span className="text-slate-600 group-hover:text-slate-400 transition text-sm">→</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ── STEP 2: Product exposure for selected vulnerability ─────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar />

      <main className="flex-1 overflow-y-auto flex flex-col">

        {/* ── Top snapshot pane ──────────────────────────────────────────────── */}
        <div className="border-b border-slate-800 bg-slate-900/50 px-8 py-6">
          <div className="max-w-6xl mx-auto">
            {/* Back + vuln header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedVulnId(null)}
                  className="text-slate-400 hover:text-white transition text-sm flex items-center gap-1.5 shrink-0">
                  ← Back
                </button>
                <span className="text-slate-700">|</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {selectedVuln?.vulnerabilityId as string}
                    </span>
                    {selectedVuln?.isZeroDay && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />Zero-Day
                      </span>
                    )}
                  </div>
                  <h1 className="text-lg font-bold text-white mt-0.5 truncate">{selectedVuln?.title as string}</h1>
                </div>
              </div>
            </div>

            {/* Snapshot cards — scoped to this vulnerability */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-red-500/20 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                  <p className="text-red-400 text-sm font-semibold">Impacted ({impactedProducts.length})</p>
                </div>
                {impactedProducts.length === 0 ? (
                  <p className="text-slate-600 text-xs">None</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {impactedProducts.map((p) => (
                      <button key={p.name} onClick={() => setSelectedProduct(p.name)}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition ${
                          selectedProduct === p.name
                            ? 'bg-red-500/30 border-red-500/50 text-red-200'
                            : 'bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20'
                        }`}>
                        <span>{p.icon}</span>{p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0" />
                  <p className="text-slate-300 text-sm font-semibold">Unknown ({unknownProducts.length})</p>
                </div>
                {unknownProducts.length === 0 ? (
                  <p className="text-slate-600 text-xs">None</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {unknownProducts.map((p) => (
                      <button key={p.name} onClick={() => setSelectedProduct(p.name)}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition ${
                          selectedProduct === p.name
                            ? 'bg-slate-600 border-slate-500 text-white'
                            : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
                        }`}>
                        <span>{p.icon}</span>{p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-slate-900 border border-green-500/20 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                  <p className="text-green-400 text-sm font-semibold">Not Impacted ({notImpactedProducts.length})</p>
                </div>
                {notImpactedProducts.length === 0 ? (
                  <p className="text-slate-600 text-xs">None</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {notImpactedProducts.map((p) => (
                      <button key={p.name} onClick={() => setSelectedProduct(p.name)}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition ${
                          selectedProduct === p.name
                            ? 'bg-green-500/30 border-green-500/50 text-green-200'
                            : 'bg-green-500/10 border-green-500/20 text-green-300 hover:bg-green-500/20'
                        }`}>
                        <span>{p.icon}</span>{p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Product detail section ─────────────────────────────────────────── */}
        <div className="flex-1 px-8 py-6">
          <div className="max-w-6xl mx-auto">

            {/* Product selector dropdown */}
            <div className="mb-6 flex items-center gap-4">
              <label htmlFor="product-select" className="text-slate-400 text-sm font-medium shrink-0">
                Select Product
              </label>
              <div className="relative">
                <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${IMPACT_DOT[selectedProductStatus] ?? 'bg-slate-500'}`} />
                <select
                  id="product-select"
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="appearance-none bg-slate-800 border border-slate-600 text-white text-sm rounded-lg pl-8 pr-10 py-2.5 focus:outline-none focus:border-red-500 transition cursor-pointer"
                >
                  {PLANVIEW_PRODUCTS.map((product) => (
                    <option key={product.name} value={product.name}>
                      {product.icon} {product.name}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▼</span>
              </div>
            </div>

            {/* Product detail panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">

              {/* Panel header */}
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{selectedProductIcon}</span>
                  <div>
                    <h2 className="text-white font-semibold">{selectedProduct}</h2>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {vulnRows.length === 0 ? 'No assessment recorded yet' : 'Assessment available'}
                    </p>
                  </div>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full border font-medium ${
                  IMPACT_STYLE[selectedProductStatus] ?? 'bg-slate-800 text-slate-500 border-slate-700'
                }`}>
                  {selectedProductStatus}
                </span>
              </div>

              {/* Workflow flow */}
              {vulnRows.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <p className="text-slate-500 text-sm">No assessment recorded for {selectedProduct} on this vulnerability.</p>
                  <p className="text-slate-600 text-xs mt-1">
                    Go to the vulnerability's{' '}
                    <Link href={`/impact-assessment/${selectedVulnId}`} className="text-red-400 hover:text-red-300 transition underline">
                      Impact Assessment
                    </Link>{' '}
                    to add {selectedProduct}.
                  </p>
                </div>
              ) : (
                vulnRows.map((row) => {
                  const triageStatus   = (row.triage?.status              as string) ?? null;
                  const triageSeverity = (row.triage?.severity            as string) ?? null;
                  const remStatus      = (row.remediation?.status         as string) ?? null;
                  const verifyStatus   = (row.remediation?.verificationStatus as string) ?? null;

                  const showTriage       = row.impactStatus === 'Impacted' || row.impactStatus === 'Unknown';
                  const showRemediation  = showTriage && triageStatus === 'Accepted';
                  const showVerification = showRemediation && !!row.remediation;

                  return (
                    <div key={row.instantId} className="p-6">

                      {/* Vulnerability summary strip */}
                      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800 flex-wrap">
                        <span className="font-mono text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">{row.vulnerabilityId}</span>
                        {row.isZeroDay && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">0-day</span>
                        )}
                        {triageSeverity && (
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${SEVERITY_STYLE[triageSeverity] ?? ''}`}>{triageSeverity}</span>
                        )}
                        {row.versionsImpacted.length > 0 && (
                          <span className="text-slate-500 text-xs">v{row.versionsImpacted.join(', ')}</span>
                        )}
                        <span className="text-white text-sm font-medium ml-1 truncate">{row.title}</span>
                      </div>

                      {/* Pipeline steps */}
                      <div className="flex items-start gap-0 flex-wrap">

                        {/* ── Step 1: Impact Assessment ── */}
                        <div className="flex items-start gap-0">
                          <div className="flex flex-col items-center w-44">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold shrink-0">1</div>
                              <span className="text-white text-xs font-semibold">Impact</span>
                            </div>
                            <Link href={`/impact-assessment/${row.vulnInstantId}/product/${encodedProduct}`}
                              className={`w-full text-center text-xs px-3 py-1.5 rounded-lg border hover:opacity-80 transition cursor-pointer ${IMPACT_STYLE[row.impactStatus] ?? 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                              {row.impactStatus}
                            </Link>
                          </div>
                        </div>

                        {/* ── Connector + Triage (only if Impacted or Unknown) ── */}
                        {showTriage ? (
                          <div className="flex items-start gap-0">
                            <div className="flex items-center mt-3 mx-2 shrink-0">
                              <div className="w-6 h-px bg-slate-600" />
                              <span className="text-slate-500 text-xs">›</span>
                            </div>
                            <div className="flex flex-col items-center w-44">
                              <div className="flex items-center gap-2 mb-3">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${triageStatus ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-400'}`}>2</div>
                                <span className="text-white text-xs font-semibold">Triage</span>
                              </div>
                              <Link href={`/triage/${row.vulnInstantId}/product/${encodedProduct}`}
                                className={`w-full text-center text-xs px-3 py-1.5 rounded-lg border hover:opacity-80 transition cursor-pointer ${triageStatus ? (TRIAGE_STATUS_STYLE[triageStatus] ?? 'bg-slate-800 text-slate-500 border-slate-700') : 'bg-slate-800 text-slate-500 border-dashed border-slate-600 hover:text-white hover:border-slate-400'}`}>
                                {triageStatus ?? '+ Start Triage'}
                              </Link>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center mt-3 mx-3 shrink-0">
                            <span className="text-xs text-slate-600 italic">Triage not required</span>
                          </div>
                        )}

                        {/* ── Connector + Remediation (only if triage Accepted) ── */}
                        {showRemediation ? (
                          <div className="flex items-start gap-0">
                            <div className="flex items-center mt-3 mx-2 shrink-0">
                              <div className="w-6 h-px bg-slate-600" />
                              <span className="text-slate-500 text-xs">›</span>
                            </div>
                            <div className="flex flex-col items-center w-44">
                              <div className="flex items-center gap-2 mb-3">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${remStatus ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>3</div>
                                <span className="text-white text-xs font-semibold">Remediation</span>
                              </div>
                              <Link href={`/remediation/${row.vulnInstantId}/product/${encodedProduct}`}
                                className={`w-full text-center text-xs px-3 py-1.5 rounded-lg border hover:opacity-80 transition cursor-pointer ${remStatus ? (REM_STATUS_STYLE[remStatus] ?? 'bg-slate-800 text-slate-500 border-slate-700') : 'bg-slate-800 text-slate-500 border-dashed border-slate-600 hover:text-white hover:border-slate-400'}`}>
                                {remStatus ?? '+ Start Remediation'}
                              </Link>
                            </div>
                          </div>
                        ) : showTriage && triageStatus && triageStatus !== 'Accepted' ? (
                          <div className="flex items-center mt-3 mx-3 shrink-0">
                            <span className="text-xs text-slate-600 italic">Remediation not required</span>
                          </div>
                        ) : null}

                        {/* ── Connector + Verification (only if remediation exists) ── */}
                        {showVerification && (
                          <div className="flex items-start gap-0">
                            <div className="flex items-center mt-3 mx-2 shrink-0">
                              <div className="w-6 h-px bg-slate-600" />
                              <span className="text-slate-500 text-xs">›</span>
                            </div>
                            <div className="flex flex-col items-center w-44">
                              <div className="flex items-center gap-2 mb-3">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${verifyStatus && verifyStatus !== '' ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'}`}>4</div>
                                <span className="text-white text-xs font-semibold">Verification</span>
                              </div>
                              <Link href={`/verification/${row.vulnInstantId}/product/${encodedProduct}`}
                                className={`w-full text-center text-xs px-3 py-1.5 rounded-lg border hover:opacity-80 transition cursor-pointer ${verifyStatus && verifyStatus !== '' ? (VERIFY_STATUS_STYLE[verifyStatus] ?? 'bg-slate-800 text-slate-500 border-slate-700') : 'bg-slate-800 text-slate-500 border-dashed border-slate-600 hover:text-white hover:border-slate-400'}`}>
                                {verifyStatus && verifyStatus !== '' ? verifyStatus : '+ Verify'}
                              </Link>
                            </div>
                          </div>
                        )}

                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ── Impacted Products — Status Overview ────────────────────────── */}
            {impactedProducts.length > 0 && (
              <div className="mt-6 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800">
                  <h2 className="text-white font-semibold text-sm">Impacted Products — Status Overview</h2>
                  <p className="text-slate-500 text-xs mt-0.5">Click a row to view its workflow pipeline above</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs">
                      <th className="text-left px-6 py-3 font-medium">Product</th>
                      <th className="text-left px-6 py-3 font-medium">Impact</th>
                      <th className="text-left px-6 py-3 font-medium">Triage</th>
                      <th className="text-left px-6 py-3 font-medium">Remediation</th>
                      <th className="text-left px-6 py-3 font-medium">Verification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {impactedProducts.map((p) => {
                      const pt  = allPTs.find(x => (x.vulnerabilityRef as string) === selectedVulnId && (x.productName as string) === p.name);
                      const rem = allRems.find(x => (x.vulnerabilityRef as string) === selectedVulnId && (x.productName as string) === p.name);
                      const triageStatus = (pt?.status  as string) ?? null;
                      const remStatus    = (rem?.status as string) ?? null;
                      const verifyStatus = (rem?.verificationStatus as string) ?? null;
                      const showRem    = triageStatus === 'Accepted';
                      const showVerify = !!rem;
                      return (
                        <tr
                          key={p.name}
                          onClick={() => setSelectedProduct(p.name)}
                          className={`border-b border-slate-800/50 cursor-pointer hover:bg-slate-800/30 transition ${selectedProduct === p.name ? 'bg-slate-800/40' : ''}`}
                        >
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{p.icon}</span>
                              <span className="text-white text-xs font-medium">{p.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${IMPACT_STYLE['Impacted']}`}>
                              Impacted
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            {triageStatus ? (
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${TRIAGE_STATUS_STYLE[triageStatus] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                                {triageStatus}
                              </span>
                            ) : (
                              <span className="text-slate-600 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            {showRem && remStatus ? (
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${REM_STATUS_STYLE[remStatus] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                                {remStatus}
                              </span>
                            ) : (
                              <span className="text-slate-600 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            {showVerify && verifyStatus ? (
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${VERIFY_STATUS_STYLE[verifyStatus] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                                {verifyStatus}
                              </span>
                            ) : (
                              <span className="text-slate-600 text-xs">—</span>
                            )}
                          </td>
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
