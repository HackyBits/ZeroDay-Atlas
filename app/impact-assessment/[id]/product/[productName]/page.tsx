'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { id as instantId } from '@instantdb/react';
import db from '@/lib/instant';
import Sidebar from '@/app/components/Sidebar';

// ─── Types ────────────────────────────────────────────────────────────────────

type ImpactStatus   = 'Impacted' | 'Not-Impacted' | 'Unknown';
type BusinessImpact = 'Low' | 'Medium' | 'High';
type DataSensitivity = 'Public' | 'Internal' | 'Confidential' | 'Restricted';
type ExposureLevel  = 'Internal' | 'External' | 'Internet-facing';

interface ProductDetailForm {
  impactStatus:   ImpactStatus;
  versionsImpacted: string[];
  cvssScore:      string;
  businessImpact: BusinessImpact;
  dataSensitivity: DataSensitivity;
  exposureLevel:  ExposureLevel;
}

// ─── Risk engine ─────────────────────────────────────────────────────────────

const BUSINESS_WEIGHT:    Record<BusinessImpact,   number> = { Low: 1, Medium: 2, High: 3 };
const SENSITIVITY_WEIGHT: Record<DataSensitivity,  number> = { Public: 1, Internal: 2, Confidential: 3, Restricted: 4 };
const EXPOSURE_WEIGHT:    Record<ExposureLevel,    number> = { Internal: 1, External: 2, 'Internet-facing': 3 };

function calcRiskScore(form: ProductDetailForm): number {
  if (form.impactStatus !== 'Impacted') return 0;
  const raw = BUSINESS_WEIGHT[form.businessImpact] * SENSITIVITY_WEIGHT[form.dataSensitivity] * EXPOSURE_WEIGHT[form.exposureLevel];
  return Math.round((raw / 36) * 100);
}

function deriveSeverity(score: number): string {
  if (score >= 76) return 'Critical';
  if (score >= 51) return 'High';
  if (score >= 26) return 'Medium';
  return 'Low';
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const SEVERITY_RING: Record<string, string> = {
  Critical: 'border-red-500', High: 'border-orange-500', Medium: 'border-yellow-500', Low: 'border-blue-500',
};
const SEVERITY_TEXT: Record<string, string> = {
  Critical: 'text-red-400', High: 'text-orange-400', Medium: 'text-yellow-400', Low: 'text-blue-400',
};
const SEVERITY_BADGE: Record<string, string> = {
  Critical: 'bg-red-500/10 border-red-500/40 text-red-400',
  High:     'bg-orange-500/10 border-orange-500/40 text-orange-400',
  Medium:   'bg-yellow-500/10 border-yellow-500/40 text-yellow-400',
  Low:      'bg-blue-500/10 border-blue-500/40 text-blue-400',
};
const METER_COLOR: Record<string, string> = {
  Critical: 'bg-red-500', High: 'bg-orange-500', Medium: 'bg-yellow-500', Low: 'bg-blue-500',
};

// ─── Shared primitives ────────────────────────────────────────────────────────

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label className="block text-sm font-medium text-slate-300 mb-1.5">
      {children}
      {hint && <span className="text-slate-500 font-normal ml-1.5 text-xs">{hint}</span>}
    </label>
  );
}

function SectionCard({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-5">
      <div className="mb-5">
        <h3 className="text-white font-semibold text-sm">{title}</h3>
        {desc && <p className="text-slate-400 text-xs mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const router = useRouter();
  const { id: vulnInstantId, productName: encodedName } = useParams<{ id: string; productName: string }>();
  const productName = decodeURIComponent(encodedName);

  const { isLoading: authLoading, user } = db.useAuth();
  const { data: vulnData }      = db.useQuery({ vulnerabilities:  { $: { where: { id: vulnInstantId } } } });
  const { data: assessData }    = db.useQuery({ assessments:      { $: { where: { vulnerabilityRef: vulnInstantId } } } });
  const { data: ptData }        = db.useQuery({ productTriages:   { $: { where: { vulnerabilityRef: vulnInstantId, productName } } } });
  const { data: pdData }        = db.useQuery({
    productAssessments: {
      $: { where: { vulnerabilityRef: vulnInstantId, productName } },
    },
  });

  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [versionInput, setVersionInput] = useState('');

  const [form, setForm] = useState<ProductDetailForm>({
    impactStatus:    'Unknown',
    versionsImpacted: [],
    cvssScore:       '',
    businessImpact:  'Medium',
    dataSensitivity: 'Internal',
    exposureLevel:   'Internal',
  });

  // Hydrate from existing product assessment
  useEffect(() => {
    const existing = pdData?.productAssessments?.[0];
    if (!existing) return;
    const existingAny = existing as Record<string, unknown>;
    setForm({
      impactStatus:    (existing.impactStatus    as ImpactStatus)   ?? 'Unknown',
      versionsImpacted: (existing.versionsImpacted as string[])     ?? [],
      cvssScore:       existingAny.cvssScore != null ? String(existingAny.cvssScore) : '',
      businessImpact:  (existing.businessImpact  as BusinessImpact) ?? 'Medium',
      dataSensitivity: (existing.dataSensitivity as DataSensitivity) ?? 'Internal',
      exposureLevel:   (existing.exposureLevel   as ExposureLevel)  ?? 'Internal',
    });
    setSaved(true);
  }, [pdData]);

  // Sync impactStatus from parent assessment's affectedProducts list
  useEffect(() => {
    const assessment = assessData?.assessments?.[0];
    if (!assessment || pdData?.productAssessments?.[0]) return; // don't override if already has own record
    const products = (assessment.affectedProducts as { name: string; impactStatus: ImpactStatus }[]) ?? [];
    const match = products.find((p) => p.name === productName);
    if (match) setForm((prev) => ({ ...prev, impactStatus: match.impactStatus }));
  }, [assessData, pdData, productName]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [authLoading, user, router]);

  const riskScore = useMemo(() => calcRiskScore(form), [form]);
  const severity  = useMemo(() => deriveSeverity(riskScore), [riskScore]);

  if (authLoading || !user) return <Spinner />;

  const vuln     = vulnData?.vulnerabilities?.[0];
  const existing = pdData?.productAssessments?.[0];

  if (!vuln) return <Spinner />;

  // ── Helpers

  function setField<K extends keyof ProductDetailForm>(key: K, val: ProductDetailForm[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  }

  function addVersion() {
    const v = versionInput.trim();
    if (!v || form.versionsImpacted.includes(v)) return;
    setField('versionsImpacted', [...form.versionsImpacted, v]);
    setVersionInput('');
  }

  function removeVersion(v: string) {
    setField('versionsImpacted', form.versionsImpacted.filter((x) => x !== v));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const pdId = existing ? (existing as { id: string }).id : instantId();

      await db.transact([
        // Save per-product record
        db.tx.productAssessments[pdId].update({
          vulnerabilityRef: vulnInstantId,
          productName,
          impactStatus:     form.impactStatus,
          versionsImpacted: form.versionsImpacted,
          cvssScore:        parseFloat(form.cvssScore) || 0,
          businessImpact:   form.businessImpact,
          dataSensitivity:  form.dataSensitivity,
          exposureLevel:    form.exposureLevel,
          riskScore,
          suggestedSeverity: severity,
          updatedAt: Date.now(),
          createdAt: existing ? (existing.createdAt as number) : Date.now(),
        }),
        // Also sync impactStatus back to the parent assessment's affectedProducts array
        ...(assessData?.assessments?.[0]
          ? (() => {
              const a = assessData.assessments[0];
              const aId = (a as { id: string }).id;
              const products = ((a.affectedProducts as { name: string; impactStatus: string }[]) ?? [])
                .map((p) => p.name === productName ? { ...p, impactStatus: form.impactStatus } : p);
              return [db.tx.assessments[aId].update({ affectedProducts: products, updatedAt: Date.now() })];
            })()
          : []),
      ]);

      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  // ── Render

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar />

      {/* Main */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-3xl mx-auto">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm mb-6 flex-wrap">
            <Link href="/dashboard" className="text-slate-400 hover:text-white transition">Dashboard</Link>
            <span className="text-slate-700">/</span>
            <Link href={`/impact-assessment/${vulnInstantId}`} className="text-slate-400 hover:text-white transition">
              Impact Assessment
            </Link>
            <span className="text-slate-700">/</span>
            <span className="text-white font-medium">{productName}</span>
          </div>

          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Impact Assessment — {productName}</h1>
              <p className="text-slate-400 font-mono text-xs">{vuln.vulnerabilityId as string}</p>
              <p className="text-slate-400 text-sm mt-0.5">{vuln.title as string}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── Left: Form ── */}
            <div className="lg:col-span-2">

              {/* Impact Status */}
              <SectionCard title="Impact Status" desc="Is this product affected by the vulnerability?">
                <div className="flex gap-3">
                  {(['Impacted', 'Not-Impacted', 'Unknown'] as ImpactStatus[]).map((s) => (
                    <button key={s} onClick={() => setField('impactStatus', s)}
                      className={`flex-1 py-3 text-sm font-medium rounded-xl border-2 transition ${
                        form.impactStatus === s
                          ? s === 'Impacted'     ? 'bg-red-500/10 border-red-500 text-red-400'
                            : s === 'Not-Impacted' ? 'bg-green-500/10 border-green-500 text-green-400'
                            : 'bg-slate-700 border-slate-500 text-slate-300'
                          : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                      }`}>
                      {s === 'Not-Impacted' ? 'Not Impacted' : s}
                    </button>
                  ))}
                </div>
              </SectionCard>

              {/* Versions Impacted */}
              <SectionCard
                title="Version(s) Impacted"
                desc="List specific versions of this product affected by the vulnerability."
              >
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
                {form.versionsImpacted.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {form.versionsImpacted.map((v) => (
                      <span key={v} className="inline-flex items-center gap-1.5 bg-slate-800 border border-slate-700 text-slate-300 text-xs px-3 py-1 rounded-full">
                        {v}
                        <button onClick={() => removeVersion(v)} className="text-slate-500 hover:text-red-400 transition text-xs">✕</button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-600 text-xs">No versions added yet.</p>
                )}
              </SectionCard>

              {/* CVSS Score */}
              <SectionCard title="CVSS Score" desc="NVD numeric score (0.0 – 10.0) for this vulnerability.">
                {(() => {
                  const n = parseFloat(form.cvssScore) || 0;
                  const color = n >= 9 ? 'text-red-400' : n >= 7 ? 'text-orange-400' : n >= 4 ? 'text-yellow-400' : 'text-blue-400';
                  const bar   = n >= 9 ? 'bg-red-500'   : n >= 7 ? 'bg-orange-500'   : n >= 4 ? 'bg-yellow-500'   : 'bg-blue-500';
                  return (
                    <>
                      <div className="relative">
                        <input
                          type="number" min="0" max="10" step="0.1"
                          value={form.cvssScore}
                          onChange={(e) => setField('cvssScore', e.target.value)}
                          placeholder="e.g. 9.8"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition pr-16"
                        />
                        {form.cvssScore && (
                          <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-lg font-bold ${color}`}>
                            {n.toFixed(1)}
                          </span>
                        )}
                      </div>
                      {form.cvssScore && (
                        <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${(n / 10) * 100}%` }} />
                        </div>
                      )}
                    </>
                  );
                })()}
              </SectionCard>

              {/* Business Risk Factors */}
              <SectionCard title="Business Risk Factors" desc="These drive the risk score calculation for this product.">
                <div className="space-y-5">

                  {/* Business Impact */}
                  <div>
                    <Label hint="Operational impact if this product is exploited">Business Impact</Label>
                    <div className="flex gap-2">
                      {(['Low', 'Medium', 'High'] as BusinessImpact[]).map((v) => (
                        <button key={v} onClick={() => setField('businessImpact', v)}
                          className={`flex-1 py-2.5 text-sm rounded-lg border-2 transition font-medium ${
                            form.businessImpact === v
                              ? v === 'High'   ? 'bg-red-500/10 border-red-500 text-red-400'
                                : v === 'Medium' ? 'bg-yellow-500/10 border-yellow-500 text-yellow-400'
                                : 'bg-blue-500/10 border-blue-500 text-blue-400'
                              : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                          }`}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Data Sensitivity */}
                  <div>
                    <Label hint="Classification of data this product handles">Data Sensitivity</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['Public', 'Internal', 'Confidential', 'Restricted'] as DataSensitivity[]).map((v) => (
                        <button key={v} onClick={() => setField('dataSensitivity', v)}
                          className={`py-2.5 text-sm rounded-lg border-2 transition ${
                            form.dataSensitivity === v
                              ? 'bg-red-500/10 border-red-500 text-red-400'
                              : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                          }`}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Exposure Level */}
                  <div>
                    <Label hint="How this product is exposed on the network">Exposure Level</Label>
                    <div className="flex gap-2">
                      {(['Internal', 'External', 'Internet-facing'] as ExposureLevel[]).map((v) => (
                        <button key={v} onClick={() => setField('exposureLevel', v)}
                          className={`flex-1 py-2.5 text-sm rounded-lg border-2 transition ${
                            form.exposureLevel === v
                              ? v === 'Internet-facing' ? 'bg-red-500/10 border-red-500 text-red-400'
                                : v === 'External'       ? 'bg-orange-500/10 border-orange-500 text-orange-400'
                                : 'bg-slate-700 border-slate-500 text-slate-300'
                              : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                          }`}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* ── Right: Risk meter ── */}
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sticky top-6">
                <h3 className="text-white font-semibold text-sm mb-5">{productName} Risk</h3>

                {/* Score circle */}
                <div className="flex flex-col items-center mb-6">
                  <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center mb-3 ${SEVERITY_RING[severity]}`}>
                    <span className={`text-3xl font-bold ${SEVERITY_TEXT[severity]}`}>{riskScore}</span>
                  </div>
                  <span className={`text-sm font-semibold px-3 py-1 rounded-full border ${SEVERITY_BADGE[severity]}`}>
                    {form.impactStatus === 'Not-Impacted' ? 'Not Impacted' : severity}
                  </span>
                </div>

                {/* Meter bar */}
                <div className="mb-5">
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${METER_COLOR[severity]}`}
                      style={{ width: `${riskScore}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>0</span><span>50</span><span>100</span>
                  </div>
                </div>

                {/* Factor bars */}
                <div className="space-y-3 text-xs border-t border-slate-800 pt-4">
                  <p className="text-slate-400 mb-2">Score factors</p>
                  {[
                    { label: 'Business Impact',  value: form.businessImpact,  weight: BUSINESS_WEIGHT[form.businessImpact],      max: 3 },
                    { label: 'Data Sensitivity', value: form.dataSensitivity, weight: SENSITIVITY_WEIGHT[form.dataSensitivity], max: 4 },
                    { label: 'Exposure Level',   value: form.exposureLevel,   weight: EXPOSURE_WEIGHT[form.exposureLevel],       max: 3 },
                  ].map((f) => (
                    <div key={f.label}>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>{f.label}</span>
                        <span className="text-slate-300">{f.value}</span>
                      </div>
                      <div className="h-1 bg-slate-800 rounded-full">
                        <div className="h-full bg-slate-500 rounded-full transition-all duration-300"
                          style={{ width: `${(f.weight / f.max) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Versions summary */}
                {form.versionsImpacted.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-800">
                    <p className="text-slate-400 text-xs mb-2">Affected versions</p>
                    <div className="flex flex-wrap gap-1">
                      {form.versionsImpacted.map((v) => (
                        <span key={v} className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">{v}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Save */}
              <button onClick={handleSave} disabled={saving}
                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium py-3 rounded-xl transition flex items-center justify-center gap-2">
                {saving ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                ) : saved ? (
                  <><span className="text-green-300">✓</span> Saved</>
                ) : (
                  'Save Product Details'
                )}
              </button>

              {/* Next: Triage — only shown when Impacted or Unknown */}
              {(form.impactStatus === 'Impacted' || form.impactStatus === 'Unknown') && (() => {
                const triageRecord = ptData?.productTriages?.[0];
                const triageDecision = triageRecord?.decision as string | undefined;
                const triageStatus  = triageRecord?.status  as string | undefined;
                return saved ? (
                  <div className="space-y-2">
                    {triageDecision && (
                      <div className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${
                        triageDecision === 'Accept'         ? 'bg-green-500/5 border-green-500/30 text-green-400'
                        : triageDecision === 'Reject'       ? 'bg-red-500/5 border-red-500/30 text-red-400'
                        : 'bg-yellow-500/5 border-yellow-500/30 text-yellow-400'
                      }`}>
                        <span>Triage: {triageStatus}</span>
                        <span className="text-slate-400">
                          {triageRecord?.assignedTeam as string}
                          {triageRecord?.severity ? ` · ${triageRecord.severity as string}` : ''}
                        </span>
                      </div>
                    )}
                    <Link
                      href={`/triage/${vulnInstantId}/product/${encodedName}`}
                      className="block w-full text-center text-sm font-medium bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-xl transition"
                    >
                      {triageDecision ? 'View / Update Triage →' : `Next: Triage ${productName} →`}
                    </Link>
                  </div>
                ) : (
                  <div className="w-full text-center text-sm text-slate-600 border border-slate-800 py-3 rounded-xl cursor-not-allowed">
                    Save to unlock Triage
                  </div>
                );
              })()}

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Spinner() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
