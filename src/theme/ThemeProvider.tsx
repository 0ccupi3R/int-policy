import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeMode } from './types';

interface ThemeContextValue {
  mode: ThemeMode;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  toggleTheme: () => {},
  setThemeMode: () => {},
});

export const ThemeProvider: React.FC<{
  defaultMode?: ThemeMode;
  children: React.ReactNode;
}> = ({ defaultMode = 'dark', children }) => {
  const [mode, setMode] = useState<ThemeMode>(defaultMode);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const toggleTheme = () => {
    setMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, setThemeMode: setMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAuTheme = () => useContext(ThemeContext);
