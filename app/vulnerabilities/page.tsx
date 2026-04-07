'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Archive, ArchiveRestore, AlertTriangle } from 'lucide-react';
import db from '@/lib/instant';
import Sidebar from '@/app/components/Sidebar';

const SEVERITY_BADGE: Record<string, string> = {
  Critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  High:     'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Medium:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  Low:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

const STATUS_BADGE: Record<string, string> = {
  Open:          'bg-red-500/10 text-red-400 border-red-500/20',
  'In Progress': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Closed:        'bg-slate-700 text-slate-400 border-slate-600',
};

const ALL_STATUSES   = ['Open', 'In Progress', 'Closed'];
const ALL_SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];

// ─── Archive Confirm Dialog ───────────────────────────────────────────────────

function ArchiveConfirm({
  title,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
        <div className="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center">
          <Archive size={18} className="text-yellow-400" />
        </div>
        <div>
          <h3 className="text-white font-semibold text-base">Archive Vulnerability</h3>
          <p className="text-slate-400 text-sm mt-1">
            Archive <span className="text-white font-medium">"{title}"</span>?
            It will be hidden from all other users and moved to the Archived view.
          </p>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onCancel}
            className="flex-1 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2 text-sm bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white font-medium rounded-lg transition">
            {loading ? 'Archiving…' : 'Archive'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VulnerabilitiesPage() {
  const router = useRouter();
  const { isLoading, user } = db.useAuth();

  const { data: vulnData }          = db.useQuery({ vulnerabilities: {} });
  const { data: triageData }        = db.useQuery({ triages: {} });
  const { data: assessmentData }    = db.useQuery({ assessments: {} });
  const { data: remediationData }   = db.useQuery({ remediations: {} });
  const { data: productTriageData } = db.useQuery({ productTriages: {} });
  const { data: userRolesData }     = db.useQuery({ userRoles: {} });

  const [search,         setSearch]         = useState('');
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterZeroDay,  setFilterZeroDay]  = useState(false);
  const [activeView,     setActiveView]     = useState<'active' | 'archived'>('active');
  const [archivingVuln,  setArchivingVuln]  = useState<{ id: string; title: string } | null>(null);
  const [archiving,      setArchiving]      = useState(false);

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

  const allVulns   = vulnData?.vulnerabilities ?? [];
  const triages    = triageData?.triages ?? [];
  const userRoles  = userRolesData?.userRoles ?? [];

  // Admin if no userRoles exist yet (bootstrap) or current user has Admin role
  const isAdmin =
    userRoles.length === 0 ||
    userRoles.some((ur: { email: string; roleName: string }) => ur.email === user!.email && ur.roleName === 'Admin');

  // Split active vs archived
  const activeVulns   = allVulns.filter(v => !(v as { archived?: boolean }).archived);
  const archivedVulns = allVulns.filter(v =>  !!(v as { archived?: boolean }).archived);

  // Non-admins always see only active
  const vulns = (!isAdmin || activeView === 'active') ? activeVulns : archivedVulns;

  // ── Severity / Risk Score lookups ─────────────────────────────────────────

  const assessments = assessmentData?.assessments ?? [];
  const severityByVuln: Record<string, string> = {};
  const riskScoreByVuln: Record<string, number> = {};
  for (const a of assessments) {
    if (a.vulnerabilityRef && a.suggestedSeverity)
      severityByVuln[a.vulnerabilityRef as string] = a.suggestedSeverity as string;
    if (a.vulnerabilityRef && a.riskScore != null)
      riskScoreByVuln[a.vulnerabilityRef as string] = a.riskScore as number;
  }
  for (const t of triages) {
    if (t.vulnerabilityRef && t.severity)
      severityByVuln[t.vulnerabilityRef as string] = t.severity as string;
  }

  // ── Status derivation ─────────────────────────────────────────────────────

  const remediations   = remediationData?.remediations ?? [];
  const productTriages = productTriageData?.productTriages ?? [];

  type RemEntry = { status: string; verificationStatus: string };
  const remsByVuln: Record<string, RemEntry[]> = {};
  for (const r of remediations) {
    const ref = r.vulnerabilityRef as string;
    if (!remsByVuln[ref]) remsByVuln[ref] = [];
    remsByVuln[ref].push({
      status:             (r.status             as string) ?? '',
      verificationStatus: (r.verificationStatus as string) ?? '',
    });
  }

  function isRemClosed(rem: RemEntry): boolean {
    return rem.verificationStatus === 'Verified' || rem.verificationStatus === "Can't Verify";
  }

  const triagedVulns:   Set<string>            = new Set();
  const rejectedByVuln: Record<string, number> = {};
  const acceptedByVuln: Record<string, number> = {};
  for (const pt of productTriages) {
    const ref      = pt.vulnerabilityRef as string;
    const decision = (pt.decision as string) ?? '';
    if (decision === 'Reject' || decision === 'Rejected' || decision === 'Risk Accepted')
      rejectedByVuln[ref] = (rejectedByVuln[ref] ?? 0) + 1;
    else
      acceptedByVuln[ref] = (acceptedByVuln[ref] ?? 0) + 1;
    triagedVulns.add(ref);
  }

  function deriveStatus(vulnId: string, rawStatus: string): string {
    const rawLower = (rawStatus ?? '').toLowerCase();
    if (rawLower === 'closed') return 'Closed';
    const rems = remsByVuln[vulnId] ?? [];
    if (rems.length > 0) {
      if (rems.every(isRemClosed)) return 'Closed';
      return 'In Progress';
    }
    if (triagedVulns.has(vulnId) && !acceptedByVuln[vulnId] && rejectedByVuln[vulnId]) return 'Closed';
    if (triagedVulns.has(vulnId)) return 'In Progress';
    if (rawLower === 'in progress' || rawLower === 'needs info' ||
        rawLower === 'pending verification' || rawLower === 'remediated') return 'In Progress';
    return 'Open';
  }

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = [...vulns]
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .filter((v) => {
      const vid      = (v as { id: string }).id;
      const severity = severityByVuln[vid] ?? '';
      const status   = deriveStatus(vid, v.status as string ?? '');
      if (search &&
          !v.title?.toLowerCase().includes(search.toLowerCase()) &&
          !v.vulnerabilityId?.toLowerCase().includes(search.toLowerCase()) &&
          !v.cveId?.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus   && status !== filterStatus)     return false;
      if (filterSeverity && severity !== filterSeverity) return false;
      if (filterZeroDay  && !v.isZeroDay)                return false;
      return true;
    });

  function clearFilters() {
    setSearch('');
    setFilterStatus('');
    setFilterSeverity('');
    setFilterZeroDay(false);
  }

  const hasFilters = search || filterStatus || filterSeverity || filterZeroDay;

  // ── Archive / Unarchive ───────────────────────────────────────────────────

  async function archiveVuln(vulnId: string) {
    setArchiving(true);
    try {
      await db.transact(
        db.tx.vulnerabilities[vulnId].update({
          archived:   true,
          archivedAt: Date.now(),
          archivedBy: user!.email ?? '',
        })
      );
      setArchivingVuln(null);
    } finally {
      setArchiving(false);
    }
  }

  function unarchiveVuln(vulnId: string) {
    db.transact(
      db.tx.vulnerabilities[vulnId].update({
        archived:   false,
        archivedAt: 0,
        archivedBy: '',
      })
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-white">Vulnerabilities</h1>
              <p className="text-slate-400 text-sm mt-0.5">
                {filtered.length} of {vulns.length} {activeView === 'archived' ? 'archived' : 'active'}
              </p>
            </div>
            <Link href="/log-vulnerability"
              className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition flex items-center gap-2">
              <span>+</span> Log Vulnerability
            </Link>
          </div>

          {/* Admin view tabs */}
          {isAdmin && (
            <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit mb-6">
              <button onClick={() => setActiveView('active')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeView === 'active'
                    ? 'bg-slate-700 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}>
                Active
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeView === 'active' ? 'bg-slate-600 text-slate-300' : 'bg-slate-800 text-slate-500'
                }`}>
                  {activeVulns.length}
                </span>
              </button>
              <button onClick={() => setActiveView('archived')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeView === 'archived'
                    ? 'bg-slate-700 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}>
                <Archive size={14} />
                Archived
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeView === 'archived' ? 'bg-slate-600 text-slate-300' : 'bg-slate-800 text-slate-500'
                }`}>
                  {archivedVulns.length}
                </span>
              </button>
            </div>
          )}

          {/* Filters bar */}
          <div className="flex flex-wrap gap-3 mb-6">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, title, CVE…"
              className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition w-64"
            />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition appearance-none">
              <option value="">All Statuses</option>
              {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition appearance-none">
              <option value="">All Severities</option>
              {ALL_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => setFilterZeroDay(!filterZeroDay)}
              className={`px-4 py-2 text-sm rounded-lg border transition ${
                filterZeroDay
                  ? 'bg-red-500/10 border-red-500/40 text-red-400'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}>
              Zero-Day only
            </button>
            {hasFilters && (
              <button onClick={clearFilters}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition">
                Clear filters ✕
              </button>
            )}
          </div>

          {/* Archived notice banner */}
          {isAdmin && activeView === 'archived' && (
            <div className="flex items-center gap-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3 mb-4 text-xs text-yellow-300">
              <AlertTriangle size={14} className="shrink-0" />
              Archived vulnerabilities are hidden from all non-Admin users. Use "Unarchive" to restore visibility.
            </div>
          )}

          {/* Table */}
          {allVulns.length === 0 ? (
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
              <p className="text-slate-400 text-sm">
                {hasFilters
                  ? 'No vulnerabilities match the current filters.'
                  : activeView === 'archived'
                  ? 'No archived vulnerabilities.'
                  : 'No active vulnerabilities.'}
              </p>
              {hasFilters && (
                <button onClick={clearFilters} className="mt-3 text-red-400 hover:text-red-300 text-sm transition">
                  Clear filters
                </button>
              )}
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
                    const vid      = (v as { id: string }).id;
                    const severity = severityByVuln[vid] ?? '';
                    const status   = deriveStatus(vid, v.status as string ?? '');
                    const isArchivedRow = !!(v as { archived?: boolean }).archived;

                    return (
                      <tr key={vid}
                        className={`border-b border-slate-800/50 transition ${
                          isArchivedRow ? 'opacity-70 hover:bg-slate-800/20' : 'hover:bg-slate-800/30'
                        }`}>
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
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGE[status] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                            {status}
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

                        {/* Actions */}
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            {!isArchivedRow && (
                              <Link href={`/impact-assessment/${vid}`}
                                className="text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-2 py-1 rounded transition">
                                Assess
                              </Link>
                            )}
                            {isAdmin && !isArchivedRow && (
                              <button
                                onClick={() => setArchivingVuln({ id: vid, title: v.title as string })}
                                className="flex items-center gap-1 text-xs text-slate-500 hover:text-yellow-400 border border-slate-700 hover:border-yellow-600/40 px-2 py-1 rounded transition">
                                <Archive size={11} /> Archive
                              </button>
                            )}
                            {isAdmin && isArchivedRow && (
                              <button
                                onClick={() => unarchiveVuln(vid)}
                                className="flex items-center gap-1 text-xs text-slate-500 hover:text-green-400 border border-slate-700 hover:border-green-600/40 px-2 py-1 rounded transition">
                                <ArchiveRestore size={11} /> Unarchive
                              </button>
                            )}
                          </div>
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

      {/* Archive confirm dialog */}
      {archivingVuln && (
        <ArchiveConfirm
          title={archivingVuln.title}
          onConfirm={() => archiveVuln(archivingVuln.id)}
          onCancel={() => setArchivingVuln(null)}
          loading={archiving}
        />
      )}
    </div>
  );
}
