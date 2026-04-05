'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import db from '@/lib/instant';

type TriageStatus = 'New' | 'Accepted' | 'Rejected' | 'Needs Info';

const COLUMNS: { status: TriageStatus; label: string; color: string; border: string; badge: string }[] = [
  { status: 'New',        label: 'New',         color: 'text-slate-300', border: 'border-slate-700',    badge: 'bg-slate-700 text-slate-300' },
  { status: 'Needs Info', label: 'Needs Info',  color: 'text-yellow-400', border: 'border-yellow-700/40', badge: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30' },
  { status: 'Accepted',   label: 'Accepted',    color: 'text-green-400',  border: 'border-green-700/40',  badge: 'bg-green-500/10 text-green-400 border border-green-500/30' },
  { status: 'Rejected',   label: 'Rejected',    color: 'text-red-400',    border: 'border-red-700/40',    badge: 'bg-red-500/10 text-red-400 border border-red-500/30' },
];

const SEVERITY_DOT: Record<string, string> = {
  Critical: 'bg-red-500',
  High:     'bg-orange-500',
  Medium:   'bg-yellow-500',
  Low:      'bg-blue-500',
};

const PRIORITY_COLOR: Record<string, string> = {
  P1: 'text-red-400', P2: 'text-orange-400', P3: 'text-yellow-400', P4: 'text-slate-400',
};

export default function TriageBoardPage() {
  const router = useRouter();
  const { isLoading, user } = db.useAuth();
  const { data: vulnData }   = db.useQuery({ vulnerabilities: {} });
  const { data: triageData } = db.useQuery({ triages: {} });

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

  const vulns  = vulnData?.vulnerabilities  ?? [];
  const triages = triageData?.triages       ?? [];

  // Build a map of vulnerabilityRef → triage record
  const triageByVuln = Object.fromEntries(
    triages.map((t) => [t.vulnerabilityRef as string, t])
  );

  // Assign each vulnerability to a kanban column
  type VulnWithTriage = typeof vulns[number] & {
    _triageStatus: TriageStatus;
    _triage: typeof triages[number] | undefined;
    _instantId: string;
  };

  const cards: VulnWithTriage[] = vulns.map((v) => {
    const vid = (v as { id: string }).id;
    const triage = triageByVuln[vid];
    const status: TriageStatus = (triage?.status as TriageStatus) ?? 'New';
    return { ...v, _triageStatus: status, _triage: triage, _instantId: vid };
  });

  const byStatus = (status: TriageStatus) =>
    cards.filter((c) => c._triageStatus === status)
         .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-56 border-r border-slate-800 flex flex-col px-4 py-6 gap-1 shrink-0">
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="w-7 h-7 bg-red-600 rounded flex items-center justify-center text-white font-bold text-xs">ZA</div>
          <span className="font-semibold text-white text-sm">Zero-Day Atlas</span>
        </div>
        {[
          { label: 'Dashboard',       href: '/dashboard',       icon: '◉' },
          { label: 'Vulnerabilities', href: '/vulnerabilities', icon: '⚠' },
          { label: 'Triage Board',    href: '/triage',          icon: '⬛', active: true },
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
      <main className="flex-1 p-8 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-white">Triage Board</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {cards.length} vulnerabilities · {byStatus('Accepted').length} accepted · {byStatus('New').length} awaiting triage
            </p>
          </div>
          <Link
            href="/log-vulnerability"
            className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition flex items-center gap-2"
          >
            <span>+</span> Log Vulnerability
          </Link>
        </div>

        {vulns.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <p className="text-4xl">⬛</p>
              <p className="text-white font-semibold">No vulnerabilities to triage</p>
              <p className="text-slate-400 text-sm">Log a vulnerability first to start the triage process.</p>
              <Link href="/log-vulnerability"
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition mt-2">
                + Log Vulnerability
              </Link>
            </div>
          </div>
        ) : (
          /* Kanban columns */
          <div className="flex gap-5 overflow-x-auto pb-4 flex-1 items-start">
            {COLUMNS.map((col) => {
              const colCards = byStatus(col.status);
              return (
                <div key={col.status} className="w-72 shrink-0 flex flex-col gap-3">
                  {/* Column header */}
                  <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${col.border} bg-slate-900/60`}>
                    <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${col.badge}`}>{colCards.length}</span>
                  </div>

                  {/* Cards */}
                  <div className="flex flex-col gap-3">
                    {colCards.length === 0 && (
                      <div className="border-2 border-dashed border-slate-800 rounded-xl p-6 text-center text-slate-600 text-xs">
                        No items
                      </div>
                    )}
                    {colCards.map((card) => (
                      <KanbanCard
                        key={card._instantId}
                        card={card}
                        onOpenTriage={() => router.push(`/triage/${card._instantId}`)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function KanbanCard({
  card, onOpenTriage,
}: {
  card: {
    vulnerabilityId: string;
    title: string;
    isZeroDay: boolean;
    _triageStatus: TriageStatus;
    _triage: { severity?: unknown; priority?: unknown; assignedTeam?: unknown; assignedOwner?: unknown; slaDeadline?: unknown } | undefined;
    dateDiscovered: string;
  };
  onOpenTriage: () => void;
}) {
  const severity = (card._triage?.severity as string) ?? '';
  const priority = (card._triage?.priority as string) ?? '';
  const slaDeadline = card._triage?.slaDeadline as string | undefined;
  const slaDate     = slaDeadline ? new Date(slaDeadline) : null;
  const slaOverdue  = slaDate ? slaDate < new Date() : false;
  const slaLabel    = slaDate
    ? slaOverdue
      ? 'SLA Breached'
      : `Due ${slaDate.toLocaleDateString()}`
    : null;

  return (
    <div
      onClick={onOpenTriage}
      className="bg-slate-900 border border-slate-800 rounded-xl p-4 cursor-pointer hover:border-slate-600 transition group"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-slate-500 font-mono text-xs">{card.vulnerabilityId}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {card.isZeroDay && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">0day</span>
          )}
          {priority && (
            <span className={`text-xs font-bold ${PRIORITY_COLOR[priority] ?? 'text-slate-400'}`}>{priority}</span>
          )}
        </div>
      </div>

      {/* Title */}
      <p className="text-white text-sm font-medium leading-snug mb-3 line-clamp-2 group-hover:text-red-300 transition">
        {card.title}
      </p>

      {/* Severity + team row */}
      <div className="flex items-center gap-2 flex-wrap">
        {severity ? (
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <span className={`w-2 h-2 rounded-full ${SEVERITY_DOT[severity] ?? 'bg-slate-500'}`} />
            {severity}
          </span>
        ) : (
          <span className="text-xs text-slate-600 italic">Unsorted</span>
        )}
        {typeof card._triage?.assignedTeam === 'string' && card._triage.assignedTeam && (
          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
            {card._triage.assignedTeam}
          </span>
        )}
      </div>

      {/* SLA row */}
      {slaLabel && (
        <div className={`mt-2 pt-2 border-t border-slate-800 text-xs flex items-center gap-1 ${slaOverdue ? 'text-red-400' : 'text-slate-500'}`}>
          <span>{slaOverdue ? '⚠' : '🕐'}</span>
          <span>{slaLabel}</span>
        </div>
      )}

      {/* Unconfirmed state */}
      {card._triageStatus === 'New' && (
        <div className="mt-3 pt-2 border-t border-slate-800">
          <span className="text-xs text-slate-500 group-hover:text-red-400 transition">
            Click to triage →
          </span>
        </div>
      )}
    </div>
  );
}
