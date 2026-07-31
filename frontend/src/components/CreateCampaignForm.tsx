import { useState } from 'react';

import type { LedgerInfo } from '../hooks/useDapp';
import { parseTokens } from '../lib/format';

type Props = {
    ledger: LedgerInfo;
    busy: string | null;
    onCreate: (input: {
        title: string;
        description: string;
        goalAmount: bigint;
        durationDays: bigint;
    }) => Promise<boolean>;
};

export function CreateCampaignForm({ ledger, busy, onCreate }: Props) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [goal, setGoal] = useState('');
    const [days, setDays] = useState('30');
    const [error, setError] = useState<string | null>(null);

    function reset() {
        setTitle('');
        setDescription('');
        setGoal('');
        setDays('30');
        setError(null);
    }

    async function submit(event: React.FormEvent) {
        event.preventDefault();

        // Mirrors the canister's own validation so the failure is immediate
        // rather than a round-trip away.
        if (!title.trim() || !description.trim()) {
            setError('Title and description are both required.');
            return;
        }

        const goalAmount = parseTokens(goal, ledger.decimals);
        if (goalAmount === null || goalAmount <= 0n) {
            setError(
                `Goal must be a positive amount with at most ${ledger.decimals} decimal places.`
            );
            return;
        }

        const duration = Number(days);
        if (!Number.isInteger(duration) || duration < 1 || duration > 365) {
            setError('Duration must be a whole number of days, from 1 to 365.');
            return;
        }

        setError(null);
        const created = await onCreate({
            title: title.trim(),
            description: description.trim(),
            goalAmount,
            durationDays: BigInt(duration)
        });

        if (created) {
            reset();
            setOpen(false);
        }
    }

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
                Start a campaign
            </button>
        );
    }

    return (
        <form
            onSubmit={submit}
            className="rounded-xl border border-line bg-surface p-5 shadow-sm"
        >
            <h2 className="text-base font-semibold">Start a campaign</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                    <span className="text-xs font-medium text-muted">Title</span>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={100}
                        className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent"
                        placeholder="What are you raising for?"
                    />
                </label>

                <label className="sm:col-span-2">
                    <span className="text-xs font-medium text-muted">
                        Description
                    </span>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        maxLength={600}
                        className="mt-1 w-full resize-y rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent"
                        placeholder="What will the funds be used for?"
                    />
                </label>

                <label>
                    <span className="text-xs font-medium text-muted">
                        Goal ({ledger.symbol})
                    </span>
                    <input
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                        inputMode="decimal"
                        placeholder="0.00"
                        className="tnum mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                </label>

                <label>
                    <span className="text-xs font-medium text-muted">
                        Duration (days, 1–365)
                    </span>
                    <input
                        value={days}
                        onChange={(e) => setDays(e.target.value)}
                        inputMode="numeric"
                        className="tnum mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                </label>
            </div>

            {error && <p className="mt-3 text-xs text-danger">{error}</p>}

            <div className="mt-4 flex gap-2">
                <button
                    type="submit"
                    disabled={busy !== null}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                >
                    {busy === 'create' ? 'Creating…' : 'Create campaign'}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        reset();
                        setOpen(false);
                    }}
                    className="rounded-lg border border-line px-4 py-2 text-sm transition hover:bg-canvas"
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}
