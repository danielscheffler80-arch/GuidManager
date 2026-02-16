import React, { createContext, useState, useEffect, PropsWithChildren } from 'react';

type Theme = 'dark' | 'light';

type ThemeCtx = {
  theme: Theme;
  toggleTheme: () => void;
};

export const ThemeContext = createContext<ThemeCtx>({
  theme: 'dark',
  toggleTheme: () => {}
});

export function ThemeProvider({ children }: PropsWithChildren<{}>) {
  const [theme, setTheme] = useState<Theme>('dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
