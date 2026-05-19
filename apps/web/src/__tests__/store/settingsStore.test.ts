import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '../../store/settingsStore.js';

function setPersistedLanguage(lang: string) {
  const state = { state: { soundEnabled: true, soundVolume: 0.7, language: lang }, version: 0 };
  localStorage.setItem('botifarra-settings', JSON.stringify(state));
}

describe('settingsStore language guard', () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState({ language: 'ca' });
  });

  it('falls back to "ca" when a stale "es" value is persisted', async () => {
    setPersistedLanguage('es');
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().language).toBe('ca');
  });

  it('keeps "en" when "en" is persisted', async () => {
    setPersistedLanguage('en');
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().language).toBe('en');
  });

  it('keeps "ca" when "ca" is persisted', async () => {
    setPersistedLanguage('ca');
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().language).toBe('ca');
  });
});
