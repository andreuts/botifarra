import { createContext } from 'react';

export const SettingsOpenContext = createContext<(() => void) | null>(null);
