import { CampaignCard } from './components/CampaignCard';
import { CreateCampaignForm } from './components/CreateCampaignForm';
import { useDapp } from './hooks/useDapp';
import { network } from './lib/canisters';
import { formatTokens, shortPrincipal } from './lib/format';

const NOTICE_STYLES = {
    success: 'border-positive/30 bg-positive/10 text-positive',
    error: 'border-danger/30 bg-danger/10 text-danger',
    info: 'border-line bg-canvas text-muted'
} as const;

export default function App() {
    const dapp = useDapp();
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

    return (
        <div className="min-h-screen">
            <header className="border-b border-line bg-surface">
                <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-5 py-4">
                    <div className="mr-auto">
                        <h1 className="text-lg font-semibold tracking-tight">
                            Crowdfund
                        </h1>
                        <p className="text-xs text-muted">
                            On-chain campaigns on the Internet Computer
                            {network !== 'ic' && (
                                <span className="ml-1.5 rounded bg-warning/15 px-1.5 py-0.5 font-medium text-warning">
                                    {network}
                                </span>
                            )}
                        </p>
                    </div>

                    {signedIn && ledger && (
                        <div className="text-right text-xs">
                            <p className="tnum font-medium">
                                {balance === null
                                    ? '—'
                                    : formatTokens(
                                          balance,
                                          ledger.decimals,
                                          ledger.symbol
                                      )}
                            </p>
                            {/* Full principal in `title` and a data attribute:
                                it is truncated for layout, but people need the
                                whole thing to fund or debug an account. */}
                            <p
                                className="tnum text-muted"
                                title={principal.toText()}
                                data-principal={principal.toText()}
                            >
                                {shortPrincipal(principal.toText())}
                            </p>
                        </div>
                    )}

                    {signedIn ? (
                        <button
                            onClick={dapp.signOut}
                            className="rounded-lg border border-line px-3 py-1.5 text-sm transition hover:bg-canvas"
                        >
                            Sign out
                        </button>
                    ) : (
                        <button
                            onClick={dapp.signIn}
                            disabled={busy === 'signin'}
                            className="rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                        >
                            {busy === 'signin'
                                ? 'Signing in…'
                                : 'Sign in with Internet Identity'}
                        </button>
                    )}
                </div>
            </header>

            <main className="mx-auto max-w-5xl px-5 py-8">
                {notice && (
                    <div
                        role="status"
                        className={`mb-6 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${NOTICE_STYLES[notice.tone]}`}
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
                    <p className="py-16 text-center text-sm text-muted">
                        Connecting to the canister…
                    </p>
                )}

                {!loading && ledger && (
                    <>
                        <div className="mb-6">
                            {signedIn ? (
                                <CreateCampaignForm
                                    ledger={ledger}
                                    busy={busy}
                                    onCreate={dapp.createCampaign}
                                />
                            ) : (
                                <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-muted">
                                    Sign in to start a campaign or contribute to
                                    one. Browsing is open to everyone.
                                </p>
                            )}
                        </div>

                        {campaigns.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-line py-16 text-center text-sm text-muted">
                                No campaigns yet.
                            </p>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2">
                                {campaigns.map((campaign) => (
                                    <CampaignCard
                                        key={campaign.id}
                                        campaign={campaign}
                                        ledger={ledger}
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

            <footer className="mx-auto max-w-5xl px-5 pb-10 text-xs text-muted">
                {ledger && (
                    <p className="tnum">
                        Settling in {ledger.symbol} via ledger{' '}
                        {shortPrincipal(ledger.id.toText())} · fee{' '}
                        {formatTokens(ledger.fee, ledger.decimals, ledger.symbol)}
                    </p>
                )}
            </footer>
        </div>
    );
}
