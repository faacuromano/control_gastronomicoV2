/**
 * Theme Hook
 * Manages dark/light mode with localStorage persistence
 */

import { useState, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'pentiumpos-theme';

/**
 * Get system color scheme preference
 */
function getSystemTheme(): 'light' | 'dark' {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Get initial theme from localStorage or default to system
 */
function getInitialTheme(): Theme {
    if (typeof window === 'undefined') return 'system';
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
    }
    return 'system';
}

/**
 * Apply theme class to document
 */
function applyTheme(theme: Theme): void {
    const root = document.documentElement;
    const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;
    
    if (effectiveTheme === 'dark') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
}

export const useTheme = () => {
    const [theme, setThemeState] = useState<Theme>(getInitialTheme);
    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
        const initial = getInitialTheme();
        return initial === 'system' ? getSystemTheme() : initial;
    });

    // Apply theme on mount and when it changes
    useEffect(() => {
        applyTheme(theme);
        setResolvedTheme(theme === 'system' ? getSystemTheme() : theme);
    }, [theme]);

    // Listen for system theme changes when using 'system' preference
    useEffect(() => {
        if (theme !== 'system') return;
        
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => {
            applyTheme('system');
            setResolvedTheme(e.matches ? 'dark' : 'light');
        };
        
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, [theme]);

    /**
     * Set theme and persist to localStorage
     */
    const setTheme = useCallback((newTheme: Theme) => {
        localStorage.setItem(STORAGE_KEY, newTheme);
        setThemeState(newTheme);
    }, []);

    /**
     * Toggle between light and dark (ignoring system)
     */
    const toggleTheme = useCallback(() => {
        const currentResolved = theme === 'system' ? getSystemTheme() : theme;
        const newTheme = currentResolved === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    }, [theme, setTheme]);

    return {
        theme,
        resolvedTheme,
        setTheme,
        toggleTheme,
        isDark: resolvedTheme === 'dark'
    };
};
