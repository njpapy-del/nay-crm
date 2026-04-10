'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Phone, BarChart2, Settings, LogOut,
  FileText, Receipt, Megaphone, CalendarDays, Headphones, MonitorPlay,
  List, ShieldOff, History, Mic, PhoneCall, TrendingUp, CalendarRange,
  LineChart, Target, Building2, CreditCard, UserCog, ScrollText,
  Activity, CalendarCheck, BrainCircuit, MessageSquare,
  Star, UserCheck, ClipboardList, GraduationCap, Shield,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '@/stores/auth.store';
import { usePermissionsStore } from '@/stores/permissions.store';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/ui/logo';

type Role = 'ADMIN' | 'MANAGER' | 'AGENT' | 'QUALITY' | 'QUALITY_SUPERVISOR' | 'HR';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: Role[];
  navKey: string;  // clé pour le système de permissions
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',         href: '/dashboard',              icon: LayoutDashboard, roles: ['ADMIN', 'MANAGER', 'AGENT'],                                       navKey: 'dashboard' },
  { label: 'Clients',           href: '/clients',                icon: Users,           roles: ['ADMIN', 'MANAGER', 'AGENT'],                                       navKey: 'clients' },
  { label: 'Devis',             href: '/quotes',                 icon: FileText,        roles: ['ADMIN', 'MANAGER'],                                                navKey: 'quotes' },
  { label: 'Factures',          href: '/invoices',               icon: Receipt,         roles: ['ADMIN', 'MANAGER'],                                                navKey: 'invoices' },
  { label: 'Campagnes',         href: '/campaigns',              icon: Megaphone,       roles: ['ADMIN', 'MANAGER', 'AGENT'],                                       navKey: 'campaigns' },
  { label: 'Calendrier',        href: '/calendar',               icon: CalendarDays,    roles: ['ADMIN', 'MANAGER', 'AGENT'],                                       navKey: 'calendar' },
  { label: 'Agenda',            href: '/agenda',                 icon: CalendarRange,   roles: ['ADMIN', 'MANAGER', 'AGENT'],                                       navKey: 'agenda' },
  { label: 'Ventes',            href: '/sales',                  icon: TrendingUp,      roles: ['ADMIN', 'MANAGER', 'AGENT'],                                       navKey: 'sales' },
  { label: 'Chat équipe',       href: '/chat',                   icon: MessageSquare,   roles: ['ADMIN', 'MANAGER', 'AGENT', 'QUALITY'],                            navKey: 'chat' },
  { label: 'Espace Agent',      href: '/agent',                  icon: Headphones,      roles: ['AGENT', 'MANAGER', 'ADMIN'],                                       navKey: 'agent' },
  { label: 'Supervision',       href: '/supervisor',             icon: MonitorPlay,     roles: ['ADMIN', 'MANAGER'],                                                navKey: 'supervision' },
  { label: 'Supervision live',  href: '/supervision',            icon: Headphones,      roles: ['ADMIN', 'MANAGER'],                                                navKey: 'supervisor' },
  { label: 'Suivi agents',      href: '/agent-monitor',          icon: Activity,        roles: ['ADMIN', 'MANAGER'],                                                navKey: 'agent-monitor' },
  { label: 'Planning',          href: '/planning',               icon: CalendarCheck,   roles: ['ADMIN', 'MANAGER', 'AGENT'],                                       navKey: 'planning' },
  { label: 'Appels',            href: '/calls',                  icon: Phone,           roles: ['ADMIN', 'MANAGER', 'AGENT'],                                       navKey: 'calls' },
  { label: 'Listes',            href: '/lists',                  icon: List,            roles: ['ADMIN', 'MANAGER'],                                                navKey: 'lists' },
  { label: 'Blacklist',         href: '/blacklist',              icon: ShieldOff,       roles: ['ADMIN', 'MANAGER'],                                                navKey: 'blacklist' },
  { label: 'Imports',           href: '/imports',                icon: History,         roles: ['ADMIN', 'MANAGER'],                                                navKey: 'imports' },
  { label: 'Enregistrements',   href: '/recordings',             icon: Mic,             roles: ['ADMIN', 'MANAGER'],                                                navKey: 'recordings' },
  { label: 'Journal appels',    href: '/call-logs',              icon: PhoneCall,       roles: ['ADMIN', 'MANAGER', 'AGENT'],                                       navKey: 'call-logs' },
  { label: 'IA Analytique ✦',   href: '/ai-analytics',           icon: BrainCircuit,    roles: ['ADMIN', 'MANAGER', 'QUALITY'],                                     navKey: 'ai-analytics' },
  { label: 'Qualité',           href: '/quality',                icon: Star,            roles: ['ADMIN', 'MANAGER', 'QUALITY', 'QUALITY_SUPERVISOR'],                navKey: 'quality' },
  { label: 'Évaluations',       href: '/quality/evaluations',    icon: ClipboardList,   roles: ['ADMIN', 'MANAGER', 'QUALITY', 'QUALITY_SUPERVISOR'],                navKey: 'quality' },
  { label: 'Grilles QA',        href: '/quality/grids',          icon: GraduationCap,   roles: ['ADMIN', 'MANAGER', 'QUALITY_SUPERVISOR'],                          navKey: 'quality' },
  { label: 'Qualif. RDV',       href: '/quality/qualifications', icon: UserCheck,       roles: ['ADMIN', 'MANAGER', 'QUALITY', 'QUALITY_SUPERVISOR'],                navKey: 'quality' },
  { label: 'RH',                href: '/hr',                     icon: Users,           roles: ['ADMIN', 'MANAGER', 'HR'],                                          navKey: 'hr' },
  { label: 'Demandes RH',       href: '/hr/requests',            icon: FileText,        roles: ['ADMIN', 'MANAGER', 'AGENT', 'QUALITY', 'QUALITY_SUPERVISOR', 'HR'], navKey: 'hr' },
  { label: 'Présences',         href: '/hr/attendance',          icon: Activity,        roles: ['ADMIN', 'MANAGER', 'HR'],                                          navKey: 'hr' },
  { label: 'Agenda RH',         href: '/hr/agenda',              icon: CalendarRange,   roles: ['ADMIN', 'MANAGER', 'HR', 'AGENT', 'QUALITY', 'QUALITY_SUPERVISOR'], navKey: 'hr' },
  { label: 'KPIs',              href: '/kpi',                    icon: Target,          roles: ['ADMIN', 'MANAGER'],                                                navKey: 'kpi' },
  { label: 'Rapports',          href: '/reports',                icon: BarChart2,       roles: ['ADMIN', 'MANAGER'],                                                navKey: 'reports' },
  { label: 'Analytiques',       href: '/analytics',              icon: LineChart,       roles: ['ADMIN', 'MANAGER'],                                                navKey: 'analytics' },
  { label: 'Utilisateurs',      href: '/users',                  icon: Users,           roles: ['ADMIN'],                                                           navKey: 'users' },
  { label: 'Paramètres',        href: '/settings',               icon: Settings,        roles: ['ADMIN'],                                                           navKey: 'settings' },
  { label: 'Permissions menu',  href: '/settings/permissions',   icon: Shield,          roles: ['ADMIN'],                                                           navKey: 'settings' },
  { label: 'Mon entreprise',    href: '/account',                icon: Building2,       roles: ['ADMIN'],                                                           navKey: 'settings' },
  { label: 'Équipe',            href: '/account/team',           icon: UserCog,         roles: ['ADMIN', 'MANAGER'],                                                navKey: 'users' },
  { label: 'Abonnement',        href: '/account/subscription',   icon: CreditCard,      roles: ['ADMIN'],                                                           navKey: 'settings' },
  { label: 'Scripts',           href: '/scripts',                icon: ScrollText,      roles: ['ADMIN', 'MANAGER'],                                                navKey: 'scripts' },
];

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuthStore();
  const menuPerms = usePermissionsStore(s => s.menuPerms);

  const visibleItems = NAV_ITEMS.filter((item) => {
    // ADMIN voit tout sans filtre
    if (role === 'ADMIN') return true;
    // Si permissions chargées → elles sont la source unique de vérité
    if (menuPerms) return menuPerms[item.navKey] === true;
    // Fallback si permissions pas encore chargées → filtre par rôle
    return item.roles.includes(role);
  });

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
