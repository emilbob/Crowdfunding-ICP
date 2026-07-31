import { useState } from 'react';

import type { Campaign, LedgerInfo } from '../hooks/useDapp';
import {
    campaignState,
    formatTokens,
    parseTokens,
    shortPrincipal,
    timeRemaining
} from '../lib/format';

const STATE_STYLES: Record<string, string> = {
    open: 'bg-accent/10 text-accent',
    'goal-reached': 'bg-positive/10 text-positive',
    settled: 'bg-muted/15 text-muted',
    expired: 'bg-warning/15 text-warning'
};

const STATE_LABELS: Record<string, string> = {
    open: 'Open',
    'goal-reached': 'Goal reached',
    settled: 'Settled',
    expired: 'Ended below goal'
};

type Props = {
    campaign: Campaign;
    ledger: LedgerInfo;
    isOwner: boolean;
    signedIn: boolean;
    busy: string | null;
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
    onContribute,
    onWithdraw,
    onRefund,
    onDelete
}: Props) {
    const [amount, setAmount] = useState('');
    const [amountError, setAmountError] = useState<string | null>(null);

    const state = campaignState(campaign);
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
        <article className="rounded-xl border border-line bg-surface p-5 shadow-sm">
            <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">
                        {campaign.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted">
                        #{campaign.id} · by{' '}
                        <span className="tnum">
                            {shortPrincipal(campaign.owner.toText())}
                        </span>
                        {isOwner && (
                            <span className="ml-1 font-medium text-accent">
                                (you)
                            </span>
                        )}
                    </p>
                </div>
                <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATE_STYLES[state]}`}
                >
                    {STATE_LABELS[state]}
                </span>
            </header>

            <p className="mt-3 line-clamp-3 text-sm text-muted">
                {campaign.description}
            </p>

            <div className="mt-4">
                <div
                    className="h-2 overflow-hidden rounded-full bg-line"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${pct}% funded`}
                >
                    <div
                        className={`h-full rounded-full transition-[width] duration-500 ${
                            state === 'expired' ? 'bg-warning' : 'bg-accent'
                        }`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <div className="mt-2 flex items-baseline justify-between text-sm">
                    <span className="tnum font-medium">
                        {formatTokens(
                            campaign.currentAmount,
                            ledger.decimals,
                            ledger.symbol
                        )}
                    </span>
                    <span className="tnum text-xs text-muted">
                        of{' '}
                        {formatTokens(
                            campaign.goalAmount,
                            ledger.decimals,
                            ledger.symbol
                        )}{' '}
                        · {pct}%
                    </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                    {state === 'settled'
                        ? 'Funds withdrawn by the owner'
                        : timeRemaining(campaign.endDate)}
                </p>
            </div>

            {state === 'open' && signedIn && (
                <form onSubmit={submitContribution} className="mt-4">
                    <label
                        htmlFor={`amount-${campaign.id}`}
                        className="block text-xs font-medium text-muted"
                    >
                        Contribute (up to{' '}
                        {formatTokens(remaining, ledger.decimals, ledger.symbol)})
                    </label>
                    <div className="mt-1 flex gap-2">
                        <input
                            id={`amount-${campaign.id}`}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            inputMode="decimal"
                            placeholder="0.00"
                            className="tnum min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent"
                        />
                        <button
                            type="submit"
                            disabled={anyBusy}
                            className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                        >
                            {isBusy('contribute') ? 'Approving…' : 'Contribute'}
                        </button>
                    </div>
                    {amountError && (
                        <p className="mt-1 text-xs text-danger">{amountError}</p>
                    )}
                    <p className="mt-1 text-xs text-muted">
                        Two transactions: an ICRC-2 approval, then the
                        contribution. A ledger fee of{' '}
                        {formatTokens(ledger.fee, ledger.decimals, ledger.symbol)}{' '}
                        applies.
                    </p>
                </form>
            )}

            {state === 'open' && !signedIn && (
                <p className="mt-4 rounded-lg bg-canvas px-3 py-2 text-xs text-muted">
                    Sign in to contribute to this campaign.
                </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
                {isOwner && state === 'goal-reached' && (
                    <button
                        onClick={() => onWithdraw(campaign.id)}
                        disabled={anyBusy}
                        className="rounded-lg bg-positive px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                        {isBusy('withdrawFunds') ? 'Withdrawing…' : 'Withdraw funds'}
                    </button>
                )}

                {signedIn && state === 'expired' && (
                    <button
                        onClick={() => onRefund(campaign.id)}
                        disabled={anyBusy}
                        className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-canvas disabled:opacity-50"
                    >
                        {isBusy('refund') ? 'Refunding…' : 'Claim my refund'}
                    </button>
                )}

                {isOwner &&
                    (state === 'settled' || campaign.currentAmount === 0n) && (
                        <button
                            onClick={() => onDelete(campaign.id)}
                            disabled={anyBusy}
                            className="rounded-lg border border-line px-3 py-1.5 text-sm text-danger transition hover:bg-danger/5 disabled:opacity-50"
                        >
                            {isBusy('deleteCampaign') ? 'Deleting…' : 'Delete'}
                        </button>
                    )}
            </div>
        </article>
    );
}
