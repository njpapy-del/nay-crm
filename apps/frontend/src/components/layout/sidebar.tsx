'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Phone, BarChart2, Settings, LogOut,
  FileText, Receipt, Megaphone, CalendarDays, Headphones, MonitorPlay,
  List, ShieldOff, History, Mic, PhoneCall, TrendingUp, CalendarRange,
  LineChart, Target, Building2, CreditCard, UserCog, ScrollText,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/ui/logo';

type Role = 'ADMIN' | 'MANAGER' | 'AGENT' | 'QUALITY';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',    href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'MANAGER', 'AGENT'] },
  { label: 'Clients',      href: '/clients',   icon: Users,           roles: ['ADMIN', 'MANAGER', 'AGENT'] },
  { label: 'Devis',        href: '/quotes',     icon: FileText,     roles: ['ADMIN', 'MANAGER'] },
  { label: 'Factures',     href: '/invoices',   icon: Receipt,      roles: ['ADMIN', 'MANAGER'] },
  { label: 'Campagnes',    href: '/campaigns',  icon: Megaphone,    roles: ['ADMIN', 'MANAGER', 'AGENT'] },
  { label: 'Calendrier',   href: '/calendar',   icon: CalendarDays,  roles: ['ADMIN', 'MANAGER', 'AGENT'] },
  { label: 'Agenda',       href: '/agenda',     icon: CalendarRange, roles: ['ADMIN', 'MANAGER', 'AGENT'] },
  { label: 'Ventes',       href: '/sales',      icon: TrendingUp,    roles: ['ADMIN', 'MANAGER', 'AGENT'] },
  { label: 'Espace Agent',  href: '/agent',      icon: Headphones,   roles: ['AGENT', 'MANAGER', 'ADMIN'] },
  { label: 'Supervision',   href: '/supervisor', icon: MonitorPlay,  roles: ['ADMIN', 'MANAGER'] },
  { label: 'Appels',        href: '/calls',      icon: Phone,        roles: ['ADMIN', 'MANAGER', 'AGENT'] },
  { label: 'Listes',         href: '/lists',       icon: List,      roles: ['ADMIN', 'MANAGER'] },
  { label: 'Blacklist',      href: '/blacklist',   icon: ShieldOff, roles: ['ADMIN', 'MANAGER'] },
  { label: 'Imports',        href: '/imports',     icon: History,   roles: ['ADMIN', 'MANAGER'] },
  { label: 'Enregistrements',href: '/recordings',  icon: Mic,       roles: ['ADMIN', 'MANAGER'] },
  { label: 'Journal appels', href: '/call-logs',   icon: PhoneCall, roles: ['ADMIN', 'MANAGER', 'AGENT'] },
  { label: 'KPIs',          href: '/kpi',        icon: Target,          roles: ['ADMIN', 'MANAGER'] },
  { label: 'Rapports',     href: '/reports',   icon: BarChart2,       roles: ['ADMIN', 'MANAGER'] },
  { label: 'Analytiques',  href: '/analytics', icon: LineChart,       roles: ['ADMIN', 'MANAGER'] },
  { label: 'Utilisateurs', href: '/users',     icon: Users,           roles: ['ADMIN'] },
  { label: 'Paramètres',   href: '/settings',  icon: Settings,        roles: ['ADMIN'] },
  { label: 'Mon entreprise', href: '/account',              icon: Building2,  roles: ['ADMIN'] },
  { label: 'Équipe',         href: '/account/team',         icon: UserCog,    roles: ['ADMIN', 'MANAGER'] },
  { label: 'Abonnement',     href: '/account/subscription', icon: CreditCard,   roles: ['ADMIN'] },
  { label: 'Scripts',        href: '/scripts',              icon: ScrollText,   roles: ['ADMIN', 'MANAGER'] },
];

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuthStore();

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <aside className="w-64 h-full bg-sidebar-bg flex flex-col">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-white/10">
        <Logo size={36} dark />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-primary-600 text-white'
                  : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white',
              )}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm
                     font-medium text-sidebar-text hover:bg-sidebar-hover hover:text-white transition-colors"
        >
          <LogOut size={18} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
