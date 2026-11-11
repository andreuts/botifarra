import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n from '../i18n/index.js';

export interface SettingsState {
  soundEnabled: boolean;
  soundVolume: number; // 0–1
  language: string;
  bugReportWidgetEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  setSoundVolume: (volume: number) => void;
  setLanguage: (lang: string) => void;
  setBugReportWidgetEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      soundVolume: 0.7,
      language: i18n.language || 'ca',
      bugReportWidgetEnabled: true,
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setSoundVolume: (soundVolume) => set({ soundVolume: Math.max(0, Math.min(1, soundVolume)) }),
      setLanguage: (language) => {
        i18n.changeLanguage(language);
        set({ language });
      },
      setBugReportWidgetEnabled: (bugReportWidgetEnabled) => set({ bugReportWidgetEnabled }),
    }),
    {
      name: 'botifarra-settings',
      onRehydrateStorage: () => (state) => {
        const SUPPORTED_LANGUAGES = ['ca', 'en'] as const;
        if (state && !SUPPORTED_LANGUAGES.includes(state.language as (typeof SUPPORTED_LANGUAGES)[number])) {
          state.language = 'ca';
          i18n.changeLanguage('ca');
        }
      },
    },
  ),
);
