import { useState } from 'react';

import type { Campaign, LedgerInfo } from '../hooks/useDapp';
import {
    campaignState,
    formatTokens,
    parseTokens,
    shortPrincipal,
    timeRemaining,
    type CampaignState
} from '../lib/format';

const STATE: Record<
    CampaignState,
    { label: string; chip: string; dot: string; bar: string }
> = {
    open: {
        label: 'Open',
        chip: 'bg-accent-soft text-accent',
        dot: 'bg-accent',
        bar: 'from-accent/70 to-accent'
    },
    'goal-reached': {
        label: 'Goal reached',
        chip: 'bg-positive-soft text-positive',
        dot: 'bg-positive',
        bar: 'from-positive/70 to-positive'
    },
    settled: {
        label: 'Settled',
        chip: 'bg-raised text-muted',
        dot: 'bg-muted',
        bar: 'from-muted/50 to-muted/70'
    },
    expired: {
        label: 'Ended below goal',
        chip: 'bg-warning-soft text-warning',
        dot: 'bg-warning',
        bar: 'from-warning/70 to-warning'
    }
};

type Props = {
    campaign: Campaign;
    ledger: LedgerInfo;
    isOwner: boolean;
    signedIn: boolean;
    busy: string | null;
    index: number;
    onContribute: (id: string, amount: bigint) => Promise<boolean>;
    onWithdraw: (id: string) => Promise<boolean>;
    onRefund: (id: string) => Promise<boolean>;
    onDelete: (id: string) => Promise<boolean>;
};

export function CampaignCard({
    campaign,
    ledger,
    isOwner,
    signedIn,
    busy,
    index,
    onContribute,
    onWithdraw,
    onRefund,
    onDelete
}: Props) {
    const [amount, setAmount] = useState('');
    const [amountError, setAmountError] = useState<string | null>(null);

    const state = campaignState(campaign);
    const style = STATE[state];

    const pct =
        campaign.goalAmount === 0n
            ? 0
            : Math.min(
                  100,
                  Number((campaign.currentAmount * 100n) / campaign.goalAmount)
              );

    const remaining = campaign.goalAmount - campaign.currentAmount;
    const isBusy = (key: string) => busy === `${key}:${campaign.id}`;
    const anyBusy = busy !== null;

    async function submitContribution(event: React.FormEvent) {
        event.preventDefault();
        const parsed = parseTokens(amount, ledger.decimals);

        if (parsed === null || parsed <= 0n) {
            setAmountError(
                `Enter a positive amount with at most ${ledger.decimals} decimal places.`
            );
            return;
        }

        setAmountError(null);
        if (await onContribute(campaign.id, parsed)) {
            setAmount('');
        }
    }

    return (
        <article
            className="card-hover rise themed group relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface"
            style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
        >
            {/* A hairline of state colour along the top edge. */}
            <div
                className={`h-0.5 w-full bg-gradient-to-r ${style.bar}`}
                aria-hidden="true"
            />

            <div className="flex flex-1 flex-col p-5">
                <header className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="truncate text-[15px] font-semibold tracking-tight">
                            {campaign.title}
                        </h3>
                        <p className="tnum mt-1 text-xs text-muted">
                            #{campaign.id} · {shortPrincipal(campaign.owner.toText())}
                            {isOwner && (
                                <span className="ml-1.5 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                                    you
                                </span>
                            )}
                        </p>
                    </div>
                    <span
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${style.chip}`}
                    >
                        <span className={`size-1.5 rounded-full ${style.dot}`} />
                        {style.label}
                    </span>
                </header>

                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted">
                    {campaign.description}
                </p>

                <div className="mt-5">
                    <div className="flex items-baseline justify-between gap-2">
                        <span className="tnum text-xl font-semibold tracking-tight">
                            {formatTokens(
                                campaign.currentAmount,
                                ledger.decimals,
                                ledger.symbol
                            )}
                        </span>
                        <span className="tnum text-xs text-muted">
                            {pct}% of{' '}
                            {formatTokens(
                                campaign.goalAmount,
                                ledger.decimals,
                                ledger.symbol
                            )}
                        </span>
                    </div>

                    <div
                        className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${pct}% funded`}
                    >
                        <div
                            className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out ${style.bar}`}
                            style={{ width: `${pct}%` }}
                        />
                    </div>

                    <p className="tnum mt-2 text-xs text-muted">
                        {state === 'settled'
                            ? 'Funds withdrawn by the owner'
                            : timeRemaining(campaign.endDate)}
                    </p>
                </div>

                <div className="mt-auto pt-5">
                    {state === 'open' && signedIn && (
                        <form onSubmit={submitContribution}>
                            <div className="flex gap-2">
                                <div className="relative min-w-0 flex-1">
                                    <input
                                        id={`amount-${campaign.id}`}
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        inputMode="decimal"
                                        placeholder="0.00"
                                        aria-label={`Amount to contribute to ${campaign.title}`}
                                        className="tnum w-full rounded-lg border border-line bg-canvas py-2 pl-3 pr-14 text-sm outline-none transition focus:border-accent"
                                    />
                                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted">
                                        {ledger.symbol}
                                    </span>
                                </div>
                                <button
                                    type="submit"
                                    disabled={anyBusy}
                                    className="shrink-0 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-on-accent transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                                >
                                    {isBusy('contribute') ? 'Approving…' : 'Back it'}
                                </button>
                            </div>

                            {amountError ? (
                                <p className="mt-1.5 text-xs text-danger">
                                    {amountError}
                                </p>
                            ) : (
                                <p className="mt-1.5 text-xs text-muted">
                                    Up to{' '}
                                    {formatTokens(
                                        remaining,
                                        ledger.decimals,
                                        ledger.symbol
                                    )}
                                    . Two transactions — approval, then
                                    contribution — plus a{' '}
                                    {formatTokens(
                                        ledger.fee,
                                        ledger.decimals,
                                        ledger.symbol
                                    )}{' '}
                                    fee each.
                                </p>
                            )}
                        </form>
                    )}

                    {state === 'open' && !signedIn && (
                        <p className="rounded-lg border border-dashed border-line px-3 py-2.5 text-center text-xs text-muted">
                            Sign in to back this campaign
                        </p>
                    )}

                    <div className="flex flex-wrap gap-2 empty:hidden">
                        {isOwner && state === 'goal-reached' && (
                            <button
                                onClick={() => onWithdraw(campaign.id)}
                                disabled={anyBusy}
                                className="rounded-lg bg-positive px-3.5 py-2 text-sm font-medium text-on-accent transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                            >
                                {isBusy('withdrawFunds')
                                    ? 'Withdrawing…'
                                    : 'Withdraw funds'}
                            </button>
                        )}

                        {signedIn && state === 'expired' && (
                            <button
                                onClick={() => onRefund(campaign.id)}
                                disabled={anyBusy}
                                className="rounded-lg border border-line px-3.5 py-2 text-sm font-medium transition hover:border-accent/40 hover:bg-raised active:scale-[0.98] disabled:opacity-50"
                            >
                                {isBusy('refund') ? 'Refunding…' : 'Claim my refund'}
                            </button>
                        )}

                        {isOwner &&
                            (state === 'settled' || campaign.currentAmount === 0n) && (
                                <button
                                    onClick={() => onDelete(campaign.id)}
                                    disabled={anyBusy}
                                    className="rounded-lg border border-line px-3.5 py-2 text-sm text-danger transition hover:border-danger/40 hover:bg-danger-soft active:scale-[0.98] disabled:opacity-50"
                                >
                                    {isBusy('deleteCampaign') ? 'Deleting…' : 'Delete'}
                                </button>
                            )}
                    </div>
                </div>
            </div>
        </article>
    );
}
