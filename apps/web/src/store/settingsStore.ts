import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n from '../i18n/index.js';

export interface SettingsState {
  soundEnabled: boolean;
  soundVolume: number; // 0–1
  language: string;
  setSoundEnabled: (enabled: boolean) => void;
  setSoundVolume: (volume: number) => void;
  setLanguage: (lang: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      soundVolume: 0.7,
      language: i18n.language || 'ca',
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setSoundVolume: (soundVolume) => set({ soundVolume: Math.max(0, Math.min(1, soundVolume)) }),
      setLanguage: (language) => {
        i18n.changeLanguage(language);
        set({ language });
      },
    }),
    { name: 'botifarra-settings' },
  ),
);
