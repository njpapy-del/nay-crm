import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export const MODULES = [
  'clients', 'campaigns', 'leads', 'calls', 'call-logs', 'recordings',
  'analytics', 'kpi', 'reports', 'sales', 'agenda', 'calendar',
  'users', 'supervision', 'imports', 'lists', 'blacklist',
  'quotes', 'invoices', 'products', 'settings',
];

export const ACTIONS = ['read', 'write', 'delete', 'export', 'admin'] as const;
export type Action = typeof ACTIONS[number];

const DEFAULT_PERMS: Record<string, Record<string, Action[]>> = {
  ADMIN: Object.fromEntries(MODULES.map((m) => [m, ['read', 'write', 'delete', 'export', 'admin']])),
  MANAGER: {
    clients: ['read', 'write', 'delete', 'export'],
    campaigns: ['read', 'write', 'delete', 'export'],
    calls: ['read', 'write', 'export'],
    'call-logs': ['read', 'write', 'export'],
    analytics: ['read', 'export'],
    kpi: ['read', 'export'],
    reports: ['read', 'write', 'delete', 'export'],
    users: ['read'],
    recordings: ['read', 'export'],
    sales: ['read', 'write', 'export'],
    agenda: ['read', 'write'],
    leads: ['read', 'write', 'delete'],
    supervision: ['read'],
    imports: ['read', 'write'],
    lists: ['read', 'write'],
    blacklist: ['read', 'write'],
    quotes: ['read', 'write', 'export'],
    invoices: ['read', 'write', 'export'],
    products: ['read', 'write'],
  },
  AGENT: {
    clients: ['read', 'write'],
    calls: ['read', 'write'],
    'call-logs': ['read', 'write'],
    campaigns: ['read'],
    leads: ['read', 'write'],
    agenda: ['read', 'write'],
    sales: ['read', 'write'],
  },
  QUALITY: {
    recordings: ['read', 'export'],
    'call-logs': ['read', 'write', 'export'],
    kpi: ['read', 'export'],
    reports: ['read', 'export'],
    analytics: ['read', 'export'],
    calls: ['read'],
    clients: ['read'],
  },
  QUALITY_SUPERVISOR: {
    recordings: ['read', 'export'],
    'call-logs': ['read', 'write', 'export'],
    kpi: ['read', 'export'],
    reports: ['read', 'export'],
    analytics: ['read', 'export'],
    calls: ['read'],
    clients: ['read'],
  },
  HR: {
    users: ['read'],
    reports: ['read'],
    kpi: ['read'],
  },
};

// Mapping navKey → rôles autorisés par défaut (pour pré-remplir la grille)
export const NAV_ITEMS: { key: string; label: string; defaultRoles: string[] }[] = [
  { key: 'dashboard',       label: 'Dashboard',           defaultRoles: ['ADMIN','MANAGER','AGENT'] },
  { key: 'clients',         label: 'Clients',             defaultRoles: ['ADMIN','MANAGER','AGENT'] },
  { key: 'campaigns',       label: 'Campagnes',           defaultRoles: ['ADMIN','MANAGER','AGENT'] },
  { key: 'agent',           label: 'Espace Agent',        defaultRoles: ['ADMIN','MANAGER','AGENT'] },
  { key: 'calls',           label: 'Appels',              defaultRoles: ['ADMIN','MANAGER','AGENT'] },
  { key: 'call-logs',       label: 'Journal appels',      defaultRoles: ['ADMIN','MANAGER','AGENT'] },
  { key: 'quotes',          label: 'Devis',               defaultRoles: ['ADMIN','MANAGER'] },
  { key: 'invoices',        label: 'Factures',            defaultRoles: ['ADMIN','MANAGER'] },
  { key: 'sales',           label: 'Ventes',              defaultRoles: ['ADMIN','MANAGER','AGENT'] },
  { key: 'agenda',          label: 'Agenda',              defaultRoles: ['ADMIN','MANAGER','AGENT'] },
  { key: 'calendar',        label: 'Calendrier',          defaultRoles: ['ADMIN','MANAGER','AGENT'] },
  { key: 'reports',         label: 'Rapports',            defaultRoles: ['ADMIN','MANAGER'] },
  { key: 'analytics',       label: 'Analytiques',         defaultRoles: ['ADMIN','MANAGER'] },
  { key: 'kpi',             label: 'KPIs',                defaultRoles: ['ADMIN','MANAGER'] },
  { key: 'ai-analytics',    label: 'IA Analytique',       defaultRoles: ['ADMIN','MANAGER','QUALITY'] },
  { key: 'supervision',     label: 'Supervision',         defaultRoles: ['ADMIN','MANAGER'] },
  { key: 'supervisor',      label: 'Supervision live',    defaultRoles: ['ADMIN','MANAGER'] },
  { key: 'agent-monitor',   label: 'Suivi agents',        defaultRoles: ['ADMIN','MANAGER'] },
  { key: 'recordings',      label: 'Enregistrements',     defaultRoles: ['ADMIN','MANAGER'] },
  { key: 'imports',         label: 'Imports',             defaultRoles: ['ADMIN','MANAGER'] },
  { key: 'lists',           label: 'Listes',              defaultRoles: ['ADMIN','MANAGER'] },
  { key: 'blacklist',       label: 'Blacklist',           defaultRoles: ['ADMIN','MANAGER'] },
  { key: 'scripts',         label: 'Scripts',             defaultRoles: ['ADMIN','MANAGER'] },
  { key: 'quality',         label: 'Qualité',             defaultRoles: ['ADMIN','MANAGER','QUALITY','QUALITY_SUPERVISOR'] },
  { key: 'hr',              label: 'RH',                  defaultRoles: ['ADMIN','MANAGER','HR'] },
  { key: 'planning',        label: 'Planning',            defaultRoles: ['ADMIN','MANAGER','AGENT'] },
  { key: 'chat',            label: 'Chat équipe',         defaultRoles: ['ADMIN','MANAGER','AGENT','QUALITY'] },
  { key: 'users',           label: 'Utilisateurs',        defaultRoles: ['ADMIN'] },
  { key: 'settings',        label: 'Paramètres',          defaultRoles: ['ADMIN'] },
];

export const CONFIGURABLE_ROLES = ['MANAGER', 'AGENT', 'QUALITY', 'QUALITY_SUPERVISOR', 'HR'];

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  getDefaults(role: string) { return DEFAULT_PERMS[role] ?? {}; }

  can(role: string, module: string, action: Action): boolean {
    const perms = DEFAULT_PERMS[role];
    if (!perms) return false;
    return perms[module]?.includes(action) ?? false;
  }

  getMatrix(role: string) {
    return MODULES.map((mod) => ({
      module: mod,
      actions: Object.fromEntries(ACTIONS.map((a) => [a, this.can(role, mod, a)])),
    }));
  }

  getModules() { return MODULES; }
  getActions()  { return ACTIONS; }
  getRoles()    { return CONFIGURABLE_ROLES; }
  getNavItems() { return NAV_ITEMS; }

  // ── Menu visibility ────────────────────────────────────────

  /** Retourne les navKeys visibles pour un rôle dans ce tenant */
  async getMenuPerms(tenantId: string, role: string): Promise<Record<string, boolean>> {
    const rows = await (this.prisma as any).roleMenuPermission.findMany({
      where: { tenantId, role },
      select: { navKey: true, visible: true },
    });

    // Construire map depuis DB
    const dbMap: Record<string, boolean> = {};
    for (const r of rows) dbMap[r.navKey] = r.visible;

    // Fusionner avec les défauts (si pas en DB → défaut selon defaultRoles)
    const result: Record<string, boolean> = {};
    for (const item of NAV_ITEMS) {
      if (item.key in dbMap) {
        result[item.key] = dbMap[item.key];
      } else {
        result[item.key] = item.defaultRoles.includes(role);
      }
    }
    return result;
  }

  /** Retourne la grille complète pour l'admin : tous les rôles × tous les navItems */
  async getFullGrid(tenantId: string): Promise<Record<string, Record<string, boolean>>> {
    const rows = await (this.prisma as any).roleMenuPermission.findMany({
      where: { tenantId },
      select: { role: true, navKey: true, visible: true },
    });

    const dbMap: Record<string, Record<string, boolean>> = {};
    for (const r of rows) {
      if (!dbMap[r.role]) dbMap[r.role] = {};
      dbMap[r.role][r.navKey] = r.visible;
    }

    const grid: Record<string, Record<string, boolean>> = {};
    for (const role of CONFIGURABLE_ROLES) {
      grid[role] = {};
      for (const item of NAV_ITEMS) {
        const inDb = dbMap[role]?.[item.key];
        grid[role][item.key] = inDb !== undefined ? inDb : item.defaultRoles.includes(role);
      }
    }
    return grid;
  }

  /** Sauvegarde une modification : rôle × navKey × visible */
  async setMenuPerm(tenantId: string, role: string, navKey: string, visible: boolean) {
    return (this.prisma as any).roleMenuPermission.upsert({
      where: { tenantId_role_navKey: { tenantId, role, navKey } },
      create: { tenantId, role, navKey, visible },
      update: { visible },
    });
  }

  /** Sauvegarde toute une ligne (un rôle d'un coup) */
  async saveRolePerms(tenantId: string, role: string, perms: Record<string, boolean>) {
    const ops = Object.entries(perms).map(([navKey, visible]) =>
      (this.prisma as any).roleMenuPermission.upsert({
        where: { tenantId_role_navKey: { tenantId, role, navKey } },
        create: { tenantId, role, navKey, visible },
        update: { visible },
      }),
    );
    await Promise.all(ops);
    return { ok: true };
  }
}
