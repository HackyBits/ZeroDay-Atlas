'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  ShieldAlert,
  Boxes,
  BarChart3,
  Settings,
  LogOut,
  Bell,
  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-react';
import db from '@/lib/instant';

const NAV_ITEMS = [
  { label: 'Dashboard',       href: '/dashboard',       Icon: LayoutDashboard },
  { label: 'Vulnerabilities', href: '/vulnerabilities', Icon: ShieldAlert      },
  { label: 'Products',        href: '/products',        Icon: Boxes            },
  { label: 'Reports',         href: '/reports',         Icon: BarChart3        },
  { label: 'Settings',        href: '/settings',        Icon: Settings         },
];

const PRODUCTS = [
  { name: 'Agileplace',    icon: '⬛' },
  { name: 'Portfolios',    icon: '📁' },
  { name: 'Adaptivework',  icon: '🔁' },
  { name: 'Anvi',          icon: '🧠' },
  { name: 'Projectplace',  icon: '📋' },
  { name: 'LeanKit',       icon: '📌' },
  { name: 'Spigit',        icon: '💡' },
  { name: 'Tasktop',       icon: '🔗' },
];

const PRODUCT_EVENTS = [
  { key: 'newVuln',      label: 'New vulnerability logged'  },
  { key: 'assessment',   label: 'Impact assessment saved'   },
  { key: 'triage',       label: 'Triage saved'              },
  { key: 'remediation',  label: 'Remediation saved'         },
  { key: 'verification', label: 'Verification saved'        },
] as const;

type EventKey = typeof PRODUCT_EVENTS[number]['key'];

type ProductPref = {
  enabled: boolean;
  events: Record<EventKey, boolean>;
};

function defaultProductPref(): ProductPref {
  return {
    enabled: false,
    events: { newVuln: true, assessment: true, triage: true, remediation: true, verification: true },
  };
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative shrink-0 rounded-full transition-colors duration-200 ${on ? 'bg-red-600' : 'bg-slate-700'}`}
      style={{ width: 32, height: 18 }}
      aria-checked={on}
      role="switch"
    >
      <span
        className="absolute top-0.5 bg-white rounded-full shadow transition-transform duration-200"
        style={{ width: 14, height: 14, left: 2, transform: on ? 'translateX(14px)' : 'translateX(0)' }}
      />
    </button>
  );
}

function getInitials(email: string): string {
  const username = email.split('@')[0];
  const parts = username.split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = db.useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen]     = useState(false);
  const [expanded, setExpanded]       = useState<Record<string, boolean>>({});

  const [prefs, setPrefs] = useState<Record<string, ProductPref>>(
    Object.fromEntries(PRODUCTS.map(p => [p.name, defaultProductPref()]))
  );

  const dropdownRef = useRef<HTMLDivElement>(null);

  const userEmail = user?.email ?? '';
  const { data } = db.useQuery(
    userEmail ? { userRoles: { $: { where: { email: userEmail } } } } : null
  );
  const roleName = data?.userRoles?.[0]?.roleName ?? 'User';
  const initials  = userEmail ? getInitials(userEmail) : '--';

  useEffect(() => {
    if (!profileOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [profileOpen]);

  function toggleProduct(name: string) {
    setPrefs(prev => {
      const cur = prev[name];
      const next = { ...cur, enabled: !cur.enabled };
      // Auto-expand when enabling
      if (next.enabled) setExpanded(e => ({ ...e, [name]: true }));
      return { ...prev, [name]: next };
    });
  }

  function toggleEvent(productName: string, eventKey: EventKey) {
    setPrefs(prev => ({
      ...prev,
      [productName]: {
        ...prev[productName],
        events: { ...prev[productName].events, [eventKey]: !prev[productName].events[eventKey] },
      },
    }));
  }

  const enabledCount = Object.values(prefs).filter(p => p.enabled).length;

  return (
    <>
      <aside className="w-56 border-r border-slate-800 flex flex-col px-4 py-6 gap-0.5 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8 px-2">
          <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0">
            ZA
          </div>
          <span className="font-semibold text-white text-sm tracking-tight">Zero-Day Atlas</span>
        </div>

        {/* Nav items */}
        {NAV_ITEMS.map(({ label, href, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link key={label} href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-red-600/15 text-red-400 border border-red-600/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
              }`}>
              <Icon size={16} strokeWidth={active ? 2.2 : 1.8} className="shrink-0" />
              {label}
            </Link>
          );
        })}

        {/* Profile menu */}
        <div className="mt-auto pt-4 border-t border-slate-800 relative" ref={dropdownRef}>
          {profileOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-slate-800">
                <p className="text-white text-xs font-semibold">{initials}</p>
                <p className="text-slate-500 text-xs mt-0.5">{roleName}</p>
              </div>
              <button
                onClick={() => { setNotifOpen(true); setProfileOpen(false); }}
                className="flex items-center gap-3 px-4 py-2.5 w-full text-sm text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
              >
                <Bell size={14} className="shrink-0" />
                <span>Notification Preferences</span>
                {enabledCount > 0 && (
                  <span className="ml-auto bg-red-600/80 text-white text-xs font-bold rounded-full px-1.5 py-0.5 leading-none">
                    {enabledCount}
                  </span>
                )}
              </button>
              <div className="border-t border-slate-800" />
              <button
                onClick={() => db.auth.signOut()}
                className="flex items-center gap-3 px-4 py-2.5 w-full text-sm text-red-400 hover:text-red-300 hover:bg-red-600/10 transition-colors"
              >
                <LogOut size={14} className="shrink-0" />
                Sign Out
              </button>
            </div>
          )}

          <button
            onClick={() => setProfileOpen(prev => !prev)}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium hover:bg-slate-800/60 border border-transparent transition-all group"
          >
            <div className="w-7 h-7 bg-red-700/80 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0">
              {initials}
            </div>
            <div className="flex flex-col items-start leading-tight min-w-0">
              <span className="text-white text-xs font-semibold truncate w-full">{initials}</span>
              <span className="text-slate-500 text-xs truncate w-full">{roleName}</span>
            </div>
            <ChevronUp
              size={14}
              className={`ml-auto text-slate-500 group-hover:text-slate-300 transition-transform duration-200 shrink-0 ${
                profileOpen ? '' : 'rotate-180'
              }`}
            />
          </button>
        </div>
      </aside>

      {/* Notification Preferences Modal */}
      {notifOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setNotifOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md flex flex-col"
            style={{ maxHeight: '85vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-red-400" />
                <h2 className="text-white font-semibold text-sm">Notification Preferences</h2>
              </div>
              <button
                onClick={() => setNotifOpen(false)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Sub-header */}
            <div className="px-5 py-3 border-b border-slate-800 shrink-0">
              <p className="text-slate-400 text-xs leading-relaxed">
                Enable notifications for specific products. You&apos;ll be alerted whenever a tracked product is affected by new activity.
              </p>
            </div>

            {/* Product list — scrollable */}
            <div className="overflow-y-auto flex-1 px-3 py-2">
              {PRODUCTS.map(({ name, icon }) => {
                const pref = prefs[name];
                const isExpanded = expanded[name];
                return (
                  <div key={name} className="mb-1">
                    {/* Product row */}
                    <div className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-800/40 group transition-colors">
                      {/* Expand/collapse chevron */}
                      <button
                        type="button"
                        onClick={() => setExpanded(e => ({ ...e, [name]: !e[name] }))}
                        className="text-slate-600 hover:text-slate-300 transition-colors shrink-0"
                        disabled={!pref.enabled}
                      >
                        {isExpanded && pref.enabled
                          ? <ChevronDown size={13} />
                          : <ChevronDown size={13} className={pref.enabled ? '' : 'opacity-0'} />
                        }
                      </button>

                      <span className="text-base shrink-0 select-none">{icon}</span>
                      <span className={`text-sm font-medium flex-1 ${pref.enabled ? 'text-white' : 'text-slate-400'}`}>
                        {name}
                      </span>
                      <Toggle on={pref.enabled} onChange={() => toggleProduct(name)} />
                    </div>

                    {/* Event sub-options */}
                    {pref.enabled && isExpanded && (
                      <div className="ml-8 mb-1 border-l border-slate-700/60 pl-3 space-y-0.5">
                        {PRODUCT_EVENTS.map(({ key, label }) => (
                          <div
                            key={key}
                            className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-slate-800/40 transition-colors cursor-pointer"
                            onClick={() => toggleEvent(name, key)}
                          >
                            <span className="text-xs text-slate-400 hover:text-slate-200 transition-colors select-none">
                              {label}
                            </span>
                            <Toggle on={pref.events[key]} onChange={() => toggleEvent(name, key)} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-800 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-500">
                  {enabledCount === 0
                    ? 'No products tracked'
                    : `${enabledCount} product${enabledCount > 1 ? 's' : ''} tracked`}
                </span>
              </div>
              <button
                onClick={() => setNotifOpen(false)}
                className="w-full bg-red-600 hover:bg-red-500 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
