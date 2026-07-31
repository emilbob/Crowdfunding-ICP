import { useCallback, useEffect, useState } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'crowdfund:theme';

function storedChoice(): ThemeChoice {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
}

function systemTheme(): ResolvedTheme {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
}

export function useTheme() {
    const [choice, setChoice] = useState<ThemeChoice>(storedChoice);
    const [resolved, setResolved] = useState<ResolvedTheme>(() =>
        storedChoice() === 'system'
            ? systemTheme()
            : (storedChoice() as ResolvedTheme)
    );

    useEffect(() => {
        const apply = () => {
            const next = choice === 'system' ? systemTheme() : choice;
            setResolved(next);
            document.documentElement.dataset.theme = next;
        };

        apply();

        if (choice !== 'system') {
            localStorage.setItem(STORAGE_KEY, choice);
            return;
        }

        // Following the OS means reacting to it changing mid-session.
        localStorage.removeItem(STORAGE_KEY);
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        media.addEventListener('change', apply);
        return () => media.removeEventListener('change', apply);
    }, [choice]);

    const toggle = useCallback(() => {
        // Toggling picks the opposite of what is on screen and pins it, which
        // is what someone means by clicking a sun/moon.
        setChoice(resolved === 'dark' ? 'light' : 'dark');
    }, [resolved]);

    return { choice, resolved, setChoice, toggle };
}
