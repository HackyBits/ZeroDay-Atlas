'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { id as instantId } from '@instantdb/react';
import db from '@/lib/instant';
import Sidebar from '@/app/components/Sidebar';
import { isSafeUrl } from '@/lib/url';

// ─── Types ────────────────────────────────────────────────────────────────────

type BusinessImpact  = 'Low' | 'Medium' | 'High';
type DataSensitivity = 'Public' | 'Internal' | 'Confidential' | 'Restricted';
type ExposureLevel   = 'Internal' | 'External' | 'Internet-facing';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CVSS_COLOR = (score: number) => {
  if (score >= 9)   return 'text-red-400';
  if (score >= 7)   return 'text-orange-400';
  if (score >= 4)   return 'text-yellow-400';
  return 'text-blue-400';
};

// ─── Risk engine ─────────────────────────────────────────────────────────────

const BUSINESS_WEIGHT:    Record<BusinessImpact,   number> = { Low: 1, Medium: 2, High: 3 };
const SENSITIVITY_WEIGHT: Record<DataSensitivity,  number> = { Public: 1, Internal: 2, Confidential: 3, Restricted: 4 };
const EXPOSURE_WEIGHT:    Record<ExposureLevel,    number> = { Internal: 1, External: 2, 'Internet-facing': 3 };

function calcRiskScore(bi: BusinessImpact, ds: DataSensitivity, el: ExposureLevel): number {
  const raw = BUSINESS_WEIGHT[bi] * SENSITIVITY_WEIGHT[ds] * EXPOSURE_WEIGHT[el];
  return Math.round((raw / 36) * 100);
}

function deriveSeverity(score: number): string {
  if (score >= 76) return 'Critical';
  if (score >= 51) return 'High';
  if (score >= 26) return 'Medium';
  return 'Low';
}

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

const COMPONENT_OPTIONS = [
  'Operating System',
  'Library / Dependency',
  'Language Runtime',
  'Database',
  'Infrastructure / Cloud',
  'API / Service',
  'Frontend / UI',
  'Authentication / IAM',
  'Network / Firewall',
  'Container / Orchestration',
];

type ImpactStatus = 'Impacted' | 'Not-Impacted' | 'Unknown';

interface ProductRow {
  name: string;
  impactStatus: ImpactStatus;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<ImpactStatus, string> = {
  'Impacted':     'bg-red-500/15 border-red-500/40 text-red-400',
  'Not-Impacted': 'bg-green-500/15 border-green-500/40 text-green-400',
  'Unknown':      'bg-slate-700 border-slate-600 text-slate-300',
};

const STATUS_DOT: Record<ImpactStatus, string> = {
  'Impacted':     'bg-red-500',
  'Not-Impacted': 'bg-green-500',
  'Unknown':      'bg-slate-500',
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ImpactAssessmentPage() {
  const router = useRouter();
  const { id: vulnInstantId } = useParams<{ id: string }>();

  const { isLoading: authLoading, user } = db.useAuth();
  const { data: vulnData }   = db.useQuery({ vulnerabilities: { $: { where: { id: vulnInstantId } } } });
  const { data: assessData } = db.useQuery({ assessments:     { $: { where: { vulnerabilityRef: vulnInstantId } } } });
  // Load per-product assessments to show completion status on each row
  const { data: productData } = db.useQuery({ productAssessments: { $: { where: { vulnerabilityRef: vulnInstantId } } } });

  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [cvssScore, setCvssScore] = useState('');

  const [products, setProducts] = useState<ProductRow[]>(
    PLANVIEW_PRODUCTS.map((p) => ({ name: p.name, impactStatus: 'Unknown' }))
  );
  const [components,    setComponents]    = useState<string[]>([]);
  const [subComponents, setSubComponents] = useState<Record<string, string>>({});
  const [externalLink,  setExternalLink]  = useState('');

  // Risk assessment fields
  const [versionsImpacted, setVersionsImpacted] = useState<string[]>([]);
  const [versionInput,     setVersionInput]     = useState('');
  const [businessImpact,   setBusinessImpact]   = useState<BusinessImpact>('Medium');
  const [dataSensitivity,  setDataSensitivity]  = useState<DataSensitivity>('Internal');
  const [exposureLevel,    setExposureLevel]    = useState<ExposureLevel>('Internal');

  // Hydrate from existing assessment
  useEffect(() => {
    const existing = assessData?.assessments?.[0];
    if (!existing) return;
    if (existing.affectedProducts) {
      setProducts(existing.affectedProducts as ProductRow[]);
    }
    if (existing.affectedComponents) {
      setComponents(existing.affectedComponents as string[]);
    }
    if (existing.subComponents) {
      setSubComponents(existing.subComponents as Record<string, string>);
    }
    setExternalLink((existing.externalLink as string) ?? '');
    const existingAny = existing as Record<string, unknown>;
    if (existingAny.cvssScore != null) setCvssScore(String(existingAny.cvssScore));
    if (existing.versionsImpacted)  setVersionsImpacted((existing.versionsImpacted as string[]) ?? []);
    if (existing.businessImpact)    setBusinessImpact((existing.businessImpact  as BusinessImpact)  ?? 'Medium');
    if (existing.dataSensitivity)   setDataSensitivity((existing.dataSensitivity as DataSensitivity) ?? 'Internal');
    if (existing.exposureLevel)     setExposureLevel((existing.exposureLevel    as ExposureLevel)   ?? 'Internal');
    setSaved(true);
  }, [assessData]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [authLoading, user, router]);

  if (authLoading || !user) return <Spinner />;

  const vuln = vulnData?.vulnerabilities?.[0];
  const existingAssessment = assessData?.assessments?.[0];
  const productAssessments = productData?.productAssessments ?? [];

  // Build lookup: productName → productAssessment record
  const productDetailMap: Record<string, typeof productAssessments[number]> = {};
  for (const pa of productAssessments) {
    productDetailMap[pa.productName as string] = pa;
  }

  if (!vuln) return <Spinner />;

  // Sections 2–4 are read-only once an assessment record exists (set during Log Vulnerability)
  const isReadOnly = !!existingAssessment;

  // ── Handlers

  function setProductStatus(name: string, status: ImpactStatus) {
    setProducts((prev) => prev.map((p) => p.name === name ? { ...p, impactStatus: status } : p));
    setSaved(false);
  }

  function toggleComponent(comp: string) {
    setComponents((prev) => {
      const has = prev.includes(comp);
      if (has) {
        setSubComponents((s) => { const next = { ...s }; delete next[comp]; return next; });
        return prev.filter((c) => c !== comp);
      }
      return [...prev, comp];
    });
    setSaved(false);
  }

  function setSubComponent(comp: string, value: string) {
    setSubComponents((prev) => ({ ...prev, [comp]: value }));
    setSaved(false);
  }

  function addVersion() {
    const v = versionInput.trim();
    if (!v || versionsImpacted.includes(v)) return;
    setVersionsImpacted((prev) => [...prev, v]);
    setVersionInput('');
    setSaved(false);
  }

  function removeVersion(v: string) {
    setVersionsImpacted((prev) => prev.filter((x) => x !== v));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const assessId  = existingAssessment
        ? (existingAssessment as { id: string }).id
        : instantId();
      const riskScore = calcRiskScore(businessImpact, dataSensitivity, exposureLevel);

      await db.transact(
        db.tx.assessments[assessId].update({
          vulnerabilityRef:   vulnInstantId,
          affectedProducts:   products,
          affectedComponents: components,
          subComponents,
          externalLink,
          versionsImpacted,
          businessImpact,
          dataSensitivity,
          exposureLevel,
          cvssScore:          parseFloat(cvssScore) || 0,
          riskScore,
          suggestedSeverity:  deriveSeverity(riskScore),
          updatedAt:          Date.now(),
          createdAt:          existingAssessment ? (existingAssessment.createdAt as number) : Date.now(),
        })
      );
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const impactedCount    = products.filter((p) => p.impactStatus === 'Impacted').length;
  const notImpactedCount = products.filter((p) => p.impactStatus === 'Not-Impacted').length;
  const unknownCount     = products.filter((p) => p.impactStatus === 'Unknown').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar />

      {/* Main */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-2xl mx-auto">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm mb-6">
            <Link href="/dashboard" className="text-slate-400 hover:text-white transition">Dashboard</Link>
            <span className="text-slate-700">/</span>
            <span className="text-slate-400 font-mono text-xs">{vuln.vulnerabilityId as string}</span>
            <span className="text-slate-700">/</span>
            <span className="text-slate-300">Impact Assessment</span>
          </div>

          {/* Vulnerability summary */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-8 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-slate-400 font-mono text-xs">{vuln.vulnerabilityId as string}</span>
                {vuln.isZeroDay && (
                  <span className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />Zero-Day
                  </span>
                )}
              </div>
              <h2 className="text-white font-semibold text-base truncate">{vuln.title as string}</h2>
              <p className="text-slate-400 text-xs mt-1">
                {vuln.vulnerabilityType as string} · {(vuln.exploitAvailability as string) === 'Yes' ? '⚠ Active exploit' : 'No known exploit'} · Discovered {vuln.dateDiscovered as string}
              </p>
            </div>
            <span className="shrink-0 text-xs px-3 py-1 rounded-full border bg-slate-800 text-slate-300 border-slate-700">
              {vuln.status as string}
            </span>
          </div>

          {/* Lifecycle bar */}
          <LifecycleBar active={1} />

          {/* ── Section 1: Affected Products ── */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-5">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-white font-semibold text-sm">Affected Products</h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  Set impact status for each product. Click a product name to fill in version and risk details.
                </p>
              </div>
              {/* Product counts */}
              <div className="flex gap-3 text-xs shrink-0">
                <span className="text-red-400 font-semibold">{impactedCount} impacted</span>
                <span className="text-green-400 font-semibold">{notImpactedCount} clear</span>
                <span className="text-slate-500">{unknownCount} unknown</span>
              </div>
            </div>

            <div className="space-y-1">
              {products.map((p) => {
                const productMeta = PLANVIEW_PRODUCTS.find((pm) => pm.name === p.name);
                const detail      = productDetailMap[p.name];
                const hasDetail   = !!detail;

                return (
                  <div key={p.name}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-slate-800/40 transition group border border-transparent hover:border-slate-700/50">

                    {/* Left: icon + name link */}
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-base shrink-0">{productMeta?.icon}</span>
                      <div className="min-w-0">
                        <Link
                          href={`/impact-assessment/${vulnInstantId}/product/${encodeURIComponent(p.name)}`}
                          className="text-sm font-medium text-slate-200 hover:text-red-400 transition flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {p.name}
                          <span className="text-slate-600 group-hover:text-slate-400 transition text-xs">→</span>
                        </Link>
                        {hasDetail && (
                          <p className="text-slate-500 text-xs mt-0.5">
                            {detail.suggestedSeverity as string} risk · {(detail.versionsImpacted as string[])?.length ?? 0} version(s)
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: status buttons */}
                    <div className="flex gap-1 shrink-0">
                      {(['Impacted', 'Not-Impacted', 'Unknown'] as ImpactStatus[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => { setProductStatus(p.name, s); }}
                          className={`text-xs px-2.5 py-1 rounded-md border transition ${
                            p.impactStatus === s
                              ? STATUS_STYLE[s]
                              : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                          }`}
                        >
                          {s === 'Not-Impacted' ? 'Not Impacted' : s}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary dots */}
            <div className="mt-4 pt-4 border-t border-slate-800 flex items-center gap-4 flex-wrap">
              {products.map((p) => (
                <div key={p.name} className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className={`w-2 h-2 rounded-full ${STATUS_DOT[p.impactStatus]}`} />
                  {p.name}
                </div>
              ))}
            </div>
          </div>

          {/* ── Section 2: Affected Components ── */}
          <div className={`bg-slate-900 border rounded-xl p-6 mb-5 ${isReadOnly ? 'border-slate-700/50' : 'border-slate-800'}`}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-white font-semibold text-sm">Affected Components</h3>
                <p className="text-slate-400 text-xs mt-0.5">Select the system components where this vulnerability exists.</p>
              </div>
              {isReadOnly && (
                <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-full shrink-0">
                  🔒 Read-only
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {COMPONENT_OPTIONS.map((comp) => (
                <button key={comp}
                  onClick={isReadOnly ? undefined : () => toggleComponent(comp)}
                  disabled={isReadOnly}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${
                    components.includes(comp)
                      ? 'bg-red-500/10 border-red-500/40 text-red-400'
                      : isReadOnly
                        ? 'bg-slate-800/50 border-slate-700/50 text-slate-600 cursor-default'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                  }`}>
                  {components.includes(comp) ? '✓ ' : ''}{comp}
                </button>
              ))}
            </div>

            {components.length > 0 && (
              <div className="space-y-2 pt-4 border-t border-slate-800">
                <p className="text-slate-400 text-xs mb-3">Sub-components <span className="text-slate-600">(optional)</span></p>
                {components.map((comp) => (
                  <div key={comp} className="flex items-center gap-3">
                    <span className="text-slate-400 text-xs w-44 shrink-0 truncate">{comp}</span>
                    <input
                      type="text"
                      placeholder="e.g. OpenSSL 3.1, glibc 2.35…"
                      value={subComponents[comp] ?? ''}
                      onChange={(e) => setSubComponent(comp, e.target.value)}
                      readOnly={isReadOnly}
                      className={`flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 transition ${isReadOnly ? 'cursor-default opacity-60 focus:outline-none' : 'focus:outline-none focus:border-red-500'}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Section 3: Risk Assessment ── */}
          <div className={`bg-slate-900 border rounded-xl p-6 mb-5 ${isReadOnly ? 'border-slate-700/50' : 'border-slate-800'}`}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-white font-semibold text-sm">Risk Assessment</h3>
                <p className="text-slate-400 text-xs mt-0.5">Versions affected and business risk factors that drive the overall risk score.</p>
              </div>
              {isReadOnly && (
                <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-full shrink-0">
                  🔒 Read-only
                </span>
              )}
            </div>

            {/* Versions Impacted */}
            <div className="mb-6">
              <p className="text-sm font-medium text-slate-300 mb-2">Versions Impacted</p>
              {!isReadOnly && (
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={versionInput}
                    onChange={(e) => setVersionInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addVersion())}
                    placeholder="e.g. 3.0.1, < 2.4, 2023.1 …"
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition"
                  />
                  <button onClick={addVersion}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition">
                    Add
                  </button>
                </div>
              )}
              {versionsImpacted.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {versionsImpacted.map((v) => (
                    <span key={v} className="inline-flex items-center gap-1.5 bg-slate-800 border border-slate-700 text-slate-300 text-xs px-3 py-1 rounded-full">
                      {v}
                      {!isReadOnly && (
                        <button onClick={() => removeVersion(v)} className="text-slate-500 hover:text-red-400 transition text-xs">✕</button>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-slate-600 text-xs">No versions added.</p>
              )}
            </div>

            {/* Business Impact */}
            <div className="mb-5">
              <p className="text-sm font-medium text-slate-300 mb-2">Business Impact <span className="text-slate-500 font-normal text-xs">Operational impact if exploited</span></p>
              <div className="flex gap-2">
                {(['Low', 'Medium', 'High'] as BusinessImpact[]).map((v) => (
                  <button key={v}
                    onClick={isReadOnly ? undefined : () => { setBusinessImpact(v); setSaved(false); }}
                    disabled={isReadOnly}
                    className={`flex-1 py-2.5 text-sm font-medium rounded-lg border-2 transition ${
                      businessImpact === v
                        ? v === 'High'   ? 'bg-red-500/10 border-red-500 text-red-400'
                          : v === 'Medium' ? 'bg-yellow-500/10 border-yellow-500 text-yellow-400'
                          : 'bg-blue-500/10 border-blue-500 text-blue-400'
                        : isReadOnly
                          ? 'border-slate-700/50 bg-slate-800/50 text-slate-600 cursor-default'
                          : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                    }`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Data Sensitivity */}
            <div className="mb-5">
              <p className="text-sm font-medium text-slate-300 mb-2">Data Sensitivity <span className="text-slate-500 font-normal text-xs">Classification of data handled</span></p>
              <div className="grid grid-cols-2 gap-2">
                {(['Public', 'Internal', 'Confidential', 'Restricted'] as DataSensitivity[]).map((v) => (
                  <button key={v}
                    onClick={isReadOnly ? undefined : () => { setDataSensitivity(v); setSaved(false); }}
                    disabled={isReadOnly}
                    className={`py-2.5 text-sm rounded-lg border-2 transition ${
                      dataSensitivity === v
                        ? 'bg-red-500/10 border-red-500 text-red-400'
                        : isReadOnly
                          ? 'border-slate-700/50 bg-slate-800/50 text-slate-600 cursor-default'
                          : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                    }`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Exposure Level */}
            <div>
              <p className="text-sm font-medium text-slate-300 mb-2">Exposure Level <span className="text-slate-500 font-normal text-xs">How the system is exposed on the network</span></p>
              <div className="flex gap-2">
                {(['Internal', 'External', 'Internet-facing'] as ExposureLevel[]).map((v) => (
                  <button key={v}
                    onClick={isReadOnly ? undefined : () => { setExposureLevel(v); setSaved(false); }}
                    disabled={isReadOnly}
                    className={`flex-1 py-2.5 text-sm rounded-lg border-2 transition ${
                      exposureLevel === v
                        ? v === 'Internet-facing' ? 'bg-red-500/10 border-red-500 text-red-400'
                          : v === 'External'       ? 'bg-orange-500/10 border-orange-500 text-orange-400'
                          : 'bg-slate-700 border-slate-500 text-slate-300'
                        : isReadOnly
                          ? 'border-slate-700/50 bg-slate-800/50 text-slate-600 cursor-default'
                          : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                    }`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Risk Score */}
            {(() => {
              const score    = calcRiskScore(businessImpact, dataSensitivity, exposureLevel);
              const severity = deriveSeverity(score);
              const ringColor  = { Critical: 'border-red-500',    High: 'border-orange-500', Medium: 'border-yellow-500', Low: 'border-blue-500'  }[severity];
              const textColor  = { Critical: 'text-red-400',      High: 'text-orange-400',   Medium: 'text-yellow-400',   Low: 'text-blue-400'    }[severity];
              const badgeColor = { Critical: 'bg-red-500/10 border-red-500/40 text-red-400', High: 'bg-orange-500/10 border-orange-500/40 text-orange-400', Medium: 'bg-yellow-500/10 border-yellow-500/40 text-yellow-400', Low: 'bg-blue-500/10 border-blue-500/40 text-blue-400' }[severity];
              const barColor   = { Critical: 'bg-red-500',        High: 'bg-orange-500',     Medium: 'bg-yellow-500',     Low: 'bg-blue-500'      }[severity];
              return (
                <div className="mt-6 pt-6 border-t border-slate-800 flex items-center gap-6">
                  {/* Score circle */}
                  <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center shrink-0 ${ringColor}`}>
                    <span className={`text-xl font-bold ${textColor}`}>{score}</span>
                  </div>
                  {/* Bar + label */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-slate-400 text-xs">Estimated Risk Score</span>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${badgeColor}`}>{severity}</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${score}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-slate-600 mt-1"><span>0</span><span>50</span><span>100</span></div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── Section 4: CVSS Score ── */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-5">
            <div className="mb-5">
              <h3 className="text-white font-semibold text-sm">CVSS Score</h3>
              <p className="text-slate-400 text-xs mt-0.5">NVD numeric score (0.0 – 10.0) for this vulnerability.</p>
            </div>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={cvssScore}
                onChange={(e) => { setCvssScore(e.target.value); setSaved(false); }}
                placeholder="e.g. 9.8"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition pr-16"
              />
              {cvssScore && (
                <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-lg font-bold ${CVSS_COLOR(parseFloat(cvssScore) || 0)}`}>
                  {(parseFloat(cvssScore) || 0).toFixed(1)}
                </span>
              )}
            </div>
            {cvssScore && (
              <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${(() => {
                    const n = parseFloat(cvssScore) || 0;
                    return n >= 9 ? 'bg-red-500' : n >= 7 ? 'bg-orange-500' : n >= 4 ? 'bg-yellow-500' : 'bg-blue-500';
                  })()}`}
                  style={{ width: `${((parseFloat(cvssScore) || 0) / 10) * 100}%` }}
                />
              </div>
            )}
          </div>

          {/* ── Section 5: External Reference Link ── */}
          <div className={`bg-slate-900 border rounded-xl p-6 mb-8 ${isReadOnly ? 'border-slate-700/50' : 'border-slate-800'}`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-white font-semibold text-sm">External Reference Link</h3>
                <p className="text-slate-400 text-xs mt-0.5">CVE details, vendor advisory, or NVD entry for this vulnerability.</p>
              </div>
              {isReadOnly && (
                <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-full shrink-0">
                  🔒 Read-only
                </span>
              )}
            </div>
            {isReadOnly && externalLink && isSafeUrl(externalLink) ? (
              <a href={externalLink} target="_blank" rel="noopener noreferrer"
                className="text-sm text-red-400 hover:text-red-300 underline underline-offset-2 break-all transition">
                {externalLink}
              </a>
            ) : (
              <input
                type="url"
                value={externalLink}
                onChange={(e) => { setExternalLink(e.target.value); setSaved(false); }}
                placeholder="https://nvd.nist.gov/vuln/detail/CVE-..."
                readOnly={isReadOnly}
                className={`w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 transition ${isReadOnly ? 'opacity-60 cursor-default focus:outline-none' : 'focus:outline-none focus:border-red-500'}`}
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium py-3 rounded-xl transition flex items-center justify-center gap-2">
              {saving ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
              ) : saved ? (
                <><span className="text-green-300">✓</span> Saved</>
              ) : (
                'Save Assessment'
              )}
            </button>

            <Link
              href="/dashboard"
              className="flex-1 text-center text-sm font-medium py-3 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function LifecycleBar({ active }: { active: number }) {
  const steps = ['Log Vulnerability', 'Impact Assessment'];
  return (
    <div className="flex items-center gap-0 mb-8 overflow-x-auto">
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
