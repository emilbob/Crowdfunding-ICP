import { useState } from 'react';

import { CampaignCard } from './components/CampaignCard';
import { CreateCampaignForm } from './components/CreateCampaignForm';
import { StatsBar } from './components/StatsBar';
import { ThemeToggle } from './components/ThemeToggle';
import { useDapp } from './hooks/useDapp';
import { useTheme } from './hooks/useTheme';
import { network } from './lib/canisters';
import { formatTokens, shortPrincipal } from './lib/format';

const NOTICE_STYLES = {
    success: 'border-positive/30 bg-positive-soft text-positive',
    error: 'border-danger/30 bg-danger-soft text-danger',
    info: 'border-line bg-raised text-muted'
} as const;

function BrandMark() {
    return (
        <span
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-on-accent"
            aria-hidden="true"
        >
            <svg viewBox="0 0 24 24" fill="none" className="size-4">
                <path
                    d="M4 15.5 9 10l4 4 7-7.5"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M15 6.5h5v5"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </span>
    );
}

export default function App() {
    const dapp = useDapp();
    const theme = useTheme();
    const [copied, setCopied] = useState(false);

    const {
        loading,
        principal,
        ledger,
        campaigns,
        balance,
        busy,
        notice,
        dismissNotice
    } = dapp;

    const signedIn = principal !== null;

    async function copyPrincipal() {
        if (!principal) return;
        try {
            await navigator.clipboard.writeText(principal.toText());
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch {
            // Clipboard can be blocked; the full value is in the title anyway.
        }
    }

    return (
        <div className="min-h-screen">
            <header className="themed sticky top-0 z-10 border-b border-line bg-surface/80 backdrop-blur-md">
                <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-5 py-3">
                    <div className="mr-auto flex items-center gap-2.5">
                        <BrandMark />
                        <div>
                            <h1 className="text-[15px] font-semibold leading-tight tracking-tight">
                                Crowdfund
                            </h1>
                            <p className="flex items-center gap-1.5 text-[11px] leading-tight text-muted">
                                On-chain campaigns
                                {network !== 'ic' && (
                                    <span className="rounded bg-warning-soft px-1.5 py-px font-medium text-warning">
                                        {network}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>

                    {signedIn && ledger && (
                        <button
                            onClick={copyPrincipal}
                            title={principal.toText()}
                            data-principal={principal.toText()}
                            className="themed hidden rounded-lg border border-line bg-canvas px-3 py-1.5 text-right transition hover:border-accent/40 sm:block"
                        >
                            <span className="tnum block text-xs font-semibold leading-tight">
                                {balance === null
                                    ? '—'
                                    : formatTokens(
                                          balance,
                                          ledger.decimals,
                                          ledger.symbol
                                      )}
                            </span>
                            <span className="tnum block text-[10px] leading-tight text-muted">
                                {copied
                                    ? 'copied ✓'
                                    : shortPrincipal(principal.toText())}
                            </span>
                        </button>
                    )}

                    <ThemeToggle
                        resolved={theme.resolved}
                        choice={theme.choice}
                        onToggle={theme.toggle}
                    />

                    {signedIn ? (
                        <button
                            onClick={dapp.signOut}
                            className="rounded-lg border border-line px-3 py-1.5 text-sm transition hover:border-accent/40 hover:bg-raised"
                        >
                            Sign out
                        </button>
                    ) : (
                        <button
                            onClick={dapp.signIn}
                            disabled={busy === 'signin'}
                            className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-on-accent transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                        >
                            {busy === 'signin' ? 'Signing in…' : 'Sign in'}
                        </button>
                    )}
                </div>
            </header>

            <main className="mx-auto max-w-5xl px-5 py-8">
                {notice && (
                    <div
                        role="status"
                        className={`rise mb-6 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${NOTICE_STYLES[notice.tone]}`}
                    >
                        <p className="flex-1 break-words">{notice.message}</p>
                        <button
                            onClick={dismissNotice}
                            aria-label="Dismiss"
                            className="shrink-0 opacity-60 transition hover:opacity-100"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {loading && (
                    <div className="py-20 text-center">
                        <div className="mx-auto size-6 animate-spin rounded-full border-2 border-line border-t-accent" />
                        <p className="mt-3 text-sm text-muted">
                            Connecting to the canister…
                        </p>
                    </div>
                )}

                {!loading && ledger && (
                    <>
                        {campaigns.length > 0 && (
                            <div className="rise mb-6">
                                <StatsBar campaigns={campaigns} ledger={ledger} />
                            </div>
                        )}

                        <div className="mb-6">
                            {signedIn ? (
                                <CreateCampaignForm
                                    ledger={ledger}
                                    busy={busy}
                                    onCreate={dapp.createCampaign}
                                />
                            ) : (
                                <div className="themed flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5">
                                    <p className="mr-auto text-sm text-muted">
                                        Browsing is open to everyone. Sign in to
                                        start a campaign or back one.
                                    </p>
                                    <button
                                        onClick={dapp.signIn}
                                        disabled={busy === 'signin'}
                                        className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-on-accent transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                                    >
                                        Sign in with Internet Identity
                                    </button>
                                </div>
                            )}
                        </div>

                        {campaigns.length === 0 ? (
                            <div className="themed rounded-xl border border-dashed border-line bg-surface/50 py-20 text-center">
                                <p className="text-sm font-medium">
                                    No campaigns yet
                                </p>
                                <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
                                    {signedIn
                                        ? 'Start the first one — it takes a title, a goal and a deadline.'
                                        : 'Sign in to start the first one.'}
                                </p>
                            </div>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2">
                                {campaigns.map((campaign, i) => (
                                    <CampaignCard
                                        key={campaign.id}
                                        campaign={campaign}
                                        ledger={ledger}
                                        index={i}
                                        signedIn={signedIn}
                                        isOwner={
                                            principal?.toText() ===
                                            campaign.owner.toText()
                                        }
                                        busy={busy}
                                        onContribute={dapp.contribute}
                                        onWithdraw={dapp.withdraw}
                                        onRefund={dapp.refund}
                                        onDelete={dapp.remove}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </main>

            <footer className="mx-auto max-w-5xl px-5 pb-10">
                {ledger && (
                    <p className="tnum border-t border-line pt-4 text-xs text-muted">
                        Settling in {ledger.symbol} via ledger{' '}
                        <span title={ledger.id.toText()}>
                            {shortPrincipal(ledger.id.toText())}
                        </span>{' '}
                        · fee{' '}
                        {formatTokens(ledger.fee, ledger.decimals, ledger.symbol)}
                    </p>
                )}
            </footer>
        </div>
    );
}
