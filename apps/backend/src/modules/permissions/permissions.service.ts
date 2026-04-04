import { Injectable } from '@nestjs/common';

// Définition centrale des modules et actions disponibles
export const MODULES = [
  'clients', 'campaigns', 'leads', 'calls', 'call-logs', 'recordings',
  'analytics', 'kpi', 'reports', 'sales', 'agenda', 'calendar',
  'users', 'supervision', 'imports', 'lists', 'blacklist',
  'quotes', 'invoices', 'products', 'settings',
];

export const ACTIONS = ['read', 'write', 'delete', 'export', 'admin'] as const;
export type Action = typeof ACTIONS[number];

// Permissions par défaut par rôle
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
};

@Injectable()
export class PermissionsService {
  /** Retourne les permissions par défaut d'un rôle */
  getDefaults(role: string) {
    return DEFAULT_PERMS[role] ?? {};
  }

  /** Vérifie si un rôle a accès à un module/action */
  can(role: string, module: string, action: Action): boolean {
    const perms = DEFAULT_PERMS[role];
    if (!perms) return false;
    const adminAll = perms['*']?.includes(action) || perms['*']?.includes('admin');
    if (adminAll) return true;
    return perms[module]?.includes(action) ?? false;
  }

  /** Retourne la matrice complète modules × actions pour un rôle */
  getMatrix(role: string) {
    const perms = DEFAULT_PERMS[role] ?? {};
    return MODULES.map((mod) => ({
      module: mod,
      actions: Object.fromEntries(ACTIONS.map((a) => [a, this.can(role, mod, a)])),
    }));
  }

  /** Tous les modules dispo */
  getModules() { return MODULES; }

  /** Toutes les actions dispo */
  getActions() { return ACTIONS; }

  /** Rôles disponibles */
  getRoles() { return ['ADMIN', 'MANAGER', 'AGENT', 'QUALITY']; }
}
