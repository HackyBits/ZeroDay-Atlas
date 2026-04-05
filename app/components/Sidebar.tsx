'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShieldAlert,
  Boxes,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react';
import db from '@/lib/instant';

const NAV_ITEMS = [
  { label: 'Dashboard',       href: '/dashboard',       Icon: LayoutDashboard },
  { label: 'Vulnerabilities', href: '/vulnerabilities', Icon: ShieldAlert      },
  { label: 'Products',        href: '/products',        Icon: Boxes            },
  { label: 'Reports',         href: '/reports',         Icon: BarChart3        },
  { label: 'Settings',        href: '/settings',        Icon: Settings         },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
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

      {/* Sign out */}
      <div className="mt-auto pt-4 border-t border-slate-800">
        <button onClick={() => db.auth.signOut()}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-slate-500 hover:text-white hover:bg-slate-800/60 border border-transparent transition-all">
          <LogOut size={16} strokeWidth={1.8} className="shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
