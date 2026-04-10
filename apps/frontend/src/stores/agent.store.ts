import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AgentSessionState {
  logged: boolean;
  extension: string;
  selectedCamp: string;
  campDialerMode: string | null;
  sipConfig: any | null;

  setLogged: (v: boolean) => void;
  setExtension: (v: string) => void;
  setSelectedCamp: (v: string) => void;
  setCampDialerMode: (v: string | null) => void;
  setSipConfig: (v: any) => void;
  reset: () => void;
}

export const useAgentStore = create<AgentSessionState>()(
  persist(
    (set) => ({
      logged: false,
      extension: '',
      selectedCamp: '',
      campDialerMode: null,
      sipConfig: null,

      setLogged:        (v) => set({ logged: v }),
      setExtension:     (v) => set({ extension: v }),
      setSelectedCamp:  (v) => set({ selectedCamp: v }),
      setCampDialerMode:(v) => set({ campDialerMode: v }),
      setSipConfig:     (v) => set({ sipConfig: v }),
      reset: () => set({ logged: false, extension: '', selectedCamp: '', campDialerMode: null, sipConfig: null }),
    }),
    {
      name: 'lnaycrm-agent-session',
      partialize: (s) => ({
        logged: s.logged,
        extension: s.extension,
        selectedCamp: s.selectedCamp,
        campDialerMode: s.campDialerMode,
        // sipConfig non persisté (contient mot de passe SIP, reconstruit au reconnect)
      }),
    },
  ),
);
