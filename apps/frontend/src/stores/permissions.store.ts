import { create } from 'zustand';
import { api } from '@/lib/api';

interface PermissionsState {
  menuPerms: Record<string, boolean> | null;
  loading: boolean;
  fetch: () => Promise<void>;
  reset: () => void;
}

export const usePermissionsStore = create<PermissionsState>((set) => ({
  menuPerms: null,
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/permissions/menu/me');
      set({ menuPerms: res.data?.data ?? res.data });
    } catch {
      set({ menuPerms: null });
    } finally {
      set({ loading: false });
    }
  },

  reset: () => set({ menuPerms: null }),
}));
