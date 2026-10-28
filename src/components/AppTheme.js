'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { Theme } from '@astryxdesign/core';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';

const ColorModeContext = createContext({
  mode: 'light',
  toggleMode: () => {},
  setMode: () => {},
});

export function useColorMode() {
  return useContext(ColorModeContext);
}

export default function AppTheme({ children }) {
  const [mode, setModeState] = useState('light');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('standup-theme');
      if (saved === 'dark' || saved === 'light') {
        setModeState(saved);
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setModeState('dark');
      }
    } catch (_) {}
  }, []);

  const toggleMode = () => {
    const next = mode === 'dark' ? 'light' : 'dark';
    setModeState(next);
    try {
      localStorage.setItem('standup-theme', next);
    } catch (_) {}
  };

  const setMode = (newMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem('standup-theme', newMode);
    } catch (_) {}
  };

  return (
    <ColorModeContext.Provider value={{ mode, toggleMode, setMode }}>
      <Theme theme={neutralTheme} mode={mode}>
        {children}
      </Theme>
    </ColorModeContext.Provider>
  );
}
