'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Loader2, Save, RotateCcw, Shield, Check, X } from 'lucide-react';
import { clsx } from 'clsx';

const ROLES = [
  { key: 'MANAGER',           label: 'Manager',            color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { key: 'AGENT',             label: 'Agent',              color: 'bg-green-100 text-green-700 border-green-300' },
  { key: 'QUALITY',           label: 'Qualité',            color: 'bg-purple-100 text-purple-700 border-purple-300' },
  { key: 'QUALITY_SUPERVISOR',label: 'Sup. Qualité',       color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  { key: 'HR',                label: 'RH',                 color: 'bg-orange-100 text-orange-700 border-orange-300' },
];

type Grid = Record<string, Record<string, boolean>>;

export default function PermissionsPage() {
  const [navItems, setNavItems] = useState<{ key: string; label: string }[]>([]);
  const [grid, setGrid]         = useState<Grid>({});
  const [original, setOriginal] = useState<Grid>({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState<string | null>(null);
  const [saved, setSaved]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, gridRes] = await Promise.all([
        api.get('/permissions/nav-items'),
        api.get('/permissions/menu/grid'),
      ]);
      const items = (itemsRes.data?.data ?? itemsRes.data ?? []).map((i: any) => ({ key: i.key, label: i.label }));
      const g = gridRes.data?.data ?? gridRes.data ?? {};
      setNavItems(items);
      setGrid(JSON.parse(JSON.stringify(g)));
      setOriginal(JSON.parse(JSON.stringify(g)));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (role: string, navKey: string) => {
    setGrid(prev => ({
      ...prev,
      [role]: { ...prev[role], [navKey]: !prev[role]?.[navKey] },
    }));
  };

  const saveRole = async (role: string) => {
    setSaving(role);
    try {
      await api.put(`/permissions/menu/${role}`, { perms: grid[role] });
      setOriginal(prev => ({ ...prev, [role]: { ...grid[role] } }));
      setSaved(role);
      setTimeout(() => setSaved(null), 2000);
    } finally { setSaving(null); }
  };

  const resetRole = (role: string) => {
    setGrid(prev => ({ ...prev, [role]: { ...original[role] } }));
  };

  const isDirty = (role: string) =>
    JSON.stringify(grid[role]) !== JSON.stringify(original[role]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={28} className="animate-spin text-primary-400" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
            <Shield size={20} className="text-primary-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Permissions du menu</h1>
            <p className="text-sm text-gray-500">Contrôlez quelles rubriques sont visibles par rôle</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {ROLES.map(({ key: role, label, color }) => (
          <div key={role} className="card overflow-hidden">
            {/* Header rôle */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <span className={clsx('text-xs font-bold px-2.5 py-1 rounded-full border', color)}>{label}</span>
                {isDirty(role) && (
                  <span className="text-xs text-amber-600 font-medium">• Modifications non sauvegardées</span>
                )}
                {saved === role && (
                  <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                    <Check size={12} /> Sauvegardé
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {isDirty(role) && (
                  <button onClick={() => resetRole(role)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 border border-gray-200 transition-colors">
                    <RotateCcw size={12} /> Annuler
                  </button>
                )}
                <button onClick={() => saveRole(role)} disabled={!isDirty(role) || saving === role}
                  className={clsx(
                    'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all',
                    isDirty(role)
                      ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed',
                  )}>
                  {saving === role ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Sauvegarder
                </button>
              </div>
            </div>

            {/* Grille toggles */}
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {navItems.map(({ key: navKey, label: navLabel }) => {
                const on = grid[role]?.[navKey] ?? false;
                return (
                  <button
                    key={navKey}
                    onClick={() => toggle(role, navKey)}
                    className={clsx(
                      'flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all text-left',
                      on
                        ? 'bg-green-50 border-green-300 text-green-800'
                        : 'bg-red-50 border-red-200 text-red-400',
                    )}>
                    <span className="truncate">{navLabel}</span>
                    {on
                      ? <Check size={13} className="text-green-600 shrink-0" />
                      : <X size={13} className="text-red-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
