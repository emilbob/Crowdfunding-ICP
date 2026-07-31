import type { ResolvedTheme, ThemeChoice } from '../hooks/useTheme';

type Props = {
    resolved: ResolvedTheme;
    choice: ThemeChoice;
    onToggle: () => void;
};

export function ThemeToggle({ resolved, choice, onToggle }: Props) {
    const goingTo = resolved === 'dark' ? 'light' : 'dark';

    return (
        <button
            onClick={onToggle}
            title={
                choice === 'system'
                    ? `Following your system theme (${resolved}). Click for ${goingTo}.`
                    : `Switch to ${goingTo} mode`
            }
            aria-label={`Switch to ${goingTo} mode`}
            className="relative grid size-9 place-items-center rounded-lg border border-line bg-surface text-muted transition hover:text-ink hover:border-accent/40"
        >
            {/* Both icons are always rendered and cross-faded, so the button
                never reflows and the swap reads as a transition. */}
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                className={`absolute size-[18px] transition-all duration-300 ${
                    resolved === 'dark'
                        ? 'scale-100 rotate-0 opacity-100'
                        : 'scale-50 -rotate-90 opacity-0'
                }`}
                aria-hidden="true"
            >
                <circle cx="12" cy="12" r="4.2" />
                <path d="M12 2.6v2.2M12 19.2v2.2M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.4 19.6 6 18M18 6l1.6-1.6" />
            </svg>
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`absolute size-[18px] transition-all duration-300 ${
                    resolved === 'dark'
                        ? 'scale-50 rotate-90 opacity-0'
                        : 'scale-100 rotate-0 opacity-100'
                }`}
                aria-hidden="true"
            >
                <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.2 8.2 0 1 0 10.2 10.2Z" />
            </svg>

            {choice === 'system' && (
                <span
                    className="absolute right-1 top-1 size-1.5 rounded-full bg-accent"
                    aria-hidden="true"
                />
            )}
        </button>
    );
}
