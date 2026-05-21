import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { themes, Theme, defaultTheme } from '../theme/themes';

interface SettingsState {
  serverUrl: string;
  theme: Theme;
  themeName: string;
  setServerUrl: (url: string) => Promise<void>;
  setTheme: (name: string) => void;
  loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  serverUrl: 'http://localhost:8000',
  theme: defaultTheme,
  themeName: 'dark',

  setServerUrl: async (url: string) => {
    const clean = url.replace(/\/$/, '');
    await SecureStore.setItemAsync('persistServerUrl', clean);
    set({ serverUrl: clean });
  },

  setTheme: (name: string) => {
    const t = themes[name] ?? defaultTheme;
    set({ theme: t, themeName: name });
  },

  loadSettings: async () => {
    const url = await SecureStore.getItemAsync('persistServerUrl');
    const themeName = await SecureStore.getItemAsync('persistTheme');
    const t = themes[themeName ?? 'dark'] ?? defaultTheme;
    set({
      serverUrl: url ?? 'http://localhost:8000',
      theme: t,
      themeName: themeName ?? 'dark',
    });
  },
}));
