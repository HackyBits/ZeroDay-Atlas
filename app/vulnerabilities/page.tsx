'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import db from '@/lib/instant';

const SEVERITY_BADGE: Record<string, string> = {
  Critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  High:     'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Medium:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  Low:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

const STATUS_BADGE: Record<string, string> = {
  Open:                 'bg-red-500/10 text-red-400 border-red-500/20',
  'In Progress':        'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Remediated:           'bg-green-500/10 text-green-400 border-green-500/20',
  'Pending Verification': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  Closed:               'bg-slate-700 text-slate-400 border-slate-600',
  'Needs Info':         'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

const ALL_STATUSES = ['Open', 'In Progress', 'Needs Info', 'Remediated', 'Pending Verification', 'Closed'];
const ALL_SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];

export default function VulnerabilitiesPage() {
  const router = useRouter();
  const { isLoading, user } = db.useAuth();
  const { data: vulnData }      = db.useQuery({ vulnerabilities: {} });
  const { data: triageData }    = db.useQuery({ triages: {} });
  const { data: assessmentData } = db.useQuery({ assessments: {} });

  const [search,   setSearch]   = useState('');
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterZeroDay,  setFilterZeroDay]  = useState(false);

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

  const vulns  = vulnData?.vulnerabilities ?? [];
  const triages = triageData?.triages ?? [];

  // Build severity + risk score lookups: assessment as base, triage.severity takes precedence for severity
  const assessments = assessmentData?.assessments ?? [];
  const severityByVuln: Record<string, string> = {};
  const riskScoreByVuln: Record<string, number> = {};
  for (const a of assessments) {
    if (a.vulnerabilityRef && a.suggestedSeverity) {
      severityByVuln[a.vulnerabilityRef as string] = a.suggestedSeverity as string;
    }
    if (a.vulnerabilityRef && a.riskScore != null) {
      riskScoreByVuln[a.vulnerabilityRef as string] = a.riskScore as number;
    }
  }
  for (const t of triages) {
    if (t.vulnerabilityRef && t.severity) {
      severityByVuln[t.vulnerabilityRef as string] = t.severity as string;
    }
  }

  // Filter
  const filtered = [...vulns]
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .filter((v) => {
      const vid = (v as { id: string }).id;
      const severity = severityByVuln[vid] ?? '';
      if (search && !v.title?.toLowerCase().includes(search.toLowerCase()) &&
          !v.vulnerabilityId?.toLowerCase().includes(search.toLowerCase()) &&
          !v.cveId?.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus   && v.status !== filterStatus)     return false;
      if (filterSeverity && severity !== filterSeverity)   return false;
      if (filterZeroDay  && !v.isZeroDay)                  return false;
      return true;
    });

  function clearFilters() {
    setSearch('');
    setFilterStatus('');
    setFilterSeverity('');
    setFilterZeroDay(false);
  }

  const hasFilters = search || filterStatus || filterSeverity || filterZeroDay;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-56 border-r border-slate-800 flex flex-col px-4 py-6 gap-1 shrink-0">
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="w-7 h-7 bg-red-600 rounded flex items-center justify-center text-white font-bold text-xs">ZA</div>
          <span className="font-semibold text-white text-sm">Zero-Day Atlas</span>
        </div>
        {[
          { label: 'Dashboard',       href: '/dashboard',        icon: '◉' },
          { label: 'Vulnerabilities', href: '/vulnerabilities',  icon: '⚠', active: true },
          { label: 'Products',        href: '/products',         icon: '⬡' },
          { label: 'Reports',         href: '/reports',          icon: '📊' },
          { label: 'Settings',        href: '/settings',         icon: '⚙' },
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
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-xl font-bold text-white">Vulnerabilities</h1>
              <p className="text-slate-400 text-sm mt-0.5">
                {filtered.length} of {vulns.length} total
              </p>
            </div>
            <Link href="/log-vulnerability"
              className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition flex items-center gap-2">
              <span>+</span> Log Vulnerability
            </Link>
          </div>

          {/* Filters bar */}
          <div className="flex flex-wrap gap-3 mb-6">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, title, CVE…"
              className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition w-64"
            />

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition appearance-none"
            >
              <option value="">All Statuses</option>
              {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition appearance-none"
            >
              <option value="">All Severities</option>
              {ALL_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            <button
              onClick={() => setFilterZeroDay(!filterZeroDay)}
              className={`px-4 py-2 text-sm rounded-lg border transition ${
                filterZeroDay
                  ? 'bg-red-500/10 border-red-500/40 text-red-400'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              Zero-Day only
            </button>

            {hasFilters && (
              <button onClick={clearFilters}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition">
                Clear filters ✕
              </button>
            )}
          </div>

          {/* Table */}
          {vulns.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-16 text-center">
              <div className="text-4xl mb-4">⚠</div>
              <h2 className="text-white font-semibold mb-2">No vulnerabilities yet</h2>
              <p className="text-slate-400 text-sm mb-6">Start by logging your first vulnerability.</p>
              <Link href="/log-vulnerability"
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition">
                + Log Vulnerability
              </Link>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
              <p className="text-slate-400 text-sm">No vulnerabilities match the current filters.</p>
              <button onClick={clearFilters} className="mt-3 text-red-400 hover:text-red-300 text-sm transition">
                Clear filters
              </button>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs">
                    <th className="text-left px-6 py-3 font-medium">ID</th>
                    <th className="text-left px-6 py-3 font-medium">Title</th>
                    <th className="text-left px-6 py-3 font-medium">Risk Score</th>
                    <th className="text-left px-6 py-3 font-medium">Severity</th>
                    <th className="text-left px-6 py-3 font-medium">Status</th>
                    <th className="text-left px-6 py-3 font-medium">Tags</th>
                    <th className="text-left px-6 py-3 font-medium">Discovered</th>
                    <th className="text-left px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => {
                    const vid = (v as { id: string }).id;
                    const severity = severityByVuln[vid] ?? '';
                    return (
                      <tr key={vid} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                        <td className="px-6 py-3">
                          <Link href={`/vulnerabilities/${vid}`}
                            className="font-mono text-xs text-slate-400 hover:text-white transition">
                            {v.vulnerabilityId}
                          </Link>
                        </td>
                        <td className="px-6 py-3">
                          <Link href={`/impact-assessment/${vid}`} className="block max-w-xs">
                            <div className="text-white hover:text-red-300 transition truncate">{v.title}</div>
                            {v.cveId && <div className="text-slate-500 text-xs">{v.cveId}</div>}
                          </Link>
                        </td>
                        <td className="px-6 py-3">
                          {riskScoreByVuln[vid] != null ? (
                            <span className={`text-xs font-semibold ${
                              riskScoreByVuln[vid] >= 76 ? 'text-red-400'
                              : riskScoreByVuln[vid] >= 51 ? 'text-orange-400'
                              : riskScoreByVuln[vid] >= 26 ? 'text-yellow-400'
                              : 'text-blue-400'
                            }`}>
                              {riskScoreByVuln[vid]}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          {severity ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${SEVERITY_BADGE[severity] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                              {severity}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-xs">Not triaged</span>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGE[v.status ?? ''] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                            {v.status ?? 'Open'}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {v.isZeroDay && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">0-day</span>
                            )}
                            {v.exploitAvailability === 'Yes' && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">Exploit</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-slate-400 text-xs">{v.dateDiscovered}</td>
                        <td className="px-6 py-3">
                          <Link href={`/impact-assessment/${vid}`}
                            className="text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-2 py-1 rounded transition">
                            Assess
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
